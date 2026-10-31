import Link from 'next/link';
import { AppShell } from '../components/app-shell.tsx';
import { Banner } from '../components/ui/banner.tsx';
import { buttonClass } from '../components/ui/button.tsx';
import { Chip } from '../components/ui/chip.tsx';
import { PageHeader } from '../components/ui/page-header.tsx';
import { Panel } from '../components/ui/panel.tsx';
import { type ApplicantState, applicantState, canApply } from '../lib/applications.ts';
import { isAdmin } from '../lib/roles.ts';
import { getDb } from '../lib/services.ts';
import { requireSession } from '../lib/session.ts';
import { texts } from '../lib/texts.ts';

const t = texts.home;

/** Where the free budget stands, with the next step; nothing for accounts that never asked for it. */
function FreeBudgetPanel({ state }: { state: ApplicantState }) {
  const f = t.freeBudget;
  const status = state.latest?.status;
  const panel = state.freeBudget
    ? f.granted
    : status === 'pending'
      ? { title: f.pending.title, text: f.pending.text(state.latest?.createdAt ?? new Date()) }
      : status === 'rejected'
        ? f.rejected
        : canApply(state)
          ? f.missing
          : undefined;
  if (!panel) return null;
  return (
    <Panel className="grid justify-items-start gap-3">
      <h2 className="font-bold text-lg">{panel.title}</h2>
      <p className="max-w-prose">{panel.text}</p>
      {canApply(state) && (
        <Link href="/apply" className={buttonClass('primary')}>
          {f.apply}
        </Link>
      )}
    </Panel>
  );
}

export default async function Home({ searchParams }: PageProps<'/'>) {
  const { user } = await requireSession();
  const { sent } = await searchParams;
  const admin = isAdmin(user);
  const state = await applicantState(getDb(), user.id);
  return (
    <AppShell userName={user.name} admin={admin}>
      <PageHeader
        title={t.greeting(user.name)}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {t.signedInAs(user.email)}
            {admin && <Chip tone="primary">{t.admin}</Chip>}
            {state.kind && <Chip tone="neutral">{t.kind[state.kind]}</Chip>}
          </span>
        }
        actions={
          admin && (
            <Link href="/admin" className={buttonClass('secondary')}>
              {t.adminLink}
            </Link>
          )
        }
      />
      {sent === '1' && state.latest?.status === 'pending' && <Banner tone="success">{t.sent}</Banner>}
      <FreeBudgetPanel state={state} />
    </AppShell>
  );
}
