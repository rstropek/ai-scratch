// The model price on an in-memory Postgres (PGlite) with the real migrations (which seed today's Haiku price), and
// the fetch from a fake OpenRouter model list.
import { type Database, schema } from '@ai-scratch/db';
import { createTestDb } from '@ai-scratch/db/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createOpenRouterPriceFetcher, getPrice, OPENROUTER_MODEL, savePrice, validatePrice } from './prices.ts';
import { texts } from './texts.ts';

let db: Database;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  await db.insert(schema.user).values({ id: 'admin', name: 'Admin', email: 'admin@example.com', role: 'admin' });
});
afterAll(() => close());

describe('the stored price', () => {
  it("starts with the migration's Haiku price", async () => {
    expect(await getPrice(db)).toMatchObject({
      input: 0.1,
      output: 0.5,
      cacheWrite: 0.125,
      cacheRead: 0.01,
      updatedBy: null,
    });
  });

  it('saves four positive numbers, with a comma or a point, and who saved them', async () => {
    expect(
      await savePrice(db, 'admin', { input: '0,2', output: '1', cacheWrite: ' 0.25 ', cacheRead: '0.02' }),
    ).toEqual({
      ok: true,
    });
    expect(await getPrice(db)).toMatchObject({
      input: 0.2,
      output: 1,
      cacheWrite: 0.25,
      cacheRead: 0.02,
      updatedBy: 'Admin',
    });
  });

  it('refuses 0, negative numbers and anything that is not a number', () => {
    const error = texts.admin.prices.validation(1000);
    expect(validatePrice({ input: '0', output: '-1', cacheWrite: 'abc', cacheRead: '' })).toEqual({
      ok: false,
      fieldErrors: { input: error, output: error, cacheWrite: error, cacheRead: error },
    });
  });
});

describe('createOpenRouterPriceFetcher', () => {
  const fetcher = (respond: () => Response) =>
    createOpenRouterPriceFetcher({
      baseURL: 'https://openrouter.test/api/v1',
      fetch: (async (url: string | URL | Request) => {
        if (String(url) !== 'https://openrouter.test/api/v1/models') return new Response('', { status: 404 });
        return respond();
      }) as typeof fetch,
    });
  const models = (pricing: Record<string, string>) => () =>
    Response.json({
      data: [
        { id: 'anthropic/claude-opus-5', pricing: { prompt: '1' } },
        { id: OPENROUTER_MODEL, pricing },
      ],
    });

  it("turns OpenRouter's dollars per token into dollars per million tokens", async () => {
    const fetch = fetcher(
      models({
        prompt: '0.0000001',
        completion: '0.0000005',
        input_cache_write: '0.000000125',
        input_cache_read: '0.00000001',
      }),
    );
    expect(await fetch()).toEqual({ ok: true, price: { input: 0.1, output: 0.5, cacheWrite: 0.125, cacheRead: 0.01 } });
  });

  it('says so when the model or one of its prices is missing, or OpenRouter does not answer', async () => {
    expect(await fetcher(models({ prompt: '0.0000001', completion: '0.0000005' }))()).toEqual({
      ok: false,
      reason: 'missing',
    });
    expect(await fetcher(() => Response.json({ data: [] }))()).toEqual({ ok: false, reason: 'missing' });
    expect(await fetcher(() => new Response('', { status: 503 }))()).toEqual({ ok: false, reason: 'unreachable' });
  });
});
