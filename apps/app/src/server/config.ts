// Server configuration, read once from the environment (.env in development).
import fs from 'node:fs';
import { type FederationEnv, loadFederationEnv } from '@ai-scratch/anthropic';
import { type Limits, loadLimits, normalizeCode, parseMasterKey } from '@ai-scratch/db';
import { LOCKER_SITE } from '../shared/locker.ts';

export interface Config {
  port: number;
  /** the codes from the office, the pool, the usage (docs/budgets.md); off: only TEST_CODES work */
  database: boolean;
  /** opens the sealed keys of the pool and of adults' own OpenRouter keys; set with the database */
  keyEncryptionKey: Buffer | undefined;
  /** the budgets' limits, the same env vars as the office's */
  limits: Limits;
  /** codes from the environment for dev, tests and the game harness: no database, paid with ANTHROPIC_API_KEY. Never on Azure */
  testCodes: Set<string>;
  /** the test codes' key */
  anthropicApiKey: string | undefined;
  /** the test codes' key is identity-linked and needs this header on every request */
  anthropicWorkspaceId: string | undefined;
  /** where federated pool entries exchange our Azure identity's token */
  anthropicBaseUrl: string;
  /** our Azure identity, for federated pool entries; undefined: they are skipped */
  federation: FederationEnv | undefined;
  /** the 80 % warnings to the admins go through Resend; without a key they are only logged */
  resendApiKey: string | undefined;
  mailFrom: string;
  model: string;
  /** OpenRouter's API, for adults' own keys (model.ts) */
  openRouterUrl: string;
  /** the same model under OpenRouter's name */
  openRouterModel: string;
  /** the chat's thinking effort */
  effort: Effort;
  /** replaces the built-in system prompt + tool instructions (eval/games tries prompt variants with it) */
  instructions: string | undefined;
  /** TypeSafe key for the kids-protection guard (Jev) */
  jevApiKey: string;
  /** pinned: the guard thresholds are tuned against this version */
  jevModel: string;
  /** where calls and guard screenings are stored; unset (production) stores nothing */
  logDir: string | undefined;
  /** built client + precompressed Scratch bundle (npm run build) */
  distDir: string;
  /** the deployed git commit (the Docker build sets APP_VERSION); shown by /healthz */
  version: string;
  /** the CoderDojo Locker, where kids save and load their games (locker.ts) */
  lockerUrl: string;
}

export const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export type Effort = (typeof EFFORTS)[number];

const effortOf = (value: string | undefined): Effort => {
  const effort = value?.trim() || 'high';
  if (!(EFFORTS as readonly string[]).includes(effort)) throw new Error(`EFFORT must be one of ${EFFORTS.join(', ')}`);
  return effort as Effort;
};

const required = (env: NodeJS.ProcessEnv, name: string): string => {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Missing environment variable ${name}`);
  // App Service passes a Key Vault reference through unchanged when it can't resolve it
  if (value.startsWith('@Microsoft.KeyVault('))
    throw new Error(`${name} is an unresolved Key Vault reference: check the vault and the app's access to it`);
  return value;
};

/** the same rule as @ai-scratch/db's poolConfig: a URL, or an Azure server with an Entra login */
const hasDatabase = (env: NodeJS.ProcessEnv) => Boolean(env.DATABASE_URL?.trim() || env.PGHOST?.trim());

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): Config => {
  const testCodes = new Set((env.TEST_CODES ?? '').split(',').map(normalizeCode).filter(Boolean));
  const database = hasDatabase(env);
  if (!database && testCodes.size === 0)
    throw new Error("Set DATABASE_URL (or PGHOST, PGDATABASE, PGUSER) for the office's codes, or TEST_CODES");
  return {
    port: Number(env.PORT ?? 3000),
    database,
    keyEncryptionKey: database ? parseMasterKey(env) : undefined,
    limits: loadLimits(env),
    testCodes,
    anthropicApiKey: testCodes.size > 0 ? required(env, 'ANTHROPIC_API_KEY') : undefined,
    anthropicWorkspaceId: env.ANTHROPIC_WORKSPACE_ID?.trim() || undefined,
    anthropicBaseUrl: env.ANTHROPIC_BASE_URL?.trim() || 'https://api.anthropic.com',
    federation: loadFederationEnv(env),
    resendApiKey: env.RESEND_API_KEY?.trim() || undefined,
    mailFrom: env.MAIL_FROM?.trim() || 'AI-Scratch <office@mail.ai-scratch.dev>',
    model: env.MODEL?.trim() || 'claude-haiku-5-5',
    openRouterUrl: env.OPENROUTER_URL?.trim() || 'https://openrouter.ai/api/v1',
    openRouterModel: env.OPENROUTER_MODEL?.trim() || 'anthropic/claude-haiku-5.5',
    effort: effortOf(env.EFFORT),
    instructions: env.INSTRUCTIONS_FILE?.trim() ? fs.readFileSync(env.INSTRUCTIONS_FILE.trim(), 'utf8') : undefined,
    jevApiKey: required(env, 'JEV_API_KEY'),
    jevModel: env.JEV_MODEL?.trim() || 'jev-1.13.0',
    logDir: env.LOG_DIR?.trim() || undefined,
    distDir: env.DIST_DIR?.trim() || 'dist',
    version: env.APP_VERSION?.trim() || 'dev',
    lockerUrl: env.LOCKER_URL?.trim() || LOCKER_SITE,
  };
};

/** Loads .env into process.env if it exists (development; Azure sets real environment variables). */
export const loadDotEnv = (file = '.env'): void => {
  if (fs.existsSync(file)) process.loadEnvFile(file);
};
