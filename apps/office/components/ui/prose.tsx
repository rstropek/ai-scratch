import type { ComponentProps } from 'react';
import { cx } from './cx.ts';

/** Long text (legal and info pages): plain h2, p, ul and strong inside get their spacing and look here. */
export function Prose({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cx(
        'max-w-[68ch] [&>:first-child]:mt-0 [&>:last-child]:mb-0',
        '[&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:scroll-mt-4 [&_h2]:text-balance [&_h2]:font-bold [&_h2]:text-lg',
        '[&_p]:my-2 [&_strong]:font-bold',
        '[&_ul]:my-2 [&_ul]:grid [&_ul]:list-disc [&_ul]:gap-1.5 [&_ul]:pl-5 [&_ul]:marker:text-primary',
        className,
      )}
      {...props}
    />
  );
}
