import { displayCode } from '@ai-scratch/db';
import { OWN_KEY_MAX_REMAINING_USD } from '@ai-scratch/db/limits';
import type { Metadata } from 'next';
import { AppShell } from '../../components/app-shell.tsx';
import { Banner } from '../../components/ui/banner.tsx';
import { PageHeader } from '../../components/ui/page-header.tsx';
import { Panel } from '../../components/ui/panel.tsx';
import { Section } from '../../components/ui/section.tsx';
import { Cell, Table } from '../../components/ui/table.tsx';
import { openRouterDeps } from '../../lib/deps.ts';
import { listOpenRouterKeys, readRemaining, remainingText } from '../../lib/openrouter-keys.ts';
import { isAdmin } from '../../lib/roles.ts';
import { requireSession } from '../../lib/session.ts';
import { texts } from '../../lib/texts.ts';
import { AddKeyForm } from './add-key-form.tsx';
import { DeleteKeyForm } from './delete-key-form.tsx';

export const metadata: Metadata = { title: texts.openrouterKeys.title };

const o = texts.openrouterKeys;

export default async function OpenRouterKeysPage({ searchParams }: PageProps<'/openrouter-keys'>) {
  const { user } = await requireSession();
  const { saved } = await searchParams;
  const deps = openRouterDeps();
  const keys = await listOpenRouterKeys(deps.db, user.id);
  // OpenRouter's current answer for every key, while the page loads (each gives up after 3 s)
  const remaining = await readRemaining(deps, user.id, keys);
  return (
    <AppShell userName={user.name} admin={isAdmin(user)}>
      <PageHeader title={o.title} description={o.description(OWN_KEY_MAX_REMAINING_USD)} />
      {saved === 'added' && <Banner tone="success">{o.added}</Banner>}
      {saved === 'deleted' && <Banner tone="success">{o.deleted}</Banner>}
      <Section title={o.listTitle}>
        <Panel padded={false}>
          {keys.length === 0 ? (
            <p className="px-4 py-10 text-center text-muted text-sm">{o.empty}</p>
          ) : (
            <Table
              columns={[
                { label: o.columns.label },
                { label: o.columns.remaining },
                { label: o.columns.codes },
                { label: o.columns.added },
                { label: o.columns.action, hidden: true },
              ]}
            >
              {keys.map((key) => {
                const codes = key.codes.map(displayCode);
                return (
                  <tr key={key.id}>
                    <Cell sub={<span className="font-mono">{key.keyHint}</span>}>{key.label}</Cell>
                    <Cell>{remainingText(remaining.get(key.id))}</Cell>
                    <Cell sub={codes.join(', ') || undefined}>{o.codeCount(codes.length)}</Cell>
                    <Cell>{texts.format.date(key.createdAt)}</Cell>
                    <Cell action>
                      <DeleteKeyForm id={key.id} name={o.deleteText(key.label, key.keyHint)} codes={codes} />
                    </Cell>
                  </tr>
                );
              })}
            </Table>
          )}
        </Panel>
      </Section>
      <Section title={o.addTitle}>
        <Panel className="max-w-2xl">
          <AddKeyForm />
        </Panel>
      </Section>
    </AppShell>
  );
}
