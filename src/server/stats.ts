// Live counters over all Anthropic calls since the server started (GET /api/stats).
import { type AnthropicUsage, costOf } from './cost.ts';

export interface Stats {
  calls: number;
  errors: number;
  inputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  outputTokens: number;
  cost: number;
}

export const createStats = (): Stats => ({
  calls: 0,
  errors: 0,
  inputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  outputTokens: 0,
  cost: 0,
});

export const recordCall = (stats: Stats, usage: AnthropicUsage, ok: boolean): void => {
  stats.calls += 1;
  stats.errors += ok ? 0 : 1;
  stats.inputTokens += usage.input_tokens ?? 0;
  stats.outputTokens += usage.output_tokens ?? 0;
  stats.cacheReadTokens += usage.cache_read_input_tokens ?? 0;
  stats.cacheWriteTokens += usage.cache_creation_input_tokens ?? 0;
  stats.cost += costOf(usage);
};
