import { test as base, expect, type Frame, type Page } from '@playwright/test';

export const ACCESS_CODE = 'e2e';

/** Any uncaught page error fails the test (e.g. a broken block definition breaks Blockly rendering). */
export const test = base.extend<{ pageErrors: string[] }>({
  pageErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await use(errors);
      expect(errors).toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };

/** Opens the app and waits until the Scratch VM is up and the chat accepts input. */
export const openApp = async (page: Page, code = ACCESS_CODE): Promise<Frame> => {
  await page.goto(`/?code=${code}`);
  await expect(page.getByPlaceholder(/Was soll ich bauen/)).toBeEnabled({ timeout: 30_000 });
  const editor = page.frame({ url: /editor\.html/ });
  if (!editor) throw new Error('editor iframe missing');
  await editor.waitForFunction(() => (window.ki?.vm.runtime.targets.length ?? 0) > 1);
  return editor;
};

export const send = async (page: Page, text: string): Promise<void> => {
  await page.getByPlaceholder(/Was soll ich bauen/).fill(text);
  await page.getByRole('button', { name: 'Senden', exact: true }).click();
};

/** Tool calls are hidden by default (kids see a friendly status line instead). */
export const showToolCalls = async (page: Page): Promise<void> => {
  const toggle = page.getByRole('button', { name: 'Werkzeuge anzeigen' });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
};
