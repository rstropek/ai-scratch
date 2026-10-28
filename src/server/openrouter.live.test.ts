// Live test of the OpenRouter path with a real key: `npm run test:live` (reads OPENROUTER_API_KEY, and
// ANTHROPIC_API_KEY and JEV_API_KEY for the config and the guard, from .env). Real calls, about 2 cents.
// The key needs a spending limit with money left. Not part of `npm test`.
import { parseJsonEventStream, readUIMessageStream, uiMessageChunkSchema } from 'ai';
import { describe, expect, test } from 'vitest';
import type { ChatMessage } from '../shared/chat-types.ts';
import { ASK_PATH } from '../shared/ki-block.ts';
import { createApp } from './app.ts';
import { loadConfig } from './config.ts';
import { noLogSink } from './wire-log.ts';

const KEY = process.env.OPENROUTER_API_KEY?.trim() ?? '';

const userMessage = (text: string, id: string): ChatMessage => ({
  id,
  role: 'user',
  parts: [{ type: 'text', text }],
  metadata: { project: '{}' },
});

/** The answer as the browser builds it, and any error chunks. */
const readAnswer = async (res: Response) => {
  const errors: string[] = [];
  const chunks = parseJsonEventStream({ stream: res.body as ReadableStream<Uint8Array>, schema: uiMessageChunkSchema });
  let answer: ChatMessage | undefined;
  for await (const m of readUIMessageStream<ChatMessage>({
    stream: chunks.pipeThrough(
      new TransformStream({
        transform(c, out) {
          if (!c.success) return;
          if (c.value.type === 'error') errors.push(c.value.errorText);
          out.enqueue(c.value);
        },
      }),
    ),
  }))
    answer = m;
  return { answer, errors };
};

const textOf = (m: ChatMessage | undefined) =>
  (m?.parts ?? []).flatMap((p) => (p.type === 'text' ? [p.text] : [])).join('');

describe.skipIf(!KEY)('OpenRouter with a real key', () => {
  const app = createApp({ config: loadConfig({ ...process.env, ACCESS_CODES: 'live', LOG_DIR: '' }), sink: noLogSink });
  const post = (route: string, body: unknown) =>
    app.request(route, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Access-Code': KEY, 'X-Session-Id': 'live' },
      body: JSON.stringify(body),
    });

  test('the gate accepts the key and refuses a made-up one', async () => {
    const check = (key: string) => app.request('/api/access', { headers: { 'X-Access-Code': key } });
    expect((await check(KEY)).status).toBe(204);
    const fake = await check(`sk-or-v1-${'0'.repeat(64)}`);
    expect(fake.status).toBe(401);
    expect(await fake.json()).toMatchObject({ reason: 'unknown' });
  });

  test('two chat turns: an answer with usage, and the first answer (signed thinking included) goes back without an error', async () => {
    const first = userMessage('Hallo! Sag in einem kurzen Satz, was du kannst.', 'u1');
    const turn1 = await readAnswer(await post('/api/chat', { messages: [first] }));
    expect(turn1.errors).toEqual([]);
    expect(textOf(turn1.answer)).not.toBe('');
    expect(turn1.answer?.metadata?.context).toBeGreaterThan(1000);

    const second = userMessage('Und wie heißt der Block, der eine Figur bewegt? Nur der Name.', 'u2');
    const turn2 = await readAnswer(
      await post('/api/chat', { messages: [first, turn1.answer, second].filter(Boolean) }),
    );
    expect(turn2.errors).toEqual([]);
    expect(textOf(turn2.answer)).not.toBe('');
  });

  test('"Zusammenfassen" and the "frage KI" block answer through the key', async () => {
    const assistant: ChatMessage = {
      id: 'a1',
      role: 'assistant',
      parts: [{ type: 'text', text: 'Super, ein Fangspiel mit einem Hai und einem Fisch!' }],
    };
    const compact = await post('/api/compact', {
      messages: [userMessage('Ich will ein Fangspiel mit einem Hai bauen.', 'u1'), assistant],
    });
    expect(compact.status).toBe(200);
    expect((await compact.json()).summary).toMatch(/\w/);

    const ask = await post(ASK_PATH, { question: 'Wie viele Beine hat eine Spinne?' });
    expect(ask.status).toBe(200);
    expect((await ask.json()).answer).toMatch(/\w/);
  });
});
