'use server';

import { redirect } from 'next/navigation';
import { echo, type FormState } from '../../lib/form-state.ts';
import { type ConsentField, renewConsent } from '../../lib/registration.ts';
import { getDb } from '../../lib/services.ts';
import { requireSession } from '../../lib/session.ts';
import { texts } from '../../lib/texts.ts';

export type ConsentState = FormState<ConsentField>;

export async function consent(_previous: ConsentState, form: FormData): Promise<ConsentState> {
  const { user } = await requireSession({ outdatedTerms: 'allow' });
  const values = echo(form, 'terms', 'aiConsent');
  try {
    const result = await renewConsent(getDb(), user.id, {
      terms: form.get('terms') === 'on',
      aiConsent: form.get('aiConsent') === 'on',
    });
    if (!result.ok) return { values, fieldErrors: result.fieldErrors };
  } catch (error) {
    console.error('consent: saving failed', error);
    return { values, banner: { title: texts.consent.error } };
  }
  redirect('/');
}
