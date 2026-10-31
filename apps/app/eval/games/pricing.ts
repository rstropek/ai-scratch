// What a harness run costs: the app's calls from its research log (exact Anthropic usage per call), the
// simulated kid's and the judge's from the AI SDK. Prices are $ per 1M tokens (Anthropic list prices,
// 2026-10); cache writes cost 1.25x input.
import fs from 'node:fs';
import path from 'node:path';
import type { AnthropicUsage } from '../../src/server/cost.ts';
import type { CallUsage } from './kid.ts';

const PRICES: Record<string, { input: number; output: number; cacheRead: number }> = {
  'claude-haiku-5-5': { input: 0.1, output: 0.5, cacheRead: 0.01 },
  'claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.2 },
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2 },
  'claude-fable-5-1': { input: 10, output: 50, cacheRead: 0.25 },
};

const price = (model: string) => {
  const p = PRICES[model.replace(/-\d{8}$/, '')];
  if (!p) console.warn(`no price for ${model}: counted as 0`);
  return p ?? { input: 0, output: 0, cacheRead: 0 };
};

const cost = (model: string, input: number, cacheWrite: number, cacheRead: number, output: number) => {
  const p = price(model);
  return (input * p.input + cacheWrite * p.input * 1.25 + cacheRead * p.cacheRead + output * p.output) / 1e6;
};

export const callCost = ({ model, usage }: CallUsage): number => {
  const read = usage.inputTokenDetails?.cacheReadTokens ?? 0;
  const write = usage.inputTokenDetails?.cacheWriteTokens ?? 0;
  const uncached = usage.inputTokenDetails?.noCacheTokens ?? (usage.inputTokens ?? 0) - read - write;
  return cost(model, uncached, write, read, usage.outputTokens ?? 0);
};

/** Sums the app's model calls of one chat session from the research log (calls.jsonl). */
export const appCost = (logDir: string, session: string): { cost: number; calls: number } => {
  const file = path.join(logDir, 'calls.jsonl');
  if (!session || !fs.existsSync(file)) return { cost: 0, calls: 0 };
  let total = 0;
  let calls = 0;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line.includes(session)) continue;
    const r = JSON.parse(line) as { session?: string; response?: { model?: string; usage?: AnthropicUsage } };
    if (r.session !== session || !r.response?.usage) continue;
    const u = r.response.usage;
    calls += 1;
    total += cost(
      r.response.model ?? '',
      u.input_tokens ?? 0,
      u.cache_creation_input_tokens ?? 0,
      u.cache_read_input_tokens ?? 0,
      u.output_tokens ?? 0,
    );
  }
  return { cost: total, calls };
};
