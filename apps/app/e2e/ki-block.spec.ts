// The "frage KI" block: our own extension inside the unmodified editor, asking through the host's code and hearts.
import { ASK_NO_CODE } from '../src/shared/ki-block.ts';
import { expect, openApp, send, test } from './helpers/app.ts';
import { answer, mockChat, toolCall } from './helpers/mock-chat.ts';

const fullHearts = (page: import('@playwright/test').Page) =>
  page.getByTestId('heart').and(page.locator('[data-fill="full"]'));

/** green flag, then the first thing a sprite says */
const firstSay = (editor: import('@playwright/test').Frame) =>
  editor.evaluate(
    () =>
      new Promise((resolve) => {
        const vm = window.ki?.vm;
        vm?.runtime.once('SAY', (_target: unknown, _type: unknown, text: unknown) => resolve(text));
        vm?.greenFlag();
      }),
  );

test('the KI category sits in the palette and renders its block', async ({ page }) => {
  const editor = await openApp(page);
  await editor.getByRole('treeitem', { name: 'KI' }).click();
  await expect(editor.getByText(/^frage.KI$/)).toBeVisible();
});

test('a chatbot built in the chat asks /api/ask with the code and costs a heart from the chat', async ({ page }) => {
  await mockChat(page, [
    toolCall('add_scripts', {
      sprite: 'Sprite1',
      scripts: [
        [{ op: 'event_whenflagclicked' }, { op: 'looks_say', MESSAGE: { op: 'ki_ask', QUESTION: 'Hallo KI' } }],
      ],
    }),
    answer('Klick auf die grüne Flagge!'),
  ]);
  const asks: { body: unknown; code: string | null }[] = [];
  await page.route('**/api/ask', async (route) => {
    asks.push({ body: route.request().postDataJSON(), code: await route.request().headerValue('X-Access-Code') });
    await route.fulfill({ json: { answer: 'Hallo! Ich bin die KI.' } });
  });
  const editor = await openApp(page);
  await send(page, 'Ich will einen Chatbot');
  await expect(page.getByTestId('assistant-text')).toHaveText(/grüne Flagge/);
  await expect(fullHearts(page)).toHaveCount(2);

  expect(await firstSay(editor)).toBe('Hallo! Ich bin die KI.');
  expect(asks).toEqual([{ body: { question: 'Hallo KI' }, code: 'e2e' }]);
  await expect(fullHearts(page)).toHaveCount(1);
});

test('without a code the block says how to get one', async ({ page }) => {
  await page.goto('/');
  await expect.poll(() => page.frame({ url: /editor\.html/ })).toBeTruthy();
  const editor = page.frame({ url: /editor\.html/ });
  if (!editor) throw new Error('editor iframe missing');
  await editor.waitForFunction(() => (window.ki?.vm.runtime.targets.length ?? 0) > 1, undefined, { timeout: 30_000 });
  await editor.evaluate(async () => {
    const vm = window.ki?.vm;
    const target = vm?.editingTarget;
    if (!vm || !target) return;
    await vm.shareBlocksToTarget(
      [
        {
          id: 'hat',
          opcode: 'event_whenflagclicked',
          next: 'say',
          parent: null,
          inputs: {},
          fields: {},
          shadow: false,
          topLevel: true,
          x: 0,
          y: 0,
        },
        {
          id: 'say',
          opcode: 'looks_say',
          next: null,
          parent: 'hat',
          inputs: { MESSAGE: { name: 'MESSAGE', block: 'ask', shadow: null } },
          fields: {},
          shadow: false,
          topLevel: false,
        },
        {
          id: 'ask',
          opcode: 'ki_ask',
          next: null,
          parent: 'say',
          inputs: { QUESTION: { name: 'QUESTION', block: 'text', shadow: 'text' } },
          fields: {},
          shadow: false,
          topLevel: false,
        },
        {
          id: 'text',
          opcode: 'text',
          next: null,
          parent: 'ask',
          inputs: {},
          fields: { TEXT: { name: 'TEXT', value: 'Hallo' } },
          shadow: true,
          topLevel: false,
        },
      ] as never,
      target.id,
    );
    vm.refreshWorkspace(); // like add_scripts: the workspace shows (and glows) the new blocks
  });
  expect(await firstSay(editor)).toBe(ASK_NO_CODE);
});
