// The office's settings from the environment (.env in development); the database's are read by @ai-scratch/db.

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
