import { Search } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cx } from './cx.ts';
import { fieldClass } from './text-field.tsx';

/** A search box for a list (a GET form around it sends it): magnifier inside, label for screen readers only. */
export function SearchField({ label, className, ...props }: Omit<ComponentProps<'input'>, 'type'> & { label: string }) {
  return (
    <div className={cx('relative', className)}>
      <Search
        aria-hidden
        className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-2.5 size-4 text-muted"
      />
      <input type="search" aria-label={label} className={cx('h-10 pr-3 pl-8.5', fieldClass(false))} {...props} />
    </div>
  );
}
