import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { createDb, createPool, schema } from '@ai-scratch/db';
import type { Page } from '@playwright/test';
import { eq } from 'drizzle-orm';
import type { Mail } from '../lib/mail.ts';
import { texts } from '../lib/texts.ts';
import { expect } from './fixtures.ts';
import { E2E_DATABASE_URL, E2E_OUTBOX } from './settings.ts';

/** an address no earlier run used: the e2e database and the outbox outlive runs */
export const uniqueEmail = (who: string) =>
  `${who}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}@example.com`;

/** the newest mail to an address whose subject matches, as the server wrote it to the outbox */
export const mailTo = async (to: string, subject: string): Promise<Mail> => {
  let found: Mail | undefined;
  await expect
    .poll(
      async () => {
        const files = (await readdir(E2E_OUTBOX).catch(() => [] as string[])).sort().reverse();
        for (const file of files) {
          const mail = JSON.parse(await readFile(path.join(E2E_OUTBOX, file), 'utf8')) as Mail;
          if (mail.to === to && mail.subject === subject) {
            found = mail;
            return true;
          }
        }
        return false;
      },
      { timeout: 10_000 },
    )
    .toBe(true);
  return found as Mail;
};

export const linkIn = (mail: Mail, path: string): string => {
  const link = mail.text.split(/\s+/).find((word) => word.includes(path));
  if (!link) throw new Error(`no ${path} link in: ${mail.text}`);
  return link;
};

export const signIn = async (page: Page, email: string, password: string) => {
  await page.goto('/login');
  await page.getByLabel(texts.login.email).fill(email);
  await page.getByLabel(texts.login.password).fill(password);
  await page.getByRole('button', { name: texts.login.submit }).click();
  await expect(page).toHaveURL(/\/$/);
};

export const PASSWORD = 'e2e correct horse battery';

/** registers through the form and the confirmation link; ends signed in, on the start page or (free budget) /apply */
export const registerAccount = async (
  page: Page,
  {
    email,
    kind,
    firstName,
    lastName,
    freeBudget = false,
  }: { email: string; kind: 'parent' | 'teacher'; firstName: string; lastName: string; freeBudget?: boolean },
) => {
  const r = texts.register;
  await page.goto('/register');
  await page.getByLabel(r.email).fill(email);
  await page.getByLabel(r.kindLabels[kind]).check();
  if (freeBudget) await page.getByLabel(r.freeBudget).check();
  await page.getByLabel(r.adult).check();
  await page.getByRole('checkbox', { name: new RegExp(r.termsAfter.trim()) }).check();
  await page.getByRole('checkbox', { name: new RegExp(r.aiConsentLink) }).check();
  // the dummy Turnstile widget passes on its own; its token must be there before the submit
  await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/, { timeout: 15_000 });
  await page.getByRole('button', { name: r.submit }).click();
  await expect(page.getByRole('heading', { name: r.sentTitle })).toBeVisible();

  const link = linkIn(await mailTo(email, texts.mail.confirm('').subject), '/register/confirm?t=');
  await page.goto(link);
  const c = texts.confirm;
  await page.getByLabel(c.firstName).fill(firstName);
  await page.getByLabel(c.lastName).fill(lastName);
  await page.getByLabel(c.password, { exact: true }).fill(PASSWORD);
  await page.getByLabel(c.passwordRepeat).fill(PASSWORD);
  await page.getByRole('button', { name: c.submit }).click();
  return link;
};

/** as if the account had accepted an older version of the terms */
export const ageTerms = async (email: string) => {
  const pool = createPool({ DATABASE_URL: E2E_DATABASE_URL });
  try {
    const db = createDb(pool);
    const [user] = await db.select({ id: schema.user.id }).from(schema.user).where(eq(schema.user.email, email));
    await db
      .update(schema.adultProfile)
      .set({ termsVersion: '2000-01-01' })
      .where(eq(schema.adultProfile.userId, user?.id ?? ''));
  } finally {
    await pool.end();
  }
};
