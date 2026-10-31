import { expect, openApp, send, test } from './helpers/app.ts';
import { answer, mockChat, toolCall } from './helpers/mock-chat.ts';

const BALL =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60" width="60" height="60"><circle cx="30" cy="30" r="25" fill="#e33"/></svg>';

test('undo restores the project before an answer, with drawn costumes, and tells the model', async ({ page }) => {
  const requests = await mockChat(page, [
    toolCall('draw_sprite', { name: 'Ball', svg: BALL }),
    answer('Hier ist dein Ball.'),
    toolCall('add_scripts', {
      sprite: 'Ball',
      scripts: [[{ op: 'event_whenflagclicked' }, { op: 'looks_say', MESSAGE: 'Hopp' }]],
    }),
    answer('Der Ball sagt jetzt Hopp.'),
    answer('Alles klar.'),
  ]);
  const editor = await openApp(page);
  await send(page, 'Zeichne einen Ball');
  await expect(page.getByTestId('assistant-text')).toHaveText(/Ball/);
  await send(page, 'Er soll Hopp sagen');
  await expect(page.getByTestId('assistant-text').nth(1)).toHaveText(/Hopp/);
  const undoButtons = page.getByRole('button', { name: /Rückgängig/ });
  await expect(undoButtons).toHaveCount(2);

  const ball = () =>
    editor.evaluate(() => {
      const target = window.ki?.vm.runtime.targets.find((t) => t.isOriginal && t.getName() === 'Ball');
      return (
        target && { scripts: target.blocks.getScripts().length, svg: target.getCostumes()[0]?.asset?.decodeText() }
      );
    });
  expect((await ball())?.scripts).toBe(1);

  // undo the second answer: the script is gone, the drawn ball stays (not the question-mark placeholder)
  await undoButtons.nth(1).click();
  await expect(page.getByTestId('undone')).toHaveCount(1);
  await expect.poll(async () => (await ball())?.scripts).toBe(0);
  expect((await ball())?.svg).toContain('<circle');
  await expect(editor.locator('.blocklyBlockCanvas text', { hasText: /Hopp/ })).toHaveCount(0);
  await expect(undoButtons).toHaveCount(1);

  // the next request tells the model which answer was undone
  await send(page, 'Danke');
  await expect(page.getByTestId('assistant-text').nth(2)).toHaveText(/Alles klar/);
  const last = requests.at(-1) as { messages: { role: string; metadata?: { undone?: boolean } }[] };
  expect(last.messages.map((m) => m.metadata?.undone ?? false)).toEqual([false, false, false, true, false]);

  // undo the first answer as well: the ball is gone
  await undoButtons.first().click();
  await expect(page.getByTestId('undone')).toHaveCount(2);
  await expect.poll(ball).toBeUndefined();
  await expect(
    editor.locator('[class*="sprite-selector-item_sprite-selector-item_"]', { hasText: 'Ball' }),
  ).toHaveCount(0);
});
