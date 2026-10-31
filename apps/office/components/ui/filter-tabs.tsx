import Link from 'next/link';
import { cx } from './cx.ts';

export interface FilterTab {
  href: string;
  label: string;
  count?: number;
  current: boolean;
}

/** Views of one list as links (each view has its own URL): the current one filled, counts beside the labels. */
export function FilterTabs({ label, tabs }: { label: string; tabs: FilterTab[] }) {
  return (
    <nav aria-label={label}>
      <ul className="flex flex-wrap gap-1">
        {tabs.map((tab) => (
          <li key={tab.href}>
            <Link
              href={tab.href}
              aria-current={tab.current ? 'page' : undefined}
              className={cx(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1.75 font-bold text-sm focus-visible:focus-ring',
                tab.current ? 'bg-primary-light text-primary-ink' : 'hover:bg-subtle',
              )}
            >
              {tab.label}
              {/* a space, so screen readers say "Eltern 3", not "Eltern3" */}{' '}
              {tab.count !== undefined && <span className="font-normal tabular-nums">{tab.count}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
