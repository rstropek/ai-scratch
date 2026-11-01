import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PublicShell } from '../../components/public-shell.tsx';
import { ScratchNote } from '../../components/scratch-note.tsx';
import { buttonClass } from '../../components/ui/button.tsx';
import { cx } from '../../components/ui/cx.ts';
import { Panel } from '../../components/ui/panel.tsx';
import { TextLink } from '../../components/ui/text-link.tsx';
import { WhoMayRegister } from '../../components/who-may-register.tsx';
import { getSession } from '../../lib/session.ts';
import { texts } from '../../lib/texts.ts';
import { LoginForm } from './login-form.tsx';

export const metadata: Metadata = { title: texts.login.title };

const t = texts.login;

/** Sign-in for adults with an account beside who may register, so new adults find their way and kids learn they need none. */
export default async function LoginPage() {
  if (await getSession()) redirect('/');
  return (
    <PublicShell width="wide" signInLink={false}>
      <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2 md:gap-10">
        <Panel className="grid content-start gap-5">
          <div>
            <h1 className="font-bold text-2xl">{t.title}</h1>
            <p className="text-sm">{t.subtitle}</p>
          </div>
          <LoginForm />
          <p className="text-sm">
            <TextLink href="/forgot-password">{t.forgot}</TextLink>
          </p>
        </Panel>
        <section aria-labelledby="new-account" className="grid content-start gap-4 md:pt-6">
          <h2 id="new-account" className="font-bold text-2xl text-primary-ink">
            {t.newTitle}
          </h2>
          <p>{t.newText}</p>
          <WhoMayRegister />
          <Link href="/register" className={cx(buttonClass('secondary'), 'justify-self-start')}>
            {t.register}
          </Link>
        </section>
        <ScratchNote className="md:col-span-2" />
      </div>
    </PublicShell>
  );
}
