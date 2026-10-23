// Server configuration, read once from the environment (.env in development).
import fs from 'node:fs';
import { normalizeCode } from '../shared/access.ts';

export interface Config {
  port: number;
  anthropicApiKey: string;
  /** the product owner's key is identity-linked and needs this header on every request */
  anthropicWorkspaceId: string | undefined;
  model: string;
  /** TypeSafe key for the kids-protection guard (Jev) */
  jevApiKey: string;
  /** pinned: the guard thresholds are tuned against this version */
  jevModel: string;
  /** normalized (lowercase), so kids can type them in any case */
  accessCodes: Set<string>;
  logDir: string;
  /** built client + precompressed Scratch bundle (npm run build) */
  distDir: string;
  /** the deployed git commit (the Docker build sets APP_VERSION); shown by /healthz */
  version: string;
}

const required = (env: NodeJS.ProcessEnv, name: string): string => {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
};

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): Config => {
  const accessCodes = new Set(required(env, 'ACCESS_CODES').split(',').map(normalizeCode).filter(Boolean));
  return {
    port: Number(env.PORT ?? 3000),
    anthropicApiKey: required(env, 'ANTHROPIC_API_KEY'),
    anthropicWorkspaceId: env.ANTHROPIC_WORKSPACE_ID?.trim() || undefined,
    model: env.MODEL?.trim() || 'claude-haiku-5-5',
    jevApiKey: required(env, 'JEV_API_KEY'),
    jevModel: env.JEV_MODEL?.trim() || 'jev-1.13.0',
    accessCodes,
    logDir: env.LOG_DIR?.trim() || 'logs',
    distDir: env.DIST_DIR?.trim() || 'dist',
    version: env.APP_VERSION?.trim() || 'dev',
  };
};

/** Loads .env into process.env if it exists (development; Azure sets real environment variables). */
export const loadDotEnv = (file = '.env'): void => {
  if (fs.existsSync(file)) process.loadEnvFile(file);
};
