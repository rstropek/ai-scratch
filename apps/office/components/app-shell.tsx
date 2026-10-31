import type { ReactNode } from 'react';
import { SignOutButton } from './sign-out-button.tsx';
import { TopBar } from './ui/top-bar.tsx';

/** Every page behind the login: the top bar with the user and "Abmelden", then the page. */
export function AppShell({ userName, children }: { userName: string; children: ReactNode }) {
  return (
    <>
      <TopBar>
        <span className="hidden truncate sm:inline">{userName}</span>
        <SignOutButton />
      </TopBar>
      <main className="mx-auto grid max-w-6xl gap-5 px-4 py-6">{children}</main>
    </>
  );
}
