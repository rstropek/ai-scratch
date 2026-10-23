// Block catalog extracted from the live editor's palette (scratch-blocks definitions + toolbox
// shadows). Used for validation, the DSL compiler and the compact prompt reference.
import catalogJson from './block-catalog.json' with { type: 'json' };

export type BlockShape = 'hat' | 'stack' | 'cap' | 'reporter' | 'boolean' | 'internal';

export interface InputSpec {
  kind: 'value' | 'statement';
  /** opcode of the shadow block (math_number, a menu …) the palette puts into this input */
  shadow?: string;
  shadowField?: string;
  default?: string;
  boolean?: boolean;
  options?: string[];
  /** target menus: any sprite name is valid as well */
  orSpriteName?: boolean;
  dynamic?: boolean;
}

export interface FieldSpec {
  options?: string[];
  dynamic?: boolean;
}

export interface BlockSpec {
  shape: BlockShape;
  label: string;
  inputs: Record<string, InputSpec>;
  fields: Record<string, FieldSpec>;
}

export const catalog = catalogJson as Record<string, BlockSpec>;

// Custom blocks are not in the palette until defined; describe them by hand.
catalog.procedures_definition ??= {
  shape: 'hat',
  label: 'Definiere (custom_block)',
  inputs: { custom_block: { kind: 'value' } },
  fields: {},
};
catalog.procedures_prototype ??= { shape: 'internal', label: '', inputs: {}, fields: {} };
catalog.procedures_call ??= { shape: 'stack', label: '<custom block>', inputs: {}, fields: {} };
catalog.argument_reporter_string_number ??= { shape: 'reporter', label: '[VALUE]', inputs: {}, fields: { VALUE: {} } };
catalog.argument_reporter_boolean ??= { shape: 'boolean', label: '[VALUE]', inputs: {}, fields: { VALUE: {} } };
catalog.data_variable ??= {
  shape: 'reporter',
  label: '[VARIABLE]',
  inputs: {},
  fields: { VARIABLE: { dynamic: true } },
};
catalog.data_listcontents ??= { shape: 'reporter', label: '[LIST]', inputs: {}, fields: { LIST: { dynamic: true } } };

// Menus whose options depend on the selected sprite (the catalog was captured on one target):
// allow the special values *or* any sprite name.
const TARGET_MENUS: Record<string, string[]> = {
  control_create_clone_of_menu: ['_myself_'],
  sensing_of_object_menu: ['_stage_'],
  motion_goto_menu: ['_random_', '_mouse_'],
  motion_glideto_menu: ['_random_', '_mouse_'],
  motion_pointtowards_menu: ['_mouse_'],
  sensing_touchingobjectmenu: ['_mouse_', '_edge_'],
  sensing_distancetomenu: ['_mouse_'],
};
for (const block of Object.values(catalog)) {
  for (const input of Object.values(block.inputs)) {
    const options = input.shadow ? TARGET_MENUS[input.shadow] : undefined;
    if (options) Object.assign(input, { options, orSpriteName: true });
  }
}

// Shadow blocks (menus, number/text slots) are implementation details; hide them from listings.
const shadowOps = new Set(
  Object.values(catalog).flatMap((b) => Object.values(b.inputs).flatMap((i) => (i.shadow ? [i.shadow] : []))),
);

const optionList = (options: string[]) => `${options.slice(0, 8).join('|')}${options.length > 8 ? '|…' : ''}`;

const inputType = (i: InputSpec) => {
  if (i.boolean) return 'boolean';
  if (i.options) return `${optionList(i.options)}${i.orSpriteName ? '|<sprite name>' : ''}`;
  if (i.dynamic) return 'name';
  return i.shadow?.startsWith('math') ? 'number' : 'text';
};

/** Compact one-line-per-block reference for the system prompt (~2-3k tokens). */
export const catalogReference = (): string =>
  Object.entries(catalog)
    .filter(([op, b]) => b.shape !== 'internal' && !shadowOps.has(op))
    .map(([op, b]) => {
      const parts = [
        ...Object.entries(b.inputs).map(([name, i]) =>
          i.kind === 'statement' ? `${name}:script` : `${name}:${inputType(i)}`,
        ),
        ...Object.entries(b.fields).map(([name, f]) => `${name}=${f.options ? optionList(f.options) : 'name'}`),
      ];
      return `${op} [${b.shape}] ${parts.join(', ')}  // ${b.label}`;
    })
    .join('\n');

const distance = (a: string, b: string): number => {
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        (previous[j] ?? 0) + 1,
        (current[j - 1] ?? 0) + 1,
        (previous[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[b.length] ?? 0;
};

/** The three known opcodes closest to a misspelled one. */
export const suggestOpcodes = (op: string): string[] =>
  Object.keys(catalog)
    .map((k) => [k, distance(op, k)] as const)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 3)
    .map(([k]) => k);
