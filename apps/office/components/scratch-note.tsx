import { texts } from '../lib/texts.ts';
import { Banner } from './ui/banner.tsx';
import { TextLink } from './ui/text-link.tsx';

const t = texts.scratchNote;

/** That AI-Scratch is not Scratch's own offering, at the foot of the login and the registration page. */
export function ScratchNote({ className }: { className?: string }) {
  return (
    <Banner tone="warning" title={t.title} announce={false} className={className}>
      <p>
        {t.text} <TextLink href="/terms#andere-dienste">{t.link}</TextLink>
      </p>
    </Banner>
  );
}
