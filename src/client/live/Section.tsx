import type { ReactNode } from 'react';

export const Section = ({
  title,
  id,
  aside,
  children,
}: {
  title: string;
  id: string;
  aside?: ReactNode;
  children: ReactNode;
}) => (
  <section aria-labelledby={`${id}-title`} className="mt-14">
    <div className="mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
      <h2 id={`${id}-title`} className="text-xl font-bold text-primary-ink">
        {title}
      </h2>
      {aside}
    </div>
    {children}
  </section>
);
