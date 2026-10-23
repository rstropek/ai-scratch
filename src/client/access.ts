// The school's access code: typed in at the gate or passed as ?code= in the link, checked by the server
// (GET /api/access) and remembered in this browser, so a reload goes straight to the chat.
import { normalizeCode } from '../shared/access.ts';
import { ACCESS_CODE_HEADER } from '../shared/chat-types.ts';

const KEY = 'digiferien.accessCode';

// storage can be blocked (private windows, settings): then the code is just asked for again

export const storedCode = (): string | undefined => {
  try {
    return localStorage.getItem(KEY) ?? undefined;
  } catch {
    return undefined;
  }
};

export const storeCode = (code: string): void => {
  try {
    localStorage.setItem(KEY, code);
  } catch {
    // not remembered
  }
};

export const forgetCode = (): void => {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // nothing to forget
  }
};

export type CodeCheck = 'ok' | 'wrong' | 'offline';

export const checkCode = async (code: string): Promise<CodeCheck> => {
  try {
    const res = await fetch('/api/access', { headers: { [ACCESS_CODE_HEADER]: normalizeCode(code) } });
    return res.ok ? 'ok' : res.status === 401 ? 'wrong' : 'offline';
  } catch {
    return 'offline';
  }
};

/** The code from the link (?code=), removed from the address bar so kids don't pass it on. */
export const takeLinkCode = (): string | undefined => {
  const url = new URL(location.href);
  const code = url.searchParams.get('code');
  if (code === null) return undefined;
  url.searchParams.delete('code');
  history.replaceState(history.state, '', url);
  return normalizeCode(code) || undefined;
};
