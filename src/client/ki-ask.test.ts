import { afterEach, describe, expect, test, vi } from 'vitest';
import { HEARTS } from '../shared/energy.ts';
import { ASK_FAILED, ASK_NO_CODE } from '../shared/ki-block.ts';
import { createHeartsStore } from './hearts.ts';
import { createAsk } from './ki-ask.ts';

afterEach(() => vi.useRealTimers());

/** a fake /api/ask: answers in order, the last one repeats */
const server = (...responses: (() => Response)[]) => {
  const bodies: unknown[] = [];
  const fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    return (responses.length > 1 ? responses.shift() : responses[0])?.() ?? Response.json({});
  });
  return { fetch: fetch as unknown as typeof globalThis.fetch, bodies, calls: () => fetch.mock.calls.length };
};
const answer = (text: string) => () => Response.json({ answer: text });
const setup = (code = 'schule1', ...responses: (() => Response)[]) => {
  const hearts = createHeartsStore();
  const api = server(...(responses.length ? responses : [answer('Hallo!')]));
  const denied = vi.fn();
  const ask = createAsk({ accessCode: code, sessionId: 's', hearts, onAccessDenied: denied, fetch: api.fetch });
  return { ask, hearts, api, denied };
};
const signal = () => new AbortController().signal;

describe('frage KI in the browser', () => {
  test('each question costs a heart; without one it waits for the next heart', async () => {
    vi.useFakeTimers();
    const { ask, hearts, api } = setup();
    for (const i of [1, 2, 3]) expect(await ask(`Frage ${i}`, signal())).toBe('Hallo!');
    expect(api.bodies).toEqual([{ question: 'Frage 1' }, { question: 'Frage 2' }, { question: 'Frage 3' }]);
    const fourth = ask('Frage 4', signal());
    await vi.advanceTimersByTimeAsync(HEARTS.refillMs - 100);
    expect(api.calls()).toBe(3);
    await vi.advanceTimersByTimeAsync(200);
    expect(await fourth).toBe('Hallo!');
    expect(hearts.bucket().hearts).toBeLessThan(1);
  });

  test("the server's 429 sets the clock and the question is asked again after the wait", async () => {
    vi.useFakeTimers();
    const { ask, api } = setup(
      'schule1',
      () => Response.json({ error: 'leer', retryInMs: 5000 }, { status: 429 }),
      answer('Jetzt!'),
    );
    const result = ask('Hallo', signal());
    await vi.advanceTimersByTimeAsync(4900);
    expect(api.calls()).toBe(1);
    await vi.advanceTimersByTimeAsync(200);
    expect(await result).toBe('Jetzt!');
  });

  test('stopping the project while it waits for a heart asks nothing', async () => {
    vi.useFakeTimers();
    const { ask, hearts, api } = setup();
    for (const _ of [1, 2, 3]) hearts.take();
    const stop = new AbortController();
    const result = ask('Hallo', stop.signal);
    stop.abort();
    await expect(result).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(HEARTS.refillMs);
    expect(api.calls()).toBe(0);
  });

  test('admin codes use no hearts; a refused code and a failed call get German answers', async () => {
    const admin = setup('admin_test');
    for (const _ of [1, 2, 3, 4, 5]) await admin.ask('Hallo', signal());
    expect(admin.hearts.bucket().hearts).toBe(HEARTS.max);

    const denied = setup('schule1', () => new Response(null, { status: 401 }));
    expect(await denied.ask('Hallo', signal())).toBe(ASK_NO_CODE);
    expect(denied.denied).toHaveBeenCalled();

    const failed = setup('schule1', () => Response.json({ error: 'kaputt' }, { status: 502 }));
    expect(await failed.ask('Hallo', signal())).toBe(ASK_FAILED);
  });
});
