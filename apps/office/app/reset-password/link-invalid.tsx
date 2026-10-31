import { LinkIcon } from 'lucide-react';
import Link from 'next/link';
import { buttonClass } from '../../components/ui/button.tsx';
import { StatePanel } from '../../components/ui/state-panel.tsx';
import { texts } from '../../lib/texts.ts';

/** A reset link that is used up or expired, with the way to a new one. */
export function LinkInvalid() {
  return (
    <StatePanel
      icon={LinkIcon}
      tone="error"
      title={texts.reset.invalidTitle}
      actions={
        <Link href="/forgot-password" className={buttonClass()}>
          {texts.reset.requestNew}
        </Link>
      }
    >
      <p>{texts.reset.invalid}</p>
    </StatePanel>
  );
}
