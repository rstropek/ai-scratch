import { describe, expect, test } from 'vitest';
import type { LockerGame } from '../../shared/locker.ts';
import { OFFLINE } from '../chat/errors.ts';
import { createLockerApi, LockerCallError, savedLabel } from './locker.ts';

const GAME: LockerGame = { projectId: 'p1', fileId: 'f1', name: 'Hai-Alarm', savedAt: '', size: 1 };

const setup = (answer: () => Response | Promise<Response>) => {
  const calls: { url: string; init: RequestInit }[] = [];
  const api = createLockerApi({
    fetch: async (url, init = {}) => {
      calls.push({ url: String(url), init });
      return answer();
    },
  });
  return { api, calls };
};

describe('createLockerApi', () => {
  test('sends the Locker code as a header (no access code: the Locker works without) and the name in the query', async () => {
    const { api, calls } = setup(() => Response.json({ games: [GAME] }));
    const sb3 = new Blob(['x']);
    expect(await api.save('K7QM4XRT', 'Ja & Nein', sb3, GAME)).toEqual([GAME]);
    expect(calls[0]?.url).toBe('/api/locker/games?name=Ja+%26+Nein&projectId=p1&fileId=f1');
    expect(calls[0]?.init).toMatchObject({
      method: 'POST',
      body: sb3,
      headers: { 'X-Locker-Code': 'K7QM4XRT' },
    });
    await api.save('K7QM4XRT', 'Neu', sb3);
    expect(calls[1]?.url).toBe('/api/locker/games?name=Neu');
  });

  test('loads the bytes of a game', async () => {
    const { api, calls } = setup(() => new Response(new Uint8Array([1, 2, 3])));
    expect((await api.load('K7QM4XRT', GAME)).byteLength).toBe(3);
    expect(calls[0]?.url).toBe('/api/locker/games/p1/f1');
  });

  test("errors carry the server's German text", async () => {
    const wrong = setup(() => Response.json({ error: 'Mit diesem Code geht kein Locker auf.' }, { status: 404 }));
    await expect(wrong.api.list('K7QM4XRT')).rejects.toMatchObject({
      kind: 'not-found',
      message: 'Mit diesem Code geht kein Locker auf.',
    });
    const offline = setup(() => Promise.reject(new TypeError('Failed to fetch')));
    await expect(offline.api.list('K7QM4XRT')).rejects.toEqual(new LockerCallError(OFFLINE, 'other'));
  });
});

test('savedLabel says when, the way kids say it', () => {
  const now = new Date(2026, 10, 3, 15, 0);
  expect(savedLabel(new Date(2026, 10, 3, 11, 5).toISOString(), now)).toBe('heute, 11:05');
  expect(savedLabel(new Date(2026, 10, 2, 9, 48).toISOString(), now)).toBe('gestern, 09:48');
  expect(savedLabel(new Date(2026, 9, 27, 14, 0).toISOString(), now)).toMatch(/^Di\.?, 27\. Okt\.?, 14:00$/);
  expect(savedLabel(new Date(2025, 9, 27, 14, 0).toISOString(), now)).toMatch(/2025/);
});
