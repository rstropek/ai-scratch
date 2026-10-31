'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { registrationDeps } from '../../../lib/deps.ts';
import { echo, type FormState } from '../../../lib/form-state.ts';
import { type AccountField, completeRegistration } from '../../../lib/registration.ts';
import { getAuth } from '../../../lib/session.ts';
import { texts } from '../../../lib/texts.ts';

export type ConfirmState = FormState<AccountField> & { link?: 'invalid' | 'expired' | 'exists' };

export async function createAccount(token: string, _previous: ConfirmState, form: FormData): Promise<ConfirmState> {
  const values = echo(form, 'firstName', 'lastName');
  const password = String(form.get('password') ?? '');
  let result: Awaited<ReturnType<typeof completeRegistration>>;
  try {
    result = await completeRegistration(registrationDeps(), token, {
      firstName: String(form.get('firstName') ?? ''),
      lastName: String(form.get('lastName') ?? ''),
      password,
      passwordRepeat: String(form.get('passwordRepeat') ?? ''),
    });
  } catch (error) {
    console.error('register: creating the account failed', error);
    return { values, banner: texts.confirm.error };
  }
  if (!result.ok) return 'link' in result ? { link: result.link } : { values, fieldErrors: result.fieldErrors };
  // signs the new account in: nextCookies() in auth.ts sets the session cookie on this response
  await getAuth().api.signInEmail({ body: { email: result.email, password }, headers: await headers() });
  redirect(result.kind === 'teacher' ? '/apply' : '/');
}
