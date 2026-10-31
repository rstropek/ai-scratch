// better-auth's configuration. A factory, so tests run it on PGlite and scripts outside Next.js.
import { randomBytes } from 'node:crypto';
import { type Database, schema } from '@ai-scratch/db';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { admin } from 'better-auth/plugins';

export const MIN_PASSWORD_LENGTH = 12;

/** for scripts and tests, whose cookies and tokens never outlive them (password hashes don't use the secret) */
export const throwawaySecret = () => randomBytes(32).toString('base64');

export interface AuthOptions {
  db: Database;
  secret: string;
  /** the office's public URL; its origin is the only trusted one */
  baseURL: string;
}

export const createAuth = ({ db, secret, baseURL }: AuthOptions) =>
  betterAuth({
    appName: 'AI-Scratch Office',
    baseURL,
    secret,
    database: drizzleAdapter(db, { provider: 'pg', schema }),
    // accounts are created by an admin (and for now by scripts/seed-admin.ts), never by visitors
    emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: MIN_PASSWORD_LENGTH },
    // shared school PCs: a session ends after 8 hours without use
    session: { expiresIn: 8 * 60 * 60, updateAge: 60 * 60 },
    // App Service puts the client's address in X-Client-IP; X-Forwarded-For carries a port there
    advanced: { ipAddress: { ipAddressHeaders: ['x-client-ip', 'x-forwarded-for'] } },
    plugins: [admin(), nextCookies()], // nextCookies must stay last
  });

export type Auth = ReturnType<typeof createAuth>;
