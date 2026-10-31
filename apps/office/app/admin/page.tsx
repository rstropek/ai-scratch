import type { Metadata } from 'next';
import Link from 'next/link';
import { NotAdmin } from '../../components/admin-gate.tsx';
import { AppShell } from '../../components/app-shell.tsx';
import { BudgetStatusChip } from '../../components/budget-chips.tsx';
import { Button, buttonClass } from '../../components/ui/button.tsx';
import { FilterTabs } from '../../components/ui/filter-tabs.tsx';
import { PageHeader } from '../../components/ui/page-header.tsx';
import { Panel } from '../../components/ui/panel.tsx';
import { SearchField } from '../../components/ui/search-field.tsx';
import { Cell, Table, TableFooter } from '../../components/ui/table.tsx';
import { ACCOUNT_FILTERS, type AccountFilter, listAccounts, parseFilter } from '../../lib/applications.ts';
import { getDb } from '../../lib/services.ts';
import { requireAdmin } from '../../lib/session.ts';
import { texts } from '../../lib/texts.ts';

export const metadata: Metadata = { title: texts.admin.title };

const t = texts.admin;

const hrefFor = (filter: AccountFilter, q: string) => {
  const params = new URLSearchParams({ filter });
  if (q) params.set('q', q);
  return `/admin?${params}`;
};

export default async function AdminPage({ searchParams }: PageProps<'/admin'>) {
  const { session, allowed } = await requireAdmin();
  const { user } = session;
  if (!allowed)
    return (
      <AppShell userName={user.name}>
        <NotAdmin name={user.name} />
      </AppShell>
    );
  const params = await searchParams;
  const filter = parseFilter(params.filter);
  const q = typeof params.q === 'string' ? params.q.trim() : '';
  const { rows, counts } = await listAccounts(getDb(), filter, q);
  const empty = q ? t.empty.search(q) : filter === 'pending' ? t.empty.pending : t.empty.other;
  return (
    <AppShell userName={user.name} admin>
      <PageHeader title={t.title} description={t.description} />
      <Panel padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-divider border-b px-4 py-3">
          <FilterTabs
            label={t.filterLabel}
            tabs={ACCOUNT_FILTERS.map((f) => ({
              href: hrefFor(f, q),
              label: t.filters[f],
              count: counts[f],
              current: f === filter,
            }))}
          />
          <form action="/admin" className="flex w-full gap-2 sm:w-auto">
            <input type="hidden" name="filter" value={filter} />
            <SearchField
              name="q"
              label={t.searchLabel}
              placeholder={t.search}
              defaultValue={q}
              className="w-full sm:w-68"
            />
            <Button type="submit" variant="secondary">
              {t.searchSubmit}
            </Button>
          </form>
        </div>
        {rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-muted text-sm">{empty}</p>
        ) : (
          <>
            <Table
              columns={[
                { label: filter === 'pending' ? t.columns.applied : t.columns.registered },
                { label: t.columns.person },
                { label: t.columns.kind },
                { label: t.columns.freeBudget },
                { label: t.columns.school },
                { label: t.columns.action, hidden: true },
              ]}
            >
              {rows.map((row) => {
                const at = filter === 'pending' && row.appliedAt ? row.appliedAt : row.registeredAt;
                return (
                  <tr key={row.userId}>
                    <Cell sub={texts.format.time(at)}>
                      <span className="whitespace-nowrap">{texts.format.date(at)}</span>
                    </Cell>
                    <Cell sub={row.email}>{row.name}</Cell>
                    <Cell>{t.kind[row.kind]}</Cell>
                    <Cell>
                      <BudgetStatusChip status={row.status} />
                    </Cell>
                    <Cell>{row.schoolName ?? '–'}</Cell>
                    <Cell action>
                      <Link href={`/admin/accounts/${row.userId}`} className={buttonClass('secondary', 'sm')}>
                        {row.status === 'pending' ? t.review : t.open}
                        <span className="sr-only">: {row.name}</span>
                      </Link>
                    </Cell>
                  </tr>
                );
              })}
            </Table>
            <TableFooter>{t.footer(rows.length, filter === 'pending' ? 'pending' : 'other')}</TableFooter>
          </>
        )}
      </Panel>
    </AppShell>
  );
}
