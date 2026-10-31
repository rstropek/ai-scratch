import { expect, type Page, test } from '@playwright/test';
import { texts } from '../lib/texts.ts';
import { E2E_ADMIN } from './settings.ts';

const signIn = async (page: Page, password: string) => {
  await page.getByLabel(texts.login.email).fill(E2E_ADMIN.email);
  await page.getByLabel(texts.login.password).fill(password);
  await page.getByRole('button', { name: texts.login.submit }).click();
};

test('the start page needs a login', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/anmelden$/);
  await expect(page.getByRole('heading', { name: texts.login.title })).toBeVisible();
});

test('a wrong password is refused', async ({ page }) => {
  await page.goto('/anmelden');
  await signIn(page, 'not-the-password');
  // Next.js's route announcer is an alert too
  await expect(page.getByRole('alert').filter({ hasText: texts.login.failed })).toBeVisible();
  await expect(page).toHaveURL(/\/anmelden$/);
});

test('the admin signs in, sees the hello page, and signs out', async ({ page }) => {
  await page.goto('/anmelden');
  await signIn(page, E2E_ADMIN.password);
  await expect(page.getByRole('heading', { name: texts.home.greeting(E2E_ADMIN.name) })).toBeVisible();
  await expect(page.getByText(texts.home.admin)).toBeVisible();

  // a signed-in admin who opens the login page goes straight back
  await page.goto('/anmelden');
  await expect(page).toHaveURL(/\/$/);

  await page.getByRole('button', { name: texts.home.signOut }).click();
  await expect(page).toHaveURL(/\/anmelden$/);
  await page.goto('/');
  await expect(page).toHaveURL(/\/anmelden$/);
});
