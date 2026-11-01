// The codes, the pool and every sum, as a snapshot per instance refreshed every 60 s (docs/budgets.md): each call
// is checked in memory, a code the snapshot doesn't know yet is looked up directly. A failed refresh stops the free
// budget's codes until the next one works (fail closed); own-key codes go on with the last snapshot.
import {
  addGrant,
  type BudgetSnapshot,
  type CodeGrant,
  checkGrant,
  type Database,
  type Limits,
  loadSnapshot,
  markRefused,
  type PoolEntry,
  pickEntry,
  type Refusal,
  recordUsage,
  type Tokens,
} from '@ai-scratch/db';

export interface Budget {
  /** the code, or undefined when it is unknown or deleted; throws when the database can't be reached */
  find(code: string, now?: Date): Promise<CodeGrant | undefined>;
  /** why a call with the code is refused now */
  refusal(grant: CodeGrant, now?: Date): Refusal | undefined;
  /** the pool entry the next free-budget call uses */
  entry(): PoolEntry | undefined;
  /** a pool entry by its id */
  entryOf(entryId: string): PoolEntry | undefined;
  /** a call's usage; a failed write is logged, never the kid's problem */
  record(grant: CodeGrant, poolKeyId: string | null, tokens: Tokens): void;
  /** Anthropic refused the entry: skipped here at once, everywhere from the next refresh */
  refuse(entryId: string, reason: string): void;
  refresh(): Promise<void>;
  close(): void;
}

export const REFRESH_MS = 60_000;

export const createBudget = ({
  db,
  limits,
  onRefresh = () => {},
  refreshMs = REFRESH_MS,
}: {
  db: Database;
  limits: Limits;
  /** after each refresh that worked (the 80 % warnings) */
  onRefresh?: (snapshot: BudgetSnapshot) => void;
  refreshMs?: number;
}): Budget => {
  let snapshot: BudgetSnapshot | undefined;
  let fresh = false;
  let loading: Promise<void> | undefined;

  const refresh = (): Promise<void> => {
    loading ??= loadSnapshot(db, limits)
      .then((next) => {
        snapshot = next;
        fresh = true;
        onRefresh(next);
      })
      .catch((error: unknown) => {
        fresh = false;
        console.error('budget: refreshing the snapshot failed', error);
      })
      .finally(() => {
        loading = undefined;
      });
    return loading;
  };
  const timer = setInterval(() => void refresh(), refreshMs);
  timer.unref();

  const current = async (): Promise<BudgetSnapshot> => {
    if (!snapshot) await refresh();
    if (!snapshot) throw new Error('budget: no snapshot, the database is not reachable');
    return snapshot;
  };

  return {
    find: async (code, now = new Date()) => {
      const snap = await current();
      return snap.codes.get(code) ?? (await addGrant(db, snap, code, now));
    },
    refusal: (grant, now = new Date()) => (snapshot ? checkGrant(snapshot, grant, now, fresh) : 'unavailable'),
    entry: () => (snapshot ? pickEntry(snapshot) : undefined),
    entryOf: (entryId) => snapshot?.pool.find((entry) => entry.id === entryId),
    record: (grant, poolKeyId, tokens) => {
      recordUsage(db, snapshot, grant, poolKeyId, tokens).catch((error: unknown) =>
        console.error('budget: writing the usage failed', { code: grant.id, poolKeyId, tokens }, error),
      );
    },
    refuse: (entryId, reason) => {
      const entry = snapshot?.pool.find((e) => e.id === entryId);
      if (entry) entry.refusedAt = new Date();
      console.error(`budget: Anthropic refused pool entry ${entryId}: ${reason}`);
      markRefused(db, entryId, reason).catch((error: unknown) =>
        console.error('budget: marking the pool entry refused failed', error),
      );
    },
    refresh,
    close: () => clearInterval(timer),
  };
};
