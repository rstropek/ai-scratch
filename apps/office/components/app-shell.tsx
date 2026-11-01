import Link from 'next/link';
import type { ReactNode } from 'react';
import { texts } from '../lib/texts.ts';
import { SignOutButton } from './sign-out-button.tsx';
import { SiteFooter } from './site-footer.tsx';
import { buttonClass } from './ui/button.tsx';
import { TopBar } from './ui/top-bar.tsx';

/** Every page behind the login: the top bar with the user and "Abmelden", then the page and the footer. */
export function AppShell({
  userName,
  admin = false,
  children,
}: {
  userName: string;
  /** adds the admin's pages to the bar */
  admin?: boolean;
  children: ReactNode;
}) {
  return (
    <>
      <TopBar>
        <nav aria-label={texts.shell.nav} className="flex gap-1">
          <Link href="/" className={buttonClass('on-bar', 'sm')}>
            {texts.shell.home}
          </Link>
          {admin && (
            <>
              <Link href="/admin" className={buttonClass('on-bar', 'sm')}>
                {texts.shell.admin}
              </Link>
              <Link href="/admin/keys" className={buttonClass('on-bar', 'sm')}>
                {texts.shell.keys}
              </Link>
            </>
          )}
        </nav>
        <span className="hidden truncate sm:inline">{userName}</span>
        <SignOutButton />
      </TopBar>
      <main className="mx-auto grid max-w-6xl gap-5 px-4 py-6">{children}</main>
      <SiteFooter />
    </>
  );
}
