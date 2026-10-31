import type { Metadata } from 'next';
import { PublicShell } from '../../../components/public-shell.tsx';
import { Panel } from '../../../components/ui/panel.tsx';
import { registrationDeps } from '../../../lib/deps.ts';
import { checkLink } from '../../../lib/registration.ts';
import { texts } from '../../../lib/texts.ts';
import { ConfirmForm } from './confirm-form.tsx';
import { LinkProblem } from './link-problem.tsx';

export const metadata: Metadata = { title: texts.confirm.title };

const t = texts.confirm;

/** Only opens: mail scanners follow links on their own, so the account is created by the form's submit. */
export default async function ConfirmPage({ searchParams }: PageProps<'/register/confirm'>) {
  const { t: raw } = await searchParams;
  const token = typeof raw === 'string' ? raw : '';
  const link = await checkLink(registrationDeps(), token);
  return (
    <PublicShell>
      {link.state === 'ready' ? (
        <Panel className="grid gap-5">
          <h1 className="font-bold text-2xl">{t.title}</h1>
          <p className="text-sm">{t.intro(link.email)}</p>
          <ConfirmForm token={token} email={link.email} />
        </Panel>
      ) : (
        <LinkProblem state={link.state} />
      )}
    </PublicShell>
  );
}
