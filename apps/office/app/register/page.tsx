import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { FormPage } from '../../components/form-page.tsx';
import { PublicShell } from '../../components/public-shell.tsx';
import { getServicesEnv } from '../../lib/services.ts';
import { getSession } from '../../lib/session.ts';
import { texts } from '../../lib/texts.ts';
import { RegisterForm } from './register-form.tsx';

export const metadata: Metadata = { title: texts.register.title };

export default async function RegisterPage() {
  if (await getSession()) redirect('/');
  const t = texts.register;
  return (
    <PublicShell width="wide">
      <FormPage title={t.title} intro={t.intro} steps={t.steps} note={t.privacy}>
        <RegisterForm siteKey={getServicesEnv().turnstile.siteKey} />
      </FormPage>
    </PublicShell>
  );
}
