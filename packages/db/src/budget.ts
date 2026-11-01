// What codes may spend and what they spent (docs/budgets.md), shared by both apps: the kids' app checks every call
// against a snapshot of these sums and writes the usage afterwards, the office shows the same numbers. Every sum
// comes from the `usage` table as tokens, valued at the current price.
import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, type SQL, sql } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import type { Database } from './client.ts';
import { type Limits, POOL_ENTRY_USABLE } from './limits.ts';
import { viennaMonth } from './month.ts';
import {
  accessCode,
  adultProfile,
  anthropicKey,
  budgetWarning,
  modelPrice,
  openrouterKey,
  usage,
  user,
} from './schema/index.ts';

/** dollars per million tokens */
export interface Price {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

export interface Tokens {
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
}

export const costOf = (t: Tokens, p: Price): number =>
  (t.inputTokens * p.input +
    t.outputTokens * p.output +
    t.cacheWriteTokens * p.cacheWrite +
    t.cacheReadTokens * p.cacheRead) /
  1e6;

/** the migration creates the row, so it is always there */
export const loadPrice = async (db: Database): Promise<Price> => {
  const [row] = await db
    .select({
      input: modelPrice.input,
      output: modelPrice.output,
      cacheWrite: modelPrice.cacheWrite,
      cacheRead: modelPrice.cacheRead,
    })
    .from(modelPrice)
    .where(eq(modelPrice.id, 1));
  if (!row) throw new Error('model_price has no row: run the migrations');
  return row;
};

/** better-auth's admin plugin keeps roles comma-separated in one column */
export const isAdminRole = (role: string | null | undefined): boolean =>
  (role ?? '').split(',').some((r) => r.trim() === 'admin');

const tokenSums = {
  inputTokens: sql<number>`coalesce(sum(${usage.inputTokens}), 0)`.mapWith(Number),
  outputTokens: sql<number>`coalesce(sum(${usage.outputTokens}), 0)`.mapWith(Number),
  cacheWriteTokens: sql<number>`coalesce(sum(${usage.cacheWriteTokens}), 0)`.mapWith(Number),
  cacheReadTokens: sql<number>`coalesce(sum(${usage.cacheReadTokens}), 0)`.mapWith(Number),
};

/** dollars spent per value of `column`, over the rows `where` picks */
const spendBy = async (
  db: Database,
  price: Price,
  column: PgColumn,
  where: SQL | undefined,
): Promise<Map<string, number>> => {
  const rows = await db
    .select({ key: column, ...tokenSums })
    .from(usage)
    .where(and(isNotNull(column), where))
    .groupBy(column);
  return new Map(rows.map((row) => [String(row.key), costOf(row, price)]));
};

/** dollars spent over the rows `where` picks */
const spendOf = async (db: Database, price: Price, where: SQL | undefined): Promise<number> => {
  const [row] = await db.select(tokenSums).from(usage).where(where);
  return row ? costOf(row, price) : 0;
};

/** each code's spend over all months (a code running over midnight on the 31st gets no fresh budget) */
export const codeSpend = (db: Database, price: Price, codeIds: string[]) =>
  spendBy(db, price, usage.codeId, inArray(usage.codeId, codeIds));

/** each account's free-budget spend in a month */
export const accountSpend = (db: Database, price: Price, month: string, ownerId?: string) =>
  spendBy(
    db,
    price,
    usage.ownerId,
    and(eq(usage.month, month), eq(usage.source, 'free'), ownerId ? eq(usage.ownerId, ownerId) : undefined),
  );

/** each pool entry's spend in a month */
export const entrySpend = (db: Database, price: Price, month: string) =>
  spendBy(db, price, usage.poolKeyId, eq(usage.month, month));

/** each own OpenRouter key's spend in a month */
export const ownKeySpend = (db: Database, price: Price, month: string, ownerId?: string) =>
  spendBy(
    db,
    price,
    usage.openrouterKeyId,
    and(eq(usage.month, month), ownerId ? eq(usage.ownerId, ownerId) : undefined),
  );

/** the free budget's spend in a month, all accounts together */
export const totalFreeSpend = (db: Database, price: Price, month: string) =>
  spendOf(db, price, and(eq(usage.month, month), eq(usage.source, 'free')));

/** what all own OpenRouter keys spent in a month */
export const totalOwnKeySpend = (db: Database, price: Price, month: string) =>
  spendOf(db, price, and(eq(usage.month, month), eq(usage.source, 'openrouter')));

/** what the kids' app needs to know about a code to let a call through */
export interface CodeGrant {
  id: string;
  code: string;
  ownerId: string;
  source: 'free' | 'openrouter';
  openrouterKeyId: string | null;
  /** the own key, sealed with its row's id (key-box.ts) */
  keySealed: string | null;
  startsAt: Date;
  endsAt: Date;
  askEnabled: boolean;
  ownerAdmin: boolean;
  /** the owner may use the free budget (switched on by an admin) */
  freeBudget: boolean;
}

const grantColumns = {
  id: accessCode.id,
  code: accessCode.code,
  ownerId: accessCode.ownerId,
  source: accessCode.source,
  openrouterKeyId: accessCode.openrouterKeyId,
  keySealed: openrouterKey.keySealed,
  startsAt: accessCode.startsAt,
  endsAt: accessCode.endsAt,
  askEnabled: accessCode.askEnabled,
  role: user.role,
  banned: user.banned,
  banExpires: user.banExpires,
  freeBudgetAt: adultProfile.freeBudgetAt,
};

/** codes of a banned account count as unknown */
const grantsOf = async (db: Database, where: SQL, now: Date): Promise<CodeGrant[]> => {
  const rows = await db
    .select(grantColumns)
    .from(accessCode)
    .innerJoin(user, eq(user.id, accessCode.ownerId))
    .leftJoin(adultProfile, eq(adultProfile.userId, accessCode.ownerId))
    .leftJoin(openrouterKey, eq(openrouterKey.id, accessCode.openrouterKeyId))
    .where(where);
  return rows
    .filter((row) => !row.banned || (row.banExpires !== null && row.banExpires <= now))
    .map(({ role, banned: _banned, banExpires: _banExpires, freeBudgetAt, ...grant }) => ({
      ...grant,
      ownerAdmin: isAdminRole(role),
      freeBudget: freeBudgetAt !== null,
    }));
};

/**
 * A code as typed (normalizeCode): the newest with that text, expired ones too, so the kid hears "abgelaufen"
 * rather than "falsch" (the text is only unique among unexpired codes).
 */
export const findGrant = async (db: Database, code: string, now: Date): Promise<CodeGrant | undefined> =>
  (await grantsOf(db, eq(accessCode.code, code), now)).sort((a, b) => b.endsAt.getTime() - a.endsAt.getTime())[0];

export interface PoolEntry {
  id: string;
  kind: 'key' | 'federation';
  donor: string;
  keySealed: string | null;
  workspaceId: string | null;
  organizationId: string | null;
  federationRuleId: string | null;
  serviceAccountId: string | null;
  capMonth: number;
  active: boolean;
  refusedAt: Date | null;
}

/** in the order the pool uses them: highest priority first, then oldest */
const loadPool = (db: Database): Promise<PoolEntry[]> =>
  db
    .select({
      id: anthropicKey.id,
      kind: anthropicKey.kind,
      donor: anthropicKey.donor,
      keySealed: anthropicKey.keySealed,
      workspaceId: anthropicKey.workspaceId,
      organizationId: anthropicKey.organizationId,
      federationRuleId: anthropicKey.federationRuleId,
      serviceAccountId: anthropicKey.serviceAccountId,
      capMonth: anthropicKey.capMonth,
      active: anthropicKey.active,
      refusedAt: anthropicKey.refusedAt,
    })
    .from(anthropicKey)
    .orderBy(desc(anthropicKey.priority), asc(anthropicKey.createdAt));

/** everything a call is checked against, loaded once a minute per instance */
export interface BudgetSnapshot {
  month: string;
  price: Price;
  limits: Limits;
  /** by code (lowercase) */
  codes: Map<string, CodeGrant>;
  /** dollars, by code id, over all months */
  codeSpend: Map<string, number>;
  /** dollars of the free budget this month, by owner */
  accountSpend: Map<string, number>;
  /** dollars this month, by pool entry */
  entrySpend: Map<string, number>;
  /** the free budget's dollars this month */
  totalSpend: number;
  pool: PoolEntry[];
}

export const loadSnapshot = async (db: Database, limits: Limits, now: Date = new Date()): Promise<BudgetSnapshot> => {
  const month = viennaMonth(now);
  const price = await loadPrice(db);
  const unexpired = db.select({ id: accessCode.id }).from(accessCode).where(gt(accessCode.endsAt, now));
  const [grants, codes, accounts, entries, totalSpend, pool] = await Promise.all([
    grantsOf(db, gt(accessCode.endsAt, now), now),
    spendBy(db, price, usage.codeId, inArray(usage.codeId, unexpired)),
    accountSpend(db, price, month),
    entrySpend(db, price, month),
    totalFreeSpend(db, price, month),
    loadPool(db),
  ]);
  return {
    month,
    price,
    limits,
    codes: new Map(grants.map((grant) => [grant.code, grant])),
    codeSpend: codes,
    accountSpend: accounts,
    entrySpend: entries,
    totalSpend,
    pool,
  };
};

/** a code the snapshot didn't know yet (created a moment ago): looked up directly, then kept */
export const addGrant = async (db: Database, snapshot: BudgetSnapshot, code: string, now: Date) => {
  const grant = await findGrant(db, code, now);
  if (!grant) return undefined;
  const spend = await codeSpend(db, snapshot.price, [grant.id]);
  snapshot.codes.set(grant.code, grant);
  snapshot.codeSpend.set(grant.id, spend.get(grant.id) ?? 0);
  return grant;
};

/** why a call with a code is refused */
export type Refusal =
  | 'not-yet'
  | 'expired'
  | 'code-budget'
  | 'free-withdrawn'
  | 'account-budget'
  | 'total-budget'
  | 'no-pool-entry'
  /** the snapshot couldn't be refreshed: the free budget stops until it can (fail closed) */
  | 'unavailable';

/** the pool entry the next free-budget call uses: the highest priority one that is active, not refused and under 97.5 % */
export const pickEntry = (snapshot: BudgetSnapshot): PoolEntry | undefined =>
  snapshot.pool.find(
    (entry) =>
      entry.active &&
      entry.refusedAt === null &&
      (snapshot.entrySpend.get(entry.id) ?? 0) < entry.capMonth * POOL_ENTRY_USABLE,
  );

/** The checks of docs/budgets.md for one call; `fresh`: the last refresh worked. */
export const checkGrant = (
  snapshot: BudgetSnapshot,
  grant: CodeGrant,
  now: Date,
  fresh: boolean,
): Refusal | undefined => {
  const { limits } = snapshot;
  if (now < grant.startsAt) return 'not-yet';
  if (now >= grant.endsAt) return 'expired';
  if ((snapshot.codeSpend.get(grant.id) ?? 0) >= limits.codeBudgetUsd) return 'code-budget';
  if (grant.source === 'openrouter') return undefined;
  if (!fresh) return 'unavailable';
  if (!grant.ownerAdmin) {
    if (!grant.freeBudget) return 'free-withdrawn';
    if ((snapshot.accountSpend.get(grant.ownerId) ?? 0) >= limits.accountUsdMonth) return 'account-budget';
  }
  if (snapshot.totalSpend >= limits.totalUsdMonth) return 'total-budget';
  if (!pickEntry(snapshot)) return 'no-pool-entry';
  return undefined;
};

const add = (map: Map<string, number>, key: string, value: number) => map.set(key, (map.get(key) ?? 0) + value);

/** one call's usage: added to its row (a failed write is the caller's to log) and to this instance's snapshot */
export const recordUsage = async (
  db: Database,
  snapshot: BudgetSnapshot | undefined,
  grant: CodeGrant,
  poolKeyId: string | null,
  tokens: Tokens,
  now: Date = new Date(),
): Promise<void> => {
  if (snapshot) {
    const cost = costOf(tokens, snapshot.price);
    add(snapshot.codeSpend, grant.id, cost);
    if (grant.source === 'free') {
      add(snapshot.accountSpend, grant.ownerId, cost);
      snapshot.totalSpend += cost;
      if (poolKeyId) add(snapshot.entrySpend, poolKeyId, cost);
    }
  }
  await db
    .insert(usage)
    .values({
      codeId: grant.id,
      ownerId: grant.ownerId,
      source: grant.source,
      poolKeyId,
      openrouterKeyId: grant.openrouterKeyId,
      month: viennaMonth(now),
      calls: 1,
      ...tokens,
    })
    .onConflictDoUpdate({
      target: [usage.codeId, usage.month, usage.poolKeyId],
      set: {
        calls: sql`${usage.calls} + 1`,
        inputTokens: sql`${usage.inputTokens} + excluded.input_tokens`,
        outputTokens: sql`${usage.outputTokens} + excluded.output_tokens`,
        cacheWriteTokens: sql`${usage.cacheWriteTokens} + excluded.cache_write_tokens`,
        cacheReadTokens: sql`${usage.cacheReadTokens} + excluded.cache_read_tokens`,
        updatedAt: now,
      },
    });
};

/** Anthropic refused the entry: every instance skips it from its next refresh, until the admin saves it again */
export const markRefused = async (db: Database, entryId: string, reason: string, now: Date = new Date()) => {
  await db
    .update(anthropicKey)
    .set({ refusedAt: now, refusedReason: reason.slice(0, 500) })
    .where(and(eq(anthropicKey.id, entryId), isNull(anthropicKey.refusedAt)));
};

/** a budget that reached 80 %: the overall month, or one pool entry's cap */
export interface DueWarning {
  budget: string;
  limitUsd: number;
  spentUsd: number;
}

export const dueWarnings = (snapshot: BudgetSnapshot, share: number): DueWarning[] => {
  const due: DueWarning[] = [];
  const { totalUsdMonth } = snapshot.limits;
  if (snapshot.totalSpend >= totalUsdMonth * share)
    due.push({ budget: 'total', limitUsd: totalUsdMonth, spentUsd: snapshot.totalSpend });
  for (const entry of snapshot.pool) {
    const spent = snapshot.entrySpend.get(entry.id) ?? 0;
    if (spent >= entry.capMonth * share)
      due.push({ budget: `pool:${entry.id}`, limitUsd: entry.capMonth, spentUsd: spent });
  }
  return due;
};

/** true for the one instance whose insert wins: it sends the warning */
export const claimWarning = async (db: Database, warning: DueWarning, month: string): Promise<boolean> => {
  const inserted = await db
    .insert(budgetWarning)
    .values({ budget: warning.budget, month, limitUsd: warning.limitUsd })
    .onConflictDoNothing()
    .returning({ budget: budgetWarning.budget });
  return inserted.length > 0;
};

/** where the warnings go: every account with the role `admin` */
export const adminEmails = async (db: Database): Promise<string[]> => {
  const rows = await db
    .select({ email: user.email, role: user.role })
    .from(user)
    .where(sql`${user.role} like '%admin%'`);
  return rows.filter((row) => isAdminRole(row.role)).map((row) => row.email);
};
