import { describe, expect, test } from 'vitest';
import type { LockerContents } from '../shared/locker.ts';
import { createApp } from './app.ts';
import type { Config } from './config.ts';
import { gamesOf, LOCKER_DOWN, SB3_TYPE, TOO_BIG, WRONG_LOCKER_CODE } from './locker.ts';
import type { LogSink } from './wire-log.ts';

const config: Config = {
  port: 0,
  anthropicApiKey: 'test-key',
  anthropicWorkspaceId: undefined,
  model: 'claude-haiku-5-5',
  effort: 'high',
  instructions: undefined,
  jevApiKey: 'jev-key',
  jevModel: 'jev-1.13.0',
  accessCodes: new Set(['schule1']),
  logDir: undefined,
  distDir: 'does-not-exist',
  version: 'test',
  lockerUrl: 'https://locker.test/',
};
const sink: LogSink = { storePrefix: () => 'h', append: () => {}, appendGuard: () => {} };

const CODE = 'K7QM4XRT';
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

interface FakeFile {
  id: string;
  name: string;
  size: number;
  uploadedAt: string;
  bytes: Uint8Array;
}

/** The parts of the Locker's API the routes use, in memory, plus every request it saw. */
const fakeLocker = (options: { down?: boolean; storageStatus?: number } = {}) => {
  const projects: { id: string; name: string; createdAt: string; files: FakeFile[] }[] = [];
  const tickets = new Map<string, { name: string; bytes?: Uint8Array }>();
  const requests: { method: string; url: string; headers: Headers; body?: unknown }[] = [];
  let ids = 0;
  let clock = Date.parse('2026-11-02T09:00:00Z');
  const now = () => {
    clock += 60_000;
    return new Date(clock).toISOString();
  };

  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';
    const headers = new Headers(init?.headers);
    const isJson = headers.get('Content-Type') === 'application/json';
    requests.push({ method, url: url.href, headers, body: isJson ? JSON.parse(String(init?.body)) : undefined });
    if (options.down) throw new TypeError('fetch failed');
    if (url.host === 'blob.test') {
      const ticket = tickets.get(url.pathname.slice(1));
      if (!ticket) return new Response(null, { status: 404 });
      if (options.storageStatus) return new Response(null, { status: options.storageStatus });
      ticket.bytes = new Uint8Array(init?.body as ArrayBuffer);
      return new Response(null, { status: 201 });
    }
    const m = url.pathname.match(/^\/api\/lockers\/([^/]+)(\/.*)?$/);
    if (!m || m[1] !== CODE) return new Response(null, { status: 404 });
    const path = m[2] ?? '';
    const body = requests.at(-1)?.body as Record<string, unknown> | undefined;
    if (method === 'GET' && path === '')
      return Response.json({
        id: uuid(999),
        code: CODE,
        projects: projects.map(({ files, ...p }) => ({ ...p, files })),
      });
    if (method === 'POST' && path === '/projects/uploads') {
      const [file] = (body?.files ?? []) as { name: string; size: number }[];
      if ((file?.size ?? 0) > 1000)
        return Response.json(
          { detail: 'Dieser Upload würde das Speicherlimit des Lockers überschreiten.' },
          { status: 413 },
        );
      const ticket = `t${++ids}`;
      tickets.set(ticket, { name: file?.name ?? '' });
      return Response.json({
        ticket,
        files: [{ name: file?.name, url: `https://blob.test/${ticket}`, headers: { 'x-ms-blob-type': 'BlockBlob' } }],
      });
    }
    if (method === 'DELETE' && path === '/projects/uploads') {
      tickets.delete(String(body?.ticket));
      return new Response(null, { status: 204 });
    }
    const spend = () => {
      const t = tickets.get(String(body?.ticket));
      tickets.delete(String(body?.ticket));
      return t?.bytes ? { name: t.name, bytes: t.bytes } : undefined;
    };
    if (method === 'POST' && path === '/projects') {
      const t = spend();
      if (!t) return Response.json({ errors: { ticket: ['Das Ticket ist abgelaufen.'] } }, { status: 400 });
      const file = { id: uuid(++ids), name: t.name, size: t.bytes.length, uploadedAt: now(), bytes: t.bytes };
      const project = { id: uuid(++ids), name: String(body?.name), createdAt: now(), files: [file] };
      projects.unshift(project);
      return Response.json(project, { status: 201 });
    }
    const file = path.match(/^\/projects\/([^/]+)\/files\/([^/]+)(\/content)?$/);
    const found = file && projects.find((p) => p.id === file[1])?.files.find((f) => f.id === file[2]);
    if (file && !found) return new Response(null, { status: 404 });
    if (found && method === 'PUT' && file?.[3]) {
      const t = spend();
      if (!t) return Response.json({ errors: { ticket: ['Das Ticket ist abgelaufen.'] } }, { status: 400 });
      Object.assign(found, { bytes: t.bytes, size: t.bytes.length, uploadedAt: now() });
      return Response.json({});
    }
    if (found && method === 'GET') return new Response(found.bytes.slice().buffer);
    return new Response(null, { status: 405 });
  };
  return { fetch, projects, tickets, requests };
};

const setup = (options?: Parameters<typeof fakeLocker>[0]) => {
  const locker = fakeLocker(options);
  const app = createApp({ config, sink, fetch: locker.fetch });
  const headers = (code = CODE) => ({ 'X-Access-Code': 'schule1', 'X-Locker-Code': code });
  const list = (code?: string) => app.request('/api/locker', { headers: headers(code) });
  const save = (name: string, bytes: Uint8Array<ArrayBuffer>, replace?: { projectId: string; fileId: string }) =>
    app.request(`/api/locker/games?${new URLSearchParams({ name, ...replace })}`, {
      method: 'POST',
      headers: { ...headers(), 'Content-Type': SB3_TYPE },
      body: bytes,
    });
  const load = (projectId: string, fileId: string) =>
    app.request(`/api/locker/games/${projectId}/${fileId}`, { headers: headers() });
  const stats = async () => (await (await app.request('/api/stats', { headers: headers() })).json()).locker;
  return { ...locker, app, list, save, load, stats };
};

const sb3 = (text: string) => new TextEncoder().encode(text);

describe('locker routes', () => {
  test('a game saved under a new name becomes a Locker project with one .sb3 file', async () => {
    const { save, list, projects, requests } = setup();
    const res = await save('Hai-Alarm', sb3('project-1'));
    expect(res.status).toBe(200);
    const { games } = (await res.json()) as LockerContents;
    expect(games).toEqual([
      expect.objectContaining({
        name: 'Hai-Alarm',
        size: 9,
        projectId: projects[0]?.id,
        fileId: projects[0]?.files[0]?.id,
      }),
    ]);
    expect(projects[0]?.files[0]?.name).toBe('Hai-Alarm.sb3');
    expect(await (await list()).json()).toEqual({ games });
    // the blob gets the Locker's headers; every API call asks for German messages
    expect(requests.find((r) => r.url.startsWith('https://blob.test'))?.headers.get('x-ms-blob-type')).toBe(
      'BlockBlob',
    );
    expect(
      requests.filter((r) => r.url.includes('/api/lockers/')).every((r) => r.headers.get('Accept-Language') === 'de'),
    ).toBe(true);
    // the base URL's trailing slash doesn't double up
    expect(requests[0]?.url).toBe(`https://locker.test/api/lockers/${CODE}/projects/uploads`);
  });

  test('saving again over a game replaces its bytes, keeping the project and file', async () => {
    const { save, load, projects } = setup();
    await save('Hai-Alarm', sb3('version-1'));
    const [project] = projects;
    const fileId = project?.files[0]?.id ?? '';
    const res = await save('hai-alarm', sb3('version-two'), { projectId: project?.id ?? '', fileId });
    expect(res.status).toBe(200);
    expect(projects).toHaveLength(1);
    const loaded = await load(project?.id ?? '', fileId);
    expect(loaded.headers.get('Content-Type')).toBe(SB3_TYPE);
    expect(new TextDecoder().decode(await loaded.arrayBuffer())).toBe('version-two');
  });

  test('the code is normalized and checked before the Locker sees it', async () => {
    const { list, requests } = setup();
    expect((await list('k7qm 4xrt')).status).toBe(200);
    for (const bad of ['K7QM4XR', '../../x', '']) {
      const res = await list(bad);
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: WRONG_LOCKER_CODE });
    }
    expect(requests).toHaveLength(1);
  });

  test('an unknown code gets the Locker sticker message', async () => {
    const res = await setup().list('Q93NJJ6H');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: WRONG_LOCKER_CODE });
  });

  test('without the school code the Locker routes stay closed', async () => {
    const { app, requests } = setup();
    const res = await app.request('/api/locker', { headers: { 'X-Locker-Code': CODE } });
    expect(res.status).toBe(401);
    expect(requests).toHaveLength(0);
  });

  test("the Locker's own German refusal reaches the kid, and the held space is given back", async () => {
    const { save, tickets, stats } = setup();
    const res = await save('Riesig', new Uint8Array(2000));
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: 'Dieser Upload würde das Speicherlimit des Lockers überschreiten.' });
    expect(tickets.size).toBe(0);
    expect(await stats()).toEqual({ saves: 0, loads: 0, errors: 1 });
  });

  test('a failed storage upload releases the ticket', async () => {
    const { save, tickets, requests } = setup({ storageStatus: 500 });
    const res = await save('Hai-Alarm', sb3('x'));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: LOCKER_DOWN });
    expect(tickets.size).toBe(0);
    expect(requests.at(-1)).toMatchObject({ method: 'DELETE', body: { ticket: 't1' } });
  });

  test('an unreachable Locker answers in German', async () => {
    const res = await setup({ down: true }).list();
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: LOCKER_DOWN });
  });

  test('projects over 25 MB are refused before anything is sent', async () => {
    const { save, requests } = setup();
    const res = await save('Riesig', new Uint8Array(25 * 1024 * 1024 + 1));
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: TOO_BIG });
    expect(requests).toHaveLength(0);
  });

  test('a name is required, ids must be ids', async () => {
    const { save, load, requests } = setup();
    expect((await save('  ', sb3('x'))).status).toBe(400);
    expect((await load('x', '../../y')).status).toBe(404);
    expect((await save('A', sb3('x'), { projectId: 'nope', fileId: uuid(1) })).status).toBe(404);
    expect(requests).toHaveLength(0);
  });

  test('saves and loads are counted', async () => {
    const { save, load, projects, stats } = setup();
    await save('Hai-Alarm', sb3('x'));
    await load(projects[0]?.id ?? '', projects[0]?.files[0]?.id ?? '');
    expect(await stats()).toEqual({ saves: 1, loads: 1, errors: 0 });
  });
});

describe('gamesOf', () => {
  const file = (id: string, name: string, uploadedAt: string) => ({ id, name, size: 1, uploadedAt });
  test('lists every .sb3 newest first; several in one project go by file name', () => {
    expect(
      gamesOf({
        projects: [
          { id: 'p1', name: 'Hai-Alarm', files: [file('f1', 'Hai-Alarm.sb3', '2026-11-02T09:00:00Z')] },
          { id: 'p2', name: 'Fotos', files: [file('f2', 'katze.png', '2026-11-02T12:00:00Z')] },
          {
            id: 'p3',
            name: 'Upload',
            files: [file('f3', 'Pong.SB3', '2026-11-02T10:00:00Z'), file('f4', 'Quiz.sb3', '2026-11-02T11:00:00Z')],
          },
        ],
      }).map((g) => [g.name, g.fileId]),
    ).toEqual([
      ['Quiz', 'f4'],
      ['Pong', 'f3'],
      ['Hai-Alarm', 'f1'],
    ]);
  });
});
