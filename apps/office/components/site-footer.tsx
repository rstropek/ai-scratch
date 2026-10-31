import { SOURCE_URL } from '../lib/site.ts';
import { texts } from '../lib/texts.ts';
import { TextLink } from './ui/text-link.tsx';

/** The links to the public info pages, under every page. */
export function SiteFooter() {
  return (
    <footer className="mx-auto max-w-6xl px-4 pt-4 pb-8 text-sm">
      <nav aria-label={texts.footer.label}>
        <ul className="flex flex-wrap gap-x-5 gap-y-2">
          <li>
            <TextLink href="/terms">{texts.footer.terms}</TextLink>
          </li>
          <li>
            <TextLink href={SOURCE_URL}>{texts.footer.source}</TextLink>
          </li>
        </ul>
      </nav>
    </footer>
  );
}
