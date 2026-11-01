import type { Metadata } from 'next';
import { NotAdmin } from '../../../../../components/admin-gate.tsx';
import { AppShell } from '../../../../../components/app-shell.tsx';
import { PageHeader } from '../../../../../components/ui/page-header.tsx';
import { requireAdmin } from '../../../../../lib/session.ts';
import { texts } from '../../../../../lib/texts.ts';
import { BackLink } from '../../back-link.tsx';
import { FederationForm } from '../../federation-form.tsx';

export const metadata: Metadata = { title: texts.admin.keys.addFederationTitle };

export default async function NewFederationPage() {
  const { session, allowed } = await requireAdmin();
  const { user } = session;
  if (!allowed)
    return (
      <AppShell userName={user.name}>
        <NotAdmin name={user.name} />
      </AppShell>
    );
  return (
    <AppShell userName={user.name} admin>
      <div>
        <BackLink />
      </div>
      <PageHeader title={texts.admin.keys.addFederationTitle} />
      <div className="max-w-2xl">
        <FederationForm />
      </div>
    </AppShell>
  );
}
