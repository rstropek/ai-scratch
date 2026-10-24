import { describe, expect, test } from 'vitest';
import { createVm, loadFixture, sprite } from '../../../test/support/headless-vm.ts';
import { buildInstructions, toolDefinitions } from './index.ts';
import { createProjectTools, type ProjectSnapshot } from './project-tools.ts';
import { runTool } from './tool-types.ts';

describe('project tools', () => {
  test('get_project lists sprites, stage and scripts without asset noise', async () => {
    const vm = await createVm();
    const snapshot = (await runTool(createProjectTools(vm), 'get_project', {})) as ProjectSnapshot;
    expect(snapshot.targets.map((t) => t.name)).toEqual(['Stage', 'Sprite1']);
    expect(snapshot.targets[1]).toMatchObject({
      x: 0,
      y: 0,
      scripts: [],
      costumes: [{ name: 'costume1' }, { name: 'costume2' }],
    });
  });

  test('get_project shows costume sizes once the renderer has loaded them', async () => {
    const vm = await createVm();
    Object.assign(sprite(vm).getCostumes()[0] ?? {}, { size: [80.4, 109.6] }); // the headless VM has no renderer
    const snapshot = (await runTool(createProjectTools(vm), 'get_project', {})) as ProjectSnapshot;
    expect(snapshot.targets[1]?.costumes).toEqual([{ name: 'costume1', size: [80, 110] }, { name: 'costume2' }]);
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

  test('clear_scripts removes every script, not every other one', async () => {
    const vm = await createVm();
    const tools = createProjectTools(vm);
    const script = [{ op: 'event_whenflagclicked' }, { op: 'looks_say', MESSAGE: 'Hi' }];
    await runTool(tools, 'add_scripts', { sprite: 'Sprite1', scripts: [script, script, script] });
    expect(sprite(vm).blocks.getScripts()).toHaveLength(3);
    await runTool(tools, 'clear_scripts', { sprite: 'Sprite1' });
    expect(sprite(vm).blocks.getScripts()).toEqual([]);
  });

  // The editor rebuilds a sprite's workspace from this XML; a field without its variable type makes
  // it stop loading, and every script after it is missing in the editor while it still runs.
  test('broadcast and list fields carry their variable type into the editor XML', async () => {
    const vm = await createVm();
    vm.runtime.getTargetForStage()?.createVariable('list_punkte', 'Punkte', 'list');
    const tools = createProjectTools(vm);
    const scripts = [
      [
        { op: 'event_whenbroadcastreceived', BROADCAST_OPTION: 'erwischt' },
        { op: 'data_addtolist', ITEM: '1', LIST: 'Punkte' },
      ],
      [{ op: 'event_whenflagclicked' }, { op: 'event_broadcast', BROADCAST_INPUT: 'erwischt' }],
    ];
    await runTool(tools, 'add_scripts', { sprite: 'Sprite1', scripts });
    const xml = sprite(vm).blocks.toXML();
    expect(xml).toMatch(/<field name="BROADCAST_OPTION" id="[^"]+" variabletype="broadcast_msg">erwischt</);
    expect(xml).toMatch(/<field name="LIST" id="[^"]+" variabletype="list">Punkte</);
  });

  test('add_scripts creates missing variables for all sprites, and the ones in local_variables on the sprite', async () => {
    const vm = await createVm();
    const tools = createProjectTools(vm);
    const scripts = [
      [
        { op: 'event_whenflagclicked' },
        { op: 'data_setvariableto', VARIABLE: 'Punkte', VALUE: 0 },
        { op: 'data_setvariableto', VARIABLE: 'Bild', VALUE: 1 },
        { op: 'data_addtolist', ITEM: '1', LIST: 'Karten' },
      ],
    ];
    await runTool(tools, 'add_scripts', { sprite: 'Sprite1', scripts, local_variables: ['Bild', 'Karten'] });
    const names = (vars: Record<string, { name: string; type: string }>) =>
      Object.values(vars).map((v) => `${v.name}:${v.type || 'var'}`);
    expect(names(vm.runtime.getTargetForStage().variables)).toContain('Punkte:var');
    expect(names(vm.runtime.getTargetForStage().variables)).not.toContain('Bild:var');
    expect(names(sprite(vm).variables).sort()).toEqual(['Bild:var', 'Karten:list']);
    // the blocks point at the sprite's own variable, so each clone sets its own value
    const [localId] = Object.entries(sprite(vm).variables).find(([, v]) => v.name === 'Bild') ?? [];
    const set = Object.values(sprite(vm).blocks._blocks).filter((b) => b.opcode === 'data_setvariableto');
    expect(set.map((b) => b.fields.VARIABLE?.id)).toContain(localId);
  });

  test('local_variables refuses a name that exists for all sprites, and the Stage', async () => {
    const vm = await createVm();
    vm.runtime.getTargetForStage().createVariable('var_punkte', 'Punkte', '');
    const tools = createProjectTools(vm);
    const scripts = [[{ op: 'event_whenflagclicked' }, { op: 'data_setvariableto', VARIABLE: 'Punkte', VALUE: 0 }]];
    await expect(
      runTool(tools, 'add_scripts', { sprite: 'Sprite1', scripts, local_variables: ['Punkte'] }),
    ).rejects.toThrow(/"Punkte" already exists for all sprites/);
    await expect(
      runTool(tools, 'add_scripts', { sprite: 'Stage', scripts, local_variables: ['Punkte'] }),
    ).rejects.toThrow(/Stage cannot have its own variables/);
    expect(sprite(vm).blocks.getScripts()).toEqual([]);
  });

  test('add_scripts warns when a sprite polls for clicks instead of using the click hat', async () => {
    const vm = await createVm();
    const tools = createProjectTools(vm);
    const clicked = {
      op: 'operator_and',
      OPERAND1: { op: 'sensing_mousedown' },
      OPERAND2: { op: 'sensing_touchingobject', TOUCHINGOBJECTMENU: '_mouse_' },
    };
    const scripts = [
      [
        { op: 'event_whenflagclicked' },
        {
          op: 'control_forever',
          SUBSTACK: [{ op: 'control_if', CONDITION: clicked, SUBSTACK: [{ op: 'looks_nextcostume' }] }],
        },
      ],
    ];
    const result = (await runTool(tools, 'add_scripts', { sprite: 'Sprite1', scripts })) as { warning?: string };
    expect(result.warning).toMatch(/use event_whenthisspriteclicked/);
  });

  test('add_scripts tidies the editor after adding, and a failed tidy-up still reports the scripts as added', async () => {
    const vm = await createVm();
    let cleanUps = 0;
    const tools = createProjectTools(vm, { cleanUp: () => void cleanUps++ });
    const script = [{ op: 'event_whenflagclicked' }, { op: 'looks_say', MESSAGE: 'Hi' }];
    await runTool(tools, 'add_scripts', { sprite: 'Sprite1', scripts: [script] });
    await expect(runTool(tools, 'add_scripts', { sprite: 'Sprite1', scripts: [[{ op: 'nope' }]] })).rejects.toThrow();
    expect(cleanUps).toBe(1);

    const failing = createProjectTools(vm, {
      cleanUp: () => {
        throw new Error('no workspace');
      },
    });
    expect(await runTool(failing, 'add_scripts', { sprite: 'Sprite1', scripts: [script] })).toEqual({
      ok: true,
      added: 3,
    });
  });

  test('add_scripts warns the model when the editor does not show scripts the project runs', async () => {
    const vm = await createVm();
    const script = [{ op: 'event_whenflagclicked' }, { op: 'looks_say', MESSAGE: 'Hi' }];
    const shown = createProjectTools(vm, { scriptsMissingInEditor: () => [] });
    expect(await runTool(shown, 'add_scripts', { sprite: 'Sprite1', scripts: [script] })).toEqual({
      ok: true,
      added: 3,
    });

    const hidden = createProjectTools(vm, { scriptsMissingInEditor: () => ['event_whenbroadcastreceived'] });
    expect(await runTool(hidden, 'add_scripts', { sprite: 'Sprite1', scripts: [script] })).toEqual({
      ok: true,
      added: 3,
      warning: expect.stringMatching(
        /editor failed to show 1 script\(s\) of Sprite1 \(their first blocks: event_whenbroadcastreceived\).*Do not add/,
      ),
    });
  });

  // Two sprites that both check touching each other is a classic Scratch race: whichever runs first
  // may hide or switch costume before the other one checks.
  test('add_scripts warns when two sprites check touching each other', async () => {
    const project = JSON.parse(loadFixture('default-project'));
    project.targets.push({ ...project.targets[1], name: 'Hai', blocks: {} });
    const vm = await createVm(JSON.stringify(project));
    const tools = createProjectTools(vm);
    const checks = (other: string) => [
      { op: 'event_whenflagclicked' },
      {
        op: 'control_forever',
        SUBSTACK: [
          {
            op: 'control_if',
            CONDITION: { op: 'sensing_touchingobject', TOUCHINGOBJECTMENU: other },
            SUBSTACK: [{ op: 'looks_nextcostume' }],
          },
        ],
      },
    ];
    expect(await runTool(tools, 'add_scripts', { sprite: 'Sprite1', scripts: [checks('Hai')] })).not.toHaveProperty(
      'warning',
    );
    expect(await runTool(tools, 'add_scripts', { sprite: 'Hai', scripts: [checks('_edge_')] })).not.toHaveProperty(
      'warning',
    );
    expect(await runTool(tools, 'add_scripts', { sprite: 'Hai', scripts: [checks('Sprite1')] })).toMatchObject({
      ok: true,
      warning: expect.stringMatching(/^Hai and Sprite1 both check whether they touch each other.*event_broadcast/),
    });
  });

  test('add_scripts warns when a sprite hides itself and the green flag never shows it again', async () => {
    const vm = await createVm();
    const tools = createProjectTools(vm);
    const caught = [{ op: 'event_whenbroadcastreceived', BROADCAST_OPTION: 'gefressen' }, { op: 'looks_hide' }];
    expect(await runTool(tools, 'add_scripts', { sprite: 'Sprite1', scripts: [caught] })).toMatchObject({
      warning: expect.stringMatching(/^Sprite1 hides itself, but no green-flag script shows it/),
    });
    const start = [{ op: 'event_whenflagclicked' }, { op: 'motion_gotoxy', X: -200, Y: 150 }, { op: 'looks_show' }];
    expect(await runTool(tools, 'add_scripts', { sprite: 'Sprite1', scripts: [start] })).not.toHaveProperty('warning');
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
