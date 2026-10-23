import { expect, test } from 'vitest';
import { loadConfig } from './config.ts';

test('access codes are normalized, so kids can type them in any case', () => {
  const config = loadConfig({ ACCESS_CODES: ' Schule1, ,admin_X ', ANTHROPIC_API_KEY: 'k', JEV_API_KEY: 'j' });
  expect([...config.accessCodes]).toEqual(['schule1', 'admin_x']);
});
