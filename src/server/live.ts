// TEMPORARY (Digitalferien 2026, remove after the event): the teacher page at /digiferien-2026-live, behind
// one shared teacher code. Its data is live.json plus the Locker card files, kept out of the repo: in the
// git-ignored folder live/ locally, in the Blob container `live` on Azure (scripts/azure/live.sh).
// Minimal protection on purpose: nothing here is really secret.
//
// To remove: this file and live.test.ts, src/shared/live.ts, src/client/live/, live.html, scripts/azure/live.sh,
// and the lines marked TEMPORARY in app.ts, main.ts, vite.config.ts and .gitignore; then delete the container
// and the LIVE_BLOB_URL setting (live.sh prints the commands).
import fs from 'node:fs/promises';
import path from 'node:path';
import { DefaultAzureCredential } from '@azure/identity';
import { ContainerClient } from '@azure/storage-blob';
import { serveStatic } from '@hono/node-server/serve-static';
import type { Hono } from 'hono';
import { z } from 'zod';
import { normalizeCode } from '../shared/access.ts';
import { LIVE_API, LIVE_CODE_HEADER, LIVE_PATH, type LiveData, PLAYGROUND_PATH } from '../shared/live.ts';

/** Reads a file of the live folder; undefined if it doesn't exist. */
export type LiveStore = (name: string) => Promise<Buffer | undefined>;

export const dirStore =
  (dir: string): LiveStore =>
  async (name) => {
    try {
      return await fs.readFile(path.join(dir, name));
    } catch {
      return undefined;
    }
  };

/** The container with the app's managed identity (locally: the `az login` user). */
export const blobStore = (containerUrl: string): LiveStore => {
  const container = new ContainerClient(containerUrl, new DefaultAzureCredential());
  return async (name) => {
    try {
      return await container.getBlobClient(name).downloadToBuffer();
    } catch (e) {
      if ((e as { statusCode?: number }).statusCode === 404) return undefined;
      throw e;
    }
  };
};

const liveJson = z.object({
  code: z.string().min(1),
  schools: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      accessCode: z.string(),
      lockerPdf: z.string(),
      lockerCsv: z.string(),
    }),
  ),
  videos: z.array(z.object({ descriptId: z.string(), title: z.string(), minutes: z.number() })),
  playgroundUrl: z.string(),
  teamsUrl: z.string().optional(),
});

const CACHE_MS = 60_000;

const CONTENT_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.csv': 'text/csv; charset=utf-8',
};

/** `distDir`: where the built live.html sits (dist/client); in dev Vite serves the page itself. */
export const addLiveRoutes = (app: Hono, store: LiveStore | undefined, distDir: string): void => {
  // a minute's cache, so a fixed live.json goes live without a restart
  const cache = new Map<string, { at: number; value: Promise<Buffer | undefined> }>();
  const read = (name: string) => {
    const hit = cache.get(name);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
    const value = store ? store(name) : Promise.resolve(undefined);
    cache.set(name, { at: Date.now(), value });
    value.catch(() => cache.delete(name));
    return value;
  };
  const load = async () => {
    const file = await read('live.json');
    return file ? liveJson.parse(JSON.parse(file.toString('utf8'))) : undefined;
  };

  app.get(LIVE_API, async (c) => {
    const live = await load().catch((e: unknown) => {
      console.error('live page: live.json unreadable:', e);
      return undefined;
    });
    if (!live) return c.json({ error: 'Die Seite ist noch nicht eingerichtet.' }, 503);
    if (normalizeCode(c.req.header(LIVE_CODE_HEADER) ?? '') !== normalizeCode(live.code))
      return c.json({ error: 'Falscher Zugangscode' }, 401);
    const { code: _, ...data } = live;
    return c.json(data satisfies LiveData);
  });

  app.get(`${LIVE_API}/files/:name`, async (c) => {
    const live = await load().catch(() => undefined);
    if (!live) return c.json({ error: 'Die Seite ist noch nicht eingerichtet.' }, 503);
    if (normalizeCode(c.req.query('code') ?? '') !== normalizeCode(live.code))
      return c.json({ error: 'Falscher Zugangscode' }, 401);
    const name = c.req.param('name');
    // only the files live.json names: no paths from the request reach the store
    if (!live.schools.some((s) => s.lockerPdf === name || s.lockerCsv === name))
      return c.json({ error: 'Nicht gefunden' }, 404);
    const file = await read(name).catch(() => undefined);
    if (!file) return c.json({ error: 'Nicht gefunden' }, 404);
    return c.body(new Uint8Array(file), 200, {
      'Content-Type': CONTENT_TYPES[path.extname(name)] ?? 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Cache-Control': 'no-store',
    });
  });

  // for the kids, so no code: the playground link carries its own key and only works on the day
  app.get(PLAYGROUND_PATH, async (c) => {
    const live = await load().catch(() => undefined);
    if (!live) return c.text('Die TypeScript-Entwicklungsumgebung ist noch nicht eingerichtet.', 503);
    c.header('Cache-Control', 'no-store');
    return c.redirect(live.playgroundUrl, 302);
  });

  app.get(
    LIVE_PATH,
    serveStatic({
      root: distDir,
      path: 'live.html',
      precompressed: true,
      onFound: (_path, c) => c.header('Cache-Control', 'no-cache'),
    }),
  );
};
