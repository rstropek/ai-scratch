// Registration of adults: the form sends a confirmation link (nothing stored yet), the link's page creates the
// account. docs/registration.md has the reasons. A factory over its dependencies, so tests run it on PGlite.
import { type Database, schema } from '@ai-scratch/db';
import { and, count, eq, gte, lt, type SQL, sql } from 'drizzle-orm';
import type { Auth } from './auth.ts';
import type { Mailer } from './mail.ts';
import { type AdultKind, openRegistration, sealRegistration } from './registration-token.ts';
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  NAME_MAX,
  REGISTRATIONS_PER_EMAIL_HOUR,
  REGISTRATIONS_PER_IP_HOUR,
} from './rules.ts';
import { deriveKey, keyedHash } from './secrets.ts';
import { TERMS_VERSION } from './terms.ts';
import { texts } from './texts.ts';
import type { TurnstileVerifier } from './turnstile.ts';

export interface RegistrationDeps {
  db: Database;
  auth: Auth;
  mailer: Mailer;
  /** BETTER_AUTH_SECRET: the link's and the rate limit's keys are derived from it */
  secret: string;
  baseURL: string;
  verifyTurnstile: TurnstileVerifier;
  now?: () => Date;
}

export type FieldErrors<F extends string> = Partial<Record<F, string>>;

export type RegistrationField = 'email' | 'kind' | 'adult' | 'terms' | 'aiConsent' | 'turnstile';

export interface RegistrationInput {
  email: string;
  kind: string;
  adult: boolean;
  terms: boolean;
  aiConsent: boolean;
  /** "Gratis-Budget beantragen": only teachers can, so it is dropped for parents */
  freeBudget: boolean;
  turnstileToken: string;
  ip: string | undefined;
}

export type StartResult =
  | { ok: true; email: string }
  | { ok: false; fieldErrors: FieldErrors<RegistrationField> }
  | { ok: false; limited: 'ip' | 'email' };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const HOUR_MS = 60 * 60 * 1000;

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

const isKind = (kind: string): kind is AdultKind => kind === 'parent' || kind === 'teacher';

const findUserByEmail = (db: Database, email: string) =>
  db.query.user.findFirst({ where: eq(schema.user.email, email), columns: { id: true } });

/** any fixed number: the advisory lock that serialises the rate limit's count and insert */
const RATE_LIMIT_LOCK = 4_242_001;

/**
 * Counts this request against the hourly limits and records it, unless a limit is reached. Only hashes are
 * stored: no address before its link is used. Old rows go on every call. Under a transaction-scoped advisory lock,
 * so requests at the same moment can't all pass on the same old count.
 */
const takeSlot = async (
  { db, secret }: RegistrationDeps,
  email: string,
  ip: string,
  now: Date,
): Promise<'ip' | 'email' | undefined> => {
  const key = deriveKey(secret, 'rate-limit');
  const ipHash = keyedHash(key, `ip:${ip}`);
  const emailHash = keyedHash(key, `email:${email}`);
  const since = new Date(now.getTime() - HOUR_MS);
  const { registrationAttempt: attempt } = schema;
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${RATE_LIMIT_LOCK})`);
    await tx.delete(attempt).where(lt(attempt.createdAt, since));
    const recent = async (hash: SQL) => {
      const [row] = await tx
        .select({ n: count() })
        .from(attempt)
        .where(and(hash, gte(attempt.createdAt, since)));
      return row?.n ?? 0;
    };
    if ((await recent(eq(attempt.ipHash, ipHash))) >= REGISTRATIONS_PER_IP_HOUR) return 'ip';
    if ((await recent(eq(attempt.emailHash, emailHash))) >= REGISTRATIONS_PER_EMAIL_HOUR) return 'email';
    await tx.insert(attempt).values({ ipHash, emailHash, createdAt: now });
    return undefined;
  });
};

/**
 * The registration form: checks it, then mails either the confirmation link or, for an address that already has
 * an account, a note with the login and password-reset links. Both answer the same, so the form never tells
 * whether an address has an account.
 */
export const startRegistration = async (deps: RegistrationDeps, input: RegistrationInput): Promise<StartResult> => {
  const now = deps.now?.() ?? new Date();
  const email = normalizeEmail(input.email);
  const fieldErrors: FieldErrors<RegistrationField> = {};
  if (!EMAIL.test(email) || email.length > 254) fieldErrors.email = texts.validation.email;
  if (!isKind(input.kind)) fieldErrors.kind = texts.validation.kind;
  if (!input.adult) fieldErrors.adult = texts.validation.adult;
  if (!input.terms) fieldErrors.terms = texts.validation.terms;
  if (!input.aiConsent) fieldErrors.aiConsent = texts.validation.aiConsent;
  if (Object.keys(fieldErrors).length > 0 || !isKind(input.kind)) return { ok: false, fieldErrors };

  if (!(await deps.verifyTurnstile(input.turnstileToken, input.ip)))
    return { ok: false, fieldErrors: { turnstile: texts.validation.turnstile } };
  const limited = await takeSlot(deps, email, input.ip ?? 'unknown', now);
  if (limited) return { ok: false, limited };

  if (await findUserByEmail(deps.db, email)) {
    await deps.mailer({ to: email, ...texts.mail.exists(deps.baseURL) });
  } else {
    const token = sealRegistration(
      deps.secret,
      {
        email,
        kind: input.kind,
        freeBudget: input.kind === 'teacher' && input.freeBudget,
        termsVersion: TERMS_VERSION,
        acceptedAt: now,
      },
      now,
    );
    const url = `${deps.baseURL}/register/confirm?t=${token}`;
    await deps.mailer({ to: email, ...texts.mail.confirm(url) });
  }
  return { ok: true, email };
};

export type LinkState =
  | { state: 'invalid' | 'expired' }
  | { state: 'exists'; email: string }
  | { state: 'ready'; email: string };

/** What the confirmation page shows for a link. Opening it changes nothing (mail scanners open links too). */
export const checkLink = async (deps: Pick<RegistrationDeps, 'db' | 'secret' | 'now'>, token: string) => {
  const opened = openRegistration(deps.secret, token, deps.now?.() ?? new Date());
  if (!opened.ok) return { state: opened.reason } satisfies LinkState;
  const { email } = opened.registration;
  if (await findUserByEmail(deps.db, email)) return { state: 'exists', email } satisfies LinkState;
  return { state: 'ready', email } satisfies LinkState;
};

export type AccountField = 'firstName' | 'lastName' | 'password' | 'passwordRepeat';

export interface AccountInput {
  firstName: string;
  lastName: string;
  password: string;
  passwordRepeat: string;
}

export type CompleteResult =
  | { ok: true; email: string; freeBudget: boolean }
  | { ok: false; link: 'invalid' | 'expired' | 'exists' }
  | { ok: false; fieldErrors: FieldErrors<AccountField> };

/** The confirmation page's form: creates the account and its profile. The caller then signs the person in. */
export const completeRegistration = async (
  deps: Pick<RegistrationDeps, 'db' | 'auth' | 'secret' | 'now'>,
  token: string,
  input: AccountInput,
): Promise<CompleteResult> => {
  const now = deps.now?.() ?? new Date();
  const opened = openRegistration(deps.secret, token, now);
  if (!opened.ok) return { ok: false, link: opened.reason };
  const { email, kind, freeBudget, termsVersion, acceptedAt } = opened.registration;

  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const fieldErrors: FieldErrors<AccountField> = {};
  if (!firstName || firstName.length > NAME_MAX) fieldErrors.firstName = texts.validation.firstName;
  if (!lastName || lastName.length > NAME_MAX) fieldErrors.lastName = texts.validation.lastName;
  if (input.password.length < MIN_PASSWORD_LENGTH)
    fieldErrors.password = texts.validation.passwordShort(MIN_PASSWORD_LENGTH);
  else if (input.password.length > MAX_PASSWORD_LENGTH)
    fieldErrors.password = texts.validation.passwordLong(MAX_PASSWORD_LENGTH);
  else if (input.password !== input.passwordRepeat) fieldErrors.passwordRepeat = texts.validation.passwordRepeat;
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  let userId: string;
  try {
    // no headers: a server call without a session may create users (sign-up itself stays disabled)
    const { user } = await deps.auth.api.createUser({
      body: {
        email,
        password: input.password,
        name: `${firstName} ${lastName}`,
        role: 'user',
        data: { emailVerified: true },
      },
    });
    userId = user.id;
  } catch (error) {
    // the link was used before (a second tab, a double submit): better-auth's check, or, for two submits at the
    // same moment, the database's unique email
    if (await findUserByEmail(deps.db, email)) return { ok: false, link: 'exists' };
    throw error;
  }
  try {
    await deps.db.insert(schema.adultProfile).values({
      userId,
      kind,
      freeBudgetRequested: freeBudget,
      termsVersion,
      termsAcceptedAt: acceptedAt,
      aiConsentAt: acceptedAt,
      adultConfirmedAt: acceptedAt,
      createdAt: now,
    });
  } catch (error) {
    // an account without a profile would have no consent on record: take it back, the link still works
    await deps.db.delete(schema.user).where(eq(schema.user.id, userId));
    throw error;
  }
  return { ok: true, email, freeBudget };
};

/** Whether the account accepted an older version of the terms. Accounts without a profile (the seeded admin) never. */
export const termsOutdated = async (db: Database, userId: string): Promise<boolean> => {
  const profile = await db.query.adultProfile.findFirst({
    where: eq(schema.adultProfile.userId, userId),
    columns: { termsVersion: true },
  });
  return profile !== undefined && profile.termsVersion !== TERMS_VERSION;
};

export type ConsentField = 'terms' | 'aiConsent';

/** A new terms version: both consents again, as at registration ("bei der nächsten Anmeldung", terms § 15). */
export const renewConsent = async (
  db: Database,
  userId: string,
  input: { terms: boolean; aiConsent: boolean },
  now = new Date(),
): Promise<{ ok: true } | { ok: false; fieldErrors: FieldErrors<ConsentField> }> => {
  const fieldErrors: FieldErrors<ConsentField> = {};
  if (!input.terms) fieldErrors.terms = texts.validation.terms;
  if (!input.aiConsent) fieldErrors.aiConsent = texts.validation.aiConsent;
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  await db
    .update(schema.adultProfile)
    .set({ termsVersion: TERMS_VERSION, termsAcceptedAt: now, aiConsentAt: now })
    .where(eq(schema.adultProfile.userId, userId));
  return { ok: true };
};
