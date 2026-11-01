import type { ReactNode } from 'react';
import { cx } from './cx.ts';

export interface Column {
  label: string;
  /** read by screen readers only (an action column) */
  hidden?: boolean;
}

/** A data table inside an unpadded Panel; scrolls sideways on narrow screens. Rows use Cell. */
export function Table({
  columns,
  stack = false,
  children,
}: {
  columns: Column[];
  /** phones: each row as a block, its first cell as the title and the others under it with their `label` */
  stack?: boolean;
  children: ReactNode;
}) {
  return (
    // relative: screen-reader-only text in cells is positioned absolutely and would widen the page otherwise
    <div className="relative overflow-x-auto">
      <table
        className={cx(
          'w-full border-collapse text-sm',
          stack &&
            'max-sm:block max-sm:[&_tbody]:block max-sm:[&_td]:border-0 max-sm:[&_td]:p-0 max-sm:[&_tr:last-child]:border-b-0 max-sm:[&_tr]:grid max-sm:[&_tr]:gap-1 max-sm:[&_tr]:border-divider max-sm:[&_tr]:border-b max-sm:[&_tr]:px-4 max-sm:[&_tr]:py-3',
        )}
      >
        <thead className={cx(stack && 'max-sm:sr-only')}>
          <tr>
            {columns.map((column) => (
              <th
                key={column.label}
                scope="col"
                className="whitespace-nowrap border-divider border-b bg-subtle px-4 py-2.5 text-left font-bold"
              >
                <span className={cx(column.hidden && 'sr-only')}>{column.label}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&_tr:hover_td]:bg-subtle [&_tr:last-child_td]:border-b-0">{children}</tbody>
      </table>
    </div>
  );
}

/** A table cell: a main line and an optional smaller one under it; `action` hugs the right edge. */
export function Cell({
  children,
  sub,
  action,
  label,
}: {
  children: ReactNode;
  sub?: ReactNode;
  action?: boolean;
  /** shown before the content on phones when the Table stacks: the column's label */
  label?: string;
}) {
  return (
    <td
      className={cx(
        'border-divider border-b px-4 align-middle',
        action ? 'w-px whitespace-nowrap py-1 text-right' : 'py-3',
      )}
    >
      {label && <span className="font-bold sm:hidden">{label}: </span>}
      {children}
      {sub && <span className="block text-muted text-xs">{sub}</span>}
    </td>
  );
}

/** The line under a table: what is shown, in what order. */
export function TableFooter({ children }: { children: ReactNode }) {
  return <p className="border-divider border-t px-4 py-2.5 text-muted text-xs">{children}</p>;
}
