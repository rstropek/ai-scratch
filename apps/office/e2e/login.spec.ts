import type { Page } from '@playwright/test';
import { texts } from '../lib/texts.ts';
import { expect, test } from './fixtures.ts';
import { E2E_ADMIN } from './settings.ts';

const signIn = async (page: Page, password: string) => {
  await page.getByLabel(texts.login.email).fill(E2E_ADMIN.email);
  await page.getByLabel(texts.login.password).fill(password);
  await page.getByRole('button', { name: texts.login.submit }).click();
};

test('the start page needs a login', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: texts.login.title })).toBeVisible();
});

test('the login page says who may register and leads there', async ({ page }) => {
  await page.goto('/login');
  const who = page.getByRole('list', { name: texts.whoMayRegister.label });
  await expect(who.getByText(texts.whoMayRegister.no)).toBeVisible();
  await expect(who.getByText(texts.whoMayRegister.kids)).toBeVisible();
  await expect(page.getByText(texts.scratchNote.title)).toBeVisible();
  await page.getByRole('link', { name: texts.login.register }).click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByRole('heading', { name: texts.register.title })).toBeVisible();
});

test('a wrong password is refused', async ({ page }) => {
  await page.goto('/login');
  await signIn(page, 'not-the-password');
  // Next.js's route announcer is an alert too
  await expect(page.getByRole('alert').filter({ hasText: texts.login.failed })).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test('the admin signs in, sees the start page, and signs out', async ({ page }) => {
  await page.goto('/login');
  await signIn(page, E2E_ADMIN.password);
  await expect(page.getByRole('heading', { name: texts.home.greeting(E2E_ADMIN.name) })).toBeVisible();
  await expect(page.getByText(texts.home.admin)).toBeVisible();

  // a signed-in admin who opens the login page goes straight back
  await page.goto('/login');
  await expect(page).toHaveURL(/\/$/);

  await page.getByRole('button', { name: texts.shell.signOut }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
});

test('the start page links the material in the kids app, the KI video directly', async ({ page }) => {
  await page.goto('/login');
  await signIn(page, E2E_ADMIN.password);
  const r = texts.home.resources;
  const material = page.getByRole('region', { name: r.title });
  const link = (title: string) => material.getByRole('link', { name: new RegExp(`^${title}`) });
  await expect(link(r.slides.title)).toHaveAttribute('href', 'https://ai-scratch.dev/slides/');
  await expect(link(r.videos.title)).toHaveAttribute('href', 'https://ai-scratch.dev/digiferien-2026-live');
  await expect(link(r.kiVideo.title)).toHaveAttribute('href', 'https://ai-scratch.dev/digiferien-2026-live?video=3');
  await expect(link(r.kiVideo.title)).toHaveAttribute('target', '_blank');
});
