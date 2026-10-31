// The office's settings from the environment (.env in development); the database's are read by @ai-scratch/db.
import { ADMIN_EMAIL } from './admin-seed.ts';

type Env = Record<string, string | undefined>;

export interface OfficeEnv {
  authSecret: string;
  baseURL: string;
}

const required = (env: Env, name: string): string => {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Missing environment variable ${name}`);
  // App Service passes a Key Vault reference through unchanged when it can't resolve it
  if (value.startsWith('@Microsoft.KeyVault('))
    throw new Error(`${name} is an unresolved Key Vault reference: check the vault and the app's access to it`);
  return value;
};

export const loadEnv = (env: Env = process.env): OfficeEnv => {
  const authSecret = required(env, 'BETTER_AUTH_SECRET');
  if (authSecret.length < 32) throw new Error('BETTER_AUTH_SECRET must be at least 32 characters');
  return { authSecret, baseURL: new URL(required(env, 'BETTER_AUTH_URL')).origin };
};

export interface ServicesEnv {
  mail: { from: string; resendApiKey: string } | { from: string; outboxDir: string };
  turnstile: { siteKey: string; secretKey: string };
  /** undefined only with JEV_DISABLED=1 (local development, e2e tests) */
  jev?: { apiKey: string; model: string };
  /** who hears about new teacher applications */
  adminNotifyEmail: string;
}

const DEFAULT_FROM = 'AI-Scratch <office@mail.ai-scratch.dev>';

/** Mail, Turnstile and Jev, read when the first request needs them (scripts never do). */
export const loadServicesEnv = (env: Env = process.env): ServicesEnv => {
  const from = env.MAIL_FROM?.trim() || DEFAULT_FROM;
  const outboxDir = env.MAIL_OUTBOX_DIR?.trim();
  return {
    mail: outboxDir ? { from, outboxDir } : { from, resendApiKey: required(env, 'RESEND_API_KEY') },
    turnstile: { siteKey: required(env, 'TURNSTILE_SITE_KEY'), secretKey: required(env, 'TURNSTILE_SECRET_KEY') },
    jev:
      env.JEV_DISABLED?.trim() === '1'
        ? undefined
        : { apiKey: required(env, 'JEV_API_KEY'), model: env.JEV_MODEL?.trim() || 'jev-1.13.0' },
    adminNotifyEmail: env.ADMIN_NOTIFY_EMAIL?.trim() || ADMIN_EMAIL,
  };
};
