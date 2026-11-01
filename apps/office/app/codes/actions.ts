'use server';

import { generateCode } from '@ai-scratch/db';
import { OWN_KEY_MAX_REMAINING_USD } from '@ai-scratch/db/limits';
import { redirect } from 'next/navigation';
import {
  type CodeField,
  type CodeOwner,
  type CodeRefusal,
  type CreateCodeResult,
  createCode,
  deleteCode,
} from '../../lib/codes.ts';
import { codeDeps } from '../../lib/deps.ts';
import { echo, type FormBanner, type FormState } from '../../lib/form-state.ts';
import { isAdmin } from '../../lib/roles.ts';
import { getDb } from '../../lib/services.ts';
import { requireSession } from '../../lib/session.ts';
import { texts } from '../../lib/texts.ts';

export type CodeFormState = FormState<CodeField>;

const c = texts.codes;

const ownerOf = async (): Promise<CodeOwner> => {
  const { user } = await requireSession();
  return { id: user.id, admin: isAdmin(user) };
};

/** "Neuer Vorschlag": another generated code for the form */
export async function proposeCode(): Promise<string> {
  await requireSession();
  return generateCode();
}

const refusalBanner = (refusal: CodeRefusal): FormBanner => {
  const r = c.refusals;
  switch (refusal.reason) {
    case 'free-codes-used':
      return { title: r[refusal.reason].title, text: r[refusal.reason].text(refusal.limit) };
    case 'key-no-limit':
      return { title: r[refusal.reason].title, text: r[refusal.reason].text(OWN_KEY_MAX_REMAINING_USD) };
    case 'key-too-much':
      return {
        title: r[refusal.reason].title,
        text: r[refusal.reason].text(refusal.remaining, OWN_KEY_MAX_REMAINING_USD),
      };
    default:
      return r[refusal.reason];
  }
};

export async function saveCode(_previous: CodeFormState, form: FormData): Promise<CodeFormState> {
  const owner = await ownerOf();
  const values = {
    ...echo(form, 'code', 'source', 'startsAt', 'hours', 'comment'),
    askEnabled: String(form.get('askEnabled') === 'on'),
  };
  const text = (name: string) => String(form.get(name) ?? '');
  let result: CreateCodeResult;
  try {
    result = await createCode(codeDeps(), owner, {
      code: text('code'),
      source: text('source'),
      startsAt: text('startsAt'),
      hours: text('hours'),
      comment: text('comment'),
      askEnabled: form.get('askEnabled') === 'on',
    });
  } catch (error) {
    console.error('codes: creating failed', error);
    return { values, banner: c.error };
  }
  if (result.ok) redirect(`/?created=${result.code}`);
  if ('fieldErrors' in result) return { values, fieldErrors: result.fieldErrors };
  const { refusal } = result;
  return {
    values: refusal.reason === 'taken' ? { ...values, code: refusal.proposal } : values,
    banner: refusalBanner(refusal),
  };
}

/** where a delete returns to: the adult's start page or the admin's list */
export type CodeListPage = 'home' | 'admin';

export async function removeCode(id: string, back: CodeListPage, _previous: CodeFormState): Promise<CodeFormState> {
  const owner = await ownerOf();
  let deleted: boolean;
  try {
    deleted = await deleteCode(getDb(), owner, id);
  } catch (error) {
    console.error('codes: deleting failed', error);
    return { banner: c.deleteFailed };
  }
  const page = back === 'admin' && owner.admin ? '/admin/codes' : '/';
  // gone already (another tab): the list shows it, without claiming this delete
  redirect(deleted ? `${page}?deleted=1` : page);
}
