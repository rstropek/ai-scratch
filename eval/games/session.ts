// An interactive test session for an agent: the agent plays the kid, this keeps the real app open and
// answers each command with compact text (the AI's answer, its tool calls, the game checks, screenshot
// paths) instead of the agent clicking and screenshotting through a browser. See SKILL.md (game-test).
//   node eval/games/session.ts serve --game memory [--model … --effort … --prompt file --port 3040 --headed]
//   node eval/games/session.ts send "Ich will ein Memory-Spiel bauen!"
//   node eval/games/session.ts check [--turn n] | play [seconds] [--turn n] | try <action>… [--turn n]
//                              | project | shot | undo | compact | note "<text>" | report [--judge] | stop
//   try actions: click:<sprite>[#n] or click:<x>,<y> · key:<space|left|right|up|down|a…>[:seconds] · wait:<seconds>
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from '@playwright/test';
import { loadDotEnv } from '../../src/server/config.ts';
import { PROJECT_CHANGING_TOOLS } from '../../src/shared/tools/index.ts';
import { projectSnapshot } from '../../src/shared/tools/project-tools.ts';
import { createVm } from '../../test/support/headless-vm.ts';
import { type Answer, ChatDriver } from './chat.ts';
import { settle } from './checks.ts';
import { type CheckResult, GAMES } from './games.ts';
import { judge } from './kid.ts';
import { BROWSER_ARGS, type PlayEvents, Player, type StageState } from './player.ts';
import { appCost, callCost } from './pricing.ts';
import { allGreen, checkScore, type RunRecord, type TurnRecord, transcript, writeRunReport } from './report.ts';
import { EVAL_CODE, startServer } from './server.ts';

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    game: { type: 'string', default: 'none' },
    model: { type: 'string', default: 'claude-haiku-5-5' },
    effort: { type: 'string', default: 'high' },
    prompt: { type: 'string' },
    port: { type: 'string', default: '3040' },
    headed: { type: 'boolean', default: false },
    judge: { type: 'boolean', default: false },
    turn: { type: 'string' },
    'judge-model': { type: 'string', default: 'claude-opus-5-5' },
    out: { type: 'string', default: 'eval/games/sessions' },
  },
});
const [command = 'help', ...rest] = positionals;
const ROOT = new URL('../../', import.meta.url);
const port = Number(args.port);
const control = `http://127.0.0.1:${port + 1}`;

const ICON = { pass: '✅', fail: '❌', skip: '➖' } as const;
const checkLines = (checks: CheckResult[]) =>
  checks
    .map(
      (c) =>
        `${ICON[c.status]} ${c.id}${c.extra ? ' (extra)' : ''}: ${c.title}${c.status === 'pass' ? '' : ` (${c.detail})`}`,
    )
    .join('\n');
const toolLines = (a: Answer) =>
  a.tools.map((t) => `${t.ok ? '✓' : '✗'} ${t.name}${t.ok ? '' : `: ${clip(t.error ?? 'no result')}`}`).join('\n');
/** tool errors can carry the whole tool input (kilobytes of JSON); the start says what went wrong */
const clip = (s: string, n = 400) =>
  s.length > n ? `${s.slice(0, n)}… (${s.length} chars, full text in result.json)` : s;

// --- trying a game by hand (`try`) -------------------------------------------------------------------

const KEYS: Record<string, string> = {
  space: ' ',
  left: 'ArrowLeft',
  right: 'ArrowRight',
  up: 'ArrowUp',
  down: 'ArrowDown',
};
/** Visible targets with this name in reading order (top left first): `Karte#2` is the second. */
const named = (s: StageState, name: string) =>
  s.targets.filter((t) => t.visible && t.name === name).sort((a, b) => b.y - a.y || a.x - b.x);
const label = (s: StageState, id: string) => {
  const t = s.targets.find((x) => x.id === id);
  if (!t) return id;
  const same = named(s, t.name);
  return same.length > 1 ? `${t.name}#${same.findIndex((x) => x.id === id) + 1}` : t.name;
};
const clickPoint = (s: StageState, arg: string) => {
  const xy = arg.match(/^(-?\d+),(-?\d+)$/);
  if (xy) return { x: Number(xy[1]), y: Number(xy[2]) };
  const [name = '', n = '1'] = arg.split('#');
  const t = named(s, name)[Number(n) - 1];
  const b = t?.bounds;
  return t && (b ? { x: (b.left + b.right) / 2, y: (b.top + b.bottom) / 2 } : { x: t.x, y: t.y });
};
const summary = (s: StageState) => {
  const sprites = s.targets
    .filter((t) => !t.clone)
    .map((t) => `${t.name} @${t.x},${t.y} ${t.visible ? t.costume : 'hidden'}`)
    .join('; ');
  const clones = s.targets.filter((t) => t.clone).length;
  return `${sprites}${clones ? ` (+${clones} clones)` : ''} · variables ${JSON.stringify(s.variables)}`;
};
/** What changed between two states, in a line. */
const changes = (a: StageState, b: StageState, said: PlayEvents) => {
  const out: string[] = [];
  const looks: string[] = [];
  for (const t of b.targets) {
    const was = a.targets.find((x) => x.id === t.id);
    if (!was) continue;
    if (was.visible !== t.visible) looks.push(`${label(b, t.id)} ${t.visible ? `shown (${t.costume})` : 'hidden'}`);
    else if (t.visible && was.look !== t.look) looks.push(`${label(b, t.id)}: ${was.costume} → ${t.costume}`);
    else if (!t.clone && Math.hypot(t.x - was.x, t.y - was.y) > 5) looks.push(`${t.name} → ${t.x},${t.y}`);
  }
  out.push(...looks.slice(0, 10), ...(looks.length > 10 ? [`(+${looks.length - 10} more)`] : []));
  const clones = (s: StageState) => s.targets.filter((t) => t.clone).length;
  if (clones(a) !== clones(b)) out.push(`clones ${clones(a)} → ${clones(b)}`);
  for (const [name, v] of Object.entries(b.variables))
    if (a.variables[name] !== v) out.push(`${name} ${a.variables[name]} → ${v}`);
  for (const x of said.says) out.push(`${x.sprite} says "${x.text}"`);
  for (const x of said.broadcasts) out.push(`broadcast ${x.name}`);
  if (said.stopAll.length) out.push('stop all');
  return out.join('; ') || 'nothing changed';
};

/** dist/ is what the harness serves: warn when the client code is newer. */
const staleBuild = () => {
  const built = (() => {
    try {
      return fs.statSync(new URL('dist/client/index.html', ROOT)).mtimeMs;
    } catch {
      return 0;
    }
  })();
  const newer = ['src/client', 'src/editor', 'src/shared'].flatMap((d) =>
    fs
      .readdirSync(new URL(d, ROOT), { recursive: true, withFileTypes: true })
      .filter((e) => e.isFile() && !e.name.includes('.test.'))
      .map((e) => path.join(e.parentPath, e.name))
      .filter((f) => fs.statSync(f).mtimeMs > built),
  );
  return newer.length
    ? `⚠ dist/ is older than ${newer.length} client file(s), e.g. ${path.relative(ROOT.pathname, newer[0] as string)}: stop, run \`npm run build\`, start again`
    : '';
};

// --- the daemon --------------------------------------------------------------------------------------

const serve = async () => {
  loadDotEnv();
  const game = args.game === 'none' ? undefined : GAMES[args.game];
  if (args.game !== 'none' && !game)
    throw new Error(`Unknown game ${args.game}; known: ${Object.keys(GAMES).join(', ')}, none`);
  const d = new Date();
  const p2 = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;
  const stale = staleBuild();
  /** goes in front of the first reply: a stale build, and where the session's files are */
  let banner = '';
  const dir = path.resolve(args.out, `${stamp}-${args.game}`);
  fs.mkdirSync(dir, { recursive: true });
  const logDir = path.join(dir, 'logs');
  const prompt = args.prompt ? path.resolve(args.prompt) : undefined;
  const server = await startServer({ port, logDir, model: args.model, effort: args.effort, instructionsFile: prompt });
  const browser = await chromium.launch({ headless: !args.headed, args: BROWSER_ARGS });
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const chat = await ChatDriver.open(await context.newPage(), server.url, EVAL_CODE);
  const player = await Player.open(await context.newPage(), server.url);
  const started = Date.now();
  const record: RunRecord = {
    game: game?.id ?? 'none',
    gameTitle: game?.title ?? 'Free session',
    variant: { model: args.model, effort: args.effort, prompt },
    rep: 1,
    startedAt: new Date().toISOString(),
    ms: 0,
    endReason: 'stopped',
    turns: [],
    finalChecks: [],
    finalShots: [],
    cost: { app: 0, kid: 0, judge: 0 },
    appCalls: 0,
  };
  let shots = 0;
  const save = (name: string, png: Buffer) => {
    const file = `${String(++shots).padStart(3, '0')}-${name}.png`;
    fs.writeFileSync(path.join(dir, file), png);
    return file;
  };
  /** the project now, or as it was after kid turn n (saved after every change) */
  const projectOf = async (turn?: number) => {
    if (turn === undefined) return chat.sb3();
    const file = path.join(dir, `turn-${String(turn).padStart(2, '0')}.sb3`);
    if (!fs.existsSync(file)) throw new Error(`no project saved for turn ${turn} (only turns that changed it)`);
    return fs.readFileSync(file);
  };
  const runChecks = async (sb3: Buffer) => {
    if (!game) return undefined;
    const result = await game.check(player, sb3);
    return {
      ...result,
      files: result.shots.map((s) => ({ label: s.label, file: save(s.label.replace(/[^\p{L}\p{N}]+/gu, '-'), s.png) })),
    };
  };

  const commands: Record<string, (params: string[], options: { judge: boolean; turn?: number }) => Promise<string>> = {
    send: async ([text]) => {
      if (!text) return 'usage: send "<kid message>"';
      const compacted = await chat.compactIfNeeded();
      const answer = await chat.send(text);
      const n = record.turns.length + 1;
      const changed = answer.tools.some((t) => t.ok && PROJECT_CHANGING_TOOLS.has(t.name));
      const turn: TurnRecord = { n, kid: text, answer, changed, ...(compacted ? { compacted } : {}) };
      const out = [
        `## Turn ${n} (${Math.round(answer.ms / 1000)} s)${compacted ? ' – the harness clicked „Zusammenfassen“ first' : ''}`,
        `KI: ${answer.text || '(no answer text)'}`,
      ];
      if (answer.pictures) out.push(`Pictures in the chat: ${answer.pictures.join(', ')}`);
      if (answer.error) out.push(`⚠ chat error: ${answer.error}`);
      if (answer.tools.length) out.push(`Tools:\n${toolLines(answer)}`);
      if (changed) fs.writeFileSync(path.join(dir, `turn-${String(n).padStart(2, '0')}.sb3`), await chat.sb3());
      if (changed && game) {
        const checks = await runChecks(await projectOf(n));
        if (checks) {
          turn.checks = checks.checks;
          turn.shot = checks.files[0]?.file;
          if (!record.firstGreenTurn && allGreen(checks.checks)) record.firstGreenTurn = n;
          out.push(`Checks ${checkScore(checks.checks)}:\n${checkLines(checks.checks)}`);
          out.push(
            `A kid trying it would notice:\n${checks.checks
              .filter((c) => c.kid)
              .map((c) => `- ${c.kid}`)
              .join('\n')}`,
          );
          out.push(`Stage: ${checks.files.map((f) => path.join(dir, f.file)).join(' ')}`);
        }
      } else if (changed) {
        out.push('(project changed; no game set, so no checks: use `play` or `shot`)');
      }
      record.turns.push(turn);
      fs.writeFileSync(path.join(dir, 'result.json'), JSON.stringify(record, null, 2));
      return out.join('\n\n');
    },
    check: async (_params, options) => {
      const checks = await runChecks(await projectOf(options.turn));
      if (!checks) return `no game set (serve --game ${Object.keys(GAMES).join('|')})`;
      return `Checks ${checkScore(checks.checks)}:\n${checkLines(checks.checks)}\n\nShots: ${checks.files.map((f) => path.join(dir, f.file)).join(' ')}`;
    },
    play: async ([seconds = '3'], options) => {
      await player.load(await projectOf(options.turn));
      await player.greenFlag(1);
      await player.seconds(Number(seconds));
      const state = await player.state();
      const events = await player.events();
      const file = save(`play-${seconds}s`, await player.screenshot());
      await player.release();
      const sprites = state.targets
        .filter((t) => !t.clone)
        .map((t) => `${t.name} @${t.x},${t.y} ${t.visible ? t.costume : 'hidden'}`)
        .join('; ');
      const clones = state.targets.filter((t) => t.clone).length;
      return [
        `After the green flag + ${seconds} s (no input):`,
        `Sprites: ${sprites}${clones ? ` (+${clones} clones)` : ''}`,
        `Variables: ${JSON.stringify(state.variables)}`,
        `Said: ${events.says.map((s) => `${s.sprite}: ${s.text}`).join(' | ') || '-'}; broadcasts: ${events.broadcasts.map((b) => b.name).join(', ') || '-'}; scripts running: ${state.threads}`,
        `Stage: ${path.join(dir, file)}`,
      ].join('\n');
    },
    try: async (actions, options) => {
      if (!actions.length)
        return 'usage: try <action>… (click:<sprite>[#n] | click:<x>,<y> | key:<key>[:seconds] | wait:<seconds>)';
      await player.load(await projectOf(options.turn));
      await player.greenFlag(1);
      let before = await settle(player, 5, 1);
      const lines = [`After the green flag: ${summary(before)}`];
      for (const action of actions) {
        const [kind = '', arg = '', extra] = action.split(':');
        const e0 = await player.events();
        if (kind === 'click') {
          const at = clickPoint(before, arg);
          if (!at) {
            lines.push(
              `- ${action}: no visible sprite "${arg}" (names: ${[...new Set(before.targets.filter((t) => t.visible).map((t) => t.name))].join(', ')})`,
            );
            continue;
          }
          await player.click(at.x, at.y);
          await player.seconds(1);
        } else if (kind === 'key')
          await player.seconds(Number(extra ?? 0.5), { kind: 'hold', keys: [KEYS[arg] ?? arg] });
        else if (kind === 'wait') await player.seconds(Number(arg || 1));
        else {
          lines.push(`- ${action}: unknown action`);
          continue;
        }
        const after = await player.state();
        const e = await player.events();
        const said = {
          says: e.says.slice(e0.says.length),
          broadcasts: e.broadcasts.slice(e0.broadcasts.length),
          stopAll: e.stopAll.slice(e0.stopAll.length),
          maxClones: e.maxClones,
        };
        lines.push(`- ${action} → ${changes(before, after, said)}`);
        before = after;
      }
      lines.push(`Stage: ${path.join(dir, save('try', await player.screenshot()))}`);
      await player.release();
      return lines.join('\n');
    },
    note: async ([text]) => {
      if (!text) return 'usage: note "<what you checked by hand>"';
      record.notes = [...(record.notes ?? []), { afterTurn: record.turns.length, text }];
      fs.writeFileSync(path.join(dir, 'result.json'), JSON.stringify(record, null, 2));
      return `noted (after turn ${record.turns.length}); it goes into the report and to the judge`;
    },
    project: async () => {
      const json = await chat.editor.evaluate(() => window.ki?.vm.toJSON() ?? '');
      const { targets } = projectSnapshot(await createVm(json));
      return targets
        .map((t) => {
          const costumes = t.costumes.map((c) => (c.size ? `${c.name} ${c.size.join('x')}` : c.name)).join(', ');
          const head = t.isStage ? 'Stage' : `${t.name} @${t.x},${t.y} size ${t.size}${t.visible ? '' : ' hidden'}`;
          const vars = [...t.variables, ...t.lists.map((l) => `${l}[]`)].join(', ');
          return [
            `${head} · costumes: ${costumes}${vars ? ` · variables: ${vars}` : ''}`,
            ...t.scripts.map((script) => `  ${JSON.stringify(script)}`),
          ].join('\n');
        })
        .join('\n');
    },
    shot: async () => {
      const file = save('app', await chat.screenshot());
      return `App: ${path.join(dir, file)}`;
    },
    undo: async () => {
      const undo = chat.page.getByRole('button', { name: 'Rückgängig' });
      if (!(await undo.count())) return 'no answer to undo';
      await undo.last().click();
      await chat.page.getByTestId('undone').last().waitFor();
      const last = record.turns.findLast((t) => t.changed && !t.undone);
      if (last) last.undone = true;
      return 'undone: the project is back to before the last answer that changed it';
    },
    compact: async () => ((await chat.compactIfNeeded()) ? 'compacted' : 'the Gedächtnis is not full'),
    report: async (_params, options) => {
      if (game) {
        const final = await runChecks(await chat.sb3());
        record.finalChecks = final?.checks ?? [];
        record.finalShots = final?.files ?? [];
      }
      record.finalShots.push({ label: 'Die App', file: save('app', await chat.screenshot()) });
      fs.writeFileSync(path.join(dir, 'final.sb3'), await chat.sb3());
      if (options.judge) {
        const { verdict, usage } = await judge(args['judge-model'], transcript(record, game?.brief));
        record.verdict = verdict;
        record.cost.judge = callCost(usage);
      }
      const app = appCost(logDir, chat.session);
      record.cost.app = app.cost;
      record.appCalls = app.calls;
      record.ms = Date.now() - started;
      fs.writeFileSync(path.join(dir, 'result.json'), JSON.stringify(record, null, 2));
      writeRunReport(dir, record);
      return `Report: ${path.join(dir, 'report.md')} (app cost so far $${app.cost.toFixed(3)} in ${app.calls} calls)`;
    },
  };

  let queue = Promise.resolve();
  const httpServer = http.createServer((req, res) => {
    let body = '';
    req.on('data', (d) => {
      body += d;
    });
    req.on('end', () => {
      const {
        command: name,
        rest: params,
        options,
      } = JSON.parse(body || '{}') as { command: string; rest: string[]; options: { judge: boolean; turn?: number } };
      if (name === 'stop') {
        res.end('stopped');
        void (async () => {
          await browser.close();
          await server.stop();
          process.exit(0);
        })();
        return;
      }
      // one command at a time, like a kid at one screen
      queue = queue.then(async () => {
        const run = commands[name];
        try {
          const text = run ? await run(params, options) : `unknown command ${name}`;
          res.end(banner ? `${banner}\n\n${text}` : text);
          banner = '';
        } catch (e) {
          res.statusCode = 500;
          res.end(`error: ${e instanceof Error ? e.message : String(e)}`);
        }
      });
    });
  });
  httpServer.listen(port + 1, '127.0.0.1');
  console.log(
    `session ready: app ${server.url} (${args.model}, ${args.effort}${prompt ? `, ${prompt}` : ''}), game ${args.game}, files in ${dir}`,
  );
  if (stale) console.log(stale);
  banner = [stale, `Session folder: ${dir}`].filter(Boolean).join('\n');
};

// --- the client --------------------------------------------------------------------------------------

if (command === 'serve') {
  await serve();
} else if (command === 'help') {
  console.log(
    fs
      .readFileSync(new URL(import.meta.url), 'utf8')
      .split('\n')
      .slice(0, 9)
      .join('\n'),
  );
} else {
  // node:http, not fetch: a turn can take longer than fetch's 5-minute header timeout
  const ask = () =>
    new Promise<{ ok: boolean; text: string } | undefined>((resolve) => {
      const req = http.request(`${control}/`, { method: 'POST' }, (res) => {
        let text = '';
        res.on('data', (d) => {
          text += d;
        });
        res.on('end', () => resolve({ ok: res.statusCode === 200, text }));
      });
      req.on('error', () => resolve(undefined));
      const options = { judge: args.judge, ...(args.turn ? { turn: Number(args.turn) } : {}) };
      req.end(JSON.stringify({ command, rest, options }));
    });
  // a session that is still starting (about 10 s) answers once it's ready
  let reply = await ask();
  for (let i = 0; !reply && i < 60; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    reply = await ask();
  }
  if (!reply) {
    console.error(`no session on port ${port}: start one with \`node eval/games/session.ts serve --game …\``);
    process.exit(1);
  }
  console.log(reply.text);
  process.exit(reply.ok ? 0 : 1);
}
