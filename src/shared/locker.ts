// The CoderDojo Locker (locker.coderdojo.net): kids save and load their games there with the code on their
// Locker sticker. The browser talks to our server (src/server/locker.ts), which passes the calls on.

/** the Locker's site; the default for LOCKER_URL (the server's calls) and where the kid's own page is */
export const LOCKER_SITE = 'https://locker.coderdojo.net';
/** the kid's Locker on the Locker's own site, where they can see, download and share their files */
export const lockerPageUrl = (code: string): string => `${LOCKER_SITE}/locker/${code}`;

/** the kid's Locker code; a header, not part of the URL, so it stays out of request logs */
export const LOCKER_CODE_HEADER = 'X-Locker-Code';
export const LOCKER_PATH = '/api/locker';
export const LOCKER_GAMES_PATH = '/api/locker/games';

/** the Locker's code alphabet: no 0/O or 1/I */
const NOT_IN_CODE = /[^23456789ABCDEFGHJKLMNPQRSTUVWXYZ]/g;
export const LOCKER_CODE_LENGTH = 8;

/** What the kid typed, as the Locker stores it: upper case, without spaces or letters the sticker never uses. */
export const normalizeLockerCode = (raw: string): string =>
  raw.toUpperCase().replace(NOT_IN_CODE, '').slice(0, LOCKER_CODE_LENGTH);

export const isLockerCode = (code: string): boolean =>
  code.length === LOCKER_CODE_LENGTH && normalizeLockerCode(code) === code;

/** As printed on the sticker: "K7QM 4XRT". */
export const formatLockerCode = (code: string): string =>
  code.length > 4 ? `${code.slice(0, 4)} ${code.slice(4)}` : code;

export const MAX_GAME_NAME = 60;

/** One .sb3 file in the kid's Locker. A game saved from here is a Locker project holding one file. */
export interface LockerGame {
  projectId: string;
  fileId: string;
  name: string;
  /** ISO time of the last save (the Locker updates it when a file is replaced) */
  savedAt: string;
  size: number;
}

export interface LockerContents {
  /** newest first */
  games: LockerGame[];
}

/** The game's file name in the Locker: the name without the characters file systems refuse. */
export const gameFileName = (name: string): string => {
  const base = name
    .replace(/[\\/:*?"<>|\p{Cc}]/gu, '')
    .trim()
    .replace(/[. ]+$/, '');
  return `${base || 'Spiel'}.sb3`;
};

/** Saving under a name the Locker already has replaces that game; names match regardless of case. */
export const findGame = (games: readonly LockerGame[], name: string): LockerGame | undefined => {
  const wanted = name.trim().toLocaleLowerCase('de');
  return wanted ? games.find((g) => g.name.trim().toLocaleLowerCase('de') === wanted) : undefined;
};

/** The entries in Scratch's Datei menu (src/editor/locker-menu.ts). */
export type LockerAction = 'load' | 'save' | 'open';
