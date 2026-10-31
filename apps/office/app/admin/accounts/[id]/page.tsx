import { ArrowLeft, UserX } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { NotAdmin } from '../../../../components/admin-gate.tsx';
import { AppShell } from '../../../../components/app-shell.tsx';
import { ApplicationStatusChip, BudgetStatusChip } from '../../../../components/budget-chips.tsx';
import { Banner, type BannerTone } from '../../../../components/ui/banner.tsx';
import { buttonClass } from '../../../../components/ui/button.tsx';
import { DetailsList } from '../../../../components/ui/details-list.tsx';
import { PageHeader } from '../../../../components/ui/page-header.tsx';
import { Panel } from '../../../../components/ui/panel.tsx';
import { StatePanel } from '../../../../components/ui/state-panel.tsx';
import { TextLink } from '../../../../components/ui/text-link.tsx';
import { type AccountDetail, domainMismatch, getAccount, gradeLabels } from '../../../../lib/applications.ts';
import { getDb } from '../../../../lib/services.ts';
import { requireAdmin } from '../../../../lib/session.ts';
import { texts } from '../../../../lib/texts.ts';
import type { DecidedOutcome } from './actions.ts';
import { BudgetForm } from './budget-form.tsx';
import { DecideForm } from './decide-form.tsx';

export const metadata: Metadata = { title: texts.admin.title };

const a = texts.admin.account;

const BackLink = () => (
  <Link href="/admin" className={buttonClass('quiet', 'sm')}>
    <ArrowLeft aria-hidden />
    {texts.admin.back}
  </Link>
);

function Application({
  account,
  application,
}: {
  account: AccountDetail;
  application: AccountDetail['applications'][number];
}) {
  const mismatch = domainMismatch(account.email, application.schoolUrl);
  const decided =
    application.status !== 'pending' && application.decidedAt
      ? a.decided(application.status, application.decidedAt, application.decidedBy)
      : undefined;
  return (
    <Panel className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-bold text-lg">{a.application(application.createdAt)}</h2>
        <ApplicationStatusChip status={application.status} />
      </div>
      {application.status === 'pending' && mismatch && (
        <Banner tone="warning">{a.domainMismatch(mismatch.emailDomain, mismatch.host)}</Banner>
      )}
      <DetailsList
        items={[
          [a.schoolName, application.schoolName],
          [
            a.schoolUrl,
            <TextLink key="url" href={application.schoolUrl}>
              {application.schoolUrl}
            </TextLink>,
          ],
          [a.grades, gradeLabels(application.grades)],
          [a.summary, application.summary],
          [a.jev, application.jevSummary ?? '–'],
          ...(decided ? ([[texts.admin.columns.status, decided]] as const) : []),
          ...(application.note ? ([[a.note, application.note]] as const) : []),
        ]}
      />
      {application.status === 'pending' && (
        <DecideForm userId={account.userId} applicationId={application.id} name={account.name} />
      )}
    </Panel>
  );
}

const outcomes: Record<DecidedOutcome, { tone: BannerTone; text: string }> = {
  accepted: { tone: 'success', text: a.acceptedBanner },
  rejected: { tone: 'success', text: a.rejectedBanner },
  on: { tone: 'success', text: a.onBanner },
  off: { tone: 'success', text: a.offBanner },
  stale: { tone: 'warning', text: a.staleBanner },
  unmailed: { tone: 'warning', text: a.mailFailedBanner },
};

export default async function AccountPage({ params, searchParams }: PageProps<'/admin/accounts/[id]'>) {
  const { session, allowed } = await requireAdmin();
  const { user } = session;
  if (!allowed)
    return (
      <AppShell userName={user.name}>
        <NotAdmin name={user.name} />
      </AppShell>
    );
  const { id } = await params;
  const { decided } = await searchParams;
  const outcome =
    typeof decided === 'string' && Object.hasOwn(outcomes, decided) ? outcomes[decided as DecidedOutcome] : undefined;
  const account = await getAccount(getDb(), id);
  if (!account)
    return (
      <AppShell userName={user.name} admin>
        <StatePanel icon={UserX} title={texts.admin.notFound} actions={<BackLink />} />
      </AppShell>
    );
  return (
    <AppShell userName={user.name} admin>
      <div>
        <BackLink />
      </div>
      <PageHeader title={account.name} description={account.email} />
      {outcome && <Banner tone={outcome.tone}>{outcome.text}</Banner>}
      <Panel className="grid gap-4">
        <DetailsList
          items={[
            [a.registeredAs, texts.home.kind[account.kind]],
            [a.registeredAt, texts.format.dateTime(account.registeredAt)],
            [a.terms, a.termsValue(account.termsVersion, account.termsAcceptedAt)],
            [a.aiConsent, a.aiConsentValue(account.aiConsentAt)],
            [a.jevChecks, String(account.jevChecks)],
          ]}
        />
      </Panel>
      <Panel className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-bold text-lg">{a.freeBudget}</h2>
          <BudgetStatusChip status={account.status} />
        </div>
        <p className="text-sm">
          {a.freeBudgetValue(account.freeBudgetAt, account.freeBudgetBy, account.freeBudgetRequested)}
        </p>
        {account.status === 'pending' ? (
          <p className="text-sm">{a.switchPending}</p>
        ) : (
          <BudgetForm userId={account.userId} on={account.status === 'granted'} name={account.name} />
        )}
      </Panel>
      <h2 className="font-bold text-lg">{a.applications}</h2>
      {account.applications.length === 0 ? (
        <p className="text-sm">{a.noApplications}</p>
      ) : (
        account.applications.map((application) => (
          <Application key={application.id} account={account} application={application} />
        ))
      )}
    </AppShell>
  );
}
