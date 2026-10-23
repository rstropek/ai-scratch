// POST /api/compact: "Zusammenfassen". The model summarizes the conversation so far; the client replaces
// the conversation with the summary (metadata.summary), which frees the AI's memory (energy.ts). The kid
// reads the summary too, so it is short, German and addressed to the kid.
import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import type { Context } from 'hono';
import { ACCESS_CODE_HEADER, type ChatMessage, SESSION_HEADER } from '../shared/chat-types.ts';
import type { ChatDeps } from './chat.ts';
import { textOnly, turnNumber, withoutGuarded } from './model-input.ts';
import { recordCall } from './stats.ts';
import { createLoggingFetch } from './wire-log.ts';

const INSTRUCTIONS = `You summarize a conversation between a kid (10-16 years) and an AI helper who build a Scratch game together.
The summary replaces the conversation: from now on the AI helper sees only this summary (and the current project), and the kid reads it, too.
- Write in German, in simple words, addressed to the kid ("du"). At most about 120 words.
- Use short Markdown bullet points under these bold headings, leaving out a heading with nothing to say: **Dein Spiel** (the idea, characters, rules, points, levels the kid decided), **Schon gebaut**, **Als Nächstes** (the open step or the question the AI helper asked last).
- Do not describe scripts or blocks in detail; the AI helper sees the project anyway.
- Only write what was said in the conversation. Leave out personal data.`;

const MAX_OUTPUT_TOKENS = 1500;
/** Bounds the input of one summary (the conversation is text only, far below this). */
const MAX_TRANSCRIPT_CHARS = 200_000;

const COMPACT_FAILED = 'Das Zusammenfassen hat nicht geklappt. Versuch es bitte nochmal.';

const speaker = (m: ChatMessage): string =>
  m.metadata?.summary ? 'Frühere Zusammenfassung' : m.role === 'user' ? 'Kind' : 'KI-Helfer';

/** The conversation as plain text: what was said and which tools ran, no blocked turns. */
export const transcript = (messages: ChatMessage[]): string =>
  withoutGuarded(messages)
    .map(textOnly)
    .map((m) => ({ who: speaker(m), text: m.parts.flatMap((p) => (p.type === 'text' ? [p.text] : [])).join('\n') }))
    .filter(({ text }) => text.trim())
    .map(({ who, text }) => `${who}: ${text}`)
    .join('\n\n')
    .slice(-MAX_TRANSCRIPT_CHARS);

const isMessages = (value: unknown): value is ChatMessage[] =>
  Array.isArray(value) &&
  value.every((m) => typeof m === 'object' && m !== null && typeof m.role === 'string' && Array.isArray(m.parts));

export const createCompactHandler =
  ({ config, sink, stats, fetch: baseFetch }: ChatDeps) =>
  async (c: Context): Promise<Response> => {
    const body: unknown = await c.req.json().catch(() => undefined);
    const messages = (body as { messages?: unknown } | undefined)?.messages;
    if (!isMessages(messages)) return c.json({ error: 'Ungültige Anfrage' }, 400);
    const text = transcript(messages);
    if (!text) return c.json({ error: 'Es gibt noch nichts zum Zusammenfassen.' }, 400);

    const anthropic = createAnthropic({
      apiKey: config.anthropicApiKey,
      headers: config.anthropicWorkspaceId ? { 'anthropic-workspace-id': config.anthropicWorkspaceId } : {},
      fetch: createLoggingFetch(
        sink,
        {
          accessCode: c.req.header(ACCESS_CODE_HEADER) ?? '',
          session: c.req.header(SESSION_HEADER),
          turn: turnNumber(messages),
          purpose: 'compact',
        },
        (_record, usage, ok) => recordCall(stats, usage, ok),
        baseFetch,
      ),
    });
    try {
      const result = await generateText({
        model: anthropic(config.model),
        instructions: INSTRUCTIONS,
        messages: [{ role: 'user', content: `<gespraech>\n${text}\n</gespraech>` }],
        maxOutputTokens: MAX_OUTPUT_TOKENS,
      });
      const summary = result.text.trim();
      if (!summary) throw new Error('empty summary');
      stats.energy.compacts += 1;
      return c.json({ summary, tokens: result.usage.outputTokens ?? 0 });
    } catch (e) {
      console.error('compact failed', e);
      return c.json({ error: COMPACT_FAILED }, 502);
    }
  };
