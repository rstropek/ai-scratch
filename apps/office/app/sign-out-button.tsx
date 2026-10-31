'use client';

import { useRouter } from 'next/navigation';
import { authClient } from '../lib/auth-client.ts';
import { texts } from '../lib/texts.ts';

export function SignOutButton() {
  const router = useRouter();
  const signOut = async () => {
    await authClient.signOut();
    router.replace('/anmelden');
    router.refresh();
  };
  return (
    <button
      type="button"
      onClick={signOut}
      className="rounded-md border border-slate-300 px-3 py-1.5 font-medium text-sm hover:bg-slate-100"
    >
      {texts.home.signOut}
    </button>
  );
}
