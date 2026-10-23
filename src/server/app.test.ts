import { describe, expect, test } from 'vitest';
import { anthropicSse, sseResponse } from '../../test/support/anthropic-sse.ts';
import { createApp } from './app.ts';
import type { Config } from './config.ts';
import type { CallRecord, LogSink } from './wire-log.ts';

const config: Config = {
  port: 0,
  anthropicApiKey: 'test-key',
  anthropicWorkspaceId: 'ws-test',
  model: 'claude-haiku-5-5',
  accessCodes: new Set(['schule1']),
  logDir: 'unused',
  distDir: 'does-not-exist',
};

const setup = (reply: string) => {
  const records: CallRecord[] = [];
  const sink: LogSink = { storePrefix: () => 'h', append: (r) => records.push(r) };
  const requests: { url: string; headers: Headers; body: Record<string, unknown> }[] = [];
  const fakeFetch: typeof fetch = async (url, init) => {
    requests.push({ url: String(url), headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) });
    return sseResponse(reply);
  };
  return { app: createApp({ config, sink, fetch: fakeFetch }), records, requests };
};

const chatBody = {
  messages: [{ id: 'u1', role: 'user', parts: [{ type: 'text', text: 'Hallo' }], metadata: { project: '{}' } }],
};
const post = (app: ReturnType<typeof setup>['app'], body: unknown, code = 'schule1') =>
  app.request('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Access-Code': code, 'X-Session-Id': 'sess' },
    body: JSON.stringify(body),
  });

describe('api', () => {
  test('rejects requests without a valid access code', async () => {
    const { app, requests } = setup('');
    const res = await post(app, chatBody, 'falsch');
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Falscher Zugangscode' });
    expect((await app.request('/api/stats')).status).toBe(401);
    expect(requests).toEqual([]);
  });

  test('rejects malformed chat requests', async () => {
    const { app } = setup('');
    expect((await post(app, { messages: 'x' })).status).toBe(400);
  });

  test('streams the model answer as UI message stream and logs the call', async () => {
    const { app, records, requests } = setup(anthropicSse({ text: 'Hallo Kind!' }));
    const res = await post(app, chatBody);
    expect(res.status).toBe(200);
    const stream = await res.text();
    expect(stream).toContain('"delta":"Hallo Kind!"');
    expect(stream).toMatch(/"type":"finish".*"usage"/);

    const call = requests[0];
    expect(call?.url).toMatch(/\/messages$/);
    expect(call?.headers.get('anthropic-workspace-id')).toBe('ws-test');
    expect(call?.body).toMatchObject({ model: 'claude-haiku-5-5', max_tokens: 16000, stream: true });
    expect(call?.body.tools).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'add_scripts' })]));

    await expect.poll(() => records.length).toBe(1);
    expect(records[0]).toMatchObject({ accessCode: 'schule1', session: 'sess', turn: 1, status: 200 });
    const stats = await (await app.request('/api/stats', { headers: { 'X-Access-Code': 'schule1' } })).json();
    expect(stats).toMatchObject({ calls: 1, errors: 0, inputTokens: 1000, outputTokens: 50 });
  });
});
