import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cx } from './cx.ts';

export type StateTone = 'success' | 'neutral' | 'error';

const discs: Record<StateTone, string> = {
  success: 'bg-success text-white',
  neutral: 'bg-ground text-muted',
  error: 'bg-error-light text-error-ink',
};

/** A whole-page state instead of content: sent, done, not allowed, link expired. An icon in a disc, a title, a line. */
export function StatePanel({
  icon: Icon,
  tone = 'neutral',
  title,
  children,
  actions,
}: {
  icon: LucideIcon;
  tone?: StateTone;
  title: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="grid justify-items-start gap-4 rounded-panel border border-divider bg-surface p-6">
      <span className={cx('grid size-12 place-items-center rounded-full', discs[tone])}>
        <Icon aria-hidden className="size-6" />
      </span>
      <h1 className="text-balance font-bold text-2xl">{title}</h1>
      {children && <div className="grid max-w-prose gap-2">{children}</div>}
      {actions && <div className="flex flex-wrap gap-2.5">{actions}</div>}
    </div>
  );
}
