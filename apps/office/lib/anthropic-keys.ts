// The pool of donated Anthropic access, maintained by the admin: add, edit, pause, delete. An entry is a key or a
// federation (docs/anthropic-federation.md: no key, Anthropic trusts our Azure identity). Each is checked with
// Anthropic before it is stored; a key never leaves the server again. The kids' app reads the pool from the
// database. A factory-free module over its dependencies, so tests run it on PGlite with a fake check.
import { randomUUID } from 'node:crypto';
import { type Database, type KeyBox, schema } from '@ai-scratch/db';
import Anthropic from '@anthropic-ai/sdk';
import { oidcFederationProvider } from '@anthropic-ai/sdk/lib/credentials/oidc-federation';
import { type IdentityTokenProvider, WorkloadIdentityError } from '@anthropic-ai/sdk/lib/credentials/types';
import { and, asc, desc, eq, isNull, ne, type SQL } from 'drizzle-orm';
import type { FieldErrors } from './registration.ts';
import { DONOR_MAX, KEY_CAP_MAX_EUR, KEY_PRIORITY_MAX } from './rules.ts';
import { texts } from './texts.ts';

const { anthropicKey } = schema;

export type KeyField =
  | 'donor'
  | 'key'
  | 'organizationId'
  | 'federationRuleId'
  | 'serviceAccountId'
  | 'workspaceId'
  | 'capEurMonth'
  | 'priority';

/** the fields both kinds of entry share */
interface EntryInput {
  donor: string;
  workspaceId: string;
  capEurMonth: string;
  priority: string;
  active: boolean;
}

export interface KeyInput extends EntryInput {
  /** empty when editing: the stored key stays */
  key: string;
}

export interface FederationInput extends EntryInput {
  organizationId: string;
  federationRuleId: string;
  serviceAccountId: string;
}

interface ValidEntry {
  donor: string;
  workspaceId: string | null;
  capEurMonth: number;
  priority: number;
  active: boolean;
}

interface ValidKey<Key extends string | undefined> extends ValidEntry {
  key: Key;
}

interface ValidFederation extends ValidEntry {
  organizationId: string;
  federationRuleId: string;
  serviceAccountId: string | null;
}

/** what the check calls Claude with */
export type Credential =
  | { kind: 'key'; key: string; workspaceId: string | null }
  | {
      kind: 'federation';
      organizationId: string;
      federationRuleId: string;
      serviceAccountId: string | null;
      workspaceId: string | null;
    };

/**
 * what Anthropic said to a test call; `message` is Anthropic's own (English), for the admin. `exchange`: Anthropic
 * refused to swap our identity's token for one of its own; `identity`: this server got no token of its Azure identity.
 */
export type KeyCheck =
  | { ok: true }
  | {
      ok: false;
      reason: 'invalid' | 'forbidden' | 'rejected' | 'unreachable' | 'exchange' | 'identity';
      message?: string;
    };

export type KeyChecker = (credential: Credential) => Promise<KeyCheck>;

export interface KeyDeps {
  db: Database;
  box: KeyBox;
  check: KeyChecker;
}

const KEY_PATTERN = /^sk-ant-[A-Za-z0-9_-]{10,300}$/;
const WORKSPACE_PATTERN = /^wrkspc_[A-Za-z0-9]{10,60}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RULE_PATTERN = /^fdrl_[A-Za-z0-9]{10,60}$/;
const SERVICE_ACCOUNT_PATTERN = /^svac_[A-Za-z0-9]{10,60}$/;

const wholeNumber = (raw: string, min: number, max: number): number | undefined => {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return undefined;
  const value = Number(trimmed);
  return value >= min && value <= max ? value : undefined;
};

type Validated<Value> = { ok: true; value: Value } | { ok: false; fieldErrors: FieldErrors<KeyField> };

/** the shared fields; adds its errors to `fieldErrors`, undefined when it holds any (also the caller's) */
const validateEntry = (input: EntryInput, fieldErrors: FieldErrors<KeyField>): ValidEntry | undefined => {
  const v = texts.admin.keys.validation;
  const donor = input.donor.trim();
  if (!donor || donor.length > DONOR_MAX) fieldErrors.donor = v.donor(DONOR_MAX);
  const workspaceId = input.workspaceId.trim();
  if (workspaceId && !WORKSPACE_PATTERN.test(workspaceId)) fieldErrors.workspaceId = v.workspaceId;
  const capEurMonth = wholeNumber(input.capEurMonth, 1, KEY_CAP_MAX_EUR);
  if (capEurMonth === undefined) fieldErrors.capEurMonth = v.cap(KEY_CAP_MAX_EUR);
  const priority = wholeNumber(input.priority, 0, KEY_PRIORITY_MAX);
  if (priority === undefined) fieldErrors.priority = v.priority(KEY_PRIORITY_MAX);
  if (Object.keys(fieldErrors).length > 0 || capEurMonth === undefined || priority === undefined) return undefined;
  return { donor, workspaceId: workspaceId || null, capEurMonth, priority, active: input.active };
};

export function validateKey(input: KeyInput, options: { keyRequired: true }): Validated<ValidKey<string>>;
export function validateKey(input: KeyInput, options: { keyRequired: false }): Validated<ValidKey<string | undefined>>;
export function validateKey(
  input: KeyInput,
  { keyRequired }: { keyRequired: boolean },
): Validated<ValidKey<string | undefined>> {
  const v = texts.admin.keys.validation;
  const fieldErrors: FieldErrors<KeyField> = {};
  const key = input.key.trim();
  if (key || keyRequired) {
    if (key.startsWith('sk-ant-admin')) fieldErrors.key = v.adminKey;
    else if (!KEY_PATTERN.test(key)) fieldErrors.key = v.key;
  }
  const entry = validateEntry(input, fieldErrors);
  if (!entry) return { ok: false, fieldErrors };
  return { ok: true, value: { ...entry, key: key || undefined } };
}

export const validateFederation = (input: FederationInput): Validated<ValidFederation> => {
  const v = texts.admin.keys.validation;
  const fieldErrors: FieldErrors<KeyField> = {};
  const organizationId = input.organizationId.trim().toLowerCase();
  if (!UUID_PATTERN.test(organizationId)) fieldErrors.organizationId = v.organizationId;
  const federationRuleId = input.federationRuleId.trim();
  if (!RULE_PATTERN.test(federationRuleId)) fieldErrors.federationRuleId = v.federationRuleId;
  const serviceAccountId = input.serviceAccountId.trim();
  if (serviceAccountId && !SERVICE_ACCOUNT_PATTERN.test(serviceAccountId))
    fieldErrors.serviceAccountId = v.serviceAccountId;
  const entry = validateEntry(input, fieldErrors);
  if (!entry) return { ok: false, fieldErrors };
  return {
    ok: true,
    value: { ...entry, organizationId, federationRuleId, serviceAccountId: serviceAccountId || null },
  };
};

/** the last characters, enough to tell keys apart in the list */
export const keyHint = (key: string): string => `…${key.slice(-4)}`;

/** a federation rule's ID, shortened for the list: `fdrl_…6ogq` */
export const ruleHint = (federationRuleId: string): string => `fdrl_…${federationRuleId.slice(-4)}`;

const federationCredential = (federation: ValidFederation): Credential => ({
  kind: 'federation',
  organizationId: federation.organizationId,
  federationRuleId: federation.federationRuleId,
  serviceAccountId: federation.serviceAccountId,
  workspaceId: federation.workspaceId,
});

/** Anthropic's error text for the admin; a proxy's HTML error page shouldn't flood the form */
const MESSAGE_MAX = 300;
const shorten = (message: string) => (message.length > MESSAGE_MAX ? `${message.slice(0, MESSAGE_MAX)} …` : message);

/** the cheapest call that proves the key works and has credit: one output token from the smallest model */
const CHECK_MODEL = 'claude-haiku-5-5';

/** the identity token provider failed: no managed identity, no `az login`, or Entra refused */
class IdentityTokenError extends Error {}

const isClientError = (status: number | null | undefined) => status != null && status >= 400 && status < 500;

/**
 * Without a baseURL it is ANTHROPIC_BASE_URL (the e2e tests' fake Anthropic), else api.anthropic.com. Without an
 * `identityToken` (federation not set up on this server) every federation is refused with `identity`.
 */
export const createAnthropicKeyChecker =
  (options: { baseURL?: string; fetch?: typeof fetch; identityToken?: IdentityTokenProvider } = {}): KeyChecker =>
  async (credential) => {
    const { identityToken } = options;
    if (credential.kind === 'federation' && !identityToken) return { ok: false, reason: 'identity' };
    const baseURL = options.baseURL ?? (process.env.ANTHROPIC_BASE_URL?.trim() || 'https://api.anthropic.com');
    const fetch = options.fetch ?? globalThis.fetch;
    const common = {
      baseURL,
      fetch,
      // no retries: a 429 already proves the key, and the SDK would sleep for as long as retry-after says
      maxRetries: 0,
      timeout: 20_000,
    };
    const client =
      credential.kind === 'key'
        ? new Anthropic({
            ...common,
            apiKey: credential.key,
            defaultHeaders: credential.workspaceId ? { 'anthropic-workspace-id': credential.workspaceId } : undefined,
          })
        : new Anthropic({
            ...common,
            // exchanges the identity token for a workspace-scoped Anthropic token before the call
            credentials: oidcFederationProvider({
              identityTokenProvider: async () => {
                try {
                  return await (identityToken as IdentityTokenProvider)();
                } catch (cause) {
                  throw new IdentityTokenError('getting the identity token failed', { cause });
                }
              },
              organizationId: credential.organizationId,
              federationRuleId: credential.federationRuleId,
              serviceAccountId: credential.serviceAccountId ?? undefined,
              workspaceId: credential.workspaceId ?? undefined,
              baseURL,
              fetch,
            }),
          });
    try {
      await client.messages.create({
        model: CHECK_MODEL,
        max_tokens: 1,
        thinking: { type: 'disabled' },
        messages: [{ role: 'user', content: 'Hi' }],
      });
      return { ok: true };
    } catch (error) {
      if (error instanceof IdentityTokenError) {
        console.error('keys: no identity token for the federation', error.cause);
        return { ok: false, reason: 'identity' };
      }
      // the rule doesn't exist or doesn't match our token (Anthropic's message points to the Console's events);
      // a busy token endpoint (429) proves nothing about the rule and falls through to "not reachable"
      if (error instanceof WorkloadIdentityError && isClientError(error.statusCode) && error.statusCode !== 429)
        return { ok: false, reason: 'exchange', message: shorten(error.message) };
      if (error instanceof Anthropic.RateLimitError) return { ok: true }; // the key works, it's only busy
      if (error instanceof Anthropic.AuthenticationError)
        return credential.kind === 'key'
          ? { ok: false, reason: 'invalid' }
          : { ok: false, reason: 'exchange', message: shorten(error.message) };
      if (error instanceof Anthropic.PermissionDeniedError)
        return { ok: false, reason: 'forbidden', message: shorten(error.message) };
      // a wrong or missing workspace, no credit left (400, 402), a model the key may not use: any other 4xx
      if (error instanceof Anthropic.APIError && isClientError(error.status))
        return { ok: false, reason: 'rejected', message: shorten(error.message) };
      console.error('keys: checking an entry with Anthropic failed', error);
      return { ok: false, reason: 'unreachable' };
    }
  };

export interface KeyRow {
  id: string;
  kind: 'key' | 'federation';
  donor: string;
  /** keys only */
  keyHint: string | null;
  /** federations only, like the rule ID */
  organizationId: string | null;
  federationRuleId: string | null;
  serviceAccountId: string | null;
  workspaceId: string | null;
  capEurMonth: number;
  priority: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const rowColumns = {
  id: anthropicKey.id,
  kind: anthropicKey.kind,
  donor: anthropicKey.donor,
  keyHint: anthropicKey.keyHint,
  organizationId: anthropicKey.organizationId,
  federationRuleId: anthropicKey.federationRuleId,
  serviceAccountId: anthropicKey.serviceAccountId,
  workspaceId: anthropicKey.workspaceId,
  capEurMonth: anthropicKey.capEurMonth,
  priority: anthropicKey.priority,
  active: anthropicKey.active,
  createdAt: anthropicKey.createdAt,
  updatedAt: anthropicKey.updatedAt,
};

/** how the admin tells entries apart: the key's last characters, or the shortened rule ID */
export const entryHint = (row: Pick<KeyRow, 'keyHint' | 'federationRuleId'>): string =>
  row.federationRuleId ? ruleHint(row.federationRuleId) : (row.keyHint ?? '');

/** in the order the pool uses them: active first, then highest priority, then oldest */
export const listKeys = (db: Database): Promise<KeyRow[]> =>
  db
    .select(rowColumns)
    .from(anthropicKey)
    .orderBy(desc(anthropicKey.active), desc(anthropicKey.priority), asc(anthropicKey.createdAt));

// a malformed id in the URL would make Postgres throw on the uuid column
const isUuid = (id: string) => UUID_PATTERN.test(id);

export const getKey = async (db: Database, id: string): Promise<KeyRow | undefined> => {
  if (!isUuid(id)) return undefined;
  const [row] = await db.select(rowColumns).from(anthropicKey).where(eq(anthropicKey.id, id));
  return row;
};

export type SaveResult =
  | { ok: true; id: string }
  | { ok: false; fieldErrors: FieldErrors<KeyField> }
  | { ok: false; check: Exclude<KeyCheck, { ok: true }> }
  | { ok: false; notFound: true };

const isDuplicate = async (db: Database, fingerprint: string, exceptId?: string) => {
  const [row] = await db
    .select({ id: anthropicKey.id })
    .from(anthropicKey)
    .where(eq(anthropicKey.keyFingerprint, fingerprint));
  return row !== undefined && row.id !== exceptId;
};

/** the same rule for the same workspace (both empty counts as the same) */
const isFederationDuplicate = async (db: Database, federation: ValidFederation, exceptId?: string) => {
  const conditions: SQL[] = [
    eq(anthropicKey.kind, 'federation'),
    eq(anthropicKey.federationRuleId, federation.federationRuleId),
    federation.workspaceId ? eq(anthropicKey.workspaceId, federation.workspaceId) : isNull(anthropicKey.workspaceId),
  ];
  if (exceptId) conditions.push(ne(anthropicKey.id, exceptId));
  const [row] = await db
    .select({ id: anthropicKey.id })
    .from(anthropicKey)
    .where(and(...conditions));
  return row !== undefined;
};

const duplicateError = { ok: false, fieldErrors: { key: texts.admin.keys.validation.duplicate } } as const;
const federationDuplicateError = {
  ok: false,
  fieldErrors: { federationRuleId: texts.admin.keys.validation.federationDuplicate },
} as const;

/** each unique index, and the answer when another save won the race to it while Anthropic was checking this one */
const raceAnswers: Record<string, typeof duplicateError | typeof federationDuplicateError> = {
  anthropic_key_fingerprint_idx: duplicateError,
  anthropic_key_federation_idx: federationDuplicateError,
};

const refuseDuplicateRace = (error: unknown) => {
  const cause = error instanceof Error ? (error.cause ?? error) : error;
  if (
    typeof cause === 'object' &&
    cause !== null &&
    'code' in cause &&
    cause.code === '23505' &&
    'constraint' in cause &&
    typeof cause.constraint === 'string' &&
    Object.hasOwn(raceAnswers, cause.constraint)
  )
    return raceAnswers[cause.constraint] as typeof duplicateError | typeof federationDuplicateError;
  throw error;
};

export const addKey = async (deps: KeyDeps, adminId: string, input: KeyInput): Promise<SaveResult> => {
  const valid = validateKey(input, { keyRequired: true });
  if (!valid.ok) return valid;
  const { key, ...rest } = valid.value;
  const fingerprint = deps.box.fingerprint(key);
  if (await isDuplicate(deps.db, fingerprint)) return duplicateError;
  const check = await deps.check({ kind: 'key', key, workspaceId: rest.workspaceId });
  if (!check.ok) return { ok: false, check };
  const id = randomUUID();
  try {
    await deps.db.insert(anthropicKey).values({
      id,
      kind: 'key',
      ...rest,
      keySealed: deps.box.seal(id, key),
      keyFingerprint: fingerprint,
      keyHint: keyHint(key),
      createdBy: adminId,
      updatedBy: adminId,
    });
  } catch (error) {
    return refuseDuplicateRace(error);
  }
  return { ok: true, id };
};

/**
 * Saves the admin's changes. A new key, or a new workspace for the stored one, is checked with Anthropic first;
 * the other fields (donor, cap, priority, pausing) never need a check.
 */
export const updateKey = async (deps: KeyDeps, adminId: string, id: string, input: KeyInput): Promise<SaveResult> => {
  const valid = validateKey(input, { keyRequired: false });
  if (!valid.ok) return valid;
  const { key, ...rest } = valid.value;
  if (!isUuid(id)) return { ok: false, notFound: true };
  const [stored] = await deps.db
    .select({ keySealed: anthropicKey.keySealed, workspaceId: anthropicKey.workspaceId })
    .from(anthropicKey)
    .where(and(eq(anthropicKey.id, id), eq(anthropicKey.kind, 'key')));
  if (!stored?.keySealed) return { ok: false, notFound: true };
  const replacement = key ? { key, fingerprint: deps.box.fingerprint(key) } : undefined;
  if (replacement && (await isDuplicate(deps.db, replacement.fingerprint, id))) return duplicateError;
  if (replacement || rest.workspaceId !== stored.workspaceId) {
    const check = await deps.check({
      kind: 'key',
      key: replacement?.key ?? deps.box.open(id, stored.keySealed),
      workspaceId: rest.workspaceId,
    });
    if (!check.ok) return { ok: false, check };
  }
  let updated: { id: string }[];
  try {
    updated = await deps.db
      .update(anthropicKey)
      .set({
        ...rest,
        ...(replacement && {
          keySealed: deps.box.seal(id, replacement.key),
          keyFingerprint: replacement.fingerprint,
          keyHint: keyHint(replacement.key),
        }),
        updatedAt: new Date(),
        updatedBy: adminId,
      })
      .where(eq(anthropicKey.id, id))
      .returning({ id: anthropicKey.id });
  } catch (error) {
    return refuseDuplicateRace(error);
  }
  // deleted (another tab) while Anthropic was checking
  return updated.length > 0 ? { ok: true, id } : { ok: false, notFound: true };
};

export const addFederation = async (deps: KeyDeps, adminId: string, input: FederationInput): Promise<SaveResult> => {
  const valid = validateFederation(input);
  if (!valid.ok) return valid;
  const federation = valid.value;
  if (await isFederationDuplicate(deps.db, federation)) return federationDuplicateError;
  const check = await deps.check(federationCredential(federation));
  if (!check.ok) return { ok: false, check };
  const id = randomUUID();
  try {
    await deps.db
      .insert(anthropicKey)
      .values({ id, kind: 'federation', ...federation, createdBy: adminId, updatedBy: adminId });
  } catch (error) {
    return refuseDuplicateRace(error);
  }
  return { ok: true, id };
};

/** Saves the admin's changes; a change to any of the IDs is checked with Anthropic first. */
export const updateFederation = async (
  deps: KeyDeps,
  adminId: string,
  id: string,
  input: FederationInput,
): Promise<SaveResult> => {
  const valid = validateFederation(input);
  if (!valid.ok) return valid;
  const federation = valid.value;
  if (!isUuid(id)) return { ok: false, notFound: true };
  const [stored] = await deps.db
    .select({
      organizationId: anthropicKey.organizationId,
      federationRuleId: anthropicKey.federationRuleId,
      serviceAccountId: anthropicKey.serviceAccountId,
      workspaceId: anthropicKey.workspaceId,
    })
    .from(anthropicKey)
    .where(and(eq(anthropicKey.id, id), eq(anthropicKey.kind, 'federation')));
  if (!stored) return { ok: false, notFound: true };
  if (await isFederationDuplicate(deps.db, federation, id)) return federationDuplicateError;
  const changed = (['organizationId', 'federationRuleId', 'serviceAccountId', 'workspaceId'] as const).some(
    (field) => stored[field] !== federation[field],
  );
  if (changed) {
    const check = await deps.check(federationCredential(federation));
    if (!check.ok) return { ok: false, check };
  }
  let updated: { id: string }[];
  try {
    updated = await deps.db
      .update(anthropicKey)
      .set({ ...federation, updatedAt: new Date(), updatedBy: adminId })
      .where(eq(anthropicKey.id, id))
      .returning({ id: anthropicKey.id });
  } catch (error) {
    return refuseDuplicateRace(error);
  }
  return updated.length > 0 ? { ok: true, id } : { ok: false, notFound: true };
};

export const deleteKey = async (db: Database, id: string): Promise<boolean> => {
  if (!isUuid(id)) return false;
  const deleted = await db.delete(anthropicKey).where(eq(anthropicKey.id, id)).returning({ id: anthropicKey.id });
  return deleted.length > 0;
};
