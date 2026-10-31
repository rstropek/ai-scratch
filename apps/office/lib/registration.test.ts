// Registration on an in-memory Postgres (PGlite) with the real migrations and our better-auth configuration.
import { schema } from '@ai-scratch/db';
import { createTestDb } from '@ai-scratch/db/testing';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { fakeMailer, linkIn } from '../test/fakes.ts';
import { ADMIN_EMAIL, ensureAdmin } from './admin-seed.ts';
import { type Auth, createAuth } from './auth.ts';
import {
  checkLink,
  completeRegistration,
  type RegistrationDeps,
  type RegistrationInput,
  renewConsent,
  startRegistration,
  termsOutdated,
} from './registration.ts';
import { LINK_VALID_MINUTES } from './rules.ts';
import { TERMS_VERSION } from './terms.ts';
import { texts } from './texts.ts';

const secret = 'test-secret-'.padEnd(40, 'x');
const baseURL = 'http://localhost:3100';
const PASSWORD = 'correct horse battery';

let deps: RegistrationDeps & { mailer: ReturnType<typeof fakeMailer> };
let auth: Auth;
let close: () => Promise<void>;
let turnstileOk = true;
let clock = new Date('2026-11-02T08:00:00Z');

beforeAll(async () => {
  const test = await createTestDb();
  close = test.close;
  auth = createAuth({ db: test.db, secret, baseURL });
  deps = {
    db: test.db,
    auth,
    mailer: fakeMailer(),
    secret,
    baseURL,
    verifyTurnstile: async (token) => turnstileOk && token === 'ok',
    now: () => clock,
  };
  await ensureAdmin(auth, { email: ADMIN_EMAIL, name: 'Rainer', password: PASSWORD });
});
afterAll(() => close());
beforeEach(async () => {
  turnstileOk = true;
  clock = new Date(clock.getTime() + 2 * 60 * 60 * 1000); // a fresh hour for the rate limits
  deps.mailer.sent.length = 0;
});

let ipCounter = 0;
const input = (overrides: Partial<RegistrationInput> = {}): RegistrationInput => ({
  email: `person${++ipCounter}@schule.at`,
  kind: 'parent',
  adult: true,
  terms: true,
  aiConsent: true,
  turnstileToken: 'ok',
  ip: `10.0.0.${ipCounter}`,
  ...overrides,
});

const tokenOf = (url: string) => new URL(url).searchParams.get('t') ?? '';
const account = { firstName: 'Sabine', lastName: 'Leitner', password: PASSWORD, passwordRepeat: PASSWORD };

describe('the registration form', () => {
  it('mails a confirmation link and stores nothing but hashes', async () => {
    const result = await startRegistration(deps, input({ email: ' New.Person@Schule.at ' }));
    expect(result).toEqual({ ok: true, email: 'new.person@schule.at' });
    const mail = deps.mailer.last();
    expect(mail).toMatchObject({ to: 'new.person@schule.at', subject: texts.mail.confirm('').subject });
    expect(linkIn(mail, '/register/confirm?t=')).toMatch(/^http:\/\/localhost:3100\/register\/confirm\?t=/);
    const attempts = await deps.db.select().from(schema.registrationAttempt);
    expect(JSON.stringify(attempts)).not.toMatch(/schule|10\.0\.0/);
    expect(await deps.db.select().from(schema.user).where(eq(schema.user.email, 'new.person@schule.at'))).toEqual([]);
  });

  it('answers the same for an address with an account, and mails a note instead of a link', async () => {
    const result = await startRegistration(deps, input({ email: ADMIN_EMAIL.toUpperCase() }));
    expect(result).toEqual({ ok: true, email: ADMIN_EMAIL });
    const mail = deps.mailer.last();
    expect(mail?.subject).toBe(texts.mail.exists(baseURL).subject);
    expect(mail?.text).toContain(`${baseURL}/forgot-password`);
    expect(mail?.text).not.toContain('/register/confirm');
  });

  it('names every missing answer and sends nothing', async () => {
    const result = await startRegistration(
      deps,
      input({ email: 'kaputt@', kind: '', adult: false, terms: false, aiConsent: false }),
    );
    expect(result).toEqual({
      ok: false,
      fieldErrors: {
        email: texts.validation.email,
        kind: texts.validation.kind,
        adult: texts.validation.adult,
        terms: texts.validation.terms,
        aiConsent: texts.validation.aiConsent,
      },
    });
    expect(deps.mailer.sent).toEqual([]);
  });

  it('refuses a failed Turnstile check before counting it', async () => {
    turnstileOk = false;
    const ip = '10.9.9.9';
    for (let i = 0; i < 6; i++)
      expect(await startRegistration(deps, input({ ip }))).toEqual({
        ok: false,
        fieldErrors: { turnstile: texts.validation.turnstile },
      });
    turnstileOk = true;
    expect((await startRegistration(deps, input({ ip }))).ok).toBe(true);
  });

  it('allows 5 registrations per hour from one IP', async () => {
    const ip = '10.8.8.8';
    for (let i = 0; i < 5; i++) expect((await startRegistration(deps, input({ ip }))).ok).toBe(true);
    expect(await startRegistration(deps, input({ ip }))).toEqual({ ok: false, limited: 'ip' });
    clock = new Date(clock.getTime() + 61 * 60 * 1000);
    expect((await startRegistration(deps, input({ ip }))).ok).toBe(true);
  });

  it('allows 3 registrations per hour for one address, from any IP', async () => {
    const email = 'bombed@schule.at';
    for (let i = 0; i < 3; i++) expect((await startRegistration(deps, input({ email }))).ok).toBe(true);
    expect(await startRegistration(deps, input({ email }))).toEqual({ ok: false, limited: 'email' });
    expect(deps.mailer.sent).toHaveLength(3);
  });
});

describe('the confirmation link', () => {
  const register = async (overrides: Partial<RegistrationInput> = {}) => {
    await startRegistration(deps, input(overrides));
    return tokenOf(linkIn(deps.mailer.last(), '/register/confirm?t='));
  };

  it('only opens a page: it creates nothing', async () => {
    const token = await register({ email: 'scanner@schule.at', kind: 'teacher' });
    expect(await checkLink(deps, token)).toEqual({ state: 'ready', email: 'scanner@schule.at', kind: 'teacher' });
    expect(await checkLink(deps, token)).toEqual({ state: 'ready', email: 'scanner@schule.at', kind: 'teacher' });
  });

  it('creates the account with its profile, and the password signs in', async () => {
    const token = await register({ email: 'parent@schule.at' });
    const acceptedAt = clock;
    expect(await completeRegistration(deps, token, account)).toEqual({
      ok: true,
      email: 'parent@schule.at',
      kind: 'parent',
    });
    const user = await deps.db.query.user.findFirst({ where: eq(schema.user.email, 'parent@schule.at') });
    expect(user).toMatchObject({ name: 'Sabine Leitner', emailVerified: true, role: 'user' });
    const profile = await deps.db.query.adultProfile.findFirst({
      where: eq(schema.adultProfile.userId, user?.id ?? ''),
    });
    expect(profile).toMatchObject({
      kind: 'parent',
      termsVersion: TERMS_VERSION,
      termsAcceptedAt: acceptedAt,
      aiConsentAt: acceptedAt,
      adultConfirmedAt: acceptedAt,
      jevChecks: 0,
    });
    const signIn = await auth.api.signInEmail({
      body: { email: 'parent@schule.at', password: PASSWORD },
      asResponse: true,
    });
    expect(signIn.status).toBe(200);
  });

  it('works once: a second use finds the account', async () => {
    const token = await register({ email: 'twice@schule.at' });
    expect((await completeRegistration(deps, token, account)).ok).toBe(true);
    expect(await checkLink(deps, token)).toEqual({ state: 'exists', email: 'twice@schule.at' });
    expect(await completeRegistration(deps, token, account)).toEqual({ ok: false, link: 'exists' });
  });

  it(`expires after ${LINK_VALID_MINUTES} minutes`, async () => {
    const token = await register();
    clock = new Date(clock.getTime() + LINK_VALID_MINUTES * 60_000);
    expect(await checkLink(deps, token)).toEqual({ state: 'expired' });
    expect(await completeRegistration(deps, token, account)).toEqual({ ok: false, link: 'expired' });
  });

  it('checks the name and the password', async () => {
    const token = await register();
    expect(
      await completeRegistration(deps, token, { firstName: ' ', lastName: '', password: 'short', passwordRepeat: '' }),
    ).toEqual({
      ok: false,
      fieldErrors: {
        firstName: texts.validation.firstName,
        lastName: texts.validation.lastName,
        password: texts.validation.passwordShort(12),
      },
    });
    expect(await completeRegistration(deps, token, { ...account, passwordRepeat: 'something else!' })).toEqual({
      ok: false,
      fieldErrors: { passwordRepeat: texts.validation.passwordRepeat },
    });
  });
});

describe('password reset', () => {
  it('mails a link that sets a new password and ends the old sessions', async () => {
    const mailer = fakeMailer();
    const withMail = createAuth({ db: deps.db, secret, baseURL, mailer });
    const email = 'forgetful@schule.at';
    await startRegistration(deps, input({ email }));
    await completeRegistration(deps, tokenOf(linkIn(deps.mailer.last(), '/register/confirm?t=')), account);
    const old = await withMail.api.signInEmail({ body: { email, password: PASSWORD }, asResponse: true });
    const oldCookie = new Headers({ cookie: old.headers.getSetCookie().join('; ') });

    await withMail.api.requestPasswordReset({ body: { email, redirectTo: '/reset-password' } });
    const mail = mailer.last();
    expect(mail).toMatchObject({ to: email, subject: texts.mail.resetPassword('').subject });
    const token = linkIn(mail, '/api/auth/reset-password/').match(/reset-password\/([^?]+)/)?.[1] ?? '';
    await withMail.api.resetPassword({ body: { newPassword: `${PASSWORD} new`, token } });

    expect(await withMail.api.getSession({ headers: oldCookie })).toBeNull();
    const signIn = await withMail.api.signInEmail({
      body: { email, password: `${PASSWORD} new` },
      asResponse: true,
    });
    expect(signIn.status).toBe(200);
  });
});

describe('a new version of the terms', () => {
  it('asks the account to agree again, and stores the new version and time', async () => {
    await startRegistration(deps, input({ email: 'versioned@schule.at' }));
    await completeRegistration(deps, tokenOf(linkIn(deps.mailer.last(), '/register/confirm?t=')), account);
    const user = await deps.db.query.user.findFirst({ where: eq(schema.user.email, 'versioned@schule.at') });
    const userId = user?.id ?? '';
    expect(await termsOutdated(deps.db, userId)).toBe(false);

    await deps.db
      .update(schema.adultProfile)
      .set({ termsVersion: 'older' })
      .where(eq(schema.adultProfile.userId, userId));
    expect(await termsOutdated(deps.db, userId)).toBe(true);
    expect(await renewConsent(deps.db, userId, { terms: true, aiConsent: false })).toEqual({
      ok: false,
      fieldErrors: { aiConsent: texts.validation.aiConsent },
    });
    const now = new Date('2027-01-02T03:04:05Z');
    expect(await renewConsent(deps.db, userId, { terms: true, aiConsent: true }, now)).toEqual({ ok: true });
    expect(await termsOutdated(deps.db, userId)).toBe(false);
    const profile = await deps.db.query.adultProfile.findFirst({ where: eq(schema.adultProfile.userId, userId) });
    expect(profile).toMatchObject({ termsVersion: TERMS_VERSION, termsAcceptedAt: now, aiConsentAt: now });
  });

  it('never stops an account without a profile', async () => {
    const admin = await deps.db.query.user.findFirst({ where: eq(schema.user.email, ADMIN_EMAIL) });
    expect(await termsOutdated(deps.db, admin?.id ?? '')).toBe(false);
  });
});
