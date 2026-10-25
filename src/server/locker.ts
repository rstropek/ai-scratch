// Save and load games in the kid's CoderDojo Locker (docs/locker.md). The browser can't call the Locker
// itself (its CORS allows only its own site), so these routes pass the calls on. No secret is involved: the
// code on the kid's sticker opens their Locker; it arrives as a header and is never logged.
import type { Context, Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import {
  gameFileName,
  isLockerCode,
  LOCKER_CODE_HEADER,
  LOCKER_GAMES_PATH,
  LOCKER_PATH,
  type LockerContents,
  type LockerGame,
  MAX_GAME_NAME,
  normalizeLockerCode,
} from '../shared/locker.ts';
import type { Config } from './config.ts';
import type { Stats } from './stats.ts';

export const SB3_TYPE = 'application/x.scratch.sb3';
/** the Locker's default per-file limit */
export const MAX_SB3_BYTES = 25 * 1024 * 1024;
const API_TIMEOUT_MS = 20_000;
const TRANSFER_TIMEOUT_MS = 90_000;

export const WRONG_LOCKER_CODE = 'Mit diesem Code geht kein Locker auf. Schau nochmal auf den Sticker.';
export const LOCKER_DOWN = 'Der Locker antwortet gerade nicht. Versuch es gleich nochmal.';
export const TOO_BIG = 'Dein Projekt ist zu groß für den Locker (höchstens 25 MB).';
const NO_NAME = 'Gib deinem Spiel einen Namen.';
const GONE = 'Dieses Spiel ist nicht mehr in deinem Locker.';

// --- the parts of the Locker's API used here (CoderDojo-Cloud openapi.json) ---------------------------
interface LockerFile {
  id: string;
  name: string;
  size: number;
  uploadedAt: string;
}
interface LockerProject {
  id: string;
  name: string;
  files: LockerFile[];
}
interface LockerDetails {
  projects: LockerProject[];
}
interface AuthorizedUpload {
  ticket: string;
  files: { name: string; url: string; headers: Record<string, string> }[];
}

/** A Locker answer that should reach the kid: German text (Accept-Language: de) and our status. */
class LockerError extends Error {
  readonly status: 400 | 404 | 413 | 502;
  constructor(message: string, status: LockerError['status']) {
    super(message);
    this.status = status;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The Locker's problem details carry a German `detail` or validation `errors`. */
const problemText = async (res: Response): Promise<string | undefined> => {
  const body = (await res.json().catch(() => undefined)) as
    | { detail?: unknown; title?: unknown; errors?: Record<string, unknown> }
    | undefined;
  const first = Object.values(body?.errors ?? {}).flat()[0];
  const text = typeof first === 'string' ? first : body?.detail;
  return typeof text === 'string' && text.trim() ? text.trim() : undefined;
};

/** Turns the games in a Locker into the list the dialog shows. */
export const gamesOf = (locker: LockerDetails): LockerGame[] =>
  locker.projects
    .flatMap((project) => {
      const sb3 = project.files.filter((f) => /\.sb3$/i.test(f.name));
      // a project with several .sb3 files (uploaded on the Locker's site) lists each under its file name
      return sb3.map((f) => ({
        projectId: project.id,
        fileId: f.id,
        name: sb3.length === 1 ? project.name : f.name.replace(/\.sb3$/i, ''),
        savedAt: f.uploadedAt,
        size: f.size,
      }));
    })
    .sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt));

export interface LockerDeps {
  config: Config;
  stats: Stats;
  fetch?: typeof fetch;
}

export const addLockerRoutes = (app: Hono, { config, stats, fetch: baseFetch = fetch }: LockerDeps): void => {
  const base = config.lockerUrl.replace(/\/+$/, '');

  const call = async (code: string, path: string, init: RequestInit & { json?: unknown } = {}): Promise<Response> => {
    const { json, ...rest } = init;
    try {
      return await baseFetch(`${base}/api/lockers/${code}${path}`, {
        ...rest,
        headers: {
          Accept: 'application/json',
          'Accept-Language': 'de',
          ...(json === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: json === undefined ? rest.body : JSON.stringify(json),
        signal: AbortSignal.timeout(API_TIMEOUT_MS),
      });
    } catch (e) {
      console.error('locker unreachable', e);
      throw new LockerError(LOCKER_DOWN, 502);
    }
  };

  /** A failed Locker answer as the kid's error: its own German text where it has one. */
  const fail = async (res: Response, notFound = WRONG_LOCKER_CODE): Promise<never> => {
    if (res.status === 404) throw new LockerError(notFound, 404);
    if (res.status === 413) throw new LockerError((await problemText(res)) ?? TOO_BIG, 413);
    if (res.status === 400 || res.status === 403 || res.status === 409) {
      throw new LockerError((await problemText(res)) ?? LOCKER_DOWN, 400);
    }
    console.error('locker answered', res.status);
    throw new LockerError(LOCKER_DOWN, 502);
  };

  const json = async <T>(res: Response, notFound?: string): Promise<T> => {
    if (!res.ok) await fail(res, notFound);
    return (await res.json()) as T;
  };

  const games = async (code: string): Promise<LockerGame[]> => gamesOf(await json<LockerDetails>(await call(code, '')));

  /** Upload the bytes: a ticket, the PUT to the Locker's storage, then `spend` uses the ticket. */
  const upload = async (
    code: string,
    bytes: ArrayBuffer,
    fileName: string,
    projectId: string | null,
    spend: (ticket: string) => Promise<Response>,
  ) => {
    const auth = await json<AuthorizedUpload>(
      await call(code, '/projects/uploads', {
        method: 'POST',
        json: { files: [{ name: fileName, size: bytes.byteLength, contentType: SB3_TYPE }], projectId },
      }),
    );
    try {
      const target = auth.files[0];
      if (!target) throw new LockerError(LOCKER_DOWN, 502);
      let put: Response;
      try {
        // in production an Azure Blob SAS URL; the Locker's local dev server answers with a relative one
        put = await baseFetch(new URL(target.url, `${base}/`), {
          method: 'PUT',
          headers: target.headers,
          body: bytes,
          signal: AbortSignal.timeout(TRANSFER_TIMEOUT_MS),
        });
      } catch (e) {
        console.error('locker storage unreachable', e);
        throw new LockerError(LOCKER_DOWN, 502);
      }
      if (!put.ok) await fail(put);
      const res = await spend(auth.ticket);
      if (!res.ok) await fail(res, GONE);
      return res;
    } catch (e) {
      // gives the held space back at once; the Locker would release it later on its own
      await call(code, '/projects/uploads', { method: 'DELETE', json: { ticket: auth.ticket } }).catch(() => {});
      throw e;
    }
  };

  /** Runs a route with the kid's Locker code; Locker failures become {error} in German. */
  const withCode = async (c: Context, run: (code: string) => Promise<Response>): Promise<Response> => {
    const code = normalizeLockerCode(c.req.header(LOCKER_CODE_HEADER) ?? '');
    if (!isLockerCode(code)) return c.json({ error: WRONG_LOCKER_CODE }, 404);
    try {
      return await run(code);
    } catch (e) {
      stats.locker.errors += 1;
      if (e instanceof LockerError) return c.json({ error: e.message }, e.status);
      console.error('locker route failed', e);
      return c.json({ error: LOCKER_DOWN }, 502);
    }
  };

  app.get(LOCKER_PATH, (c) =>
    withCode(c, async (code) => c.json({ games: await games(code) } satisfies LockerContents)),
  );

  // the .sb3 as the body, the name (and the game it replaces) in the query
  app.post(
    LOCKER_GAMES_PATH,
    bodyLimit({ maxSize: MAX_SB3_BYTES, onError: (c) => c.json({ error: TOO_BIG }, 413) }),
    (c) =>
      withCode(c, async (code) => {
        const name = (c.req.query('name') ?? '').trim().slice(0, MAX_GAME_NAME);
        if (!name) return c.json({ error: NO_NAME }, 400);
        const projectId = c.req.query('projectId');
        const fileId = c.req.query('fileId');
        const bytes = await c.req.arrayBuffer();
        if (projectId && fileId) {
          if (!UUID.test(projectId) || !UUID.test(fileId)) return c.json({ error: GONE }, 404);
          // replaces the bytes; the file keeps its name, id and share link
          await upload(code, bytes, gameFileName(name), projectId, (ticket) =>
            call(code, `/projects/${projectId}/files/${fileId}/content`, { method: 'PUT', json: { ticket } }),
          );
        } else {
          await upload(code, bytes, gameFileName(name), null, (ticket) =>
            call(code, '/projects', { method: 'POST', json: { name, link: null, ticket, allowEmpty: false } }),
          );
        }
        stats.locker.saves += 1;
        return c.json({ games: await games(code) } satisfies LockerContents);
      }),
  );

  app.get(`${LOCKER_GAMES_PATH}/:projectId/:fileId`, (c) =>
    withCode(c, async (code) => {
      const { projectId, fileId } = c.req.param();
      if (!UUID.test(projectId) || !UUID.test(fileId)) return c.json({ error: GONE }, 404);
      // on Azure the Locker redirects to a signed storage URL; fetch follows it
      let res: Response;
      try {
        res = await baseFetch(`${base}/api/lockers/${code}/projects/${projectId}/files/${fileId}`, {
          headers: { 'Accept-Language': 'de' },
          signal: AbortSignal.timeout(TRANSFER_TIMEOUT_MS),
        });
      } catch (e) {
        console.error('locker unreachable', e);
        throw new LockerError(LOCKER_DOWN, 502);
      }
      if (!res.ok) await fail(res, GONE);
      const bytes = await res.arrayBuffer();
      stats.locker.loads += 1;
      return c.body(bytes, 200, { 'Content-Type': SB3_TYPE, 'Cache-Control': 'no-store' });
    }),
  );
};
