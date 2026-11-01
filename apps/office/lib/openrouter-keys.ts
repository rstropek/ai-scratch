// Adults' own OpenRouter keys (docs/platform-plan.md, "Own OpenRouter keys"): added once, stored sealed like the
// pool's keys, used by the kids' app for the codes created from them. Adding only checks that OpenRouter knows the
// key; what it has left (`limit_remaining`) matters when a code is created (codes.ts). A factory-free module over its
// dependencies, so tests run it on PGlite with a fake OpenRouter.
import { randomUUID } from 'node:crypto';
import { type Database, type KeyBox, schema } from '@ai-scratch/db';
import { and, asc, eq } from 'drizzle-orm';
import { keyHint } from './anthropic-keys.ts';
import type { FieldErrors } from './registration.ts';
import { OPENROUTER_LABEL_MAX } from './rules.ts';
import { texts } from './texts.ts';

const { openrouterKey, accessCode } = schema;

/** what OpenRouter said about a key; `limitRemaining` null: the key has no limit */
export type KeyStatus = { ok: true; limitRemaining: number | null } | { ok: false; reason: 'invalid' | 'unreachable' };

export type KeyReader = (key: string, options?: { timeoutMs?: number }) => Promise<KeyStatus>;

/** how long the list waits for OpenRouter per key before it says "nicht erreichbar" */
export const LIST_TIMEOUT_MS = 3000;
const DEFAULT_TIMEOUT_MS = 10_000;

/** `GET {baseURL}/key` with the key as Bearer: 401/403 → unknown key, anything else that isn't 200 → not reachable */
export const createOpenRouterKeyReader =
  ({ baseURL, fetch = globalThis.fetch }: { baseURL: string; fetch?: typeof globalThis.fetch }): KeyReader =>
  async (key, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) => {
    try {
      const res = await fetch(`${baseURL}/key`, {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.status === 401 || res.status === 403) return { ok: false, reason: 'invalid' };
      if (!res.ok) return { ok: false, reason: 'unreachable' };
      const body = (await res.json()) as { data?: { limit_remaining?: unknown } };
      const remaining = body.data?.limit_remaining;
      if (remaining === null || remaining === undefined) return { ok: true, limitRemaining: null };
      return typeof remaining === 'number'
        ? { ok: true, limitRemaining: remaining }
        : { ok: false, reason: 'unreachable' };
    } catch {
      return { ok: false, reason: 'unreachable' };
    }
  };

export interface OpenRouterDeps {
  db: Database;
  box: KeyBox;
  readKey: KeyReader;
}

export type OpenRouterKeyField = 'label' | 'key';

export interface OpenRouterKeyInput {
  label: string;
  key: string;
}

const KEY_PATTERN = /^sk-or-[A-Za-z0-9_-]{10,300}$/;

export const validateOpenRouterKey = (
  input: OpenRouterKeyInput,
): { ok: true; value: OpenRouterKeyInput } | { ok: false; fieldErrors: FieldErrors<OpenRouterKeyField> } => {
  const v = texts.openrouterKeys.validation;
  const fieldErrors: FieldErrors<OpenRouterKeyField> = {};
  const label = input.label.trim();
  if (!label || label.length > OPENROUTER_LABEL_MAX) fieldErrors.label = v.label(OPENROUTER_LABEL_MAX);
  const key = input.key.trim();
  if (!KEY_PATTERN.test(key)) fieldErrors.key = v.key;
  return Object.keys(fieldErrors).length > 0 ? { ok: false, fieldErrors } : { ok: true, value: { label, key } };
};

export type AddKeyResult =
  | { ok: true; id: string }
  | { ok: false; fieldErrors: FieldErrors<OpenRouterKeyField> }
  | { ok: false; check: 'invalid' | 'unreachable' };

const duplicateError = { ok: false, fieldErrors: { key: texts.openrouterKeys.validation.duplicate } } as const;

/** another save of the same key won the race while OpenRouter was answering: the unique index refuses this one */
const isDuplicateRace = (error: unknown) => {
  const cause = error instanceof Error ? (error.cause ?? error) : error;
  return (
    typeof cause === 'object' &&
    cause !== null &&
    'code' in cause &&
    cause.code === '23505' &&
    'constraint' in cause &&
    cause.constraint === 'openrouter_key_owner_fingerprint_idx'
  );
};

export const addOpenRouterKey = async (
  deps: OpenRouterDeps,
  ownerId: string,
  input: OpenRouterKeyInput,
): Promise<AddKeyResult> => {
  const valid = validateOpenRouterKey(input);
  if (!valid.ok) return valid;
  const { label, key } = valid.value;
  const fingerprint = deps.box.fingerprint(key);
  const [existing] = await deps.db
    .select({ id: openrouterKey.id })
    .from(openrouterKey)
    .where(and(eq(openrouterKey.ownerId, ownerId), eq(openrouterKey.keyFingerprint, fingerprint)));
  if (existing) return duplicateError;
  const status = await deps.readKey(key);
  if (!status.ok) return { ok: false, check: status.reason };
  const id = randomUUID();
  try {
    await deps.db.insert(openrouterKey).values({
      id,
      ownerId,
      label,
      keySealed: deps.box.seal(id, key),
      keyFingerprint: fingerprint,
      keyHint: keyHint(key),
    });
  } catch (error) {
    if (isDuplicateRace(error)) return duplicateError;
    throw error;
  }
  return { ok: true, id };
};

export interface OpenRouterKeyRow {
  id: string;
  label: string;
  keyHint: string;
  createdAt: Date;
  /** the codes created from it (lowercase), which go when it is deleted */
  codes: string[];
}

/** the owner's keys, oldest first, each with its codes */
export const listOpenRouterKeys = async (db: Database, ownerId: string): Promise<OpenRouterKeyRow[]> => {
  const rows = await db
    .select({
      id: openrouterKey.id,
      label: openrouterKey.label,
      keyHint: openrouterKey.keyHint,
      createdAt: openrouterKey.createdAt,
      code: accessCode.code,
    })
    .from(openrouterKey)
    .leftJoin(accessCode, eq(accessCode.openrouterKeyId, openrouterKey.id))
    .where(eq(openrouterKey.ownerId, ownerId))
    .orderBy(asc(openrouterKey.createdAt), asc(openrouterKey.id), asc(accessCode.startsAt));
  const keys = new Map<string, OpenRouterKeyRow>();
  for (const { code, ...key } of rows) {
    const row = keys.get(key.id) ?? { ...key, codes: [] };
    if (code) row.codes.push(code);
    keys.set(key.id, row);
  }
  return [...keys.values()];
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** the owner's key in the clear, for a call to OpenRouter; undefined when it isn't theirs or doesn't exist */
export const openOpenRouterKey = async (
  deps: Pick<OpenRouterDeps, 'db' | 'box'>,
  ownerId: string,
  id: string,
): Promise<string | undefined> => {
  if (!UUID_PATTERN.test(id)) return undefined;
  const [row] = await deps.db
    .select({ keySealed: openrouterKey.keySealed })
    .from(openrouterKey)
    .where(and(eq(openrouterKey.id, id), eq(openrouterKey.ownerId, ownerId)));
  return row && deps.box.open(id, row.keySealed);
};

/** what each key has left at OpenRouter, asked in parallel while the page loads; a slow answer counts as unreachable */
export const readRemaining = async (
  deps: OpenRouterDeps,
  ownerId: string,
  keys: readonly { id: string }[],
): Promise<Map<string, KeyStatus>> => {
  const answers = await Promise.all(
    keys.map(async ({ id }): Promise<[string, KeyStatus]> => {
      const key = await openOpenRouterKey(deps, ownerId, id);
      if (!key) return [id, { ok: false, reason: 'invalid' }];
      return [id, await deps.readKey(key, { timeoutMs: LIST_TIMEOUT_MS })];
    }),
  );
  return new Map(answers);
};

/** deletes the owner's key and, by the foreign key, every code created from it */
export const deleteOpenRouterKey = async (db: Database, ownerId: string, id: string): Promise<boolean> => {
  if (!UUID_PATTERN.test(id)) return false;
  const deleted = await db
    .delete(openrouterKey)
    .where(and(eq(openrouterKey.id, id), eq(openrouterKey.ownerId, ownerId)))
    .returning({ id: openrouterKey.id });
  return deleted.length > 0;
};

/** a key's remaining budget as the pages show it */
export const remainingText = (status: KeyStatus | undefined): string => {
  const r = texts.remaining;
  if (!status?.ok) return status?.reason === 'invalid' ? r.invalid : r.unreachable;
  return status.limitRemaining === null ? r.noLimit : r.usd(status.limitRemaining);
};
