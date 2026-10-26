// The teacher page's data and what this browser remembers (the code, the school, the videos seen).
import { normalizeCode } from '../../shared/access.ts';
import { LIVE_API, LIVE_CODE_HEADER, LIVE_VIDEOS_API, type LiveData, type LiveVideo } from '../../shared/live.ts';

export type LiveLoad = { ok: true; data: LiveData } | { ok: false; error: 'wrong' | 'unset' | 'offline' };

export const loadLive = async (code: string): Promise<LiveLoad> => {
  try {
    const res = await fetch(LIVE_API, { headers: { [LIVE_CODE_HEADER]: normalizeCode(code) } });
    if (res.ok) return { ok: true, data: (await res.json()) as LiveData };
    return { ok: false, error: res.status === 401 ? 'wrong' : res.status === 503 ? 'unset' : 'offline' };
  } catch {
    return { ok: false, error: 'offline' };
  }
};

/** The videos need no code; undefined if the server can't give them. */
export const loadVideos = async (): Promise<LiveVideo[] | undefined> => {
  try {
    const res = await fetch(LIVE_VIDEOS_API);
    return res.ok ? ((await res.json()) as { videos: LiveVideo[] }).videos : undefined;
  } catch {
    return undefined;
  }
};

// storage can be blocked (private windows, settings): then the page just forgets

export const remembered = (key: string): string | undefined => {
  try {
    return localStorage.getItem(`digiferien.live.${key}`) ?? undefined;
  } catch {
    return undefined;
  }
};

export const remember = (key: string, value: string | undefined): void => {
  try {
    if (value === undefined) localStorage.removeItem(`digiferien.live.${key}`);
    else localStorage.setItem(`digiferien.live.${key}`, value);
  } catch {
    // not remembered
  }
};
