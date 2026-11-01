// The admin's Anthropic key pool, against the fake Anthropic (fake-anthropic.ts): a key's prefix decides its answer,
// a federation's rule ID too.
import type { Page } from '@playwright/test';
import { texts } from '../lib/texts.ts';
import { expect, test } from './fixtures.ts';
import { registerAccount, signIn, uniqueEmail } from './helpers.ts';
import { E2E_ADMIN } from './settings.ts';

const k = texts.admin.keys;
const f = k.form;

/** a key no earlier run added: the e2e database outlives runs, and the pool refuses a key twice */
const uniqueKey = (kind: 'api03' | 'usr' | 'bad') =>
  `sk-ant-${kind}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

const fillKey = async (page: Page, { donor, key, cap }: { donor: string; key: string; cap: string }) => {
  await page.getByLabel(f.donor).fill(donor);
  await page.getByLabel(f.key).fill(key);
  await page.getByLabel(f.capEurMonth).fill(cap);
};

test('the admin adds a personal key with its workspace, pauses it and deletes it', async ({ page }) => {
  await signIn(page, E2E_ADMIN.email, E2E_ADMIN.password);
  await page.getByRole('link', { name: texts.shell.keys }).click();
  await page.getByRole('link', { name: k.add }).click();

  // a personal key without a workspace: Anthropic refuses the test call, nothing is stored
  const donor = `Spende ${Date.now().toString(36)}`;
  const key = uniqueKey('usr');
  await fillKey(page, { donor, key, cap: '40' });
  await page.getByRole('button', { name: f.add }).click();
  await expect(page.getByText(k.check.rejected.title)).toBeVisible();
  await expect(page.getByText(/anthropic-workspace-id header is required/)).toBeVisible();
  // the key never comes back to the browser, the other answers do
  await expect(page.getByLabel(f.key)).toHaveValue('');
  await expect(page.getByLabel(f.donor)).toHaveValue(donor);

  await page.getByLabel(f.key).fill(key);
  await page.getByLabel(f.workspaceId).fill('wrkspc_01E2eWorkspaceAbc');
  await page.getByRole('button', { name: f.add }).click();
  await expect(page.getByText(k.saved.added)).toBeVisible();
  const row = page.getByRole('row').filter({ hasText: donor });
  await expect(row).toContainText(`…${key.slice(-4)}`);
  await expect(row).toContainText('wrkspc_01E2eWorkspaceAbc');
  await expect(row).toContainText(k.cap(40));
  await expect(row.getByText(k.active, { exact: true })).toBeVisible();
  await expect(page.getByText(key)).toHaveCount(0);

  await row.getByRole('link', { name: new RegExp(k.edit) }).click();
  await expect(page.getByRole('heading', { name: donor })).toBeVisible();
  await page.getByLabel(f.active).uncheck();
  await page.getByLabel(f.priority).fill('7');
  await page.getByRole('button', { name: f.save }).click();
  await expect(page.getByText(k.saved.updated)).toBeVisible();
  await expect(row.getByText(k.paused, { exact: true })).toBeVisible();
  await expect(row).toContainText('7');

  await row.getByRole('link', { name: new RegExp(k.edit) }).click();
  await page.getByRole('button', { name: k.delete }).click();
  await page.getByRole('dialog').getByRole('button', { name: k.delete }).click();
  await expect(page.getByText(k.saved.deleted)).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: donor })).toHaveCount(0);
});

/** a rule no earlier run added: the pool refuses the same rule for the same workspace twice */
const uniqueRule = (kind: 'e2e' | 'bad') =>
  `fdrl_${kind}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

test('the admin adds a federation, edits it and deletes it', async ({ page }) => {
  await signIn(page, E2E_ADMIN.email, E2E_ADMIN.password);
  await page.getByRole('link', { name: texts.shell.keys }).click();
  await page.getByRole('link', { name: k.addFederation }).click();
  await expect(page.getByRole('heading', { name: k.addFederationTitle })).toBeVisible();

  // a rule that doesn't trust us: Anthropic refuses the exchange, nothing is stored
  const donor = `Föderation ${Date.now().toString(36)}`;
  await page.getByLabel(f.donor).fill(donor);
  await page.getByLabel(f.organizationId).fill('16c29832-2434-4718-a036-07dd4846877c');
  await page.getByLabel(f.federationRuleId).fill(uniqueRule('bad'));
  await page.getByLabel(f.workspaceId).fill('wrkspc_01E2eWorkspaceAbc');
  await page.getByLabel(f.capEurMonth).fill('200');
  await page.getByRole('button', { name: f.add }).click();
  await expect(page.getByText(k.check.exchange.title)).toBeVisible();
  await expect(page.getByLabel(f.donor)).toHaveValue(donor);

  const rule = uniqueRule('e2e');
  await page.getByLabel(f.federationRuleId).fill(rule);
  await page.getByRole('button', { name: f.add }).click();
  await expect(page.getByText(k.saved.added)).toBeVisible();
  const row = page.getByRole('row').filter({ hasText: donor });
  await expect(row).toContainText(k.federation);
  await expect(row).toContainText(`fdrl_…${rule.slice(-4)}`);
  await expect(row).toContainText('wrkspc_01E2eWorkspaceAbc');

  await row.getByRole('link', { name: new RegExp(k.edit) }).click();
  await expect(page.getByLabel(f.federationRuleId)).toHaveValue(rule);
  await page.getByLabel(f.priority).fill('900');
  await page.getByRole('button', { name: f.save }).click();
  await expect(page.getByText(k.saved.updated)).toBeVisible();
  await expect(row).toContainText('900');

  await row.getByRole('link', { name: new RegExp(k.edit) }).click();
  await page.getByRole('button', { name: k.delete }).click();
  await expect(page.getByRole('dialog')).toContainText(k.deleteFederationText(donor, `fdrl_…${rule.slice(-4)}`));
  await page.getByRole('dialog').getByRole('button', { name: k.delete }).click();
  await expect(page.getByText(k.saved.deleted)).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: donor })).toHaveCount(0);
});

test('a key Anthropic does not know is refused', async ({ page }) => {
  await signIn(page, E2E_ADMIN.email, E2E_ADMIN.password);
  await page.goto('/admin/keys/new');
  await fillKey(page, { donor: 'Niemand', key: uniqueKey('bad'), cap: '10' });
  await page.getByRole('button', { name: f.add }).click();
  await expect(page.getByText(k.check.invalid.title)).toBeVisible();
});

test('the form names what is wrong before asking Anthropic', async ({ page }) => {
  await signIn(page, E2E_ADMIN.email, E2E_ADMIN.password);
  await page.goto('/admin/keys/new');
  await page.getByLabel(f.key).fill('sk-or-v1-openrouter');
  await page.getByLabel(f.workspaceId).fill('ws-1');
  await page.getByRole('button', { name: f.add }).click();
  await expect(page.getByText(k.validation.donor(100))).toBeVisible();
  await expect(page.getByText(k.validation.key)).toBeVisible();
  await expect(page.getByText(k.validation.workspaceId)).toBeVisible();
  await expect(page.getByText(k.validation.cap(10_000))).toBeVisible();
});

test('only admins see the key pool', async ({ page }) => {
  await registerAccount(page, { email: uniqueEmail('nokeys'), kind: 'parent', firstName: 'Nora', lastName: 'Neugier' });
  await expect(page.getByRole('heading', { name: texts.home.greeting('Nora Neugier') })).toBeVisible();
  await expect(page.getByRole('link', { name: texts.shell.keys })).toHaveCount(0);
  await page.goto('/admin/keys');
  await expect(page.getByRole('heading', { name: texts.admin.forbiddenTitle })).toBeVisible();
  await page.goto('/admin/keys/new');
  await expect(page.getByRole('heading', { name: texts.admin.forbiddenTitle })).toBeVisible();
});
