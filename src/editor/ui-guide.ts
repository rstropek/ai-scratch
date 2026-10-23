// Remote-controls the (unmodified) Scratch editor UI to guide a learner:
// select sprite/stage, switch tabs, open a block category, scroll to a block and point at it,
// point at named GUI elements (green flag, costumes tab, sprite in the sprite list …).
//
// Access paths, from most to least "official":
//   1. vm.setEditingTarget()            – public VM API, GUI follows automatically
//   2. redux store.dispatch(action)     – GUI's own redux actions (stable action type strings)
//   3. ScratchBlocks (Blockly) module   – not exported by scratch-gui; located inside the webpack
//      runtime by *capability* (exports getMainWorkspace + centerOnBlock), so no hardcoded module id.
//      This is the one internal hook; e2e/ui-guide.spec.ts guards it.

import { findTarget, type GuiStore, type Target, type VirtualMachine } from '../shared/scratch/vm-types.ts';
import type { EditorTab, UiElementName } from '../shared/tools/ui-tools.ts';

// --- the bits of ScratchBlocks (Blockly) used here -----------------------------------------------
interface BlocklyBlock {
  id: string;
  type: string;
  isShadow(): boolean;
  select(): void;
  getSvgRoot(): Element;
  getRelativeToSurfaceXY(): { x: number; y: number };
}
interface BlocklyWorkspace {
  getTopBlocks(): BlocklyBlock[];
  getAllBlocks(ordered: boolean): BlocklyBlock[];
  getBlockById(id: string): BlocklyBlock | null;
  centerOnBlock(id: string): void;
  cleanUp(): void;
  getFlyout(): { getWorkspace(): BlocklyWorkspace; scrollTo(y: number): void };
  getToolbox(): { getToolboxItemById(id: string): unknown; setSelectedItem(item: unknown): void };
}
interface ScratchBlocks {
  getMainWorkspace(): BlocklyWorkspace;
}
type WebpackRequire = ((id: string) => unknown) & { m: Record<string, (...args: unknown[]) => unknown> };

declare global {
  interface Window {
    webpackChunkGUI?: { push(chunk: [symbol[], object, (require: WebpackRequire) => void]): void };
  }
}

const TABS: Record<EditorTab, number> = { code: 0, costumes: 1, backdrops: 1, sounds: 2 };

let scratchBlocks: ScratchBlocks | undefined;
export const getScratchBlocks = (): ScratchBlocks => {
  if (scratchBlocks) return scratchBlocks;
  let req: WebpackRequire | undefined;
  window.webpackChunkGUI?.push([[Symbol('ki-ui-guide')], {}, (r) => (req = r)]);
  const modules = req?.m ?? {};
  const id = Object.keys(modules).find((k) => {
    const src = modules[k]?.toString() ?? '';
    return src.includes('getMainWorkspace') && src.includes('centerOnBlock');
  });
  const mod = id && req ? (req(id) as Partial<ScratchBlocks>) : undefined;
  if (!mod?.getMainWorkspace) throw new Error('ScratchBlocks module not found');
  scratchBlocks = mod as ScratchBlocks;
  return scratchBlocks;
};

const workspace = () => getScratchBlocks().getMainWorkspace();
// rAF never fires in hidden/background tabs; never let a UI helper block the agent loop.
const nextFrame = () =>
  Promise.race([
    new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
    new Promise((r) => setTimeout(r, 150)),
  ]);

export const selectTarget = (vm: VirtualMachine, name: string): Target => {
  const target = findTarget(vm, name);
  vm.setEditingTarget(target.id);
  return target;
};

export const openTab = (store: GuiStore, tab: string): void => {
  if (!Object.hasOwn(TABS, tab)) throw new Error(`Unknown tab ${tab}`);
  store.dispatch({ type: 'scratch-gui/navigation/ACTIVATE_TAB', activeTabIndex: TABS[tab as EditorTab] });
};

/** Scratch's "Blöcke aufräumen": stacks the shown sprite's scripts in one column, without overlaps.
 * The moves reach the VM through the editor's own change events, so the .sb3 keeps the layout. */
export const cleanUpScripts = async (store: GuiStore): Promise<void> => {
  openTab(store, 'code'); // a hidden workspace has no block sizes to lay out with
  await nextFrame();
  workspace().cleanUp();
};

/** The shown sprite's scripts that run in the VM but are missing in the editor, as opcodes of their
 * top blocks. When the editor can't load a block it stops and drops every script after it, and the
 * error only reaches the console; this catches any such cause. */
export const scriptsMissingInEditor = (vm: VirtualMachine): string[] => {
  const target = vm.editingTarget;
  if (!target) return [];
  const shown = new Set(
    workspace()
      .getTopBlocks()
      .map((b) => b.id),
  );
  return target.blocks
    .getScripts()
    .filter((id) => !shown.has(id))
    .map((id) => target.blocks.getBlock(id)?.opcode ?? id);
};

export const openCategory = (category: string): void => {
  // ids: motion, looks, sound, events, control, sensing, operators, variables, myBlocks
  // (selectCategoryByName() would need the *localized* label, e.g. "Steuerung")
  const toolbox = workspace().getToolbox();
  const item = toolbox.getToolboxItemById(category);
  if (!item) throw new Error(`Unknown category ${category}`);
  toolbox.setSelectedItem(item);
};

let overlay: HTMLDivElement | undefined;

// Styles live here (not in the host's CSS) because the pointer is drawn inside the editor document.
const STYLE = `
.ki-pointer { position: fixed; pointer-events: none; z-index: 10000; }
.ki-ring { position: absolute; inset: 0; border: 4px solid #ff4fa3; border-radius: 10px; animation: ki-pulse 1s ease-in-out infinite; }
.ki-label { position: absolute; top: -30px; left: 0; background: #ff4fa3; color: white; font-weight: bold; padding: 2px 8px; border-radius: 6px; white-space: nowrap; }
.ki-label.ki-below { top: auto; bottom: -30px; }
@keyframes ki-pulse { 50% { transform: scale(1.06); opacity: .6; } }`;
const ensureStyle = () => {
  if (document.getElementById('ki-ui-guide-style')) return;
  const style = document.createElement('style');
  style.id = 'ki-ui-guide-style';
  style.textContent = STYLE;
  document.head.append(style);
};

type Find = () => Element | null | undefined;

/** Draws a pulsing ring + label around an element's on-screen box and follows it for `ms`. */
const pointAt = (getElement: Find, label: string, ms = 6000) => {
  ensureStyle();
  overlay?.remove();
  const me = document.createElement('div');
  me.className = 'ki-pointer';
  const ring = document.createElement('div');
  ring.className = 'ki-ring';
  const text = document.createElement('div');
  text.className = 'ki-label';
  text.textContent = `👉 ${label}`;
  me.append(ring, text);
  document.body.append(me);
  overlay = me;
  const until = performance.now() + ms;
  const follow = () => {
    if (me !== overlay) return;
    const el = getElement();
    if (!el || performance.now() > until) {
      me.remove();
      return;
    }
    const r = el.getBoundingClientRect();
    Object.assign(me.style, {
      left: `${r.left - 6}px`,
      top: `${r.top - 6}px`,
      width: `${r.width + 12}px`,
      height: `${r.height + 12}px`,
    });
    text.classList.toggle('ki-below', r.top < 40); // menu bar items: label below instead of off-screen
    requestAnimationFrame(follow);
  };
  follow();
};

// The GUI re-renders asynchronously after a sprite/tab change; poll with timers (rAF is paused in hidden tabs).
const waitFor = async <T>(find: () => T | null | undefined, ms = 2000): Promise<T | null | undefined> => {
  for (const until = Date.now() + ms; ; ) {
    const found = find();
    if (found || Date.now() > until) return found;
    await new Promise((r) => setTimeout(r, 50));
  }
};

const PALETTE_CATEGORY: Record<string, string> = {
  data: 'variables',
  procedures: 'myBlocks',
  event: 'events',
  operator: 'operators',
};

/** Scrolls the palette (flyout) to a block, e.g. "motion_turnright", and points at it. */
export const pointAtPaletteBlock = async (opcode: string, label = 'Hier!'): Promise<void> => {
  const flyout = workspace().getFlyout();
  const block = await waitFor(() =>
    flyout
      .getWorkspace()
      .getTopBlocks()
      .find((b) => b.type === opcode),
  );
  if (!block) throw new Error(`Block ${opcode} not in palette`);
  const prefix = opcode.split('_')[0] ?? opcode;
  try {
    openCategory(PALETTE_CATEGORY[prefix] ?? prefix); // highlights the category bubble
  } catch {
    // extension blocks (pen_, music_ …) have their own category ids
  }
  // scrollToCategory only reaches the category start; long categories need the block itself in view
  flyout.scrollTo(Math.max(0, block.getRelativeToSurfaceXY().y - 40));
  pointAt(() => block.getSvgRoot(), label);
};

/**
 * Scrolls the script area to a block of the current sprite and points at it.
 * `nth` (1-based) picks between several blocks with the same opcode, in reading order.
 * Pass the VM `target` right after a sprite switch: the workspace still shows the old sprite for a moment.
 */
export const pointAtScriptBlock = async (
  opcodeOrId: string,
  label = 'Hier!',
  nth = 1,
  target?: Target | null,
): Promise<void> => {
  const ws = workspace();
  const own = (b: BlocklyBlock) => !target || !!target.blocks.getBlock(b.id);
  const block = await waitFor(() => {
    const byId = ws.getBlockById(opcodeOrId);
    if (byId && own(byId)) return byId;
    return ws.getAllBlocks(true).filter((b) => b.type === opcodeOrId && !b.isShadow() && own(b))[nth - 1];
  });
  if (!block) throw new Error(`Block ${opcodeOrId}${nth > 1 ? ` #${nth}` : ''} not in the scripts of this sprite`);
  ws.centerOnBlock(block.id);
  block.select();
  await nextFrame();
  pointAt(() => block.getSvgRoot(), label);
};

// Named GUI elements. scratch-gui uses CSS modules ("green-flag_green-flag_1kiAo"): match the stable
// "<file>_<class>_" prefix, never the hash. Menu items have no distinguishing class, so they go by label.
const byClass = (cls: string) => () => document.querySelector(`[class*="${cls}_"]`);
const menuItem = (labels: string[]) => () =>
  [...document.querySelectorAll('[class*="menu-bar_menu-bar-item_"]')].find((e) =>
    labels.includes(e.textContent?.trim() ?? ''),
  );
const tab = (n: number) => () => document.querySelectorAll('[class*="gui_tab_"]')[n];
const spriteItem = (name: string) => () =>
  [...document.querySelectorAll('[class*="sprite-selector-item_sprite-selector-item_"]')].find(
    (e) => e.querySelector('[class*="sprite-selector-item_sprite-name_"]')?.textContent === name,
  );
const category = (id: string) => () =>
  document.querySelector(`.blocklyToolboxCategoryContainer[id="${CSS.escape(id)}"]`);

export const UI_ELEMENTS: Record<UiElementName, Find | ((name: string) => Find)> = {
  green_flag: byClass('green-flag_green-flag'),
  stop_button: byClass('stop-all_stop-all'),
  stage: byClass('stage_stage'),
  fullscreen_button: byClass('stage-header_stage-button'),
  code_tab: tab(0),
  costumes_tab: tab(1),
  sounds_tab: tab(2),
  sprite_list: byClass('sprite-selector_items-wrapper'),
  sprite: spriteItem,
  sprite_properties: byClass('sprite-info_sprite-info'), // name, x/y, show, size, direction
  add_sprite_button: byClass('sprite-selector_add-button'),
  stage_selector: byClass('stage-selector_stage-selector'),
  add_backdrop_button: byClass('stage-selector_add-button'),
  extension_button: byClass('extension-button_extension-button'),
  category,
  file_menu: menuItem(['Datei', 'File']),
  edit_menu: menuItem(['Bearbeiten', 'Edit']),
  project_title: byClass('project-title-input_title-field'),
};

/** Points at a named GUI element (see UI_ELEMENTS); `name` selects the sprite or category id. */
export const pointAtUiElement = async (element: string, label = 'Hier!', name?: string): Promise<void> => {
  if (!Object.hasOwn(UI_ELEMENTS, element)) throw new Error(`Unknown UI element ${element}`);
  let find: Find;
  if (element === 'sprite' || element === 'category') {
    if (!name) throw new Error(`${element} needs a name`);
    find = element === 'sprite' ? spriteItem(name) : category(name);
    if (element === 'category') openCategory(name);
  } else {
    find = UI_ELEMENTS[element as UiElementName] as Find;
  }
  if (!(await waitFor(find, 1000))) throw new Error(`${element}${name ? ` "${name}"` : ''} is not visible right now`);
  pointAt(find, label);
};
