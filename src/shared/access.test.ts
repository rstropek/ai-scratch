import { expect, test } from 'vitest';
import { normalizeCode } from './access.ts';

test('codes ignore case and surrounding spaces', () => {
  expect(normalizeCode('  Fuchs-4821 ')).toBe('fuchs-4821');
  expect(normalizeCode('   ')).toBe('');
});
