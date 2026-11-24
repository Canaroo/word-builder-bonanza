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

// Names (lowercase) that were offered the tour or took it, so a new player is asked once.
const names = (): string[] => {
    const v = storage.getJSON<unknown>(STORAGE_KEYS.tourSeen, []);
    return Array.isArray(v) ? v.filter((n): n is string => typeof n === 'string') : [];
};
export const tourSeenBy = (name: string): boolean => names().includes(name.trim().toLowerCase());
export const markTourSeen = (name: string) => {
    const key = name.trim().toLowerCase();
    if (!key || tourSeenBy(key)) return;
    storage.setJSON(STORAGE_KEYS.tourSeen, [...names(), key].slice(-50));
};
