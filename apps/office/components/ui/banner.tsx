import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { cx } from './cx.ts';

export type BannerTone = 'info' | 'success' | 'warning' | 'error';

const tones: Record<BannerTone, { className: string; Icon: typeof Info }> = {
  info: { className: 'border-info/45 bg-info-light text-info-ink', Icon: Info },
  success: { className: 'border-success/50 bg-success-light text-success-ink', Icon: CircleCheck },
  warning: { className: 'border-warning/70 bg-warning-light text-warning-ink', Icon: TriangleAlert },
  error: { className: 'border-error bg-error-light text-error-ink', Icon: CircleAlert },
};

type BannerProps = {
  tone: BannerTone;
  /** one bold line; the children explain it */
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
};

/** A message at the top of a page or form. Errors are announced at once (role alert), the rest politely. */
export function Banner({ tone, title, children, className }: BannerProps) {
  const { className: toneClass, Icon } = tones[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cx(
        'grid grid-cols-[1.25rem_1fr] items-start gap-3 rounded-panel border px-4 py-3 text-sm',
        toneClass,
        className,
      )}
    >
      <Icon aria-hidden className="size-5" />
      <div>
        {title && <p className="font-bold">{title}</p>}
        {children}
      </div>
    </div>
  );
}
