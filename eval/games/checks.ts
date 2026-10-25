// The parts every game's checks share: the result types and helpers that find game parts by behaviour.
import type { Player, StageState, TargetState } from './player.ts';

export type CheckStatus = 'pass' | 'fail' | 'skip';

export interface CheckResult {
  id: string;
  title: string;
  status: CheckStatus;
  /** what the bot measured (English, for the report) */
  detail: string;
  /** what a kid trying the game would notice (German, goes to the simulated kid) */
  kid: string;
  /** a detail of the classic version, not the basic idea: reported, but a game is green without it */
  extra?: boolean;
}

export interface Shot {
  label: string;
  png: Buffer;
}

export interface CheckRun {
  checks: CheckResult[];
  shots: Shot[];
}

export interface Game {
  id: string;
  title: string;
  /** the game the simulated kid has in mind (German) */
  brief: string;
  check(player: Player, sb3: Buffer): Promise<CheckRun>;
}

export const result = (
  id: string,
  title: string,
  ok: boolean | undefined,
  detail: string,
  kid: [pass: string, fail: string],
  extra = false,
): CheckResult => ({
  id,
  title,
  status: ok === undefined ? 'skip' : ok ? 'pass' : 'fail',
  detail,
  kid: ok === undefined ? '' : ok ? kid[0] : kid[1],
  ...(extra ? { extra } : {}),
});

/** Checks that can't run yet because a part they need is missing. */
export const notYet = (checks: [id: string, title: string, extra?: boolean][], why: string): CheckResult[] =>
  checks.map(([id, title, extra]) => result(id, title, undefined, why, ['', ''], extra));

export const num = (v: string | number | undefined): number | undefined => {
  const n = Number(v);
  return v === undefined || v === '' || Number.isNaN(n) ? undefined : n;
};
/** A number variable whose name matches; one shown on the stage first (an unused leftover often matches too). */
export const findVar = (s: StageState, pattern: RegExp) => {
  const names = Object.keys(s.variables).filter((name) => pattern.test(name) && num(s.variables[name]) !== undefined);
  return names.find((name) => s.monitors.some((m) => m.name === name)) ?? names[0];
};

/** How much of the smaller of two drawn images the other covers (0..1). */
export const overlap = (a: TargetState, b: TargetState): number => {
  if (!a.bounds || !b.bounds) return 0;
  const w = Math.min(a.bounds.right, b.bounds.right) - Math.max(a.bounds.left, b.bounds.left);
  const h = Math.min(a.bounds.top, b.bounds.top) - Math.max(a.bounds.bottom, b.bounds.bottom);
  if (w <= 0 || h <= 0) return 0;
  const area = (t: TargetState) => (t.bounds ? (t.bounds.right - t.bounds.left) * (t.bounds.top - t.bounds.bottom) : 1);
  return (w * h) / Math.min(area(a), area(b));
};
export const onStage = (t: TargetState) =>
  !t.bounds || (t.bounds.left >= -245 && t.bounds.right <= 245 && t.bounds.bottom >= -185 && t.bounds.top <= 185);

/** Targets (clones count one by one) that moved down (or up) by at least `min` since they were first seen visible. */
export const movingIds = (samples: StageState[], dir: 'down' | 'up', min = 40): Map<string, string> => {
  const ids = new Map<string, string>();
  const start = new Map<string, number>();
  for (const s of samples) {
    for (const t of s.targets.filter((x) => x.visible)) {
      const first = start.get(t.id) ?? t.y;
      if ((dir === 'down' ? first - t.y : t.y - first) >= min) ids.set(t.id, t.name);
      start.set(t.id, dir === 'down' ? Math.max(first, t.y) : Math.min(first, t.y));
    }
  }
  return ids;
};
/** Sprite names (or clones of them) that fall by themselves. */
export const fallingNames = (samples: StageState[]): Set<string> => new Set(movingIds(samples, 'down').values());

/** Messages a game uses to say it's over or won (says, broadcasts, costume or backdrop names). */
export const LOST = /game ?over|verloren|verlier|erwischt|gefressen|ende\b|vorbei|aus\b|lost|boom|explo/i;
export const WON = /gewonnen|geschafft|super|toll|bravo|sieg|win|fertig/i;
export const signal = (pattern: RegExp, events: Awaited<ReturnType<Player['events']>>, s?: StageState) =>
  events.says.find((x) => pattern.test(x.text))?.text ??
  events.broadcasts.find((x) => pattern.test(x.name))?.name ??
  s?.targets.find((t) => t.visible && pattern.test(t.costume))?.costume ??
  s?.monitors.find((m) => pattern.test(m.value))?.value ??
  (s && pattern.test(s.backdrop) ? `backdrop ${s.backdrop}` : undefined);

/** Finds what the arrow keys (or else the mouse) move: holds → for 1.5 s and compares positions. */
export const findSteered = async (player: Player, skip: (t: TargetState) => boolean, seed = 1) => {
  const moved = async (policy: Parameters<Player['seconds']>[1]) => {
    await player.greenFlag(seed);
    await player.seconds(0.5);
    const before = await player.state();
    await player.seconds(1.5, policy);
    const after = await player.state();
    return before.targets
      .filter((t) => !t.clone && t.visible && !skip(t))
      .map((b) => ({ name: b.name, dx: (after.targets.find((t) => t.id === b.id)?.x ?? b.x) - b.x }))
      .sort((a, b) => Math.abs(b.dx) - Math.abs(a.dx))[0];
  };
  const keys = await moved({ kind: 'hold', keys: ['ArrowRight'] });
  if (keys && keys.dx >= 30) return { name: keys.name, control: 'arrow keys' as const };
  const mouse = await moved({ kind: 'hold', keys: [], mouse: [200, -150] });
  if (mouse && Math.abs(mouse.dx) >= 30) return { name: mouse.name, control: 'mouse' as const };
  return undefined;
};

/** Runs until nothing visible changes (looks, positions, lists) for half a second, at most `max` seconds. */
export const settle = async (player: Player, max = 10, min = 0.5): Promise<StageState> => {
  await player.seconds(min);
  let prev = '';
  let s = await player.state();
  for (let t = 0; t < max * 4; t++) {
    const sig = JSON.stringify([s.targets.filter((x) => x.visible).map((x) => [x.id, x.look, x.x, x.y]), s.lists]);
    if (sig === prev) return s;
    prev = sig;
    await player.seconds(0.25);
    s = await player.state();
  }
  return s;
};
