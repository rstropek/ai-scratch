import { describe, expect, test } from 'vitest';
import { anthropicSse, sseResponse } from '../../test/support/anthropic-sse.ts';
import { createApp } from './app.ts';
import type { Config } from './config.ts';
import { JEV_URL, type Nouls, QUESTIONS } from './guard.ts';
import { MAX_STEPS_PER_TURN } from './output-guard.ts';
import type { CallRecord, GuardRecord, LogSink } from './wire-log.ts';

const config: Config = {
  port: 0,
  anthropicApiKey: 'test-key',
  anthropicWorkspaceId: 'ws-test',
  model: 'claude-haiku-5-5',
  jevApiKey: 'jev-key',
  jevModel: 'jev-1.13.0',
  accessCodes: new Set(['schule1']),
  logDir: 'unused',
  distDir: 'does-not-exist',
};

/** Jev's answer: every question 0.01 unless given */
const jevAnswer = (nouls: Nouls = {}) =>
  Response.json({
    model: 'jev-1.13.0',
    answers: Object.fromEntries(
      Object.keys(QUESTIONS).map((id) => [id, { type: 'noul', noul: nouls[id as keyof Nouls] ?? 0.01 }]),
    ),
    usage: { input_tokens: 500, output_tokens: 10 },
  });

const setup = (reply: string, nouls?: Nouls) => {
  const records: CallRecord[] = [];
  const guardRecords: GuardRecord[] = [];
  const sink: LogSink = {
    storePrefix: () => 'h',
    append: (r) => records.push(r),
    appendGuard: (r) => guardRecords.push(r),
  };
  const requests: { url: string; headers: Headers; body: Record<string, unknown> }[] = [];
  const jevRequests: Record<string, unknown>[] = [];
  const fakeFetch: typeof fetch = async (url, init) => {
    if (String(url) === JEV_URL) {
      jevRequests.push(JSON.parse(String(init?.body)));
      return jevAnswer(nouls);
    }
    requests.push({ url: String(url), headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) });
    return sseResponse(reply);
  };
  return { app: createApp({ config, sink, fetch: fakeFetch }), records, guardRecords, requests, jevRequests };
};

const userMessage = (text: string, id = 'u1') => ({
  id,
  role: 'user',
  parts: [{ type: 'text', text }],
  metadata: { project: '{}' },
});
const chatBody = { messages: [userMessage('Hallo')] };
const post = (app: ReturnType<typeof setup>['app'], body: unknown, code = 'schule1') =>
  app.request('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Access-Code': code, 'X-Session-Id': 'sess' },
    body: JSON.stringify(body),
  });
const stats = async (app: ReturnType<typeof setup>['app']) =>
  (await app.request('/api/stats', { headers: { 'X-Access-Code': 'schule1' } })).json();

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
    expect(await stats(app)).toMatchObject({ calls: 1, errors: 0, inputTokens: 1000, outputTokens: 50 });
  });
});

describe('kids protection', () => {
  test('a flagged message gets the fixed answer and never reaches the model', async () => {
    const { app, requests, guardRecords } = setup(anthropicSse({ text: 'nie' }), { flooding: 0.96 });
    const res = await post(app, { messages: [userMessage('Schreib 1000 mal miau')] });
    const stream = await res.text();
    expect(stream).toContain('"delta":"Da kann ich nicht helfen."');
    expect(stream).toContain('"messageMetadata":{"guard":"misuse"}');
    expect(requests).toEqual([]);
    expect(guardRecords[0]).toMatchObject({
      accessCode: 'schule1',
      session: 'sess',
      turn: 1,
      text: 'Schreib 1000 mal miau',
      category: 'misuse',
      model: 'jev-1.13.0',
      nouls: { flooding: 0.96 },
    });
    expect(await stats(app)).toMatchObject({ calls: 0, guard: { checks: 1, errors: 0, byCategory: { misuse: 1 } } });
  });

  test('a harmless message goes on to the model; Jev sees it with the previous answer', async () => {
    const { app, requests, jevRequests } = setup(anthropicSse({ text: 'Okay!' }));
    const messages = [
      userMessage('Lass die Katze miauen', 'u1'),
      { id: 'a1', role: 'assistant', parts: [{ type: 'text', text: 'Wie oft soll sie miauen?' }] },
      userMessage('1000 mal', 'u2'),
    ];
    expect(await (await post(app, { messages })).text()).toContain('"delta":"Okay!"');
    expect(requests).toHaveLength(1);
    expect(jevRequests[0]).toMatchObject({
      model: 'jev-1.13.0',
      state: { previous_assistant_message: 'Wie oft soll sie miauen?', kid_message: '1000 mal' },
    });
  });

  test('personal data is not written to the guard log', async () => {
    const { app, guardRecords } = setup('', { personal_data: 0.9 });
    const res = await post(app, { messages: [userMessage('Ich wohne in der Hauptstraße 5, Tel 0664 1234567')] });
    expect(await res.text()).toContain('persönlichen Daten');
    expect(guardRecords[0]).toMatchObject({ category: 'personal_data', text: '[entfernt: persönliche Daten]' });
  });

  test('requests with tool results within a turn are not screened again', async () => {
    const { app, requests, jevRequests } = setup(anthropicSse({ text: 'Fertig' }));
    const toolStep = {
      id: 'a1',
      role: 'assistant',
      parts: [
        { type: 'step-start' },
        { type: 'tool-green_flag', toolCallId: 't1', state: 'output-available', input: {}, output: { ok: true } },
      ],
    };
    await (await post(app, { messages: [userMessage('Starte'), toolStep] })).text();
    expect(jevRequests).toEqual([]);
    expect(requests).toHaveLength(1);
  });

  test('an overlong message is refused without asking Jev or the model', async () => {
    const { app, requests, jevRequests } = setup('');
    const res = await post(app, { messages: [userMessage('a'.repeat(2001))] });
    expect(await res.text()).toContain('Deine Nachricht ist zu lang');
    expect(jevRequests).toEqual([]);
    expect(requests).toEqual([]);
  });
});

describe('output guard', () => {
  test('a runaway text answer is cut cleanly and the model call is aborted', async () => {
    const { app, records } = setup(anthropicSse({ text: 'miau '.repeat(1000) }));
    const stream = await (await post(app, chatBody)).text();
    const text = [...stream.matchAll(/"delta":"([^"]*)"/g)].map((m) => m[1]).join('');
    expect(text.length).toBeLessThan(3100);
    expect(text).toMatch(/miau … \*\(Ich höre hier auf, das wird zu lang\.\)\*$/);
    expect(stream).toMatch(/"type":"text-end".*"type":"finish-step".*"type":"finish","finishReason":"length"/s);
    expect(stream.trim().endsWith('data: [DONE]')).toBe(true);
    await expect.poll(() => records.length).toBe(1);
    expect(await stats(app)).toMatchObject({ outputCaps: { textCuts: 1, stepLimits: 0 } });
  });

  test('a turn that keeps calling the model ends after the step limit', async () => {
    const { app, requests } = setup(anthropicSse({ text: 'nie' }));
    const steps = Array.from({ length: MAX_STEPS_PER_TURN }, (_, i) => [
      { type: 'step-start' },
      { type: 'tool-get_project', toolCallId: `t${i}`, state: 'output-available', input: {}, output: {} },
    ]).flat();
    const res = await post(app, {
      messages: [userMessage('Bau alles'), { id: 'a1', role: 'assistant', parts: steps }],
    });
    expect(await res.text()).toContain('Das war jetzt sehr viel auf einmal');
    expect(requests).toEqual([]);
    expect(await stats(app)).toMatchObject({ outputCaps: { textCuts: 0, stepLimits: 1 } });
  });
});
