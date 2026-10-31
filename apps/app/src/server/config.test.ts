import { expect, test } from 'vitest';
import { loadConfig } from './config.ts';

test('access codes are normalized, so kids can type them in any case', () => {
  const config = loadConfig({ ACCESS_CODES: ' Schule1, ,admin_X ', ANTHROPIC_API_KEY: 'k', JEV_API_KEY: 'j' });
  expect([...config.accessCodes]).toEqual(['schule1', 'admin_x']);
});

test('an unresolved Key Vault reference stops the server with a clear message', () => {
  expect(() =>
    loadConfig({
      ACCESS_CODES: 'schule1',
      ANTHROPIC_API_KEY: '@Microsoft.KeyVault(VaultName=kv;SecretName=anthropic-api-key)',
      JEV_API_KEY: 'j',
    }),
  ).toThrow('ANTHROPIC_API_KEY is an unresolved Key Vault reference');
});

test('effort and a replacement prompt are optional; a wrong effort stops the server', () => {
  const base = { ACCESS_CODES: 'schule1', ANTHROPIC_API_KEY: 'k', JEV_API_KEY: 'j' };
  expect(loadConfig(base)).toMatchObject({ effort: 'high', instructions: undefined });
  expect(loadConfig({ ...base, EFFORT: 'medium', INSTRUCTIONS_FILE: 'package.json' })).toMatchObject({
    effort: 'medium',
    instructions: expect.stringContaining('@ai-scratch/app'),
  });
  expect(() => loadConfig({ ...base, EFFORT: 'mittel' })).toThrow('EFFORT must be one of');
});

test('without LOG_DIR nothing is stored', () => {
  const base = { ACCESS_CODES: 'schule1', ANTHROPIC_API_KEY: 'k', JEV_API_KEY: 'j' };
  expect(loadConfig(base).logDir).toBeUndefined();
  expect(loadConfig({ ...base, LOG_DIR: ' logs ' }).logDir).toBe('logs');
});
