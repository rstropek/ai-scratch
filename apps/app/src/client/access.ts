// The access code from the office: typed in at the gate (or as ?code= in the link), checked by the server (GET
// /api/access) and remembered in this browser, so a reload goes straight to the chat.
import { type AccessInfo, normalizeCode } from '../shared/access.ts';
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

export const storeCode = (code: string | undefined): void => {
  try {
    if (code === undefined) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, code);
  } catch {
    // not remembered, or nothing to forget
  }
};

export const forgetCode = (): void => storeCode(undefined);

/** `refused`: the code exists but can't be used now (not valid yet, expired, budget used up); `error` says why, in German for the kid */
export type CodeCheck =
  | { result: 'ok'; info: AccessInfo }
  | { result: 'wrong' }
  | { result: 'offline' }
  | { result: 'refused'; error: string };

/** `code` is normalized */
export const checkCode = async (code: string): Promise<CodeCheck> => {
  try {
    const res = await fetch('/api/access', { headers: { [ACCESS_CODE_HEADER]: code } });
    if (res.ok) return { result: 'ok', info: (await res.json()) as AccessInfo };
    if (res.status === 401) return { result: 'wrong' };
    const { error } = (await res.json().catch(() => ({}))) as { error?: unknown };
    return typeof error === 'string' ? { result: 'refused', error } : { result: 'offline' };
  } catch {
    return { result: 'offline' };
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
