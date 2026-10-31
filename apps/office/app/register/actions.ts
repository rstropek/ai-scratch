'use server';

import { headers } from 'next/headers';
import { clientIp } from '../../lib/client-ip.ts';
import { registrationDeps } from '../../lib/deps.ts';
import { echo, type FormState } from '../../lib/form-state.ts';
import { type RegistrationField, startRegistration } from '../../lib/registration.ts';
import { texts } from '../../lib/texts.ts';
import { TURNSTILE_FIELD } from '../../lib/turnstile.ts';

export type RegisterState = FormState<RegistrationField> & { sent?: string };

export async function register(previous: RegisterState, form: FormData): Promise<RegisterState> {
  const attempt = (previous.attempt ?? 0) + 1;
  const values = echo(form, 'email', 'kind', 'freeBudget', 'adult', 'terms', 'aiConsent');
  const ip = clientIp(await headers());
  try {
    const result = await startRegistration(registrationDeps(), {
      email: String(form.get('email') ?? ''),
      kind: String(form.get('kind') ?? ''),
      adult: form.get('adult') === 'on',
      terms: form.get('terms') === 'on',
      aiConsent: form.get('aiConsent') === 'on',
      freeBudget: form.get('freeBudget') === 'on',
      turnstileToken: String(form.get(TURNSTILE_FIELD) ?? ''),
      ip,
    });
    if (result.ok) return { sent: result.email };
    if ('limited' in result)
      return {
        attempt,
        values,
        banner: result.limited === 'ip' ? texts.register.tooManyIp : texts.register.tooManyEmail,
      };
    return { attempt, values, fieldErrors: result.fieldErrors };
  } catch (error) {
    console.error('register: failed', error);
    return { attempt, values, banner: texts.register.error };
  }
}
