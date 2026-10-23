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
