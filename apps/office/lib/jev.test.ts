import { describe, expect, it } from 'vitest';
import { createJevScreener, JEV_URL } from './jev.ts';

const application = { schoolName: 'MS Lindenweg', schoolUrl: 'https://ms.at/', grades: ['unterstufe'], summary: 'x' };

const answering = (status: number, body: unknown) => {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetch = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(JSON.stringify(body), { status });
  };
  return { fetch: fetch as typeof globalThis.fetch, calls };
};

describe('the application screening', () => {
  it('asks Jev with the application as state and refuses what it is sure about', async () => {
    const { fetch, calls } = answering(200, {
      model: 'jev-1.13.0',
      answers: { not_genuine: { noul: 0.92 }, not_school: { noul: 0.5 }, abusive: { noul: 0.01 } },
    });
    const verdict = await createJevScreener({ apiKey: 'k', model: 'jev-1.13.0', fetch })(application);
    expect(verdict).toEqual({
      reasons: ['not_genuine'],
      nouls: { not_genuine: 0.92, not_school: 0.5, abusive: 0.01 },
      model: 'jev-1.13.0',
    });
    expect(calls[0]?.url).toBe(JEV_URL);
    const body = JSON.parse(String(calls[0]?.init.body));
    expect(body.state).toEqual({
      school_name: 'MS Lindenweg',
      school_url: 'https://ms.at/',
      grades: 'unterstufe',
      summary: 'x',
    });
    expect(Object.keys(body.questions)).toEqual(['not_genuine', 'not_school', 'abusive']);
  });

  it('lets the application through when Jev fails or answers incompletely', async () => {
    const down = await createJevScreener({ apiKey: 'k', model: 'm', fetch: answering(500, {}).fetch })(application);
    expect(down.reasons).toEqual([]);
    expect(down.error).toMatch(/500/);
    const partial = answering(200, { answers: { not_genuine: { noul: 0.99 } } }).fetch;
    const incomplete = await createJevScreener({ apiKey: 'k', model: 'm', fetch: partial })(application);
    expect(incomplete.reasons).toEqual([]);
    expect(incomplete.error).toMatch(/not_school/);
  });
});
