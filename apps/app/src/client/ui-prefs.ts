// Layout preferences of the chat panel (width, folded, input height, font size, tool calls shown).
// Kept in localStorage for convenience only: any read/write may throw (private mode, blocked storage),
// and whatever comes back is clamped, so a broken store just means the defaults.
import { useEffect, useState } from 'react';

export interface UiPrefs {
  chatWidth: number;
  folded: boolean;
  inputHeight: number;
  fontSize: number;
  showTools: boolean;
}

export const CHAT_WIDTH = { min: 300, max: 640, default: 380 } as const;
export const INPUT_HEIGHT = { min: 56, default: 80 } as const;
export const FONT_SIZE = { min: 14, max: 24, step: 2, default: 16 } as const;

export const DEFAULT_PREFS: UiPrefs = {
  chatWidth: CHAT_WIDTH.default,
  folded: false,
  inputHeight: INPUT_HEIGHT.default,
  fontSize: FONT_SIZE.default,
  showTools: false,
};

const STORAGE_KEY = 'ki-scratch.ui';

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** The widest the chat may get: 640px, but never more than half the window. */
export const maxChatWidth = (viewportWidth: number) =>
  Math.max(CHAT_WIDTH.min, Math.min(CHAT_WIDTH.max, Math.floor(viewportWidth / 2)));

const num = (value: unknown, fallback: number, min: number, max: number) =>
  typeof value === 'number' && Number.isFinite(value) ? clamp(Math.round(value), min, max) : fallback;

/** Turns anything (parsed JSON, partial objects) into valid prefs. */
export const clampPrefs = (raw: unknown): UiPrefs => {
  const p = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const fontSize = num(p.fontSize, FONT_SIZE.default, FONT_SIZE.min, FONT_SIZE.max);
  return {
    chatWidth: num(p.chatWidth, CHAT_WIDTH.default, CHAT_WIDTH.min, CHAT_WIDTH.max),
    folded: p.folded === true,
    // the upper limit depends on the panel height and is applied where the input is laid out
    inputHeight: num(p.inputHeight, INPUT_HEIGHT.default, INPUT_HEIGHT.min, 2000),
    // keep the size on the step grid (14, 16, … 24)
    fontSize: FONT_SIZE.min + Math.round((fontSize - FONT_SIZE.min) / FONT_SIZE.step) * FONT_SIZE.step,
    showTools: p.showTools === true,
  };
};

export const loadPrefs = (storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage): UiPrefs => {
  try {
    const stored = storage?.getItem(STORAGE_KEY);
    return clampPrefs(stored ? JSON.parse(stored) : {});
  } catch {
    return DEFAULT_PREFS;
  }
};

export const savePrefs = (prefs: UiPrefs, storage: Pick<Storage, 'setItem'> | undefined = globalThis.localStorage) => {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // not being able to remember the layout is fine
  }
};

export const useUiPrefs = () => {
  const [prefs, setPrefs] = useState(loadPrefs);
  useEffect(() => savePrefs(prefs), [prefs]);
  const update = (change: Partial<UiPrefs>) => setPrefs((p) => ({ ...p, ...change }));
  return [prefs, update] as const;
};
