// The office's auth instance and the session check for server components. Server-only.
import { createDb, createPool } from '@ai-scratch/db';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { type Auth, createAuth } from './auth.ts';
import { loadEnv } from './env.ts';

// on globalThis: hot reloads in development re-run this module but must not open another pool
const holder = globalThis as { officeAuth?: Auth };

/** created on first use, not at import: `next build` imports routes without any environment */
export const getAuth = (): Auth => {
  if (!holder.officeAuth) {
    const { authSecret, baseURL } = loadEnv();
    holder.officeAuth = createAuth({ db: createDb(createPool()), secret: authSecret, baseURL });
  }
  return holder.officeAuth;
};

export const getSession = cache(async () => {
  // headers() first: it makes the page dynamic, so `next build` never prerenders it (without any environment)
  const requestHeaders = await headers();
  return getAuth().api.getSession({ headers: requestHeaders });
});

/** the signed-in user's session, or a redirect to the login page */
export const requireSession = async () => {
  const session = await getSession();
  if (!session) redirect('/anmelden');
  return session;
};
