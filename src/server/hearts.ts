// The hearts of every kid (energy.ts), in memory and keyed by session. One server instance is enough for the
// event, and a restart only makes the limit more generous.
import { type Bucket, fullBucket, nextHeartIn, take } from '../shared/energy.ts';

export interface Hearts {
  /** uses one heart; returns how long to wait instead when none is left */
  take(key: string, now?: number): { retryInMs?: number };
}

export const createHearts = (): Hearts => {
  const buckets = new Map<string, Bucket>();
  return {
    take: (key, now = Date.now()) => {
      const bucket = buckets.get(key) ?? fullBucket(now);
      const next = take(bucket, now);
      if (!next) return { retryInMs: nextHeartIn(bucket, now) };
      buckets.set(key, next);
      return {};
    },
  };
};
