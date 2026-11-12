// Pure gameplay rules. No React, no DOM: easy to test and to tune via config/gameplay.ts.
import { BOSS, CHARM_BONUS, CHARM_LENGTH_BOOST, CHARM_UPGRADE, GAMEPLAY, PRIZE_GROWTH, POWER_GLOVE_BANK_MAX, POWER_PLAY_VALUES, POWER_WORD_EFFECTS } from '../config/gameplay';
import { BossRound, PowerWordEffect, ScoreCalculationResult } from '../types';

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

type WithCharms = { activeCharms?: { id: string }[] } | null | undefined;
const equipped = (gs: WithCharms, id: string) => !!gs?.activeCharms?.some(c => c.id === id);

/** Letters needed to fill the PowerPlay meter at this level (the Turbo Button charm needs fewer). */
export const meterLettersFor = (level: number, gs?: WithCharms): number => {
    const { fromLevel, perLevel, perLateLevel, max } = GAMEPLAY.powerPlayMeterGrowth;
    const { early, late } = rampSteps(level, fromLevel);
    const letters = Math.min(max, GAMEPLAY.powerPlayMeterLetters + perLevel * early + perLateLevel * late);
    return equipped(gs, 'turboButton') ? Math.round(letters * (1 - CHARM_BONUS.turboButtonPercent / 100)) : letters;
};

/** Hits a boss round needs for the Badge: fewer for the hardest rules (boss.hitsToWin) and with the Little Mac charm. */
export const bossHitsToWin = (gs: WithCharms, boss?: { hitsToWin?: number } | null): number =>
    (boss?.hitsToWin ?? BOSS.hitsToWin) - (equipped(gs, 'littleMac') ? CHARM_BONUS.littleMacHits : 0);

/** Hits that earn the "so close" consolation: the same gap below the Badge for every boss (6 → 4, 4 → 2). */
export const bossCloseHits = (boss?: { hitsToWin?: number } | null): number =>
    Math.max(1, (boss?.hitsToWin ?? BOSS.hitsToWin) - (BOSS.hitsToWin - BOSS.closeHits));

const plainQuotes = (s: string) => s.replace(/[‘’]/g, "'");

/**
 * Points the named charms earned on a word: the "+N pts" lines of the score breakdown whose name
 * starts with a charm's name ("Vanna's Vowels (E)", "Mixtape (link 2)").
 */
export const charmPointsIn = (bonuses: { name: string; description: string }[], charmNames: string[]): number => {
    const names = charmNames.map(plainQuotes);
    return bonuses
        .filter(b => names.some(n => plainQuotes(b.name).startsWith(n)))
        .reduce((sum, b) => sum + Number(/\+(\d+) pts/.exec(b.description)?.[1] ?? 0), 0);
};

/** Extra points an upgraded charm's bonuses pay on a word (CHARM_UPGRADE.percent of them, rounded). */
export const charmUpgradePoints = (bonuses: { name: string; description: string }[], upgradedNames: string[]): number =>
    upgradedNames.length ? Math.round(charmPointsIn(bonuses, upgradedNames) * CHARM_UPGRADE.percent / 100) : 0;

/** Percent more that charm points pay on a word of this length (0 for short words). */
export const charmLengthBoostFor = (length: number): number => lookupByLength(CHARM_LENGTH_BOOST, length, 0);

/** Extra points the long-word boost adds to these charms' bonuses on a word of this length. */
export const charmLengthPoints = (bonuses: { name: string; description: string }[], charmNames: string[], length: number): number => {
    const percent = charmLengthBoostFor(length);
    return percent > 0 && charmNames.length ? Math.round(charmPointsIn(bonuses, charmNames) * percent / 100) : 0;
};

/**
 * Word multipliers that also cover charm points (v7.35): the ones from PowerPlays, multiplier tiles
 * and the SPICE power word, by the name of their line in the score breakdown. A multiplier used to
 * touch only the tile points (about 14 a word), so "x3 next word" was worth about +30. The length
 * bonus (the long-word boost covers it), charm multipliers and the Word Combo are left out, and so
 * are the coin flips that already multiply the whole score (Heisenberg, Double or Nothing, Blue Shell).
 * A new PowerPlay multiplier should be added here.
 */
export const ITEM_MULTIPLIER_LINES = [
    'Tile Multiplier', 'Super Tile', 'Red Wedding', 'Konami Code', 'Ludicrous Speed', 'Combo Breaker',
    "Let's Get Ready to Rumble!", '🌶️ Spice It Up', 'Nuclear Option', 'Extreme Makeover', "Cassie's Clue",
    'Tetris Touch', 'Wordionaire: Double Down', 'Pinky and the Brain', 'Jackass', 'Bird Box',
    "Let's Get Dangerous", 'Space Invader (Win)', 'REDRUM', 'More Than Meets the Eye',
] as const;

/** The combined item multiplier on a word (x2 and x3 make x5, like word multipliers do); 1 when there is none. */
export const itemMultiplierIn = (bonuses: { name: string; description: string }[]): number => {
    const sum = bonuses
        .filter(b => ITEM_MULTIPLIER_LINES.some(n => plainQuotes(b.name).startsWith(plainQuotes(n))))
        .map(b => Number(/^x(\d+(?:\.\d+)?)/.exec(b.description)?.[1] ?? 0))
        .filter(m => m > 1)
        .reduce((a, b) => a + b, 0);
    return sum > 1 ? sum : 1;
};

/** Extra points when an item multiplier covers these charms' points on a word: charm points x (multiplier - 1). */
export const charmMultiplierPoints = (bonuses: { name: string; description: string }[], charmNames: string[]): number => {
    const multiplier = itemMultiplierIn(bonuses);
    return multiplier > 1 && charmNames.length ? Math.round(charmPointsIn(bonuses, charmNames) * (multiplier - 1)) : 0;
};

/** How much PowerPlay point prizes are multiplied by at this level (1 at level 1, up to PRIZE_GROWTH.max). */
export const prizeScaleFor = (level: number): number =>
    Math.min(PRIZE_GROWTH.max, Math.round((1 + PRIZE_GROWTH.perLevel * (Math.max(1, level) - 1)) * 100) / 100);

/** A PowerPlay point prize at this level, rounded to 5. Losses (0 or less) are never scaled. */
export const prizeFor = (points: number, level: number): number =>
    points > 0 ? Math.round(points * prizeScaleFor(level) / 5) * 5 : points;

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
export const advanceBoss = (round: BossRound, hit: boolean, hitsToWin: number = BOSS.hitsToWin, closeHits: number = BOSS.closeHits): { round: BossRound | null; outcome: 'won' | 'close' | 'escaped' | null } => {
    const next = { ...round, hits: round.hits + (hit ? 1 : 0), wordsLeft: round.wordsLeft - 1 };
    if (next.hits >= hitsToWin) return { round: null, outcome: 'won' };
    if (next.wordsLeft <= 0) return { round: null, outcome: next.hits >= closeHits ? 'close' : 'escaped' };
    if (next.hits + next.wordsLeft < closeHits) return { round: null, outcome: 'escaped' };
    return { round: next, outcome: null };
};

/** 🎰 The slot machine's result for a roll in [0, 1): good, better or best. */
export const slotPayout = (roll: number) => {
    let acc = 0;
    for (const p of POWER_WORD_EFFECTS.slot) {
        acc += p.chance;
        if (roll < acc) return p;
    }
    return POWER_WORD_EFFECTS.slot[POWER_WORD_EFFECTS.slot.length - 1];
};

/** Power words fire at most once per level: has this one already fired at `level`? */
export const powerWordReady = (levels: Record<string, number> | undefined, id: string, level: number): boolean =>
    (levels?.[id] ?? 0) < level;

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
export const handSizeFor = (gameState: { activePowerPlays?: Record<string, unknown>; activeCharms?: { id: string }[] } | null | undefined): number =>
    GAMEPLAY.handSize + (gameState?.activePowerPlays?.gadgetHands ? 2 : 0) - (equipped(gameState, 'honeyIShrunkTheKids') ? 1 : 0);

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
export const advancePowerPlayMeter = (lettersSoFar: number, wordLength: number, level = 1, gs?: WithCharms) => {
    const needed = meterLettersFor(level, gs);
    const total = lettersSoFar + wordLength;
    const full = total >= needed;
    return { letters: full ? needed : total, full };
};

/** One thing that changed at a level-up, shown as "from → to" on the level-up card. */
export interface LevelChange { icon: string; label: string; from: string; to: string }

/** What a level-up means: the level, its tier, whether the tier is new, what got harder, and boss warnings. */
export interface LevelUpInfo {
    level: number;
    tier: string;
    tone: 'cyan' | 'yellow' | 'orange' | 'red';
    newTier: boolean;
    changes: LevelChange[];
    /** A boss round starts on this level, or on the next one. */
    boss: 'now' | 'next' | null;
}

export const levelUpInfo = (level: number, gs?: WithCharms): LevelUpInfo => {
    const prev = Math.max(1, level - 1);
    const tier = levelTierFor(level);
    const changes: LevelChange[] = [];
    const speed = [clockSpeedFor(prev), clockSpeedFor(level)];
    if (speed[1] !== speed[0]) changes.push({ icon: '⏱', label: 'Clock speed', from: `x${speed[0]}`, to: `x${speed[1]}` });
    const scale = [wordTimeScaleFor(prev), wordTimeScaleFor(level)];
    if (scale[1] !== scale[0]) changes.push({ icon: '⏳', label: 'Word time', from: `${Math.round(scale[0] * 100)}%`, to: `${Math.round(scale[1] * 100)}%` });
    if (level === GAMEPLAY.timeBank.shortWordTimeStopsAtLevel) changes.push({ icon: '✂️', label: '3-letter words', from: `+${timeForWord(3)}s`, to: 'no time' });
    const meter = [meterLettersFor(prev, gs), meterLettersFor(level, gs)];
    if (meter[1] !== meter[0]) changes.push({ icon: '⚡', label: 'PowerPlay letters', from: `${meter[0]}`, to: `${meter[1]}` });
    const prize = [prizeScaleFor(prev), prizeScaleFor(level)];
    if (prize[1] !== prize[0]) changes.push({ icon: '🎁', label: 'PowerPlay prizes', from: `x${prize[0]}`, to: `x${prize[1]}` });
    return {
        level, tier: tier.name, tone: tier.tone,
        newTier: tier !== levelTierFor(prev),
        changes,
        boss: bossNumberFor(level) ? 'now' : bossNumberFor(level + 1) ? 'next' : null,
    };
};

/** What a power word does, in plain words, for the reveal, the Collection and the Bonus Vault. */
export const powerWordInfo = (effect: PowerWordEffect): { label: string; does: string; again: string } => {
    const E = POWER_WORD_EFFECTS;
    const slot = E.slot.map(p => `${p.seconds}`).join(', ');
    const info = {
        slot: { label: 'SLOT MACHINE', does: `Pull a slot machine for bonus time next round: +${slot} seconds.` },
        freeze: { label: 'FREEZE', does: `The clock won't move for the first ${E.freezeSeconds} seconds of your next round.` },
        heal: { label: 'HEAL', does: `Removes one strike. With no strikes, +${E.healFallbackPoints} points instead.` },
        slow: { label: 'SLOW MOTION', does: `The clock runs at half speed for your next ${E.slowWords} words.` },
        twin: { label: 'CLONE', does: 'Clones your best word: its time next round, plus one step toward your Word Combo.' },
        shield: { label: 'RING SHIELD', does: 'Blocks your next strike. One shield at a time.' },
        rewind: { label: 'REWIND', does: `The clock drops back one speed step for the rest of this level (at level 1, +${E.rewindLevelOneSeconds} seconds instead).` },
        sword: { label: 'TAKE THIS', does: 'Fills your PowerPlay meter, so a PowerPlay offer appears.' },
        spice: { label: 'SPICE IT UP', does: `Your next word scores x${E.spiceMultiplier}.` },
        cake: { label: 'CAKE', does: 'A charm offer appears. The cake was real this time.' },
    }[effect];
    return { ...info, again: 'Play it again on a later level to use it again (once per level).' };
};

// --- v7.25 gamble PowerPlays: the rolls, kept pure so they can be tested (POWER_PLAY_VALUES). ---
const pickByChance = <T extends { chance: number }>(list: T[], roll: number): T => {
    let acc = 0;
    for (const item of list) { acc += item.chance; if (roll < acc) return item; }
    return list[list.length - 1];
};
/** Plinko: the chip's points for a roll in [0, 1). */
export const plinkoPayout = (roll: number): number => pickByChance(POWER_PLAY_VALUES.plinko, roll).points;
/** Hot Tub Time Machine: seconds (negative = lost) for a roll in [0, 1). */
export const hotTubSeconds = (roll: number): number => pickByChance(POWER_PLAY_VALUES.hotTub, roll).seconds;
/** Daily Double: the wager, a share of the score kept between a floor and a cap, and never more
 * than the score itself (v7.28.8: at a low score the floor made it a free bet). */
export const dailyDoubleWager = (score: number): number => {
    const { dailyDoublePercent, dailyDoubleMin, dailyDoubleMax } = POWER_PLAY_VALUES;
    return Math.max(0, Math.min(score, dailyDoubleMax, Math.max(dailyDoubleMin, Math.round(score * dailyDoublePercent / 100))));
};
const shuffle = <T,>(list: T[], rand: () => number): T[] => {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
    return out;
};
/** Let's Make a Deal: a round's three doors, shuffled (0 = the Zonk). */
export const doorsForRound = (round: number, rand: () => number = Math.random): number[] =>
    shuffle([...POWER_PLAY_VALUES.doorRounds[Math.min(round, POWER_PLAY_VALUES.doorRounds.length - 1)], 0], rand);
/** Minesweeper: the pot after this many safe squares. */
export const minesweeperPot = (safePicks: number): number =>
    POWER_PLAY_VALUES.minesweeperLadder.slice(0, safePicks).reduce((a, b) => a + b, 0);
/** Deal or No Deal: the Banker's offer for this round, from the cases still unopened (yours included). */
export const bankerOffer = (unopened: number[], round: number): number => {
    const avg = unopened.reduce((a, b) => a + b, 0) / Math.max(1, unopened.length);
    return Math.round(avg * POWER_PLAY_VALUES.dealBankerFactors[Math.min(round, POWER_PLAY_VALUES.dealBankerFactors.length - 1)] / 5) * 5;
};
/** Deal or No Deal: a fresh game: your case and the others, shuffled. */
export const dealGame = (rand: () => number = Math.random) => {
    const [mine, ...others] = shuffle(POWER_PLAY_VALUES.dealCases, rand);
    return { mine, others };
};

/** Continue?: the points a rescue costs, a share of the score up to a cap. */
export const continueCost = (score: number): number => {
    const { continueScoreCostPercent, continueScoreCostMax } = POWER_PLAY_VALUES;
    return Math.min(continueScoreCostMax, Math.round(Math.max(0, score) * continueScoreCostPercent / 100));
};

// --- v7.28 PowerPlays: pure rules (POWER_PLAY_VALUES). ---
/** Tamagotchi: what the next feeding adds to the pot (feed 1 = one step, feed 2 = two...). */
export const tamagotchiFeed = (feedNumber: number): number => POWER_PLAY_VALUES.tamagotchiStep * feedNumber;
/** Tamagotchi: the pot after this many feedings. */
export const tamagotchiPot = (feeds: number): number =>
    Array.from({ length: feeds }, (_, i) => tamagotchiFeed(i + 1)).reduce((a, b) => a + b, 0);
/** Winner Winner Chicken Dinner: points for standing on this many letters (0 = nothing, or a bust over 21). */
export const blackjackPayout = (total: number): number => {
    if (total > POWER_PLAY_VALUES.blackjackTarget) return 0;
    return POWER_PLAY_VALUES.blackjackPayouts.find(p => total >= p.min)?.points ?? 0;
};
/** Winner Winner Chicken Dinner (v7.28.9): each valid word deals a card. 2-10 count as shown,
 * J/Q/K as 10, and an A as 11 unless that would bust (then 1). */
export const blackjackCard = (total: number, rand: () => number = Math.random): { face: string; value: number } => {
    const card = drawCard(rand);
    const value = card === 14 ? (total + 11 > POWER_PLAY_VALUES.blackjackTarget ? 1 : 11) : Math.min(card, 10);
    return { face: cardFace(card), value };
};
/** Card Sharks: the pot after this many right calls. */
export const cardSharksPot = (right: number): number =>
    right <= 0 ? 0 : POWER_PLAY_VALUES.cardSharksLadder[Math.min(right, POWER_PLAY_VALUES.cardSharksLadder.length) - 1];
/** Card Sharks: a card from 2 to 14 (11 J, 12 Q, 13 K, 14 A). */
export const drawCard = (rand: () => number = Math.random): number => 2 + Math.floor(rand() * 13);
/** Card Sharks: the card's face (2-10, J, Q, K, A). */
export const cardFace = (card: number): string => ({ 11: 'J', 12: 'Q', 13: 'K', 14: 'A' } as Record<number, string>)[card] ?? String(card);
/** Smell Ya Later!: the rival's score after this many seconds. */
export const rivalScore = (seconds: number): number => Math.round(Math.max(0, seconds) * POWER_PLAY_VALUES.rivalPointsPerSecond);
/** REDRUM: the word spelled backward (lowercase) when it's long enough to count, else null. */
export const redrumReverse = (word: string): string | null =>
    word.length >= POWER_PLAY_VALUES.redrumLetters ? word.split('').reverse().join('').toLowerCase() : null;
