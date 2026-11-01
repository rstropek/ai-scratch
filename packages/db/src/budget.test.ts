// Codes, sums, checks and the pool's choice on an in-memory Postgres (PGlite) with the real migrations.
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  addGrant,
  adminEmails,
  type BudgetSnapshot,
  checkGrant,
  claimWarning,
  codeSpend,
  costOf,
  dueWarnings,
  loadPrice,
  loadSnapshot,
  markRefused,
  pickEntry,
  recordUsage,
} from './budget.ts';
import type { Database } from './client.ts';
import { CODE_WORDS, generateCode, normalizeCode } from './codes.ts';
import { DEFAULT_LIMITS, loadLimits } from './limits.ts';
import { monthRange, viennaMonth } from './month.ts';
import * as schema from './schema/index.ts';
import { createTestDb } from './testing.ts';

let db: Database;
let close: () => Promise<void>;

const TEACHER = 'teacher';
const ADMIN = 'admin';
const NOW = new Date('2026-11-10T09:00:00Z');
const HOUR = 3_600_000;
/** a million output tokens: $0.50 at the seeded price */
const MILLION_OUT = { inputTokens: 0, outputTokens: 1_000_000, cacheWriteTokens: 0, cacheReadTokens: 0 };

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  await db.insert(schema.user).values([
    { id: TEACHER, name: 'Lehrerin', email: 'lehrerin@example.com' },
    { id: ADMIN, name: 'Rainer', email: 'rainer@example.com', role: 'user,admin' },
  ]);
  await db.insert(schema.adultProfile).values({
    userId: TEACHER,
    kind: 'teacher',
    termsVersion: 't',
    termsAcceptedAt: NOW,
    aiConsentAt: NOW,
    adultConfirmedAt: NOW,
    freeBudgetAt: NOW,
  });
});
afterAll(() => close());
beforeEach(async () => {
  await db.delete(schema.usage);
  await db.delete(schema.accessCode);
  await db.delete(schema.anthropicKey);
  await db.delete(schema.budgetWarning);
  await db.update(schema.adultProfile).set({ freeBudgetAt: NOW });
  await db.update(schema.user).set({ banned: false });
});

const addCode = async (values: Partial<typeof schema.accessCode.$inferInsert> = {}) => {
  const code = generateCode();
  const [row] = await db
    .insert(schema.accessCode)
    .values({
      code,
      ownerId: TEACHER,
      source: 'free',
      startsAt: new Date(NOW.getTime() - HOUR),
      endsAt: new Date(NOW.getTime() + HOUR),
      ...values,
    })
    .returning();
  return row as typeof schema.accessCode.$inferSelect;
};

const addEntry = async (values: Partial<typeof schema.anthropicKey.$inferInsert> = {}) => {
  const id = randomUUID();
  await db.insert(schema.anthropicKey).values({
    id,
    donor: 'Rainer',
    keySealed: 'v1:x',
    keyFingerprint: id,
    keyHint: '…abcd',
    capMonth: 10,
    ...values,
  });
  return id;
};

const snapshotWith = async (code: string, limits = DEFAULT_LIMITS) => {
  const snapshot = await loadSnapshot(db, limits, NOW);
  const grant = snapshot.codes.get(code);
  if (!grant) throw new Error('code missing from the snapshot');
  return { snapshot, grant };
};

/** spends `dollars` through the code (in output tokens) */
const spend = async (snapshot: BudgetSnapshot | undefined, code: string, entry: string | null, dollars: number) => {
  const grant = (await loadSnapshot(db, DEFAULT_LIMITS, NOW)).codes.get(code);
  if (!grant) throw new Error('code missing');
  await recordUsage(db, snapshot, grant, entry, { ...MILLION_OUT, outputTokens: dollars * 2_000_000 }, NOW);
};

describe('codes', () => {
  it('are two different words and two digits, typed in any case', () => {
    expect(new Set(CODE_WORDS).size).toBe(CODE_WORDS.length);
    expect(CODE_WORDS.length).toBeGreaterThanOrEqual(200);
    expect(CODE_WORDS.every((word) => /^[A-Z]{3,8}$/.test(word))).toBe(true);
    for (let i = 0; i < 200; i++) {
      const [first, second, digits] = generateCode().split('-');
      expect(first).not.toBe(second);
      expect(digits).toMatch(/^\d\d$/);
    }
    expect(normalizeCode('  Tiger Apfel  48 ')).toBe('tiger-apfel-48');
  });
});

describe('months', () => {
  it('are Vienna calendar months', () => {
    expect(viennaMonth(new Date('2026-10-31T22:30:00Z'))).toBe('2026-10');
    expect(viennaMonth(new Date('2026-10-31T23:30:00Z'))).toBe('2026-11');
    expect(monthRange('2026-11')).toEqual({
      start: new Date('2026-10-31T23:00:00Z'),
      end: new Date('2026-11-30T23:00:00Z'),
    });
    expect(monthRange('2026-12').end).toEqual(new Date('2026-12-31T23:00:00Z'));
    expect(monthRange('2026-04').start).toEqual(new Date('2026-03-31T22:00:00Z'));
  });
});

describe('limits', () => {
  it('come from the environment, with defaults', () => {
    expect(loadLimits({})).toEqual(DEFAULT_LIMITS);
    expect(loadLimits({ CODE_BUDGET_USD: '2.5' }).codeBudgetUsd).toBe(2.5);
    expect(() => loadLimits({ BUDGET_TOTAL_USD_MONTH: 'viel' })).toThrow('BUDGET_TOTAL_USD_MONTH');
  });
});

describe('the price', () => {
  it('is seeded by the migration with Haiku 5.5', async () => {
    const price = await loadPrice(db);
    expect(price).toEqual({ input: 0.1, output: 0.5, cacheWrite: 0.125, cacheRead: 0.01 });
    expect(
      costOf({ inputTokens: 1e6, outputTokens: 1e6, cacheWriteTokens: 1e6, cacheReadTokens: 1e6 }, price),
    ).toBeCloseTo(0.735);
  });
});

describe('checks', () => {
  it('let a running free code through and pick the highest priority entry', async () => {
    const low = await addEntry({ priority: 1 });
    const high = await addEntry({ priority: 5 });
    const code = await addCode();
    const { snapshot, grant } = await snapshotWith(code.code);
    expect(checkGrant(snapshot, grant, NOW, true)).toBeUndefined();
    expect(pickEntry(snapshot)?.id).toBe(high);
    expect(low).not.toBe(high);
  });

  it('refuse a code outside its window', async () => {
    await addEntry();
    const code = await addCode({
      startsAt: new Date(NOW.getTime() + HOUR),
      endsAt: new Date(NOW.getTime() + 2 * HOUR),
    });
    const { snapshot, grant } = await snapshotWith(code.code);
    expect(checkGrant(snapshot, grant, NOW, true)).toBe('not-yet');
    expect(checkGrant(snapshot, grant, new Date(NOW.getTime() + 2 * HOUR), true)).toBe('expired');
  });

  it('stop a code at its own budget, over all months', async () => {
    const entry = await addEntry({ capMonth: 100 });
    const code = await addCode();
    await recordUsage(
      db,
      undefined,
      (await snapshotWith(code.code)).grant,
      entry,
      { ...MILLION_OUT, outputTokens: 6_000_000 },
      new Date('2026-10-31T22:30:00Z'),
    );
    await spend(undefined, code.code, entry, 2);
    const { snapshot, grant } = await snapshotWith(code.code);
    expect(snapshot.codeSpend.get(code.id)).toBeCloseTo(5);
    expect(checkGrant(snapshot, grant, NOW, true)).toBe('code-budget');
  });

  it('stop the free budget when it is withdrawn or the account month is used up, but not for admins', async () => {
    await addEntry({ capMonth: 100 });
    const code = await addCode();
    const adminCode = await addCode({ ownerId: ADMIN });
    // the teacher's other codes count toward the same account
    const other = await addCode();
    await spend(undefined, other.code, null, 4.5);
    await addCode().then((c) => spend(undefined, c.code, null, 4.5));
    await addCode().then((c) => spend(undefined, c.code, null, 1));
    let { snapshot, grant } = await snapshotWith(code.code);
    expect(checkGrant(snapshot, grant, NOW, true)).toBe('account-budget');
    await db.update(schema.adultProfile).set({ freeBudgetAt: null });
    ({ snapshot, grant } = await snapshotWith(code.code));
    expect(checkGrant(snapshot, grant, NOW, true)).toBe('free-withdrawn');
    const admin = snapshot.codes.get(adminCode.code);
    expect(admin && checkGrant(snapshot, admin, NOW, true)).toBeUndefined();
  });

  it('stop everyone at the overall month, admins too', async () => {
    await addEntry({ capMonth: 1000 });
    const adminCode = await addCode({ ownerId: ADMIN });
    await spend(undefined, adminCode.code, null, 4);
    const { snapshot, grant } = await snapshotWith(adminCode.code, { ...DEFAULT_LIMITS, totalUsdMonth: 4 });
    expect(checkGrant(snapshot, grant, NOW, true)).toBe('total-budget');
  });

  it('skip entries that are paused, refused or at 97.5 % of their cap', async () => {
    const paused = await addEntry({ priority: 9, active: false });
    const refused = await addEntry({ priority: 8 });
    const full = await addEntry({ priority: 7, capMonth: 2 });
    const next = await addEntry({ priority: 1, capMonth: 2 });
    await markRefused(db, refused, 'credit balance too low', NOW);
    const code = await addCode({ ownerId: ADMIN });
    await spend(undefined, code.code, full, 1.95);
    await spend(undefined, code.code, next, 1.9);
    const { snapshot, grant } = await snapshotWith(code.code);
    expect(pickEntry(snapshot)?.id).toBe(next);
    expect(snapshot.pool.find((e) => e.id === paused)?.active).toBe(false);
    // the call's own usage is added at once, so this instance stops before the next refresh
    await recordUsage(db, snapshot, grant, next, { ...MILLION_OUT, outputTokens: 100_000 }, NOW);
    expect(pickEntry(snapshot)).toBeUndefined();
    expect(checkGrant(snapshot, grant, NOW, true)).toBe('no-pool-entry');
  });

  it('keep own-key codes going on a stale snapshot, but not free ones', async () => {
    await addEntry();
    const [key] = await db
      .insert(schema.openrouterKey)
      .values({
        id: randomUUID(),
        ownerId: TEACHER,
        label: 'Zuhause',
        keySealed: 'v1:y',
        keyFingerprint: 'f',
        keyHint: '…wxyz',
      })
      .returning();
    const own = await addCode({ source: 'openrouter', openrouterKeyId: key?.id });
    const free = await addCode();
    const snapshot = await loadSnapshot(db, DEFAULT_LIMITS, NOW);
    const ownGrant = snapshot.codes.get(own.code);
    expect(ownGrant?.keySealed).toBe('v1:y');
    expect(ownGrant && checkGrant(snapshot, ownGrant, NOW, false)).toBeUndefined();
    const freeGrant = snapshot.codes.get(free.code);
    expect(freeGrant && checkGrant(snapshot, freeGrant, NOW, false)).toBe('unavailable');
  });

  it('find new and expired codes directly, and treat codes of banned accounts as unknown', async () => {
    const expired = await addCode({ endsAt: new Date(NOW.getTime() - 1) });
    const snapshot = await loadSnapshot(db, DEFAULT_LIMITS, NOW);
    expect(snapshot.codes.has(expired.code)).toBe(false);
    const found = await addGrant(db, snapshot, expired.code, NOW);
    expect(found && checkGrant(snapshot, found, NOW, true)).toBe('expired');
    const fresh = await addCode();
    expect(snapshot.codes.has(fresh.code)).toBe(false);
    expect((await addGrant(db, snapshot, fresh.code, NOW))?.id).toBe(fresh.id);
    expect(snapshot.codes.has(fresh.code)).toBe(true);
    await db.update(schema.user).set({ banned: true }).where(eq(schema.user.id, TEACHER));
    expect((await loadSnapshot(db, DEFAULT_LIMITS, NOW)).codes.has(fresh.code)).toBe(false);
  });
});

describe('usage', () => {
  it('adds up per code, month and entry, and survives deleting the code', async () => {
    const entry = await addEntry();
    const code = await addCode();
    await spend(undefined, code.code, entry, 1);
    await spend(undefined, code.code, entry, 1);
    await spend(undefined, code.code, null, 1);
    const rows = await db.select().from(schema.usage);
    expect(rows.map((r) => [r.poolKeyId, r.calls, r.month]).sort()).toEqual(
      [
        [entry, 2, '2026-11'],
        [null, 1, '2026-11'],
      ].sort(),
    );
    await db.delete(schema.accessCode);
    const price = await loadPrice(db);
    expect((await codeSpend(db, price, [code.id])).get(code.id)).toBeCloseTo(3);
  });
});

describe('warnings', () => {
  it('fall due at 80 % and are claimed once', async () => {
    const entry = await addEntry({ capMonth: 5 });
    const code = await addCode({ ownerId: ADMIN });
    await spend(undefined, code.code, entry, 4);
    const { snapshot } = await snapshotWith(code.code);
    const due = dueWarnings(snapshot, 0.8);
    expect(due).toEqual([{ budget: `pool:${entry}`, limitUsd: 5, spentUsd: expect.closeTo(4) }]);
    const [warning] = due;
    if (!warning) throw new Error('no warning');
    expect(await claimWarning(db, warning, snapshot.month)).toBe(true);
    expect(await claimWarning(db, warning, snapshot.month)).toBe(false);
    expect(await claimWarning(db, { ...warning, limitUsd: 10 }, snapshot.month)).toBe(true);
    expect(await adminEmails(db)).toEqual(['rainer@example.com']);
  });
});
