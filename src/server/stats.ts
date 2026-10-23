// Live counters since the server started (GET /api/stats): Anthropic calls, the kids-protection guard
// and the output guard.
import type { GuardCategory } from '../shared/chat-types.ts';
import { type AnthropicUsage, costOf } from './cost.ts';

export interface Stats {
  calls: number;
  errors: number;
  inputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  outputTokens: number;
  cost: number;
  guard: { checks: number; errors: number; byCategory: Partial<Record<GuardCategory, number>> };
  /** answers cut at the text limit, turns ended at the step limit */
  outputCaps: { textCuts: number; stepLimits: number };
}

export const createStats = (): Stats => ({
  calls: 0,
  errors: 0,
  inputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  outputTokens: 0,
  cost: 0,
  guard: { checks: 0, errors: 0, byCategory: {} },
  outputCaps: { textCuts: 0, stepLimits: 0 },
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

export const recordGuard = (stats: Stats, category: GuardCategory | undefined, error: string | undefined): void => {
  stats.guard.checks += 1;
  stats.guard.errors += error ? 1 : 0;
  if (category) stats.guard.byCategory[category] = (stats.guard.byCategory[category] ?? 0) + 1;
};
