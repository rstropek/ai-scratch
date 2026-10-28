// The access gate: without the school's code (or a parent's OpenRouter key) only the chat is locked;
// Scratch works right away.
import type { Page } from '@playwright/test';
import { ACCESS_CODE, expect, test } from './helpers/app.ts';

const chatInput = (page: Page) => page.getByPlaceholder(/Was soll ich bauen|Scratch lädt/);
const codeField = (page: Page) => page.getByLabel('Zugangscode');
const keyField = (page: Page) => page.getByLabel('OpenRouter-Schlüssel');
const KEY = 'sk-or-v1-e2eNotARealKey0123';

test('without a code the chat asks for one while Scratch works; the right code opens the chat', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('access-welcome')).toBeVisible();
  await expect(chatInput(page)).toHaveCount(0);
  const editor = page.frame({ url: /editor\.html/ });
  if (!editor) throw new Error('editor iframe missing');
  await editor.waitForFunction(() => (window.ki?.vm.runtime.targets.length ?? 0) > 1);

  // no field until the kid says how they use the helper
  await expect(codeField(page)).toHaveCount(0);
  await page.getByRole('button', { name: /Ich habe einen Zugangscode/ }).click();
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
  // the refused turn is over: the folded rail doesn't claim the AI is still working
  await page.getByRole('button', { name: 'Chat einklappen' }).click();
  await expect(page.getByRole('button', { name: 'Chat öffnen' })).toBeVisible();
  await expect(page.getByTestId('rail-busy')).toHaveCount(0);
});

test("a parent's key: terms first, the server's answer for the parents, then the chat; forgotten on request", async ({
  page,
}) => {
  let access = { status: 403, body: { error: 'x', reason: 'no-limit' } as unknown };
  const sent: (string | null)[] = [];
  await page.route('**/api/access', (route) => {
    sent.push(route.request().headers()['x-access-code'] ?? null);
    return route.fulfill({ status: access.status, contentType: 'application/json', body: JSON.stringify(access.body) });
  });
  await page.goto('/');
  await page.getByRole('button', { name: /Ich nutze einen eigenen Schlüssel/ }).click();
  await expect(page.getByTestId('parents-sheet')).toContainText('Für Eltern');
  await keyField(page).fill(KEY);
  await page.getByRole('button', { name: 'Schlüssel prüfen und starten' }).click();
  await expect(page.getByRole('alert')).toHaveText('Bitte setzen Sie zuerst dieses Häkchen.');
  expect(sent).toEqual([]);

  await page.getByRole('button', { name: 'Nutzungsbedingungen ganz lesen' }).click();
  const terms = page.getByRole('dialog', { name: 'Nutzungsbedingungen' });
  await expect(terms).toContainText('Wir sichern keinen Ort der Verarbeitung zu.');
  await page.getByRole('button', { name: 'Gelesen, ich stimme zu' }).click();
  await expect(terms).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: /volljährig/ })).toBeChecked();

  await page.getByRole('button', { name: 'Schlüssel prüfen und starten' }).click();
  await expect(page.getByRole('alert')).toHaveText(/kein Ausgabelimit/);
  expect(sent).toEqual([KEY]);
  // still filled in and ticked: the parents fix the limit and try again
  await expect(keyField(page)).toHaveValue(KEY);
  access = { status: 204, body: undefined };
  await page.getByRole('button', { name: 'Schlüssel prüfen und starten' }).click();
  await expect(chatInput(page)).toBeEnabled({ timeout: 30_000 });

  // remembered with the consent: a reload goes straight to the chat
  page.on('dialog', (dialog) => void dialog.accept());
  await page.reload();
  await expect(chatInput(page)).toBeVisible();

  await page.getByRole('button', { name: 'Schlüssel vergessen' }).click();
  await page.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(chatInput(page)).toBeVisible();
  await page.getByRole('button', { name: 'Schlüssel vergessen' }).click();
  await page.getByRole('button', { name: 'Ja, vergessen' }).click();
  await expect(page.getByRole('button', { name: /Ich nutze einen eigenen Schlüssel/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: /Ich habe einen Zugangscode/ })).toBeVisible();
});

test('a key in the link is ignored: the parents enter it themselves', async ({ page }) => {
  await page.goto(`/?code=${KEY}`);
  await expect(page.getByRole('button', { name: /Ich nutze einen eigenen Schlüssel/ })).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});
