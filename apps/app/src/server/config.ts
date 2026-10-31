// Server configuration, read once from the environment (.env in development).
import fs from 'node:fs';
import { normalizeCode } from '../shared/access.ts';
import { LOCKER_SITE } from '../shared/locker.ts';

export interface Config {
  port: number;
  anthropicApiKey: string;
  /** the product owner's key is identity-linked and needs this header on every request */
  anthropicWorkspaceId: string | undefined;
  model: string;
  /** OpenRouter's API, for parents' own keys (model.ts) */
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
  /** normalized (lowercase), so kids can type them in any case */
  accessCodes: Set<string>;
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

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): Config => {
  const accessCodes = new Set(required(env, 'ACCESS_CODES').split(',').map(normalizeCode).filter(Boolean));
  return {
    port: Number(env.PORT ?? 3000),
    anthropicApiKey: required(env, 'ANTHROPIC_API_KEY'),
    anthropicWorkspaceId: env.ANTHROPIC_WORKSPACE_ID?.trim() || undefined,
    model: env.MODEL?.trim() || 'claude-haiku-5-5',
    openRouterUrl: env.OPENROUTER_URL?.trim() || 'https://openrouter.ai/api/v1',
    openRouterModel: env.OPENROUTER_MODEL?.trim() || 'anthropic/claude-haiku-5.5',
    effort: effortOf(env.EFFORT),
    instructions: env.INSTRUCTIONS_FILE?.trim() ? fs.readFileSync(env.INSTRUCTIONS_FILE.trim(), 'utf8') : undefined,
    jevApiKey: required(env, 'JEV_API_KEY'),
    jevModel: env.JEV_MODEL?.trim() || 'jev-1.13.0',
    accessCodes,
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
