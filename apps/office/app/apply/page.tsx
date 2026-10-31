import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AppShell } from '../../components/app-shell.tsx';
import { FormPage } from '../../components/form-page.tsx';
import { applicantState, canApply } from '../../lib/applications.ts';
import { isAdmin } from '../../lib/roles.ts';
import { getDb } from '../../lib/services.ts';
import { requireSession } from '../../lib/session.ts';
import { texts } from '../../lib/texts.ts';
import { ApplyForm } from './apply-form.tsx';

export const metadata: Metadata = { title: texts.apply.title };

export default async function ApplyPage() {
  const { user } = await requireSession();
  if (!canApply(await applicantState(getDb(), user.id))) redirect('/');
  const t = texts.apply;
  return (
    <AppShell userName={user.name} admin={isAdmin(user)}>
      <FormPage title={t.title} intro={t.intro} steps={t.steps} note={t.meanwhile}>
        <ApplyForm />
      </FormPage>
    </AppShell>
  );
}
