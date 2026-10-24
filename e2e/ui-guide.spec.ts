// The UI pointer relies on the one internal hook (ScratchBlocks found in the webpack runtime) and on
// CSS-module class prefixes of scratch-gui: the parts most likely to break on a Scratch update.
import { expect, openApp, send, test } from './helpers/app.ts';
import { answer, mockChat, toolCall, toolCalls } from './helpers/mock-chat.ts';

test('the assistant points at a palette block via a tool call', async ({ page }) => {
  await mockChat(page, [
    toolCall('point_to_palette_block', { opcode: 'control_forever', label: 'Diesen Block brauchst du' }),
    answer('Schau, hier!'),
  ]);
  const editor = await openApp(page);
  await send(page, 'Wo finde ich wiederhole fortlaufend?');
  await expect(editor.locator('.ki-label')).toHaveText(/Diesen Block brauchst du/);
  await expect(page.getByTestId('assistant-text')).toHaveText(/Schau, hier/);
});

test('the palette pointer scrolls far-down blocks into view', async ({ page }) => {
  const editor = await openApp(page);
  await editor.evaluate(() => window.ki?.uiGuide.pointAtPaletteBlock('sensing_dayssince2000', 'Ganz unten'));
  await expect(editor.locator('.ki-pointer')).toBeInViewport();
  await expect(editor.locator('.ki-label')).toHaveText(/Ganz unten/);
});

test('every named UI element can be pointed at', async ({ page }) => {
  const editor = await openApp(page);
  const failed = await editor.evaluate(async () => {
    const ki = window.ki;
    if (!ki) return ['window.ki missing'];
    const failures: string[] = [];
    for (const element of Object.keys(ki.uiGuide.UI_ELEMENTS)) {
      const name = ({ sprite: ki.vm.editingTarget?.getName(), category: 'control' } as Record<string, string>)[element];
      await ki.uiGuide.pointAtUiElement(element, element, name).catch((e: Error) => failures.push(e.message));
    }
    return failures;
  });
  expect(failed).toEqual([]);
});

test('pointing at a script block selects the sprite and centers the block', async ({ page }) => {
  await mockChat(page, [
    toolCall('add_scripts', {
      sprite: 'Sprite1',
      scripts: [[{ op: 'event_whenflagclicked' }, { op: 'control_wait', DURATION: 1 }]],
    }),
    toolCall('point_to_script_block', { opcode: 'control_wait', sprite: 'Sprite1', label: 'Hier wird gewartet' }),
    answer('Da!'),
  ]);
  const editor = await openApp(page);
  await send(page, 'Bau und zeig mir das Warten');
  await expect(editor.locator('.ki-label')).toHaveText(/Hier wird gewartet/);
  await expect(editor.locator('.ki-pointer')).toBeInViewport();
});

test('scripts added in later steps never land on top of earlier ones, also when another sprite follows', async ({
  page,
}) => {
  const say = (text: string) => [[{ op: 'event_whenflagclicked' }, { op: 'looks_say', MESSAGE: text }]];
  await mockChat(page, [
    toolCall('add_scripts', { sprite: 'Sprite1', scripts: say('eins') }),
    // the editor reports its tidy-up a frame later; by then the next call already shows the Stage
    toolCalls(
      ['add_scripts', { sprite: 'Sprite1', scripts: say('zwei') }],
      ['add_scripts', { sprite: 'Stage', scripts: say('drei') }],
    ),
    answer('Fertig!'),
  ]);
  const editor = await openApp(page);
  await send(page, 'Bau drei Skripte');
  await expect(page.getByTestId('assistant-text')).toHaveText(/Fertig/);
  const ys = await editor.evaluate(() => {
    const blocks = window.ki?.vm.runtime.targets.find((t) => !t.isStage)?.blocks;
    return (blocks?.getScripts() ?? []).map((id) => blocks?.getBlock(id)?.y ?? 0);
  });
  expect(ys).toHaveLength(2);
  expect(Math.abs((ys[0] ?? 0) - (ys[1] ?? 0))).toBeGreaterThan(40); // a hat block plus a say block apart
});
