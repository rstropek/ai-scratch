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
  const s = texts.shell;
  const links: [string, string][] = [
    ['/', s.home],
    ['/openrouter-keys', s.openrouterKeys],
    ...(admin
      ? ([
          ['/admin', s.admin],
          ['/admin/codes', s.codes],
          ['/admin/keys', s.keys],
          ['/admin/prices', s.prices],
        ] as [string, string][])
      : []),
  ];
  return (
    <>
      <TopBar>
        {/* phones: the links scroll sideways instead of widening the page */}
        <nav aria-label={texts.shell.nav} className="flex min-w-0 gap-1 overflow-x-auto">
          {links.map(([href, label]) => (
            <Link key={href} href={href} className={buttonClass('on-bar', 'sm')}>
              {label}
            </Link>
          ))}
        </nav>
        <span className="hidden truncate sm:inline">{userName}</span>
        <SignOutButton />
      </TopBar>
      <main className="mx-auto grid max-w-6xl gap-5 px-4 py-6">{children}</main>
      <SiteFooter />
    </>
  );
}
