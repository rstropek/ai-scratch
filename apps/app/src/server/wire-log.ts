// Call log at the wire level: each Anthropic call with the exact request body and the response rebuilt from
// the SSE stream (thinking incl. signature, text, tool_use, usage), independent of any framework abstraction.
// The usage always feeds the stats; the call itself is stored only with LOG_DIR (game harness, e2e, dev), never
// in production. The static prefix (system prompt + tools, ~50 KB) is stored once per hash.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { GuardCategory } from '../shared/chat-types.ts';
import { type AnthropicUsage, costOf } from './cost.ts';

/** Who made the call; goes into every log record. */
export interface CallContext {
  accessCode: string;
  session: string | undefined;
  turn: number;
  /** set for calls that are not a chat step: a summary, or the "frage KI" block (turn 0) */
  purpose?: 'compact' | 'ask';
}

export interface CallRecord extends CallContext {
  ts: string;
  ms: number;
  status: number;
  /** request body with system + tools replaced by the hash of the stored prefix */
  request: Record<string, unknown>;
  response: unknown;
  cost: number;
  /** the call was cut off (output guard or a closed connection): the response is what arrived until then */
  aborted?: true;
}

/** One screening of a kid message by the kids-protection guard (guard.ts). */
export interface GuardRecord extends CallContext {
  ts: string;
  ms: number;
  /** the kid's message; replaced by a placeholder when it held personal data */
  text: string;
  category?: GuardCategory;
  nouls: Record<string, number>;
  model?: string;
  error?: string;
}

export interface LogSink {
  /** stores system + tools once; returns the hash that call records reference */
  storePrefix(prefix: string): string;
  append(record: CallRecord): void;
  appendGuard(record: GuardRecord): void;
}

/** the name a stored prefix gets, the same in every sink */
export const prefixHash = (prefix: string): string =>
  crypto.createHash('sha256').update(prefix).digest('hex').slice(0, 16);

/** Stores nothing: the default, so no kid's conversation is kept. */
export const noLogSink: LogSink = { storePrefix: () => '', append: () => {}, appendGuard: () => {} };

/** calls.jsonl + guard.jsonl + prefix-<hash>.json files in a directory. */
export const createFileLogSink = (dir: string): LogSink => {
  fs.mkdirSync(dir, { recursive: true });
  const stored = new Set<string>();
  return {
    storePrefix: (prefix) => {
      const hash = prefixHash(prefix);
      if (!stored.has(hash)) {
        stored.add(hash);
        fs.writeFileSync(path.join(dir, `prefix-${hash}.json`), prefix);
      }
      return hash;
    },
    append: (record) => fs.appendFileSync(path.join(dir, 'calls.jsonl'), `${JSON.stringify(record)}\n`),
    appendGuard: (record) => fs.appendFileSync(path.join(dir, 'guard.jsonl'), `${JSON.stringify(record)}\n`),
  };
};

interface ContentBlock {
  type: string;
  text?: string;
  thinking?: string;
  signature?: string;
  partial_json?: string;
  input?: unknown;
}
export interface AssembledMessage {
  content: ContentBlock[];
  usage: AnthropicUsage;
  stop_reason?: string;
  error?: unknown;
  [key: string]: unknown;
}

/** Rebuilds the final Anthropic message from the SSE stream. */
export const assembleSse = (sse: string): AssembledMessage | undefined => {
  let message: AssembledMessage | undefined;
  for (const line of sse.split('\n')) {
    if (!line.startsWith('data: ')) continue;
    // biome-ignore lint/suspicious/noExplicitAny: Anthropic stream events, shapes per event type
    let e: any;
    try {
      e = JSON.parse(line.slice(6));
    } catch {
      continue; // the last line of an aborted call may be cut off
    }
    if (e.type === 'message_start') message = { ...e.message, content: [], usage: { ...e.message.usage } };
    else if (e.type === 'error') message = { content: [], usage: {}, error: e.error };
    if (!message) continue;
    if (e.type === 'content_block_start') message.content[e.index] = { ...e.content_block };
    else if (e.type === 'content_block_delta') {
      const b = message.content[e.index];
      const d = e.delta;
      if (!b) continue;
      if (d.type === 'text_delta') b.text = (b.text ?? '') + d.text;
      else if (d.type === 'thinking_delta') b.thinking = (b.thinking ?? '') + d.thinking;
      else if (d.type === 'signature_delta') b.signature = (b.signature ?? '') + d.signature;
      else if (d.type === 'input_json_delta') b.partial_json = (b.partial_json ?? '') + d.partial_json;
    } else if (e.type === 'content_block_stop') {
      const b = message.content[e.index];
      if (b?.partial_json !== undefined) {
        try {
          b.input = JSON.parse(b.partial_json || '{}');
        } catch {
          b.input = b.partial_json; // keep what the model sent, even if it isn't valid JSON
        }
        delete b.partial_json;
      }
    } else if (e.type === 'message_delta') {
      Object.assign(message, e.delta);
      Object.assign(message.usage, e.usage);
    }
  }
  return message;
};

const parseResponse = (raw: string, contentType: string | null): AssembledMessage | undefined => {
  if (contentType?.includes('event-stream')) return assembleSse(raw);
  try {
    return JSON.parse(raw);
  } catch {
    return { content: [], usage: {}, error: raw.slice(0, 2000) };
  }
};

/** Strips system + tools from the request body and stores them once in the sink. */
const dedupePrefix = (sink: LogSink, body: string | undefined): Record<string, unknown> => {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(body ?? '{}');
  } catch {
    return { unparsable: String(body).slice(0, 2000) };
  }
  const { system, tools, ...rest } = parsed;
  return { prefix: sink.storePrefix(JSON.stringify({ system, tools })), ...rest };
};

/** Reads a body to the end; an aborted call keeps what arrived until then. */
const readAll = async (body: ReadableStream<Uint8Array>): Promise<{ raw: string; aborted?: true }> => {
  const decoder = new TextDecoder();
  const reader = body.getReader();
  let raw = '';
  try {
    for (let r = await reader.read(); !r.done; r = await reader.read())
      raw += decoder.decode(r.value, { stream: true });
    return { raw: raw + decoder.decode() };
  } catch {
    return { raw, aborted: true };
  }
};

export type OnCall = (record: CallRecord, usage: AnthropicUsage, ok: boolean) => void;

/**
 * A fetch for createAnthropic() that tees each response: one branch goes to the SDK unchanged, the
 * other is logged once complete. Logging never fails or delays the call itself.
 */
export const createLoggingFetch =
  (sink: LogSink, ctx: CallContext, onCall: OnCall = () => {}, baseFetch: typeof fetch = fetch): typeof fetch =>
  async (input, init) => {
    const t0 = Date.now();
    const res = await baseFetch(input, init);
    if (!res.body) return res;
    const [forSdk, forLog] = res.body.tee();
    readAll(forLog)
      .then(({ raw, aborted }) => {
        const response = parseResponse(raw, res.headers.get('content-type'));
        const usage = response?.usage ?? {};
        const record: CallRecord = {
          ts: new Date(t0).toISOString(),
          ms: Date.now() - t0,
          ...ctx,
          status: res.status,
          request: dedupePrefix(sink, typeof init?.body === 'string' ? init.body : undefined),
          response,
          cost: costOf(usage),
          ...(aborted ? { aborted } : {}),
        };
        sink.append(record);
        onCall(record, usage, res.ok);
      })
      .catch((e: unknown) => console.error('call log failed', e));
    return new Response(forSdk, { status: res.status, statusText: res.statusText, headers: res.headers });
  };
