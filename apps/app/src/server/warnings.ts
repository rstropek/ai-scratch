// The 80 % warning (docs/budgets.md): when the free budget's month or a pool entry's cap reaches 80 %, every admin
// gets one email. Noticed at each snapshot refresh; the instance whose row in budget_warning wins sends it.
import {
  adminEmails,
  type BudgetSnapshot,
  claimWarning,
  type Database,
  type DueWarning,
  dueWarnings,
  WARN_SHARE,
} from '@ai-scratch/db';

export interface Mail {
  to: string[];
  subject: string;
  text: string;
}

export type SendMail = (mail: Mail) => Promise<void>;

export const RESEND_URL = 'https://api.resend.com/emails';

export const createResendMail =
  ({ apiKey, from, fetch: baseFetch = fetch }: { apiKey: string; from: string; fetch?: typeof fetch }): SendMail =>
  async ({ to, subject, text }) => {
    const res = await baseFetch(RESEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, text }),
    });
    if (!res.ok) throw new Error(`Resend answered ${res.status}: ${(await res.text()).slice(0, 300)}`);
  };

/** without RESEND_API_KEY (development): the warning only goes to the log */
export const logMail: SendMail = async (mail) => {
  console.warn(`mail: "${mail.subject}" to ${mail.to.join(', ')}\n${mail.text}`);
};

const dollars = (value: number) => `${value.toFixed(2)} $`;

/** German, for the admins */
export const warningMail = (warning: DueWarning, month: string, snapshot: BudgetSnapshot): Omit<Mail, 'to'> => {
  const entryId = warning.budget.startsWith('pool:') ? warning.budget.slice('pool:'.length) : undefined;
  const donor = entryId && snapshot.pool.find((entry) => entry.id === entryId)?.donor;
  const what = entryId ? `Der Pool-Eintrag von ${donor ?? entryId}` : 'Das kostenlose Guthaben (alle Konten zusammen)';
  return {
    subject: `AI-Scratch: 80 % eines Budgets erreicht (${month})`,
    text: [
      `${what} hat im Monat ${month} ${dollars(warning.spentUsd)} von ${dollars(warning.limitUsd)} verbraucht.`,
      entryId
        ? 'Bei 97,5 % nimmt die Kinder-App den nächsten Eintrag des Pools. Mehr unter office.ai-scratch.dev/admin/keys.'
        : 'Bei 100 % stoppt das kostenlose Guthaben bis zum Monatsende. Das Limit ist BUDGET_TOTAL_USD_MONTH.',
    ].join('\n\n'),
  };
};

/** called after each snapshot refresh; remembers what this instance already sent or saw claimed */
export const createWarnings = ({ db, send }: { db: Database; send: SendMail }) => {
  const done = new Set<string>();
  const warn = async (snapshot: BudgetSnapshot) => {
    for (const warning of dueWarnings(snapshot, WARN_SHARE)) {
      const key = `${warning.budget}|${snapshot.month}|${warning.limitUsd}`;
      if (done.has(key)) continue;
      done.add(key);
      if (!(await claimWarning(db, warning, snapshot.month))) continue;
      const to = await adminEmails(db);
      await send({ to, ...warningMail(warning, snapshot.month, snapshot) });
    }
  };
  return (snapshot: BudgetSnapshot): void => {
    warn(snapshot).catch((error: unknown) => console.error('warnings: sending a budget warning failed', error));
  };
};
