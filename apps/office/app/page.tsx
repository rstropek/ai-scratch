import { requireSession } from '../lib/session.ts';
import { texts } from '../lib/texts.ts';
import { SignOutButton } from './sign-out-button.tsx';

export default async function Home() {
  const { user } = await requireSession();
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-8">
      <header className="flex items-center justify-between gap-4">
        <p className="font-semibold text-slate-500">{texts.appName}</p>
        <SignOutButton />
      </header>
      <h1 className="font-bold text-3xl">{texts.home.greeting(user.name)}</h1>
      <p className="text-slate-600">
        {texts.home.signedInAs(user.email)}
        {user.role === 'admin' && (
          <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 font-medium text-amber-900 text-sm">
            {texts.home.admin}
          </span>
        )}
      </p>
    </main>
  );
}
