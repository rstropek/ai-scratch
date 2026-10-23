// Picture tools against the real editor (drawn SVG; library items need the Scratch CDN, so they are
// covered by unit tests with an offline library instead).
import { expect, openApp, send, test } from './helpers/app.ts';
import { answer, mockChat, toolCall } from './helpers/mock-chat.ts';

const BALL =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60" width="60" height="60"><circle cx="30" cy="30" r="25" fill="red"/></svg>';

test('a drawn sprite appears with its own thumbnail, not the "?" placeholder', async ({ page }) => {
  await mockChat(page, [toolCall('draw_sprite', { name: 'Ball', svg: BALL }), answer('Hier ist dein Ball.')]);
  const editor = await openApp(page);
  await send(page, 'Zeichne einen roten Ball');
  await expect(page.getByTestId('assistant-text')).toHaveText(/Ball/);

  const ball = editor.locator('[class*="sprite-selector-item_sprite-selector-item_"]', { hasText: 'Ball' });
  await expect(ball).toBeVisible();
  // the placeholder asset is an <?xml …> SVG with a question mark; the drawn one is our circle
  await expect
    .poll(async () => {
      const src = (await ball.locator('[class*="sprite-selector-item_sprite-image"] img').getAttribute('src')) ?? '';
      return Buffer.from(src.split(',')[1] ?? '', 'base64').toString();
    })
    .toContain('fill="red"');
});
