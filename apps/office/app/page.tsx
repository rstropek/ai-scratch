import { displayCode, loadPrice } from '@ai-scratch/db';
import { Cpu, MonitorPlay, Presentation } from 'lucide-react';
import Link from 'next/link';
import { AppShell } from '../components/app-shell.tsx';
import { CodesTable } from '../components/codes-table.tsx';
import { Banner } from '../components/ui/banner.tsx';
import { buttonClass } from '../components/ui/button.tsx';
import { Chip } from '../components/ui/chip.tsx';
import { DetailsList } from '../components/ui/details-list.tsx';
import { LinkList } from '../components/ui/link-list.tsx';
import { PageHeader } from '../components/ui/page-header.tsx';
import { Panel } from '../components/ui/panel.tsx';
import { Section } from '../components/ui/section.tsx';
import { TextLink } from '../components/ui/text-link.tsx';
import { type ApplicantState, applicantState, canApply } from '../lib/applications.ts';
import {
  type AccountBudget,
  type AdminNumbers,
  accountBudget,
  adminNumbers,
  ownKeyMonthSpend,
} from '../lib/budget-numbers.ts';
import { isGeneratedCode, listCodes } from '../lib/codes.ts';
import { openRouterDeps } from '../lib/deps.ts';
import { type KeyStatus, listOpenRouterKeys, readRemaining, remainingText } from '../lib/openrouter-keys.ts';
import { isAdmin } from '../lib/roles.ts';
import { getDb, getServicesEnv } from '../lib/services.ts';
import { requireSession } from '../lib/session.ts';
import { texts } from '../lib/texts.ts';

const t = texts.home;
const b = t.budget;
const r = t.resources;

/** the kids' app, where the slides and the video page live; ?video=3 opens the video page at its third video */
const KIDS_APP = 'https://ai-scratch.dev';
const RESOURCES = [
  { href: `${KIDS_APP}/slides/`, icon: Presentation, ...r.slides },
  { href: `${KIDS_APP}/digiferien-2026-live`, icon: MonitorPlay, ...r.videos },
  { href: `${KIDS_APP}/digiferien-2026-live?video=3`, icon: Cpu, ...r.kiVideo },
];

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

/** the overall month for admins: the free budget, own keys, running codes and each pool entry */
const adminItems = (numbers: AdminNumbers): [string, string][] => [
  [b.total, b.totalValue(numbers.freeSpentUsd, numbers.totalLimitUsd)],
  [b.ownKeysTotal, b.ownKeysTotalValue(numbers.ownKeySpentUsd)],
  [b.running, String(numbers.runningCodes)],
  ...numbers.pool.map((entry): [string, string] => [
    b.pool(entry.donor, entry.hint),
    [
      b.poolValue(entry.spentUsd, entry.capMonth),
      !entry.active && b.poolPaused,
      entry.refusedAt && b.poolRefused(entry.refusedReason),
    ]
      .filter(Boolean)
      .join(' · '),
  ]),
];

const accountItems = (budget: AccountBudget): [string, string][] => [
  [b.free, b.freeValue(budget.spentUsd, budget.limitUsd)],
  [b.freeCodes, b.freeCodesValue(budget.codesCreated, budget.codesLimit)],
];

export default async function Home({ searchParams }: PageProps<'/'>) {
  const { user } = await requireSession();
  const { sent, created, deleted } = await searchParams;
  const admin = isAdmin(user);
  const db = getDb();
  const { limits } = getServicesEnv();
  const now = new Date();
  const [state, price, keys, codes] = await Promise.all([
    applicantState(db, user.id),
    loadPrice(db),
    listOpenRouterKeys(db, user.id),
    listCodes(db, { ownerId: user.id, now }),
  ]);
  // the numbers come from the same sums the kids' app checks; an admin's own free budget has no limit of its own
  const [account, overall, keySpend, remaining] = await Promise.all([
    state.freeBudget && !admin ? accountBudget(db, price, limits, user.id, now) : undefined,
    admin ? adminNumbers(db, price, limits, now) : undefined,
    ownKeyMonthSpend(db, price, user.id, now),
    // the key box only when there are keys to open: an office without KEY_ENCRYPTION_KEY still shows this page
    keys.length > 0 ? readRemaining(openRouterDeps(), user.id, keys) : new Map<string, KeyStatus>(),
  ]);
  const month = texts.format.month(now);
  const ownItems = keys.map((key): [string, string] => [
    b.ownKey(key.label, key.keyHint),
    b.ownKeyValue(remainingText(remaining.get(key.id)), keySpend.get(key.id) ?? 0),
  ]);
  const createdCode = typeof created === 'string' && isGeneratedCode(created) ? displayCode(created) : undefined;
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
          <>
            {admin && (
              <Link href="/admin" className={buttonClass('secondary')}>
                {t.adminLink}
              </Link>
            )}
            <Link href="/codes/new" className={buttonClass('primary')}>
              {t.newCode}
            </Link>
          </>
        }
      />
      {sent === '1' && state.latest?.status === 'pending' && <Banner tone="success">{t.sent}</Banner>}
      {createdCode && <Banner tone="success">{t.created(createdCode)}</Banner>}
      {deleted === '1' && <Banner tone="success">{t.codeDeleted}</Banner>}
      <FreeBudgetPanel state={state} />
      <Section title={b.title(month)}>
        <Panel className="grid gap-4">
          {account || ownItems.length > 0 ? (
            <DetailsList items={[...(account ? accountItems(account) : []), ...ownItems]} />
          ) : (
            !admin && <p className="text-sm">{b.none}</p>
          )}
          {admin && keys.length === 0 && <p className="text-sm">{b.noOwnKeys}</p>}
          <p className="text-sm">
            <TextLink href="/openrouter-keys">{b.manageKeys}</TextLink>
          </p>
        </Panel>
      </Section>
      {overall && (
        <Section title={b.adminTitle(month)}>
          <Panel className="grid gap-4">
            <DetailsList items={adminItems(overall)} />
            {overall.pool.length === 0 && <p className="text-sm">{b.noPool}</p>}
          </Panel>
        </Section>
      )}
      <Section title={t.codesTitle}>
        <Panel padded={false}>
          {codes.length === 0 ? (
            <p className="px-4 py-10 text-center text-muted text-sm">{t.noCodes}</p>
          ) : (
            <CodesTable rows={codes} codeBudgetUsd={limits.codeBudgetUsd} back="home" now={now} />
          )}
        </Panel>
      </Section>
      <Section title={r.title}>
        <Panel padded={false}>
          <LinkList items={RESOURCES} newTab={r.newTab} />
        </Panel>
      </Section>
    </AppShell>
  );
}
