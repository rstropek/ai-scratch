'use server';

import { redirect } from 'next/navigation';
import {
  addFederation,
  addKey,
  deleteKey,
  type FederationInput,
  type KeyCheck,
  type KeyField,
  type KeyInput,
  type SaveResult,
  updateFederation,
  updateKey,
} from '../../../lib/anthropic-keys.ts';
import { keyDeps } from '../../../lib/deps.ts';
import { echo, type FormBanner, type FormState } from '../../../lib/form-state.ts';
import { getDb } from '../../../lib/services.ts';
import { requireAdmin } from '../../../lib/session.ts';
import { texts } from '../../../lib/texts.ts';

/** what the list reports after a change (?saved=…) */
export type SavedOutcome = 'added' | 'updated' | 'deleted';

export type KeyFormState = FormState<KeyField>;

const k = texts.admin.keys;

const text = (form: FormData, name: string) => String(form.get(name) ?? '');

const keyInputOf = (form: FormData): KeyInput => ({
  donor: text(form, 'donor'),
  key: text(form, 'key'),
  workspaceId: text(form, 'workspaceId'),
  capMonth: text(form, 'capMonth'),
  priority: text(form, 'priority'),
  active: form.get('active') === 'on',
});

const federationInputOf = (form: FormData): FederationInput => ({
  donor: text(form, 'donor'),
  organizationId: text(form, 'organizationId'),
  federationRuleId: text(form, 'federationRuleId'),
  serviceAccountId: text(form, 'serviceAccountId'),
  workspaceId: text(form, 'workspaceId'),
  capMonth: text(form, 'capMonth'),
  priority: text(form, 'priority'),
  active: form.get('active') === 'on',
});

const checkBanner = (check: Exclude<KeyCheck, { ok: true }>): FormBanner => {
  const { reason } = check;
  if (reason === 'invalid' || reason === 'unreachable' || reason === 'identity') return k.check[reason];
  return { title: k.check[reason].title, text: k.check[reason].text(check.message) };
};

/** Runs a save and answers the form: back to the list, or the errors with what was sent (never a key). */
async function answer(
  id: string | undefined,
  values: Record<string, string | string[]>,
  save: () => Promise<SaveResult>,
): Promise<KeyFormState> {
  let result: SaveResult;
  try {
    result = await save();
  } catch (error) {
    console.error('keys: saving failed', error);
    return { values, banner: k.error };
  }
  if (result.ok) {
    const outcome: SavedOutcome = id ? 'updated' : 'added';
    redirect(`/admin/keys?saved=${outcome}`);
  }
  if ('notFound' in result) redirect('/admin/keys');
  if ('fieldErrors' in result) return { values, fieldErrors: result.fieldErrors };
  return { values, banner: checkBanner(result.check) };
}

const activeValue = (form: FormData) => ({ active: String(form.get('active') === 'on') });

/** Adds a key (`id` undefined) or saves the changes to one. The key itself never goes back to the browser. */
export async function saveKey(id: string | undefined, _previous: KeyFormState, form: FormData): Promise<KeyFormState> {
  // every action checks the role itself: the page's check doesn't protect the endpoint
  const { session, allowed } = await requireAdmin();
  if (!allowed) return { banner: { title: texts.admin.forbiddenTitle } };
  const values = { ...echo(form, 'donor', 'workspaceId', 'capMonth', 'priority'), ...activeValue(form) };
  const input = keyInputOf(form);
  return answer(id, values, () =>
    id ? updateKey(keyDeps(), session.user.id, id, input) : addKey(keyDeps(), session.user.id, input),
  );
}

/** Adds a federation (`id` undefined) or saves the changes to one. */
export async function saveFederation(
  id: string | undefined,
  _previous: KeyFormState,
  form: FormData,
): Promise<KeyFormState> {
  const { session, allowed } = await requireAdmin();
  if (!allowed) return { banner: { title: texts.admin.forbiddenTitle } };
  const values = {
    ...echo(
      form,
      'donor',
      'organizationId',
      'federationRuleId',
      'serviceAccountId',
      'workspaceId',
      'capMonth',
      'priority',
    ),
    ...activeValue(form),
  };
  const input = federationInputOf(form);
  return answer(id, values, () =>
    id ? updateFederation(keyDeps(), session.user.id, id, input) : addFederation(keyDeps(), session.user.id, input),
  );
}

export async function removeKey(id: string, _previous: KeyFormState): Promise<KeyFormState> {
  const { allowed } = await requireAdmin();
  if (!allowed) return { banner: { title: texts.admin.forbiddenTitle } };
  let deleted: boolean;
  try {
    deleted = await deleteKey(getDb(), id);
  } catch (error) {
    console.error('keys: deleting failed', error);
    return { banner: k.deleteFailed };
  }
  // gone already (another tab): the list shows it, without claiming this delete
  redirect(deleted ? '/admin/keys?saved=deleted' : '/admin/keys');
}
