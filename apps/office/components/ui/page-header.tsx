import type { ReactNode } from 'react';

/** The page title, a line under it, and the page's main actions on the right. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div className="grid gap-1">
        <h1 className="text-balance font-bold text-2xl">{title}</h1>
        {description && <p className="text-sm">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2.5">{actions}</div>}
    </div>
  );
}
