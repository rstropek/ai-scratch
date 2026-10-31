import { CircleUserRound, Clock, LinkIcon } from 'lucide-react';
import Link from 'next/link';
import { buttonClass } from '../../../components/ui/button.tsx';
import { StatePanel } from '../../../components/ui/state-panel.tsx';
import { texts } from '../../../lib/texts.ts';

const t = texts.confirm;

/** A link that can't create an account (any more): what happened, and the way on. */
export function LinkProblem({ state }: { state: 'invalid' | 'expired' | 'exists' }) {
  if (state === 'exists')
    return (
      <StatePanel
        icon={CircleUserRound}
        title={t.existsTitle}
        actions={
          <Link href="/login" className={buttonClass()}>
            {t.toLogin}
          </Link>
        }
      >
        <p>{t.exists}</p>
      </StatePanel>
    );
  return (
    <StatePanel
      icon={state === 'expired' ? Clock : LinkIcon}
      tone="error"
      title={state === 'expired' ? t.expiredTitle : t.invalidTitle}
      actions={
        <Link href="/register" className={buttonClass()}>
          {t.again}
        </Link>
      }
    >
      <p>{state === 'expired' ? t.expired : t.invalid}</p>
    </StatePanel>
  );
}
