import type { Metadata } from 'next';
import { NotAdmin } from '../../../components/admin-gate.tsx';
import { AppShell } from '../../../components/app-shell.tsx';
import { CodesTable } from '../../../components/codes-table.tsx';
import { Banner } from '../../../components/ui/banner.tsx';
import { FilterTabs } from '../../../components/ui/filter-tabs.tsx';
import { PageHeader } from '../../../components/ui/page-header.tsx';
import { Panel } from '../../../components/ui/panel.tsx';
import { CODE_STATES, type CodeState, countCodes, listCodes } from '../../../lib/codes.ts';
import { getDb, getServicesEnv } from '../../../lib/services.ts';
import { requireAdmin } from '../../../lib/session.ts';
import { texts } from '../../../lib/texts.ts';

export const metadata: Metadata = { title: texts.admin.codes.title };

const t = texts.admin.codes;

export default async function AdminCodesPage({ searchParams }: PageProps<'/admin/codes'>) {
  const { session, allowed } = await requireAdmin();
  const { user } = session;
  if (!allowed)
    return (
      <AppShell userName={user.name}>
        <NotAdmin name={user.name} />
      </AppShell>
    );
  const params = await searchParams;
  const filter: CodeState = CODE_STATES.find((state) => state === params.filter) ?? 'running';
  const now = new Date();
  const db = getDb();
  const [rows, counts] = await Promise.all([listCodes(db, { state: filter, now }), countCodes(db, now)]);
  return (
    <AppShell userName={user.name} admin>
      <PageHeader title={t.title} description={t.description} />
      {params.deleted === '1' && <Banner tone="success">{texts.home.codeDeleted}</Banner>}
      <Panel padded={false}>
        <div className="border-divider border-b px-4 py-3">
          <FilterTabs
            label={t.filterLabel}
            tabs={CODE_STATES.map((state) => ({
              href: `/admin/codes?filter=${state}`,
              label: t.filters[state],
              count: counts[state],
              current: state === filter,
            }))}
          />
        </div>
        {rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-muted text-sm">{t.empty}</p>
        ) : (
          <CodesTable rows={rows} codeBudgetUsd={getServicesEnv().limits.codeBudgetUsd} back="admin" now={now} />
        )}
      </Panel>
    </AppShell>
  );
}
