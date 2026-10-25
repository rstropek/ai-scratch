// Game harness: a simulated kid builds Scratch games with the real app (production build, real model),
// and after every change a bot plays the game in the real editor and checks it. See eval/games/README.md.
//   npm run eval:games -- --games memory,fangspiel --model claude-haiku-5-5 --reps 2 --report
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { type Browser, chromium } from '@playwright/test';
import { loadDotEnv } from '../../src/server/config.ts';
import { buildInstructions, PROJECT_CHANGING_TOOLS } from '../../src/shared/tools/index.ts';
import { ChatDriver } from './chat.ts';
import { GAMES, type Game } from './games.ts';
import { DONE, judge, type KidTurn, nextKidMessage } from './kid.ts';
import { BROWSER_ARGS, Player } from './player.ts';
import { appCost, callCost } from './pricing.ts';
import {
  allGreen,
  checkScore,
  type RunRecord,
  type TurnRecord,
  transcript,
  type Variant,
  variantLabel,
  writeRunReport,
  writeSummary,
} from './report.ts';
import { EVAL_CODE, type RunningServer, startServer } from './server.ts';

const { values: args } = parseArgs({
  options: {
    games: { type: 'string', default: Object.keys(GAMES).join(',') },
    model: { type: 'string', default: 'claude-haiku-5-5' },
    effort: { type: 'string', default: 'high' },
    prompt: { type: 'string', default: 'default' },
    reps: { type: 'string', default: '1' },
    'max-turns': { type: 'string', default: '30' },
    concurrency: { type: 'string', default: '2' },
    report: { type: 'boolean', default: false },
    'skip-judge': { type: 'boolean', default: false },
    'kid-model': { type: 'string', default: 'claude-sonnet-5-5' },
    'judge-model': { type: 'string', default: 'claude-opus-5-5' },
    out: { type: 'string', default: 'eval/games/runs' },
    headed: { type: 'boolean', default: false },
    references: { type: 'boolean', default: false },
    'dump-prompt': { type: 'string' },
  },
});

loadDotEnv();
const list = (s: string) =>
  s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
const stamp = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
};

if (args['dump-prompt']) {
  fs.writeFileSync(args['dump-prompt'], buildInstructions());
  console.log(`built-in prompt written to ${args['dump-prompt']}; try a variant with --prompt ${args['dump-prompt']}`);
  process.exit(0);
}

const games = list(args.games).map((id) => {
  const game = GAMES[id];
  if (!game) throw new Error(`Unknown game ${id}; known: ${Object.keys(GAMES).join(', ')}`);
  return game;
});
const variants: Variant[] = list(args.model).flatMap((model) =>
  list(args.effort).flatMap((effort) =>
    list(args.prompt).map((p) => ({ model, effort, prompt: p === 'default' ? undefined : path.resolve(p) })),
  ),
);
for (const v of variants) if (v.prompt && !fs.existsSync(v.prompt)) throw new Error(`No prompt file ${v.prompt}`);

const outDir = path.resolve(args.out, stamp());
fs.mkdirSync(outDir, { recursive: true });
const browser: Browser = await chromium.launch({ headless: !args.headed, args: BROWSER_ARGS });
const servers: RunningServer[] = [];

const pool = async <T>(items: T[], size: number, run: (item: T) => Promise<void>) => {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await run(items[next++] as T);
  };
  await Promise.all(Array.from({ length: Math.max(1, size) }, worker));
};

/** --references: the checks against the hand-built games, no model calls (checks the checks). */
const checkReferences = async (url: string) => {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const player = await Player.open(page, url);
  const dir = new URL('./reference/', import.meta.url);
  if (!fs.existsSync(dir)) throw new Error('No reference games: run `node eval/games/reference.ts` first');
  for (const file of fs.readdirSync(dir).sort()) {
    // reference files are named <game id>[-<variant>].sb3; ids may contain dashes themselves
    const name = file.replace(/\.sb3$/, '');
    const game = Object.values(GAMES)
      .filter((g) => name === g.id || name.startsWith(`${g.id}-`))
      .sort((a, b) => b.id.length - a.id.length)[0];
    if (!game || !games.includes(game)) continue;
    const { checks } = await game.check(player, fs.readFileSync(new URL(file, dir)));
    console.log(`\n${file}: ${checkScore(checks)}`);
    for (const c of checks) console.log(`  ${c.status.padEnd(4)} ${c.id.padEnd(10)} ${c.detail}`);
  }
};

const runOne = async (game: Game, variant: Variant, rep: number, server: RunningServer, logDir: string) => {
  const name = `${game.id}-${variant.model}-${variant.effort}${variant.prompt ? `-${path.basename(variant.prompt, path.extname(variant.prompt))}` : ''}-${rep}`;
  const dir = path.join(outDir, name);
  fs.mkdirSync(dir, { recursive: true });
  const log = (msg: string) => console.log(`[${name}] ${msg}`);
  const started = Date.now();
  const record: RunRecord = {
    game: game.id,
    gameTitle: game.title,
    variant,
    rep,
    startedAt: new Date().toISOString(),
    ms: 0,
    endReason: 'max-turns',
    turns: [],
    finalChecks: [],
    finalShots: [],
    cost: { app: 0, kid: 0, judge: 0 },
    appCalls: 0,
  };
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  let session = '';
  try {
    const chat = await ChatDriver.open(await context.newPage(), server.url, EVAL_CODE);
    const player = await Player.open(await context.newPage(), server.url, EVAL_CODE);
    const kidTurns: KidTurn[] = [];
    let errors = 0;
    let lastChecks: TurnRecord['checks'];
    for (let n = 1; n <= Number(args['max-turns']); n++) {
      const kid = await nextKidMessage(args['kid-model'], game.brief, kidTurns);
      record.cost.kid += callCost(kid.usage);
      if (!kid.text || kid.text.includes(DONE)) {
        record.endReason = 'kid-done';
        break;
      }
      const compacted = await chat.compactIfNeeded();
      log(`turn ${n}: ${kid.text.slice(0, 100).replaceAll('\n', ' ')}`);
      const answer = await chat.send(kid.text);
      session = chat.session;
      const changed = answer.tools.some((t) => t.ok && PROJECT_CHANGING_TOOLS.has(t.name));
      const turn: TurnRecord = { n, kid: kid.text, answer, changed, ...(compacted ? { compacted } : {}) };
      let stages: { label: string; png: Buffer }[] | undefined;
      if (changed) {
        const { checks, shots } = await game.check(player, await chat.sb3());
        turn.checks = checks;
        lastChecks = checks;
        stages = shots;
        const stage = shots[0]?.png;
        if (args.report && stage) {
          turn.shot = `turn-${String(n).padStart(2, '0')}.png`;
          fs.writeFileSync(path.join(dir, turn.shot), stage);
        }
        if (!record.firstGreenTurn && allGreen(checks)) record.firstGreenTurn = n;
        log(`  checks ${checkScore(checks)}`);
      }
      record.turns.push(turn);
      const observed = turn.checks
        ?.filter((c) => c.kid)
        .map((c) => `- ${c.kid}`)
        .join('\n');
      kidTurns.push({
        kid: kid.text,
        answer: [
          ...(answer.pictures ? [`(Im Chat zeigt die KI Bilder: ${answer.pictures.join(', ')})`] : []),
          answer.text,
          ...(answer.error ? [`(Im Chat steht eine Fehlermeldung: ${answer.error})`] : []),
        ].join('\n'),
        ...(observed ? { observed } : {}),
        ...(stages?.length ? { stages } : {}),
      });
      errors = answer.error ? errors + 1 : 0;
      if (errors >= 3) {
        record.endReason = 'errors';
        break;
      }
      fs.writeFileSync(path.join(dir, 'result.json'), JSON.stringify(record, null, 2));
    }

    // the finished game, with its screenshots
    const sb3 = await chat.sb3();
    fs.writeFileSync(path.join(dir, 'final.sb3'), sb3);
    const final = await game.check(player, sb3);
    record.finalChecks = final.checks;
    if (!lastChecks) lastChecks = final.checks;
    if (args.report) {
      final.shots.forEach((s, i) => {
        const file = `final-${i + 1}.png`;
        fs.writeFileSync(path.join(dir, file), s.png);
        record.finalShots.push({ label: s.label, file });
      });
      fs.writeFileSync(path.join(dir, 'app.png'), await chat.screenshot());
      record.finalShots.push({ label: 'Die App am Ende', file: 'app.png' });
    }
    if (args.report && !args['skip-judge']) {
      const { verdict, usage } = await judge(args['judge-model'], transcript(record, game.brief));
      record.verdict = verdict;
      record.cost.judge = callCost(usage);
    }
  } catch (e) {
    record.endReason = 'crash';
    record.crash = e instanceof Error ? e.message.split('\n')[0] : String(e);
    log(`crashed: ${record.crash}`);
  } finally {
    await context.close();
  }
  const app = appCost(logDir, session);
  record.cost.app = app.cost;
  record.appCalls = app.calls;
  record.ms = Date.now() - started;
  fs.writeFileSync(path.join(dir, 'result.json'), JSON.stringify(record, null, 2));
  if (args.report) writeRunReport(dir, record);
  log(`done: ${checkScore(record.finalChecks)} checks, ${record.turns.length} turns, ${record.endReason}`);
  return { dir, record };
};

try {
  if (args.references) {
    const server = await startServer({ port: 3019, logDir: path.join(outDir, 'logs') });
    servers.push(server);
    await checkReferences(server.url);
  } else {
    const jobs: { game: Game; variant: Variant; rep: number; server: RunningServer; logDir: string }[] = [];
    for (const [i, variant] of variants.entries()) {
      const logDir = path.join(outDir, `logs-${i + 1}`);
      const server = await startServer({
        port: 3020 + i,
        logDir,
        model: variant.model,
        effort: variant.effort,
        instructionsFile: variant.prompt,
      });
      servers.push(server);
      for (const game of games)
        for (let rep = 1; rep <= Number(args.reps); rep++) jobs.push({ game, variant, rep, server, logDir });
    }
    console.log(`${jobs.length} runs (${variants.map(variantLabel).join(' | ')}) -> ${outDir}`);
    const done: Awaited<ReturnType<typeof runOne>>[] = [];
    await pool(jobs, Number(args.concurrency), async (j) => {
      done.push(await runOne(j.game, j.variant, j.rep, j.server, j.logDir));
    });
    done.sort((a, b) => a.dir.localeCompare(b.dir));
    console.log(`\n${writeSummary(outDir, done)}`);
  }
} finally {
  await browser.close();
  await Promise.all(servers.map((s) => s.stop()));
}
