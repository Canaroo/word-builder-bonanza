import { describe, test, expect } from 'vitest';
import { GAMEPLAY } from '../../config/gameplay';
import {
    timeForWord, clampTime, lengthMultiplier, combineMultipliers, addWordMultiplier,
    refillCount, advancePowerPlayMeter,
} from '../rules';

describe('time bank', () => {
    test('longer words add more time', () => {
        expect([2, 3, 4, 5, 6, 7, 9].map(timeForWord)).toEqual([0, 2, 3, 5, 7, 10, 10]);
    });

    test('the bank stays between 0 and its maximum', () => {
        expect(clampTime(-4)).toBe(0);
        expect(clampTime(500)).toBe(GAMEPLAY.timeBank.max);
        expect(clampTime(41.6)).toBe(42);
    });
});

describe('scoring', () => {
    test('length multiplier is a smooth curve', () => {
        expect([3, 4, 5, 6, 7, 8, 12].map(lengthMultiplier)).toEqual([1, 1.25, 1.5, 2, 2.5, 3, 3]);
    });

    test('multipliers add together instead of multiplying', () => {
        expect(combineMultipliers([])).toBe(1);
        expect(combineMultipliers([4])).toBe(4);
        expect(combineMultipliers([2, 4])).toBe(6);
        expect(combineMultipliers([2, 1.5, 1, 0])).toBe(3.5);
    });

    test('a later multiplier joins the word multiplier', () => {
        // base 10 at x3 (30) + 5 flat = 35; a x2 combo makes it x5: 50 + 5 = 55.
        const result = { totalScore: 35, baseScore: 10, bonuses: [], scoreBeforeMultiplier: 10, wordMultiplier: 3 };
        expect(addWordMultiplier(result, 2)).toMatchObject({ totalScore: 55, wordMultiplier: 5 });
        // With no multiplier yet (x1), a x2 just doubles the base part.
        expect(addWordMultiplier({ ...result, totalScore: 15, wordMultiplier: 1 }, 2).totalScore).toBe(25);
    });

    test('capped scores stay capped, and unknown bases multiply', () => {
        expect(addWordMultiplier({ totalScore: 1, baseScore: 9, bonuses: [], scoreBeforeMultiplier: 9, capped: true }, 2).totalScore).toBe(1);
        expect(addWordMultiplier({ totalScore: 20, baseScore: 9, bonuses: [] }, 2).totalScore).toBe(40);
    });
});

describe('rack, meter and strikes', () => {
    test('refill tops the hand back up to the hand size', () => {
        expect(refillCount(3)).toBe(GAMEPLAY.handSize - 3);
        expect(refillCount(GAMEPLAY.handSize + 1)).toBe(0);
    });

    test('PowerPlay meter fills from letters played', () => {
        expect(advancePowerPlayMeter(10, 5)).toEqual({ letters: 15, full: false });
        expect(advancePowerPlayMeter(22, 5)).toEqual({ letters: GAMEPLAY.powerPlayMeterLetters, full: true });
    });
});
