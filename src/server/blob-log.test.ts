import { describe, expect, test } from 'vitest';
import { createBlobLogSink, type Upload } from './blob-log.ts';
import { type CallRecord, type GuardRecord, type LogSink, prefixHash } from './wire-log.ts';

const call = (over: Partial<CallRecord> = {}): CallRecord => ({
  ts: '2026-10-30T08:15:02.123Z',
  ms: 1200,
  accessCode: 'schule1',
  session: 'sess-1',
  turn: 7,
  status: 200,
  request: { prefix: 'h' },
  response: {},
  cost: 0.001,
  ...over,
});
const guard: GuardRecord = { ...call(), text: 'Hallo', nouls: {} };

const setup = (fail: (name: string) => boolean = () => false) => {
  const blobs = new Map<string, string>();
  const upload: Upload = async (name, body) => {
    if (fail(name)) throw new Error('503 Service Unavailable');
    blobs.set(name, body);
  };
  const local = { prefixes: [] as string[], calls: [] as CallRecord[], guard: [] as GuardRecord[] };
  const fallback: LogSink = {
    storePrefix: (p) => {
      local.prefixes.push(p);
      return prefixHash(p);
    },
    append: (r) => local.calls.push(r),
    appendGuard: (r) => local.guard.push(r),
  };
  return { sink: createBlobLogSink(upload, fallback), blobs, local };
};

describe('blob log sink', () => {
  test('one blob per record, split by school, kid and turn', async () => {
    const { sink, blobs } = setup();
    sink.append(call());
    sink.appendGuard(guard);
    await sink.flush();
    const names = [...blobs.keys()];
    expect(names[0]).toMatch(/^calls\/schule1\/sess-1\/007-2026-10-30T081502\.123Z-[0-9a-f]{8}\.json$/);
    expect(names[1]).toMatch(/^guard\/schule1\/sess-1\/007-/);
    expect(JSON.parse(blobs.get(names[0] as string) as string)).toEqual(call());
  });

  test('two calls in the same turn and millisecond get different names', async () => {
    const { sink, blobs } = setup();
    sink.append(call());
    sink.append(call());
    await sink.flush();
    expect(blobs.size).toBe(2);
  });

  test('a session id from the header cannot leave its folder', async () => {
    const { sink, blobs } = setup();
    sink.append(call({ session: '../../prefixes/x y' }));
    sink.append(call({ session: undefined }));
    await sink.flush();
    const names = [...blobs.keys()];
    expect(names[0]).toMatch(/^calls\/schule1\/______prefixes_x_y\//);
    expect(names[1]).toMatch(/^calls\/schule1\/none\//);
  });

  test('stores each prefix once, under the same hash as the file sink', async () => {
    const { sink, blobs } = setup();
    const prefix = JSON.stringify({ system: 'Du bist…', tools: [] });
    expect(sink.storePrefix(prefix)).toBe(prefixHash(prefix));
    sink.storePrefix(prefix);
    await sink.flush();
    expect([...blobs]).toEqual([[`prefixes/${prefixHash(prefix)}.json`, prefix]]);
  });

  test('a failed upload goes to the local fallback, without throwing', async () => {
    const { sink, blobs, local } = setup((name) => name.startsWith('calls/'));
    sink.append(call());
    sink.appendGuard(guard);
    await sink.flush();
    expect(local.calls).toEqual([call()]);
    expect(local.guard).toEqual([]);
    expect(blobs.size).toBe(1);
  });
});
