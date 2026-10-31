import Link from 'next/link';
import type { ReactNode } from 'react';
import { cx } from './cx.ts';

/** A link in running text. Pages of the office go through next/link, everything else is a plain anchor. */
export function TextLink({
  href,
  children,
  className,
  newTab,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  /** opens beside the page (a link inside a half-filled form); the text says so to screen readers */
  newTab?: string;
}) {
  const classes = cx(
    'rounded-button text-primary-hover underline underline-offset-2 hover:text-primary-ink focus-visible:focus-ring',
    className,
  );
  if (newTab)
    return (
      <a href={href} target="_blank" rel="noopener" className={classes}>
        {children}
        <span className="sr-only"> {newTab}</span>
      </a>
    );
  return href.startsWith('/') ? (
    <Link href={href} className={classes}>
      {children}
    </Link>
  ) : (
    <a href={href} className={classes}>
      {children}
    </a>
  );
}
