// Sending email: Resend's HTTP API in production, JSON files in a folder for local development and e2e tests.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface Mail {
  to: string;
  subject: string;
  /** plain text only: links stay readable, and no HTML templates to maintain */
  text: string;
}

export type Mailer = (mail: Mail) => Promise<void>;

export const RESEND_URL = 'https://api.resend.com/emails';

export const createResendMailer =
  ({
    apiKey,
    from,
    replyTo,
    fetch: baseFetch = fetch,
  }: {
    apiKey: string;
    from: string;
    replyTo: string;
    fetch?: typeof fetch;
  }): Mailer =>
  async ({ to, subject, text }) => {
    const res = await baseFetch(RESEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ from, to: [to], reply_to: replyTo, subject, text }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Resend answered ${res.status}: ${(await res.text()).slice(0, 300)}`);
  };

/** one file per mail, named so that a directory listing sorts them by time */
export const createOutboxMailer =
  (dir: string): Mailer =>
  async (mail) => {
    await mkdir(dir, { recursive: true });
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`;
    await writeFile(path.join(dir, name), JSON.stringify(mail, null, 2));
    console.log(`mail: "${mail.subject}" to ${mail.to} written to ${path.join(dir, name)}`);
  };
