import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AppShell } from '../../components/app-shell.tsx';
import { Panel } from '../../components/ui/panel.tsx';
import { terms } from '../../content/terms.tsx';
import { termsOutdated } from '../../lib/registration.ts';
import { isAdmin } from '../../lib/roles.ts';
import { getDb } from '../../lib/services.ts';
import { requireSession } from '../../lib/session.ts';
import { CONTACT_EMAIL } from '../../lib/site.ts';
import { texts } from '../../lib/texts.ts';
import { ConsentForm } from './consent-form.tsx';

export const metadata: Metadata = { title: texts.consent.title };

const t = texts.consent;

/** Where every page sends an account that accepted an older version of the terms. */
export default async function ConsentPage() {
  const { user } = await requireSession({ outdatedTerms: 'allow' });
  if (!(await termsOutdated(getDb(), user.id))) redirect('/');
  return (
    <AppShell userName={user.name} admin={isAdmin(user)}>
      <Panel className="grid max-w-2xl gap-5">
        <h1 className="font-bold text-2xl">{t.title}</h1>
        <p>{t.intro(terms.date)}</p>
        <ConsentForm />
        <p className="text-muted text-xs">{t.decline(CONTACT_EMAIL)}</p>
      </Panel>
    </AppShell>
  );
}
