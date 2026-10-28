// The school's access code, or a parent's own OpenRouter key: typed in at the gate (a code also comes as
// ?code= in the link), checked by the server (GET /api/access) and remembered in this browser, so a reload
// goes straight to the chat. A key is only used while the parent's acceptance of the current terms of use
// is remembered with it.
import { isOpenRouterKey, type KeyProblem, normalizeCode } from '../shared/access.ts';
import { ACCESS_CODE_HEADER } from '../shared/chat-types.ts';

const KEY = 'digiferien.accessCode';
const TERMS_KEY = 'digiferien.termsAccepted';
/** the date of the terms of use (TermsDialog.tsx); a new one asks the parents again */
export const TERMS_VERSION = '2026-10-28';

// storage can be blocked (private windows, settings): then the code is just asked for again

const read = (key: string): string | undefined => {
  try {
    return localStorage.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
};

const write = (key: string, value: string | undefined): void => {
  try {
    if (value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // not remembered, or nothing to forget
  }
};

export const storedCode = (): string | undefined => read(KEY);

export const storeCode = (code: string): void => write(KEY, code);

/** forgets the code or key, and with a key the parents' acceptance of the terms */
export const forgetCode = (): void => {
  write(KEY, undefined);
  write(TERMS_KEY, undefined);
};

export const termsAccepted = (): boolean => read(TERMS_KEY) === TERMS_VERSION;

export const acceptTerms = (): void => write(TERMS_KEY, TERMS_VERSION);

/** `unknown` (a key OpenRouter doesn't know) counts as `wrong`, like a wrong code. */
export type CodeCheck = 'ok' | 'wrong' | 'offline' | Exclude<KeyProblem, 'unknown'>;

const KEY_PROBLEMS: readonly string[] = ['no-limit', 'empty', 'down'] satisfies KeyProblem[];

/** `code` is a normalized code or a trimmed key (normalizeCredential). */
export const checkCode = async (code: string): Promise<CodeCheck> => {
  try {
    const res = await fetch('/api/access', { headers: { [ACCESS_CODE_HEADER]: code } });
    if (res.ok) return 'ok';
    if (res.status === 401) return 'wrong';
    const { reason } = (await res.json().catch(() => ({}))) as { reason?: unknown };
    return typeof reason === 'string' && KEY_PROBLEMS.includes(reason) ? (reason as CodeCheck) : 'offline';
  } catch {
    return 'offline';
  }
};

/**
 * The code from the link (?code=), removed from the address bar so kids don't pass it on. A key in a link
 * is dropped: the parents enter it themselves and agree to the terms.
 */
export const takeLinkCode = (): string | undefined => {
  const url = new URL(location.href);
  const code = url.searchParams.get('code');
  if (code === null) return undefined;
  url.searchParams.delete('code');
  history.replaceState(history.state, '', url);
  return isOpenRouterKey(code) ? undefined : normalizeCode(code) || undefined;
};
