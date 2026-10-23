// The chat panel's layout controls: welcome, hidden tool calls, resizable width and input, folding,
// font size, and that all of it is remembered. Runs at a typical school laptop size.
import type { Locator, Page } from '@playwright/test';
import { expect, openApp, send, test } from './helpers/app.ts';
import { answer, mockChat, toolCall } from './helpers/mock-chat.ts';

test.use({ viewport: { width: 1366, height: 768 } });

const separator = (page: Page, name: string) => page.getByRole('separator', { name });
const value = async (handle: Locator) => Number(await handle.getAttribute('aria-valuenow'));

const drag = async (page: Page, handle: Locator, dx: number, dy: number) => {
  const box = await handle.boundingBox();
  if (!box) throw new Error('handle not visible');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  // several steps, the last ones over the Scratch iframe
  await page.mouse.move(x + dx, y + dy, { steps: 8 });
  await page.mouse.up();
};

test('a new chat shows the welcome and no example prompts', async ({ page }) => {
  await openApp(page);
  await expect(page.getByTestId('welcome')).toContainText('Ich bin dein KI-Helfer');
  await expect(page.getByRole('button', { name: /Fledermaus|Drachen/ })).toHaveCount(0);
});

test('tool calls and token numbers are hidden by default', async ({ page }) => {
  await mockChat(page, [
    toolCall('add_scripts', { sprite: 'Sprite1', scripts: [[{ op: 'event_whenflagclicked' }]] }),
    answer('Fertig!'),
  ]);
  await openApp(page);
  await send(page, 'Bau was');
  await expect(page.getByTestId('assistant-text')).toHaveText('Fertig!');
  await expect(page.getByTestId('welcome')).toHaveCount(0);
  await expect(page.getByTestId('tool-call')).toHaveCount(0);
  await expect(page.getByTestId('working')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Werkzeuge anzeigen' })).toHaveAttribute('aria-pressed', 'false');
});

test('the chat width follows the splitter, also by keyboard, and Scratch keeps working', async ({ page }) => {
  const editor = await openApp(page);
  const handle = separator(page, 'Chat-Breite ändern');
  const iframe = page.locator('iframe[title="Scratch"]');
  expect(await value(handle)).toBe(380);

  await drag(page, handle, 150, 0);
  expect(await value(handle)).toBe(530);
  expect((await iframe.boundingBox())?.x).toBeGreaterThan(530);
  // 640px is the limit (half the window only bites on smaller screens)
  await drag(page, handle, 400, 0);
  expect(await value(handle)).toBe(640);
  await expect(iframe).toHaveCSS('pointer-events', 'auto');

  await handle.press('ArrowLeft');
  expect(await value(handle)).toBe(624);
  await handle.dblclick();
  expect(await value(handle)).toBe(380);

  // the editor relaid out and still runs
  await expect(editor.locator('.blocklyFlyout')).toBeVisible();
  expect(await editor.evaluate(() => window.ki?.vm.runtime.targets.length)).toBe(2);
});

test('folding keeps the conversation and the rail opens it again', async ({ page }) => {
  await mockChat(page, [answer('Hallo zurück!')]);
  await openApp(page);
  await send(page, 'Hallo');
  await expect(page.getByTestId('assistant-text')).toHaveText('Hallo zurück!');

  await page.getByRole('button', { name: 'Chat einklappen' }).click();
  await expect(page.getByTestId('assistant-text')).toBeHidden();
  const iframe = page.locator('iframe[title="Scratch"]');
  expect((await iframe.boundingBox())?.x).toBeLessThan(60);

  await page.getByRole('button', { name: 'Chat öffnen' }).click();
  await expect(page.getByTestId('assistant-text')).toHaveText('Hallo zurück!');
});

test('font size buttons scale the chat text', async ({ page }) => {
  await openApp(page);
  const welcome = page.getByTestId('welcome');
  await expect(welcome).toHaveCSS('font-size', '16px');
  await page.getByRole('button', { name: 'Schrift größer' }).click();
  await expect(welcome).toHaveCSS('font-size', '18px');
  await expect(page.getByPlaceholder(/Was soll ich bauen/)).toHaveCSS('font-size', '18px');
  const smaller = page.getByRole('button', { name: 'Schrift kleiner' });
  await smaller.click();
  await smaller.click();
  await expect(welcome).toHaveCSS('font-size', '14px');
  await expect(smaller).toBeDisabled();
});

test('the input grows when its splitter is dragged up', async ({ page }) => {
  await openApp(page);
  const input = page.getByPlaceholder(/Was soll ich bauen/);
  const before = (await input.boundingBox())?.height ?? 0;
  await drag(page, separator(page, 'Eingabefeld-Höhe ändern'), 0, -100);
  const after = (await input.boundingBox())?.height ?? 0;
  expect(after - before).toBeCloseTo(100, -1);
});

test('layout settings are remembered for the next page load', async ({ page, context }) => {
  await openApp(page);
  await drag(page, separator(page, 'Chat-Breite ändern'), 100, 0);
  await page.getByRole('button', { name: 'Schrift größer' }).click();
  await page.getByRole('button', { name: 'Werkzeuge anzeigen' }).click();

  const next = await context.newPage();
  await openApp(next);
  expect(await value(separator(next, 'Chat-Breite ändern'))).toBe(480);
  await expect(next.getByTestId('welcome')).toHaveCSS('font-size', '18px');
  await expect(next.getByRole('button', { name: 'Werkzeuge anzeigen' })).toHaveAttribute('aria-pressed', 'true');
});
