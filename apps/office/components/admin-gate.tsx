import { ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { texts } from '../lib/texts.ts';
import { buttonClass } from './ui/button.tsx';
import { StatePanel } from './ui/state-panel.tsx';

/** What a signed-in non-admin sees on an admin page. */
export function NotAdmin({ name }: { name: string }) {
  return (
    <StatePanel
      icon={ShieldAlert}
      title={texts.admin.forbiddenTitle}
      actions={
        <Link href="/" className={buttonClass('secondary', 'sm')}>
          {texts.admin.toHome}
        </Link>
      }
    >
      <p>{texts.admin.forbidden(name)}</p>
    </StatePanel>
  );
}
