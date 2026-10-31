import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PublicShell } from '../../components/public-shell.tsx';
import { Panel } from '../../components/ui/panel.tsx';
import { TextLink } from '../../components/ui/text-link.tsx';
import { getSession } from '../../lib/session.ts';
import { texts } from '../../lib/texts.ts';
import { LoginForm } from './login-form.tsx';

export const metadata: Metadata = { title: texts.login.title };

export default async function LoginPage() {
  if (await getSession()) redirect('/');
  return (
    <PublicShell offer="register">
      <Panel className="grid gap-5">
        <h1 className="font-bold text-2xl">{texts.login.title}</h1>
        <LoginForm />
        <div className="grid gap-1 text-sm">
          <TextLink href="/forgot-password" className="justify-self-start">
            {texts.login.forgot}
          </TextLink>
          <p>
            {texts.login.noAccount} <TextLink href="/register">{texts.login.register}</TextLink>
          </p>
        </div>
      </Panel>
    </PublicShell>
  );
}
