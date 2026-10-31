'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { authClient } from '../lib/auth-client.ts';
import { texts } from '../lib/texts.ts';
import { Button } from './ui/button.tsx';

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const signOut = async () => {
    setPending(true);
    await authClient.signOut();
    router.replace('/login');
    router.refresh();
  };
  return (
    <Button variant="on-bar" size="sm" pending={pending} onClick={signOut}>
      {!pending && <LogOut aria-hidden />}
      {texts.shell.signOut}
    </Button>
  );
}
