import { type ReactNode, useId } from 'react';
import { cx } from './cx.ts';

/** A highlighted box inside a page, such as a summary. Static content; messages go through Banner. */
export function Callout({ title, children, className }: { title: ReactNode; children: ReactNode; className?: string }) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className={cx('grid gap-2 rounded-panel bg-primary-light px-5 py-4 text-primary-ink', className)}
    >
      <h2 id={id} className="font-bold text-lg">
        {title}
      </h2>
      {children}
    </section>
  );
}
