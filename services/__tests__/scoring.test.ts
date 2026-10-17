import { describe, test, expect } from 'vitest';
import { calculateScore } from '../gameUtils';
import { addWordMultiplier } from '../rules';
import type { GameState, Tile } from '../../types';

const tiles = (letters: string, points = 1): Tile[] =>
    letters.split('').map((letter, i) => ({ id: `${letter}${i}`, letter, points }));

// Only the fields calculateScore reads.
const state = (overrides: Partial<GameState> = {}) => ({
    roundType: 'normal',
    activeCharms: [],
    activePowerPlays: {},
    letterMultipliers: {},
    wordMultipliersByLetter: {},
    powerStarResidualActive: false,
    ...overrides,
}) as unknown as GameState;

describe('calculateScore', () => {
    test('short words score their tile points', () => {
        expect(calculateScore('cat', tiles('CAT'), state()).totalScore).toBe(3);
    });

    test('length bonus grows smoothly with word length', () => {
        expect(calculateScore('cats', tiles('CATS'), state()).totalScore).toBe(5); // 4 x1.25
        expect(calculateScore('carts', tiles('CARTS'), state()).totalScore).toBe(8); // 5 x1.5 = 7.5
        expect(calculateScore('carton', tiles('CARTON'), state()).totalScore).toBe(12); // 6 x2
        expect(calculateScore('cartons', tiles('CARTONS'), state()).totalScore).toBe(18); // 7 x2.5 = 17.5
        expect(calculateScore('cartoons', tiles('CARTOONS'), state()).totalScore).toBe(24); // 8 x3
    });

    test('word multipliers add together instead of multiplying', () => {
        // 6 letters (x2) + Nuclear Option (x4) = x6, not x8.
        const result = calculateScore('carton', tiles('CARTON'), state({ activePowerPlays: { nuclearOption: true } } as any));
        expect(result.wordMultiplier).toBe(6);
        expect(result.totalScore).toBe(36);
    });

    test('a later Word Combo x2 joins the same sum', () => {
        const result = calculateScore('carton', tiles('CARTON'), state({ activePowerPlays: { nuclearOption: true } } as any));
        expect(addWordMultiplier(result, 2).totalScore).toBe(48); // 6 x (2 + 4 + 2)
    });

    test('score caps stay in force', () => {
        const result = calculateScore('carton', tiles('CARTON'), state({ activePowerPlays: { schruteBucks: true } } as any));
        expect(result).toMatchObject({ totalScore: 1, capped: true });
        expect(addWordMultiplier(result, 2).totalScore).toBe(1);
    });
});
