'use server';

import { redirect } from 'next/navigation';
import { decideApplication } from '../../../../lib/applications.ts';
import { applicationDeps } from '../../../../lib/deps.ts';
import { requireAdmin } from '../../../../lib/session.ts';
import { texts } from '../../../../lib/texts.ts';

/** what the account page reports after a decision (?decided=…): the form itself is gone by then */
export type DecidedOutcome = 'accepted' | 'rejected' | 'stale' | 'unmailed';

export interface DecideState {
  error?: string;
}

export async function decide(
  userId: string,
  applicationId: string,
  _previous: DecideState,
  form: FormData,
): Promise<DecideState> {
  // every action checks the role itself: the page's check doesn't protect the endpoint
  const { session, allowed } = await requireAdmin();
  if (!allowed) return { error: texts.admin.forbiddenTitle };
  const decision = form.get('decision');
  if (decision !== 'accepted' && decision !== 'rejected') return {};
  let outcome: DecidedOutcome;
  try {
    const result = await decideApplication(
      applicationDeps(),
      session.user.id,
      applicationId,
      decision,
      String(form.get('note') ?? ''),
    );
    outcome = result.result === 'stale' ? 'stale' : result.mailed ? decision : 'unmailed';
  } catch (error) {
    console.error('admin: deciding failed', error);
    return { error: texts.admin.account.decideFailed };
  }
  redirect(`/admin/accounts/${userId}?decided=${outcome}`);
}
