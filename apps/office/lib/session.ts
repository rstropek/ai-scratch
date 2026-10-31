// The office's auth instance and the session checks for server components and actions. Server-only.
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { type Auth, createAuth } from './auth.ts';
import { loadEnv } from './env.ts';
import type { Mailer } from './mail.ts';
import { termsOutdated } from './registration.ts';
import { isAdmin } from './roles.ts';
import { getDb, getMailer } from './services.ts';

// on globalThis: hot reloads in development re-run this module but must not open another pool
const holder = globalThis as { officeAuth?: Auth };

/** created on first use, not at import: `next build` imports routes without any environment */
export const getAuth = (): Auth => {
  if (!holder.officeAuth) {
    const { authSecret, baseURL } = loadEnv();
    // the mailer is looked up per mail, so a mail setting can't stop sign-ins
    const mailer: Mailer = (mail) => getMailer()(mail);
    holder.officeAuth = createAuth({ db: getDb(), secret: authSecret, baseURL, mailer });
  }
  return holder.officeAuth;
};

export const getSession = cache(async () => {
  // headers() first: it makes the page dynamic, so `next build` never prerenders it (without any environment)
  const requestHeaders = await headers();
  return getAuth().api.getSession({ headers: requestHeaders });
});

export type Session = NonNullable<Awaited<ReturnType<typeof getSession>>>;

const hasOutdatedTerms = cache((userId: string) => termsOutdated(getDb(), userId));

/**
 * The signed-in user's session, or a redirect to the login page. An account that accepted an older version of the
 * terms goes to /consent first (terms § 15); only that page passes `outdatedTerms: 'allow'`.
 */
export const requireSession = async ({ outdatedTerms }: { outdatedTerms?: 'allow' } = {}): Promise<Session> => {
  const session = await getSession();
  if (!session) redirect('/login');
  if (outdatedTerms !== 'allow' && (await hasOutdatedTerms(session.user.id))) redirect('/consent');
  return session;
};

/** the signed-in user's session and whether they are an admin (pages show "not allowed" otherwise) */
export const requireAdmin = async (): Promise<{ session: Session; allowed: boolean }> => {
  const session = await requireSession();
  return { session, allowed: isAdmin(session.user) };
};
