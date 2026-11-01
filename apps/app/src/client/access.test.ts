import { afterEach, describe, expect, test, vi } from 'vitest';
import { ACCESS_CODE_HEADER } from '../shared/chat-types.ts';
import { checkCode, forgetCode, storeCode, storedCode, takeLinkCode } from './access.ts';

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
    storeCode('tiger-apfel-48');
    expect(storedCode()).toBe('tiger-apfel-48');
    forgetCode();
    expect(storedCode()).toBeUndefined();
  });

  test('blocked storage just means nothing is remembered', () => {
    const blocked = () => {
      throw new Error('SecurityError');
    };
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked, removeItem: blocked });
    expect(() => storeCode('tiger-apfel-48')).not.toThrow();
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

  test('sends the code and reports what the chat shows of it', async () => {
    const info = { endsAt: '2026-11-10T09:50:00.000Z', ask: true };
    const fetch = answer(Response.json(info));
    expect(await checkCode('tiger-apfel-48')).toEqual({ result: 'ok', info });
    expect(fetch).toHaveBeenCalledWith('/api/access', { headers: { [ACCESS_CODE_HEADER]: 'tiger-apfel-48' } });
  });

  test("401 is a wrong code; a refusal carries the server's text; anything else is a connection problem", async () => {
    answer(Response.json({ error: 'Falscher Zugangscode' }, { status: 401 }));
    expect(await checkCode('x')).toEqual({ result: 'wrong' });
    answer(Response.json({ error: 'Dein Code gilt erst ab 10:00 Uhr.', reason: 'not-yet' }, { status: 403 }));
    expect(await checkCode('x')).toEqual({ result: 'refused', error: 'Dein Code gilt erst ab 10:00 Uhr.' });
    answer(new Response('', { status: 502 }));
    expect(await checkCode('x')).toEqual({ result: 'offline' });
    answer(new TypeError('Failed to fetch'));
    expect(await checkCode('x')).toEqual({ result: 'offline' });
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
    const replaced = visit('https://app.test/?code=%20Tiger%20Apfel%2048&x=1');
    expect(takeLinkCode()).toBe('tiger-apfel-48');
    expect(replaced).toEqual(['https://app.test/?x=1']);
  });
});
