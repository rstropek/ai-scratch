import { normalizeCode as stored } from '@ai-scratch/db';
import { expect, test } from 'vitest';
import { normalizeCode } from './access.ts';

test('codes ignore case and surrounding spaces, and a space works as a dash', () => {
  expect(normalizeCode('  Tiger-Apfel-48 ')).toBe('tiger-apfel-48');
  expect(normalizeCode('tiger apfel  48')).toBe('tiger-apfel-48');
  expect(normalizeCode('   ')).toBe('');
});

test('the browser normalizes like the server', () => {
  for (const typed of ['  Tiger Apfel 48', 'ADMIN_test', 'e2e', 'a\tb'])
    expect(normalizeCode(typed)).toBe(stored(typed));
});
