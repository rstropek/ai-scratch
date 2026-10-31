// The palette lists the variables the assistant creates. The GUI re-renders it only when the toolbox XML
// changes, and the VM creates these variables without the editor's events (ui-guide keepPaletteVariablesCurrent).
import { expect, openApp, send, test } from './helpers/app.ts';
import { answer, mockChat, toolCall } from './helpers/mock-chat.ts';

test('variables created by add_scripts appear in the palette, and disappear on undo', async ({ page }) => {
  await mockChat(page, [
    toolCall('add_scripts', {
      sprite: 'Sprite1',
      scripts: [[{ op: 'event_whenflagclicked' }, { op: 'data_setvariableto', VARIABLE: 'Verlauf', VALUE: '' }]],
    }),
    answer('Fertig!'),
  ]);
  const editor = await openApp(page);
  await editor.getByRole('treeitem', { name: 'Variablen' }).click();
  const palette = editor.locator('.blocklyFlyout');
  const verlauf = palette.locator('.blocklyFieldText:not(.blocklyDropdownText)', { hasText: /^Verlauf$/ });
  await expect(palette.getByText('Neue Variable')).toBeInViewport();

  await send(page, 'Mach eine Variable');
  await expect(page.getByTestId('assistant-text')).toHaveText(/Fertig/);
  // without clicking the category again: the palette stays where the kid scrolled it
  await expect(verlauf).toBeInViewport();

  await page.getByRole('button', { name: /Rückgängig/ }).click();
  await expect(page.getByTestId('undone')).toHaveCount(1);
  await expect(verlauf).toHaveCount(0);
  await expect(palette.getByText('Neue Variable')).toBeInViewport();
});
