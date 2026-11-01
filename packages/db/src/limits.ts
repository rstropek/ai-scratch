// The budgets' limits (docs/budgets.md), read from the environment by both apps. No imports: the office's client
// components and its public /access page load the defaults too.

type Env = Record<string, string | undefined>;

export interface Limits {
  /** the free budget's AI cost for all accounts together per calendar month (Vienna) */
  totalUsdMonth: number;
  /** the free budget's AI cost per account and calendar month; admins have none */
  accountUsdMonth: number;
  /** codes from the free budget per account and calendar month (codes that still exist); admins have none */
  freeCodesPerAccountMonth: number;
  /** the AI cost of one code, over all months */
  codeBudgetUsd: number;
  /** the longest validity window of a code */
  codeMaxHours: number;
}

export const DEFAULT_LIMITS: Limits = {
  totalUsdMonth: 100,
  accountUsdMonth: 10,
  freeCodesPerAccountMonth: 5,
  codeBudgetUsd: 5,
  codeMaxHours: 4,
};

const ENV_NAMES: Record<keyof Limits, string> = {
  totalUsdMonth: 'BUDGET_TOTAL_USD_MONTH',
  accountUsdMonth: 'BUDGET_ACCOUNT_USD_MONTH',
  freeCodesPerAccountMonth: 'FREE_CODES_PER_ACCOUNT_MONTH',
  codeBudgetUsd: 'CODE_BUDGET_USD',
  codeMaxHours: 'CODE_MAX_HOURS',
};

/** each limit from its env var, or its default; a value that isn't a positive number stops the app */
export const loadLimits = (env: Env = process.env): Limits => {
  const limits = { ...DEFAULT_LIMITS };
  for (const field of Object.keys(ENV_NAMES) as (keyof Limits)[]) {
    const raw = env[ENV_NAMES[field]]?.trim();
    if (!raw) continue;
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) throw new Error(`${ENV_NAMES[field]} must be a positive number`);
    limits[field] = value;
  }
  return limits;
};

/** a pool entry is used while at most this share of its monthly cap is spent; the other budgets stop at 100 % */
export const POOL_ENTRY_USABLE = 0.975;
/** the share of a budget at which all admins get a warning email */
export const WARN_SHARE = 0.8;
/** an own OpenRouter key: the most it may have left (limit_remaining, dollars) when a code is created from it */
export const OWN_KEY_MAX_REMAINING_USD = 25;
/** how far ahead a code may start */
export const CODE_START_MAX_DAYS = 30;
/** the longest comment on a code */
export const CODE_COMMENT_MAX = 200;
