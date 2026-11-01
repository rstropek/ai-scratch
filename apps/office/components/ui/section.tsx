import { type ReactNode, useId } from 'react';
import { cx } from './cx.ts';

/** A titled part of a long page: its heading above its content (a panel, a table). */
export function Section({ title, children, className }: { title: ReactNode; children: ReactNode; className?: string }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={cx('grid gap-3', className)}>
      <h2 id={id} className="scroll-mt-4 text-balance font-bold text-lg">
        {title}
      </h2>
      {children}
    </section>
  );
}
