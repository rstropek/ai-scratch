// POST /api/ask: the "frage KI" block in a kid's own program (src/shared/ki-block.ts), e.g. a chatbot. One
// text in, one short answer out: no tools and no stored conversation. A chatbot that remembers is the kid's
// own work: their program joins the conversation into one text. Same rules as a chat message: it costs a
// heart, and the kids-protection guard screens it, with its own description of the block (role play is fine).
// Only the last 3000 characters reach Jev and the model.
import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import type { Context } from 'hono';
import { SESSION_HEADER } from '../shared/chat-types.ts';
import { isAdminCode } from '../shared/energy.ts';
import { ASK_FAILED, type AskResponse } from '../shared/ki-block.ts';
import { accessCodeOf } from './access.ts';
import { type ChatDeps, heartsEmpty, screenAndRecord } from './chat.ts';
import { BLOCK_SCREENING, FIXED_ANSWERS } from './guard.ts';
import { recordCall } from './stats.ts';
import { type CallContext, createLoggingFetch } from './wire-log.ts';

export const ASK_INSTRUCTIONS = `You are the AI behind the "frage KI" block in Scratch. A kid aged 10 to 16 at a supervised school workshop built a program that sends you a text, usually a chatbot: the text is what the kid typed into it.
- Answer in German (or in the language of the text), friendly, honest and suitable for kids, in simple words.
- Keep it short: at most 2-3 short sentences, under 300 characters. A Scratch speech bubble shows no more.
- Plain text only: no Markdown, no lists, no headings.
- The text may be a conversation the program joined together, e.g. lines like "Ich: …" and "KI: …". Then continue it: answer only the last message, without a speaker label like "KI:". A long text is cut at the start, so it may begin mid-sentence.
- If the text gives you a role or an answer style (a pirate, a quiz master, answering in rhymes), play along, as long as it stays suitable for kids.
- If the kid seems sad, scared or hurt, or asks about health or a personal problem, answer kindly and suggest talking to one of the adults in the room.
- Never ask for personal data like an address, a phone number or a password.`;

/** about 1000 characters: far above the 300 the instructions ask for */
const MAX_OUTPUT_TOKENS = 300;

const CACHE = { anthropic: { cacheControl: { type: 'ephemeral' } } } as const;
/** Haiku 5.5 thinks unless told not to: thinking can fill all of MAX_OUTPUT_TOKENS and leave no answer. */
const NO_THINKING = { anthropic: { thinking: { type: 'disabled' } } } as const;
/** characters per text block; see askContent */
export const PIECE = 400;

/**
 * The kid's text as the model input: a sliding window of its last 3000 characters, in blocks of PIECE
 * characters with the cache breakpoint after the last full block. A chatbot resends its conversation plus
 * one new line each time, so until the window starts sliding the next ask reads its blocks from the cache.
 */
export const askContent = (text: string) => {
  const chars = Array.from(text).slice(-BLOCK_SCREENING.maxLength); // code points: never cut an emoji in half
  const pieces: string[] = [];
  for (let i = 0; i < chars.length; i += PIECE) pieces.push(chars.slice(i, i + PIECE).join(''));
  const lastFull = chars.length % PIECE === 0 ? pieces.length - 1 : pieces.length - 2;
  return pieces.map((piece, i) => ({
    type: 'text' as const,
    text: piece,
    ...(i === lastFull ? { providerOptions: CACHE } : {}),
  }));
};

export const createAskHandler =
  (deps: ChatDeps) =>
  async (c: Context): Promise<Response> => {
    const { config, sink, stats, hearts, fetch: baseFetch } = deps;
    const body: unknown = await c.req.json().catch(() => undefined);
    const question = (body as { question?: unknown } | undefined)?.question;
    if (typeof question !== 'string' || !question.trim()) return c.json({ error: 'Ungültige Anfrage' }, 400);

    const ctx: CallContext = {
      accessCode: accessCodeOf(c),
      session: c.req.header(SESSION_HEADER),
      turn: 0,
      purpose: 'ask',
    };
    if (!isAdminCode(ctx.accessCode)) {
      const { retryInMs } = hearts.take(ctx.session ?? ctx.accessCode);
      if (retryInMs !== undefined) {
        stats.energy.heartsEmpty += 1;
        return c.json({ error: heartsEmpty(retryInMs), retryInMs }, 429);
      }
    }
    const content = askContent(question);
    const text = content.map((p) => p.text).join('');
    const category = await screenAndRecord(text, undefined, ctx, deps, BLOCK_SCREENING);
    if (category) return c.json({ answer: FIXED_ANSWERS[category], guard: category } satisfies AskResponse);

    const anthropic = createAnthropic({
      apiKey: config.anthropicApiKey,
      headers: config.anthropicWorkspaceId ? { 'anthropic-workspace-id': config.anthropicWorkspaceId } : {},
      fetch: createLoggingFetch(sink, ctx, (_record, usage, ok) => recordCall(stats, usage, ok), baseFetch),
    });
    try {
      const result = await generateText({
        model: anthropic(config.model),
        instructions: ASK_INSTRUCTIONS,
        messages: [{ role: 'user', content }],
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        providerOptions: NO_THINKING,
        abortSignal: c.req.raw.signal,
      });
      const answer = result.text.trim();
      if (!answer) throw new Error('empty answer');
      stats.asks += 1;
      return c.json({ answer } satisfies AskResponse);
    } catch (e) {
      console.error('ask failed', e);
      return c.json({ error: ASK_FAILED }, 502);
    }
  };
