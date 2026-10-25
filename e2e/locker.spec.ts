import type { Frame, Page } from '@playwright/test';
import type { LockerGame } from '../src/shared/locker.ts';
import { expect, openApp, test } from './helpers/app.ts';

const CODE = 'K7QM4XRT';

/** /api/locker against an empty Locker in memory: what was saved comes back on load. */
const mockLocker = async (page: Page) => {
  const games: (LockerGame & { bytes: Buffer })[] = [];
  const saves: { url: URL; lockerCode: string | null }[] = [];
  const list = () => ({ games: games.map(({ bytes: _, ...g }) => g) });
  await page.route('**/api/locker**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'POST') {
      saves.push({ url, lockerCode: request.headers()['x-locker-code'] ?? null });
      const bytes = request.postDataBuffer() ?? Buffer.alloc(0);
      games.unshift({
        projectId: '00000000-0000-4000-8000-000000000001',
        fileId: '00000000-0000-4000-8000-000000000002',
        name: url.searchParams.get('name') ?? '',
        savedAt: new Date().toISOString(),
        size: bytes.length,
        bytes,
      });
      return route.fulfill({ json: list() });
    }
    if (url.pathname.startsWith('/api/locker/games/')) {
      return route.fulfill({ body: games[0]?.bytes, contentType: 'application/x.scratch.sb3' });
    }
    return route.fulfill({ json: list() });
  });
  return { games, saves };
};

const fileMenu = (editor: Frame) => editor.locator('[class*="menu-bar_menu-bar-item_"]', { hasText: 'Datei' }).click();

const spriteNames = (editor: Frame) =>
  editor.evaluate(() =>
    window.ki?.vm.runtime.targets.filter((t) => t.isOriginal && !t.isStage).map((t) => t.getName()),
  );

test("a game saved from Scratch's Datei menu loads back over a changed project", async ({ page }) => {
  const { saves } = await mockLocker(page);
  const editor = await openApp(page);

  // Scratch's own menu, with our two entries after its computer ones
  await fileMenu(editor);
  await expect(editor.locator('li[data-menu-item]')).toHaveText([
    'Neu',
    /computer/i,
    'Auf deinem Computer speichern',
    'Aus dem Locker laden',
    'Im Locker speichern',
    'Locker in neuem Tab öffnen',
  ]);
  await editor.getByText('Im Locker speichern').click();
  await expect(editor.locator('[data-locker]')).toHaveCount(0); // the menu closed

  const dialog = page.getByRole('dialog', { name: 'Im Locker speichern' });
  await dialog.getByLabel('Tipp deinen Locker-Code ein.').fill('k7qm 4xrt');
  await dialog.getByRole('button', { name: 'Locker öffnen' }).click();
  // Scratch's default title doesn't count as a name
  const name = dialog.getByLabel('Wie heißt dein Spiel?');
  await expect(name).toHaveValue('');
  await name.fill('Hai-Alarm');
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(dialog.getByText('Gespeichert!')).toBeVisible();
  await dialog.getByRole('button', { name: 'Fertig' }).click();
  await expect(dialog).toBeHidden();

  expect(saves).toHaveLength(1);
  expect(saves[0]?.lockerCode).toBe(CODE);
  expect(saves[0]?.url.searchParams.get('name')).toBe('Hai-Alarm');
  // the name became Scratch's title, so the computer save uses it too
  await expect(editor.locator('[class*="project-title-input"]')).toHaveValue('Hai-Alarm');

  // change the project, then load the saved one: the code is remembered for this tab
  await editor.evaluate(() => {
    const vm = window.ki?.vm as unknown as {
      renameSprite(id: string, name: string): void;
      editingTarget: { id: string };
    };
    vm.renameSprite(vm.editingTarget.id, 'Geändert');
  });
  expect(await spriteNames(editor)).toEqual(['Geändert']);
  await fileMenu(editor);
  await editor.getByText('Aus dem Locker laden').click();
  const load = page.getByRole('dialog', { name: 'Aus dem Locker laden' });
  await load.getByText('Hai-Alarm').click();
  await expect(load.getByRole('radio', { name: /Hai-Alarm/ })).toBeChecked();
  await load.getByRole('button', { name: 'Laden' }).click();
  await expect(load).toBeHidden();
  await expect.poll(() => spriteNames(editor)).toEqual(['Sprite1']);
  await expect(editor.locator('[class*="project-title-input"]')).toHaveValue('Hai-Alarm');

  // the code is known in this tab: the Locker's own page opens at once in a new tab
  await page.context().route('https://locker.coderdojo.net/**', (route) => route.fulfill({ body: 'Locker' }));
  await fileMenu(editor);
  const [tab] = await Promise.all([
    page.context().waitForEvent('page'),
    editor.getByText('Locker in neuem Tab öffnen').click(),
  ]);
  expect(tab.url()).toBe(`https://locker.coderdojo.net/locker/${CODE}`);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('without a code, "Locker in neuem Tab öffnen" asks for it, then opens the tab', async ({ page }) => {
  await page.context().route('https://locker.coderdojo.net/**', (route) => route.fulfill({ body: 'Locker' }));
  const editor = await openApp(page);
  await fileMenu(editor);
  await editor.getByText('Locker in neuem Tab öffnen').click();
  const dialog = page.getByRole('dialog', { name: 'Locker in neuem Tab öffnen' });
  await dialog.getByLabel('Tipp deinen Locker-Code ein.').fill('k7qm4xrt');
  const [tab] = await Promise.all([
    page.context().waitForEvent('page'),
    dialog.getByRole('button', { name: 'Locker öffnen' }).click(),
  ]);
  expect(tab.url()).toBe(`https://locker.coderdojo.net/locker/${CODE}`);
  await expect(dialog).toBeHidden();
});

test('the Locker entries work with the keyboard, and Escape closes the dialog', async ({ page }) => {
  await mockLocker(page);
  const editor = await openApp(page);
  await fileMenu(editor);
  await expect(editor.locator('[data-locker]')).toHaveCount(3);
  // Scratch focuses the first item; its menu hook moves through ours like through its own
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown');
  await expect(editor.locator('[data-locker="load"]')).toBeFocused();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Aus dem Locker laden' });
  await expect(dialog.getByLabel('Tipp deinen Locker-Code ein.')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});
