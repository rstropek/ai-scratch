// The games the harness builds: the kid's brief and the checks that play the result with a bot.
// Checks find the parts of the game by behaviour (what falls, what the arrow keys move, which variable
// counts), not by the names the brief suggests, because the model and the kid may name things differently.
import {
  type CheckResult,
  fallingNames,
  findVar,
  type Game,
  num,
  onStage,
  overlap,
  result,
  type Shot,
} from './checks.ts';
import { fangMich, minesweeper, minesweeperMini, spaceShooter } from './coderdojo.ts';
import type { Player, StageState, TargetState } from './player.ts';

export type { CheckResult, CheckRun, CheckStatus, Game, Shot } from './checks.ts';

// --- Fangspiel ---------------------------------------------------------------------------------------

const POINTS = /punkt|score|treffer|gefangen|fang/i;
const LIVES = /leben|herz|lives|versuch/i;

export const fangspiel: Game = {
  id: 'fangspiel',
  title: 'Fangspiel',
  brief: `Du willst ein Fangspiel bauen:
- Unten auf der Bühne ist ein Korb. Du steuerst ihn mit den Pfeiltasten nach links und rechts.
- Von oben fallen Äpfel herunter, immer an einer zufälligen Stelle.
- Fängst du einen Apfel mit dem Korb, bekommst du einen Punkt (eine Variable „Punkte“).
- Fällt ein Apfel auf den Boden, verlierst du ein Leben (eine Variable „Leben“, am Anfang 3).
- Wenn du keine Leben mehr hast, ist das Spiel aus („Game Over“) und alles stoppt.
- Wenn man die grüne Flagge klickt, fängt alles von vorne an.`,

  async check(player, sb3) {
    const checks: CheckResult[] = [];
    const shots: Shot[] = [];
    await player.load(sb3);

    // what falls by itself
    await player.greenFlag(1);
    const idle = await player.seconds(4, { kind: 'none' }, 3);
    const falling = fallingNames(idle);
    checks.push(
      result(
        'falls',
        'Something falls from the top',
        falling.size > 0,
        `falling: ${[...falling].join(', ') || 'nothing'}`,
        [
          'Wenn ich die grüne Flagge klicke, fällt etwas von oben herunter.',
          'Wenn ich die grüne Flagge klicke, fällt nichts von oben herunter.',
        ],
      ),
    );

    // what the arrow keys (or the mouse) move
    const candidates = (s: StageState) => s.targets.filter((t) => !t.clone && t.visible && !falling.has(t.name));
    const moved = async (policy: Parameters<Player['seconds']>[1]) => {
      await player.greenFlag(1);
      await player.seconds(0.5);
      const before = await player.state();
      await player.seconds(1.5, policy);
      const after = await player.state();
      return candidates(before)
        .map((b) => ({ name: b.name, dx: (after.targets.find((t) => t.id === b.id)?.x ?? b.x) - b.x }))
        .sort((a, b) => b.dx - a.dx)[0];
    };
    let control = 'arrow keys';
    let catcher = await moved({ kind: 'hold', keys: ['ArrowRight'] });
    if (!catcher || catcher.dx < 30) {
      catcher = await moved({ kind: 'hold', keys: [], mouse: [200, -150] });
      control = 'mouse';
    }
    const steerable = catcher !== undefined && catcher.dx >= 30;
    checks.push(
      result(
        'steer',
        'The catcher moves with the arrow keys',
        steerable && control === 'arrow keys',
        steerable ? `${catcher?.name} moves with the ${control}` : 'nothing moved with the arrow keys or the mouse',
        [
          'Der Korb fährt mit den Pfeiltasten nach links und rechts.',
          steerable
            ? 'Der Korb bewegt sich nur mit der Maus, nicht mit den Pfeiltasten.'
            : 'Mit den Pfeiltasten bewegt sich nichts.',
        ],
      ),
    );
    if (!steerable || !catcher || falling.size === 0) {
      for (const [id, title] of [
        ['points', 'Catching scores points'],
        ['lives', 'Missing costs lives'],
        ['game-over', 'No lives left ends the game'],
        ['restart', 'The green flag restarts the game'],
      ])
        checks.push(
          result(id as string, title as string, undefined, 'needs a steerable catcher and something falling', ['', '']),
        );
      return { checks, shots };
    }
    const name = catcher.name;

    // catching: points go up
    await player.greenFlag(7);
    const start = (await player.seconds(0.5))[0] ?? (await player.state());
    await player.seconds(3, { kind: 'catch', catcher: name });
    shots.push({ label: 'Spielen: der Bot fängt', png: await player.screenshot() });
    const caught = await player.seconds(26.5, { kind: 'catch', catcher: name }, 30);
    const end = caught.at(-1) ?? (await player.state());
    const points = findVar(end, POINTS);
    const gained = points ? (num(end.variables[points]) ?? 0) - (num(start.variables[points]) ?? 0) : undefined;
    const pointsOk = points !== undefined && (gained ?? 0) >= 3;
    checks.push(
      result(
        'points',
        'Catching scores points',
        pointsOk,
        points
          ? `${points}: ${caught.map((s) => s.variables[points]).join(' ')} (30 s of catching)`
          : 'no number variable',
        [
          'Wenn ich Äpfel fange, bekomme ich Punkte.',
          points ? 'Ich fange Äpfel, aber die Punkte zählen nicht richtig.' : 'Es gibt keine Punkte-Anzeige.',
        ],
      ),
    );

    // missing: lives go down, the game ends, and it restarts
    await player.greenFlag(7);
    const avoidStart = await player.seconds(0.5).then(() => player.state());
    const avoided = await player.seconds(40, { kind: 'avoid', catcher: name }, 30);
    const last = avoided.at(-1) ?? (await player.state());
    shots.push({ label: 'Verpassen bis zum Ende', png: await player.screenshot() });
    const events = await player.events();
    const lives = findVar(last, LIVES);
    const lost = lives ? (num(avoidStart.variables[lives]) ?? 0) - (num(last.variables[lives]) ?? 0) : undefined;
    checks.push(
      result(
        'lives',
        'Missing costs lives',
        lives !== undefined && (lost ?? 0) > 0,
        lives ? `${lives}: ${avoided.map((s) => s.variables[lives]).join(' ')} (40 s of missing)` : 'no lives variable',
        [
          'Wenn ich einen Apfel verpasse, verliere ich ein Leben.',
          lives ? 'Wenn ich Äpfel verpasse, gehen keine Leben weg.' : 'Es gibt keine Leben-Anzeige.',
        ],
      ),
    );
    // over: everything stopped, or a game-over message, or nothing falls any more in the last 5 s
    const tail = avoided.slice(-5);
    const stillFalling = fallingNames(tail).size > 0;
    const message = [...events.says.map((s) => s.text), ...events.broadcasts.map((b) => b.name)].find((t) =>
      /game ?over|verloren|ende|vorbei|aus\b/i.test(t),
    );
    const over = events.stopAll.length > 0 || last.threads === 0 || (!stillFalling && message !== undefined);
    checks.push(
      result(
        'game-over',
        'No lives left ends the game',
        over,
        `stop all: ${events.stopAll.length ? 'yes' : 'no'}, scripts running: ${last.threads}, message: ${message ?? '-'}, still falling: ${stillFalling}`,
        ['Wenn alle Leben weg sind, ist das Spiel aus.', 'Auch ohne Leben geht das Spiel immer weiter.'],
      ),
    );

    await player.greenFlag(3);
    const again = await player.seconds(1).then(() => player.state());
    const resetPoints = points === undefined || num(again.variables[points]) === 0;
    const resetLives = lives === undefined || num(again.variables[lives]) === num(avoidStart.variables[lives]);
    checks.push(
      result(
        'restart',
        'The green flag restarts the game',
        resetPoints && resetLives && fallingNames(await player.seconds(3, { kind: 'none' }, 3)).size > 0,
        `after the flag: ${points ?? '-'}=${points ? again.variables[points] : '-'}, ${lives ?? '-'}=${lives ? again.variables[lives] : '-'}`,
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

// --- Memory ------------------------------------------------------------------------------------------

const MEMORY_POINTS = /punkt|score|paar|treffer|gefunden/i;

export const memory: Game = {
  id: 'memory',
  title: 'Memory',
  brief: `Du willst ein Memory-Spiel bauen:
- 6 Karten in 2 Reihen mit je 3 Karten, also 3 Paare. Als Bilder willst du Obst (zum Beispiel Apfel, Banane, Kirsche).
- Am Anfang sind alle Karten verdeckt, man sieht nur die Rückseite.
- Wenn man eine Karte anklickt, dreht sie sich um und man sieht das Bild.
- Sind zwei gleiche Karten offen, bleiben sie offen und man bekommt einen Punkt (eine Variable „Punkte“).
- Sind die zwei Karten verschieden, drehen sie sich nach kurzer Zeit wieder um.
- Wenn alle Paare gefunden sind, soll „Gewonnen!“ erscheinen.
- Wenn man die grüne Flagge klickt, fängt alles von vorne an.`,

  async check(player, sb3) {
    const checks: CheckResult[] = [];
    const shots: Shot[] = [];
    await player.load(sb3);
    // Clones get new ids on every green flag, so each game finds its cards again; within one game the ids
    // hold. The same seed shuffles the same way, but the checks don't rely on that.
    const fresh = async () => {
      await player.greenFlag(1);
      await player.seconds(2);
      const state = await player.state();
      const cards = state.targets.filter((t) => t.clickable && t.visible).sort((a, b) => b.y - a.y || a.x - b.x);
      return { state, cards, backs: new Map(cards.map((c) => [c.id, c.look])) };
    };
    const first = await fresh();
    const { cards } = first;
    shots.push({ label: 'Start', png: await player.screenshot() });
    const overlapping = cards.flatMap((a, i) =>
      cards
        .slice(i + 1)
        .filter((b) => overlap(a, b) > 0.1)
        .map((b) => `${a.name}/${b.name}`),
    );
    const outside = cards.filter((c) => !onStage(c)).map((c) => c.name);
    checks.push(
      result(
        'cards',
        '6 clickable cards, side by side on the stage',
        cards.length === 6 && overlapping.length === 0 && outside.length === 0,
        `${cards.length} clickable: ${cards.map((c) => `${c.name}@${c.x},${c.y}`).join(' ')}` +
          (overlapping.length ? `; overlapping: ${overlapping.join(' ')}` : '') +
          (outside.length ? `; off the stage: ${outside.join(' ')}` : ''),
        [
          'Ich sehe 6 Karten nebeneinander.',
          cards.length !== 6
            ? `Ich sehe ${cards.length} anklickbare Karten statt 6.`
            : overlapping.length
              ? 'Die Karten liegen übereinander.'
              : 'Manche Karten sind nicht ganz auf der Bühne.',
        ],
      ),
    );
    if (cards.length < 2) {
      for (const [id, title] of [
        ['flip', 'A click turns a card over'],
        ['pair', 'A matching pair stays open and scores'],
        ['mismatch', 'A wrong pair turns back'],
        ['same-card', 'Clicking one card twice is no pair'],
        ['win', 'All pairs found: the game says so'],
        ['restart', 'The green flag restarts the game'],
      ])
        checks.push(result(id as string, title as string, undefined, 'needs at least 2 cards', ['', '']));
      return { checks, shots };
    }

    type Round = Awaited<ReturnType<typeof fresh>>;
    const look = (s: StageState, id: string) => s.targets.find((t) => t.id === id);
    const revealed = (g: Round, s: StageState, id: string) => look(s, id)?.look !== g.backs.get(id);
    const face = (s: StageState, id: string) => ({
      look: look(s, id)?.look ?? '',
      costume: look(s, id)?.costume ?? '',
    });
    const sameFace = (a: { look: string; costume: string }, b: { look: string; costume: string }) =>
      a.look === b.look || (a.costume !== '' && a.costume === b.costume);
    const clickCard = async (c: TargetState) => {
      // where the card is now: cards may move while shuffling
      const now = look(await player.state(), c.id) ?? c;
      const b = now.bounds;
      await player.click(b ? (b.left + b.right) / 2 : now.x, b ? (b.top + b.bottom) / 2 : now.y);
      await player.seconds(0.3);
    };
    const pointsVar = findVar(first.state, MEMORY_POINTS);
    const points = async () => (pointsVar ? num((await player.state()).variables[pointsVar]) : undefined);

    // one click turns a card over
    const one = cards[0] as TargetState;
    await clickCard(one);
    const afterOne = await player.state();
    const flips = revealed(first, afterOne, one.id);
    shots.push({ label: 'Eine Karte angeklickt', png: await player.screenshot() });
    checks.push(
      result(
        'flip',
        'A click turns a card over',
        flips,
        `${one.name}: ${look(first.state, one.id)?.costume} -> ${look(afterOne, one.id)?.costume}`,
        ['Wenn ich eine Karte anklicke, dreht sie sich um.', 'Wenn ich eine Karte anklicke, passiert nichts.'],
      ),
    );

    // a whole game, played like a kid with a perfect memory
    const game = await fresh();
    const faces = new Map<string, { look: string; costume: string }>();
    const matched = new Set<string>();
    const known = (a: string, b: string) => {
      const fa = faces.get(a);
      const fb = faces.get(b);
      return !!fa && !!fb && sameFace(fa, fb);
    };
    const pairs: { match: boolean; stayed: boolean; scored: boolean | undefined }[] = [];
    for (let attempt = 0; attempt < 12 && matched.size < game.cards.length; attempt++) {
      const open = game.cards.filter((c) => !matched.has(c.id));
      const seen = open.filter((c) => faces.has(c.id));
      const pair = seen.flatMap((a, i) =>
        seen
          .slice(i + 1)
          .filter((b) => known(a.id, b.id))
          .map((b) => [a, b] as const),
      )[0];
      const before = await points();
      let a: TargetState;
      let b: TargetState;
      if (pair) {
        [a, b] = pair;
        await clickCard(a);
        await clickCard(b);
      } else {
        a = open.find((c) => !faces.has(c.id)) ?? (open[0] as TargetState);
        await clickCard(a);
        faces.set(a.id, face(await player.state(), a.id));
        b =
          open.find((c) => c.id !== a.id && known(a.id, c.id)) ??
          open.find((c) => c.id !== a.id && !faces.has(c.id)) ??
          (open.find((c) => c.id !== a.id) as TargetState);
        await clickCard(b);
      }
      const shown = await player.state();
      for (const c of [a, b]) faces.set(c.id, face(shown, c.id));
      const match = known(a.id, b.id) && revealed(game, shown, a.id) && revealed(game, shown, b.id);
      await player.seconds(3);
      const later = await player.state();
      const after = await points();
      pairs.push({
        match,
        stayed: revealed(game, later, a.id) && revealed(game, later, b.id),
        scored: before === undefined || after === undefined ? undefined : after === before + (match ? 1 : 0),
      });
      if (match) {
        matched.add(a.id);
        matched.add(b.id);
      }
      if (!revealed(game, shown, a.id) && !revealed(game, shown, b.id)) break; // nothing turns over
    }
    const end = await player.state();
    const events = await player.events();
    shots.push({ label: 'Alle Paare gefunden?', png: await player.screenshot() });
    // the brief: 3 pairs, every picture exactly twice
    // grouped like sameFace: two drawings of the same fruit with the same costume name are a pair to the
    // kid (and to the game's own matching); a generic name like "costume1" says nothing
    const picture = (f: { look: string; costume: string }) =>
      f.costume && !/^(costume|kostüm)\d*$/i.test(f.costume) ? `name:${f.costume}` : f.look;
    const groups = new Map<string, number>();
    const names = new Map<string, string>();
    for (const f of faces.values()) {
      groups.set(picture(f), (groups.get(picture(f)) ?? 0) + 1);
      names.set(picture(f), f.costume);
    }
    const odd = [...groups].filter(([, n]) => n !== 2).map(([k, n]) => `${names.get(k) || 'ein Bild'} (${n}×)`);
    const allKnown = faces.size === game.cards.length;
    const threePairs = allKnown && groups.size === game.cards.length / 2 && [...groups.values()].every((n) => n === 2);
    const matches = pairs.filter((p) => p.match);
    checks.push(
      result(
        'pair',
        'A matching pair stays open and scores',
        matches.length > 0 &&
          matches.every((p) => p.stayed && p.scored !== false) &&
          pointsVar !== undefined &&
          threePairs,
        `${matches.length} pairs found; stayed open: ${matches.filter((p) => p.stayed).length}; ` +
          (pointsVar ? `${pointsVar} counted right: ${matches.filter((p) => p.scored).length}` : 'no points variable') +
          `; pictures: ${allKnown ? [...groups.values()].join('+') : 'not all seen'}`,
        [
          'Wenn ich zwei gleiche Karten finde, bleiben sie offen und ich bekomme einen Punkt.',
          matches.length === 0
            ? 'Ich finde keine zwei gleichen Karten.'
            : allKnown && !threePairs
              ? `Die Bilder passen nicht: nicht jedes Bild ist genau zweimal da, z.B. ${odd.slice(0, 2).join(', ')}.`
              : !pointsVar
                ? 'Es gibt keine Punkte-Anzeige.'
                : matches.some((p) => !p.stayed)
                  ? 'Zwei gleiche Karten drehen sich trotzdem wieder um.'
                  : 'Bei zwei gleichen Karten zählen die Punkte nicht richtig.',
        ],
      ),
    );
    const won =
      events.says.find((x) => /gewonnen|geschafft|super|toll|bravo|sieg|win/i.test(x.text))?.text ??
      events.broadcasts.find((x) => /gewonnen|geschafft|ende|sieg|win|fertig/i.test(x.name))?.name ??
      end.monitors.find((m) => /gewonnen|geschafft|sieg|win/i.test(m.value))?.value ??
      (end.backdrop !== game.state.backdrop ? `backdrop ${end.backdrop}` : undefined);
    const allFound = matched.size === game.cards.length;
    checks.push(
      result(
        'win',
        'All pairs found: the game says so',
        allFound ? won !== undefined : undefined,
        allFound ? `signal: ${won ?? 'none'}` : `only ${matched.size / 2} pairs found`,
        ['Wenn alle Paare gefunden sind, steht da „Gewonnen!“.', 'Wenn ich alle Paare gefunden habe, passiert nichts.'],
      ),
    );

    // a wrong pair, each try on a fresh game; a try that happens to hit a pair doesn't count
    let mismatch: { turnedBack: boolean; scored: boolean } | undefined;
    for (let i = 1; i < cards.length && !mismatch; i++) {
      const g = await fresh();
      const [a, b] = [g.cards[0], g.cards[i]];
      if (!a || !b) break;
      const before = await points();
      await clickCard(a);
      await clickCard(b);
      const shown = await player.state();
      if (!revealed(g, shown, a.id) || sameFace(face(shown, a.id), face(shown, b.id))) {
        if (!revealed(g, shown, a.id)) break; // nothing turns over: no wrong pair to test
        continue;
      }
      await player.seconds(3);
      const later = await player.state();
      mismatch = {
        turnedBack: !revealed(g, later, a.id) && !revealed(g, later, b.id),
        scored: (await points()) !== before,
      };
    }
    checks.push(
      result(
        'mismatch',
        'A wrong pair turns back',
        mismatch ? mismatch.turnedBack && !mismatch.scored : undefined,
        mismatch
          ? `turned back: ${mismatch.turnedBack}; points changed: ${mismatch.scored}`
          : 'found no wrong pair to try',
        [
          'Zwei verschiedene Karten drehen sich wieder um.',
          mismatch?.turnedBack
            ? 'Bei zwei verschiedenen Karten bekomme ich trotzdem einen Punkt.'
            : 'Wenn zwei verschiedene Karten offen sind, bleiben sie einfach offen.',
        ],
      ),
    );

    // the classic bug: clicking the same card twice counts as a pair
    const twice = await fresh();
    const p0 = await points();
    if (twice.cards[0]) {
      await clickCard(twice.cards[0]);
      await clickCard(twice.cards[0]);
    }
    await player.seconds(3);
    const p1 = await points();
    checks.push(
      result(
        'same-card',
        'Clicking one card twice is no pair',
        p0 === undefined || p1 === undefined ? undefined : p1 === p0,
        `${pointsVar ?? 'points'}: ${p0} -> ${p1}`,
        [
          'Wenn ich dieselbe Karte zweimal anklicke, gibt es keinen Punkt.',
          'Wenn ich dieselbe Karte zweimal anklicke, bekomme ich einen Punkt.',
        ],
      ),
    );

    // a restart after a played game: all cards face down again (showing a back from the first start)
    const backLooks = new Set(first.backs.values());
    const again = await fresh();
    const allBack = again.cards.length === cards.length && again.cards.every((c) => backLooks.has(c.look));
    checks.push(
      result(
        'restart',
        'The green flag restarts the game',
        allBack && (pointsVar === undefined || num(again.state.variables[pointsVar]) === 0),
        `${again.cards.length} cards, all face down: ${allBack}; ${pointsVar ?? 'points'}: ${pointsVar ? again.state.variables[pointsVar] : '-'}`,
        [
          'Mit der grünen Flagge sind wieder alle Karten verdeckt.',
          'Mit der grünen Flagge fängt das Spiel nicht richtig neu an.',
        ],
      ),
    );
    await player.release();
    return { checks, shots };
  },
};

export const GAMES: Record<string, Game> = {
  memory,
  fangspiel,
  [fangMich.id]: fangMich,
  [spaceShooter.id]: spaceShooter,
  minesweeper,
  [minesweeperMini.id]: minesweeperMini,
};
