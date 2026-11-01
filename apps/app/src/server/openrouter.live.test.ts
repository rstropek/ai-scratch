// Live test of the own-key path with a real OpenRouter key: `npm run test:live` (reads OPENROUTER_API_KEY, and
// JEV_API_KEY for the guard, from .env). The key is stored sealed behind a code in an in-memory database (PGlite),
// as the office stores it. Real calls, about 2 cents. The key needs a spending limit with money left. Not part
// of `npm test`.
import { randomBytes, randomUUID } from 'node:crypto';
import { createKeyBox, generateCode, schema } from '@ai-scratch/db';
import { createTestDb } from '@ai-scratch/db/testing';
import { parseJsonEventStream, readUIMessageStream, uiMessageChunkSchema } from 'ai';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
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

describe.skipIf(!KEY)('an own-key code with a real OpenRouter key', () => {
  const master = randomBytes(32);
  const code = generateCode();
  let app: ReturnType<typeof createApp>;
  let close: () => Promise<void>;
  beforeAll(async () => {
    const test = await createTestDb();
    close = test.close;
    const keyId = randomUUID();
    await test.db.insert(schema.user).values({ id: 'parent', name: 'Eltern', email: 'eltern@example.com' });
    await test.db.insert(schema.openrouterKey).values({
      id: keyId,
      ownerId: 'parent',
      label: 'live',
      keySealed: createKeyBox(master).seal(keyId, KEY),
      keyFingerprint: keyId,
      keyHint: KEY.slice(-4),
    });
    await test.db.insert(schema.accessCode).values({
      code,
      ownerId: 'parent',
      source: 'openrouter',
      openrouterKeyId: keyId,
      startsAt: new Date(Date.now() - 60_000),
      endsAt: new Date(Date.now() + 3_600_000),
    });
    const env = { ...process.env, DATABASE_URL: 'postgres://pglite', KEY_ENCRYPTION_KEY: master.toString('base64') };
    app = createApp({ config: loadConfig({ ...env, TEST_CODES: '', LOG_DIR: '' }), sink: noLogSink, db: test.db });
  });
  afterAll(() => close());
  const post = (route: string, body: unknown) =>
    app.request(route, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Access-Code': code, 'X-Session-Id': 'live' },
      body: JSON.stringify(body),
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
