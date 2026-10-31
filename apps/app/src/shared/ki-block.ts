// The "frage KI" block: a kid's own program asks the AI, e.g. a chatbot. The block (src/editor/ki-extension.ts)
// calls the host's ask (src/client/ki-ask.ts), which posts to /api/ask (src/server/ask.ts).
import type { GuardCategory } from './chat-types.ts';

export const ASK_PATH = '/api/ask';

export interface AskRequest {
  question: string;
}

/** 200: the AI's answer, or the guard's fixed answer (`guard` set). 429: no heart left ({ error, retryInMs }). */
export interface AskResponse {
  answer: string;
  guard?: GuardCategory;
}

/** Answers the block reports instead of the AI's, read out by the kid's sprite. */
export const ASK_NO_CODE = 'Gib zuerst den Code im Chat ein.';
export const ASK_FAILED = 'Die KI antwortet gerade nicht. Versuch es gleich nochmal.';

/** Asks the AI; resolves with what the block reports. Waits for a heart when none is left. */
export type Ask = (question: string, signal: AbortSignal) => Promise<string>;
