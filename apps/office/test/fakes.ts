// Stand-ins for the office's outside services in unit tests: a mailer that keeps what it sent.
import type { Mail, Mailer } from '../lib/mail.ts';

export const fakeMailer = (): Mailer & { sent: Mail[]; last: () => Mail | undefined } => {
  const sent: Mail[] = [];
  const mailer = async (mail: Mail) => {
    sent.push(mail);
  };
  return Object.assign(mailer, { sent, last: () => sent.at(-1) });
};

/** the first link to the office in a mail's text */
export const linkIn = (mail: Mail | undefined, path: string): string => {
  const match = mail?.text.match(new RegExp(`https?://\\S+${path.replace(/[/?]/g, '\\$&')}\\S*`));
  if (!match) throw new Error(`no ${path} link in mail: ${mail?.text}`);
  return match[0];
};
