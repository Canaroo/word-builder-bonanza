// Pure gameplay rules. No React, no DOM: easy to test and to tune via config/gameplay.ts.
import { BOSS, GAMEPLAY, POWER_GLOVE_BANK_MAX } from '../config/gameplay';
import { BossRound, ScoreCalculationResult } from '../types';

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

/**
 * Levels counted at the early and late rates for a level-based ramp that starts at fromLevel:
 * early levels run up to lateFromLevel, late levels are the ones after it.
 */
const rampSteps = (level: number, fromLevel: number) => {
    const { lateFromLevel } = GAMEPLAY.levels;
    const lv = Math.max(1, level);
    return {
        early: Math.max(0, Math.min(lv, lateFromLevel) - (fromLevel - 1)),
        late: Math.max(0, lv - Math.max(lateFromLevel, fromLevel - 1)),
    };
};

/** How fast the clock runs at this level: 1 = real time, +5% a level, steeper after lateFromLevel, capped at maxSpeed. */
export const clockSpeedFor = (level: number): number => {
    const { speedUpPerLevel, lateSpeedUpPerLevel, maxSpeed } = GAMEPLAY.levels;
    const { early, late } = rampSteps(level, 2);
    return Math.min(maxSpeed, Math.round((1 + speedUpPerLevel * early + lateSpeedUpPerLevel * late) * 100) / 100);
};

/** The tier (name and color) a level belongs to. */
export const levelTierFor = (level: number) =>
    [...GAMEPLAY.levelTiers].reverse().find(t => Math.max(1, level) >= t.fromLevel) ?? GAMEPLAY.levelTiers[0];

/** Words played toward the next level: { done, needed }. */
export const levelProgressFor = (validWords: number) => ({
    done: Math.max(0, validWords) % GAMEPLAY.levels.wordsPerLevel,
    needed: GAMEPLAY.levels.wordsPerLevel,
});

/** Milliseconds per clock tick at this level. */
export const tickMsFor = (level: number): number => Math.round(1000 / clockSpeedFor(level));

/** Share of a word's time it still earns at this level (1 early on, down to wordTimeShrink.min). */
export const wordTimeScaleFor = (level: number): number => {
    const { perLateLevel, min } = GAMEPLAY.wordTimeShrink;
    const { late } = rampSteps(level, GAMEPLAY.levels.lateFromLevel + 1);
    return Math.max(min, Math.round((1 - perLateLevel * late) * 100) / 100);
};

/** Seconds a valid word earns at this level, before the overflow tax: 3-letter words stop paying, and the rest shrink. */
export const timeForWordAtLevel = (length: number, level: number): number => {
    if (length <= 3 && level >= GAMEPLAY.timeBank.shortWordTimeStopsAtLevel) return 0;
    const seconds = timeForWord(length);
    return seconds > 0 ? Math.max(1, Math.round(seconds * wordTimeScaleFor(level))) : 0;
};

/** Letters needed to fill the PowerPlay meter at this level. */
export const meterLettersFor = (level: number): number => {
    const { fromLevel, perLevel, perLateLevel, max } = GAMEPLAY.powerPlayMeterGrowth;
    const { early, late } = rampSteps(level, fromLevel);
    return Math.min(max, GAMEPLAY.powerPlayMeterLetters + perLevel * early + perLateLevel * late);
};

/** Overflow tax: while the bank is above overflowAbove, word time is halved (rounded down). */
export const taxWordTime = (seconds: number, bank: number): number =>
    seconds > 0 && bank > GAMEPLAY.timeBank.overflowAbove ? Math.floor(seconds / 2) : seconds;

/** How much of a charm/PowerPlay time bonus survives at this level (1 at level 1, down to half). */
export const bonusTimeScale = (level: number): number => {
    const { bonusShrinkPerLevel, bonusMinScale } = GAMEPLAY.timeBank;
    return Math.max(bonusMinScale, Math.round((1 - bonusShrinkPerLevel * (Math.max(1, level) - 1)) * 100) / 100);
};

/** Seconds a charm/PowerPlay time bonus actually adds: shrunk by level, then halved above the overflow line. */
export const bonusTime = (seconds: number, bank: number, level: number): number =>
    seconds <= 0 ? seconds : taxWordTime(Math.max(1, Math.round(seconds * bonusTimeScale(level))), bank);

/** Is this level a boss level (3, 6, 9...)? Returns which boss level of the run it is, or 0. */
export const bossNumberFor = (level: number): number =>
    level >= BOSS.everyLevels && level % BOSS.everyLevels === 0 ? level / BOSS.everyLevels : 0;

/** The reward for beating the nth boss of a run. */
export const bossRewardFor = (bossNumber: number) =>
    BOSS.rewards[Math.min(Math.max(1, bossNumber), BOSS.rewards.length) - 1];

/**
 * One valid word against a boss: returns the round afterward (null once it's over) and how it
 * ended. It ends as soon as the badge is won, when the words run out, or when even the
 * consolation can't be reached any more.
 */
export const advanceBoss = (round: BossRound, hit: boolean): { round: BossRound | null; outcome: 'won' | 'close' | 'escaped' | null } => {
    const next = { ...round, hits: round.hits + (hit ? 1 : 0), wordsLeft: round.wordsLeft - 1 };
    if (next.hits >= BOSS.hitsToWin) return { round: null, outcome: 'won' };
    if (next.wordsLeft <= 0) return { round: null, outcome: next.hits >= BOSS.closeHits ? 'close' : 'escaped' };
    if (next.hits + next.wordsLeft < BOSS.closeHits) return { round: null, outcome: 'escaped' };
    return { round: next, outcome: null };
};

/** Gotta Catch 'Em All: the vowels caught so far plus this word's, in AEIOU order. */
export const catchVowels = (caught: string, word: string): string => {
    const seen = new Set((caught + word).toUpperCase());
    return [...'AEIOU'].filter(v => seen.has(v)).join('');
};

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
export const advancePowerPlayMeter = (lettersSoFar: number, wordLength: number, level = 1) => {
    const needed = meterLettersFor(level);
    const total = lettersSoFar + wordLength;
    const full = total >= needed;
    return { letters: full ? needed : total, full };
};
