// better-auth with our configuration on an in-memory Postgres (PGlite) with the real migrations.
import { createTestDb } from '@ai-scratch/db/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ADMIN_EMAIL, ensureAdmin } from './admin-seed.ts';
import { type Auth, createAuth, throwawaySecret } from './auth.ts';

const PASSWORD = 'correct horse battery';

let auth: Auth;
let close: () => Promise<void>;

beforeAll(async () => {
  const test = await createTestDb();
  close = test.close;
  auth = createAuth({ db: test.db, secret: throwawaySecret(), baseURL: 'http://localhost:3100' });
});
afterAll(() => close());

const signIn = (email: string, password: string) =>
  auth.api.signInEmail({ body: { email, password }, asResponse: true });

/** the session cookie a successful sign-in sets, as a request header */
const cookieOf = (response: Response) => new Headers({ cookie: response.headers.getSetCookie().join('; ') });

describe('the admin account', () => {
  it('is created with the admin role, and its password signs in', async () => {
    expect(await ensureAdmin(auth, { email: ADMIN_EMAIL, name: 'Rainer', password: PASSWORD })).toBe('created');
    const response = await signIn(ADMIN_EMAIL, PASSWORD);
    expect(response.status).toBe(200);
    const session = await auth.api.getSession({ headers: cookieOf(response) });
    expect(session?.user).toMatchObject({ email: ADMIN_EMAIL, name: 'Rainer', role: 'admin' });
  });

  it('gets a new password on a second run, and its old sessions end', async () => {
    const old = cookieOf(await signIn(ADMIN_EMAIL, PASSWORD));
    expect(await ensureAdmin(auth, { email: ADMIN_EMAIL, name: 'Rainer', password: `${PASSWORD} 2` })).toBe('updated');
    expect(await auth.api.getSession({ headers: old })).toBeNull();
    expect((await signIn(ADMIN_EMAIL, PASSWORD)).status).toBe(401);
    expect((await signIn(ADMIN_EMAIL, `${PASSWORD} 2`)).status).toBe(200);
  });

  it('refuses a short password', async () => {
    await expect(ensureAdmin(auth, { email: 'x@example.com', name: 'X', password: 'short' })).rejects.toThrow(
      /at least 12/,
    );
  });
});

describe('sign-in', () => {
  it('refuses an unknown email and a wrong password alike', async () => {
    expect((await signIn('nobody@example.com', PASSWORD)).status).toBe(401);
    expect((await signIn(ADMIN_EMAIL, 'wrong password!!')).status).toBe(401);
  });

  it('has no open sign-up', async () => {
    const response = await auth.api.signUpEmail({
      body: { email: 'teacher@example.com', password: PASSWORD, name: 'Teacher' },
      asResponse: true,
    });
    expect(response.ok).toBe(false);
  });
});
