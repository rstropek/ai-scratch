// Own OpenRouter keys, access codes and the model price, against the fake OpenRouter in fake-anthropic.ts: a key's
// prefix decides what OpenRouter says it has left.
import type { Page } from '@playwright/test';
import { texts } from '../lib/texts.ts';
import { FAKE_HAIKU_PRICE } from './fake-anthropic.ts';
import { expect, test } from './fixtures.ts';
import { registerAccount, signIn, uniqueEmail } from './helpers.ts';
import { E2E_ADMIN } from './settings.ts';

const h = texts.home;
const c = texts.codes;
const o = texts.openrouterKeys;
const p = texts.admin.prices;

/** a key no earlier run added; the prefix tells the fake OpenRouter how to answer */
const uniqueKey = (kind: 'bad' | 'big' | 'e2e') =>
  `sk-or-v1-${kind}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

const addKey = async (page: Page, label: string, key: string) => {
  await page.getByLabel(o.label).fill(label);
  await page.getByLabel(o.key).fill(key);
  await page.getByRole('button', { name: o.add }).click();
};

/** the proposal the form shows, as kids type it */
const proposedCode = async (page: Page) => (await page.locator('output').textContent())?.trim() ?? '';

test('a parent adds an own OpenRouter key, creates a code from it and deletes the code', async ({ page }) => {
  await registerAccount(page, { email: uniqueEmail('ownkey'), kind: 'parent', firstName: 'Olga', lastName: 'Eigen' });
  await expect(page.getByRole('heading', { name: h.greeting('Olga Eigen') })).toBeVisible();
  await page.getByRole('link', { name: texts.shell.openrouterKeys, exact: true }).click();

  await addKey(page, 'Zuhause', uniqueKey('bad'));
  await expect(page.getByText(o.check.invalid.title)).toBeVisible();
  const key = uniqueKey('e2e');
  await addKey(page, 'Zuhause', key);
  await expect(page.getByText(o.added)).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'Zuhause' })).toContainText(texts.remaining.usd(5));
  await expect(page.getByText(key)).toHaveCount(0);
  await addKey(page, 'Groß', uniqueKey('big'));
  await expect(page.getByRole('row').filter({ hasText: 'Groß' })).toContainText(texts.remaining.usd(100));

  await page.getByRole('link', { name: texts.shell.home, exact: true }).click();
  await page.getByRole('link', { name: h.newCode }).click();
  // a key with more than $25 left backs no code
  await page.getByLabel(/Groß/).check();
  await page.getByRole('button', { name: c.submit }).click();
  await expect(page.getByText(c.refusals['key-too-much'].title)).toBeVisible();

  await page.getByLabel(/Zuhause/).check();
  const code = await proposedCode(page);
  await page.getByLabel(c.comment).fill('4b Dienstag');
  await page.getByLabel(c.hoursLabel(2)).check();
  await page.getByRole('button', { name: c.submit }).click();
  await expect(page.getByText(h.created(code))).toBeVisible();
  const row = page.getByRole('row').filter({ hasText: code });
  await expect(row).toContainText('4b Dienstag');
  await expect(row).toContainText(c.state.running);
  await expect(row).toContainText(c.spent(0, 5));

  await row.getByRole('button', { name: c.delete }).click();
  await page.getByRole('dialog').getByRole('button', { name: c.delete }).click();
  await expect(page.getByText(h.codeDeleted)).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: code })).toHaveCount(0);
});

test('the admin creates a code from the free budget, sees it in all codes and fetches the price', async ({ page }) => {
  await signIn(page, E2E_ADMIN.email, E2E_ADMIN.password);
  await page.getByRole('link', { name: h.newCode }).click();
  // admins use the free budget without it being switched on
  await expect(page.getByLabel(c.sourceFree, { exact: true })).toBeChecked();
  const first = await proposedCode(page);
  await page.getByRole('button', { name: c.propose }).click();
  await expect(page.locator('output')).not.toHaveText(first);
  const code = await proposedCode(page);
  await page.getByRole('button', { name: c.submit }).click();
  await expect(page.getByText(h.created(code))).toBeVisible();

  await page.getByRole('link', { name: texts.shell.codes }).click();
  const row = page.getByRole('row').filter({ hasText: code });
  await expect(row).toContainText(E2E_ADMIN.name);
  await expect(row).toContainText(c.sourceShort.free);
  await row.getByRole('button', { name: c.delete }).click();
  await page.getByRole('dialog').getByRole('button', { name: c.delete }).click();
  await expect(page.getByText(h.codeDeleted)).toBeVisible();

  await page.getByRole('link', { name: texts.shell.prices }).click();
  await page.getByRole('button', { name: p.fetch }).click();
  await expect(page.getByText(p.fetched.title)).toBeVisible();
  await expect(page.getByLabel(p.input, { exact: true })).toHaveValue(String(FAKE_HAIKU_PRICE.input));
  await expect(page.getByLabel(p.cacheWrite, { exact: true })).toHaveValue(String(FAKE_HAIKU_PRICE.cacheWrite));
  await page.getByRole('button', { name: p.save }).click();
  await expect(page.getByText(p.saved)).toBeVisible();
  await expect(page.getByLabel(p.cacheRead, { exact: true })).toHaveValue(String(FAKE_HAIKU_PRICE.cacheRead));
});
