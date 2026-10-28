// The host side of the "frage KI" block (src/editor/ki-extension.ts): posts the text to /api/ask with the
// kid's code and session, like a chat message. Without a heart it waits for the next one, so a block in a
// loop can't flood the server; the chat shares these hearts.
import { ACCESS_CODE_HEADER, SESSION_HEADER } from '../shared/chat-types.ts';
import { isAdminCode } from '../shared/energy.ts';
import { ASK_FAILED, ASK_NO_CODE, ASK_PATH, type Ask, type AskRequest } from '../shared/ki-block.ts';
import type { HeartsStore } from './hearts.ts';

export interface AskDeps {
  accessCode: string;
  sessionId: string;
  hearts: HeartsStore;
  /** the server no longer accepts the code (401) */
  onAccessDenied: () => void;
  fetch?: typeof fetch;
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    signal.throwIfAborted();
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });

export const createAsk =
  ({ accessCode, sessionId, hearts, onAccessDenied, fetch: baseFetch = fetch }: AskDeps): Ask =>
  async (question, signal) => {
    const admin = isAdminCode(accessCode);
    for (;;) {
      const wait = admin ? undefined : hearts.take();
      if (wait !== undefined) {
        await sleep(wait, signal);
        continue;
      }
      const res = await baseFetch(ASK_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', [ACCESS_CODE_HEADER]: accessCode, [SESSION_HEADER]: sessionId },
        body: JSON.stringify({ question } satisfies AskRequest),
        signal,
      });
      if (res.status === 401) {
        onAccessDenied();
        return ASK_NO_CODE;
      }
      const body = (await res.json().catch(() => ({}))) as { answer?: unknown; error?: unknown; retryInMs?: unknown };
      // the server counted differently: wait for its next heart
      if (res.status === 429 && typeof body.retryInMs === 'number') {
        hearts.sync(body.retryInMs);
        continue;
      }
      if (res.ok && typeof body.answer === 'string') return body.answer;
      // the server's German reason (e.g. a parent's key without money left) instead of a vague failure
      return !res.ok && typeof body.error === 'string' ? body.error : ASK_FAILED;
    }
  };
