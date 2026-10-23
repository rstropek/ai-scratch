import { describe, expect, test } from 'vitest';
import { createVm, sprite } from '../../../test/support/headless-vm.ts';
import { buildInstructions, toolDefinitions } from './index.ts';
import { createProjectTools, type ProjectSnapshot } from './project-tools.ts';
import { runTool } from './tool-types.ts';

describe('project tools', () => {
  test('get_project lists sprites, stage and scripts without asset noise', async () => {
    const vm = await createVm();
    const snapshot = (await runTool(createProjectTools(vm), 'get_project', {})) as ProjectSnapshot;
    expect(snapshot.targets.map((t) => t.name)).toEqual(['Stage', 'Sprite1']);
    expect(snapshot.targets[1]).toMatchObject({ x: 0, y: 0, scripts: [], costumes: ['costume1', 'costume2'] });
  });

  test('add_scripts adds nothing when any block is wrong', async () => {
    const vm = await createVm();
    const tools = createProjectTools(vm);
    const scripts = [[{ op: 'event_whenflagclicked' }, { op: 'motion_movestep', STEPS: 1 }]];
    await expect(runTool(tools, 'add_scripts', { sprite: 'Sprite1', scripts })).rejects.toThrow(
      /Nothing was added, please fix:\n- .*motion_movesteps/,
    );
    expect(sprite(vm).blocks.getScripts()).toEqual([]);
  });

  test('add_scripts accepts scripts sent as a JSON string, clear_scripts removes them', async () => {
    const vm = await createVm();
    const tools = createProjectTools(vm);
    const scripts = JSON.stringify([[{ op: 'event_whenflagclicked' }, { op: 'looks_say', MESSAGE: 'Hi' }]]);
    expect(await runTool(tools, 'add_scripts', { sprite: 'Sprite1', scripts })).toEqual({ ok: true, added: 3 });
    expect(sprite(vm).blocks.getScripts()).toHaveLength(1);
    await runTool(tools, 'clear_scripts', { sprite: 'Sprite1' });
    expect(sprite(vm).blocks.getScripts()).toEqual([]);
  });

  test('unknown sprites and tools produce messages the model can act on', async () => {
    const vm = await createVm();
    const tools = createProjectTools(vm);
    await expect(runTool(tools, 'clear_scripts', { sprite: 'Katze' })).rejects.toThrow(/Existing: Stage, Sprite1/);
    await expect(runTool(tools, 'clear_scripts', {})).rejects.toThrow(/"sprite" must be a non-empty string/);
    await expect(runTool(tools, 'toString', {})).rejects.toThrow(/Unknown tool toString/);
  });

  test('every tool has a unique name and the instructions mention the script format', () => {
    const names = toolDefinitions.map((d) => d.name);
    expect(new Set(names).size).toBe(names.length);
    expect(buildInstructions()).toMatch(/SCRIPT FORMAT[\s\S]*AVAILABLE BLOCKS[\s\S]*motion_movesteps/);
  });
});
