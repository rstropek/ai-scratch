// Tools that read and change the project's scripts, in the nested-JSON script format (script-dsl).
import { catalogReference } from '../scratch/block-catalog.ts';
import { sb3BlocksToVm } from '../scratch/sb3-blocks.ts';
import { compileScripts, type DslScript, decompileBlocks, type ProcedureInfo } from '../scratch/script-dsl.ts';
import { findTarget, type Sb3Blocks, type Target, type VirtualMachine } from '../scratch/vm-types.ts';
import { fn, jsonArg, stringArg, type ToolDefinition, type ToolHandlers } from './tool-types.ts';

export const projectToolDefinitions: ToolDefinition[] = [
  fn(
    'get_project',
    'Returns all sprites (and the stage) of the current Scratch project with their scripts in the script format.',
  ),
  fn(
    'add_scripts',
    'Adds new scripts to a sprite. Each script is a list of blocks; see the script format in the instructions.',
    {
      sprite: { type: 'string', description: 'Sprite name, or "Stage"' },
      scripts: { type: 'array', items: { type: 'array', items: { type: 'object', additionalProperties: true } } },
    },
    ['sprite', 'scripts'],
  ),
  fn('clear_scripts', 'Deletes all scripts of a sprite.', { sprite: { type: 'string' } }, ['sprite']),
  fn('green_flag', 'Starts the project (like clicking the green flag).'),
];

const DSL_FORMAT = `
SCRIPT FORMAT (for add_scripts and get_project):
A script is a list of blocks. A block is {"op": "<opcode>", ...inputs and fields as keys}.
- number/text inputs and menus: plain values, e.g. {"op": "motion_movesteps", "STEPS": 10}
- reporters/booleans as values: nested blocks, e.g. {"op": "operator_gt", "OPERAND1": {"op": "motion_xposition"}, "OPERAND2": 50}
- C-blocks: "SUBSTACK" (and "SUBSTACK2" for else) is a list of blocks
- variables/lists/messages by name: {"op": "data_changevariableby", "VARIABLE": "Punkte", "VALUE": 1}, {"op": "data_variable", "VARIABLE": "Punkte"}, {"op": "event_broadcast", "BROADCAST_INPUT": "los"}, {"op": "event_whenbroadcastreceived", "BROADCAST_OPTION": "los"}. Missing variables are created automatically.
- custom blocks: a script starting with {"op": "procedures_definition", "name": "Springe", "params": ["Höhe"]}; inside use {"op": "argument", "name": "Höhe"}; call with {"op": "procedures_call", "name": "Springe", "args": [50]}
Example: [[{"op": "event_whenflagclicked"}, {"op": "control_repeat", "TIMES": 10, "SUBSTACK": [{"op": "motion_movesteps", "STEPS": 10}, {"op": "control_wait", "DURATION": 0.1}]}, {"op": "looks_say", "MESSAGE": "Fertig"}]]
`;

export const projectToolsPrompt = (): string => `${DSL_FORMAT}
AVAILABLE BLOCKS (opcode [shape] inputs/fields // German label):
${catalogReference()}`;

export interface TargetSnapshot {
  name: string;
  isStage: boolean;
  x?: number;
  y?: number;
  direction?: number;
  size?: number;
  visible?: boolean;
  variables: string[];
  lists: string[];
  scripts: DslScript[];
  /** size in stage units, when the renderer has loaded the costume (not in the headless VM) */
  costumes: { name: string; size?: [number, number] }[];
  sounds: string[];
}
export interface ProjectSnapshot {
  targets: TargetSnapshot[];
  extensions: string[];
}

interface Sb3Target {
  isStage: boolean;
  name: string;
  x: number;
  y: number;
  direction: number;
  size: number;
  visible: boolean;
  variables?: Record<string, [string, unknown]>;
  lists?: Record<string, [string, unknown]>;
  blocks: Sb3Blocks;
  costumes: { name: string }[];
  sounds: { name: string }[];
}

/** Compact project view without asset noise; scripts in the script format. */
export const projectSnapshot = (vm: VirtualMachine): ProjectSnapshot => {
  const json = JSON.parse(vm.toJSON()) as { targets: Sb3Target[]; extensions: string[] };
  const names = (vars: Sb3Target['variables']) => Object.values(vars ?? {}).map((v) => v[0]);
  // toJSON serializes the original targets in this order; only the live costumes know their size
  const originals = vm.runtime.targets.filter((t) => t.isOriginal);
  const costumes = (i: number, t: Sb3Target) =>
    t.costumes.map(({ name }, j) => {
      const size = originals[i]?.getCostumes()[j]?.size;
      return size ? { name, size: [Math.round(size[0]), Math.round(size[1])] as [number, number] } : { name };
    });
  return {
    targets: json.targets.map((t, i) => ({
      name: t.isStage ? 'Stage' : t.name,
      isStage: t.isStage,
      ...(t.isStage
        ? {}
        : { x: Math.round(t.x), y: Math.round(t.y), direction: t.direction, size: t.size, visible: t.visible }),
      variables: names(t.variables),
      lists: names(t.lists),
      scripts: decompileBlocks(t.blocks),
      costumes: costumes(i, t),
      sounds: t.sounds.map((s) => s.name),
    })),
    extensions: json.extensions,
  };
};

const existingProcedures = (target: Target): Record<string, ProcedureInfo> =>
  Object.fromEntries(
    Object.values(target.blocks._blocks)
      .filter((b) => b.opcode === 'procedures_prototype' && b.mutation?.proccode)
      .map((b) => {
        const m = b.mutation ?? {};
        const proccode = String(m.proccode);
        return [
          proccode.replace(/ %[sbn]/g, ''),
          {
            proccode,
            argIds: JSON.parse(m.argumentids ?? '[]') as string[],
            argNames: JSON.parse(m.argumentnames ?? '[]') as string[],
          },
        ];
      }),
  );

const fail = (errors: string[]): never => {
  throw new Error(`Nothing was added, please fix:\n- ${errors.slice(0, 15).join('\n- ')}`);
};

/** Adds sb3 blocks to a target and shows that target in the editor. */
export const applySb3Blocks = async (vm: VirtualMachine, target: Target, blocks: Sb3Blocks): Promise<number> => {
  const vmBlocks = sb3BlocksToVm(blocks);
  await vm.shareBlocksToTarget(vmBlocks, target.id);
  vm.setEditingTarget(target.id); // show the kid where the code went
  vm.refreshWorkspace();
  return vmBlocks.length;
};

export interface ProjectToolOptions {
  /** tidies the editor after scripts were added (the editor's "Blöcke aufräumen"); none in headless tests */
  cleanUp?: () => Promise<void> | void;
  /** the shown sprite's scripts that the editor fails to show (see ui-guide); none in headless tests */
  scriptsMissingInEditor?: () => string[];
}

const editorWarning = (sprite: string, missing: string[]): string =>
  `The editor failed to show ${missing.length} script(s) of ${sprite} (their first blocks: ${missing.join(', ')}). ` +
  'They are in the project and run, but the kid cannot see them. Do not add them again. Tell the kid that ' +
  'the editor does not show these scripts right now and ask an adult for help.';

/** Sprites that the target's "touching …?" blocks check (mouse pointer and edge left out). */
const touchedSprites = (target: Target): Set<string> =>
  new Set(
    Object.values(target.blocks._blocks)
      .filter((b) => b.opcode === 'sensing_touchingobjectmenu')
      .map((b) => b.fields.TOUCHINGOBJECTMENU?.value ?? '')
      .filter((name) => name && !name.startsWith('_')),
  );

/** Sprites that check touching the target while the target checks touching them, too. */
const mutualTouchChecks = (vm: VirtualMachine, target: Target): string[] => {
  const name = target.getName();
  return [...touchedSprites(target)].filter((other) => {
    const t = vm.runtime.targets.find((x) => x.isOriginal && !x.isStage && x.getName() === other);
    return t !== undefined && touchedSprites(t).has(name);
  });
};

const touchWarning = (sprite: string, others: string[]): string =>
  `${sprite} and ${others.join(', ')} both check whether they touch each other. Their scripts run one after ` +
  'the other, so often only one of them notices the touch (e.g. one hides or switches costume first). Keep ' +
  'the touch check in one sprite and let it send a message (event_broadcast) that the other sprite handles ' +
  'with event_whenbroadcastreceived; remove the other check. Fix it now and tell the kid why in one sentence.';

/** The target hides itself, but no green-flag script sets its visibility outside of loops and ifs. */
const staysHiddenAfterStop = (target: Target): boolean => {
  const { blocks } = target;
  if (!Object.values(blocks._blocks).some((b) => b.opcode === 'looks_hide')) return false;
  return !blocks.getScripts().some((id) => {
    if (blocks.getBlock(id)?.opcode !== 'event_whenflagclicked') return false;
    for (let b = blocks.getBlock(id); b; b = b.next ? blocks.getBlock(b.next) : undefined) {
      if (b.opcode === 'looks_show' || b.opcode === 'looks_hide') return true;
    }
    return false;
  });
};

const hiddenWarning = (sprite: string): string =>
  `${sprite} hides itself, but no green-flag script shows it at the start. If the kid stops the game while ` +
  `${sprite} is hidden, it stays invisible after the next green flag (and hidden sprites touch nothing). Start ` +
  'a green-flag script with looks_show and the start position, before its loop, unless you are about to add ' +
  'such a script anyway.';

export const createProjectTools = (
  vm: VirtualMachine,
  { cleanUp, scriptsMissingInEditor }: ProjectToolOptions = {},
): ToolHandlers => ({
  get_project: () => projectSnapshot(vm),
  add_scripts: async (args) => {
    const target = findTarget(vm, stringArg(args, 'sprite'));
    const scripts = jsonArg(args, 'scripts');
    if (!Array.isArray(scripts)) return fail(['"scripts" must be a list of scripts (each a list of blocks)']);
    const { blocks, errors } = compileScripts(scripts, { procedures: existingProcedures(target) });
    if (errors.length) fail(errors);
    const added = await applySb3Blocks(vm, target, blocks);
    try {
      await cleanUp?.();
    } catch (e) {
      // the scripts are in; a failed tidy-up must not make the model add them again
      console.warn('add_scripts: cleaning up the editor failed', e);
    }
    let missing: string[] = [];
    try {
      missing = scriptsMissingInEditor?.() ?? [];
    } catch (e) {
      console.warn('add_scripts: comparing the editor with the project failed', e);
    }
    const mutual = mutualTouchChecks(vm, target);
    const warnings = [
      ...(missing.length ? [editorWarning(target.getName(), missing)] : []),
      ...(mutual.length ? [touchWarning(target.getName(), mutual)] : []),
      ...(staysHiddenAfterStop(target) ? [hiddenWarning(target.getName())] : []),
    ];
    return warnings.length ? { ok: true, added, warning: warnings.join('\n') } : { ok: true, added };
  },
  clear_scripts: (args) => {
    const target = findTarget(vm, stringArg(args, 'sprite'));
    // copy: getScripts() is the VM's live list, and deleteBlock removes from it while we iterate
    for (const id of [...target.blocks.getScripts()]) target.blocks.deleteBlock(id);
    vm.setEditingTarget(target.id);
    vm.refreshWorkspace();
    return { ok: true };
  },
  green_flag: () => {
    vm.greenFlag();
    return { ok: true };
  },
});
