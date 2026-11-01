// The office's settings from the environment (.env in development); the database's are read by @ai-scratch/db.
import { type FederationEnv, loadFederationEnv } from '@ai-scratch/anthropic';
import { type Limits, loadLimits } from '@ai-scratch/db/limits';
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
  /** undefined when federation isn't set up here: federated pool entries can't be checked then */
  federation?: FederationEnv;
  /** OpenRouter's API, for adults' own keys and the model price (the e2e tests' fake in tests) */
  openrouterUrl: string;
  /** the budgets' limits (docs/budgets.md) */
  limits: Limits;
}

const DEFAULT_FROM = 'AI-Scratch <office@mail.ai-scratch.dev>';

const DEFAULT_OPENROUTER_URL = 'https://openrouter.ai/api/v1';

/** Mail, Turnstile, Jev, federation, OpenRouter and the limits, read when the first request needs them (scripts never do). */
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
    federation: loadFederationEnv(env),
    openrouterUrl: (env.OPENROUTER_URL?.trim() || DEFAULT_OPENROUTER_URL).replace(/\/+$/, ''),
    limits: loadLimits(env),
  };
};
