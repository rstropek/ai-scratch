import { entrySpend, loadPrice, viennaMonth } from '@ai-scratch/db';
import type { Metadata } from 'next';
import Link from 'next/link';
import { NotAdmin } from '../../../components/admin-gate.tsx';
import { AppShell } from '../../../components/app-shell.tsx';
import { Banner } from '../../../components/ui/banner.tsx';
import { buttonClass } from '../../../components/ui/button.tsx';
import { Chip } from '../../../components/ui/chip.tsx';
import { PageHeader } from '../../../components/ui/page-header.tsx';
import { Panel } from '../../../components/ui/panel.tsx';
import { Cell, Table, TableFooter } from '../../../components/ui/table.tsx';
import { entryHint, listKeys } from '../../../lib/anthropic-keys.ts';
import { getDb } from '../../../lib/services.ts';
import { requireAdmin } from '../../../lib/session.ts';
import { texts } from '../../../lib/texts.ts';
import type { SavedOutcome } from './actions.ts';

export const metadata: Metadata = { title: texts.admin.keys.title };

const k = texts.admin.keys;

export default async function KeysPage({ searchParams }: PageProps<'/admin/keys'>) {
  const { session, allowed } = await requireAdmin();
  const { user } = session;
  if (!allowed)
    return (
      <AppShell userName={user.name}>
        <NotAdmin name={user.name} />
      </AppShell>
    );
  const { saved } = await searchParams;
  const banner =
    typeof saved === 'string' && Object.hasOwn(k.saved, saved) ? k.saved[saved as SavedOutcome] : undefined;
  const db = getDb();
  // this month's spend per entry, from the same sums the kids' app checks against each cap
  const [keys, spend] = await Promise.all([
    listKeys(db),
    loadPrice(db).then((price) => entrySpend(db, price, viennaMonth(new Date()))),
  ]);
  return (
    <AppShell userName={user.name} admin>
      <PageHeader
        title={k.title}
        description={k.description}
        actions={
          <>
            <Link href="/admin/keys/new/federation" className={buttonClass('secondary')}>
              {k.addFederation}
            </Link>
            <Link href="/admin/keys/new" className={buttonClass('primary')}>
              {k.add}
            </Link>
          </>
        }
      />
      {banner && <Banner tone="success">{banner}</Banner>}
      <Panel padded={false}>
        {keys.length === 0 ? (
          <p className="px-4 py-10 text-center text-muted text-sm">{k.empty}</p>
        ) : (
          <>
            <Table
              columns={[
                { label: k.columns.donor },
                { label: k.columns.key },
                { label: k.columns.workspace },
                { label: k.columns.spent },
                { label: k.columns.priority },
                { label: k.columns.status },
                { label: k.columns.action, hidden: true },
              ]}
            >
              {keys.map((key) => (
                <tr key={key.id}>
                  <Cell sub={k.changed(key.updatedAt)}>{key.donor}</Cell>
                  {key.kind === 'federation' ? (
                    <Cell sub={<span className="font-mono">{entryHint(key)}</span>}>{k.federation}</Cell>
                  ) : (
                    <Cell>
                      <span className="font-mono">{entryHint(key)}</span>
                    </Cell>
                  )}
                  <Cell>
                    <span className="font-mono">{key.workspaceId ?? k.noWorkspace}</span>
                  </Cell>
                  <Cell sub={k.columns.cap}>
                    <span className="whitespace-nowrap">{k.monthSpend(spend.get(key.id) ?? 0, key.capMonth)}</span>
                  </Cell>
                  <Cell>{key.priority}</Cell>
                  <Cell sub={key.refusedAt ? k.refusedAt(key.refusedAt, key.refusedReason) : undefined}>
                    <span className="flex flex-wrap gap-1">
                      <Chip tone={key.active ? 'success' : 'neutral'}>{key.active ? k.active : k.paused}</Chip>
                      {key.refusedAt && <Chip tone="error">{k.refused}</Chip>}
                    </span>
                  </Cell>
                  <Cell action>
                    <Link href={`/admin/keys/${key.id}`} className={buttonClass('secondary', 'sm')}>
                      {k.edit}
                      <span className="sr-only">
                        : {key.donor} {entryHint(key)}
                      </span>
                    </Link>
                  </Cell>
                </tr>
              ))}
            </Table>
            <TableFooter>{k.footer(keys.length)}</TableFooter>
          </>
        )}
      </Panel>
    </AppShell>
  );
}
