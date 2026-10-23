import { describe, expect, test } from 'vitest';
import { decide, JEV_URL, MAX_MESSAGE_LENGTH, QUESTIONS, screen } from './guard.ts';

const answers = (nouls: Record<string, number>) => ({
  model: 'jev-1.13.0',
  answers: Object.fromEntries(Object.keys(QUESTIONS).map((id) => [id, { type: 'noul', noul: nouls[id] ?? 0.01 }])),
});

describe('decide', () => {
  test('nothing fires below the thresholds', () => {
    expect(decide({ insult: 0.69, flooding: 0.5, distress: 0.49 })).toBeUndefined();
  });

  test('several questions lead to one category; distress beats everything else', () => {
    expect(decide({ bullying: 0.8 })).toBe('inappropriate');
    expect(decide({ jailbreak: 0.9 })).toBe('misuse');
    expect(decide({ jailbreak: 0.9, insult: 0.9 })).toBe('inappropriate');
    expect(decide({ insult: 0.95, distress: 0.6 })).toBe('distress');
  });
});

describe('screen', () => {
  test('asks Jev all questions about the message and the previous answer', async () => {
    const requests: { url: string; init?: RequestInit }[] = [];
    const result = await screen('1000 mal', 'Wie oft soll sie miauen?', {
      apiKey: 'k',
      model: 'jev-1.13.0',
      fetch: async (url, init) => {
        requests.push({ url: String(url), init });
        return Response.json(answers({ flooding: 0.2 }));
      },
    });
    expect(result).toMatchObject({ category: undefined, model: 'jev-1.13.0', nouls: { flooding: 0.2 } });
    expect(requests[0]?.url).toBe(JEV_URL);
    expect(new Headers(requests[0]?.init?.headers).get('Authorization')).toBe('Bearer k');
    const body = JSON.parse(String(requests[0]?.init?.body));
    expect(body.state).toEqual({ previous_assistant_message: 'Wie oft soll sie miauen?', kid_message: '1000 mal' });
    expect(Object.keys(body.questions)).toEqual(Object.keys(QUESTIONS));
  });

  test('an overlong message is refused without asking Jev', async () => {
    let called = false;
    const result = await screen('x'.repeat(MAX_MESSAGE_LENGTH + 1), undefined, {
      apiKey: 'k',
      model: 'm',
      fetch: async () => {
        called = true;
        return Response.json({});
      },
    });
    expect(result.category).toBe('too_long');
    expect(called).toBe(false);
  });

  test.each([
    ['an error status', async () => new Response('overloaded', { status: 529 })],
    ['an answer without nouls', async () => Response.json({ answers: {} })],
    ['a network error', async () => Promise.reject(new TypeError('fetch failed'))],
    ['a timeout', async () => Promise.reject(new DOMException('timed out', 'TimeoutError'))],
  ])('fails open on %s', async (_name, fakeFetch: () => Promise<Response>) => {
    const result = await screen('Hallo', undefined, { apiKey: 'k', model: 'm', fetch: fakeFetch });
    expect(result.category).toBeUndefined();
    expect(result.error).toBeTruthy();
  });
});
