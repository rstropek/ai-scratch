// A small, LLM-friendly script format ("nested JSON") compiled to sb3 blocks, and back.
//
//   [ {"op": "event_whenflagclicked"},
//     {"op": "looks_say", "MESSAGE": "Hallo"},
//     {"op": "control_repeat", "TIMES": 3, "SUBSTACK": [ {"op": "motion_turnright", "DEGREES": 30} ]},
//     {"op": "control_if", "CONDITION": {"op": "operator_gt", "OPERAND1": {"op": "motion_xposition"}, "OPERAND2": 50},
//      "SUBSTACK": [ ... ]} ]
//
// Inputs and fields are plain keys; literals are inlined; reporters are nested objects; scripts are
// arrays. Variables, lists and broadcasts are referenced by *name*. The compiler does all the
// bookkeeping models get wrong in raw sb3: ids, next/parent links, shadows, primitive codes.
import { catalog, type InputSpec, suggestOpcodes } from './block-catalog.ts';
import type { Sb3Block, Sb3Blocks, Sb3Input, Sb3Primitive } from './vm-types.ts';

/** One block of the script format; inputs and fields are additional keys. */
export interface DslBlock {
  op: string;
  [key: string]: unknown;
}
export type DslScript = DslBlock[];

/** A custom block already defined in the target, so new scripts can call it. */
export interface ProcedureInfo {
  proccode: string;
  argIds: string[];
  argNames: string[];
}

const PRIMITIVE: Record<string, number> = {
  math_number: 4,
  math_positive_number: 5,
  math_whole_number: 6,
  math_integer: 7,
  math_angle: 8,
  colour_picker: 9,
  text: 10,
};
const slug = (s: unknown) => String(s).replace(/[^\w]/g, '_');
const isBlock = (v: unknown): v is DslBlock => typeof v === 'object' && v !== null && !Array.isArray(v);
const json = (v: unknown) => JSON.stringify(v)?.slice(0, 80) ?? String(v);

export const compileScripts = (
  scripts: unknown[],
  { procedures = {} }: { procedures?: Record<string, ProcedureInfo> } = {},
): { blocks: Record<string, Sb3Block>; errors: string[] } => {
  const blocks: Record<string, Sb3Block> = {};
  const errors: string[] = [];
  let n = 0;
  const newId = (op: string) => `${op.split('_')[0]}_${(n++).toString(36)}`;
  const procs = { ...procedures };
  const shapeOf = (op: unknown) => catalog[op === 'argument' ? 'argument_reporter_string_number' : String(op)]?.shape;

  // pass 1: collect custom block definitions so calls can reference them in any order
  for (const script of scripts) {
    const head: unknown = Array.isArray(script) ? script[0] : null;
    if (isBlock(head) && head.op === 'procedures_definition') {
      const params = Array.isArray(head.params) ? head.params.map(String) : [];
      const name = String(head.name);
      procs[name] = {
        proccode: [name, ...params.map(() => '%s')].join(' '),
        argIds: params.map((p) => `arg_${slug(name)}_${slug(p)}`),
        argNames: params,
      };
    }
  }

  const shadowBlock = (opcode: string, field: string | undefined, value: string, parentId: string) => {
    const id = newId(opcode);
    blocks[id] = {
      opcode,
      parent: parentId,
      next: null,
      shadow: true,
      topLevel: false,
      inputs: {},
      fields: { [field ?? '']: [value, null] },
    };
    return id;
  };

  const literalInput = (spec: InputSpec, value: unknown, parentId: string, where: string): Sb3Input | null => {
    const code = spec.shadow ? PRIMITIVE[spec.shadow] : undefined;
    if (code !== undefined) return [1, [code, String(value)]];
    if (spec.shadow === 'event_broadcast_menu') return [1, [11, String(value), `broadcast_${slug(value)}`]];
    if (spec.shadow) {
      if (spec.options && !spec.orSpriteName && !spec.options.includes(String(value))) {
        errors.push(`${where}: "${value}" is invalid. Use one of: ${spec.options.join(', ')}`);
      }
      return [1, shadowBlock(spec.shadow, spec.shadowField, String(value), parentId)];
    }
    errors.push(`${where}: needs a block (e.g. a boolean like operator_gt), not the literal ${JSON.stringify(value)}`);
    return null;
  };

  const defaultShadow = (spec: InputSpec, parentId: string): string | Sb3Primitive | undefined => {
    if (!spec.shadow) return undefined;
    const code = PRIMITIVE[spec.shadow];
    if (code !== undefined) return [code, spec.default ?? ''];
    return shadowBlock(spec.shadow, spec.shadowField, spec.default ?? '', parentId);
  };

  const compileBlock = (node: unknown, parentId: string | null, path: string): string | null => {
    if (!isBlock(node) || typeof node.op !== 'string') {
      errors.push(`${path}: every block needs an "op", got ${json(node)}`);
      return null;
    }
    const where = `${path} (${node.op})`;
    const op = node.op === 'argument' ? 'argument_reporter_string_number' : node.op;
    const spec = catalog[op];
    if (!spec) {
      errors.push(`${where}: unknown op. Did you mean: ${suggestOpcodes(op).join(', ')}?`);
      return null;
    }
    const id = newId(op);
    const inputs: Record<string, Sb3Input> = {};
    const fields: Record<string, [string, string | null]> = {};
    const block: Sb3Block = {
      opcode: op,
      parent: parentId,
      next: null,
      shadow: false,
      topLevel: false,
      inputs,
      fields,
    };
    blocks[id] = block;

    if (op === 'procedures_definition') {
      const p = procs[String(node.name)];
      if (!p) {
        errors.push(`${where}: procedures_definition must start a script and needs a "name"`);
        return id;
      }
      const protoId = newId('procedures_prototype');
      // the editor needs an argument reporter per parameter in the prototype, or it drops the whole definition
      const protoInputs: Record<string, Sb3Input> = {};
      p.argIds.forEach((argId, i) => {
        protoInputs[argId] = [1, shadowBlock('argument_reporter_string_number', 'VALUE', p.argNames[i] ?? '', protoId)];
      });
      blocks[protoId] = {
        opcode: 'procedures_prototype',
        parent: id,
        next: null,
        shadow: true,
        topLevel: false,
        inputs: protoInputs,
        fields: {},
        mutation: {
          tagName: 'mutation',
          children: [],
          proccode: p.proccode,
          argumentids: JSON.stringify(p.argIds),
          argumentnames: JSON.stringify(p.argNames),
          argumentdefaults: JSON.stringify(p.argNames.map(() => '')),
          warp: 'false',
        },
      };
      inputs.custom_block = [1, protoId];
      return id;
    }
    if (op === 'procedures_call') {
      const p = procs[String(node.name)];
      if (!p) {
        const known = Object.keys(procs).join(', ') || '(none)';
        errors.push(
          `${where}: no custom block named "${node.name}". Define it first with procedures_definition. Known: ${known}`,
        );
        return id;
      }
      const args: unknown[] = Array.isArray(node.args) ? node.args : [];
      if (args.length !== p.argIds.length) {
        errors.push(
          `${where}: "${node.name}" expects ${p.argIds.length} args (${p.argNames.join(', ')}), got ${args.length}`,
        );
      }
      block.mutation = {
        tagName: 'mutation',
        children: [],
        proccode: p.proccode,
        argumentids: JSON.stringify(p.argIds),
        warp: 'false',
      };
      p.argIds.forEach((argId, i) => {
        const v = args[i] ?? '';
        inputs[argId] =
          typeof v === 'object' ? [3, compileBlock(v, id, `${where}.args[${i}]`), [10, '']] : [1, [10, String(v)]];
      });
      return id;
    }
    if (op === 'argument_reporter_string_number') {
      fields.VALUE = [String(node.name ?? node.VALUE), null];
      return id;
    }

    for (const [key, value] of Object.entries(node)) {
      if (key === 'op') continue;
      const ispec = spec.inputs[key];
      const fspec = spec.fields[key];
      if (ispec?.kind === 'statement') {
        if (!Array.isArray(value)) {
          errors.push(`${where}: "${key}" must be a list of blocks`);
          continue;
        }
        const first = compileScript(value, id, `${where}.${key}`);
        if (first) inputs[key] = [2, first];
      } else if (ispec) {
        if (value && typeof value === 'object') {
          const childId = compileBlock(value, id, `${where}.${key}`);
          const childOp = isBlock(value) ? value.op : undefined;
          const childShape = shapeOf(childOp);
          if (childShape && !['reporter', 'boolean'].includes(childShape)) {
            errors.push(`${where}.${key}: ${childOp} is a ${childShape} block and cannot be used as a value`);
          }
          if (ispec.boolean && childShape && childShape !== 'boolean') {
            errors.push(`${where}.${key}: needs a boolean block, ${childOp} is a ${childShape}`);
          }
          inputs[key] = ispec.shadow ? [3, childId, defaultShadow(ispec, id)] : [2, childId];
        } else {
          const input = literalInput(ispec, value, id, `${where}.${key}`);
          if (input) inputs[key] = input;
        }
      } else if (fspec) {
        if (fspec.options && !fspec.options.includes(String(value))) {
          errors.push(`${where}: ${key} = "${value}" is invalid. Use one of: ${fspec.options.join(', ')}`);
        }
        const fieldId =
          key === 'VARIABLE'
            ? `var_${slug(value)}`
            : key === 'LIST'
              ? `list_${slug(value)}`
              : key === 'BROADCAST_OPTION'
                ? `broadcast_${slug(value)}`
                : null;
        fields[key] = [String(value), fieldId];
      } else {
        const valid = [...Object.keys(spec.inputs), ...Object.keys(spec.fields)].join(', ') || '(none)';
        errors.push(`${where}: unknown key "${key}". Valid keys: ${valid}`);
      }
    }
    for (const [name, fspec] of Object.entries(spec.fields)) {
      if (!(name in node)) {
        errors.push(`${where}: missing "${name}"${fspec.options ? ` (one of ${fspec.options.join(', ')})` : ''}`);
      }
    }
    // fill omitted value inputs with their default shadow, like the palette does
    for (const [name, ispec] of Object.entries(spec.inputs)) {
      if (!inputs[name] && ispec.kind === 'value' && ispec.shadow) inputs[name] = [1, defaultShadow(ispec, id) ?? null];
    }
    return id;
  };

  const compileScript = (list: unknown[], parentId: string | null, path: string): string | null => {
    let first: string | null = null;
    let prev: string | null = null;
    list.forEach((node, i) => {
      const id = compileBlock(node, prev ?? parentId, `${path}[${i}]`);
      const block = id ? blocks[id] : undefined;
      if (!id || !block) return;
      const shape = shapeOf(block.opcode);
      const op = isBlock(node) ? node.op : '';
      if (shape === 'hat' && (i > 0 || parentId))
        errors.push(`${path}[${i}] (${op}): hat blocks can only start a script`);
      if (shape === 'reporter' || shape === 'boolean') {
        errors.push(`${path}[${i}] (${op}): ${shape} blocks cannot be stacked; use them as input values`);
      }
      const prevBlock = prev ? blocks[prev] : undefined;
      if (prevBlock) prevBlock.next = id;
      first ??= id;
      prev = id;
    });
    return first;
  };

  scripts.forEach((script, i) => {
    if (!Array.isArray(script) || !script.length) {
      errors.push(`scripts[${i}] must be a non-empty list of blocks`);
      return;
    }
    const first = compileScript(script, null, `scripts[${i}]`);
    const head = first ? blocks[first] : undefined;
    if (head) Object.assign(head, { topLevel: true, parent: null, x: 0, y: i * 250 });
  });
  return { blocks, errors };
};

const NUMBER_PRIMITIVES = new Set([4, 5, 6, 7, 8]);
const procName = (proccode: string | undefined) => (proccode ?? '').replace(/ %[sbn]/g, '');
const parseIds = (value: string | undefined): string[] => JSON.parse(value ?? '[]');

/** sb3 blocks of a target (project.json format) -> nested script format (for reading the project) */
export const decompileBlocks = (sb3Blocks: Sb3Blocks): DslScript[] => {
  const blockAt = (id: string): Sb3Block | undefined => {
    const b = sb3Blocks[id];
    return b && !Array.isArray(b) ? b : undefined;
  };
  const primitiveValue = ([type, value]: Sb3Primitive): unknown => {
    if (NUMBER_PRIMITIVES.has(type)) return Number(value);
    // variables and lists dropped into an input are serialized as primitives, not blocks
    if (type === 12) return { op: 'data_variable', VARIABLE: value };
    if (type === 13) return { op: 'data_listcontents', LIST: value };
    return value;
  };
  const inputValue = (input: Sb3Input): unknown => {
    const v = input[1];
    if (Array.isArray(v)) return primitiveValue(v);
    const b = v ? blockAt(v) : undefined;
    if (!v || !b) return null;
    if (b.shadow) {
      const f = Object.values(b.fields ?? {})[0];
      return Array.isArray(f) ? f[0] : f;
    }
    return node(v);
  };
  const node = (id: string): DslBlock => {
    const b = blockAt(id);
    if (!b) return { op: 'unknown' };
    if (b.opcode === 'procedures_definition') {
      const protoId = b.inputs?.custom_block?.[1];
      const proto = typeof protoId === 'string' ? blockAt(protoId) : undefined;
      return {
        op: b.opcode,
        name: procName(proto?.mutation?.proccode),
        params: parseIds(proto?.mutation?.argumentnames),
      };
    }
    if (b.opcode === 'procedures_call') {
      const args = parseIds(b.mutation?.argumentids).map((a) => {
        const input = b.inputs?.[a];
        return input ? inputValue(input) : '';
      });
      return { op: b.opcode, name: procName(b.mutation?.proccode), args };
    }
    if (b.opcode.startsWith('argument_reporter')) {
      const f = b.fields?.VALUE;
      return { op: 'argument', name: Array.isArray(f) ? f[0] : f };
    }
    const out: DslBlock = { op: b.opcode };
    const spec = catalog[b.opcode];
    for (const [name, input] of Object.entries(b.inputs ?? {})) {
      out[name] =
        spec?.inputs[name]?.kind === 'statement'
          ? script(typeof input[1] === 'string' ? input[1] : null)
          : inputValue(input);
    }
    for (const [name, f] of Object.entries(b.fields ?? {})) out[name] = Array.isArray(f) ? f[0] : f;
    return out;
  };
  const script = (firstId: string | null): DslScript => {
    const list: DslScript = [];
    for (let id = firstId; id; id = blockAt(id)?.next ?? null) list.push(node(id));
    return list;
  };
  return Object.entries(sb3Blocks)
    .filter(([, b]) => !Array.isArray(b) && b.topLevel && !b.shadow)
    .map(([id]) => script(id));
};
