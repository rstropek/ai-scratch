import { redirect } from 'next/navigation';
import { Panel } from '../../components/ui/panel.tsx';
import { TopBar } from '../../components/ui/top-bar.tsx';
import { getSession } from '../../lib/session.ts';
import { texts } from '../../lib/texts.ts';
import { LoginForm } from './login-form.tsx';

export default async function LoginPage() {
  if (await getSession()) redirect('/');
  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-sm px-4 pt-16 pb-8">
        <Panel className="grid gap-5">
          <h1 className="font-bold text-2xl">{texts.login.title}</h1>
          <LoginForm />
        </Panel>
      </main>
    </>
  );
}
