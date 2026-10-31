// The host side of the Locker (docs/locker.md): the kid's Locker code for this tab, the calls to our
// server's /api/locker routes, and what saving and loading do to the Scratch project.
import type { KiBridge } from '../../editor/bridge.ts';
import { ACCESS_CODE_HEADER } from '../../shared/chat-types.ts';
import {
  LOCKER_CODE_HEADER,
  LOCKER_GAMES_PATH,
  LOCKER_PATH,
  type LockerContents,
  type LockerGame,
  lockerPageUrl,
} from '../../shared/locker.ts';
import { OFFLINE } from '../chat/errors.ts';

const KEY = 'digiferien.lockerCode';

// Only for this tab (sessionStorage): a reload keeps it, which is when a kid needs to load their game; the
// next kid at a shared PC opens a new tab. Blocked storage just means asking again.

export const storedLockerCode = (): string | undefined => {
  try {
    return sessionStorage.getItem(KEY) ?? undefined;
  } catch {
    return undefined;
  }
};

export const storeLockerCode = (code: string): void => {
  try {
    sessionStorage.setItem(KEY, code);
  } catch {
    // asked again next time
  }
};

export const forgetLockerCode = (): void => {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // nothing to forget
  }
};

/** Opens the kid's Locker on the Locker's site in a new tab; false if the browser blocked it. Call it right
 * from a click: browsers allow a new tab only then (a click in the editor iframe counts for the host too). */
export const openLockerPage = (code: string): boolean => {
  // not the "noopener" feature: with it, window.open always returns null and a blocked tab goes unnoticed
  const tab = window.open(lockerPageUrl(code), '_blank');
  if (tab) tab.opener = null;
  return tab !== null;
};

export const NEED_ACCESS_CODE = 'Gib links im Chat den Zugangscode deiner Schule ein. Dann geht auch der Locker.';
const FAILED = 'Da ist etwas schiefgegangen. Versuch es bitte nochmal.';

/** A failed Locker call: `message` is German for the kid. `notFound`: wrong code (list) or a game that's gone. */
export class LockerCallError extends Error {
  readonly kind: 'not-found' | 'access' | 'other';
  constructor(message: string, kind: LockerCallError['kind']) {
    super(message);
    this.kind = kind;
  }
}

export interface LockerApi {
  list(code: string): Promise<LockerGame[]>;
  /** saves as a new game, or over `replace`; resolves with the Locker's games afterwards */
  save(code: string, name: string, sb3: Blob, replace?: LockerGame): Promise<LockerGame[]>;
  load(code: string, game: LockerGame): Promise<ArrayBuffer>;
}

export interface LockerApiDeps {
  accessCode: string;
  /** the server no longer accepts the school code (401) */
  onAccessDenied: () => void;
  fetch?: typeof fetch;
}

export const createLockerApi = ({ accessCode, onAccessDenied, fetch: baseFetch = fetch }: LockerApiDeps): LockerApi => {
  const request = async (code: string, url: string, init: RequestInit = {}): Promise<Response> => {
    let res: Response;
    try {
      res = await baseFetch(url, {
        ...init,
        headers: { ...init.headers, [ACCESS_CODE_HEADER]: accessCode, [LOCKER_CODE_HEADER]: code },
      });
    } catch {
      throw new LockerCallError(OFFLINE, 'other');
    }
    if (res.ok) return res;
    if (res.status === 401) {
      onAccessDenied();
      throw new LockerCallError(NEED_ACCESS_CODE, 'access');
    }
    const body = (await res.json().catch(() => ({}))) as { error?: unknown };
    const message = typeof body.error === 'string' ? body.error : FAILED;
    throw new LockerCallError(message, res.status === 404 ? 'not-found' : 'other');
  };
  const games = async (res: Response) => ((await res.json()) as LockerContents).games;
  return {
    list: async (code) => games(await request(code, LOCKER_PATH)),
    save: async (code, name, sb3, replace) => {
      const query = new URLSearchParams({
        name,
        ...(replace && { projectId: replace.projectId, fileId: replace.fileId }),
      });
      return games(await request(code, `${LOCKER_GAMES_PATH}?${query}`, { method: 'POST', body: sb3 }));
    },
    load: async (code, game) =>
      (await request(code, `${LOCKER_GAMES_PATH}/${game.projectId}/${game.fileId}`)).arrayBuffer(),
  };
};

/** The title Scratch gives a new project; it doesn't count as a name. */
export const DEFAULT_TITLE = 'Scratch-Projekt';

/** What the Locker dialog does to the project in the editor. */
export interface LockerProject {
  /** Scratch's project title (the field in the menu bar), without the default one */
  title(): string;
  sb3(): Promise<Blob>;
  /** the saved name becomes the title, so the computer save uses it too */
  setTitle(name: string): void;
  load(data: ArrayBuffer, name: string): Promise<void>;
}

export const createLockerProject = ({ vm, store }: KiBridge, onLoaded: () => void): LockerProject => {
  const setTitle = (title: string) => store.dispatch({ type: 'projectTitle/SET_PROJECT_TITLE', title });
  return {
    title: () => {
      const title = store.getState().scratchGui.projectTitle.trim();
      return title === DEFAULT_TITLE ? '' : title;
    },
    sb3: () => vm.saveProjectSb3(),
    setTitle,
    load: async (data, name) => {
      // a view, not the buffer: the VM lives in the iframe, where the host's ArrayBuffer fails its
      // `instanceof ArrayBuffer` and would be read as project JSON; ArrayBuffer.isView works across windows
      await vm.loadProject(new Uint8Array(data));
      setTitle(name);
      onLoaded();
    },
  };
};

/** When a game was saved: "heute, 11:05", "gestern, 09:48", else "Mo., 3. Nov., 11:05". */
export const savedLabel = (iso: string, now = new Date()): string => {
  const date = new Date(iso);
  const time = date.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((day(now) - day(date)) / 86_400_000);
  if (days === 0) return `heute, ${time}`;
  if (days === 1) return `gestern, ${time}`;
  const opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' };
  if (date.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
  return `${date.toLocaleDateString('de-AT', opts)}, ${time}`;
};
