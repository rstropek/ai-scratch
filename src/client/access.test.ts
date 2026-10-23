import { afterEach, describe, expect, test, vi } from 'vitest';
import { ACCESS_CODE_HEADER } from '../shared/chat-types.ts';
import { checkCode, forgetCode, storeCode, storedCode } from './access.ts';

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

  test('sends the normalized code and reports ok', async () => {
    const fetch = answer(new Response(null, { status: 204 }));
    expect(await checkCode(' Schule1 ')).toBe('ok');
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
});
