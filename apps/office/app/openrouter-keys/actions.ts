'use server';

import { redirect } from 'next/navigation';
import { openRouterDeps } from '../../lib/deps.ts';
import { echo, type FormState } from '../../lib/form-state.ts';
import {
  type AddKeyResult,
  addOpenRouterKey,
  deleteOpenRouterKey,
  type OpenRouterKeyField,
} from '../../lib/openrouter-keys.ts';
import { getDb } from '../../lib/services.ts';
import { requireSession } from '../../lib/session.ts';
import { texts } from '../../lib/texts.ts';

export type OpenRouterKeyFormState = FormState<OpenRouterKeyField>;

const o = texts.openrouterKeys;

/** Adds an own key after OpenRouter confirmed it knows it; the key itself never goes back to the browser. */
export async function addKey(_previous: OpenRouterKeyFormState, form: FormData): Promise<OpenRouterKeyFormState> {
  const { user } = await requireSession();
  const values = echo(form, 'label');
  let result: AddKeyResult;
  try {
    result = await addOpenRouterKey(openRouterDeps(), user.id, {
      label: String(form.get('label') ?? ''),
      key: String(form.get('key') ?? ''),
    });
  } catch (error) {
    console.error('openrouter keys: adding failed', error);
    return { values, banner: o.error };
  }
  if (result.ok) redirect('/openrouter-keys?saved=added');
  if ('fieldErrors' in result) return { values, fieldErrors: result.fieldErrors };
  return { values, banner: o.check[result.check] };
}

export async function removeKey(id: string, _previous: OpenRouterKeyFormState): Promise<OpenRouterKeyFormState> {
  const { user } = await requireSession();
  let deleted: boolean;
  try {
    deleted = await deleteOpenRouterKey(getDb(), user.id, id);
  } catch (error) {
    console.error('openrouter keys: deleting failed', error);
    return { banner: o.deleteFailed };
  }
  redirect(deleted ? '/openrouter-keys?saved=deleted' : '/openrouter-keys');
}
