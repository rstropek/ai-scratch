import { describe, expect, it } from 'vitest';
import { loadEnv } from './env.ts';

const secret = 'x'.repeat(32);

describe('loadEnv', () => {
  it('reads the secret and the public origin', () => {
    expect(loadEnv({ BETTER_AUTH_SECRET: secret, BETTER_AUTH_URL: 'https://office.ai-scratch.dev/' })).toEqual({
      authSecret: secret,
      baseURL: 'https://office.ai-scratch.dev',
    });
  });

  it('refuses a missing or short secret', () => {
    expect(() => loadEnv({ BETTER_AUTH_URL: 'http://localhost:3100' })).toThrow(/BETTER_AUTH_SECRET/);
    expect(() => loadEnv({ BETTER_AUTH_SECRET: 'short', BETTER_AUTH_URL: 'http://localhost:3100' })).toThrow(
      /at least 32/,
    );
  });

  it('refuses an unresolved Key Vault reference', () => {
    const env = { BETTER_AUTH_SECRET: '@Microsoft.KeyVault(VaultName=kv;SecretName=s)', BETTER_AUTH_URL: 'x' };
    expect(() => loadEnv(env)).toThrow(/Key Vault/);
  });
});
