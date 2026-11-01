// Access with a code (X-Access-Code on every /api call except the Locker's): a code an adult created in the office,
// looked up in the budget snapshot (budget.ts), or a test code from TEST_CODES (dev, tests, the game harness). The
// routes that call the model also check the code's budgets (docs/budgets.md) and pick who pays: the pool, the
// owner's own OpenRouter key, or the test codes' key.
import { type CodeGrant, normalizeCode, type Refusal } from '@ai-scratch/db';
import type { Context, MiddlewareHandler } from 'hono';
import type { AccessInfo } from '../shared/access.ts';
import { ACCESS_CODE_HEADER } from '../shared/chat-types.ts';
import type { Budget } from './budget.ts';
import type { Stats } from './stats.ts';

export type Access = { kind: 'test'; code: string } | { kind: 'code'; grant: CodeGrant };

/** who pays for the request's model calls */
export type Route = { kind: 'test' } | { kind: 'pool'; entryId: string } | { kind: 'openrouter' };

export interface AppEnv {
  Variables: { access: Access; route: Route };
}

/** why an own OpenRouter key's call was refused by OpenRouter */
export type KeyProblem = 'empty' | 'invalid';

export const WRONG_CODE = 'Falscher Zugangscode';
export const UNAVAILABLE = 'Die KI ist gerade nicht erreichbar. Versuch es in einer Minute nochmal.';
/** Anthropic refused the pool entry just used: the next request takes the next one */
export const TRY_AGAIN = 'Das hat gerade nicht geklappt. Versuch es gleich nochmal.';
export const ASK_OFF = 'Für diesen Code ist der Block „frage KI“ ausgeschaltet.';
const ASK_ADULTS = 'Frag die Erwachsenen, die dir den Code gegeben haben.';

type Refused = { status: 402 | 403 | 503; error: string };

/** For the kid: the chat, the gate and the "frage KI" block show these. */
const REFUSED: Record<Exclude<Refusal, 'not-yet'> | `key-${KeyProblem}`, Refused> = {
  expired: { status: 403, error: `Dein Code ist abgelaufen. ${ASK_ADULTS}` },
  'code-budget': { status: 402, error: `Das KI-Guthaben dieses Codes ist aufgebraucht. ${ASK_ADULTS}` },
  'free-withdrawn': { status: 403, error: `Das KI-Guthaben für diesen Code ist gerade nicht verfügbar. ${ASK_ADULTS}` },
  'account-budget': { status: 402, error: `Das KI-Guthaben für diesen Code ist gerade nicht verfügbar. ${ASK_ADULTS}` },
  'total-budget': { status: 402, error: `Das KI-Guthaben für diesen Code ist gerade nicht verfügbar. ${ASK_ADULTS}` },
  'no-pool-entry': {
    status: 503,
    error: 'Die KI hat gerade kein Guthaben mehr. Die Erwachsenen von AI-Scratch kümmern sich darum.',
  },
  unavailable: { status: 503, error: UNAVAILABLE },
  'key-empty': { status: 402, error: `Das KI-Guthaben ist aufgebraucht. ${ASK_ADULTS}` },
  'key-invalid': { status: 403, error: `Der OpenRouter-Schlüssel hinter diesem Code gilt nicht mehr. ${ASK_ADULTS}` },
};

const viennaTime = new Intl.DateTimeFormat('de-AT', { timeZone: 'Europe/Vienna', hour: '2-digit', minute: '2-digit' });
const viennaDay = new Intl.DateTimeFormat('de-AT', { timeZone: 'Europe/Vienna', day: 'numeric', month: 'numeric' });

/** "ab 10:00 Uhr" today, "am 12.11. ab 10:00 Uhr" on another day */
export const notYetText = (startsAt: Date, now: Date): string => {
  const day = viennaDay.format(startsAt);
  const when = day === viennaDay.format(now) ? '' : `am ${day} `;
  return `Dein Code gilt erst ${when}ab ${viennaTime.format(startsAt)} Uhr.`;
};

export const refusedFor = (refusal: Refusal | `key-${KeyProblem}`, grant: CodeGrant, now: Date): Refused =>
  refusal === 'not-yet' ? { status: 403, error: notYetText(grant.startsAt, now) } : REFUSED[refusal];

/** Own keys OpenRouter refused: refused here for a minute instead of costing the kid a heart and a screening each try. */
export const createRefusedKeys = (ms = 60_000) => {
  const refused = new Map<string, { problem: KeyProblem; until: number }>();
  return {
    get: (keyId: string): KeyProblem | undefined => {
      const entry = refused.get(keyId);
      return entry && Date.now() < entry.until ? entry.problem : undefined;
    },
    set: (keyId: string, problem: KeyProblem) => {
      if (refused.size > 10_000) refused.clear();
      refused.set(keyId, { problem, until: Date.now() + ms });
    },
  };
};
export type RefusedKeys = ReturnType<typeof createRefusedKeys>;

/** Every /api route but the Locker's: a known code. A deleted or unknown code answers 401 (back to the gate). */
export const requireCode =
  (testCodes: ReadonlySet<string>, budget: Budget | undefined, stats: Stats): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    const code = normalizeCode(c.req.header(ACCESS_CODE_HEADER) ?? '');
    if (code && testCodes.has(code)) {
      c.set('access', { kind: 'test', code });
      return next();
    }
    let grant: CodeGrant | undefined;
    if (code && budget) {
      try {
        grant = await budget.find(code);
      } catch (error) {
        console.error('access: looking up a code failed', error);
        return c.json({ error: UNAVAILABLE, reason: 'unavailable' }, 503);
      }
    }
    if (!grant) {
      // guessing codes shows here and in /api/stats; the code itself is never logged
      stats.wrongCodes += 1;
      if (code) console.warn('access: unknown code');
      return c.json({ error: WRONG_CODE, reason: 'unknown' }, 401);
    }
    c.set('access', { kind: 'code', grant });
    await next();
  };

/** The routes that call the model, and the gate's check: the code's budgets, then who pays. */
export const requireBudget =
  (budget: Budget | undefined, refusedKeys: RefusedKeys): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    const access = c.get('access');
    if (access.kind === 'test' || !budget) {
      c.set('route', { kind: 'test' });
      return next();
    }
    const { grant } = access;
    const now = new Date();
    const refuse = (refusal: Refusal | `key-${KeyProblem}`) => {
      const { status, error } = refusedFor(refusal, grant, now);
      return c.json({ error, reason: refusal }, status);
    };
    const refusal = budget.refusal(grant, now);
    if (refusal) return refuse(refusal);
    if (grant.source === 'openrouter') {
      const problem = grant.openrouterKeyId ? refusedKeys.get(grant.openrouterKeyId) : undefined;
      if (problem) return refuse(`key-${problem}`);
      c.set('route', { kind: 'openrouter' });
    } else {
      const entry = budget.entry();
      if (!entry) return refuse('no-pool-entry');
      c.set('route', { kind: 'pool', entryId: entry.id });
    }
    await next();
  };

/** GET /api/access, the gate's check: what the chat shows of the code */
export const accessInfo = (c: Context<AppEnv>) => {
  const access = c.get('access');
  const info: AccessInfo =
    access.kind === 'test'
      ? { endsAt: null, ask: true }
      : { endsAt: access.grant.endsAt.toISOString(), ask: access.grant.askEnabled };
  return c.json(info);
};

/** /api/stats: only with a test code */
export const testOnly: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (c.get('access').kind !== 'test') return c.json({ error: 'Nicht erlaubt' }, 403);
  await next();
};

/** the code as it goes into log records and keys the hearts without a session */
export const accessCodeOf = (c: Context<AppEnv>): string => {
  const access = c.get('access');
  return access.kind === 'test' ? access.code : access.grant.code;
};
