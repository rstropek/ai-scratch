// POST /api/chat: one model call per request. The tools have no `execute`: the browser runs them on the
// live VM (useChat onToolCall) and sends the results back with the next request of the same turn.
import { createAnthropic } from '@ai-sdk/anthropic';
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  type JSONSchema7,
  jsonSchema,
  streamText,
  type Tool,
  tool,
  toUIMessageStream,
} from 'ai';
import type { Context } from 'hono';
import { ACCESS_CODE_HEADER, type ChatMessage, SESSION_HEADER } from '../shared/chat-types.ts';
import { buildInstructions, toolDefinitions } from '../shared/tools/index.ts';
import type { Config } from './config.ts';
import { buildModelInput, turnNumber } from './model-input.ts';
import { recordCall, type Stats } from './stats.ts';
import { createLoggingFetch, type LogSink } from './wire-log.ts';

const INSTRUCTIONS = buildInstructions();
const TOOLS: Record<string, Tool> = Object.fromEntries(
  toolDefinitions.map((d) => [
    d.name,
    tool({ description: d.description, inputSchema: jsonSchema(d.parameters as JSONSchema7) }),
  ]),
);

/** Bounds the cost of a single runaway call. */
const MAX_OUTPUT_TOKENS = 16000;
/** SSE comments while the model thinks, so no proxy closes a quiet connection. */
const KEEP_ALIVE_MS = 15_000;

export interface ChatDeps {
  config: Config;
  sink: LogSink;
  stats: Stats;
  /** the fetch the Anthropic provider uses (tests pass a fake) */
  fetch?: typeof fetch;
}

const isChatMessages = (value: unknown): value is ChatMessage[] =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every((m) => typeof m === 'object' && m !== null && typeof m.role === 'string' && Array.isArray(m.parts));

export const createChatHandler =
  ({ config, sink, stats, fetch: baseFetch }: ChatDeps) =>
  async (c: Context): Promise<Response> => {
    const body: unknown = await c.req.json().catch(() => undefined);
    const messages = (body as { messages?: unknown } | undefined)?.messages;
    if (!isChatMessages(messages)) return c.json({ error: 'Ungültige Anfrage' }, 400);

    const ctx = {
      accessCode: c.req.header(ACCESS_CODE_HEADER) ?? '',
      session: c.req.header(SESSION_HEADER),
      turn: turnNumber(messages),
    };
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
      providerOptions: {
        anthropic: {
          thinking: { type: 'adaptive' },
          effort: 'high',
          cacheControl: { type: 'ephemeral' }, // top-level: automatic breakpoint at the end of the conversation
        },
      },
      onError: ({ error }) => console.error('streamText error', error),
    });
    return createUIMessageStreamResponse({
      keepAliveMs: KEEP_ALIVE_MS,
      stream: toUIMessageStream<typeof TOOLS, ChatMessage>({
        stream: result.stream,
        originalMessages: messages,
        messageMetadata: ({ part }) => (part.type === 'finish' ? { usage: part.totalUsage } : undefined),
        onError: (e) => (e instanceof Error ? e.message : String(e)),
      }),
    });
  };
