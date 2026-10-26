import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const Section = ({
  title,
  id,
  level = 2,
  aside,
  children,
}: {
  title: string;
  id: string;
  level?: 2 | 3;
  aside?: ReactNode;
  children: ReactNode;
}) => {
  const Heading = level === 2 ? 'h2' : 'h3';
  return (
    <section aria-labelledby={`${id}-title`} className="mt-14">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <Heading id={`${id}-title`} className={cn('font-bold text-primary-ink', level === 2 ? 'text-2xl' : 'text-xl')}>
          {title}
        </Heading>
        {aside}
      </div>
      {children}
    </section>
  );
};
