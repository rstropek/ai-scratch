// Three CoderDojo Linz classics (linz.coderdojo.net, Übungsanleitungen Scratch): Fang mich, Space Shooter and
// Minesweeper. The checks test the basic idea of each game; details of the original exercise are extras,
// because there are many ways to build the same game.
import {
  type CheckResult,
  findSteered,
  findVar,
  type Game,
  LOST,
  movingIds,
  notYet,
  num,
  overlap,
  result,
  type Shot,
  settle,
  signal,
  WON,
} from './checks.ts';
import type { PlayEvents, StageState, TargetState } from './player.ts';

const pos = (s: StageState, name: string) => s.targets.find((t) => !t.clone && t.name === name);
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
/** Events since `before` (both from player.events() of the same game). */
const since = (before: PlayEvents, after: PlayEvents): PlayEvents => ({
  says: after.says.slice(before.says.length),
  broadcasts: after.broadcasts.slice(before.broadcasts.length),
  stopAll: after.stopAll.slice(before.stopAll.length),
  maxClones: after.maxClones,
});

// --- Fang mich ---------------------------------------------------------------------------------------

/** How far a sprite swam over the samples, without jumps (being put back somewhere). */
const travelled = (samples: StageState[], name: string) => {
  let d = 0;
  for (let i = 1; i < samples.length; i++) {
    const a = pos(samples[i - 1] as StageState, name);
    const b = pos(samples[i] as StageState, name);
    if (a && b && a.visible && b.visible) {
      const step = dist(a, b);
      if (step < 80) d += step;
    }
  }
  return Math.round(d);
};

export const fangMich: Game = {
  id: 'fang-mich',
  title: 'Fang mich',
  brief: `Du willst ein „Fang mich“-Spiel bauen:
- Der Hintergrund ist ein Aquarium (unter Wasser).
- Du steuerst einen Fisch mit den Pfeiltasten: hoch, runter, links und rechts.
- Ein Hai schwimmt von selbst kreuz und quer durchs Aquarium und prallt am Rand ab.
- Wenn der Hai den Fisch erwischt, schnappt der Hai zu und sagt „Game Over!“. Der Fisch verschwindet und
  taucht nach ein paar Sekunden oben links wieder auf.
- Wenn man die grüne Flagge klickt, fängt alles von vorne an.`,

  async check(player, sb3) {
    const checks: CheckResult[] = [];
    const shots: Shot[] = [];
    await player.load(sb3);

    // the hunter: what swims the most by itself
    await player.greenFlag(1);
    // stuck = still in the last 4 s; a catch may pause the hunter for a moment („Game Over!“ for 2 s)
    const idle = await player.seconds(8, { kind: 'none' }, 3);
    shots.push({ label: 'Start', png: await player.screenshot() });
    const names = (idle[0]?.targets ?? []).filter((t) => !t.clone).map((t) => t.name);
    const swimmers = names
      .map((name) => ({ name, all: travelled(idle, name), late: travelled(idle.slice(-40), name) }))
      .sort((a, b) => b.all - a.all);
    const hunter = swimmers[0];
    const swims = hunter !== undefined && hunter.all >= 150 && hunter.late >= 40;
    checks.push(
      result(
        'swims',
        'Something swims around by itself',
        swims,
        hunter ? `${hunter.name}: ${hunter.all} px in 8 s, ${hunter.late} px in the last 4 s` : 'no sprites',
        [
          'Wenn ich die grüne Flagge klicke, schwimmt der Hai von selbst herum.',
          hunter && hunter.all >= 150
            ? 'Der Hai schwimmt am Anfang, aber dann bleibt er hängen.'
            : 'Wenn ich die grüne Flagge klicke, bewegt sich der Hai nicht.',
        ],
      ),
    );

    // the player: moves with the arrow keys in all four directions (or follows the mouse)
    const tryKeys = async (name: string) => {
      await player.greenFlag(2);
      await player.seconds(0.3);
      const p0 = pos(await player.state(), name);
      if (!p0?.visible) return undefined;
      const h = p0.x < 0 ? ['ArrowRight', 'ArrowLeft'] : ['ArrowLeft', 'ArrowRight'];
      const v = p0.y > 0 ? ['ArrowDown', 'ArrowUp'] : ['ArrowUp', 'ArrowDown'];
      const moved: Record<string, number> = {};
      for (const key of [h[0], v[0], h[1], v[1]] as string[]) {
        const a = pos(await player.state(), name) ?? p0;
        await player.seconds(0.7, { kind: 'hold', keys: [key] });
        const b = pos(await player.state(), name) ?? a;
        const d = { ArrowRight: b.x - a.x, ArrowLeft: a.x - b.x, ArrowUp: b.y - a.y, ArrowDown: a.y - b.y }[key] ?? 0;
        moved[key] = Math.round(d);
      }
      return moved;
    };
    const others = names.filter((n) => !swims || n !== hunter?.name);
    let me: string | undefined;
    let control = '';
    let best: Record<string, number> | undefined;
    for (const name of others.slice(0, 3)) {
      const moved = await tryKeys(name);
      const ok = moved ? Object.values(moved).filter((d) => d >= 20).length : 0;
      const bestOk = best ? Object.values(best).filter((d) => d >= 20).length : 0;
      if (moved && ok > bestOk) {
        me = name;
        best = moved;
      }
    }
    const allFour = best !== undefined && Object.values(best).every((d) => d >= 20);
    if (allFour) control = 'arrow keys';
    else {
      // a variation: the fish follows the mouse
      for (const name of others.slice(0, 3)) {
        await player.greenFlag(2);
        await player.seconds(0.3);
        const a = pos(await player.state(), name);
        if (!a?.visible) continue;
        const goal: [number, number] = [a.x < 0 ? 180 : -180, a.y < 0 ? 130 : -130];
        await player.seconds(1.5, { kind: 'hold', keys: [], mouse: goal });
        const b = pos(await player.state(), name) ?? a;
        if (dist(a, { x: goal[0], y: goal[1] }) - dist(b, { x: goal[0], y: goal[1] }) >= 60) {
          me = name;
          control = 'mouse';
          break;
        }
      }
    }
    const steerable = control !== '';
    checks.push(
      result(
        'steer',
        'The player moves with the arrow keys',
        steerable,
        steerable
          ? `${me} moves with the ${control}${best && control === 'arrow keys' ? ` (${JSON.stringify(best)})` : ''}`
          : me && best
            ? `${me} with the arrow keys: ${JSON.stringify(best)} (needs 20 px in every direction)`
            : 'nothing moved with the arrow keys or the mouse',
        [
          'Der Fisch schwimmt mit den Pfeiltasten in alle Richtungen.',
          me && best
            ? 'Der Fisch bewegt sich nicht in alle Richtungen mit den Pfeiltasten.'
            : 'Mit den Pfeiltasten bewegt sich nichts.',
        ],
      ),
    );
    if (!swims || !steerable || !hunter || !me) {
      checks.push(
        ...notYet(
          [
            ['caught', 'Getting caught does something'],
            ['comeback', 'The caught player comes back', true],
            ['restart', 'The green flag restarts the game'],
          ],
          'needs something swimming by itself and a steerable player',
        ),
      );
      return { checks, shots };
    }
    const fish = me;

    // caught: swim into the hunter; something must happen when they touch
    await player.greenFlag(4);
    await player.seconds(0.3);
    const chase: StageState[] = [];
    let contact: number | undefined;
    let reaction: { frame: number; what: string } | undefined;
    for (let i = 0; i < 15 && !reaction; i++) {
      const part = await player.seconds(1, { kind: 'seek', mover: fish, target: hunter.name }, 3);
      chase.push(...part);
      const events = await player.events();
      for (let j = Math.max(1, chase.length - part.length); j < chase.length && !reaction; j++) {
        const s = chase[j] as StageState;
        const prev = chase[j - 1] as StageState;
        const f = pos(s, fish);
        const h = pos(s, hunter.name);
        const pf = pos(prev, fish);
        if (contact === undefined && f && h && f.visible && h.visible && overlap(f, h) > 0) contact = s.frame;
        if (contact === undefined) continue;
        const from = contact - 3;
        const said = [...events.says, ...events.broadcasts.map((b) => ({ ...b, text: b.name }))].find(
          (e) => e.frame >= from && e.frame <= s.frame,
        );
        if (events.stopAll.some((x) => x >= from)) reaction = { frame: s.frame, what: 'everything stops' };
        else if (pf?.visible && f && !f.visible) reaction = { frame: s.frame, what: `${fish} hides` };
        else if (pf && f && dist(pf, f) > 80) reaction = { frame: s.frame, what: `${fish} is put back` };
        else if (said) reaction = { frame: s.frame, what: `"${said.text}"` };
      }
    }
    if (reaction) shots.push({ label: 'Erwischt', png: await player.screenshot() });
    const events = await player.events();
    const message = signal(LOST, events);
    checks.push(
      result(
        'caught',
        'Getting caught does something',
        reaction !== undefined,
        reaction
          ? `touched after ${((reaction.frame - (chase[0]?.frame ?? 0)) / 30).toFixed(1)} s: ${reaction.what}${message ? `; message: ${message}` : ''}`
          : contact === undefined
            ? `the bot never got ${fish} to touch ${hunter.name} in 15 s`
            : `${fish} touched ${hunter.name}, nothing happened`,
        [
          'Wenn der Hai den Fisch erwischt, ist Game Over.',
          contact === undefined
            ? 'Ich schaffe es nicht, dass der Hai den Fisch erwischt.'
            : 'Der Hai schwimmt durch den Fisch durch, aber nichts passiert.',
        ],
      ),
    );

    // comeback (the original: hidden for 5 s, then back at the top left)
    let back: boolean | undefined;
    if (reaction) {
      const after = [...chase.filter((s) => s.frame >= (reaction?.frame ?? 0))];
      after.push(...(await player.seconds(8, { kind: 'none' }, 3)));
      const stopped = events.stopAll.length > 0 || (after.at(-1)?.threads ?? 1) === 0;
      back = !stopped && after.some((s, i) => i > 10 && pos(s, fish)?.visible);
    }
    checks.push(
      result(
        'comeback',
        'The caught player comes back',
        back,
        reaction ? `visible again within 8 s: ${back}` : 'needs a reaction to getting caught',
        [
          'Nach dem Erwischen taucht der Fisch wieder auf.',
          'Nach dem Erwischen kommt der Fisch nicht wieder, das Spiel ist einfach aus.',
        ],
        true,
      ),
    );

    // restart: the green flag puts the player back and the hunter swims again
    await player.greenFlag(5);
    await player.seconds(0.3);
    const start = pos(await player.state(), fish);
    await player.seconds(1, { kind: 'hold', keys: [(start?.x ?? 0) < 0 ? 'ArrowRight' : 'ArrowLeft'], mouse: [0, 0] });
    const moved = pos(await player.state(), fish);
    await player.greenFlag(5);
    await player.seconds(0.3);
    const again = await player.seconds(1, { kind: 'none' }, 3);
    const p = pos(again[0] ?? (await player.state()), fish);
    const reset =
      !!p?.visible && !!start && !!moved && (dist(p, start) < 5 || dist(p, moved) >= 30 || dist(start, moved) < 30);
    const hunterAgain = travelled(again, hunter.name) >= 30;
    checks.push(
      result(
        'restart',
        'The green flag restarts the game',
        reset && hunterAgain,
        `${fish} after the flag: ${p ? `${p.x},${p.y}${p.visible ? '' : ' hidden'}` : '-'} (start ${start?.x},${start?.y}, was at ${moved?.x},${moved?.y}); ${hunter.name} swims: ${hunterAgain}`,
        [
          'Mit der grünen Flagge fängt das Spiel wieder von vorne an.',
          'Mit der grünen Flagge fängt das Spiel nicht richtig neu an.',
        ],
      ),
    );
    await player.release();
    return { checks, shots };
  },
};

// --- Space Shooter -----------------------------------------------------------------------------------

const HITS = /treffer|punkt|score|abgeschossen|zerst|getroffen/i;

/** Every time something starts to fall (a new clone, or a sprite put back to the top) and falls 40 px. */
const falls = (samples: StageState[]) => {
  const top = new Map<string, number>();
  const counted = new Set<string>();
  let n = 0;
  for (const s of samples) {
    for (const t of s.targets.filter((x) => x.visible)) {
      const key = t.id;
      const y0 = top.get(key);
      if (y0 === undefined || t.y > y0 + 100) {
        top.set(key, t.y);
        counted.delete(key);
      } else if (y0 - t.y >= 40 && !counted.has(key)) {
        counted.add(key);
        n++;
      } else if (t.y > y0) top.set(key, t.y);
    }
  }
  return n;
};

/** Median fall speed (px/s) and new meteors in the first 8 s and after 17 s of a game, until it stops. */
const pace = (
  samples: StageState[],
  t0: number,
  meteor: (t: TargetState) => boolean,
  stop = Number.POSITIVE_INFINITY,
) => {
  const speeds: { frame: number; v: number }[] = [];
  const spawned: number[] = [];
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1] as StageState;
    const b = samples[i] as StageState;
    if (b.frame >= stop) break;
    for (const t of a.targets.filter((x) => x.visible && meteor(x))) {
      const later = b.targets.find((x) => x.id === t.id);
      if (later?.visible && later.y < t.y)
        speeds.push({ frame: b.frame, v: ((t.y - later.y) * 30) / (b.frame - a.frame) });
    }
    for (const t of b.targets.filter((x) => x.visible && meteor(x)))
      if (!a.targets.some((x) => x.id === t.id && x.visible)) spawned.push(b.frame);
  }
  const median = (xs: number[]) => xs.sort((x, y) => x - y)[Math.floor(xs.length / 2)];
  return {
    early: median(speeds.filter((s) => s.frame - t0 < 8 * 30).map((s) => s.v)),
    late: median(speeds.filter((s) => s.frame - t0 > 17 * 30).map((s) => s.v)),
    spawnEarly: spawned.filter((f) => f - t0 < 8 * 30).length,
    spawnLate: spawned.filter((f) => f - t0 > 17 * 30).length,
  };
};

export const spaceShooter: Game = {
  id: 'space-shooter',
  title: 'Space Shooter',
  brief: `Du willst einen Space Shooter bauen:
- Der Hintergrund ist das Weltall.
- Unten ist dein Raumschiff. Du steuerst es mit den Pfeiltasten nach links und rechts.
- Von oben fallen immer wieder Meteoriten herunter, an zufälligen Stellen.
- Mit der Leertaste schießt du einen Laser nach oben.
- Trifft der Laser einen Meteoriten, verschwindet der Meteorit und du bekommst einen Punkt (eine Variable
  „Treffer“).
- Trifft ein Meteorit dein Raumschiff, ist das Spiel aus („Game Over“) und alles stoppt.
- Mit der Zeit kommen die Meteoriten immer schneller.
- Wenn man die grüne Flagge klickt, fängt alles von vorne an.`,

  async check(player, sb3) {
    const checks: CheckResult[] = [];
    const shots: Shot[] = [];
    await player.load(sb3);

    await player.greenFlag(1);
    const idle = await player.seconds(10, { kind: 'none' }, 3);
    const fallingNames = new Set(movingIds(idle, 'down').values());
    const count = falls(idle);
    checks.push(
      result(
        'falls',
        'Meteors keep falling from the top',
        count >= 2,
        `${count} falls in 10 s: ${[...fallingNames].join(', ') || 'nothing'}`,
        [
          'Von oben fallen immer wieder Meteoriten herunter.',
          count === 1 ? 'Es fällt nur ein einziger Meteorit herunter.' : 'Von oben fällt nichts herunter.',
        ],
      ),
    );

    const ship = await findSteered(player, (t) => fallingNames.has(t.name));
    checks.push(
      result(
        'steer',
        'The ship moves with the arrow keys',
        ship !== undefined,
        ship ? `${ship.name} moves with the ${ship.control}` : 'nothing moved with the arrow keys or the mouse',
        ['Das Raumschiff fährt mit den Pfeiltasten nach links und rechts.', 'Mit den Pfeiltasten bewegt sich nichts.'],
      ),
    );
    if (!ship) {
      checks.push(
        ...notYet(
          [
            ['shoot', 'The space key shoots upwards'],
            ['hit', 'A shot destroys a meteor'],
            ['points', 'Hits count'],
            ['faster', 'Meteors get faster over time', true],
            ['game-over', 'A meteor hitting the ship ends the game'],
            ['restart', 'The green flag restarts the game'],
          ],
          'needs a steerable ship',
        ),
      );
      return { checks, shots };
    }

    // shooting: something new flies up after the space key, and not without it (meteors not needed)
    await player.greenFlag(2);
    await player.seconds(0.5);
    const quiet = movingIds(await player.seconds(1.2, { kind: 'none' }, 3), 'up', 50);
    const fired = movingIds(await player.seconds(1.2, { kind: 'hold', keys: [' '] }, 3), 'up', 50);
    const shots_ = [...fired.keys()].filter((id) => !quiet.has(id)).map((id) => fired.get(id));
    const shoots = shots_.length > 0;
    checks.push(
      result(
        'shoot',
        'The space key shoots upwards',
        shoots,
        shoots ? `flies up: ${[...new Set(shots_)].join(', ')}` : 'nothing flies up after the space key',
        ['Mit der Leertaste schieße ich einen Laser nach oben.', 'Wenn ich die Leertaste drücke, passiert nichts.'],
      ),
    );
    if (count === 0) {
      checks.push(
        ...notYet(
          [
            ['hit', 'A shot destroys a meteor'],
            ['points', 'Hits count'],
            ['faster', 'Meteors get faster over time', true],
            ['game-over', 'A meteor hitting the ship ends the game'],
            ['restart', 'The green flag restarts the game'],
          ],
          'needs something falling',
        ),
      );
      return { checks, shots };
    }

    // a whole game of shooting: meteors vanish in the air, hits count, maybe it gets faster
    await player.greenFlag(7);
    const s0 = (await player.seconds(0.3, { kind: 'none' }, 9))[0] ?? (await player.state());
    const shipY = pos(s0, ship.name)?.y ?? -140;
    const pointsVar = findVar(s0, HITS);
    const play = await player.seconds(3, { kind: 'shoot', catcher: ship.name }, 3);
    shots.push({ label: 'Schießen', png: await player.screenshot() });
    play.push(...(await player.seconds(22, { kind: 'shoot', catcher: ship.name }, 3)));
    const playEvents = await player.events();
    const stop = playEvents.stopAll[0] ?? Number.POSITIVE_INFINITY;
    const meteor = (t: TargetState) => fallingNames.has(t.name);
    let destroyed = 0;
    for (let i = 1; i < play.length; i++) {
      const a = play[i - 1] as StageState;
      const b = play[i] as StageState;
      if (b.frame >= stop) break;
      for (const t of a.targets.filter((x) => x.visible && meteor(x))) {
        const later = b.targets.find((x) => x.id === t.id);
        if (!later?.visible && t.y > shipY + 60) destroyed++;
      }
    }
    checks.push(
      result(
        'hit',
        'A shot destroys a meteor',
        shoots ? destroyed > 0 : undefined,
        shoots ? `meteors gone in the air: ${destroyed} in 25 s of shooting` : 'needs shooting',
        [
          'Wenn mein Laser einen Meteoriten trifft, verschwindet er.',
          'Mein Laser fliegt durch die Meteoriten durch, sie verschwinden nicht.',
        ],
      ),
    );
    const last = play.at(-1) ?? s0;
    const gained = pointsVar ? (num(last.variables[pointsVar]) ?? 0) - (num(s0.variables[pointsVar]) ?? 0) : 0;
    checks.push(
      result(
        'points',
        'Hits count',
        destroyed === 0
          ? undefined
          : pointsVar !== undefined && gained >= Math.min(2, destroyed) && gained <= 3 * destroyed + 3,
        pointsVar ? `${pointsVar}: +${gained} for ${destroyed} meteors destroyed` : 'no number variable for the hits',
        [
          'Für jeden Treffer bekomme ich einen Punkt.',
          !pointsVar
            ? 'Es gibt keine Treffer-Anzeige.'
            : gained > 3 * destroyed + 3
              ? 'Die Treffer zählen viel zu schnell hoch.'
              : 'Ich treffe Meteoriten, aber die Treffer zählen nicht.',
        ],
      ),
    );
    // faster: if the ship was hit before 17 s, a second game of only dodging
    let speed = pace(play, s0.frame, meteor, stop);
    if (speed.late === undefined) {
      await player.greenFlag(8);
      const t0 = (await player.state()).frame;
      const dodge = await player.seconds(25, { kind: 'avoid', catcher: ship.name }, 3);
      speed = pace(dodge, t0, meteor, (await player.events()).stopAll[0]);
    }
    const { early, late, spawnEarly, spawnLate } = speed;
    const known = early !== undefined && late !== undefined;
    checks.push(
      result(
        'faster',
        'Meteors get faster over time',
        known ? late >= 1.25 * early || spawnLate >= 1.5 * spawnEarly + 1 : undefined,
        known
          ? `fall speed ${Math.round(early)} → ${Math.round(late)} px/s; new meteors ${spawnEarly} → ${spawnLate} (first 8 s vs. after 17 s)`
          : 'the game ended before 17 s, also when dodging',
        ['Mit der Zeit werden die Meteoriten schneller.', 'Die Meteoriten werden mit der Zeit nicht schneller.'],
        true,
      ),
    );

    // game over: steer under the next meteor without shooting
    await player.greenFlag(7);
    const crash = await player.seconds(40, { kind: 'catch', catcher: ship.name }, 3);
    const end = crash.at(-1) ?? (await player.state());
    shots.push({ label: 'Getroffen', png: await player.screenshot() });
    const crashEvents = await player.events();
    const touched = crash.some((s) => {
      const me = pos(s, ship.name);
      return !!me && s.targets.some((t) => t.visible && meteor(t) && overlap(me, t) > 0);
    });
    const message = signal(LOST, crashEvents, end);
    const stillFalling = falls(crash.slice(-15)) > 0;
    const over = crashEvents.stopAll.length > 0 || end.threads === 0 || (message !== undefined && !stillFalling);
    checks.push(
      result(
        'game-over',
        'A meteor hitting the ship ends the game',
        over,
        `meteor touched the ship: ${touched}; stop all: ${crashEvents.stopAll.length ? 'yes' : 'no'}, scripts running: ${end.threads}, message: ${message ?? '-'}, still falling: ${stillFalling}`,
        [
          'Wenn ein Meteorit mein Raumschiff trifft, ist das Spiel aus.',
          'Wenn ein Meteorit mein Raumschiff trifft, passiert nichts, das Spiel geht einfach weiter.',
        ],
      ),
    );

    // restart
    await player.greenFlag(3);
    const again = await player.seconds(1, { kind: 'none' }, 30);
    const a = again[0] ?? (await player.state());
    const me = pos(a, ship.name);
    const resetPoints = pointsVar === undefined || num(a.variables[pointsVar]) === 0;
    const fallsAgain = falls(await player.seconds(4, { kind: 'none' }, 3)) > 0;
    const shipBack = !!me?.visible && me.look === pos(s0, ship.name)?.look;
    checks.push(
      result(
        'restart',
        'The green flag restarts the game',
        resetPoints && fallsAgain && shipBack,
        `after the flag: ${pointsVar ?? 'points'}=${pointsVar ? a.variables[pointsVar] : '-'}, ship visible as at the start: ${shipBack}, meteors fall: ${fallsAgain}`,
        [
          'Mit der grünen Flagge fängt das Spiel wieder von vorne an.',
          'Mit der grünen Flagge fängt das Spiel nicht richtig neu an.',
        ],
      ),
    );
    await player.release();
    return { checks, shots };
  },
};

// --- Minesweeper -------------------------------------------------------------------------------------

type Value = number | 'bomb' | 'flag' | 'unknown';
/** What a revealed cell shows, read from its costume name (the bot can't read the drawing). */
const cellValue = (costume: string): Value => {
  const c = costume.trim();
  if (/bomb|mine|💣/i.test(c)) return 'bomb';
  if (/flag|fahne/i.test(c)) return 'flag';
  if (/^(leer|empty|frei|null|offen|blank|nichts|aufgedeckt)/i.test(c)) return 0;
  const digit = c.match(/^\D*([0-8])\D*$/);
  if (digit && !/kost|costume|sprite|figur/i.test(c)) return Number(digit[1]);
  return 'unknown';
};

/** A number in the cell's speech bubble wins: some games show the count there („sage (Anzahl)“). */
const shownValue = (t: TargetState): Value => {
  const said = t.saying.trim();
  return /^[0-8]$/.test(said) ? Number(said) : cellValue(t.costume);
};

interface Cell {
  key: string;
  col: number;
  row: number;
  id: string;
}
/** The visible clickable targets on a regular grid, by column and row. */
const gridOf = (s: StageState) => {
  const targets = s.targets.filter((t) => t.visible && t.clickable);
  const axis = (vals: number[]) => {
    const sorted = [...new Set(vals)].sort((a, b) => a - b);
    const lines: number[] = [];
    for (const v of sorted) if (lines.length === 0 || v - (lines.at(-1) as number) > 3) lines.push(v);
    return (v: number) => lines.findIndex((l) => Math.abs(l - v) <= 3);
  };
  const col = axis(targets.map((t) => t.x));
  const row = axis(targets.map((t) => -t.y));
  const cells: Cell[] = targets
    .map((t) => ({ key: `${col(t.x)},${row(-t.y)}`, col: col(t.x), row: row(-t.y), id: t.id }))
    .sort((a, b) => a.row - b.row || a.col - b.col);
  const cols = new Set(cells.map((c) => c.col)).size;
  const rows = new Set(cells.map((c) => c.row)).size;
  const looks = new Map<string, number>();
  for (const t of targets) looks.set(t.look, (looks.get(t.look) ?? 0) + 1);
  const back = [...looks.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
  return { cells, cols, rows, back, targets };
};

export const minesweeper: Game = {
  id: 'minesweeper',
  title: 'Minesweeper',
  brief: `Du willst Minesweeper bauen:
- Ein Spielfeld aus 8 mal 8 Kästchen, am Anfang sind alle verdeckt. Darunter sind 10 Bomben versteckt, jedes
  Spiel an anderen Stellen.
- Klickst du ein Kästchen an, wird es aufgedeckt. Ist da eine Bombe, hast du verloren („Verloren“).
- Sonst zeigt das Kästchen, wie viele Bomben rundherum liegen (eine Zahl von 1 bis 8), oder es ist leer, wenn
  rundherum keine Bombe liegt.
- Ist ein Kästchen leer, gehen die Kästchen rundherum von selbst auf.
- Hältst du die Leertaste gedrückt und klickst ein Kästchen an, setzt du eine Fahne (da vermutest du eine
  Bombe). Nochmal so klicken nimmt die Fahne wieder weg.
- Sind alle Kästchen ohne Bombe aufgedeckt, hast du gewonnen („Gewonnen“).
- Wenn man die grüne Flagge klickt, fängt ein neues Spiel an.`,

  async check(player, sb3) {
    const checks: CheckResult[] = [];
    const shots: Shot[] = [];
    await player.load(sb3);
    const fresh = async (seed: number) => {
      await player.greenFlag(seed);
      const s = await settle(player, 30, 1);
      return { s, ...gridOf(s) };
    };
    const target = (s: StageState, id: string) => s.targets.find((t) => t.id === id);
    const clickCell = async (s: StageState, id: string) => {
      const b = target(s, id)?.bounds;
      if (b) await player.click((b.left + b.right) / 2, (b.top + b.bottom) / 2);
    };

    const first = await fresh(1);
    shots.push({ label: 'Start', png: await player.screenshot() });
    const { cells, cols, rows, back } = first;
    const overlapping = first.targets.filter((a, i) => first.targets.slice(i + 1).some((b) => overlap(a, b) > 0.1));
    const covered = first.targets.every((t) => t.look === back);
    const gridOk =
      cells.length >= 16 &&
      cols * rows === cells.length &&
      overlapping.length === 0 &&
      first.targets.every(onStageCell);
    checks.push(
      result(
        'grid',
        'A grid of covered cells',
        gridOk && covered,
        `${cells.length} clickable cells, ${cols} × ${rows}` +
          (overlapping.length ? `; overlapping: ${overlapping.length}` : '') +
          (covered ? '' : '; not all cells look the same at the start'),
        [
          'Ich sehe ein Spielfeld mit verdeckten Kästchen.',
          cells.length < 16
            ? 'Ich sehe kein Spielfeld mit Kästchen.'
            : !covered
              ? 'Am Anfang sind nicht alle Kästchen verdeckt.'
              : 'Die Kästchen liegen nicht ordentlich in Reihen nebeneinander.',
        ],
      ),
    );
    if (cells.length < 4) {
      checks.push(
        ...notYet(
          [
            ['reveal', 'A click reveals a cell'],
            ['numbers', 'The numbers count the bombs around'],
            ['lose', 'A bomb ends the game'],
            ['cascade', 'An empty cell opens its neighbours', true],
            ['flag', 'Space + click sets and removes a flag', true],
            ['win', 'Opening all safe cells wins'],
            ['restart', 'The green flag starts a new game'],
            ['new-board', 'Every game has a new board', true],
          ],
          'needs a grid of clickable cells',
        ),
      );
      return { checks, shots };
    }

    // learn the board: click every cell; after a bomb ends the game, start the same game again (same seed)
    const board = new Map<string, Value>();
    let conflicts = 0;
    let firstClick: { from: string; to: string } | undefined;
    let bomb: { signal?: string } | undefined;
    let zero: { opened: number } | undefined;
    let lostShot = false;
    // a cell is open when it looks different, or when it hid to show what lies beneath (unreadable)
    const gone = (t: TargetState) => !t.visible || t.ghost >= 90;
    const isOpen = (g: Awaited<ReturnType<typeof fresh>>, t: TargetState | undefined): t is TargetState =>
      !!t && (gone(t) || t.look !== g.back);
    const record = (g: Awaited<ReturnType<typeof fresh>>, s: StageState) => {
      let opened = 0;
      for (const c of g.cells) {
        const t = target(s, c.id);
        if (!isOpen(g, t)) continue;
        opened++;
        const v = gone(t) ? 'unknown' : shownValue(t);
        const had = board.get(c.key);
        if (had === undefined) board.set(c.key, v);
        else if (had !== v && had !== 'bomb') conflicts++;
      }
      return opened;
    };
    let g = first;
    for (let game = 0; game < 30; game++) {
      let lost = false;
      let dead = 0;
      for (const c of g.cells) {
        if (board.has(c.key)) continue;
        const s0 = await player.state();
        if (!target(s0, c.id)) break; // the cells are gone (the game stopped)
        if (isOpen(g, target(s0, c.id))) {
          record(g, s0);
          continue;
        }
        const e0 = await player.events();
        const opened0 = record(g, s0);
        await clickCell(s0, c.id);
        let s = await settle(player, 10);
        let t = target(s, c.id);
        if (!isOpen(g, t) || gone(t) || cellValue(t.costume) === 'bomb' || shownValue(t) === 'unknown') {
          await player.seconds(2.5); // a game over may come a moment later
          s = await player.state();
          t = target(s, c.id) ?? t;
        }
        const changed = isOpen(g, t);
        firstClick ??= { from: target(s0, c.id)?.costume ?? '', to: !t ? 'gone' : gone(t) ? 'hidden' : t.costume };
        const opened = record(g, s) - opened0;
        const v = t && changed && !gone(t) ? shownValue(t) : undefined;
        if (v === 0) zero ??= { opened };
        const e = since(e0, await player.events());
        const lostSignal =
          e.stopAll.length > 0
            ? 'stop all'
            : signal(LOST, e, { ...s, targets: s.targets.filter((x) => !g.cells.some((y) => y.id === x.id)) });
        if (lostSignal || v === 'bomb') {
          // the clicked cell that lost is a bomb, whatever it showed: some games open it like a safe cell
          // („offen“ plus „Verloren!“), and record() already took that for a number
          if (lostSignal || !board.has(c.key) || board.get(c.key) === 'unknown') board.set(c.key, 'bomb');
          bomb ??= { ...(lostSignal ? { signal: lostSignal } : {}) };
          if (!lostShot && lostSignal) {
            shots.push({ label: 'Bombe erwischt', png: await player.screenshot() });
            lostShot = true;
          }
        }
        if (lostSignal) {
          lost = true;
          break;
        }
        dead = changed ? 0 : dead + 1;
        if (dead >= 3) {
          lost = true; // clicks do nothing any more: the game may be over without saying so
          break;
        }
      }
      if (!lost) break;
      g = await fresh(1);
    }

    checks.push(
      result(
        'reveal',
        'A click reveals a cell',
        firstClick ? firstClick.from !== firstClick.to : false,
        firstClick ? `first click: ${firstClick.from} -> ${firstClick.to}` : 'no click',
        ['Wenn ich ein Kästchen anklicke, geht es auf.', 'Wenn ich ein Kästchen anklicke, passiert nichts.'],
      ),
    );

    const unreadable = [...new Set([...board.values()].filter((v) => v === 'unknown'))].length;
    const costumeNames = [...new Set(first.targets.map((t) => t.costume))];
    const bombs = [...board.entries()].filter(([, v]) => v === 'bomb').map(([k]) => k);
    const at = (key: string) => key.split(',').map(Number) as [number, number];
    const around = (key: string) => {
      const [c, r] = at(key);
      return bombs.filter((b) => {
        const [bc, br] = at(b);
        return Math.max(Math.abs(bc - c), Math.abs(br - r)) === 1;
      }).length;
    };
    const numbered = [...board.entries()].filter((e): e is [string, number] => typeof e[1] === 'number');
    const wrong = numbered.filter(([k, v]) => around(k) !== v);
    const complete = board.size === cells.length && unreadable === 0;
    // cells next to a known bomb show 0 or nothing: no numbers yet (an unseen bomb can't explain that)
    const noNumbers = !numbered.some(([, v]) => v > 0) && numbered.some(([k]) => around(k) > 0);
    checks.push(
      result(
        'numbers',
        'The numbers count the bombs around',
        unreadable > 0 || conflicts > 0
          ? undefined
          : noNumbers
            ? false
            : // a cell never opened may be a bomb, and then the counts can't be judged
              complete
              ? bombs.length > 0 && numbered.some(([, v]) => v > 0) && wrong.length === 0
              : undefined,
        unreadable > 0
          ? `can't tell the numbers from the costume names (${costumeNames.join(', ')} …); look at the screenshots`
          : conflicts > 0
            ? `the board changed between two games with the same start (${conflicts} cells), e.g. bombs placed on the first click`
            : `${board.size}/${cells.length} cells seen${complete ? '' : ' (not all, so the counts are not judged)'}, ${bombs.length} bombs, ${numbered.length} numbers` +
              (wrong.length
                ? `; wrong: ${wrong
                    .slice(0, 5)
                    .map(([k, v]) => `(${k}) shows ${v}, has ${around(k)}`)
                    .join(', ')}`
                : ''),
        [
          'Die Zahlen stimmen: sie zeigen, wie viele Bomben rundherum liegen.',
          bombs.length === 0
            ? 'Ich finde keine Bomben.'
            : noNumbers
              ? 'Die aufgedeckten Kästchen zeigen keine Zahlen.'
              : 'Die Zahlen stimmen nicht mit den Bomben rundherum überein.',
        ],
      ),
    );
    checks.push(
      result(
        'lose',
        'A bomb ends the game',
        bomb ? bomb.signal !== undefined : undefined,
        bomb ? `after a bomb: ${bomb.signal ?? 'nothing ends the game'}` : 'never clicked a bomb',
        [
          'Wenn ich auf eine Bombe klicke, habe ich verloren.',
          'Wenn ich auf eine Bombe klicke, geht das Spiel einfach weiter.',
        ],
      ),
    );
    checks.push(
      result(
        'cascade',
        'An empty cell opens its neighbours',
        zero ? zero.opened >= 3 : undefined,
        zero ? `a click on an empty cell opened ${zero.opened} cells` : 'never clicked an empty cell',
        [
          'Wenn ich ein leeres Kästchen anklicke, gehen die Kästchen rundherum von selbst auf.',
          'Wenn ich ein leeres Kästchen anklicke, geht nur dieses eine auf.',
        ],
        true,
      ),
    );

    // flags, then a won game: open every safe cell, then flag every bomb
    g = await fresh(1);
    const safe = g.cells.filter((c) => typeof board.get(c.key) === 'number');
    const spaceClick = async (id: string) => {
      const s = await player.state();
      await player.pressKeys([' ']);
      await clickCell(s, id);
      return settle(player, 5);
    };
    let flag: { set: boolean; removed: boolean } | undefined;
    const probe = safe.find((c) => (board.get(c.key) as number) > 0) ?? safe[0];
    if (probe) {
      // a flag is the cell's own costume or a flag sprite (clone) put on top of the cell
      const onTop = (s: StageState) => {
        const cell = target(s, probe.id);
        return s.targets.find(
          (t) =>
            cell &&
            t.visible &&
            t.ghost < 90 &&
            !g.cells.some((c) => c.id === t.id) &&
            Math.abs(t.x - cell.x) < 15 &&
            Math.abs(t.y - cell.y) < 15,
        );
      };
      const before = onTop(await player.state());
      const s1 = await spaceClick(probe.id);
      const set = target(s1, probe.id);
      const overlay = before ? undefined : onTop(s1);
      const flagged =
        !!set &&
        ((set.look !== g.back && cellValue(set.costume) !== board.get(probe.key)) ||
          (set.look === g.back && !!overlay));
      // the kid clicks the flag itself to take it away, not a see-through part of it
      const at = overlay && (await player.spot(overlay.id));
      let s2: StageState;
      if (at) {
        await player.pressKeys([' ']);
        await player.click(at.x, at.y);
        s2 = await settle(player, 5);
      } else s2 = await spaceClick(probe.id);
      const removed = target(s2, probe.id)?.look === g.back && !(overlay && onTop(s2));
      flag = { set: flagged, removed };
    }
    checks.push(
      result(
        'flag',
        'Space + click sets and removes a flag',
        flag ? flag.set && flag.removed : undefined,
        flag ? `flag set: ${flag.set}, removed again: ${flag.removed}` : 'no safe cell known',
        [
          'Mit Leertaste und Klick kann ich eine Fahne setzen und wieder wegnehmen.',
          flag?.set
            ? 'Die Fahne geht nicht mehr weg, wenn ich nochmal mit Leertaste klicke.'
            : 'Mit Leertaste und Klick kommt keine Fahne, das Kästchen geht einfach auf.',
        ],
        true,
      ),
    );

    const e0 = await player.events();
    let won: string | undefined;
    let how = '';
    let lostOnTheWay = false;
    for (const c of safe) {
      const s = await player.state();
      if (!target(s, c.id)) break;
      if (target(s, c.id)?.look !== g.back) continue;
      await clickCell(s, c.id);
      await settle(player, 10);
    }
    let s = await settle(player, 5, 2);
    const nonCells = (x: StageState) => ({
      ...x,
      targets: x.targets.filter((t) => !g.cells.some((c) => c.id === t.id)),
    });
    won = signal(WON, since(e0, await player.events()), nonCells(s));
    if (won) how = 'all safe cells open';
    else if (bombs.length > 0 && bombs.length < cells.length) {
      for (const key of bombs) {
        const c = g.cells.find((x) => x.key === key);
        if (c && target(await player.state(), c.id)) await spaceClick(c.id);
      }
      s = await settle(player, 5, 2);
      won = signal(WON, since(e0, await player.events()), nonCells(s));
      if (won) how = 'all safe cells open and all bombs flagged';
    }
    lostOnTheWay = signal(LOST, since(e0, await player.events())) !== undefined;
    if (won) shots.push({ label: 'Gewonnen', png: await player.screenshot() });
    checks.push(
      result(
        'win',
        'Opening all safe cells wins',
        complete && conflicts === 0 ? won !== undefined : undefined,
        !complete || conflicts > 0
          ? 'needs the whole board'
          : won
            ? `${how}: ${won}`
            : `all safe cells open and all bombs flagged, no win message${lostOnTheWay ? ' (it said lost)' : ''}`,
        [
          'Wenn alle Kästchen ohne Bombe offen sind, steht da „Gewonnen“.',
          'Wenn alle Kästchen ohne Bombe offen sind, passiert nichts.',
        ],
      ),
    );

    // a new game: everything covered again, and (an extra) a different board
    const next = await fresh(2);
    const allCovered = next.cells.length === cells.length && next.targets.every((t) => t.look === back);
    // compare every cell the clicks open (an auto-reveal opens many) with the first game's board
    let differs = false;
    const compared = new Set<string>();
    for (let clicks = 0, i = 0; clicks < 8 && !differs && i < next.cells.length; i++) {
      const c = next.cells[i] as Cell;
      const s0 = await player.state();
      if (!target(s0, c.id)) break;
      if (target(s0, c.id)?.look !== next.back) continue;
      await clickCell(s0, c.id);
      clicks++;
      const s = await settle(player, 10);
      for (const x of next.cells) {
        const t = target(s, x.id);
        if (!t || t.look === next.back) continue;
        compared.add(x.key);
        if (board.has(x.key) && board.get(x.key) !== shownValue(t)) differs = true;
      }
      if (cellValue(target(s, c.id)?.costume ?? '') === 'bomb') break;
    }
    checks.push(
      result(
        'restart',
        'The green flag starts a new game',
        allCovered,
        `${next.cells.length} cells after the flag, all covered: ${allCovered}`,
        [
          'Mit der grünen Flagge fängt ein neues Spiel an.',
          'Mit der grünen Flagge sind nicht wieder alle Kästchen verdeckt.',
        ],
      ),
    );
    checks.push(
      result(
        'new-board',
        'Every game has a new board',
        // a few cells that look alike prove nothing (most cells show 0)
        complete && (differs || compared.size >= 6) ? differs : undefined,
        compared.size > 0
          ? `${compared.size} cells compared with the first game: ${differs ? 'different' : 'all the same'}`
          : 'nothing to compare',
        ['Jedes Spiel sind die Bomben woanders.', 'Die Bomben liegen jedes Spiel an denselben Stellen.'],
        true,
      ),
    );
    await player.release();
    return { checks, shots };
  },
};

const onStageCell = (t: TargetState) =>
  !t.bounds || (t.bounds.left >= -242 && t.bounds.right <= 242 && t.bounds.bottom >= -182 && t.bounds.top <= 182);

/** The simpler version for the tutorial (Rainer, 2026-10-25): small board, no flags, no cascade. */
export const minesweeperMini: Game = {
  id: 'minesweeper-mini',
  title: 'Minesweeper (klein)',
  brief: `Du willst ein kleines Minesweeper bauen:
- Ein Spielfeld aus 5 mal 5 Kästchen, am Anfang sind alle verdeckt. Darunter sind 4 Bomben versteckt, jedes
  Spiel an anderen Stellen.
- Klickst du ein Kästchen an, wird es aufgedeckt. Ist da eine Bombe, hast du verloren („Verloren“).
- Sonst zeigt das Kästchen, wie viele Bomben rundherum liegen (eine Zahl von 0 bis 8).
- Sind alle Kästchen ohne Bombe aufgedeckt, hast du gewonnen („Gewonnen“).
- Wenn man die grüne Flagge klickt, fängt ein neues Spiel an.`,
  async check(player, sb3) {
    const run = await minesweeper.check(player, sb3);
    return { ...run, checks: run.checks.filter((c) => c.id !== 'cascade' && c.id !== 'flag') };
  },
};
