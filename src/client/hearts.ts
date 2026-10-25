// The kid's hearts in the browser (src/shared/energy.ts), shared by the chat and the "frage KI" block. The
// server keeps its own count; when it refuses anyway, its clock wins (sync).
import { type Bucket, fullBucket, HEARTS, nextHeartIn, take } from '../shared/energy.ts';

export interface HeartsStore {
  bucket(): Bucket;
  /** uses one heart; returns the wait in ms instead when none is left */
  take(): number | undefined;
  /** the server refused for lack of hearts and said when the next one comes */
  sync(retryInMs: number): void;
  subscribe(listener: () => void): () => void;
}

export const createHeartsStore = (now: () => number = Date.now): HeartsStore => {
  let bucket = fullBucket(now());
  const listeners = new Set<() => void>();
  const set = (next: Bucket) => {
    bucket = next;
    for (const listener of listeners) listener();
  };
  return {
    bucket: () => bucket,
    take: () => {
      const next = take(bucket, now());
      if (!next) return nextHeartIn(bucket, now());
      set(next);
      return undefined;
    },
    sync: (retryInMs) => set({ hearts: Math.max(0, 1 - retryInMs / HEARTS.refillMs), at: now() }),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};
