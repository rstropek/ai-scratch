import { expect, test } from 'vitest';
import {
  findGame,
  formatLockerCode,
  gameFileName,
  isLockerCode,
  type LockerGame,
  normalizeLockerCode,
} from './locker.ts';

test('codes are typed the way kids type them', () => {
  expect(normalizeLockerCode(' k7qm 4xrt ')).toBe('K7QM4XRT');
  expect(normalizeLockerCode('K7QM-4XRT-EXTRA')).toBe('K7QM4XRT');
  // the sticker never uses 0, O, 1 or I
  expect(normalizeLockerCode('O0I1K7')).toBe('K7');
  expect(isLockerCode('K7QM4XRT')).toBe(true);
  expect(isLockerCode('K7QM4XR')).toBe(false);
  expect(isLockerCode('k7qm4xrt')).toBe(false);
  expect(formatLockerCode('K7QM4XRT')).toBe('K7QM 4XRT');
  expect(formatLockerCode('K7Q')).toBe('K7Q');
});

test('file names drop what file systems refuse', () => {
  expect(gameFileName('Hai-Alarm')).toBe('Hai-Alarm.sb3');
  expect(gameFileName('Ja/Nein: Quiz?')).toBe('JaNein Quiz.sb3');
  expect(gameFileName('Ende... ')).toBe('Ende.sb3');
  expect(gameFileName('???')).toBe('Spiel.sb3');
});

test('names match regardless of case and surrounding spaces', () => {
  const games = [{ name: 'Weltraum-Abenteuer' }, { name: 'Übung' }] as LockerGame[];
  expect(findGame(games, ' weltraum-abenteuer ')).toBe(games[0]);
  expect(findGame(games, 'ÜBUNG')).toBe(games[1]);
  expect(findGame(games, 'Weltraum')).toBeUndefined();
  expect(findGame(games, '  ')).toBeUndefined();
});
