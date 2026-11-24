// @vitest-environment jsdom
import { describe, test, expect, beforeEach } from 'vitest';
import { tourWordScore, TOUR_HAND, TOUR_FIRST_WORD, TOUR_LONG_WORD, TOUR_FAKE_WORD, tourSeenBy, markTourSeen } from '../tour';
import { calculateScore } from '../gameUtils';
import { createInitialGameState } from '../screens/GameScreen';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TILE_DISTRIBUTION } from '../../constants';

const spellable = (word: string) => {
    const left = [...TOUR_HAND];
    return word.split('').every(l => { const i = left.indexOf(l); if (i < 0) return false; left.splice(i, 1); return true; });
};

describe('the 1-minute tour (v7.78.0)', () => {
    test('its practice words score what the real game pays', () => {
        for (const word of [TOUR_FIRST_WORD, TOUR_LONG_WORD]) {
            const tiles = word.split('').map((letter, i) => ({ id: `t${i}`, letter, points: TILE_DISTRIBUTION[letter].points }));
            const real = calculateScore(word.toLowerCase(), tiles, createInitialGameState());
            expect(tourWordScore(word).score).toBe(real.totalScore);
        }
        expect(tourWordScore('CAT')).toMatchObject({ score: 5, seconds: 2 });
        expect(tourWordScore('CLOSET')).toMatchObject({ score: 16, seconds: 7, lengthMult: 2 });
    });

    test('the hand spells the words, and the fake word is really fake', () => {
        const words = new Set(readFileSync(resolve(__dirname, '../../public/words/wordlist.txt'), 'utf8').split(/\r?\n/));
        expect(spellable(TOUR_FIRST_WORD)).toBe(true);
        expect(spellable(TOUR_LONG_WORD)).toBe(true);
        expect(spellable(TOUR_FAKE_WORD)).toBe(true);
        expect(words.has(TOUR_FIRST_WORD.toLowerCase())).toBe(true); // npm run words builds the list before tests
        expect(words.has(TOUR_LONG_WORD.toLowerCase())).toBe(true);
        expect(words.has(TOUR_FAKE_WORD.toLowerCase())).toBe(false);
        expect(words.size).toBeGreaterThan(1000);
    });

    describe('offered once per name', () => {
        beforeEach(() => localStorage.clear());
        test('marking a name remembers it, case-insensitively', () => {
            expect(tourSeenBy('Ada')).toBe(false);
            markTourSeen('Ada');
            expect(tourSeenBy('ADA ')).toBe(true);
            expect(tourSeenBy('Bob')).toBe(false);
        });
    });
});
