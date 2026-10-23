import { JSDOM } from 'jsdom';
import { beforeAll, describe, expect, test } from 'vitest';
import { createVm, loadFixture, offlineLibrary, sprite, withStorage } from '../../../test/support/headless-vm.ts';
import { createAssetTools } from '../tools/asset-tools.ts';
import { createProjectTools } from '../tools/project-tools.ts';
import { runTool } from '../tools/tool-types.ts';
import { createProjectBackups } from './project-backup.ts';

beforeAll(() => {
  globalThis.DOMParser ??= new JSDOM('').window.DOMParser;
});

// The default project again, loaded with storage and every asset pointing at a built-in default, so all
// costumes have their asset as in the browser. (An asset the headless VM can't load would end in the
// "broken costume" fallback, which needs a renderer.)
const offlineProject = (ids: Record<'ImageVector' | 'Sound', string>) => {
  const project = JSON.parse(loadFixture('default-project'));
  for (const t of project.targets) {
    for (const c of t.costumes) Object.assign(c, { assetId: ids.ImageVector, md5ext: `${ids.ImageVector}.svg` });
    for (const s of t.sounds) Object.assign(s, { assetId: ids.Sound, md5ext: `${ids.Sound}.wav`, dataFormat: 'wav' });
  }
  return project;
};

const setup = async () => {
  const vm = withStorage(await createVm());
  await vm.loadProject(offlineProject(vm.runtime.storage.defaultAssetId));
  const tools = { ...createProjectTools(vm), ...createAssetTools(vm, { loadLibrary: offlineLibrary(vm) }) };
  const run = (name: string, args: object = {}) => runTool(tools, name, args);
  return { vm, run, backups: createProjectBackups(vm) };
};
const drawing = (fill: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 60" width="80" height="60"><circle cx="40" cy="30" r="20" fill="${fill}"/></svg>`;
const script = [{ op: 'event_whenflagclicked' }, { op: 'motion_movesteps', STEPS: 10 }];

describe('project backups', () => {
  test('restoring brings back the scripts and sprites as they were', async () => {
    const { vm, run, backups } = await setup();
    await run('add_scripts', { sprite: 'Sprite1', scripts: [script] });
    const before = backups.save();
    await run('clear_scripts', { sprite: 'Sprite1' });
    await run('draw_sprite', { name: 'Drache', svg: drawing('green') });
    expect(sprite(vm).blocks.getScripts()).toHaveLength(0);

    await backups.restore(before);
    expect(sprite(vm).blocks.getScripts()).toHaveLength(1);
    expect(vm.runtime.targets.map((t) => t.getName())).not.toContain('Drache');
  });

  test('drawn costumes come back with their drawing, not as the placeholder', async () => {
    const { vm, run, backups } = await setup();
    await run('draw_sprite', { name: 'Drache', svg: drawing('green') });
    const drawn = sprite(vm, 'Drache').getCostumes()[0]?.asset;
    const before = backups.save();
    await run('draw_costume', { sprite: 'Drache', costume: 'rot', svg: drawing('red') });

    await backups.restore(before);
    const costumes = sprite(vm, 'Drache').getCostumes();
    expect(costumes.map((c) => c.name)).toHaveLength(1);
    expect(costumes[0]?.asset?.assetId).toBe(drawn?.assetId);
    expect(costumes[0]?.asset?.decodeText()).toContain('fill="green"');
  });

  test('the sprite open in the editor stays open', async () => {
    const { vm, run, backups } = await setup();
    await run('draw_sprite', { name: 'Drache', svg: drawing('green') });
    vm.setEditingTarget(sprite(vm, 'Drache').id);
    const before = backups.save();

    await backups.restore(before);
    expect(vm.editingTarget?.getName()).toBe('Drache');
  });
});
