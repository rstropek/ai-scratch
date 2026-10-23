import { describe, expect, test } from 'vitest';
import { clampPrefs, DEFAULT_PREFS, loadPrefs, maxChatWidth, savePrefs } from './ui-prefs.ts';

describe('ui prefs', () => {
  test('clamps stored values into their ranges and keeps the font size on the step grid', () => {
    expect(clampPrefs({ chatWidth: 5000, fontSize: 99, inputHeight: 10, folded: 'yes', showTools: true })).toEqual({
      chatWidth: 640,
      fontSize: 24,
      inputHeight: 56,
      folded: false,
      showTools: true,
    });
    expect(clampPrefs({ fontSize: 17 }).fontSize).toBe(18);
    expect(clampPrefs({ chatWidth: Number.NaN }).chatWidth).toBe(DEFAULT_PREFS.chatWidth);
  });

  test('falls back to the defaults for missing, corrupt or unavailable storage', () => {
    expect(loadPrefs({ getItem: () => null })).toEqual(DEFAULT_PREFS);
    expect(loadPrefs({ getItem: () => '{not json' })).toEqual(DEFAULT_PREFS);
    expect(
      loadPrefs({
        getItem: () => {
          throw new Error('SecurityError');
        },
      }),
    ).toEqual(DEFAULT_PREFS);
    expect(loadPrefs(undefined)).toEqual(DEFAULT_PREFS);
    expect(() =>
      savePrefs(DEFAULT_PREFS, {
        setItem: () => {
          throw new Error('QuotaExceeded');
        },
      }),
    ).not.toThrow();
  });

  test('round-trips through storage', () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
    };
    const prefs = { ...DEFAULT_PREFS, chatWidth: 450, folded: true, fontSize: 20 };
    savePrefs(prefs, storage);
    expect(loadPrefs(storage)).toEqual(prefs);
  });

  test('the chat never takes more than half the window', () => {
    expect(maxChatWidth(1920)).toBe(640);
    expect(maxChatWidth(1000)).toBe(500);
    expect(maxChatWidth(400)).toBe(300);
  });
});
