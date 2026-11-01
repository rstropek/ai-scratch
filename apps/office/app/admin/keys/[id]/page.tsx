import { KeyRound } from 'lucide-react';
import type { Metadata } from 'next';
import { NotAdmin } from '../../../../components/admin-gate.tsx';
import { AppShell } from '../../../../components/app-shell.tsx';
import { Banner } from '../../../../components/ui/banner.tsx';
import { PageHeader } from '../../../../components/ui/page-header.tsx';
import { Panel } from '../../../../components/ui/panel.tsx';
import { StatePanel } from '../../../../components/ui/state-panel.tsx';
import { entryHint, getKey } from '../../../../lib/anthropic-keys.ts';
import { getDb } from '../../../../lib/services.ts';
import { requireAdmin } from '../../../../lib/session.ts';
import { texts } from '../../../../lib/texts.ts';
import { BackLink } from '../back-link.tsx';
import { DeleteForm } from '../delete-form.tsx';
import { FederationForm } from '../federation-form.tsx';
import { KeyForm } from '../key-form.tsx';

export const metadata: Metadata = { title: texts.admin.keys.title };

const k = texts.admin.keys;

export default async function KeyPage({ params }: PageProps<'/admin/keys/[id]'>) {
  const { session, allowed } = await requireAdmin();
  const { user } = session;
  if (!allowed)
    return (
      <AppShell userName={user.name}>
        <NotAdmin name={user.name} />
      </AppShell>
    );
  const { id } = await params;
  const key = await getKey(getDb(), id);
  if (!key)
    return (
      <AppShell userName={user.name} admin>
        <StatePanel icon={KeyRound} title={k.notFound} actions={<BackLink />} />
      </AppShell>
    );
  return (
    <AppShell userName={user.name} admin>
      <div>
        <BackLink />
      </div>
      <PageHeader
        title={key.donor}
        description={`${key.kind === 'federation' ? `${k.federation} ` : ''}${entryHint(key)} · ${k.changed(key.updatedAt)}`}
      />
      <div className="grid max-w-2xl gap-5">
        {key.refusedAt && (
          <Banner tone="warning" announce={false} title={k.refused}>
            {k.refusedAt(key.refusedAt, key.refusedReason)}
          </Banner>
        )}
        {key.kind === 'federation' ? <FederationForm stored={key} /> : <KeyForm stored={key} />}
        <Panel className="grid gap-3">
          <h2 className="font-bold text-lg">{k.delete}</h2>
          <DeleteForm
            id={key.id}
            text={
              key.kind === 'federation'
                ? k.deleteFederationText(key.donor, entryHint(key))
                : k.deleteText(key.donor, entryHint(key))
            }
          />
        </Panel>
      </div>
    </AppShell>
  );
}
