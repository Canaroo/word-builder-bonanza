// Pure gameplay rules. No React, no DOM: easy to test and to tune via config/gameplay.ts.
import { GAMEPLAY } from '../config/gameplay';
import { ScoreCalculationResult } from '../types';

const lookupByLength = (table: Record<number, number>, length: number, below: number): number => {
    const keys = Object.keys(table).map(Number).sort((a, b) => a - b);
    if (length < keys[0]) return below;
    const key = [...keys].reverse().find(k => length >= k)!;
    return table[key];
};

/** Seconds a valid word adds to the time bank. */
export const timeForWord = (length: number): number =>
    lookupByLength(GAMEPLAY.timeBank.secondsByLength, length, 0);

/** Keeps the time bank between 0 and its maximum. */
export const clampTime = (seconds: number): number =>
    Math.max(0, Math.min(GAMEPLAY.timeBank.max, Math.round(seconds)));

/** Word score multiplier for a word of this length (1 for short words). */
export const lengthMultiplier = (length: number): number =>
    lookupByLength(GAMEPLAY.lengthMultipliers, length, 1);

/**
 * Combines word multipliers by adding them together: x2 and x4 make x6, not x8.
 * Multipliers of 1 or less don't count; with none, the result is x1.
 */
export const combineMultipliers = (multipliers: number[]): number => {
    const active = multipliers.filter(m => m > 1);
    return active.length ? active.reduce((sum, m) => sum + m, 0) : 1;
};

/**
 * Adds one more word multiplier to an already calculated score, the additive way
 * (current x3 plus a x2 combo makes x5). Falls back to multiplying when the score's
 * multiplier breakdown isn't known. Capped scores stay capped.
 */
export const addWordMultiplier = (result: ScoreCalculationResult, multiplier: number): ScoreCalculationResult => {
    if (result.capped || multiplier <= 1) return result;
    const { scoreBeforeMultiplier: base, wordMultiplier: current } = result;
    if (base === undefined || current === undefined) {
        return { ...result, totalScore: Math.round(result.totalScore * multiplier) };
    }
    const next = combineMultipliers([current, multiplier]);
    return {
        ...result,
        totalScore: Math.round(result.totalScore + base * (next - current)),
        wordMultiplier: next,
    };
};

/** How many tiles to draw so the hand is back to the target size. */
export const refillCount = (tilesInHand: number, handSize: number = GAMEPLAY.handSize): number =>
    Math.max(0, handSize - tilesInHand);

/** PowerPlay meter after playing a word, and whether it just filled. */
export const advancePowerPlayMeter = (lettersSoFar: number, wordLength: number) => {
    const total = lettersSoFar + wordLength;
    const full = total >= GAMEPLAY.powerPlayMeterLetters;
    return { letters: full ? GAMEPLAY.powerPlayMeterLetters : total, full };
};

/** Strike recovery after a valid word: returns the new streak and whether a strike is won back. */
export const advanceStrikeRecovery = (streak: number, strikes: number) => {
    const next = streak + 1;
    if (next >= GAMEPLAY.strikeRecoveryStreak) {
        return { streak: 0, recovered: strikes > 0 };
    }
    return { streak: next, recovered: false };
};
