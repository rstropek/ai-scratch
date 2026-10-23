// Converts the "blocks" object of a target in sb3 project.json format into the VM's internal block
// array as accepted by vm.shareBlocksToTarget(). Mirrors scratch-vm/src/serialization/sb3.js
// #deserializeBlocks, which is not exported by the scratch-gui bundle, and additionally *repairs*
// structure (parent / topLevel / x,y), so a slip in the bookkeeping fields can't crash the VM.
import type { Sb3Blocks, Sb3Primitive, VmBlock } from './vm-types.ts';

const PRIMITIVES: Record<number, [opcode: string, field: string, variableType?: string]> = {
  4: ['math_number', 'NUM'],
  5: ['math_positive_number', 'NUM'],
  6: ['math_whole_number', 'NUM'],
  7: ['math_integer', 'NUM'],
  8: ['math_angle', 'NUM'],
  9: ['colour_picker', 'COLOUR'],
  10: ['text', 'TEXT'],
  11: ['event_broadcast_menu', 'BROADCAST_OPTION', 'broadcast_msg'],
  12: ['data_variable', 'VARIABLE', ''],
  13: ['data_listcontents', 'LIST', 'list'],
};

/** Fields that reference a variable, list or broadcast carry its type, like sb3.js#deserializeFields sets it.
 * Without it the editor fails to load the sprite's workspace and silently drops the remaining scripts. */
const FIELD_VARIABLE_TYPES: Record<string, string> = { VARIABLE: '', LIST: 'list', BROADCAST_OPTION: 'broadcast_msg' };

let counter = 0;
const uid = () => `ai_${Date.now().toString(36)}_${(counter++).toString(36)}`;

const primitiveToBlock = (desc: Sb3Primitive, parentId: string, shadow: boolean, out: VmBlock[]): string => {
  const [type, value, varId] = desc;
  const info = PRIMITIVES[type];
  if (!info) throw new Error(`Unknown primitive type ${type}`);
  const [opcode, field, variableType] = info;
  const block: VmBlock = {
    id: uid(),
    opcode,
    parent: parentId,
    next: null,
    shadow,
    topLevel: false,
    inputs: {},
    fields: {
      [field]: {
        name: field,
        value: String(value),
        ...(variableType !== undefined ? { id: varId ?? undefined, variableType } : {}),
      },
    },
  };
  out.push(block);
  return block.id;
};

export const sb3BlocksToVm = (sb3Blocks: Sb3Blocks): VmBlock[] => {
  const out: VmBlock[] = [];
  const ids = new Set(Object.keys(sb3Blocks));
  for (const [id, b] of Object.entries(sb3Blocks)) {
    if (Array.isArray(b)) continue; // top-level variable reporter; not needed for scripts
    if (!b || typeof b.opcode !== 'string') throw new Error(`Block ${id} has no opcode`);
    const block: VmBlock = {
      id,
      opcode: b.opcode,
      next: b.next ?? null,
      parent: null,
      shadow: !!b.shadow,
      topLevel: false,
      inputs: {},
      fields: {},
      x: b.x,
      y: b.y,
    };
    if (block.next && !ids.has(block.next)) throw new Error(`Block ${id}: next "${block.next}" does not exist`);
    for (const [name, input] of Object.entries(b.inputs ?? {})) {
      if (!Array.isArray(input)) throw new Error(`Block ${id}: input ${name} must be an array`);
      const [kind, first, second] = input;
      const resolve = (v: string | Sb3Primitive | null | undefined, shadow: boolean): string | null => {
        if (v === null || v === undefined) return null;
        if (Array.isArray(v)) return primitiveToBlock(v, id, shadow, out);
        if (!ids.has(v)) throw new Error(`Block ${id}: input ${name} references missing block "${v}"`);
        return v;
      };
      const blockId = resolve(first, kind === 1);
      const shadowId = kind === 1 ? blockId : kind === 3 ? resolve(second, true) : null;
      block.inputs[name] = { name, block: blockId, shadow: shadowId };
    }
    for (const [name, field] of Object.entries(b.fields ?? {})) {
      const [value, fieldId] = Array.isArray(field) ? field : [field];
      const variableType = FIELD_VARIABLE_TYPES[name];
      block.fields[name] = {
        name,
        value: String(value),
        ...(fieldId != null ? { id: fieldId } : {}),
        ...(variableType !== undefined ? { variableType } : {}),
      };
    }
    // the VM's mutationToXML crashes without tagName/children
    if (b.mutation) block.mutation = { tagName: 'mutation', children: [], ...b.mutation };
    out.push(block);
  }
  // Repair parent pointers from the actual structure (next + inputs).
  const byId = new Map(out.map((b) => [b.id, b]));
  for (const b of out) {
    const next = b.next ? byId.get(b.next) : undefined;
    if (next) next.parent = b.id;
    for (const input of Object.values(b.inputs)) {
      for (const childId of [input.block, input.shadow]) {
        const child = childId ? byId.get(childId) : undefined;
        if (child && child.parent === null) child.parent = b.id;
      }
    }
  }
  let y = 0;
  for (const b of out) {
    if (b.parent === null) {
      b.topLevel = true;
      b.shadow = false;
      b.x = b.x ?? 0;
      if (b.y === undefined) {
        y += 150;
        b.y = y;
      }
    }
  }
  return out;
};
