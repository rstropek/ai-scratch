// The integration seam: unmodified Scratch GUI + chat + browser tools, with the model mocked.
import { expect, openApp, send, showToolCalls, test } from './helpers/app.ts';
import { answer, mockChat, toolCall } from './helpers/mock-chat.ts';

test('a chat turn adds blocks to the Scratch workspace and the VM runs them', async ({ page }) => {
  const requests = await mockChat(page, [
    toolCall('get_project'),
    toolCall('add_scripts', {
      sprite: 'Sprite1',
      scripts: [[{ op: 'event_whenflagclicked' }, { op: 'looks_say', MESSAGE: 'Hallo aus dem Test' }]],
    }),
    answer('Fertig! Die Katze sagt jetzt Hallo.'),
  ]);
  const editor = await openApp(page);
  await send(page, 'Die Katze soll Hallo sagen');

  await expect(page.getByTestId('assistant-text')).toHaveText(/Fertig/);
  // Blockly renders spaces as U+00A0, hence the regex
  await expect(editor.locator('.blocklyBlockCanvas text', { hasText: /Hallo.aus.dem.Test/ })).toBeVisible();
  // tool calls are hidden until the toggle is on
  await expect(page.getByTestId('tool-call')).toHaveCount(0);
  await showToolCalls(page);
  await expect(page.getByTestId('tool-call')).toHaveCount(2);

  // the first request carried the project snapshot, the second the get_project result
  const first = requests[0] as { messages: { metadata?: { project?: string } }[] };
  expect(JSON.parse(first.messages[0]?.metadata?.project ?? '{}').targets).toHaveLength(2);
  const second = JSON.stringify(requests[1]);
  expect(second).toContain('"state":"output-available"');
  expect(second).toContain('Sprite1');

  const said = await editor.evaluate(
    () =>
      new Promise((resolve) => {
        const vm = window.ki?.vm;
        vm?.runtime.once('SAY', (_target: unknown, _type: unknown, text: unknown) => resolve(text));
        vm?.greenFlag();
      }),
  );
  expect(said).toBe('Hallo aus dem Test');
});

test('a failing tool call is reported back to the model instead of breaking the chat', async ({ page }) => {
  const requests = await mockChat(page, [
    toolCall('add_scripts', { sprite: 'Sprite1', scripts: [[{ op: 'motion_movestep', STEPS: 10 }]] }),
    answer('Ups, ich habe es korrigiert.'),
  ]);
  await openApp(page);
  await showToolCalls(page);
  await send(page, 'Lauf!');
  await expect(page.getByTestId('assistant-text')).toHaveText(/korrigiert/);
  await expect(page.getByTestId('tool-call')).toContainText(/Did you mean: motion_movesteps/);
  expect(JSON.stringify(requests[1])).toContain('"state":"output-error"');
});
