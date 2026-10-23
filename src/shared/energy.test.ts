import { describe, expect, test } from 'vitest';
import type { ChatMessage } from './chat-types.ts';
import {
  CONTEXT_LIMIT,
  contextOf,
  fullBucket,
  HEARTS,
  heartsLeft,
  isAdminCode,
  memoryFull,
  nextHeartIn,
  take,
} from './energy.ts';

describe('hearts', () => {
  test('three messages, then one heart back every 20 s, never more than three', () => {
    let b = fullBucket(0);
    for (const _ of [1, 2, 3]) b = take(b, 0) ?? b;
    expect(heartsLeft(b, 0)).toBe(0);
    expect(take(b, 0)).toBeUndefined();
    expect(nextHeartIn(b, 0)).toBe(HEARTS.refillMs);
    expect(nextHeartIn(b, 5_000)).toBe(15_000);
    expect(heartsLeft(b, 19_999)).toBe(0);
    expect(heartsLeft(b, 20_000)).toBe(1);
    expect(heartsLeft(b, 45_000)).toBe(2);
    expect(nextHeartIn(b, 45_000)).toBe(15_000);
    expect(heartsLeft(b, 600_000)).toBe(3);
    expect(nextHeartIn(b, 600_000)).toBe(0);
  });

  test('a heart that is refilling keeps its progress when another one is used', () => {
    const first = take(fullBucket(0), 0); // 2 hearts
    const second = first && take(first, 10_000); // 2.5 at 10 s, 1.5 after the message
    expect(second && heartsLeft(second, 10_000)).toBe(1);
    expect(second && nextHeartIn(second, 10_000)).toBe(10_000);
  });

  test('admin codes', () => {
    expect(isAdminCode('admin_rainer')).toBe(true);
    expect(isAdminCode('schule1')).toBe(false);
  });
});

describe('Gedächtnis', () => {
  const user = (id: string): ChatMessage => ({ id, role: 'user', parts: [{ type: 'text', text: 'x' }] });
  const assistant = (id: string, metadata?: ChatMessage['metadata']): ChatMessage => ({
    id,
    role: 'assistant',
    parts: [{ type: 'text', text: 'y' }],
    metadata,
  });

  test('the context is the one of the latest turn that reported it', () => {
    expect(contextOf([])).toBeUndefined();
    const messages = [user('u1'), assistant('a1', { context: 9000 }), user('u2'), assistant('a2', { guard: 'misuse' })];
    expect(contextOf(messages)).toBe(9000);
  });

  test('full at the limit while there is conversation to free; a summary alone never blocks', () => {
    expect(memoryFull([user('u1'), assistant('a1', { context: CONTEXT_LIMIT - 1 }), user('u2')])).toBe(false);
    expect(memoryFull([user('u1'), assistant('a1', { context: CONTEXT_LIMIT }), user('u2')])).toBe(true);
    expect(memoryFull([assistant('s', { summary: true, context: CONTEXT_LIMIT }), user('u2')])).toBe(false);
  });
});
