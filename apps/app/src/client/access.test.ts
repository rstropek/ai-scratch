import { afterEach, describe, expect, test, vi } from 'vitest';
import { ACCESS_CODE_HEADER } from '../shared/chat-types.ts';
import {
  acceptTerms,
  checkCode,
  forgetCode,
  storeCode,
  storedCode,
  TERMS_VERSION,
  takeLinkCode,
  termsAccepted,
} from './access.ts';

afterEach(() => vi.unstubAllGlobals());

describe('remembered code', () => {
  test('is stored, read back and forgotten', () => {
    const items = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => items.get(k) ?? null,
      setItem: (k: string, v: string) => items.set(k, v),
      removeItem: (k: string) => items.delete(k),
    });
    expect(storedCode()).toBeUndefined();
    storeCode('schule1');
    expect(storedCode()).toBe('schule1');
    forgetCode();
    expect(storedCode()).toBeUndefined();
  });

  test("a key is forgotten together with the parents' consent to the terms", () => {
    const items = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => items.get(k) ?? null,
      setItem: (k: string, v: string) => items.set(k, v),
      removeItem: (k: string) => items.delete(k),
    });
    storeCode('sk-or-v1-Abc');
    expect(termsAccepted()).toBe(false);
    acceptTerms();
    expect(termsAccepted()).toBe(true);
    items.set('digiferien.termsAccepted', `${TERMS_VERSION}-old`);
    expect(termsAccepted()).toBe(false);
    acceptTerms();
    forgetCode();
    expect(storedCode()).toBeUndefined();
    expect(termsAccepted()).toBe(false);
  });

  test('blocked storage just means nothing is remembered', () => {
    const blocked = () => {
      throw new Error('SecurityError');
    };
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked, removeItem: blocked });
    expect(() => storeCode('schule1')).not.toThrow();
    expect(storedCode()).toBeUndefined();
    expect(() => forgetCode()).not.toThrow();
  });
});

describe('checkCode', () => {
  const answer = (response: Response | Error) => {
    const fetch = vi.fn(async () => {
      if (response instanceof Error) throw response;
      return response;
    });
    vi.stubGlobal('fetch', fetch);
    return fetch;
  };

  test('sends the code and reports ok', async () => {
    const fetch = answer(new Response(null, { status: 204 }));
    expect(await checkCode('schule1')).toBe('ok');
    expect(fetch).toHaveBeenCalledWith('/api/access', { headers: { [ACCESS_CODE_HEADER]: 'schule1' } });
  });

  test('401 is a wrong code, anything else a connection problem', async () => {
    answer(Response.json({ error: 'Falscher Zugangscode' }, { status: 401 }));
    expect(await checkCode('x')).toBe('wrong');
    answer(new Response('', { status: 502 }));
    expect(await checkCode('x')).toBe('offline');
    answer(new TypeError('Failed to fetch'));
    expect(await checkCode('x')).toBe('offline');
  });

  test("a key's problems are told apart; a key OpenRouter doesn't know is just wrong", async () => {
    const refused = (status: number, reason: string) => answer(Response.json({ error: 'x', reason }, { status }));
    refused(403, 'no-limit');
    expect(await checkCode('sk-or-v1-x')).toBe('no-limit');
    refused(402, 'empty');
    expect(await checkCode('sk-or-v1-x')).toBe('empty');
    refused(503, 'down');
    expect(await checkCode('sk-or-v1-x')).toBe('down');
    refused(401, 'unknown');
    expect(await checkCode('sk-or-v1-x')).toBe('wrong');
  });
});

describe('takeLinkCode', () => {
  const visit = (url: string) => {
    const replaced: string[] = [];
    vi.stubGlobal('location', new URL(url));
    vi.stubGlobal('history', {
      state: null,
      replaceState: (_s: unknown, _t: string, u: URL) => replaced.push(String(u)),
    });
    return replaced;
  };

  test('takes the code, normalized, and removes it from the address bar', () => {
    const replaced = visit('https://app.test/?code=%20Schule1&x=1');
    expect(takeLinkCode()).toBe('schule1');
    expect(replaced).toEqual(['https://app.test/?x=1']);
  });

  test('drops a key in the link: parents enter it themselves and agree to the terms', () => {
    const replaced = visit('https://app.test/?code=sk-or-v1-Abc');
    expect(takeLinkCode()).toBeUndefined();
    expect(replaced).toEqual(['https://app.test/']);
  });
});
