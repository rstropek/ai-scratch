'use server';

import { redirect } from 'next/navigation';
import { type ApplicationField, submitApplication } from '../../lib/applications.ts';
import { applicationDeps } from '../../lib/deps.ts';
import { echo, type FormState } from '../../lib/form-state.ts';
import type { RefusalReason } from '../../lib/jev.ts';
import { requireSession } from '../../lib/session.ts';
import { texts } from '../../lib/texts.ts';

export type ApplyState = FormState<ApplicationField> & { refused?: RefusalReason[] };

export async function apply(_previous: ApplyState, form: FormData): Promise<ApplyState> {
  const { user } = await requireSession();
  const values = echo(form, 'schoolName', 'schoolUrl', 'grades', 'summary');
  let result: Awaited<ReturnType<typeof submitApplication>>;
  try {
    result = await submitApplication(applicationDeps(), user, {
      schoolName: String(form.get('schoolName') ?? ''),
      schoolUrl: String(form.get('schoolUrl') ?? ''),
      grades: form.getAll('grades').map(String),
      summary: String(form.get('summary') ?? ''),
    });
  } catch (error) {
    console.error('apply: failed', error);
    return { values, banner: texts.apply.error };
  }
  if (result.ok) redirect('/?sent=1');
  // a second tab sent one already, or the account may not apply: the start page shows where it stands
  if ('notAllowed' in result) redirect('/');
  if ('refused' in result) return { values, refused: result.refused };
  return { values, fieldErrors: result.fieldErrors };
}
