import { ExternalLink, type LucideIcon } from 'lucide-react';
import { cx } from './cx.ts';

export interface LinkListItem {
  href: string;
  icon: LucideIcon;
  title: string;
  text: string;
}

/**
 * Links that leave the office (material in the kids' app), one row each inside an unpadded panel: the whole row
 * is the link and opens in a new tab, so the office stays open beside it.
 */
export function LinkList({ items, newTab }: { items: readonly LinkListItem[]; newTab: string }) {
  return (
    <ul className="divide-y divide-divider">
      {items.map(({ href, icon: Icon, title, text }, index) => (
        <li key={href}>
          <a
            href={href}
            target="_blank"
            rel="noopener"
            // the hover fill follows the panel's corners
            className={cx(
              'group flex items-center gap-4 px-4 py-3 hover:bg-subtle focus-visible:focus-ring',
              index === 0 && 'rounded-t-panel',
              index === items.length - 1 && 'rounded-b-panel',
            )}
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-field bg-primary-light text-primary-ink">
              <Icon aria-hidden className="size-5" />
            </span>
            <span className="grid min-w-0 gap-0.5">
              <span className="font-bold text-primary-hover group-hover:underline group-hover:underline-offset-2">
                {title}
              </span>
              <span className="text-muted text-sm">{text}</span>
            </span>
            <ExternalLink aria-hidden className="ml-auto size-4 shrink-0 text-muted" />
            <span className="sr-only"> {newTab}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
