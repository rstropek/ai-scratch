import { Check, X } from 'lucide-react';
import { texts } from '../lib/texts.ts';
import { cx } from './ui/cx.ts';

const t = texts.whoMayRegister;

/** Who may register, as a yes/no list on the login and the registration page. The "no" line tells kids where their code comes from. */
export function WhoMayRegister({ className }: { className?: string }) {
  return (
    <ul aria-label={t.label} className={cx('grid gap-2 text-sm', className)}>
      {t.yes.map((who) => (
        <li key={who} className="grid grid-cols-[1.125rem_1fr] gap-2">
          <Check aria-hidden strokeWidth={2.5} className="mt-px size-4.5 text-success-ink" />
          <span>{who}</span>
        </li>
      ))}
      <li className="grid grid-cols-[1.125rem_1fr] gap-2">
        <X aria-hidden strokeWidth={2.5} className="mt-px size-4.5 text-danger" />
        <span>
          <strong className="block text-danger">{t.no}</strong>
          {t.kids}
        </span>
      </li>
    </ul>
  );
}
