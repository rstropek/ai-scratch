// The plain figures on the start page (no charts): what an account, its own keys, the pool and the month spent, from
// the same sums the kids' app checks every call against (packages/db/src/budget.ts, docs/budgets.md).
import {
  accountSpend,
  type Database,
  entrySpend,
  ownKeySpend,
  type Price,
  totalFreeSpend,
  totalOwnKeySpend,
  viennaMonth,
} from '@ai-scratch/db';
import type { Limits } from '@ai-scratch/db/limits';
import { entryHint, listKeys } from './anthropic-keys.ts';
import { countCodes, freeCodesCreated } from './codes.ts';

/** an adult's free budget this month: dollars and codes, each against its limit */
export interface AccountBudget {
  spentUsd: number;
  limitUsd: number;
  codesCreated: number;
  codesLimit: number;
}

export const accountBudget = async (
  db: Database,
  price: Price,
  limits: Limits,
  ownerId: string,
  now: Date = new Date(),
): Promise<AccountBudget> => {
  const [spend, codesCreated] = await Promise.all([
    accountSpend(db, price, viennaMonth(now), ownerId),
    freeCodesCreated(db, ownerId, now),
  ]);
  return {
    spentUsd: spend.get(ownerId) ?? 0,
    limitUsd: limits.accountUsdMonth,
    codesCreated,
    codesLimit: limits.freeCodesPerAccountMonth,
  };
};

/** what each of the owner's own keys paid this month, by key id */
export const ownKeyMonthSpend = (db: Database, price: Price, ownerId: string, now: Date = new Date()) =>
  ownKeySpend(db, price, viennaMonth(now), ownerId);

export interface PoolEntryNumbers {
  id: string;
  donor: string;
  hint: string;
  capMonth: number;
  spentUsd: number;
  active: boolean;
  refusedAt: Date | null;
  refusedReason: string | null;
}

/** each pool entry's spend this month against its cap, in the order the pool uses them */
export const poolNumbers = async (db: Database, price: Price, now: Date = new Date()): Promise<PoolEntryNumbers[]> => {
  const [keys, spend] = await Promise.all([listKeys(db), entrySpend(db, price, viennaMonth(now))]);
  return keys.map((key) => ({
    id: key.id,
    donor: key.donor,
    hint: entryHint(key),
    capMonth: key.capMonth,
    spentUsd: spend.get(key.id) ?? 0,
    active: key.active,
    refusedAt: key.refusedAt,
    refusedReason: key.refusedReason,
  }));
};

/** the admins' overview of the month */
export interface AdminNumbers {
  freeSpentUsd: number;
  totalLimitUsd: number;
  ownKeySpentUsd: number;
  runningCodes: number;
  pool: PoolEntryNumbers[];
}

export const adminNumbers = async (
  db: Database,
  price: Price,
  limits: Limits,
  now: Date = new Date(),
): Promise<AdminNumbers> => {
  const month = viennaMonth(now);
  const [freeSpentUsd, ownKeySpentUsd, counts, pool] = await Promise.all([
    totalFreeSpend(db, price, month),
    totalOwnKeySpend(db, price, month),
    countCodes(db, now),
    poolNumbers(db, price, now),
  ]);
  return { freeSpentUsd, totalLimitUsd: limits.totalUsdMonth, ownKeySpentUsd, runningCodes: counts.running, pool };
};
