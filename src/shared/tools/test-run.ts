// test_run: plays the project on the live VM for a few seconds, like a kid trying it, and reports what
// happened as a short timeline, so the assistant can see a bug instead of guessing from the scripts.
// Scripts stay as they are; positions, costumes and variables end where the run left them, as after the
// kid's own try, and the game is stopped at the end.
import type { Target, VirtualMachine } from '../scratch/vm-types.ts';
import { jsonArg, type ToolArgs } from './tool-types.ts';

export const TEST_RUN_MAX_SECONDS = 10;
const MAX_ACTION_SECONDS = 15;
const SAMPLE_MS = 500;
const TICK_MS = 50;
const MAX_LOG = 60;

type Action =
  | { kind: 'wait'; seconds: number }
  | { kind: 'key'; key: string; seconds: number }
  | { kind: 'click'; sprite: string; nth: number }
  | { kind: 'clickAt'; x: number; y: number };

// Scratch takes the browser's key names
const KEYS: Record<string, string> = {
  space: ' ',
  leertaste: ' ',
  left: 'ArrowLeft',
  right: 'ArrowRight',
  up: 'ArrowUp',
  down: 'ArrowDown',
  enter: 'Enter',
};

const parseAction = (text: unknown): Action => {
  const wrong = () =>
    new Error(
      `Unknown action ${JSON.stringify(text)}. Use "key:space", "key:left:2", "click:<sprite>", "click:<sprite>#2", "click:100,-50" or "wait:1".`,
    );
  if (typeof text !== 'string') throw wrong();
  const [kind, ...rest] = text.split(':');
  const arg = rest.join(':').trim();
  if (kind === 'wait' && Number(arg) > 0) return { kind: 'wait', seconds: Number(arg) };
  if (kind === 'key' && arg) {
    const [name = '', hold] = arg.split(':');
    const lower = name
      .trim()
      .toLowerCase()
      .replace(/ ?(arrow|pfeil)$/, '');
    const key = KEYS[lower] ?? (lower.length === 1 ? lower : undefined);
    if (!key) throw new Error(`Unknown key "${name}". Use space, left, right, up, down, enter or a letter.`);
    return { kind: 'key', key, seconds: hold ? Math.max(0.1, Number(hold) || 0.1) : 0.1 };
  }
  if (kind === 'click' && arg) {
    const point = arg.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
    if (point) return { kind: 'clickAt', x: Number(point[1]), y: Number(point[2]) };
    const [sprite = '', nth] = arg.split('#');
    return { kind: 'click', sprite: sprite.trim(), nth: Math.max(1, Number(nth) || 1) };
  }
  throw wrong();
};

const actionSeconds = (a: Action) => (a.kind === 'wait' || a.kind === 'key' ? a.seconds : 0.1);

interface Look {
  x: number;
  y: number;
  shown: boolean;
  costume: string;
  ghost: number;
}
interface Sample {
  looks: Map<string, Look>;
  clones: Map<string, number>;
  values: Map<string, string>;
  backdrop: string;
}

const look = (t: Target): Look => ({
  x: Math.round(t.x),
  y: Math.round(t.y),
  shown: t.visible,
  costume: t.getCostumes()[t.currentCostume]?.name ?? '',
  ghost: Math.round(t.effects?.ghost ?? 0),
});

const show = (value: unknown): string => {
  if (!Array.isArray(value)) return JSON.stringify(value);
  const items = value.slice(0, 10).map((v) => JSON.stringify(v));
  return `[${items.join(', ')}${value.length > 10 ? `, … ${value.length} items` : ''}]`;
};

const sample = (vm: VirtualMachine): Sample => {
  const s: Sample = { looks: new Map(), clones: new Map(), values: new Map(), backdrop: '' };
  for (const t of vm.runtime.targets) {
    if (t.isStage) {
      s.backdrop = t.getCostumes()[t.currentCostume]?.name ?? '';
    } else if (t.isOriginal) {
      s.looks.set(t.getName(), look(t));
    } else {
      s.clones.set(t.getName(), (s.clones.get(t.getName()) ?? 0) + 1);
    }
    if (!t.isOriginal) continue;
    for (const v of Object.values(t.variables)) {
      if (v.type !== '' && v.type !== 'list') continue;
      s.values.set(t.isStage ? v.name : `${t.getName()}: ${v.name}`, show(v.value));
    }
  }
  return s;
};

const spriteLine = (name: string, l: Look, clones = 0) =>
  `${name}: x ${l.x}, y ${l.y}, ${l.shown ? 'shown' : 'hidden'}, costume "${l.costume}"` +
  (l.ghost ? `, ghost ${l.ghost}` : '') +
  (clones ? `, ${clones} clones` : '');

const changes = (a: Sample, b: Sample): string[] => {
  const out: string[] = [];
  for (const [name, now] of b.looks) {
    const was = a.looks.get(name);
    if (!was) continue;
    const parts: string[] = [];
    if (was.x !== now.x) parts.push(`x ${was.x}→${now.x}`);
    if (was.y !== now.y) parts.push(`y ${was.y}→${now.y}`);
    if (was.shown !== now.shown) parts.push(now.shown ? 'shown' : 'hidden');
    if (was.costume !== now.costume) parts.push(`costume "${now.costume}"`);
    if (was.ghost !== now.ghost) parts.push(`ghost ${now.ghost}`);
    if (parts.length) out.push(`${name} ${parts.join(', ')}`);
  }
  for (const name of new Set([...a.clones.keys(), ...b.clones.keys()])) {
    const was = a.clones.get(name) ?? 0;
    const now = b.clones.get(name) ?? 0;
    if (was !== now) out.push(`${name} clones ${was}→${now}`);
  }
  for (const [name, now] of b.values) if (a.values.get(name) !== now) out.push(`${name} = ${now}`);
  if (a.backdrop !== b.backdrop) out.push(`backdrop "${b.backdrop}"`);
  return out;
};

/** The stage point a kid would click to hit this target: where it is drawn on top, centre first. */
const spot = (vm: VirtualMachine, t: Target): { x: number; y: number } | undefined => {
  const renderer = vm.runtime.renderer;
  if (!renderer) return { x: t.x, y: t.y };
  const b = renderer.getBounds(t.drawableID);
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i <= 8; i++)
    for (let j = 0; j <= 8; j++)
      points.push({ x: b.left + ((b.right - b.left) * i) / 8, y: b.bottom + ((b.top - b.bottom) * j) / 8 });
  const mid = { x: (b.left + b.right) / 2, y: (b.top + b.bottom) / 2 };
  points.sort((p, q) => Math.hypot(p.x - mid.x, p.y - mid.y) - Math.hypot(q.x - mid.x, q.y - mid.y));
  return points.find((p) => {
    const c = toClient(vm, p.x, p.y);
    return renderer.pick(c.x, c.y) === t.drawableID;
  });
};

const toClient = (vm: VirtualMachine, x: number, y: number) => {
  const r = vm.runtime.renderer?.canvas.getBoundingClientRect() ?? { width: 480, height: 360 };
  return {
    x: ((x + 240) / 480) * r.width,
    y: ((180 - y) / 360) * r.height,
    canvasWidth: r.width,
    canvasHeight: r.height,
  };
};

const realSleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const testRun = async (vm: VirtualMachine, args: ToolArgs, sleep = realSleep) => {
  const seconds = Math.min(TEST_RUN_MAX_SECONDS, Math.max(1, Number(args.seconds) || 3));
  const raw = jsonArg(args, 'actions') ?? [];
  if (!Array.isArray(raw)) throw new Error('"actions" must be a list of strings, e.g. ["key:space", "wait:1"]');
  const actions = raw.map(parseAction);
  if (actions.reduce((sum, a) => sum + actionSeconds(a), 0) > MAX_ACTION_SECONDS) {
    throw new Error(`The actions take longer than ${MAX_ACTION_SECONDS} s; test one thing at a time.`);
  }

  const runtime = vm.runtime;
  const log: string[] = [];
  let started = Date.now();
  const at = () => `${((Date.now() - started) / 1000).toFixed(1)}s`;
  const note = (text: string) => log.push(`${at()} ${text}`);

  const onSay = (target: Target, type: string, text: unknown) => {
    if (!String(text ?? '').trim()) return;
    note(`${target.getName()}${target.isOriginal ? '' : ' (clone)'} ${type === 'think' ? 'thinks' : 'says'} "${text}"`);
  };
  const onStopAll = () => note('stop all: every script ended ("stoppe alles")');
  const startHats = runtime.startHats;
  const held = new Map<string, number>();
  const press = (key: string, isDown: boolean) => vm.postIOData('keyboard', { key, isDown });

  const before = sample(vm);
  let last = before;
  let lastSample = 0;
  let idle = false;
  const tick = async (ms: number) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      await sleep(Math.min(TICK_MS, end - Date.now()));
      // a held key repeats after 500 ms, like a real keyboard
      for (const [key, since] of held) if (Date.now() - since >= 500) press(key, true);
      if (Date.now() - lastSample >= SAMPLE_MS) {
        lastSample = Date.now();
        const now = sample(vm);
        const changed = changes(last, now);
        if (changed.length) note(changed.join('; '));
        last = now;
        if (!idle && runtime.threads.length === 0)
          note('no script is running (only waiting for keys, clicks or messages)');
        idle = runtime.threads.length === 0;
      }
    }
  };
  const click = async (x: number, y: number) => {
    const c = toClient(vm, x, y);
    vm.postIOData('mouse', { ...c, isDown: true });
    await tick(100);
    vm.postIOData('mouse', { ...c, isDown: false });
  };

  try {
    runtime.startHats = (opcode, fields, target) => {
      if (opcode === 'event_whenbroadcastreceived' && fields?.BROADCAST_OPTION)
        note(`broadcast "${fields.BROADCAST_OPTION}"`);
      return startHats.call(runtime, opcode, fields, target);
    };
    vm.greenFlag();
    // after the flag: greenFlag() itself stops everything first
    runtime.on('SAY', onSay);
    runtime.on('PROJECT_STOP_ALL', onStopAll);
    started = Date.now();
    lastSample = started;
    note('green flag');
    await tick(500);
    for (const action of actions) {
      if (action.kind === 'wait') {
        await tick(action.seconds * 1000);
      } else if (action.kind === 'key') {
        note(
          `kid presses ${action.key === ' ' ? 'space' : action.key}${action.seconds > 0.1 ? ` for ${action.seconds} s` : ''}`,
        );
        held.set(action.key, Date.now());
        press(action.key, true);
        await tick(action.seconds * 1000);
        held.delete(action.key);
        press(action.key, false);
      } else if (action.kind === 'clickAt') {
        note(`kid clicks the stage at ${action.x}, ${action.y}`);
        await click(action.x, action.y);
      } else {
        const shown = runtime.targets
          .filter((t) => !t.isStage && t.getName() === action.sprite && t.visible)
          .sort((a, b) => b.y - a.y || a.x - b.x);
        const target = shown[action.nth - 1];
        const point = target && spot(vm, target);
        if (!point) {
          note(
            `kid wants to click ${action.sprite}#${action.nth}, but there is no visible one to click (${shown.length} shown)`,
          );
          continue;
        }
        note(`kid clicks ${action.sprite}#${action.nth} at ${Math.round(point.x)}, ${Math.round(point.y)}`);
        await click(point.x, point.y);
      }
    }
    await tick(Math.max(0, started + seconds * 1000 - Date.now()));
  } finally {
    runtime.startHats = startHats;
    runtime.removeListener('SAY', onSay);
    runtime.removeListener('PROJECT_STOP_ALL', onStopAll);
    for (const [key] of held) press(key, false);
  }
  const ran = Math.round((Date.now() - started) / 100) / 10;
  const end = sample(vm);
  const changed = changes(last, end);
  if (changed.length) note(changed.join('; '));
  vm.stopAll();

  const states = (s: Sample) => [...s.looks].map(([name, l]) => spriteLine(name, l, s.clones.get(name)));
  return {
    ok: true,
    seconds: ran,
    before_flag: states(before),
    timeline: log.length > MAX_LOG ? [...log.slice(0, MAX_LOG), `… ${log.length - MAX_LOG} more`] : log,
    at_end: [...states(end), ...[...end.values].map(([name, v]) => `${name} = ${v}`)],
    note: 'The game was stopped after the run.',
  };
};
