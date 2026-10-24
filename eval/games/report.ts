// Run records and their Markdown reports: one report per run (the conversation turn by turn with stage
// screenshots, the final checks and the findings) and a summary table over all runs of an invocation.
import fs from 'node:fs';
import path from 'node:path';
import type { Answer } from './chat.ts';
import type { CheckResult } from './games.ts';
import type { Verdict } from './kid.ts';

export interface Variant {
  model: string;
  effort: string;
  /** a prompt file, or undefined for the built-in prompt */
  prompt: string | undefined;
}

export interface TurnRecord {
  n: number;
  kid: string;
  answer: Answer;
  /** a project-changing tool ran in this turn */
  changed: boolean;
  /** the checks after this turn (only when the project changed) */
  checks?: CheckResult[];
  /** stage screenshot after this turn, relative to the run directory */
  shot?: string;
  /** the harness clicked "Zusammenfassen" before this turn */
  compacted?: boolean;
  /** the tester clicked "Rückgängig" under this answer */
  undone?: boolean;
}

export interface RunRecord {
  game: string;
  gameTitle: string;
  variant: Variant;
  rep: number;
  startedAt: string;
  ms: number;
  endReason: 'kid-done' | 'max-turns' | 'errors' | 'crash' | 'stopped';
  crash?: string;
  turns: TurnRecord[];
  finalChecks: CheckResult[];
  /** final screenshots, relative to the run directory */
  finalShots: { label: string; file: string }[];
  /** the first kid turn after which every check passed */
  firstGreenTurn?: number;
  cost: { app: number; kid: number; judge: number };
  appCalls: number;
  verdict?: Verdict;
}

export const variantLabel = (v: Variant) =>
  `${v.model} (${v.effort})${v.prompt ? ` · ${path.basename(v.prompt)}` : ''}`;

const passed = (checks: CheckResult[]) => checks.filter((c) => c.status === 'pass').length;
const scored = (checks: CheckResult[]) => checks.filter((c) => c.status !== 'skip').length;
export const checkScore = (checks: CheckResult[]) => {
  const skipped = checks.length - scored(checks);
  return `${passed(checks)}/${scored(checks)}${skipped ? ` (${skipped} not testable yet)` : ''}`;
};
const usd = (n: number) => `$${n.toFixed(n < 0.1 ? 3 : 2)}`;
const mins = (ms: number) => `${Math.round(ms / 60_000)} min`;
const ICON = { pass: '✅', fail: '❌', skip: '➖' } as const;
const quote = (s: string) =>
  s
    .trim()
    .split('\n')
    .map((l) => `> ${l}`)
    .join('\n');
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n).trimEnd()} […]` : s);
const END = {
  'kid-done': 'the kid said it is done',
  'max-turns': 'turn limit reached',
  errors: 'stopped after repeated chat errors',
  crash: 'the harness crashed',
  stopped: 'the tester ended the session',
} as const;

const toolLine = (a: Answer) => {
  if (!a.tools.length) return '';
  const counts = new Map<string, { ok: number; failed: number }>();
  for (const t of a.tools) {
    const c = counts.get(t.name) ?? { ok: 0, failed: 0 };
    if (t.ok) c.ok += 1;
    else c.failed += 1;
    counts.set(t.name, c);
  }
  return [...counts]
    .map(([name, c]) => `${name}${c.ok > 1 ? ` ×${c.ok}` : ''}${c.failed ? ` (${c.failed} ✗)` : ''}`)
    .join(' · ');
};

/** Findings from the record itself; the judge's come on top. */
const findings = (r: RunRecord): string[] => {
  const out: string[] = [];
  if (r.crash) out.push(`**Harness crash:** \`${r.crash}\``);
  for (const c of r.finalChecks.filter((x) => x.status === 'fail'))
    out.push(`**Game:** ${c.title} fails (${c.detail})`);
  if (r.endReason === 'kid-done' && r.finalChecks.some((c) => c.status === 'fail'))
    out.push('**Kid gave up or was satisfied early:** it said FERTIG while checks still fail');
  for (const t of r.turns) {
    for (const tool of t.answer.tools.filter((x) => !x.ok))
      out.push(
        `**Tool error** (turn ${t.n}, ${tool.name}): ${clip(tool.error ?? 'no result', 300).replaceAll('\n', ' ')}`,
      );
    if (t.answer.error) out.push(`**Chat error** (turn ${t.n}): ${t.answer.error}`);
    if (t.compacted) out.push(`**Gedächtnis full** before turn ${t.n}: the harness clicked „Zusammenfassen“`);
  }
  // a check that passed once and failed later: the assistant broke something that worked
  const seen = new Map<string, number>();
  for (const t of r.turns) {
    for (const c of t.checks ?? []) {
      if (c.status === 'pass') seen.set(c.id, t.n);
      else if (c.status === 'fail' && seen.has(c.id)) {
        out.push(`**Regression** (turn ${t.n}): „${c.title}“ worked after turn ${seen.get(c.id)} and broke again`);
        seen.delete(c.id);
      }
    }
  }
  return out;
};

export const writeRunReport = (dir: string, r: RunRecord): void => {
  const lines: string[] = [];
  const total = r.cost.app + r.cost.kid + r.cost.judge;
  lines.push(`# ${r.gameTitle} · ${variantLabel(r.variant)} · run ${r.rep}`, '');
  lines.push(
    `**Game checks:** ${checkScore(r.finalChecks)} passed` +
      (r.firstGreenTurn ? ` (all green first after kid turn ${r.firstGreenTurn})` : '') +
      ` · **${r.turns.length} kid turns**, ended because ${END[r.endReason]}`,
    '',
    `**Cost:** ${usd(total)} (app ${usd(r.cost.app)} in ${r.appCalls} model calls, simulated kid ${usd(r.cost.kid)}, judge ${usd(r.cost.judge)}) · **Time:** ${mins(r.ms)} · ${r.startedAt}`,
    '',
  );

  lines.push('## Findings', '');
  if (r.verdict) lines.push(`**Teaching (judge):** ${r.verdict.teaching}/5. ${r.verdict.summary}`, '');
  const own = findings(r);
  const judged = (r.verdict?.findings ?? []).map(
    (f) => `**${f.severity}**${f.turn ? ` (turn ${f.turn})` : ''}: ${f.text}`,
  );
  if (!own.length && !judged.length) lines.push('None.');
  for (const f of [...own, ...judged]) lines.push(`- ${f}`);
  lines.push('');

  lines.push('## The finished game', '', '| | Check | Measured |', '|---|---|---|');
  for (const c of r.finalChecks) lines.push(`| ${ICON[c.status]} | ${c.title} | ${c.detail.replaceAll('|', '\\|')} |`);
  lines.push('');
  for (const s of r.finalShots) lines.push(`![${s.label}](${s.file})`);
  lines.push('');

  lines.push('## Conversation', '');
  for (const t of r.turns) {
    lines.push(`### Turn ${t.n}`, '', `**Kid:** ${t.kid}`, '');
    if (t.answer.text) lines.push(quote(clip(t.answer.text, 700)), '');
    else lines.push('> *(no answer text)*', '');
    const meta = [
      toolLine(t.answer) && `Tools: ${toolLine(t.answer)}`,
      t.checks &&
        `Checks: ${checkScore(t.checks)}${
          t.checks.some((c) => c.status === 'fail')
            ? ` (failing: ${t.checks
                .filter((c) => c.status === 'fail')
                .map((c) => c.id)
                .join(', ')})`
            : ''
        }`,
      `${Math.round(t.answer.ms / 1000)} s`,
    ].filter(Boolean);
    lines.push(`*${meta.join(' · ')}*`, '');
    if (t.answer.error) lines.push(`⚠ Chat error: ${t.answer.error}`, '');
    if (t.undone) lines.push('↩ The tester undid this answer („Rückgängig“).', '');
    if (t.shot) lines.push(`<img src="${t.shot}" width="240" alt="stage after turn ${t.n}">`, '');
  }
  fs.writeFileSync(path.join(dir, 'report.md'), `${lines.join('\n')}\n`);
};

/** One table over all runs of an invocation. */
export const writeSummary = (dir: string, records: { dir: string; record: RunRecord }[]): string => {
  const lines = [
    '# Game harness summary',
    '',
    '| Game | Variant | Run | Checks | All green after | Turns | End | Teaching | Cost (app / total) | Report |',
    '|---|---|---|---|---|---|---|---|---|---|',
  ];
  for (const { dir: runDir, record: r } of records) {
    const total = r.cost.app + r.cost.kid + r.cost.judge;
    const report = fs.existsSync(path.join(runDir, 'report.md'))
      ? `[report](${path.relative(dir, runDir)}/report.md)`
      : '';
    lines.push(
      `| ${r.gameTitle} | ${variantLabel(r.variant)} | ${r.rep} | ${checkScore(r.finalChecks)} | ${r.firstGreenTurn ?? '–'} | ${r.turns.length} | ${r.endReason} | ${r.verdict ? `${r.verdict.teaching}/5` : '–'} | ${usd(r.cost.app)} / ${usd(total)} | ${report} |`,
    );
  }
  const text = `${lines.join('\n')}\n`;
  fs.writeFileSync(path.join(dir, 'summary.md'), text);
  return text;
};

export const allGreen = (checks: CheckResult[]) =>
  checks.length > 0 && scored(checks) === checks.length && passed(checks) === checks.length;

/** The conversation as the judge reads it. */
export const transcript = (r: RunRecord, brief?: string): string =>
  [
    brief ? `Game the kid wanted:\n${brief}` : '',
    ...r.turns.map((t) =>
      [
        `--- Turn ${t.n}`,
        `Kid: ${t.kid}`,
        `Assistant: ${t.answer.text || '(no text)'}`,
        t.answer.tools.length
          ? `Tools: ${t.answer.tools.map((x) => `${x.name}${x.ok ? '' : ` FAILED: ${x.error ?? ''}`}`).join('; ')}`
          : '',
        t.answer.error ? `Chat error shown: ${t.answer.error}` : '',
        t.checks ? `Test results after this turn: ${t.checks.map((c) => `${c.title}: ${c.status}`).join('; ')}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    ),
    r.finalChecks.length
      ? `--- Final test results:\n${r.finalChecks.map((c) => `${c.title}: ${c.status} (${c.detail})`).join('\n')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n');
