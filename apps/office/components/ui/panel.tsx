import type { ComponentProps } from 'react';
import { cx } from './cx.ts';

/** A white work area on the page's blue ground. Unpadded for tables, padded for forms and text. */
export function Panel({ padded = true, className, ...props }: ComponentProps<'div'> & { padded?: boolean }) {
  return (
    <div
      className={cx('min-w-0 rounded-panel border border-divider bg-surface', padded && 'p-6', className)}
      {...props}
    />
  );
}
