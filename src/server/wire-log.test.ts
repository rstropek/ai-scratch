import { describe, expect, test } from 'vitest';
import { anthropicSse, sseResponse } from '../../test/support/anthropic-sse.ts';
import { costOf } from './cost.ts';
import { assembleSse, type CallRecord, createLoggingFetch, type LogSink } from './wire-log.ts';

const memorySink = () => {
  const prefixes = new Map<string, string>();
  const records: CallRecord[] = [];
  const sink: LogSink = {
    storePrefix: (prefix) => {
      const hash = `h${prefixes.size}`;
      for (const [k, v] of prefixes) if (v === prefix) return k;
      prefixes.set(hash, prefix);
      return hash;
    },
    append: (r) => records.push(r),
  };
  return { sink, prefixes, records };
};

describe('assembleSse', () => {
  test('rebuilds thinking with signature, text, tool input and final usage', () => {
    const message = assembleSse(
      anthropicSse({
        thinking: 'hmm',
        text: 'Ich baue das.',
        toolCall: { id: 't1', name: 'add_scripts', input: { sprite: 'Sprite1', scripts: [[]] } },
        usage: { input_tokens: 100, output_tokens: 42 },
      }),
    );
    expect(message?.content).toEqual([
      { type: 'thinking', thinking: 'hmm', signature: 'sig' },
      { type: 'text', text: 'Ich baue das.' },
      { type: 'tool_use', id: 't1', name: 'add_scripts', input: { sprite: 'Sprite1', scripts: [[]] } },
    ]);
    expect(message?.stop_reason).toBe('tool_use');
    expect(message?.usage).toMatchObject({ input_tokens: 100, output_tokens: 42 });
  });

  test('keeps a stream error', () => {
    const sse = 'event: error\ndata: {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}\n\n';
    expect(assembleSse(sse)?.error).toEqual({ type: 'overloaded_error', message: 'Overloaded' });
  });
});

describe('costOf', () => {
  test('weights cache reads, cache writes and output by Haiku prices', () => {
    expect(costOf({ input_tokens: 1e6 })).toBeCloseTo(0.1);
    expect(costOf({ cache_read_input_tokens: 1e6 })).toBeCloseTo(0.01);
    expect(costOf({ cache_creation_input_tokens: 1e6 })).toBeCloseTo(0.125);
    expect(costOf({ output_tokens: 1e6 })).toBeCloseTo(0.5);
  });
});

describe('createLoggingFetch', () => {
  test('passes the response through unchanged and logs the call with the prefix stored once', async () => {
    const { sink, prefixes, records } = memorySink();
    const sse = anthropicSse({ text: 'Hallo', usage: { input_tokens: 10, output_tokens: 5 } });
    const calls: { ok: boolean }[] = [];
    const loggingFetch = createLoggingFetch(
      sink,
      { accessCode: 'test', session: 's1', turn: 1 },
      (_r, _u, ok) => calls.push({ ok }),
      async () => sseResponse(sse),
    );
    const body = JSON.stringify({ model: 'm', system: [{ text: 'sys' }], tools: [{ name: 't' }], messages: [] });
    for (let i = 0; i < 2; i++) {
      const res = await loggingFetch('https://api.anthropic.com/v1/messages', { method: 'POST', body });
      expect(await res.text()).toBe(sse);
    }
    await expect.poll(() => records.length).toBe(2);
    expect(prefixes.size).toBe(1);
    expect(records[0]).toMatchObject({
      accessCode: 'test',
      session: 's1',
      turn: 1,
      status: 200,
      request: { prefix: 'h0', model: 'm', messages: [] },
      response: { content: [{ type: 'text', text: 'Hallo' }] },
    });
    expect(records[0]?.request).not.toHaveProperty('system');
    expect(calls).toEqual([{ ok: true }, { ok: true }]);
  });
});
