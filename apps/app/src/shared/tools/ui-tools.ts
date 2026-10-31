// Tools that let the assistant *show* things in the editor instead of doing them,
// e.g. "Where is the repeat block?" -> scroll the palette there and point at it.
// Definitions only; the browser runs them through the editor's ui-guide (src/editor/ui-guide.ts).
import { fn, type ToolDefinition } from './tool-types.ts';

export const BLOCK_CATEGORIES = [
  'motion',
  'looks',
  'sound',
  'events',
  'control',
  'sensing',
  'operators',
  'variables',
  'myBlocks',
] as const;

/** Named parts of the editor the assistant can point at (the lookup lives in ui-guide.ts). */
export const UI_ELEMENT_NAMES = [
  'green_flag',
  'stop_button',
  'stage',
  'fullscreen_button',
  'code_tab',
  'costumes_tab',
  'sounds_tab',
  'sprite_list',
  'sprite',
  'sprite_properties',
  'add_sprite_button',
  'stage_selector',
  'add_backdrop_button',
  'extension_button',
  'category',
  'file_menu',
  'edit_menu',
  'project_title',
] as const;
export type UiElementName = (typeof UI_ELEMENT_NAMES)[number];

export const EDITOR_TABS = ['code', 'costumes', 'backdrops', 'sounds'] as const;
export type EditorTab = (typeof EDITOR_TABS)[number];

const label = { type: 'string', description: 'short German hint shown next to the pointer' };

export const uiToolDefinitions: ToolDefinition[] = [
  fn(
    'show_sprite',
    'Selects a sprite (or "Stage") in the editor so its scripts/costumes are shown.',
    { sprite: { type: 'string' } },
    ['sprite'],
  ),
  fn('show_tab', 'Switches the editor tab.', { tab: { type: 'string', enum: EDITOR_TABS } }, ['tab']),
  fn(
    'point_to_palette_block',
    'Scrolls the block palette to a block and points at it, so the learner can find and drag it.',
    { opcode: { type: 'string' }, label },
    ['opcode'],
  ),
  fn(
    'point_to_script_block',
    'Selects the sprite, scrolls its script area to a block and points at it.',
    {
      opcode: { type: 'string' },
      sprite: { type: 'string', description: 'default: the sprite shown right now' },
      nth: {
        type: 'integer',
        minimum: 1,
        description: 'which one if the sprite has several blocks with this opcode (1 = first in reading order)',
      },
      label,
    },
    ['opcode'],
  ),
  fn(
    'point_to_ui_element',
    'Points at a part of the Scratch editor, e.g. the green flag, the costumes tab, a sprite in the sprite list or a block category.',
    {
      element: { type: 'string', enum: UI_ELEMENT_NAMES },
      name: {
        type: 'string',
        description: `sprite name for "sprite"; category id for "category" (${BLOCK_CATEGORIES.join(', ')})`,
      },
      label,
    },
    ['element'],
  ),
];

export const uiToolsPrompt =
  'Wenn ein Kind etwas nicht findet oder es selbst machen möchte, zeige es ihm mit show_sprite, show_tab, ' +
  'point_to_palette_block, point_to_script_block oder point_to_ui_element, statt es selbst zu bauen.';
