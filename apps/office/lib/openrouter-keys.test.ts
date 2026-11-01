// Adults' own OpenRouter keys on an in-memory Postgres (PGlite) with the real migrations, and the reader against a
// fake OpenRouter (a stand-in fetch).
import { randomBytes } from 'node:crypto';
import { createKeyBox, type Database, schema } from '@ai-scratch/db';
import { createTestDb } from '@ai-scratch/db/testing';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  addOpenRouterKey,
  createOpenRouterKeyReader,
  deleteOpenRouterKey,
  type KeyStatus,
  LIST_TIMEOUT_MS,
  listOpenRouterKeys,
  type OpenRouterDeps,
  readRemaining,
  validateOpenRouterKey,
} from './openrouter-keys.ts';
import { texts } from './texts.ts';

const v = texts.openrouterKeys.validation;

let db: Database;
let close: () => Promise<void>;
let deps: OpenRouterDeps;
let answer: KeyStatus;
const asked: { key: string; timeoutMs?: number }[] = [];
const box = createKeyBox(randomBytes(32));

const OWNER = 'teacher';
const OTHER = 'parent';

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  deps = {
    db,
    box,
    readKey: async (key, options) => {
      asked.push({ key, ...options });
      return answer;
    },
  };
  await db.insert(schema.user).values([
    { id: OWNER, name: 'Tina Lehrerin', email: 'tina@example.com' },
    { id: OTHER, name: 'Paul Vater', email: 'paul@example.com' },
  ]);
});
afterAll(() => close());
beforeEach(async () => {
  answer = { ok: true, limitRemaining: 5 };
  asked.length = 0;
  await db.delete(schema.openrouterKey);
});

let n = 0;
const newKey = () => `sk-or-v1-${(++n).toString().padStart(4, '0')}abcdefghijklmnop`;

const add = async (ownerId = OWNER, key = newKey(), label = 'Schule') => {
  const result = await addOpenRouterKey(deps, ownerId, { label, key });
  if (!result.ok) throw new Error(JSON.stringify(result));
  asked.length = 0;
  return { id: result.id, key };
};

describe('validateOpenRouterKey', () => {
  it('needs a label and something that looks like an OpenRouter key', () => {
    expect(validateOpenRouterKey({ label: ' ', key: 'sk-ant-api03-abcdefghijklmnop' })).toEqual({
      ok: false,
      fieldErrors: { label: v.label(100), key: v.key },
    });
    expect(validateOpenRouterKey({ label: ' Schule ', key: ' sk-or-v1-abcdefghijk ' })).toEqual({
      ok: true,
      value: { label: 'Schule', key: 'sk-or-v1-abcdefghijk' },
    });
  });
});

describe('addOpenRouterKey', () => {
  it('asks OpenRouter whether it knows the key and stores it sealed, with its hint', async () => {
    const key = newKey();
    const result = await addOpenRouterKey(deps, OWNER, { label: 'Schule', key });
    if (!result.ok) throw new Error(JSON.stringify(result));
    expect(asked).toEqual([{ key }]);
    const [row] = await db.select().from(schema.openrouterKey).where(eq(schema.openrouterKey.id, result.id));
    expect(row?.keySealed).not.toContain(key);
    expect(box.open(result.id, row?.keySealed ?? '')).toBe(key);
    expect(row).toMatchObject({ ownerId: OWNER, label: 'Schule', keyHint: `…${key.slice(-4)}` });
  });

  it('stores a key without a limit or with much left: only creating a code checks that', async () => {
    answer = { ok: true, limitRemaining: null };
    expect((await addOpenRouterKey(deps, OWNER, { label: 'a', key: newKey() })).ok).toBe(true);
    answer = { ok: true, limitRemaining: 500 };
    expect((await addOpenRouterKey(deps, OWNER, { label: 'b', key: newKey() })).ok).toBe(true);
  });

  it('stores nothing when OpenRouter does not know the key or does not answer', async () => {
    for (const reason of ['invalid', 'unreachable'] as const) {
      answer = { ok: false, reason };
      expect(await addOpenRouterKey(deps, OWNER, { label: 'x', key: newKey() })).toEqual({ ok: false, check: reason });
    }
    expect(await listOpenRouterKeys(db, OWNER)).toEqual([]);
  });

  it('refuses the same key twice for one account, without asking OpenRouter, but not for another account', async () => {
    const { key } = await add();
    expect(await addOpenRouterKey(deps, OWNER, { label: 'again', key })).toEqual({
      ok: false,
      fieldErrors: { key: v.duplicate },
    });
    expect(asked).toEqual([]);
    expect((await addOpenRouterKey(deps, OTHER, { label: 'Zuhause', key })).ok).toBe(true);
  });

  it('refuses a key another tab added while OpenRouter was answering', async () => {
    const key = newKey();
    const racing: OpenRouterDeps = {
      ...deps,
      readKey: async () => {
        await add(OWNER, key, 'other tab');
        return { ok: true, limitRemaining: 5 };
      },
    };
    expect(await addOpenRouterKey(racing, OWNER, { label: 'Schule', key })).toEqual({
      ok: false,
      fieldErrors: { key: v.duplicate },
    });
  });
});

describe('the list, what is left and deleting', () => {
  const addCode = (keyId: string, code: string) =>
    db.insert(schema.accessCode).values({
      code,
      ownerId: OWNER,
      source: 'openrouter',
      openrouterKeyId: keyId,
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 3_600_000),
    });

  it("lists only the owner's keys, each with its codes, and never the sealed key", async () => {
    const first = await add(OWNER, newKey(), 'Schule');
    await add(OWNER, newKey(), 'Zuhause');
    await add(OTHER, newKey(), 'fremd');
    await addCode(first.id, 'tiger-apfel-48');
    await addCode(first.id, 'hase-mond-07');
    const keys = await listOpenRouterKeys(db, OWNER);
    expect(keys.map((key) => [key.label, key.codes.sort()])).toEqual([
      ['Schule', ['hase-mond-07', 'tiger-apfel-48']],
      ['Zuhause', []],
    ]);
    expect(Object.keys(keys[0] ?? {})).not.toContain('keySealed');
  });

  it('asks OpenRouter for every key with the short timeout', async () => {
    const one = await add();
    const two = await add();
    answer = { ok: true, limitRemaining: 3.5 };
    const remaining = await readRemaining(deps, OWNER, [one, two]);
    expect(remaining.get(one.id)).toEqual({ ok: true, limitRemaining: 3.5 });
    expect(asked).toEqual([
      { key: one.key, timeoutMs: LIST_TIMEOUT_MS },
      { key: two.key, timeoutMs: LIST_TIMEOUT_MS },
    ]);
  });

  it("deletes the owner's key with its codes, never another account's", async () => {
    const { id } = await add();
    await addCode(id, 'tiger-apfel-48');
    expect(await deleteOpenRouterKey(db, OTHER, id)).toBe(false);
    expect(await deleteOpenRouterKey(db, OWNER, 'not-a-uuid')).toBe(false);
    expect(await deleteOpenRouterKey(db, OWNER, id)).toBe(true);
    expect(await listOpenRouterKeys(db, OWNER)).toEqual([]);
    expect(await db.select().from(schema.accessCode)).toEqual([]);
  });
});

describe('createOpenRouterKeyReader', () => {
  const requests: Request[] = [];
  const reader = (respond: () => Response | Promise<Response>) =>
    createOpenRouterKeyReader({
      baseURL: 'https://openrouter.test/api/v1',
      fetch: (async (url: string | URL | Request, init?: RequestInit) => {
        requests.push(new Request(url, init));
        return respond();
      }) as typeof fetch,
    });
  const keyInfo = (data: unknown) => () => Response.json({ data });

  beforeEach(() => {
    requests.length = 0;
  });

  it('reads limit_remaining with the key as Bearer; null means the key has no limit', async () => {
    expect(await reader(keyInfo({ limit: 10, limit_remaining: 4.2 }))('sk-or-v1-abc')).toEqual({
      ok: true,
      limitRemaining: 4.2,
    });
    expect(requests[0]?.url).toBe('https://openrouter.test/api/v1/key');
    expect(requests[0]?.headers.get('authorization')).toBe('Bearer sk-or-v1-abc');
    expect(await reader(keyInfo({ limit: null, limit_remaining: null }))('sk-or-v1-abc')).toEqual({
      ok: true,
      limitRemaining: null,
    });
  });

  it('tells an unknown key from an outage', async () => {
    for (const status of [401, 403])
      expect(await reader(() => new Response('', { status }))('k')).toEqual({ ok: false, reason: 'invalid' });
    expect(await reader(() => new Response('', { status: 502 }))('k')).toEqual({ ok: false, reason: 'unreachable' });
    expect(
      await reader(() => {
        throw new TypeError('fetch failed');
      })('k'),
    ).toEqual({ ok: false, reason: 'unreachable' });
  });

  it('gives up after the timeout', async () => {
    const slow = createOpenRouterKeyReader({
      baseURL: 'https://openrouter.test/api/v1',
      fetch: ((_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) =>
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason)),
        )) as typeof fetch,
    });
    expect(await slow('k', { timeoutMs: 20 })).toEqual({ ok: false, reason: 'unreachable' });
  });
});
