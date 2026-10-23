import { describe, expect, test } from 'vitest';
import { anthropicMessage, anthropicSse, sseResponse } from '../../test/support/anthropic-sse.ts';
import type { ChatMessage } from '../shared/chat-types.ts';
import { CONTEXT_LIMIT } from '../shared/energy.ts';
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
  accessCodes: new Set(['schule1', 'admin_test']),
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
    const body = JSON.parse(String(init?.body));
    requests.push({ url: String(url), headers: new Headers(init?.headers), body });
    // generateText (compact) asks for a plain JSON message
    if (!body.stream) return Response.json(anthropicMessage(reply));
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
const post = (app: ReturnType<typeof setup>['app'], body: unknown, code = 'schule1', route = '/api/chat') =>
  app.request(route, {
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

  test('the gate checks a code without calling anything; case and spaces do not matter', async () => {
    const { app, requests, records } = setup('');
    const check = (code?: string) =>
      app.request('/api/access', { headers: code === undefined ? {} : { 'X-Access-Code': code } });
    expect((await check('schule1')).status).toBe(204);
    expect((await check(' Schule1 ')).status).toBe(204);
    expect((await check('falsch')).status).toBe(401);
    expect((await check()).status).toBe(401);
    expect(requests).toEqual([]);
    expect(records).toEqual([]);
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

  test('cache breakpoints: system prompt, end of the earlier turns, end of the request', async () => {
    const { app, requests } = setup(anthropicSse({ text: 'Ok' }));
    const earlier = { id: 'a1', role: 'assistant', parts: [{ type: 'text', text: 'Hi!' }] };
    await (await post(app, { messages: [userMessage('Hallo'), earlier, userMessage('Weiter', 'u2')] })).text();
    const body = requests[0]?.body as {
      system: { cache_control?: unknown }[];
      messages: { role: string; content: { text: string; cache_control?: unknown }[] }[];
      cache_control?: unknown;
    };
    const ephemeral = { type: 'ephemeral' };
    expect(body.system.at(-1)?.cache_control).toEqual(ephemeral);
    expect(body.cache_control).toEqual(ephemeral); // automatic: moves along with the turn
    expect(body.messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user']);
    expect(body.messages[1]?.content.at(-1)).toEqual({ type: 'text', text: 'Hi!', cache_control: ephemeral });
    expect(body.messages[2]?.content.some((b) => b.cache_control)).toBe(false);
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

describe('KI-Energie', () => {
  const assistant = (id: string, text: string, metadata?: ChatMessage['metadata']) => ({
    id,
    role: 'assistant',
    parts: [{ type: 'step-start' }, { type: 'text', text }],
    ...(metadata ? { metadata } : {}),
  });

  test('a kid gets three messages, the fourth waits for the next heart without calling Jev or the model', async () => {
    const { app, requests, jevRequests } = setup(anthropicSse({ text: 'Ok' }));
    for (const i of [1, 2, 3]) {
      const ok = await post(app, { messages: [userMessage(`m${i}`)] });
      expect(ok.status).toBe(200);
      await ok.text(); // the model is called while the stream is read
    }
    const res = await post(app, { messages: [userMessage('m4')] });
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toMatch(/^Deine Herzen sind leer\. In (19|20) Sekunden kommt ein neues\.$/);
    expect(body.retryInMs).toBeGreaterThan(19_000);
    expect(jevRequests).toHaveLength(3);
    expect(requests).toHaveLength(3);
    expect(await stats(app)).toMatchObject({ energy: { heartsEmpty: 1 } });
  });

  test('tool results within a turn cost no heart, admin codes have no limit', async () => {
    const { app } = setup(anthropicSse({ text: 'Ok' }));
    for (const i of [1, 2, 3]) await (await post(app, { messages: [userMessage(`m${i}`)] })).text();
    const toolStep = {
      id: 'a1',
      role: 'assistant',
      parts: [
        { type: 'step-start' },
        { type: 'tool-green_flag', toolCallId: 't1', state: 'output-available', input: {}, output: { ok: true } },
      ],
    };
    expect((await post(app, { messages: [userMessage('m3'), toolStep] })).status).toBe(200);
    for (const i of [1, 2, 3, 4, 5]) {
      expect((await post(app, { messages: [userMessage(`a${i}`)] }, 'admin_test')).status).toBe(200);
    }
  });

  test('the first request of a turn reports the context, later requests only the usage', async () => {
    const { app } = setup(
      anthropicSse({ text: 'Ok', usage: { input_tokens: 200, output_tokens: 5, cache_read_input_tokens: 9000 } }),
    );
    const first = await (await post(app, chatBody)).text();
    expect(first).toMatch(/"type":"finish".*"context":9200/);
    const toolStep = {
      id: 'a1',
      role: 'assistant',
      parts: [
        { type: 'step-start' },
        { type: 'tool-green_flag', toolCallId: 't1', state: 'output-available', input: {}, output: { ok: true } },
      ],
    };
    const later = await (await post(app, { messages: [userMessage('Hallo'), toolStep] })).text();
    expect(later).toMatch(/"type":"finish".*"usage"/);
    expect(later).not.toContain('"context"');
  });

  test('a full memory refuses the next message until the kid compacts or clears', async () => {
    const { app, requests, jevRequests } = setup(anthropicSse({ text: 'Ok' }));
    const full = [
      userMessage('m1', 'u1'),
      assistant('a1', 'Antwort', { context: CONTEXT_LIMIT }),
      userMessage('m2', 'u2'),
    ];
    const res = await post(app, { messages: full });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/Gedächtnis ist voll/);
    expect(jevRequests).toEqual([]);
    expect(requests).toEqual([]);

    // after compacting only the summary is left: nothing more to free, so the message goes through
    const compacted = [
      assistant('s1', 'Zusammenfassung', { summary: true, context: CONTEXT_LIMIT }),
      userMessage('m3'),
    ];
    expect(await (await post(app, { messages: compacted })).text()).toContain('"delta":"Ok"');
    // the summary and the new message reach Anthropic as one user message
    expect(requests[0]?.body.messages).toEqual([expect.objectContaining({ role: 'user' })]);
    expect(JSON.stringify(requests[0]?.body.messages)).toMatch(/Zusammenfassung des bisherigen.*Zusammenfassung.*m3/);
    expect(await stats(app)).toMatchObject({ energy: { memoryFull: 1 } });
  });

  test('compact summarizes the text of the conversation and logs the call', async () => {
    const { app, requests, records } = setup('**Dein Spiel**: Fang mich');
    const messages = [
      userMessage('Ein Fisch soll vor dem Hai flüchten'),
      {
        id: 'a1',
        role: 'assistant',
        parts: [
          { type: 'reasoning', text: 'geheim' },
          { type: 'tool-add_scripts', toolCallId: 't1', state: 'output-available', input: {}, output: { ok: true } },
          { type: 'text', text: 'Der Fisch schwimmt jetzt.' },
        ],
      },
    ];
    const res = await post(app, { messages }, 'schule1', '/api/compact');
    expect(await res.json()).toEqual({ summary: '**Dein Spiel**: Fang mich', tokens: 50 });
    const sent = JSON.stringify(requests[0]?.body.messages);
    expect(sent).toContain('Kind: Ein Fisch soll vor dem Hai flüchten');
    expect(sent).toContain('KI-Helfer: [Ausgeführte Werkzeuge: add_scripts]');
    expect(sent).not.toContain('geheim');
    expect(sent).not.toContain('"project"');
    await expect.poll(() => records.length).toBe(1);
    expect(records[0]).toMatchObject({ purpose: 'compact', session: 'sess', turn: 1 });
    expect(await stats(app)).toMatchObject({ calls: 1, energy: { compacts: 1 } });
  });

  test('compact refuses an empty conversation and reports a failed model call in German', async () => {
    const { app } = setup('');
    expect((await post(app, { messages: [] }, 'schule1', '/api/compact')).status).toBe(400);
    const res = await post(app, { messages: [userMessage('Hallo')] }, 'schule1', '/api/compact');
    expect(res.status).toBe(502);
    expect((await res.json()).error).toMatch(/Zusammenfassen hat nicht geklappt/);
  });
});
