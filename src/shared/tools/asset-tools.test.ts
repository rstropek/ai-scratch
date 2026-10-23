import { JSDOM } from 'jsdom';
import { beforeAll, describe, expect, test } from 'vitest';
import { createVm, libraryItems, offlineLibrary, withStorage } from '../../../test/support/headless-vm.ts';
import { checkSvg, createAssetTools, extractSvg, searchLibrary } from './asset-tools.ts';
import { runTool } from './tool-types.ts';

beforeAll(() => {
  globalThis.DOMParser ??= new JSDOM('').window.DOMParser;
});

const setup = async () => {
  const vm = withStorage(await createVm());
  const tools = createAssetTools(vm, { loadLibrary: offlineLibrary(vm) });
  // biome-ignore lint/suspicious/noExplicitAny: tests read tool results ad hoc
  const run = (name: string, args: object) => runTool(tools, name, args) as Promise<any>;
  return { vm, run };
};
const svg = (
  w: number,
  h: number,
  body = `<circle cx="${w / 2}" cy="${h / 2}" r="${Math.min(w, h) / 3}" fill="green"/>`,
) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>`;

describe('asset tools', () => {
  test('search finds library items by name and tag', () => {
    expect(searchLibrary(libraryItems('sprite'), 'bat')[0]?.name).toBe('Bat');
    const space = searchLibrary(libraryItems('backdrop'), 'space').map((i) => i.name);
    expect(space).toEqual(expect.arrayContaining(['Stars', 'Galaxy']));
    expect(searchLibrary(libraryItems('sprite'), 'Fledermaus')).toEqual([]); // tags are English only
  });

  test('library sprite, backdrop and costume are added like the library dialogs do', async () => {
    const { vm, run } = await setup();
    const dog = await run('add_library_sprite', { name: 'Dog1' });
    const { x, y, ...rest } = dog.sprite;
    expect(rest).toEqual({ name: 'Dog1', costumes: ['Dog1-a', 'Dog1-b'], sounds: ['Dog1'] });
    expect(Math.abs(x)).toBeLessThanOrEqual(100);
    expect(Math.abs(y)).toBeLessThanOrEqual(50);
    expect((await run('add_library_sprite', { name: 'dog1' })).sprite.name).toBe('Dog2'); // renamed by the VM
    const { backdrops } = await run('add_library_backdrop', { name: 'Space' });
    expect(backdrops).toEqual(['backdrop1', 'Space']);
    const stage = JSON.parse(vm.toJSON()).targets.find((t: { isStage: boolean }) => t.isStage);
    expect(stage.costumes[1].md5ext).toMatch(/^[0-9a-f]{32}\.svg$/); // serializes with md5ext (saving works)
    const { costumes } = await run('add_library_costume', { sprite: 'Sprite1', name: 'Bat-a' });
    expect(costumes).toContain('Bat-a');
    await expect(run('add_library_sprite', { name: 'Bats' })).rejects.toThrow(/Similar: Bat/);
  });

  test('search rejects unknown kinds with the valid ones', async () => {
    const { run } = await setup();
    await expect(run('search_library', { kind: 'sound', query: 'x' })).rejects.toThrow(/sprite, backdrop, costume/);
    expect((await run('search_library', { kind: 'sprite', query: 'bat' })).found[0].name).toBe('Bat');
  });

  test('drawn sprite and backdrop keep the SVG and the rotation center', async () => {
    const { vm, run } = await setup();
    const { x, y, ...result } = await run('draw_sprite', { name: 'Drache', svg: svg(80, 60) });
    expect(result).toEqual({ ok: true, sprite: 'Drache', size: [80, 60] });
    expect(vm.editingTarget?.getName()).toBe('Drache');
    await run('draw_costume', { sprite: 'Stage', costume: 'Wiese', svg: svg(480, 360) });
    const stage = vm.runtime.getTargetForStage();
    expect(stage.getCostumes()[stage.currentCostume]?.name).toBe('Wiese');
    expect(stage.getCostumes()[1]?.rotationCenterX).toBe(240);
  });

  test('bad SVG is rejected with messages the model can act on', () => {
    expect(() => checkSvg('<svg viewBox="0 0 10 10"><rect></svg>')).toThrow(/not valid XML/);
    expect(() => checkSvg('<svg><text>hi</text></svg>')).toThrow(/<text> is not supported[\s\S]*viewBox/);
    expect(() => checkSvg(svg(5000, 5000))).toThrow(/stage is only 480x360/);
    expect(() => checkSvg('a dragon')).toThrow(/one <svg>/);
    expect(checkSvg(svg(40, 80))).toEqual([40, 80]);
    expect(extractSvg(`\`\`\`svg\n${svg(40, 80)})\n\`\`\``)).toBe(svg(40, 80)); // seen live: "</svg>)"
  });
});
