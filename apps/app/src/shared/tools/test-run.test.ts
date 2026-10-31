import { describe, expect, test } from 'vitest';
import { createVm } from '../../../test/support/headless-vm.ts';
import { createProjectTools } from './project-tools.ts';
import { runTool } from './tool-types.ts';

const game = [
  [
    { op: 'event_whenflagclicked' },
    { op: 'data_setvariableto', VARIABLE: 'Punkte', VALUE: 0 },
    { op: 'looks_say', MESSAGE: 'Los!' },
    { op: 'control_wait', DURATION: 0.6 },
    { op: 'motion_changexby', DX: 50 },
    { op: 'event_broadcast', BROADCAST_INPUT: 'weiter' },
  ],
  [
    { op: 'event_whenkeypressed', KEY_OPTION: 'space' },
    { op: 'data_changevariableby', VARIABLE: 'Punkte', VALUE: 1 },
  ],
  [
    { op: 'event_whenbroadcastreceived', BROADCAST_OPTION: 'weiter' },
    { op: 'control_stop', STOP_OPTION: 'all' },
  ],
];

describe('test_run', () => {
  test('plays the game with the kid input and reports what happened', async () => {
    const vm = await createVm();
    const tools = createProjectTools(vm);
    await runTool(tools, 'add_scripts', { sprite: 'Sprite1', scripts: game });
    vm.start();
    const result = (await runTool(tools, 'test_run', { seconds: 1.5, actions: ['key:space'] })) as {
      before_flag: string[];
      timeline: string[];
      at_end: string[];
    };
    vm.quit();
    expect(result.before_flag).toEqual(['Sprite1: x 0, y 0, shown, costume "costume1"']);
    // the samples come every 0.5 s, so changes in the same half second share a line
    const timeline = result.timeline.join('\n');
    for (const line of [
      'green flag',
      'Sprite1 says "Los!"',
      'kid presses space',
      'broadcast "weiter"',
      'stop all: every script ended ("stoppe alles")',
      'Sprite1 x 0→50',
      'Punkte = 1',
      'no script is running',
    ])
      expect(timeline).toContain(line);
    expect(result.at_end).toEqual([
      'Sprite1: x 50, y 0, shown, costume "costume1"',
      'meine Variable = 0',
      'Punkte = 1',
    ]);
  });

  test('wrong actions get an error that says how to write them', async () => {
    const tools = createProjectTools(await createVm());
    await expect(runTool(tools, 'test_run', { actions: ['press space'] })).rejects.toThrow(/Use "key:space"/);
    await expect(runTool(tools, 'test_run', { actions: ['key:f12'] })).rejects.toThrow(/Unknown key "f12"/);
  });
});
