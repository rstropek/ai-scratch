// KI-Energie: hearts limit the messages, the Gedächtnis gauge the context; the kid frees it by hand.
import { CONTEXT_LIMIT } from '../src/shared/energy.ts';
import { expect, openApp, send, test } from './helpers/app.ts';
import { answer, mockChat } from './helpers/mock-chat.ts';

const sendButton = (page: import('@playwright/test').Page) => page.locator('form button[type="submit"]');
const fullHearts = (page: import('@playwright/test').Page) =>
  page.getByTestId('heart').and(page.locator('[data-fill="full"]'));

test('three messages use up the hearts; one comes back after 20 seconds', async ({ page }) => {
  await page.clock.install();
  await mockChat(page, [answer('Eins'), answer('Zwei'), answer('Drei'), answer('Vier')]);
  await openApp(page);
  await expect(fullHearts(page)).toHaveCount(3);

  for (const text of ['a', 'b', 'c']) {
    await send(page, text);
    await expect(page.getByTestId('assistant-text').last()).not.toHaveText('');
  }
  await expect(page.getByTestId('assistant-text')).toHaveCount(3);
  await expect(fullHearts(page)).toHaveCount(0);
  await page.getByPlaceholder(/Was soll ich bauen/).fill('d');
  await expect(sendButton(page)).toHaveText(/Warte \d+ s/);
  await expect(sendButton(page)).toBeDisabled();

  await page.clock.fastForward(20_000);
  await expect(fullHearts(page)).toHaveCount(1);
  await expect(sendButton(page)).toHaveText('Senden');
  await sendButton(page).click();
  await expect(page.getByTestId('assistant-text').last()).toHaveText('Vier');
});

test('a full memory blocks sending until the kid summarizes or starts over', async ({ page }) => {
  const requests = await mockChat(page, [
    answer('Hallo!', { context: 10_000 }),
    answer('Gern.', { context: CONTEXT_LIMIT }),
    answer('Weiter gehts.', { context: 11_000 }),
  ]);
  const compactBodies: unknown[] = [];
  await page.route('**/api/compact', async (route) => {
    compactBodies.push(route.request().postDataJSON());
    await route.fulfill({ json: { summary: '**Dein Spiel**: Fang mich', tokens: 400 } });
  });
  await openApp(page);
  await send(page, 'Hallo');
  await expect(page.getByTestId('memory-percent')).toHaveText('13 %');
  await send(page, 'Bau weiter');

  const card = page.getByTestId('memory-card');
  await expect(card).toContainText('Mein Gedächtnis ist voll');
  await expect(page.getByTestId('memory-percent')).toHaveText('100 %');
  await page.getByPlaceholder(/Was soll ich bauen/).fill('Noch was');
  await expect(sendButton(page)).toBeDisabled();

  await card.getByRole('button', { name: 'Zusammenfassen' }).click();
  await expect(page.getByTestId('summary')).toContainText('Dein Spiel: Fang mich');
  await expect(card).toBeHidden();
  await expect(page.getByTestId('user-text')).toHaveCount(0);
  await expect(page.getByTestId('memory-percent')).toHaveText('13 %'); // estimate: 10,000 + 400
  expect(JSON.stringify(compactBodies[0])).toContain('Bau weiter');

  // the summary goes along with the next message
  await sendButton(page).click();
  await expect(page.getByTestId('assistant-text').last()).toHaveText('Weiter gehts.');
  expect(JSON.stringify(requests[2])).toContain('"summary":true');

  // starting over asks first, then the welcome is back
  await page.getByRole('button', { name: /^Gedächtnis:/ }).click();
  await page.getByRole('button', { name: 'Neu anfangen' }).click();
  await page.getByRole('button', { name: 'Ja, neu anfangen' }).click();
  await expect(page.getByTestId('welcome')).toBeVisible();
  await expect(page.getByTestId('summary')).toHaveCount(0);
  await expect(page.getByTestId('memory-percent')).toHaveText('13 %');
});
