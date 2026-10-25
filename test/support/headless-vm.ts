// Headless scratch-vm for tests: no renderer, no audio, no network. Scripts still run (motion,
// variables, say events, broadcasts, timers), which is enough to check the *behaviour* of generated
// scripts instead of comparing JSON.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { registerKiExtension } from '../../src/editor/ki-extension.ts';
import type { Ask } from '../../src/shared/ki-block.ts';
import type { Target, Variable, VirtualMachine } from '../../src/shared/scratch/vm-types.ts';
import type { LibraryItem, LibraryKind, LoadLibrary } from '../../src/shared/tools/asset-tools.ts';

const require = createRequire(import.meta.url);

// scratch-vm logs (tslog) a lot in headless mode (missing storage, dispatch, reconciled refs); mute it.
const origLog = console.log;
console.log = (...args: unknown[]) => {
  if (args.some((a) => typeof a === 'string' && a.includes('scratch-vm'))) return;
  origLog(...args);
};
const VM = require('@scratch/scratch-vm') as new () => VirtualMachine;
const { ScratchStorage } = require('@scratch/scratch-storage') as { ScratchStorage: new () => unknown };

export interface Said {
  sprite: string;
  type: string;
  text: string;
}
export interface TestVm extends VirtualMachine {
  says: Said[];
  /** positions visited by sprites (to check movement that ends where it started) */
  path: { sprite: string; x: number; y: number }[];
}

export const loadFixture = (name: string): string =>
  fs.readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8');

/** `ask` answers the "frage KI" blocks (without one they say that the code is missing). */
export const createVm = async (
  projectJson = loadFixture('default-project'),
  { ask }: { ask?: Ask } = {},
): Promise<TestVm> => {
  const vm = Object.assign(new VM(), { says: [] as Said[], path: [] as TestVm['path'] });
  // like the editor: projects with KI blocks load only where the extension is registered
  registerKiExtension(vm, () => ask);
  await vm.loadProject(projectJson);
  vm.runtime.on('SAY', (target: Target, type: string, text: unknown) =>
    vm.says.push({ sprite: target.getName(), type, text: String(text) }),
  );
  for (const t of vm.runtime.targets) {
    t.on('TARGET_MOVED', (m) => vm.path.push({ sprite: m.getName(), x: m.x, y: m.y }));
  }
  return vm;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Clicks the green flag and lets the project run for `ms` milliseconds.
 * `during(vm)` can simulate input while running; `probe(vm)` inspects state before the stop
 * (stopping deletes clones).
 */
export const runGreenFlag = async <T>(
  vm: TestVm,
  ms = 3000,
  { during, probe }: { during?: (vm: TestVm) => Promise<void>; probe?: (vm: TestVm) => T } = {},
): Promise<T | undefined> => {
  vm.start();
  vm.greenFlag();
  await Promise.all([sleep(ms), during?.(vm)]);
  const result = probe?.(vm);
  vm.stopAll();
  vm.quit();
  return result;
};

export const pressKey = async (vm: VirtualMachine, key: string, holdMs = 50): Promise<void> => {
  vm.postIOData('keyboard', { key, isDown: true });
  await sleep(holdMs);
  vm.postIOData('keyboard', { key, isDown: false });
};

export const sprite = (vm: VirtualMachine, name = 'Sprite1'): Target => {
  const target = vm.runtime.targets.find((t) => t.isOriginal && t.getName() === name);
  if (!target) throw new Error(`No sprite ${name}`);
  return target;
};

export const findVariable = (vm: VirtualMachine, name: string): Variable | undefined => {
  for (const t of vm.runtime.targets) {
    const v = Object.values(t.variables).find((x) => x.name.toLowerCase() === name.toLowerCase() && x.type === '');
    if (v) return v;
  }
  return undefined;
};

// --- assets (library + drawn costumes) ----------------------------------------------------------
const LIBRARY_DIR = new URL('../../node_modules/@scratch/scratch-gui/dist/libraries/', import.meta.url);

/** Storage with only the built-in default assets: enough for drawn SVG costumes and offlineLibrary. */
export const withStorage = <T extends VirtualMachine>(vm: T): T => {
  vm.attachStorage(new ScratchStorage());
  return vm;
};

export const libraryItems = (kind: LibraryKind): LibraryItem[] =>
  JSON.parse(fs.readFileSync(new URL(`${kind}s.json`, LIBRARY_DIR), 'utf8'));

/**
 * The real library names/tags/costume names, but every asset points at a built-in default asset, so
 * tests need no network (the Scratch CDN serves the real files in the browser).
 */
export const offlineLibrary =
  (vm: VirtualMachine): LoadLibrary =>
  async (kind) => {
    const ids = vm.runtime.storage.defaultAssetId;
    const vector = { assetId: ids.ImageVector, md5ext: `${ids.ImageVector}.svg`, dataFormat: 'svg' };
    const sound = { assetId: ids.Sound, md5ext: `${ids.Sound}.wav`, dataFormat: 'wav' };
    return libraryItems(kind).map((item) =>
      kind === 'sprite'
        ? {
            ...item,
            costumes: (item.costumes ?? []).map((c) => ({ ...c, ...vector })),
            sounds: (item.sounds ?? []).map((s) => ({ ...s, ...sound })),
          }
        : { ...item, ...vector },
    );
  };
