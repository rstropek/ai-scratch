// TEMPORARY (Digitalferien 2026, remove after the event): the teacher page at /digiferien-2026-live.
// Its data (live.json) and the Locker cards stay out of the repo; see src/server/live.ts.

export const LIVE_PATH = '/digiferien-2026-live';
export const LIVE_API = '/api/live';
export const LIVE_CODE_HEADER = 'X-Live-Code';
/** short enough for kids to type from the projector; redirects to live.json's playgroundUrl */
export const PLAYGROUND_PATH = '/ts-playground';

export interface LiveSchool {
  /** also the suffix of its Locker card files */
  id: string;
  name: string;
  /** the kids' KI access code */
  accessCode: string;
  /** file names in the live folder */
  lockerPdf: string;
  lockerCsv: string;
}

export interface LiveVideo {
  /** share.descript.com/view/<id>, embedded as share.descript.com/embed/<id> */
  descriptId: string;
  title: string;
  minutes: number;
}

/** What the teacher page gets once its code is right (live.json without the code). */
export interface LiveData {
  schools: LiveSchool[];
  videos: LiveVideo[];
  playgroundUrl: string;
  /** Rainer's Teams meeting for the teachers' questions on the day (not for the kids) */
  teamsUrl?: string;
}

/** A Locker card file, for a plain link: the code comes as ?code=, the data isn't secret. */
export const liveFileUrl = (name: string, code: string): string =>
  `${LIVE_API}/files/${encodeURIComponent(name)}?code=${encodeURIComponent(code)}`;
