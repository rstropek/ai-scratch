// KI-Energie: the two limits a kid sees beside the chat. The client shows them, the server enforces them,
// both with these rules.
// - Hearts: at most 3 messages, refilled one every 20 s (a token bucket). Codes starting with "admin_" have
//   no limit (testing).
// - Gedächtnis: the context length the model reads at the start of a turn. At the limit the kid frees it
//   by hand ("Zusammenfassen" or "Neu anfangen"); Rainer explains this in the video.
import type { ChatMessage } from './chat-types.ts';

export const HEARTS = { max: 3, refillMs: 20_000 } as const;

/** A token bucket: `hearts` (fractional while refilling) as of time `at` (ms). */
export interface Bucket {
  hearts: number;
  at: number;
}

export const fullBucket = (now: number): Bucket => ({ hearts: HEARTS.max, at: now });

export const refill = (b: Bucket, now: number): Bucket => ({
  hearts: Math.min(HEARTS.max, b.hearts + Math.max(0, now - b.at) / HEARTS.refillMs),
  at: now,
});

/** The bucket after one message, or undefined when no whole heart is left. */
export const take = (b: Bucket, now: number): Bucket | undefined => {
  const r = refill(b, now);
  return r.hearts >= 1 ? { hearts: r.hearts - 1, at: now } : undefined;
};

/** Whole hearts available now. */
export const heartsLeft = (b: Bucket, now: number): number => Math.floor(refill(b, now).hearts);

/** ms until the next whole heart; 0 when the bucket is full. */
export const nextHeartIn = (b: Bucket, now: number): number => {
  const { hearts } = refill(b, now);
  return hearts >= HEARTS.max ? 0 : Math.ceil((Math.floor(hearts) + 1 - hearts) * HEARTS.refillMs);
};

export const isAdminCode = (code: string): boolean => code.startsWith('admin_');

/** Context tokens at which a new message is refused until the kid compacts or clears. */
export const CONTEXT_LIMIT = 80_000;

/** The context of the latest turn (input tokens of its first model call), or undefined before any. */
export const contextOf = (messages: ChatMessage[]): number | undefined =>
  messages.findLast((m) => m.metadata?.context !== undefined)?.metadata?.context;

/** There is conversation to free: anything besides a summary and the new kid message. */
export const hasHistory = (messages: ChatMessage[]): boolean =>
  messages.some((m) => !m.metadata?.summary && m.role === 'assistant');

/** The memory is full and freeing it would help. A huge project alone never locks a kid out. */
export const memoryFull = (messages: ChatMessage[]): boolean =>
  (contextOf(messages) ?? 0) >= CONTEXT_LIMIT && hasHistory(messages);
