// Access check, sent by the client on every /api call (X-Access-Code): a school's code, or a parent's own
// OpenRouter key (told apart by its prefix, src/shared/access.ts). A key is checked with OpenRouter: it must
// be valid for every route, and for the routes that call the model also have a spending limit and money
// left. The key is never stored, logged or put into a log record.
import crypto from 'node:crypto';
import type { Context, MiddlewareHandler } from 'hono';
import { isOpenRouterKey, type KeyProblem, normalizeCode } from '../shared/access.ts';
import { ACCESS_CODE_HEADER } from '../shared/chat-types.ts';

export type Credential = { kind: 'school'; code: string } | { kind: 'openrouter'; key: string };

export const credentialOf = (c: Context): Credential => {
  const raw = c.req.header(ACCESS_CODE_HEADER) ?? '';
  return isOpenRouterKey(raw) ? { kind: 'openrouter', key: raw.trim() } : { kind: 'school', code: normalizeCode(raw) };
};

/** stands in for a key wherever the access code is recorded (log records, hearts): never the key itself */
export const OPENROUTER_LABEL = 'openrouter';

/** The request's access code, normalized like the configured ones; OPENROUTER_LABEL for a key. */
export const accessCodeOf = (c: Context): string => {
  const credential = credentialOf(c);
  return credential.kind === 'school' ? credential.code : OPENROUTER_LABEL;
};

export const BUDGET_EMPTY = 'Das KI-Guthaben ist aufgebraucht. Frag deine Eltern, ob sie es bei OpenRouter aufladen.';

/**
 * For the kid: what the chat and the "frage KI" block show when a key stops working mid-session. The gate
 * shows its own texts, for the parents (App.tsx), and only reads the reason.
 */
const KEY_REFUSED: Record<KeyProblem, { status: 401 | 402 | 403 | 503; error: string }> = {
  unknown: { status: 401, error: 'Falscher Zugangscode' },
  'no-limit': {
    status: 403,
    error: 'Dieser OpenRouter-Schlüssel hat kein Ausgabelimit. Bitte deine Eltern, eines einzustellen.',
  },
  empty: { status: 402, error: BUDGET_EMPTY },
  down: { status: 503, error: 'OpenRouter antwortet gerade nicht. Versuch es in einer Minute nochmal.' },
};

/** A key that passed is not asked about again for this long. */
const KEY_OK_MS = 5 * 60_000;
/** A refusal from GET /key stands this long, so the two checks of one request ask only once. */
const KEY_REFUSED_MS = 15_000;
/** A refusal by a model call stands this long: GET /key may still pass a key whose calls fail (a balance too small for a turn), and each try would cost a heart and a screening. */
const MODEL_REFUSED_MS = 60_000;
const KEY_CHECK_TIMEOUT_MS = 5_000;
/** less than this left (dollars) counts as empty: not enough for a long turn */
const MIN_DOLLARS = 0.05;

export interface KeyChecker {
  check(key: string): Promise<KeyProblem | undefined>;
  /** a model call refused the key: refuse it here too for a while instead of asking OpenRouter */
  refuse(key: string, problem: KeyProblem): void;
}

const keyId = (key: string) => crypto.createHash('sha256').update(key).digest('hex');

/**
 * Checks a key with OpenRouter: GET /key for its limit and what is left of it, GET /credits for the
 * account's balance (both in dollars). A key without a limit is refused: parents promise a budget-limited
 * key in the terms, and this keeps them to it.
 */
export const createKeyChecker = (openRouterUrl: string, baseFetch: typeof fetch = fetch): KeyChecker => {
  /** sha256 of the key → the last answer, until when it stands */
  const known = new Map<string, { problem: KeyProblem | undefined; until: number }>();
  const remember = (key: string, problem: KeyProblem | undefined, ms: number) => {
    if (known.size > 10_000) known.clear();
    known.set(keyId(key), { problem, until: Date.now() + ms });
  };
  const get = (key: string, path: string) =>
    baseFetch(`${openRouterUrl}${path}`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(KEY_CHECK_TIMEOUT_MS),
    });
  const dataOf = async <T>(res: Response) =>
    ((await res.json().catch(() => undefined)) as { data?: T } | undefined)?.data;

  const ask = async (key: string): Promise<KeyProblem | undefined> => {
    let res: Response;
    let credits: Response | undefined;
    try {
      [res, credits] = await Promise.all([get(key, '/key'), get(key, '/credits').catch(() => undefined)]);
    } catch {
      return 'down';
    }
    if (res.status === 401 || res.status === 403) return 'unknown';
    if (!res.ok) return 'down';
    const data = await dataOf<{ limit?: number | null; limit_remaining?: number | null }>(res);
    if (!data) return 'down';
    if (data.limit === null || data.limit === undefined) return 'no-limit';
    if ((data.limit_remaining ?? 0) < MIN_DOLLARS) return 'empty';
    // the balance is a second line of defence (a model call that fails with 402 is refused too), so a failed
    // or odd answer from /credits doesn't lock anyone out
    const account = credits?.ok ? await dataOf<{ total_credits?: number; total_usage?: number }>(credits) : undefined;
    if (
      typeof account?.total_credits === 'number' &&
      typeof account.total_usage === 'number' &&
      account.total_credits - account.total_usage < MIN_DOLLARS
    )
      return 'empty';
    return undefined;
  };

  const check = async (key: string): Promise<KeyProblem | undefined> => {
    const last = known.get(keyId(key));
    if (last && Date.now() < last.until) return last.problem;
    const problem = await ask(key);
    remember(key, problem, problem ? KEY_REFUSED_MS : KEY_OK_MS);
    return problem;
  };
  return { check, refuse: (key, problem) => remember(key, problem, MODEL_REFUSED_MS) };
};

/**
 * Every /api route: a school's code, or a key OpenRouter knows. A key's budget is not checked here, so the
 * Locker still saves a game when the money is used up or OpenRouter is down. `codes` are normalized
 * (config.ts).
 */
export const requireAccess =
  (codes: ReadonlySet<string>, keys: KeyChecker): MiddlewareHandler =>
  async (c, next) => {
    const credential = credentialOf(c);
    if (credential.kind === 'school' && !codes.has(credential.code))
      return c.json({ error: KEY_REFUSED.unknown.error }, 401);
    if (credential.kind === 'openrouter' && (await keys.check(credential.key)) === 'unknown')
      return c.json({ error: KEY_REFUSED.unknown.error, reason: 'unknown' }, 401);
    await next();
  };

/** The routes that call the model, and the gate's check: a key also needs a limit and money left. */
export const requireBudget =
  (keys: KeyChecker): MiddlewareHandler =>
  async (c, next) => {
    const credential = credentialOf(c);
    const problem = credential.kind === 'openrouter' ? await keys.check(credential.key) : undefined;
    if (problem) {
      const { status, error } = KEY_REFUSED[problem];
      return c.json({ error, reason: problem }, status);
    }
    await next();
  };

/** /api/stats: for school codes, not for anyone who makes an OpenRouter key */
export const schoolOnly: MiddlewareHandler = async (c, next) => {
  if (credentialOf(c).kind !== 'school') return c.json({ error: 'Nicht erlaubt' }, 403);
  await next();
};
