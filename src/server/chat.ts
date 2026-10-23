// POST /api/chat: one model call per request. The tools have no `execute`: the browser runs them on the
// live VM (useChat onToolCall) and sends the results back with the next request of the same turn.
import { createAnthropic } from '@ai-sdk/anthropic';
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  type JSONSchema7,
  jsonSchema,
  streamText,
  type Tool,
  tool,
  toUIMessageStream,
} from 'ai';
import type { Context } from 'hono';
import { normalizeCode } from '../shared/access.ts';
import { ACCESS_CODE_HEADER, type ChatMessage, type ChatMetadata, SESSION_HEADER } from '../shared/chat-types.ts';
import { isAdminCode, memoryFull } from '../shared/energy.ts';
import { buildInstructions, toolDefinitions } from '../shared/tools/index.ts';
import type { Config } from './config.ts';
import { FIXED_ANSWERS, screen } from './guard.ts';
import type { Hearts } from './hearts.ts';
import { buildModelInput, turnNumber } from './model-input.ts';
import { capAnswerText, MAX_STEPS_PER_TURN, STEP_LIMIT_ANSWER, stepsInTurn } from './output-guard.ts';
import { recordCall, recordGuard, type Stats } from './stats.ts';
import { type CallContext, createLoggingFetch, type LogSink } from './wire-log.ts';

const INSTRUCTIONS = buildInstructions();
const TOOLS: Record<string, Tool> = Object.fromEntries(
  toolDefinitions.map((d) => [
    d.name,
    tool({ description: d.description, inputSchema: jsonSchema(d.parameters as JSONSchema7) }),
  ]),
);

/** Bounds the cost of a single runaway call; far above real calls (largest measured: ~7k incl. thinking). */
const MAX_OUTPUT_TOKENS = 16000;
/** SSE comments while the model thinks, so no proxy closes a quiet connection. */
const KEEP_ALIVE_MS = 15_000;

export interface ChatDeps {
  config: Config;
  sink: LogSink;
  stats: Stats;
  hearts: Hearts;
  /** the fetch for Anthropic and Jev (tests pass a fake) */
  fetch?: typeof fetch;
}

const isChatMessages = (value: unknown): value is ChatMessage[] =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every((m) => typeof m === 'object' && m !== null && typeof m.role === 'string' && Array.isArray(m.parts));

const textOf = (m: ChatMessage | undefined): string =>
  (m?.parts ?? []).flatMap((p) => (p.type === 'text' ? [p.text] : [])).join('\n');

export const MEMORY_FULL = 'Mein Gedächtnis ist voll. Klicke auf „Zusammenfassen“ oder „Neu anfangen“.';
const heartsEmpty = (retryInMs: number) =>
  `Deine Herzen sind leer. In ${Math.ceil(retryInMs / 1000)} Sekunden kommt ein neues.`;

/** A fixed answer instead of a model call, streamed like one. */
const fixedAnswer = (messages: ChatMessage[], text: string, metadata?: ChatMetadata): Response =>
  createUIMessageStreamResponse({
    stream: createUIMessageStream<ChatMessage>({
      originalMessages: messages,
      execute: ({ writer }) => {
        writer.write({ type: 'start', messageMetadata: metadata });
        writer.write({ type: 'start-step' });
        writer.write({ type: 'text-start', id: 'fixed' });
        writer.write({ type: 'text-delta', id: 'fixed', delta: text });
        writer.write({ type: 'text-end', id: 'fixed' });
        writer.write({ type: 'finish-step' });
        writer.write({ type: 'finish', finishReason: 'stop' });
      },
    }),
  });

/** Kids protection for a new kid message: the fixed answer if the guard flags it, else undefined. */
const guardNewMessage = async (
  messages: ChatMessage[],
  ctx: CallContext,
  { config, sink, stats, fetch: baseFetch }: ChatDeps,
): Promise<Response | undefined> => {
  const text = textOf(messages.at(-1));
  const previous = textOf(messages.findLast((m) => m.role === 'assistant'));
  const result = await screen(text, previous || undefined, {
    apiKey: config.jevApiKey,
    model: config.jevModel,
    fetch: baseFetch,
  });
  recordGuard(stats, result.category, result.error);
  sink.appendGuard({
    ts: new Date().toISOString(),
    ...ctx,
    ms: result.ms,
    text: result.category === 'personal_data' ? '[entfernt: persönliche Daten]' : text,
    category: result.category,
    nouls: result.nouls,
    model: result.model,
    error: result.error,
  });
  return result.category && fixedAnswer(messages, FIXED_ANSWERS[result.category], { guard: result.category });
};

export const createChatHandler =
  (deps: ChatDeps) =>
  async (c: Context): Promise<Response> => {
    const { config, sink, stats, hearts, fetch: baseFetch } = deps;
    const body: unknown = await c.req.json().catch(() => undefined);
    const messages = (body as { messages?: unknown } | undefined)?.messages;
    if (!isChatMessages(messages)) return c.json({ error: 'Ungültige Anfrage' }, 400);

    const ctx: CallContext = {
      accessCode: normalizeCode(c.req.header(ACCESS_CODE_HEADER) ?? ''),
      session: c.req.header(SESSION_HEADER),
      turn: turnNumber(messages),
    };
    // a new kid message costs a heart and is screened; the requests that carry tool results within a turn
    // are neither (the client prevents both refusals, these are backstops)
    const newTurn = messages.at(-1)?.role === 'user';
    if (newTurn) {
      if (memoryFull(messages)) {
        stats.energy.memoryFull += 1;
        return c.json({ error: MEMORY_FULL }, 409);
      }
      if (!isAdminCode(ctx.accessCode)) {
        const { retryInMs } = hearts.take(ctx.session ?? ctx.accessCode);
        if (retryInMs !== undefined) {
          stats.energy.heartsEmpty += 1;
          return c.json({ error: heartsEmpty(retryInMs), retryInMs }, 429);
        }
      }
      const blocked = await guardNewMessage(messages, ctx, deps);
      if (blocked) return blocked;
    } else if (stepsInTurn(messages) >= MAX_STEPS_PER_TURN) {
      stats.outputCaps.stepLimits += 1;
      return fixedAnswer(messages, STEP_LIMIT_ANSWER);
    }

    const abort = new AbortController();
    const anthropic = createAnthropic({
      apiKey: config.anthropicApiKey,
      headers: config.anthropicWorkspaceId ? { 'anthropic-workspace-id': config.anthropicWorkspaceId } : {},
      fetch: createLoggingFetch(sink, ctx, (_record, usage, ok) => recordCall(stats, usage, ok), baseFetch),
    });
    const result = streamText({
      model: anthropic(config.model),
      instructions: {
        role: 'system',
        content: INSTRUCTIONS,
        providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
      },
      messages: await convertToModelMessages(buildModelInput(messages)),
      tools: TOOLS,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      abortSignal: abort.signal,
      providerOptions: {
        anthropic: {
          thinking: { type: 'adaptive' },
          effort: 'high',
          cacheControl: { type: 'ephemeral' }, // top-level: automatic breakpoint at the end of the conversation
        },
      },
      onError: ({ error }) => console.error('streamText error', error),
    });
    const stream = toUIMessageStream<typeof TOOLS, ChatMessage>({
      stream: result.stream,
      originalMessages: messages,
      // one model call per request: its input is the whole context; the first call of a turn fills the gauge
      messageMetadata: ({ part }) =>
        part.type === 'finish'
          ? { usage: part.totalUsage, ...(newTurn ? { context: part.totalUsage.inputTokens } : {}) }
          : undefined,
      onError: (e) => (e instanceof Error ? e.message : String(e)),
    });
    return createUIMessageStreamResponse({
      keepAliveMs: KEEP_ALIVE_MS,
      stream: capAnswerText(stream, () => {
        stats.outputCaps.textCuts += 1;
        abort.abort();
      }),
    });
  };
