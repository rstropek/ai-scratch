import { randomBytes } from 'node:crypto';
import { expect, test } from 'vitest';
import { loadConfig } from './config.ts';

const base = { TEST_CODES: 'schule1', ANTHROPIC_API_KEY: 'k', JEV_API_KEY: 'j' };

test('test codes are normalized, so kids can type them in any case; they need the key that pays for them', () => {
  const config = loadConfig({ ...base, TEST_CODES: ' Schule1, ,admin_X ' });
  expect([...config.testCodes]).toEqual(['schule1', 'admin_x']);
  expect(config.database).toBe(false);
  expect(() => loadConfig({ ...base, ANTHROPIC_API_KEY: '' })).toThrow(
    'Missing environment variable ANTHROPIC_API_KEY',
  );
});

test('without a database and without test codes nothing would work: the server does not start', () => {
  expect(() => loadConfig({ JEV_API_KEY: 'j' })).toThrow('Set DATABASE_URL');
});

test('with a database it needs the master key of the sealed keys, and no Anthropic key', () => {
  const env = { DATABASE_URL: 'postgres://x', JEV_API_KEY: 'j' };
  expect(() => loadConfig(env)).toThrow('KEY_ENCRYPTION_KEY');
  const config = loadConfig({ ...env, KEY_ENCRYPTION_KEY: randomBytes(32).toString('base64'), CODE_BUDGET_USD: '3' });
  expect(config).toMatchObject({ database: true, anthropicApiKey: undefined, testCodes: new Set() });
  expect(config.limits.codeBudgetUsd).toBe(3);
});

test('an unresolved Key Vault reference stops the server with a clear message', () => {
  expect(() =>
    loadConfig({ ...base, ANTHROPIC_API_KEY: '@Microsoft.KeyVault(VaultName=kv;SecretName=anthropic-api-key)' }),
  ).toThrow('ANTHROPIC_API_KEY is an unresolved Key Vault reference');
});

test('effort and a replacement prompt are optional; a wrong effort stops the server', () => {
  expect(loadConfig(base)).toMatchObject({ effort: 'high', instructions: undefined });
  expect(loadConfig({ ...base, EFFORT: 'medium', INSTRUCTIONS_FILE: 'package.json' })).toMatchObject({
    effort: 'medium',
    instructions: expect.stringContaining('@ai-scratch/app'),
  });
  expect(() => loadConfig({ ...base, EFFORT: 'mittel' })).toThrow('EFFORT must be one of');
});

test('without LOG_DIR nothing is stored', () => {
  expect(loadConfig(base).logDir).toBeUndefined();
  expect(loadConfig({ ...base, LOG_DIR: ' logs ' }).logDir).toBe('logs');
});
