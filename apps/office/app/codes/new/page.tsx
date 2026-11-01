import { generateCode } from '@ai-scratch/db';
import { KeyRound } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AppShell } from '../../../components/app-shell.tsx';
import { buttonClass } from '../../../components/ui/button.tsx';
import { PageHeader } from '../../../components/ui/page-header.tsx';
import { StatePanel } from '../../../components/ui/state-panel.tsx';
import { durationChoices, hasFreeBudget } from '../../../lib/codes.ts';
import { listOpenRouterKeys } from '../../../lib/openrouter-keys.ts';
import { isAdmin } from '../../../lib/roles.ts';
import { getDb, getServicesEnv } from '../../../lib/services.ts';
import { requireSession } from '../../../lib/session.ts';
import { texts } from '../../../lib/texts.ts';
import { BackHome } from '../back-home.tsx';
import { CodeForm } from './code-form.tsx';

export const metadata: Metadata = { title: texts.codes.newTitle };

const c = texts.codes;

export default async function NewCodePage() {
  const { user } = await requireSession();
  const admin = isAdmin(user);
  const db = getDb();
  const [free, keys] = await Promise.all([
    admin ? Promise.resolve(true) : hasFreeBudget(db, user.id),
    listOpenRouterKeys(db, user.id),
  ]);
  const sources = [
    ...(free ? [{ value: 'free', label: c.sourceFree }] : []),
    ...keys.map((key) => ({ value: key.id, label: c.sourceKey(key.label, key.keyHint) })),
  ];
  const { limits } = getServicesEnv();
  return (
    <AppShell userName={user.name} admin={admin}>
      <div>
        <BackHome />
      </div>
      {sources.length === 0 ? (
        <StatePanel
          icon={KeyRound}
          title={c.noSourceTitle}
          actions={
            <Link href="/openrouter-keys" className={buttonClass('primary')}>
              {c.addKey}
            </Link>
          }
        >
          <p>{c.noSource}</p>
        </StatePanel>
      ) : (
        <>
          <PageHeader title={c.newTitle} description={c.newIntro} />
          <div className="max-w-2xl">
            <CodeForm
              proposal={generateCode()}
              sources={sources}
              durations={durationChoices(limits)}
              codeBudgetUsd={limits.codeBudgetUsd}
            />
          </div>
        </>
      )}
    </AppShell>
  );
}
