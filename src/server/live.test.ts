import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { LIVE_CODE_HEADER, type LiveData, liveFileUrl } from '../shared/live.ts';
import { createApp } from './app.ts';
import type { Config } from './config.ts';
import { dirStore } from './live.ts';
import type { LogSink } from './wire-log.ts';

const config = {
  accessCodes: new Set(['schule1']),
  distDir: 'does-not-exist',
  version: 'abc123',
  lockerUrl: 'https://locker.test',
} as Config;
const sink: LogSink = { storePrefix: () => 'h', append: () => {}, appendGuard: () => {} };

const live = {
  code: 'Lehrer-Test',
  schools: [
    { id: 'brg-steyr', name: 'BRG Steyr', accessCode: 'Zebra1', lockerPdf: 'karten.pdf', lockerCsv: 'karten.csv' },
  ],
  videos: [{ descriptId: 'abc', title: 'Einleitung', minutes: 31 }],
  playgroundUrl: 'https://playground.test',
};

const setup = (withData = true) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'live-'));
  if (withData) {
    fs.writeFileSync(path.join(dir, 'live.json'), JSON.stringify(live));
    fs.writeFileSync(path.join(dir, 'karten.pdf'), '%PDF-1.7');
    fs.writeFileSync(path.join(dir, 'secret.txt'), 'not listed');
  }
  return createApp({ config, sink, live: dirStore(dir) });
};

describe('teacher page (/api/live)', () => {
  test('the right code, in any case, gets the data without the code', async () => {
    const res = await setup().request('/api/live', { headers: { [LIVE_CODE_HEADER]: ' lehrer-test ' } });
    expect(res.status).toBe(200);
    const data = (await res.json()) as LiveData & { code?: string };
    expect(data.code).toBeUndefined();
    expect(data.schools[0]?.accessCode).toBe('Zebra1');
  });

  test('a wrong code, or a kid’s access code, gets a 401', async () => {
    const app = setup();
    for (const code of ['nope', 'schule1']) {
      const res = await app.request('/api/live', { headers: { [LIVE_CODE_HEADER]: code } });
      expect(res.status).toBe(401);
    }
  });

  test('without live.json the page says it is not set up', async () => {
    const res = await setup(false).request('/api/live', { headers: { [LIVE_CODE_HEADER]: 'Lehrer-Test' } });
    expect(res.status).toBe(503);
  });

  test('Locker card files come with ?code= as a download', async () => {
    const app = setup();
    const res = await app.request(liveFileUrl('karten.pdf', 'lehrer-test'));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    expect(res.headers.get('Content-Disposition')).toContain('attachment');
    expect(await res.text()).toBe('%PDF-1.7');
    expect((await app.request(liveFileUrl('karten.pdf', 'wrong'))).status).toBe(401);
  });

  test('only files live.json names are served, and missing ones are a 404', async () => {
    const app = setup();
    expect((await app.request(liveFileUrl('secret.txt', 'Lehrer-Test'))).status).toBe(404);
    expect((await app.request(liveFileUrl('live.json', 'Lehrer-Test'))).status).toBe(404);
    expect((await app.request(liveFileUrl('karten.csv', 'Lehrer-Test'))).status).toBe(404);
  });

  test('the videos need no code', async () => {
    const res = await setup().request('/api/live/videos');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ videos: live.videos });
    expect((await setup(false).request('/api/live/videos')).status).toBe(503);
  });

  test('/ts-playground redirects to the playground without a code', async () => {
    const res = await setup().request('/ts-playground');
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('https://playground.test');
    expect((await setup(false).request('/ts-playground')).status).toBe(503);
  });

  test('the kids’ access codes still guard the rest of /api', async () => {
    expect((await setup().request('/api/access')).status).toBe(401);
  });
});
