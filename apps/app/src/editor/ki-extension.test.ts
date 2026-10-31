import { describe, expect, test } from 'vitest';
import { createVm, runGreenFlag, sprite, type TestVm } from '../../test/support/headless-vm.ts';
import { ASK_FAILED, ASK_NO_CODE, type Ask } from '../shared/ki-block.ts';
import { createProjectTools, type ProjectSnapshot } from '../shared/tools/project-tools.ts';
import { runTool } from '../shared/tools/tool-types.ts';

/** `ask` stands in for the host; the headless VM registers the extension like the editor does */
const kiVm = (ask?: Ask) => createVm(undefined, ask ? { ask } : {});

const chatbot = [
  [
    { op: 'event_whenflagclicked' },
    { op: 'looks_say', MESSAGE: { op: 'ki_ask', QUESTION: { op: 'operator_join', STRING1: 'Hallo ', STRING2: 'KI' } } },
  ],
];
const addChatbot = (vm: TestVm) =>
  runTool(createProjectTools(vm), 'add_scripts', { sprite: 'Sprite1', scripts: chatbot });

describe('KI blocks', () => {
  test('the assistant builds a script with frage KI, and the sprite says the answer', async () => {
    const questions: string[] = [];
    const vm = await kiVm(async (q) => {
      questions.push(q);
      return 'Hallo! Wie geht es dir?';
    });
    await addChatbot(vm);
    const snapshot = (await runTool(createProjectTools(vm), 'get_project', {})) as ProjectSnapshot;
    expect(JSON.stringify(snapshot.targets[1]?.scripts)).toContain('"op":"ki_ask"');
    await runGreenFlag(vm, 300);
    expect(questions).toEqual(['Hallo KI']);
    expect(vm.says.map((s) => s.text)).toContain('Hallo! Wie geht es dir?');
  });

  test('without a code the block says so; a failed ask reports a German error; an empty text asks nothing', async () => {
    const noCode = await kiVm(undefined);
    await addChatbot(noCode);
    await runGreenFlag(noCode, 300);
    expect(noCode.says.map((s) => s.text)).toContain(ASK_NO_CODE);

    const failing = await kiVm(() => Promise.reject(new Error('offline')));
    await addChatbot(failing);
    await runGreenFlag(failing, 300);
    expect(failing.says.map((s) => s.text)).toContain(ASK_FAILED);

    let asked = 0;
    const empty = await kiVm(async () => {
      asked += 1;
      return 'x';
    });
    await runTool(createProjectTools(empty), 'add_scripts', {
      sprite: 'Sprite1',
      scripts: [[{ op: 'event_whenflagclicked' }, { op: 'looks_say', MESSAGE: { op: 'ki_ask', QUESTION: ' ' } }]],
    });
    await runGreenFlag(empty, 300);
    expect(asked).toBe(0);
  });

  test('stopping the project aborts a question still waiting for its answer', async () => {
    let signal: AbortSignal | undefined;
    const vm = await kiVm((_q, s) => {
      signal = s;
      return new Promise<string>(() => {});
    });
    await addChatbot(vm);
    vm.start();
    vm.greenFlag();
    await new Promise((r) => setTimeout(r, 200));
    expect(signal?.aborted).toBe(false);
    vm.stopAll();
    expect(signal?.aborted).toBe(true);
    vm.quit();
  });

  test('a saved project with KI blocks loads again where the extension is registered', async () => {
    const vm = await kiVm(async () => 'ok');
    await addChatbot(vm);
    const sb3 = await (await vm.saveProjectSb3()).arrayBuffer();
    const again = await kiVm(async () => 'ok');
    await again.loadProject(sb3);
    expect(Object.values(sprite(again).blocks._blocks).map((b) => b.opcode)).toContain('ki_ask');
  });
});
