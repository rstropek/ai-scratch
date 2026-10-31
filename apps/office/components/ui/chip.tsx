import type { ReactNode } from 'react';

export type ChipTone = 'primary' | 'info' | 'success' | 'error' | 'neutral';

const tones: Record<ChipTone, string> = {
  primary: 'bg-primary-light text-primary-ink before:bg-primary',
  info: 'bg-info-light text-info-ink before:bg-info',
  success: 'bg-success-light text-success-ink before:bg-success',
  error: 'bg-error-light text-error-ink before:bg-error',
  neutral: 'bg-neutral-light text-foreground before:bg-neutral',
};

/** A status or role: a dot and a word, never colour alone. */
export function Chip({ tone, children }: { tone: ChipTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full py-0.75 pr-2.5 pl-2 font-bold text-xs before:size-2 before:rounded-full before:content-[''] ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
