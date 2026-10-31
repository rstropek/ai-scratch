import { describe, expect, test } from 'vitest';
import { createVm, findVariable, runGreenFlag, sprite } from '../../../test/support/headless-vm.ts';
import { createProjectTools, type ProjectSnapshot } from '../tools/project-tools.ts';
import { compileScripts, type DslScript, decompileBlocks } from './script-dsl.ts';

describe('compileScripts', () => {
  test('compiles loops, nested reporters and conditions; runs in the VM', async () => {
    const vm = await createVm();
    await createProjectTools(vm).add_scripts?.({
      sprite: 'Sprite1',
      scripts: [
        [
          { op: 'event_whenflagclicked' },
          { op: 'control_repeat', TIMES: 10, SUBSTACK: [{ op: 'motion_movesteps', STEPS: 10 }] },
          {
            op: 'control_if',
            CONDITION: { op: 'operator_gt', OPERAND1: { op: 'motion_xposition' }, OPERAND2: 50 },
            SUBSTACK: [{ op: 'looks_say', MESSAGE: 'Geschafft' }],
          },
        ],
      ],
    });
    await runGreenFlag(vm, 1000);
    expect(Math.round(sprite(vm).x)).toBe(100);
    expect(vm.says.map((s) => s.text)).toEqual(['Geschafft']);
  });

  test('variables, broadcasts and custom blocks by name', async () => {
    const vm = await createVm();
    await createProjectTools(vm).add_scripts?.({
      sprite: 'Sprite1',
      scripts: [
        [
          { op: 'procedures_definition', name: 'Laufe', params: ['Schritte'] },
          { op: 'motion_movesteps', STEPS: { op: 'argument', name: 'Schritte' } },
          { op: 'data_changevariableby', VARIABLE: 'Punkte', VALUE: 1 },
        ],
        [
          { op: 'event_whenflagclicked' },
          { op: 'data_setvariableto', VARIABLE: 'Punkte', VALUE: 0 },
          { op: 'event_broadcast', BROADCAST_INPUT: 'los' },
        ],
        [
          { op: 'event_whenbroadcastreceived', BROADCAST_OPTION: 'los' },
          { op: 'procedures_call', name: 'Laufe', args: [30] },
        ],
      ],
    });
    await runGreenFlag(vm, 1000);
    expect(Math.round(sprite(vm).x)).toBe(30);
    expect(Number(findVariable(vm, 'Punkte')?.value)).toBe(1);
  });

  test('a custom block can call itself', async () => {
    const vm = await createVm();
    const n = { op: 'argument', name: 'n' };
    await createProjectTools(vm).add_scripts?.({
      sprite: 'Sprite1',
      scripts: [
        [
          { op: 'event_whenflagclicked' },
          { op: 'data_setvariableto', VARIABLE: 'Ergebnis', VALUE: 1 },
          { op: 'procedures_call', name: 'Fakultät', args: [5] },
        ],
        [
          { op: 'procedures_definition', name: 'Fakultät', params: ['n'] },
          {
            op: 'control_if',
            CONDITION: { op: 'operator_gt', OPERAND1: n, OPERAND2: 1 },
            SUBSTACK: [
              {
                op: 'data_setvariableto',
                VARIABLE: 'Ergebnis',
                VALUE: { op: 'operator_multiply', NUM1: { op: 'data_variable', VARIABLE: 'Ergebnis' }, NUM2: n },
              },
              { op: 'procedures_call', name: 'Fakultät', args: [{ op: 'operator_subtract', NUM1: n, NUM2: 1 }] },
            ],
          },
        ],
      ],
    });
    await runGreenFlag(vm, 500);
    expect(Number(findVariable(vm, 'Ergebnis')?.value)).toBe(120);
  });

  test('"warp" runs a custom block without screen refresh, and get_project shows it', async () => {
    const countTo = async (warp: boolean) => {
      const vm = await createVm();
      // without a renderer nothing requests a redraw, and then Scratch never waits for a frame;
      // counting requests one here, like a sprite that moves
      const runtime = vm.runtime as unknown as {
        _primitives: Record<string, (args: unknown, util: unknown) => unknown>;
        requestRedraw(): void;
      };
      const change = runtime._primitives.data_changevariableby;
      runtime._primitives.data_changevariableby = (args, util) => {
        runtime.requestRedraw();
        return change?.(args, util);
      };
      const tools = createProjectTools(vm);
      await tools.add_scripts?.({
        sprite: 'Sprite1',
        scripts: [
          [
            { op: 'event_whenflagclicked' },
            { op: 'data_setvariableto', VARIABLE: 'Tiefe', VALUE: 0 },
            { op: 'procedures_call', name: 'Zähle', args: [] },
          ],
          [
            { op: 'procedures_definition', name: 'Zähle', params: [], warp },
            { op: 'data_changevariableby', VARIABLE: 'Tiefe', VALUE: 1 },
            {
              op: 'control_if',
              CONDITION: { op: 'operator_lt', OPERAND1: { op: 'data_variable', VARIABLE: 'Tiefe' }, OPERAND2: 300 },
              SUBSTACK: [{ op: 'procedures_call', name: 'Zähle', args: [] }],
            },
          ],
        ],
      });
      const snapshot = (await tools.get_project?.({})) as ProjectSnapshot;
      const definition = snapshot.targets[1]?.scripts.flat().find((b) => b.op === 'procedures_definition');
      await runGreenFlag(vm, 300);
      return { depth: Number(findVariable(vm, 'Tiefe')?.value), definition };
    };
    const warped = await countTo(true);
    expect(warped.depth).toBe(300);
    expect(warped.definition).toMatchObject({ name: 'Zähle', warp: true });
    const normal = await countTo(false);
    expect(normal.depth).toBeLessThan(300); // a recursive call waits for the next frame
    expect(normal.definition).not.toHaveProperty('warp');
  });

  test('the prototype of a definition has an argument reporter per parameter', () => {
    // without them the editor shows the definition as a bare prototype and drops its body
    const { blocks } = compileScripts([[{ op: 'procedures_definition', name: 'Springe', params: ['Höhe', 'Zeit'] }]]);
    const proto = Object.values(blocks).find((b) => b.opcode === 'procedures_prototype');
    const reporters = Object.values(proto?.inputs ?? {}).map((input) => blocks[String(input[1])]);
    expect(reporters.map((r) => [r?.opcode, r?.shadow, r?.fields?.VALUE?.[0]])).toEqual([
      ['argument_reporter_string_number', true, 'Höhe'],
      ['argument_reporter_string_number', true, 'Zeit'],
    ]);
  });

  test('helpful errors instead of silently broken blocks', () => {
    const { errors } = compileScripts([
      [
        { op: 'event_whenflagclicked' },
        { op: 'motion_movestep', STEPS: 10 },
        { op: 'control_repeat', TIMES: 3, BODY: [] },
        { op: 'sensing_keypressed', KEY_OPTION: 'space' },
        { op: 'looks_seteffectto', EFFECT: 'RAINBOW', VALUE: 1 },
      ],
    ]);
    const text = errors.join('\n');
    expect(text).toMatch(/unknown op\. Did you mean: motion_movesteps/);
    expect(text).toMatch(/unknown key "BODY"\. Valid keys: TIMES, SUBSTACK/);
    expect(text).toMatch(/boolean blocks cannot be stacked/);
    expect(text).toMatch(/EFFECT = "RAINBOW" is invalid\. Use one of: COLOR/);
  });

  test('garbage from the model becomes errors, not exceptions', () => {
    const { errors } = compileScripts([[], 'x', [null, { op: 'procedures_definition' }], [{ op: 'procedures_call' }]]);
    expect(errors.join('\n')).toMatch(/scripts\[0\] must be a non-empty list/);
    expect(errors.join('\n')).toMatch(/every block needs an "op"/);
    expect(errors.join('\n')).toMatch(/no custom block named/);
  });
});

describe('decompileBlocks', () => {
  test('decompile(compile(x)) round-trips', () => {
    const scripts: DslScript[] = [
      [
        { op: 'event_whenkeypressed', KEY_OPTION: 'space' },
        {
          op: 'control_forever',
          SUBSTACK: [
            { op: 'motion_turnright', DEGREES: 15 },
            { op: 'looks_switchcostumeto', COSTUME: 'costume2' },
          ],
        },
      ],
    ];
    expect(decompileBlocks(compileScripts(scripts).blocks)).toEqual(scripts);
  });

  test('variables used as values stay variables after saving (sb3 stores them as primitives)', async () => {
    const vm = await createVm();
    const tools = createProjectTools(vm);
    const script = [
      { op: 'event_whenflagclicked' },
      { op: 'data_setvariableto', VARIABLE: 'Punkte', VALUE: '7' },
      { op: 'looks_say', MESSAGE: { op: 'data_variable', VARIABLE: 'Punkte' } },
    ];
    await tools.add_scripts?.({ sprite: 'Sprite1', scripts: [script] });
    const snapshot = (await tools.get_project?.({})) as { targets: { name: string; scripts: unknown }[] };
    const cat = snapshot.targets.find((t) => t.name === 'Sprite1');
    expect(cat?.scripts).toEqual([script]);
  });
});
