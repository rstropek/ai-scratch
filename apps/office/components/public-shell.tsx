import Link from 'next/link';
import type { ReactNode } from 'react';
import { texts } from '../lib/texts.ts';
import { SiteFooter } from './site-footer.tsx';
import { buttonClass } from './ui/button.tsx';
import { TopBar } from './ui/top-bar.tsx';

/** Pages without a login (sign-in, registration, password reset): the bar links to the other way in. */
export function PublicShell({
  children,
  offer = 'login',
  width = 'narrow',
}: {
  children: ReactNode;
  /** which way in the bar offers: the page itself is the other one */
  offer?: 'login' | 'register';
  /** narrow: one small form; wide: a form with an explanation beside it */
  width?: 'narrow' | 'wide';
}) {
  return (
    <>
      <TopBar>
        <Link href={offer === 'login' ? '/login' : '/register'} className={buttonClass('on-bar', 'sm')}>
          {offer === 'login' ? texts.shell.signIn : texts.shell.register}
        </Link>
      </TopBar>
      <main className={width === 'narrow' ? 'mx-auto max-w-md px-4 pt-12 pb-8' : 'mx-auto max-w-5xl px-4 py-8'}>
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
