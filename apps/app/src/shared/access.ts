// Access codes (one per school) are typed in by kids: case and surrounding spaces don't matter.
export const normalizeCode = (code: string): string => code.trim().toLowerCase();

/**
 * Outside the schools, parents can enter their own OpenRouter API key instead of a code: it travels in the
 * same header and is told apart by its prefix. Keys are case-sensitive, so they are never normalized.
 */
export const OPENROUTER_KEY_PREFIX = 'sk-or-';

export const isOpenRouterKey = (value: string): boolean => value.trim().startsWith(OPENROUTER_KEY_PREFIX);

/** What the client sends: a key as it is (without spaces around it), a code normalized. */
export const normalizeCredential = (value: string): string =>
  isOpenRouterKey(value) ? value.trim() : normalizeCode(value);

/** Why the server refused an OpenRouter key (GET /api/access and every other /api call). */
export type KeyProblem = 'unknown' | 'no-limit' | 'empty' | 'down';
