import { expect, test } from 'vitest';
import { tokensOf } from './model.ts';

const usage = { input_tokens: 900, output_tokens: 12, cache_creation_input_tokens: 300, cache_read_input_tokens: 5000 };

test("a call's tokens come from its usage", () => {
  expect(tokensOf({ request: { max_tokens: 16000 } }, usage)).toEqual({
    inputTokens: 900,
    outputTokens: 12,
    cacheWriteTokens: 300,
    cacheReadTokens: 5000,
  });
});

test('a cut call has no final usage: its output counts as max_tokens', () => {
  expect(tokensOf({ request: { max_tokens: 16000 }, aborted: true }, usage).outputTokens).toBe(16000);
  expect(tokensOf({ request: {}, aborted: true }, {}).outputTokens).toBe(0);
});
