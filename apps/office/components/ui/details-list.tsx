import type { ReactNode } from 'react';

/** Label–value pairs (an account's details): two columns on wide screens, stacked on narrow ones. */
export function DetailsList({ items }: { items: readonly (readonly [string, ReactNode])[] }) {
  return (
    <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[minmax(0,14rem)_1fr]">
      {items.map(([term, value]) => (
        <div key={term} className="contents">
          <dt className="font-bold">{term}</dt>
          <dd className="min-w-0 whitespace-pre-line break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
