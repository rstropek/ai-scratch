// Access codes (docs/platform-plan.md, "Access codes" and iteration 3): adults create them from the free budget or one
// of their own OpenRouter keys, kids type them into the kids' app, which reads them from the database. The code is
// generated, never chosen. Creating one checks only who may draw on which source; money is checked on every call by
// the kids' app (docs/budgets.md). A factory-free module over its dependencies, so tests run it on PGlite.
import {
  CODE_WORDS,
  codeSpend,
  type Database,
  generateCode,
  loadPrice,
  monthRange,
  schema,
  viennaMonth,
} from '@ai-scratch/db';
import { CODE_COMMENT_MAX, CODE_START_MAX_DAYS, type Limits, OWN_KEY_MAX_REMAINING_USD } from '@ai-scratch/db/limits';
import { and, count, desc, eq, gt, gte, isNotNull, lt, lte, type SQL, sql } from 'drizzle-orm';
import { type OpenRouterDeps, openOpenRouterKey } from './openrouter-keys.ts';
import type { FieldErrors } from './registration.ts';
import { texts } from './texts.ts';

const { accessCode, adultProfile, openrouterKey, user } = schema;

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

export interface CodeDeps extends OpenRouterDeps {
  limits: Limits;
  /** the clock; tests set it */
  now?: () => Date;
}

/** who creates or deletes a code: admins use the free budget without it being switched on, and delete any code */
export interface CodeOwner {
  id: string;
  admin: boolean;
}

export type CodeField = 'source' | 'startsAt' | 'hours' | 'comment';

export interface CodeInput {
  /** the proposal the form showed, lowercase */
  code: string;
  /** `free`, or the id of one of the owner's OpenRouter keys */
  source: string;
  /** a `datetime-local` value, Vienna time; empty: now */
  startsAt: string;
  hours: string;
  comment: string;
  askEnabled: boolean;
}

// --- Vienna wall time: the form's date and time field has no time zone, the office means Vienna

const wallFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Vienna',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** a moment's Vienna wall clock, read as if it were UTC */
const wallAsUtc = (date: Date): number => {
  const p = Object.fromEntries(wallFormat.formatToParts(date).map((part) => [part.type, Number(part.value)]));
  return Date.UTC(p.year as number, (p.month as number) - 1, p.day, p.hour, p.minute);
};

/** `2026-11-03T10:00` in Vienna as a moment; undefined for anything that isn't such a value */
export const fromViennaWallTime = (value: string): Date | undefined => {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return undefined;
  const [year, month, day, hour, minute] = match.slice(1).map(Number) as [number, number, number, number, number];
  const wanted = Date.UTC(year, month - 1, day, hour, minute);
  // 2026-02-31 rolls over into March: not a date
  if (new Date(wanted).toISOString().slice(0, 16) !== value) return undefined;
  // the offset at the guess, twice: the second pass settles a daylight saving switch between the two
  let guess = wanted - (wallAsUtc(new Date(wanted)) - wanted);
  guess = wanted - (wallAsUtc(new Date(guess)) - guess);
  return new Date(guess);
};

// --- validation

/** the form's choices for the duration: whole hours up to the limit */
export const durationChoices = (limits: Limits): number[] =>
  Array.from({ length: Math.max(1, Math.floor(limits.codeMaxHours)) }, (_, i) => i + 1);

const words = new Set(CODE_WORDS.map((word) => word.toLowerCase()));

/** a code as generateCode makes them: a crafted form can't bring a code of its own */
export const isGeneratedCode = (code: string): boolean => {
  const [first, second, digits, ...rest] = code.split('-');
  return (
    rest.length === 0 &&
    first !== undefined &&
    second !== undefined &&
    first !== second &&
    words.has(first) &&
    words.has(second) &&
    /^\d{2}$/.test(digits ?? '')
  );
};

/** a minute's slack: the form's start field has minutes only, and the page may have been open for a moment */
const START_SLACK_MS = 60_000;

interface ValidCode {
  source: 'free' | { keyId: string };
  startsAt: Date;
  endsAt: Date;
  comment: string;
  askEnabled: boolean;
}

export const validateCode = (
  input: CodeInput,
  limits: Limits,
  now: Date,
): { ok: true; value: ValidCode } | { ok: false; fieldErrors: FieldErrors<CodeField> } => {
  const v = texts.codes.validation;
  const fieldErrors: FieldErrors<CodeField> = {};
  const source = input.source.trim();
  if (!source) fieldErrors.source = v.source;
  const rawStart = input.startsAt.trim();
  const startsAt = rawStart ? fromViennaWallTime(rawStart) : now;
  if (!startsAt) fieldErrors.startsAt = v.startsAt;
  else if (startsAt.getTime() < now.getTime() - START_SLACK_MS) fieldErrors.startsAt = v.startsAtPast;
  else if (startsAt.getTime() > now.getTime() + CODE_START_MAX_DAYS * 86_400_000)
    fieldErrors.startsAt = v.startsAtFar(CODE_START_MAX_DAYS);
  const hours = Number(input.hours.trim());
  if (!durationChoices(limits).includes(hours)) fieldErrors.hours = v.hours(limits.codeMaxHours);
  const comment = input.comment.trim();
  if (comment.length > CODE_COMMENT_MAX) fieldErrors.comment = v.comment(CODE_COMMENT_MAX);
  if (Object.keys(fieldErrors).length > 0 || !startsAt) return { ok: false, fieldErrors };
  return {
    ok: true,
    value: {
      source: source === 'free' ? 'free' : { keyId: source },
      startsAt,
      endsAt: new Date(startsAt.getTime() + hours * 3_600_000),
      comment,
      askEnabled: input.askEnabled,
    },
  };
};

// --- creating

/** why a code isn't created; `taken`: the proposal is in use (or isn't one), with a fresh one */
export type CodeRefusal =
  | { reason: 'no-free-budget' }
  | { reason: 'free-codes-used'; limit: number }
  | { reason: 'key-invalid' }
  | { reason: 'key-unreachable' }
  | { reason: 'key-no-limit' }
  | { reason: 'key-too-much'; remaining: number }
  | { reason: 'taken'; proposal: string };

export type CreateCodeResult =
  | { ok: true; id: string; code: string }
  | { ok: false; fieldErrors: FieldErrors<CodeField> }
  | { ok: false; refusal: CodeRefusal };

const refuse = (refusal: CodeRefusal) => ({ ok: false, refusal }) as const;

/** free-budget codes the owner created this Vienna month that still exist: deleting one gives it back */
export const freeCodesCreated = async (db: Database | Transaction, ownerId: string, now: Date): Promise<number> => {
  const { start, end } = monthRange(viennaMonth(now));
  const [row] = await db
    .select({ n: count() })
    .from(accessCode)
    .where(
      and(
        eq(accessCode.ownerId, ownerId),
        eq(accessCode.source, 'free'),
        gte(accessCode.createdAt, start),
        lt(accessCode.createdAt, end),
      ),
    );
  return row?.n ?? 0;
};

/** an admin switched the free budget on for this account */
export const hasFreeBudget = async (db: Database, ownerId: string): Promise<boolean> => {
  const [row] = await db
    .select({ userId: adultProfile.userId })
    .from(adultProfile)
    .where(and(eq(adultProfile.userId, ownerId), isNotNull(adultProfile.freeBudgetAt)));
  return row !== undefined;
};

/** an own key may back a new code only with a limit and at most this much left (checked only now, terms § 6) */
const keyRefusal = async (deps: CodeDeps, ownerId: string, keyId: string): Promise<CodeRefusal | 'unknown' | null> => {
  const key = await openOpenRouterKey(deps, ownerId, keyId);
  if (!key) return 'unknown';
  const status = await deps.readKey(key);
  if (!status.ok) return { reason: status.reason === 'invalid' ? 'key-invalid' : 'key-unreachable' };
  if (status.limitRemaining === null) return { reason: 'key-no-limit' };
  if (status.limitRemaining > OWN_KEY_MAX_REMAINING_USD)
    return { reason: 'key-too-much', remaining: status.limitRemaining };
  return null;
};

/**
 * Creates the code the form proposed. Unique among codes that haven't expired and the owner's monthly count are
 * checked in the insert's transaction, under advisory locks on the code and on the owner (always in this order, so
 * two creates never wait on each other crosswise): two tabs can neither take the same code nor both create the
 * last free one.
 */
export const createCode = async (deps: CodeDeps, owner: CodeOwner, input: CodeInput): Promise<CreateCodeResult> => {
  const now = deps.now?.() ?? new Date();
  const valid = validateCode(input, deps.limits, now);
  if (!valid.ok) return valid;
  const { source, ...window } = valid.value;
  const code = input.code.trim().toLowerCase();
  if (!isGeneratedCode(code)) return refuse({ reason: 'taken', proposal: generateCode() });
  const free = source === 'free';
  if (free) {
    if (!owner.admin && !(await hasFreeBudget(deps.db, owner.id))) return refuse({ reason: 'no-free-budget' });
  } else {
    const refusal = await keyRefusal(deps, owner.id, source.keyId);
    if (refusal === 'unknown') return { ok: false, fieldErrors: { source: texts.codes.validation.source } };
    if (refusal) return refuse(refusal);
  }
  return deps.db.transaction(async (tx): Promise<CreateCodeResult> => {
    await tx.execute(sql`select pg_advisory_xact_lock(1, hashtext(${code}))`);
    await tx.execute(sql`select pg_advisory_xact_lock(2, hashtext(${owner.id}))`);
    const [clash] = await tx
      .select({ id: accessCode.id })
      .from(accessCode)
      .where(and(eq(accessCode.code, code), sql`${accessCode.endsAt} > now()`));
    if (clash) return refuse({ reason: 'taken', proposal: generateCode() });
    if (free && !owner.admin) {
      const limit = deps.limits.freeCodesPerAccountMonth;
      if ((await freeCodesCreated(tx, owner.id, now)) >= limit) return refuse({ reason: 'free-codes-used', limit });
    }
    const [row] = await tx
      .insert(accessCode)
      .values({
        code,
        ownerId: owner.id,
        source: free ? 'free' : 'openrouter',
        openrouterKeyId: free ? null : source.keyId,
        ...window,
        createdAt: now,
      })
      .returning({ id: accessCode.id });
    if (!row) throw new Error('inserting the code returned no row');
    return { ok: true, id: row.id, code };
  });
};

// --- the lists

export type CodeState = 'planned' | 'running' | 'expired';
export const CODE_STATES: readonly CodeState[] = ['running', 'planned', 'expired'];

export const codeState = (code: { startsAt: Date; endsAt: Date }, now: Date): CodeState =>
  now < code.startsAt ? 'planned' : now < code.endsAt ? 'running' : 'expired';

const stateWhere = (state: CodeState, now: Date): SQL | undefined =>
  state === 'planned'
    ? gt(accessCode.startsAt, now)
    : state === 'running'
      ? and(lte(accessCode.startsAt, now), gt(accessCode.endsAt, now))
      : lte(accessCode.endsAt, now);

export interface CodeRow {
  id: string;
  /** lowercase, as stored: show it with displayCode */
  code: string;
  source: 'free' | 'openrouter';
  /** the own key's label and hint, for `openrouter` codes */
  key: { label: string; hint: string } | null;
  startsAt: Date;
  endsAt: Date;
  askEnabled: boolean;
  comment: string;
  owner: { id: string; name: string; email: string };
  /** dollars over all months, at the current price */
  spentUsd: number;
}

/** one owner's codes, or everyone's (admins), optionally in one state; the latest start first */
export const listCodes = async (
  db: Database,
  { ownerId, state, now = new Date() }: { ownerId?: string; state?: CodeState; now?: Date },
): Promise<CodeRow[]> => {
  const rows = await db
    .select({
      id: accessCode.id,
      code: accessCode.code,
      source: accessCode.source,
      keyLabel: openrouterKey.label,
      keyHint: openrouterKey.keyHint,
      startsAt: accessCode.startsAt,
      endsAt: accessCode.endsAt,
      askEnabled: accessCode.askEnabled,
      comment: accessCode.comment,
      ownerId: accessCode.ownerId,
      ownerName: user.name,
      ownerEmail: user.email,
    })
    .from(accessCode)
    .innerJoin(user, eq(user.id, accessCode.ownerId))
    .leftJoin(openrouterKey, eq(openrouterKey.id, accessCode.openrouterKeyId))
    .where(and(ownerId ? eq(accessCode.ownerId, ownerId) : undefined, state ? stateWhere(state, now) : undefined))
    .orderBy(desc(accessCode.startsAt), desc(accessCode.createdAt));
  const spend =
    rows.length > 0
      ? await codeSpend(
          db,
          await loadPrice(db),
          rows.map((row) => row.id),
        )
      : new Map();
  return rows.map(({ keyLabel, keyHint, ownerId: id, ownerName, ownerEmail, ...row }) => ({
    ...row,
    key: keyLabel !== null && keyHint !== null ? { label: keyLabel, hint: keyHint } : null,
    owner: { id, name: ownerName, email: ownerEmail },
    spentUsd: spend.get(row.id) ?? 0,
  }));
};

/** how many codes are in each state right now, all owners */
export const countCodes = async (db: Database, now: Date = new Date()): Promise<Record<CodeState, number>> => {
  const [row] = await db
    .select({
      planned: sql<number>`count(*) filter (where ${stateWhere('planned', now)})`.mapWith(Number),
      running: sql<number>`count(*) filter (where ${stateWhere('running', now)})`.mapWith(Number),
      expired: sql<number>`count(*) filter (where ${stateWhere('expired', now)})`.mapWith(Number),
    })
    .from(accessCode);
  return row ?? { planned: 0, running: 0, expired: 0 };
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** a real delete: the kids' app stops taking it within a minute; its usage stays counted */
export const deleteCode = async (db: Database, owner: CodeOwner, id: string): Promise<boolean> => {
  if (!UUID_PATTERN.test(id)) return false;
  const deleted = await db
    .delete(accessCode)
    .where(and(eq(accessCode.id, id), owner.admin ? undefined : eq(accessCode.ownerId, owner.id)))
    .returning({ id: accessCode.id });
  return deleted.length > 0;
};
