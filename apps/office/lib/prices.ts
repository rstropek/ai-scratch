// The model's price (only Claude Haiku for now), dollars per million tokens: the admin maintains it, every sum of
// spend is tokens × this price (docs/budgets.md). "Von OpenRouter holen" fills the form from OpenRouter's public model
// list; the admin checks the numbers and saves. The kids' app picks a saved price up within a minute.
import { type Database, type Price, schema } from '@ai-scratch/db';
import { eq } from 'drizzle-orm';
import type { FieldErrors } from './registration.ts';
import { texts } from './texts.ts';

const { modelPrice, user } = schema;

export type PriceField = keyof Price;
export const PRICE_FIELDS: readonly PriceField[] = ['input', 'output', 'cacheWrite', 'cacheRead'];

export type PriceInput = Record<PriceField, string>;

/** a typo guard: Haiku costs cents to a few dollars per million tokens */
const PRICE_MAX = 1000;

/** a decimal number, with a comma or a point */
const parsePrice = (raw: string): number | undefined => {
  const trimmed = raw.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return undefined;
  const value = Number(trimmed);
  return value > 0 && value <= PRICE_MAX ? value : undefined;
};

export const validatePrice = (
  input: PriceInput,
): { ok: true; value: Price } | { ok: false; fieldErrors: FieldErrors<PriceField> } => {
  const fieldErrors: FieldErrors<PriceField> = {};
  const value: Partial<Price> = {};
  for (const field of PRICE_FIELDS) {
    const parsed = parsePrice(input[field]);
    if (parsed === undefined) fieldErrors[field] = texts.admin.prices.validation(PRICE_MAX);
    else value[field] = parsed;
  }
  return Object.keys(fieldErrors).length > 0 ? { ok: false, fieldErrors } : { ok: true, value: value as Price };
};

export interface StoredPrice extends Price {
  updatedAt: Date;
  /** the admin who saved it; null for the migration's starting price */
  updatedBy: string | null;
}

/** the migration creates the row, so it is always there */
export const getPrice = async (db: Database): Promise<StoredPrice> => {
  const [row] = await db
    .select({
      input: modelPrice.input,
      output: modelPrice.output,
      cacheWrite: modelPrice.cacheWrite,
      cacheRead: modelPrice.cacheRead,
      updatedAt: modelPrice.updatedAt,
      updatedBy: user.name,
    })
    .from(modelPrice)
    .leftJoin(user, eq(user.id, modelPrice.updatedBy))
    .where(eq(modelPrice.id, 1));
  if (!row) throw new Error('model_price has no row: run the migrations');
  return row;
};

export const savePrice = async (
  db: Database,
  adminId: string,
  input: PriceInput,
): Promise<{ ok: true } | { ok: false; fieldErrors: FieldErrors<PriceField> }> => {
  const valid = validatePrice(input);
  if (!valid.ok) return valid;
  await db
    .update(modelPrice)
    .set({ ...valid.value, updatedAt: new Date(), updatedBy: adminId })
    .where(eq(modelPrice.id, 1));
  return { ok: true };
};

/** the model the kids' app calls, as OpenRouter names it */
export const OPENROUTER_MODEL = 'anthropic/claude-haiku-5.5';

export type PriceFetch = { ok: true; price: Price } | { ok: false; reason: 'unreachable' | 'missing' };
export type PriceFetcher = () => Promise<PriceFetch>;

/** OpenRouter's prices are dollars per token, as strings: dollars per million, without float noise (0.09999…) */
const perMillion = (perToken: unknown): number | undefined => {
  const value = Number(perToken) * 1e6;
  return typeof perToken === 'string' && Number.isFinite(value) && value > 0
    ? Number(value.toPrecision(12))
    : undefined;
};

/** `GET {baseURL}/models` (public, no key); `missing`: the model or one of its four prices isn't in the list */
export const createOpenRouterPriceFetcher =
  ({ baseURL, fetch = globalThis.fetch }: { baseURL: string; fetch?: typeof globalThis.fetch }): PriceFetcher =>
  async () => {
    let models: { id?: string; pricing?: Record<string, unknown> }[];
    try {
      const res = await fetch(`${baseURL}/models`, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) return { ok: false, reason: 'unreachable' };
      models = ((await res.json()) as { data?: typeof models }).data ?? [];
    } catch {
      return { ok: false, reason: 'unreachable' };
    }
    const pricing = models.find((model) => model.id === OPENROUTER_MODEL)?.pricing ?? {};
    const price = {
      input: perMillion(pricing.prompt),
      output: perMillion(pricing.completion),
      cacheWrite: perMillion(pricing.input_cache_write),
      cacheRead: perMillion(pricing.input_cache_read),
    };
    if (Object.values(price).some((value) => value === undefined)) return { ok: false, reason: 'missing' };
    return { ok: true, price: price as Price };
  };
