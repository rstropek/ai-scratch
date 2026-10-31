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

/** Where the account stands as a teacher, with the next step. */
function ApplicationPanel({ state }: { state: ApplicantState }) {
  const a = t.application;
  const status = state.latest?.status;
  const { title, text } =
    status === 'pending'
      ? { title: a.pending.title, text: a.pending.text(state.latest?.createdAt ?? new Date()) }
      : status === 'accepted'
        ? a.accepted
        : status === 'rejected'
          ? a.rejected
          : state.kind === 'teacher'
            ? a.missing
            : a.none;
  return (
    <Panel className="grid justify-items-start gap-3">
      <h2 className="font-bold text-lg">{title}</h2>
      <p className="max-w-prose">{text}</p>
      {canApply(state) && (
        <Link href="/apply" className={buttonClass(state.kind === 'teacher' && !status ? 'primary' : 'secondary')}>
          {status === 'rejected' ? a.applyAgain : a.apply}
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
  const teacher = state.latest?.status === 'accepted';
  return (
    <AppShell userName={user.name} admin={admin}>
      <PageHeader
        title={t.greeting(user.name)}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {t.signedInAs(user.email)}
            {admin && <Chip tone="primary">{t.admin}</Chip>}
            {state.kind && (
              <Chip tone={teacher ? 'success' : 'neutral'}>{teacher ? t.kind.teacher : t.kind.parent}</Chip>
            )}
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
      {state.kind && <ApplicationPanel state={state} />}
    </AppShell>
  );
}
