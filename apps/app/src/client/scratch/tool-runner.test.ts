import { expect, test } from 'vitest';
import { createSerialRunner } from './tool-runner.ts';

test('tool calls run one after another and a failure does not block the next call', async () => {
  const log: string[] = [];
  const run = createSerialRunner({
    slow: async () => {
      log.push('slow start');
      await new Promise((r) => setTimeout(r, 20));
      log.push('slow end');
      return 'slow';
    },
    fail: () => {
      throw new Error('kaputt');
    },
    fast: () => {
      log.push('fast');
      return 'fast';
    },
  });
  const results = await Promise.allSettled([run('slow', {}), run('fail', {}), run('fast', {})]);
  expect(log).toEqual(['slow start', 'slow end', 'fast']);
  expect(results.map((r) => r.status)).toEqual(['fulfilled', 'rejected', 'fulfilled']);
});
