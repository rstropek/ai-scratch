import { redirect } from 'next/navigation';
import { getSession } from '../../lib/session.ts';
import { texts } from '../../lib/texts.ts';
import { LoginForm } from './login-form.tsx';

export default async function LoginPage() {
  if (await getSession()) redirect('/');
  return (
    <main className="mx-auto flex max-w-sm flex-col gap-6 p-8 pt-24">
      <div>
        <p className="font-semibold text-slate-500">{texts.appName}</p>
        <h1 className="font-bold text-3xl">{texts.login.title}</h1>
      </div>
      <LoginForm />
    </main>
  );
}
