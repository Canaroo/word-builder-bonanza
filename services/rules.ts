// Pure gameplay rules. No React, no DOM: easy to test and to tune via config/gameplay.ts.
import { GAMEPLAY, POWER_GLOVE_BANK_MAX } from '../config/gameplay';
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

/** Run level (starts at 1) after this many valid words. */
export const levelFor = (validWords: number): number =>
    1 + Math.floor(Math.max(0, validWords) / GAMEPLAY.levels.wordsPerLevel);

/** How fast the clock runs at this level: 1 = real time, capped at maxSpeed. */
export const clockSpeedFor = (level: number): number => {
    const { speedUpPerLevel, maxSpeed } = GAMEPLAY.levels;
    return Math.min(maxSpeed, Math.round((1 + speedUpPerLevel * (Math.max(1, level) - 1)) * 100) / 100);
};

/** Milliseconds per clock tick at this level. */
export const tickMsFor = (level: number): number => Math.round(1000 / clockSpeedFor(level));

/** Seconds a valid word earns at this level, before the overflow tax: 3-letter words stop paying later on. */
export const timeForWordAtLevel = (length: number, level: number): number =>
    length <= 3 && level >= GAMEPLAY.timeBank.shortWordTimeStopsAtLevel ? 0 : timeForWord(length);

/** Overflow tax: while the bank is above overflowAbove, word time is halved (rounded down). */
export const taxWordTime = (seconds: number, bank: number): number =>
    seconds > 0 && bank > GAMEPLAY.timeBank.overflowAbove ? Math.floor(seconds / 2) : seconds;

/** Words in a row the Golden Snitch needs for its next catch, or null once it has flown away. */
export const snitchTargetFor = (catches: number): number | null =>
    GAMEPLAY.snitchCatchTargets[catches] ?? null;

/** Keeps the time bank between 0 and its maximum (90s, or more with the Power Glove charm). */
export const clampTime = (seconds: number, max: number = GAMEPLAY.timeBank.max): number =>
    Math.max(0, Math.min(max, Math.round(seconds)));

/** The time bank's maximum for this run: the Power Glove charm raises it. */
export const bankMax = (gameState: { activeCharms?: { id: string }[] } | null | undefined): number =>
    gameState?.activeCharms?.some(c => c.id === 'powerGlove') ? POWER_GLOVE_BANK_MAX : GAMEPLAY.timeBank.max;

/** Tiles the hand refills to: Go-Go-Gadget Hands adds two while it lasts. */
export const handSizeFor = (gameState: { activePowerPlays?: Record<string, unknown> } | null | undefined): number =>
    GAMEPLAY.handSize + (gameState?.activePowerPlays?.gadgetHands ? 2 : 0);

/** Tile values for The Upside Down: common letters become valuable and rare ones cheap. */
export const UPSIDE_DOWN_POINTS: Record<number, number> = { 1: 10, 2: 8, 3: 5, 4: 4, 5: 3, 8: 2, 10: 1 };

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
