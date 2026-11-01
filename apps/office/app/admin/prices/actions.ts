'use server';

import { redirect } from 'next/navigation';
import { echo, type FormState } from '../../../lib/form-state.ts';
import { PRICE_FIELDS, type PriceField, savePrice } from '../../../lib/prices.ts';
import { getDb, getPriceFetcher } from '../../../lib/services.ts';
import { requireAdmin } from '../../../lib/session.ts';
import { texts } from '../../../lib/texts.ts';

export type PriceFormState = FormState<PriceField> & { fetched?: boolean };

const p = texts.admin.prices;

/** "Speichern" stores the four prices; "Von OpenRouter holen" (intent=fetch) only fills the form for a check. */
export async function priceAction(_previous: PriceFormState, form: FormData): Promise<PriceFormState> {
  const { session, allowed } = await requireAdmin();
  if (!allowed) return { banner: { title: texts.admin.forbiddenTitle } };
  const values = echo(form, ...PRICE_FIELDS);
  if (form.get('intent') === 'fetch') {
    const fetched = await getPriceFetcher()();
    if (!fetched.ok) return { values, banner: p.fetchFailed[fetched.reason] };
    const { price } = fetched;
    return {
      values: Object.fromEntries(PRICE_FIELDS.map((field) => [field, String(price[field])])),
      fetched: true,
    };
  }
  const input = Object.fromEntries(PRICE_FIELDS.map((field) => [field, String(form.get(field) ?? '')])) as Record<
    PriceField,
    string
  >;
  let result: Awaited<ReturnType<typeof savePrice>>;
  try {
    result = await savePrice(getDb(), session.user.id, input);
  } catch (error) {
    console.error('prices: saving failed', error);
    return { values, banner: p.error };
  }
  if (!result.ok) return { values, fieldErrors: result.fieldErrors };
  redirect('/admin/prices?saved=1');
}
