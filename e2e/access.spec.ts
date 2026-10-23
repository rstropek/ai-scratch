// The access gate: without the school's code only the chat is locked; Scratch works right away.
import type { Page } from '@playwright/test';
import { ACCESS_CODE, expect, test } from './helpers/app.ts';

const chatInput = (page: Page) => page.getByPlaceholder(/Was soll ich bauen|Scratch lädt/);
const codeField = (page: Page) => page.getByLabel('Zugangscode');

test('without a code the chat asks for one while Scratch works; the right code opens the chat', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('access-welcome')).toBeVisible();
  await expect(chatInput(page)).toHaveCount(0);
  const editor = page.frame({ url: /editor\.html/ });
  if (!editor) throw new Error('editor iframe missing');
  await editor.waitForFunction(() => (window.ki?.vm.runtime.targets.length ?? 0) > 1);

  await codeField(page).fill('falsch');
  await codeField(page).press('Enter');
  await expect(page.getByRole('alert')).toHaveText(/Dieser Code stimmt nicht/);
  await expect(codeField(page)).toHaveValue('falsch');

  // kids type codes any way they like
  await codeField(page).fill(` ${ACCESS_CODE.toUpperCase()} `);
  await page.getByRole('button', { name: "Los geht's" }).click();
  await expect(chatInput(page)).toBeEnabled({ timeout: 30_000 });
  await expect(page.getByTestId('access-gate')).toHaveCount(0);

  // remembered: a reload goes straight to the chat
  page.on('dialog', (dialog) => void dialog.accept());
  await page.reload();
  await expect(chatInput(page)).toBeVisible();
  await expect(codeField(page)).toHaveCount(0);
});

test('a code in the link opens the chat and leaves the address bar', async ({ page }) => {
  await page.goto(`/?code=${ACCESS_CODE}`);
  await expect(chatInput(page)).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});

test('a wrong code in the link shows the gate with a hint', async ({ page }) => {
  await page.goto('/?code=falsch');
  await expect(page.getByRole('alert')).toHaveText(/Der Code im Link stimmt nicht/);
  await expect(codeField(page)).toHaveValue('');
  await expect(page).toHaveURL(/\/$/);
});

test('a code the server stops accepting sends the kid back to the gate', async ({ page }) => {
  await page.goto(`/?code=${ACCESS_CODE}`);
  await expect(chatInput(page)).toBeEnabled({ timeout: 30_000 });
  await page.route('**/api/chat', (route) =>
    route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"Falscher Zugangscode"}' }),
  );
  await chatInput(page).fill('Hallo');
  await page.getByRole('button', { name: 'Senden', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText(/Dein Code gilt nicht mehr/);
  await expect(codeField(page)).toBeVisible();
});
