// Access codes on an in-memory Postgres (PGlite) with the real migrations: who may create codes from which source,
// the monthly count, uniqueness under the advisory locks, the lists with their spend, deleting.
import { randomBytes } from 'node:crypto';
import { createKeyBox, type Database, generateCode, schema } from '@ai-scratch/db';
import { DEFAULT_LIMITS } from '@ai-scratch/db/limits';
import { createTestDb } from '@ai-scratch/db/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { accountBudget } from './budget-numbers.ts';
import {
  type CodeDeps,
  type CodeInput,
  type CodeOwner,
  countCodes,
  createCode,
  deleteCode,
  fromViennaWallTime,
  isGeneratedCode,
  listCodes,
  validateCode,
} from './codes.ts';
import { addOpenRouterKey, type KeyStatus } from './openrouter-keys.ts';
import { texts } from './texts.ts';

const v = texts.codes.validation;

let db: Database;
let close: () => Promise<void>;
let deps: CodeDeps;
let answer: KeyStatus;
const box = createKeyBox(randomBytes(32));

const TEACHER: CodeOwner = { id: 'teacher', admin: false };
const PARENT: CodeOwner = { id: 'parent', admin: false };
const ADMIN: CodeOwner = { id: 'admin', admin: true };

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  deps = { db, box, readKey: async () => answer, limits: DEFAULT_LIMITS };
  await db.insert(schema.user).values([
    { id: TEACHER.id, name: 'Tina Lehrerin', email: 'tina@example.com' },
    { id: PARENT.id, name: 'Paul Vater', email: 'paul@example.com' },
    { id: ADMIN.id, name: 'Admin', email: 'admin@example.com', role: 'admin' },
  ]);
  const profile = {
    termsVersion: 'x',
    termsAcceptedAt: new Date(),
    aiConsentAt: new Date(),
    adultConfirmedAt: new Date(),
  };
  await db.insert(schema.adultProfile).values([
    { userId: TEACHER.id, kind: 'teacher', freeBudgetAt: new Date(), ...profile },
    { userId: PARENT.id, kind: 'parent', ...profile },
  ]);
});
afterAll(() => close());
beforeEach(async () => {
  answer = { ok: true, limitRemaining: 5 };
  await db.delete(schema.accessCode);
  await db.delete(schema.openrouterKey);
  await db.delete(schema.usage);
});

const input = (overrides: Partial<CodeInput> = {}): CodeInput => ({
  code: generateCode(),
  source: 'free',
  startsAt: '',
  hours: '1',
  comment: '',
  askEnabled: true,
  ...overrides,
});

const created = async (owner: CodeOwner, overrides: Partial<CodeInput> = {}, codeDeps = deps) => {
  const result = await createCode(codeDeps, owner, input(overrides));
  if (!result.ok) throw new Error(JSON.stringify(result));
  return result;
};

const ownKey = async (owner: CodeOwner) => {
  const result = await addOpenRouterKey(deps, owner.id, {
    label: 'Zuhause',
    key: `sk-or-v1-${randomBytes(8).toString('hex')}`,
  });
  if (!result.ok) throw new Error(JSON.stringify(result));
  return result.id;
};

describe('fromViennaWallTime', () => {
  it('reads the form value as Vienna time, in winter and in summer', () => {
    expect(fromViennaWallTime('2026-11-03T10:00')?.toISOString()).toBe('2026-11-03T09:00:00.000Z');
    expect(fromViennaWallTime('2026-07-01T10:00')?.toISOString()).toBe('2026-07-01T08:00:00.000Z');
  });

  it('refuses anything else', () => {
    for (const value of ['', '2026-11-03', '2026-02-31T10:00', '2026-11-03T25:00', 'morgen'])
      expect(fromViennaWallTime(value)).toBeUndefined();
  });
});

describe('validateCode', () => {
  const now = new Date('2026-11-03T09:00:00Z');

  it('starts now by default and lasts the chosen hours', () => {
    const result = validateCode(input({ hours: '2', comment: ' 4b ' }), DEFAULT_LIMITS, now);
    expect(result).toMatchObject({
      ok: true,
      value: { source: 'free', startsAt: now, endsAt: new Date('2026-11-03T11:00:00Z'), comment: '4b' },
    });
  });

  it('names every field that is wrong', () => {
    const result = validateCode(
      input({ source: '', startsAt: '2026-11-03T09:00', hours: '5', comment: 'x'.repeat(201) }),
      DEFAULT_LIMITS,
      now,
    );
    expect(result).toEqual({
      ok: false,
      fieldErrors: { source: v.source, startsAt: v.startsAtPast, hours: v.hours(4), comment: v.comment(200) },
    });
    expect(validateCode(input({ startsAt: '2026-12-04T10:01' }), DEFAULT_LIMITS, now)).toMatchObject({
      fieldErrors: { startsAt: v.startsAtFar(30) },
    });
    expect(validateCode(input({ startsAt: '2026-11-03T09:59' }), DEFAULT_LIMITS, now)).toMatchObject({ ok: true });
  });

  it('knows a generated code from a chosen one', () => {
    expect(isGeneratedCode(generateCode())).toBe(true);
    for (const code of ['tiger-tiger-48', 'tiger-apfel-4', 'meinecode-apfel-48', 'tiger-apfel-48-1', 'tiger'])
      expect(isGeneratedCode(code)).toBe(false);
  });
});

describe('createCode from the free budget', () => {
  it('stores the code with its window, its comment and "frage KI"', async () => {
    const { id, code } = await created(TEACHER, { comment: '4b Dienstag', askEnabled: false, hours: '3' });
    const [row] = await listCodes(db, { ownerId: TEACHER.id });
    expect(row).toMatchObject({ id, code, source: 'free', key: null, comment: '4b Dienstag', askEnabled: false });
    expect((row?.endsAt.getTime() ?? 0) - (row?.startsAt.getTime() ?? 0)).toBe(3 * 3_600_000);
  });

  it('refuses an account whose free budget is not switched on', async () => {
    expect(await createCode(deps, PARENT, input())).toEqual({ ok: false, refusal: { reason: 'no-free-budget' } });
  });

  it('allows as many free codes per month as the limit, and gives one back when a code is deleted', async () => {
    const codes = [];
    for (let i = 0; i < DEFAULT_LIMITS.freeCodesPerAccountMonth; i++) codes.push(await created(TEACHER));
    expect(await createCode(deps, TEACHER, input())).toEqual({
      ok: false,
      refusal: { reason: 'free-codes-used', limit: DEFAULT_LIMITS.freeCodesPerAccountMonth },
    });
    expect(await deleteCode(db, TEACHER, codes[0]?.id ?? '')).toBe(true);
    await created(TEACHER);
  });

  it('counts the month a code is created in (Vienna)', async () => {
    const lastMonth = { ...deps, now: () => new Date('2026-10-31T22:30:00Z') }; // 23:30 in Vienna
    const inNovember = { ...deps, now: () => new Date('2026-10-31T23:30:00Z') }; // 00:30 on 1 November
    for (let i = 0; i < DEFAULT_LIMITS.freeCodesPerAccountMonth; i++) await created(TEACHER, {}, lastMonth);
    await created(TEACHER, {}, inNovember);
  });

  it('lets two tabs create only the last free code, never both (the owner lock)', async () => {
    for (let i = 0; i < DEFAULT_LIMITS.freeCodesPerAccountMonth - 1; i++) await created(TEACHER);
    const results = await Promise.all([createCode(deps, TEACHER, input()), createCode(deps, TEACHER, input())]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.find((result) => !result.ok)).toMatchObject({ refusal: { reason: 'free-codes-used' } });
  });

  it('gives admins free codes without the switch and without a count', async () => {
    for (let i = 0; i <= DEFAULT_LIMITS.freeCodesPerAccountMonth; i++) await created(ADMIN);
    expect(await listCodes(db, { ownerId: ADMIN.id })).toHaveLength(DEFAULT_LIMITS.freeCodesPerAccountMonth + 1);
  });
});

describe('createCode: the code itself', () => {
  it('refuses a code that is in use and proposes another', async () => {
    const { code } = await created(TEACHER);
    const again = await createCode(deps, ADMIN, input({ code }));
    expect(again).toMatchObject({ ok: false, refusal: { reason: 'taken' } });
    const proposal = !again.ok && 'refusal' in again && again.refusal.reason === 'taken' && again.refusal.proposal;
    expect(proposal && isGeneratedCode(proposal)).toBe(true);
  });

  it('takes the same code for two tabs only once (the code lock)', async () => {
    const code = generateCode();
    const results = await Promise.all([
      createCode(deps, TEACHER, input({ code })),
      createCode(deps, ADMIN, input({ code })),
    ]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
  });

  it('takes a code again once the old one has expired', async () => {
    const code = generateCode();
    await db.insert(schema.accessCode).values({
      code,
      ownerId: TEACHER.id,
      source: 'free',
      startsAt: new Date(Date.now() - 7_200_000),
      endsAt: new Date(Date.now() - 3_600_000),
    });
    expect((await createCode(deps, ADMIN, input({ code }))).ok).toBe(true);
  });

  it('refuses a code the form did not propose', async () => {
    expect(await createCode(deps, ADMIN, input({ code: 'mein-code-12' }))).toMatchObject({
      ok: false,
      refusal: { reason: 'taken' },
    });
  });
});

describe('createCode from an own OpenRouter key', () => {
  it('works with a limit of at most $25 left, also without the free budget', async () => {
    const keyId = await ownKey(PARENT);
    answer = { ok: true, limitRemaining: 25 };
    const { id } = await created(PARENT, { source: keyId });
    const [row] = await listCodes(db, { ownerId: PARENT.id });
    expect(row).toMatchObject({ id, source: 'openrouter', key: { label: 'Zuhause' } });
  });

  it('refuses a key without a limit, with too much left, unknown to OpenRouter or not reachable', async () => {
    const keyId = await ownKey(PARENT);
    const cases: [KeyStatus, unknown][] = [
      [{ ok: true, limitRemaining: null }, { reason: 'key-no-limit' }],
      [
        { ok: true, limitRemaining: 25.01 },
        { reason: 'key-too-much', remaining: 25.01 },
      ],
      [{ ok: false, reason: 'invalid' }, { reason: 'key-invalid' }],
      [{ ok: false, reason: 'unreachable' }, { reason: 'key-unreachable' }],
    ];
    for (const [status, refusal] of cases) {
      answer = status;
      expect(await createCode(deps, PARENT, input({ source: keyId }))).toEqual({ ok: false, refusal });
    }
    // the $25 rule holds for admins too
    answer = { ok: true, limitRemaining: 100 };
    const adminKey = await ownKey(ADMIN);
    expect(await createCode(deps, ADMIN, input({ source: adminKey }))).toMatchObject({
      refusal: { reason: 'key-too-much' },
    });
  });

  it("refuses another account's key as if it didn't exist", async () => {
    const keyId = await ownKey(PARENT);
    expect(await createCode(deps, TEACHER, input({ source: keyId }))).toEqual({
      ok: false,
      fieldErrors: { source: v.source },
    });
  });

  it('does not count own-key codes against the free codes', async () => {
    const keyId = await ownKey(TEACHER);
    for (let i = 0; i < DEFAULT_LIMITS.freeCodesPerAccountMonth; i++) await created(TEACHER);
    await created(TEACHER, { source: keyId });
  });
});

describe('the lists, the numbers and deleting', () => {
  it("shows each code's spend over all months, at the current price", async () => {
    const { id } = await created(TEACHER);
    const usage = { codeId: id, ownerId: TEACHER.id, source: 'free' as const, inputTokens: 1_000_000 };
    await db.insert(schema.usage).values([
      { ...usage, month: '2026-10', outputTokens: 1_000_000 },
      { ...usage, month: '2026-11', cacheReadTokens: 1_000_000 },
    ]);
    // the migration's price: 0.1 input, 0.5 output, 0.01 cache read
    const [row] = await listCodes(db, { ownerId: TEACHER.id });
    expect(row?.spentUsd).toBeCloseTo(0.1 + 0.5 + 0.1 + 0.01);
  });

  it("filters by state and shows admins every account's codes", async () => {
    await created(TEACHER);
    await created(PARENT, { source: await ownKey(PARENT) });
    const now = new Date();
    await db.insert(schema.accessCode).values([
      {
        code: 'hase-mond-01',
        ownerId: TEACHER.id,
        source: 'free',
        startsAt: new Date(+now + 864e5),
        endsAt: new Date(+now + 87e6),
      },
      {
        code: 'hase-mond-02',
        ownerId: TEACHER.id,
        source: 'free',
        startsAt: new Date(+now - 2e6),
        endsAt: new Date(+now - 1e6),
      },
    ]);
    expect(await countCodes(db, now)).toEqual({ running: 2, planned: 1, expired: 1 });
    expect((await listCodes(db, { state: 'running', now })).map((row) => row.owner.name).sort()).toEqual([
      'Paul Vater',
      'Tina Lehrerin',
    ]);
    expect((await listCodes(db, { state: 'planned', now })).map((row) => row.code)).toEqual(['hase-mond-01']);
    expect((await listCodes(db, { ownerId: TEACHER.id, now })).map((row) => row.code)[0]).toBe('hase-mond-01');
  });

  it('lets the owner and admins delete a code, nobody else', async () => {
    const { id } = await created(TEACHER);
    expect(await deleteCode(db, PARENT, id)).toBe(false);
    expect(await deleteCode(db, ADMIN, id)).toBe(true);
    expect(await deleteCode(db, TEACHER, id)).toBe(false);
    expect(await deleteCode(db, TEACHER, 'not-a-uuid')).toBe(false);
  });

  it("adds up the account's free budget this month", async () => {
    const { id } = await created(TEACHER);
    await created(TEACHER);
    const month = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Vienna' }).slice(0, 7);
    await db
      .insert(schema.usage)
      .values({ codeId: id, ownerId: TEACHER.id, source: 'free', month, outputTokens: 2_000_000 });
    const price = { input: 0.1, output: 0.5, cacheWrite: 0.125, cacheRead: 0.01 };
    expect(await accountBudget(db, price, DEFAULT_LIMITS, TEACHER.id)).toEqual({
      spentUsd: 1,
      limitUsd: DEFAULT_LIMITS.accountUsdMonth,
      codesCreated: 2,
      codesLimit: DEFAULT_LIMITS.freeCodesPerAccountMonth,
    });
  });
});
