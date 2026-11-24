// The 1-minute tour (v7.78.0): numbers for its practice words, and who has already been offered it.
// Scores use the real rules (tile points x the length bonus) so the tour never promises something
// the game doesn't pay.
import { TILE_DISTRIBUTION } from '../constants';
import { lengthMultiplier, timeForWord } from './rules';
import { storage, STORAGE_KEYS } from './storage';

export interface TourWordScore {
    word: string;
    tilePoints: number;
    lengthMult: number;
    score: number;
    seconds: number;
}

/** What a plain word scores at level 1 with no charms or PowerPlays. */
export const tourWordScore = (word: string): TourWordScore => {
    const letters = word.toUpperCase().split('');
    const tilePoints = letters.reduce((sum, l) => sum + (TILE_DISTRIBUTION[l]?.points ?? 0), 0);
    const lengthMult = lengthMultiplier(letters.length);
    return { word: word.toUpperCase(), tilePoints, lengthMult, score: Math.round(tilePoints * lengthMult), seconds: timeForWord(letters.length) };
};

/** The tour's hand: spells CAT (screen 1) and CLOSET (screen 2). */
export const TOUR_HAND = ['S', 'C', 'E', 'A', 'T', 'O', 'R', 'L'];
export const TOUR_FIRST_WORD = 'CAT';
export const TOUR_LONG_WORD = 'CLOSET';
/** A fake word for the strike demo. */
export const TOUR_FAKE_WORD = 'TOLC';
export const TOUR_CLOCK_START = 30;

// Names (lowercase) kept per device: who was offered the tour (asked once), and who finished it
// (v7.78.1: their pill shrinks to a ❓ in the top bar).
type TourList = typeof STORAGE_KEYS.tourSeen | typeof STORAGE_KEYS.tourDone;
const names = (key: TourList): string[] => {
    const v = storage.getJSON<unknown>(key, []);
    return Array.isArray(v) ? v.filter((n): n is string => typeof n === 'string') : [];
};
const has = (key: TourList, name: string) => names(key).includes(name.trim().toLowerCase());
const add = (key: TourList, name: string) => {
    const n = name.trim().toLowerCase();
    if (!n || has(key, n)) return;
    storage.setJSON(key, [...names(key), n].slice(-50));
};
export const tourSeenBy = (name: string): boolean => has(STORAGE_KEYS.tourSeen, name);
export const markTourSeen = (name: string) => add(STORAGE_KEYS.tourSeen, name);
/** Finished = tapped "I'm ready" on the last screen (Skip doesn't count). */
export const tourFinishedBy = (name: string): boolean => has(STORAGE_KEYS.tourDone, name);
export const markTourFinished = (name: string) => add(STORAGE_KEYS.tourDone, name);
