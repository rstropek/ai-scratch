// Game keys after typing in the chat: the stage swallows mousedown (preventDefault), so a click on it
// alone would leave the focus in the chat input and the game would get no keys.
import { expect, openApp, send, test } from './helpers/app.ts';
import { answer, mockChat, toolCall } from './helpers/mock-chat.ts';

test('after typing in the chat, a click on the stage gives the game its arrow keys back', async ({ page }) => {
  await mockChat(page, [
    toolCall('add_scripts', {
      sprite: 'Sprite1',
      scripts: [
        [
          { op: 'event_whenkeypressed', KEY_OPTION: 'right arrow' },
          { op: 'motion_changexby', DX: 10 },
        ],
      ],
    }),
    answer('Fertig!'),
  ]);
  const editor = await openApp(page);
  await send(page, 'Pfeil rechts soll die Katze bewegen');
  await expect(page.getByTestId('assistant-text')).toHaveText(/Fertig/);
  const x = () => editor.evaluate(() => window.ki?.vm.runtime.targets.find((t) => t.getName() === 'Sprite1')?.x);

  await page.getByPlaceholder(/Was soll ich bauen/).click();
  await page.keyboard.press('ArrowRight');
  expect(await x()).toBe(0);

  // a corner of the stage, away from the cat (a click on a sprite would also work, but not test the empty stage)
  const stage = editor.locator('[class*="stage_stage"] canvas').first();
  await stage.click({ position: { x: 10, y: 10 } });
  await page.keyboard.press('ArrowRight');
  await expect.poll(x).toBe(10);
});
