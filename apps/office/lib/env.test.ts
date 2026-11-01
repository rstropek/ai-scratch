import { describe, expect, it } from 'vitest';
import { loadEnv, loadServicesEnv } from './env.ts';

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

describe('loadServicesEnv', () => {
  const base = { RESEND_API_KEY: 're', TURNSTILE_SITE_KEY: 'site', TURNSTILE_SECRET_KEY: 'secret', JEV_API_KEY: 'jev' };

  it('reads Resend, Turnstile and Jev with their defaults', () => {
    expect(loadServicesEnv(base)).toEqual({
      mail: { from: 'AI-Scratch <office@mail.ai-scratch.dev>', resendApiKey: 're' },
      turnstile: { siteKey: 'site', secretKey: 'secret' },
      jev: { apiKey: 'jev', model: 'jev-1.13.0' },
      adminNotifyEmail: 'rainer@software-architects.at',
    });
  });

  it('writes mails to a folder instead, and switches Jev off only when told', () => {
    const env = { ...base, RESEND_API_KEY: '', JEV_API_KEY: '', MAIL_OUTBOX_DIR: '/tmp/outbox', JEV_DISABLED: '1' };
    expect(loadServicesEnv(env)).toMatchObject({ mail: { outboxDir: '/tmp/outbox' }, jev: undefined });
    expect(() => loadServicesEnv({ ...base, JEV_API_KEY: '' })).toThrow(/JEV_API_KEY/);
    expect(() => loadServicesEnv({ ...base, RESEND_API_KEY: '' })).toThrow(/RESEND_API_KEY/);
    expect(() => loadServicesEnv({ ...base, TURNSTILE_SECRET_KEY: '' })).toThrow(/TURNSTILE_SECRET_KEY/);
  });

  it('sets up federation only with an audience: the managed identity on Azure, the Azure CLI without one', () => {
    expect(loadServicesEnv(base).federation).toBeUndefined();
    const audience = 'api://095dcf0d-0152-4de4-82b2-0cf51019cd56';
    expect(
      loadServicesEnv({ ...base, ANTHROPIC_FEDERATION_AUDIENCE: audience, ANTHROPIC_FEDERATION_CLIENT_ID: 'mi' })
        .federation,
    ).toEqual({ audience, clientId: 'mi' });
    expect(
      loadServicesEnv({ ...base, ANTHROPIC_FEDERATION_AUDIENCE: ` ${audience} `, ANTHROPIC_FEDERATION_TENANT_ID: 't' })
        .federation,
    ).toEqual({ audience, tenantId: 't' });
  });
});
