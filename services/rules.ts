// Pure gameplay rules. No React, no DOM: easy to test and to tune via config/gameplay.ts.
import { BOSS, CHARM_BONUS, CHARM_LENGTH_BOOST, CHARM_UPGRADE, GAMEPLAY, PRIZE_GROWTH, POWER_GLOVE_BANK_MAX, POWER_PLAY_VALUES, POWER_WORD_EFFECTS, GEM_TILES, SKILL_SHOT, GATES, SHINE_BRIGHT_GEMS, FINAL_JEOPARDY } from '../config/gameplay';
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
    const normal = Math.min(maxSpeed, 1 + speedUpPerLevel * early + lateSpeedUpPerLevel * late);
    const O = GAMEPLAY.overtime;
    const overtime = overtimeLevels(level) * O.clockPerLevel;
    return Math.round(Math.min(Math.max(maxSpeed, O.clockCap), normal + overtime) * 100) / 100;
};

/** Levels of Overtime so far (v7.47): 1 at OVERTIME.fromLevel, 2 the level after, 0 before it. */
export const overtimeLevels = (level: number): number => Math.max(0, level - GAMEPLAY.overtime.fromLevel + 1);

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
    const O = GAMEPLAY.overtime;
    const normal = Math.max(min, 1 - perLateLevel * late);
    return Math.round(Math.max(Math.min(min, O.wordTimeFloor), normal - overtimeLevels(level) * O.wordTimePerLevel) * 100) / 100;
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

/**
 * What an upgrade does to a charm's own numbers, for the upgrade picker (v7.36): each "+N" point
 * value in its description, before and after (+40 → +60). Time ("+3 seconds"), percentages and
 * multipliers are left out, since upgrades only touch points. Null when the text has no point
 * value to show (the picker then says "+50% on its points").
 */
export const charmUpgradePreview = (description: string): { from: number; to: number }[] | null => {
    const found: { from: number; to: number }[] = [];
    for (const m of description.matchAll(/\+(\d+)(?![\d%x])(?!\s*(?:s\b|sec|second|more second|extra second|%|x\b))/gi)) {
        const from = Number(m[1]);
        if (from > 0 && !found.some(f => f.from === from)) found.push({ from, to: Math.round(from * (100 + CHARM_UPGRADE.percent) / 100) });
    }
    return found.length ? found : null;
};

/**
 * The same for charms that pay a percentage of the word (v7.51.2): "+50% → +75% A WORD" for Down to
 * Your Boxers, "25% → 37.5%" for Nicole's Grace. The upgrade adds half of their bonus line, so the
 * percentage itself grows by half. Before, the picker only said "+50% on its points", which read as
 * nothing changing.
 */
export const charmUpgradePercentPreview = (description: string): { from: number; to: number }[] | null => {
    const found: { from: number; to: number }[] = [];
    for (const m of description.matchAll(/\+?(\d+(?:\.\d+)?)%/g)) {
        const from = Number(m[1]);
        if (from > 0 && !found.some(f => f.from === from)) found.push({ from, to: Math.round(from * (100 + CHARM_UPGRADE.percent)) / 100 });
    }
    return found.length ? found : null;
};

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
    "Let's Get Dangerous", 'Space Invader (Win)', 'REDRUM', 'More Than Meets the Eye', '🦆 Quack Attack',
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

/**
 * Charm time at this level (v7.40.2), for the notes that tell players their charm time shrank:
 * what `seconds` pays after the level shrink (`paid`), the scale, and whether that is less.
 * The halving above the overflow line depends on the clock, so it's noted separately.
 */
export const charmTimeAt = (seconds: number, level: number): { paid: number; percent: number; cut: boolean } => {
    const paid = seconds <= 0 ? seconds : Math.max(1, Math.round(seconds * bonusTimeScale(level)));
    return { paid, percent: Math.round(bonusTimeScale(level) * 100), cut: paid < seconds };
};

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

/** Gem Tiles (v7.42): the word multiplier a word of this length earns for the next hand (0: none). */
export const gemMultiplierFor = (length: number, shineBright = false): number =>
    lookupByLength(shineBright ? SHINE_BRIGHT_GEMS : GEM_TILES, length, 0);

/** Jenga! (v7.62.0): the tower's pot after this many blocks (50 + 100 + 150...). */
export const jengaPot = (blocks: number): number => {
    const n = Math.max(0, Math.min(POWER_PLAY_VALUES.jengaBlocks, blocks));
    return POWER_PLAY_VALUES.jengaStep * n * (n + 1) / 2;
};

/** Stonks (v7.62.0): what a word of this length earns at this run level. */
export const stonksPoints = (length: number, level: number): number =>
    length >= CHARM_BONUS.stonksLetters ? CHARM_BONUS.stonksPerLevel * Math.max(1, level) : 0;

/** Sorted letters: two words are anagrams when these match. */
export const anagramKey = (word: string): string => word.toUpperCase().split('').sort().join('');

/**
 * Freaky Friday (v7.62.0): the earlier word this one is an anagram of (a different word with the
 * same letters, played earlier this run), or null. Only words of freakyFridayLetters+ letters count.
 */
export const freakyFridayMatch = (word: string, earlier: readonly string[]): string | null => {
    const w = word.toUpperCase();
    if (w.length < CHARM_BONUS.freakyFridayLetters) return null;
    const key = anagramKey(w);
    return earlier.map(e => e.toUpperCase()).find(e => e !== w && e.length === w.length && anagramKey(e) === key) ?? null;
};

/** Skill Shot (v7.42): what a hit pays on this streak (1 = first hit in a row). */
export const skillShotPoints = (streak: number): number =>
    streak > 0 ? Math.min(SKILL_SHOT.max, SKILL_SHOT.base + SKILL_SHOT.step * (streak - 1)) : 0;

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
    /** Overtime starts on this level (v7.47). */
    overtime?: boolean;
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
    const charmTime = [bonusTimeScale(prev), bonusTimeScale(level)];
    if (charmTime[1] !== charmTime[0]) changes.push({ icon: '🍀', label: 'Charm time', from: `${Math.round(charmTime[0] * 100)}%`, to: `${Math.round(charmTime[1] * 100)}%` });
    const prize = [prizeScaleFor(prev), prizeScaleFor(level)];
    if (prize[1] !== prize[0]) changes.push({ icon: '🎁', label: 'PowerPlay prizes', from: `x${prize[0]}`, to: `x${prize[1]}` });
    return {
        level, tier: tier.name, tone: tier.tone,
        newTier: tier !== levelTierFor(prev),
        changes,
        boss: bossNumberFor(level) ? 'now' : bossNumberFor(level + 1) ? 'next' : null,
        overtime: level === GAMEPLAY.overtime.fromLevel,
    };
};

/** What a power word does, in plain words, for the reveal, the Collection and the Bonus Vault. */
/** v7.61.0: `prize` is the short reward the hint chip shows (so a player knows why to stop and look). */
export const powerWordInfo = (effect: PowerWordEffect): { prize: string; label: string; does: string; again: string } => {
    const E = POWER_WORD_EFFECTS;
    // v7.66.3 (the owner): clear AND funny. Each line opens with a nod to its reference, then says
    // plainly what happens to you (v7.66.2 made them plain but dropped some of the jokes).
    const slot = E.slot.map(p => `+${p.seconds}`);
    const info = {
        slot: { prize: 'UP TO +10 SEC', label: 'SLOT MACHINE', does: `Danny Ocean's slot machine: spin for bonus time, ${slot.slice(0, -1).join(', ')} or ${slot[slot.length - 1]} seconds. The house rarely pays the big one.` },
        freeze: { prize: 'FROZEN CLOCK', label: 'FREEZE', does: `Let it go: your clock stops for ${E.freezeSeconds} seconds at the start of your next turn. Free thinking time.` },
        heal: { prize: 'REMOVE A STRIKE', label: 'HEAL', does: `Heroes never die: one of your strikes disappears. No strikes? You get +${E.healFallbackPoints} points instead.` },
        slow: { prize: 'HALF-SPEED CLOCK', label: 'SLOW MOTION', does: `Your clock moves like a DMV sloth: half speed for your next ${E.slowWords} words.` },
        twin: { prize: 'BONUS TIME', label: 'CLONE', does: "Double trouble: you get the seconds your best word earned all over again (a longer best word means more time). It also adds one step to your Word Combo." },
        shield: { prize: 'STRIKE SHIELD', label: 'RING SHIELD', does: "Like Sonic's rings: your next strike doesn't count, so one mistake is free." },
        rewind: { prize: 'SLOWER CLOCK', label: 'REWIND', does: `Rewind the tape: your clock goes back to last level's slower speed until the next level. (On level 1: +${E.rewindLevelOneSeconds} seconds instead.)` },
        sword: { prize: 'FREE POWERPLAY', label: 'TAKE THIS', does: "It's dangerous to go alone: your PowerPlay meter fills up, so you pick a PowerPlay right now." },
        spice: { prize: 'NEXT WORD x3', label: 'SPICE IT UP', does: `Spice up your life: your next word scores triple (x${E.spiceMultiplier}).` },
        cake: { prize: 'FREE CHARM', label: 'CAKE', does: 'The cake is real this time: you pick a new charm right now.' },
    }[effect];
    return { ...info, again: 'Works once per level: play it again on a later level to use it again.' };
};

// --- v7.25 gamble PowerPlays: the rolls, kept pure so they can be tested (POWER_PLAY_VALUES). ---
const pickByChance = <T extends { chance: number }>(list: T[], roll: number): T => {
    let acc = 0;
    for (const item of list) { acc += item.chance; if (roll < acc) return item; }
    return list[list.length - 1];
};
/**
 * The Plinko board's slots, left to right (v7.36.3): the jackpot in the middle, the zeros beside
 * the 700s, small prizes on the edges. Every value in POWER_PLAY_VALUES.plinko appears here; the
 * prize is still rolled from that table, and the chip's path is drawn to land on it.
 */
export const PLINKO_SLOTS: readonly number[] = (() => {
    const v = POWER_PLAY_VALUES.plinko.map(p => p.points); // [0, 100, 300, 700, 2000]
    return [v[1], v[2], v[0], v[3], v[4], v[3], v[0], v[2], v[1]];
})();
/** Peg rows the chip falls through. */
export const PLINKO_ROWS = 9;

/** The slot a rolled prize lands in: of the slots with that value, the one nearest where the chip
 * was dropped (a coin flip on a tie). */
export const plinkoSlotFor = (points: number, start: number, rand: () => number = Math.random): number => {
    const matches = PLINKO_SLOTS.map((p, i) => (p === points ? i : -1)).filter(i => i >= 0);
    if (!matches.length) return Math.floor(PLINKO_SLOTS.length / 2);
    const best = Math.min(...matches.map(i => Math.abs(i - start)));
    const nearest = matches.filter(i => Math.abs(i - start) === best);
    return nearest[Math.floor(rand() * nearest.length) % nearest.length];
};

/** Where the chip is (in slot columns) after each peg row: it drifts from the drop point to the
 * landing slot, knocked left or right at every peg, less as it nears the bottom. */
export const plinkoPath = (start: number, slot: number, rand: () => number = Math.random, rows = PLINKO_ROWS): number[] => {
    const last = PLINKO_SLOTS.length - 1;
    const path = [start];
    for (let r = 1; r < rows; r++) {
        const trend = start + (slot - start) * (r / rows);
        const knock = (rand() < 0.5 ? -0.5 : 0.5) * (1 - r / rows) * 1.6;
        path.push(Math.min(last, Math.max(0, trend + knock)));
    }
    path.push(slot);
    return path;
};

/** Plinko: the chip's points for a roll in [0, 1). */
export const plinkoPayout = (roll: number): number => pickByChance(POWER_PLAY_VALUES.plinko, roll).points;
/** Hot Tub Time Machine: seconds (negative = lost) for a roll in [0, 1). */
export const hotTubSeconds = (roll: number): number => pickByChance(POWER_PLAY_VALUES.hotTub, roll).seconds;
/** The Hot Tub outcome a roll in [0, 1) lands on, as an index into POWER_PLAY_VALUES.hotTub. */
export const hotTubIndex = (roll: number): number => POWER_PLAY_VALUES.hotTub.indexOf(pickByChance([...POWER_PLAY_VALUES.hotTub], roll));
/** The WILDCARD outcome a roll in [0, 1) lands on, as an index into POWER_PLAY_VALUES.wildcard. */
export const wildcardIndex = (roll: number): number => POWER_PLAY_VALUES.wildcard.indexOf(pickByChance([...POWER_PLAY_VALUES.wildcard], roll));

/**
 * No Whammies! board (v7.39.1): a ring of 12 squares, clockwise from the top-left. The squares are
 * for show; the odds come from whammyChance and whammyCash, and the light stops on a matching square.
 */
export const WHAMMY_BOARD: readonly (number | 'whammy')[] = [100, 'whammy', 250, 50, 150, 100, 'whammy', 400, 50, 150, 'whammy', 250];
/** One spin: a Whammy, or the cash a safe landing pays. */
export const whammySpin = (roll: number, cashRoll: number): number | 'whammy' =>
    roll < POWER_PLAY_VALUES.whammyChance ? 'whammy' : pickByChance(POWER_PLAY_VALUES.whammyCash, cashRoll).points;
/** A square on the board showing this result (a random one when several match). */
export const whammySquareFor = (result: number | 'whammy', rand: () => number = Math.random): number => {
    const matches = WHAMMY_BOARD.map((v, i) => (v === result ? i : -1)).filter(i => i >= 0);
    return matches.length ? matches[Math.floor(rand() * matches.length) % matches.length] : 0;
};
/** Daily Double: the wager, a share of the score kept between a floor and a cap, and never more
 * than the score itself (v7.28.8: at a low score the floor made it a free bet). */
export const dailyDoubleWager = (score: number): number => {
    // v7.58.0: a flat bet (was 10% of the score, 100-500), never more than you have.
    return Math.max(0, Math.min(score, POWER_PLAY_VALUES.dailyDoubleBet));
};
const shuffle = <T,>(list: T[], rand: () => number): T[] => {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
    return out;
};
/** Let's Make a Deal: a round's three doors, shuffled (0 = the Zonk). */
/** Let's Make a Deal (v7.68.0): the prize doors and the Zonk (0), shuffled. */
export const dealDoors = (rand: () => number = Math.random): number[] =>
    shuffle([...POWER_PLAY_VALUES.doorPrizes, 0], rand);
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
/** Chicken Dinner (v7.67.1): a blackjack hand's best total (J/Q/K count 10; an A counts 11 unless that busts). */
export const blackjackTotal = (cards: number[]): number => {
    let total = 0, aces = 0;
    for (const c of cards) { if (c === 14) { aces++; total += 11; } else total += Math.min(c, 10); }
    while (total > POWER_PLAY_VALUES.blackjackTarget && aces > 0) { total -= 10; aces--; }
    return total;
};
/** Chicken Dinner: the hands from the saved deck after `hits` hits. The player gets cards 0 and 1,
 * the dealer 2 and 3, the player's hits come next, and the dealer draws the rest once you stand. */
export const blackjackHands = (deck: number[], hits: number, dealerPlays: boolean): { player: number[]; dealer: number[] } => {
    const player = [deck[0], deck[1], ...deck.slice(4, 4 + hits)];
    const dealer = [deck[2], deck[3]];
    if (dealerPlays && blackjackTotal(player) <= POWER_PLAY_VALUES.blackjackTarget) {
        let i = 4 + hits;
        while (blackjackTotal(dealer) < POWER_PLAY_VALUES.blackjackDealerStands && i < deck.length) dealer.push(deck[i++]);
    }
    return { player, dealer };
};
export type BlackjackResult = 'natural' | 'win' | 'push' | 'lose' | 'bust';
/** Chicken Dinner: how the hand ended, once the dealer has played. */
export const blackjackResult = (player: number[], dealer: number[]): BlackjackResult => {
    const t = POWER_PLAY_VALUES.blackjackTarget;
    const p = blackjackTotal(player), d = blackjackTotal(dealer);
    const pNat = player.length === 2 && p === t, dNat = dealer.length === 2 && d === t;
    if (p > t) return 'bust';
    if (pNat && dNat) return 'push';
    if (pNat) return 'natural';
    if (dNat || (d <= t && d > p)) return 'lose';
    if (d === p) return 'push';
    return 'win';
};
/** Chicken Dinner: the listed prize for a result (before the level boost). */
export const blackjackPrize = (r: BlackjackResult): number =>
    r === 'natural' ? POWER_PLAY_VALUES.blackjackNatural : r === 'win' ? POWER_PLAY_VALUES.blackjackWin : r === 'push' ? POWER_PLAY_VALUES.blackjackPush : 0;
/**
 * 💡 Final Jeopardy (v7.75.0): the categories a last word must fit, and how often a random final
 * hand can make one (simulated): 6+ letters 48%, J/K/Q/X/Z/V/W 48%, a double letter 51%, B/C/M/P
 * 52%, starts with S or T 60%, one vowel in 4+ letters 78%, 5+ letters 86%.
 */
export const FINAL_CATEGORIES: Record<string, { label: string; test: (w: string) => boolean }> = {
    six: { label: '6+ LETTERS', test: w => w.length >= 6 },
    rare: { label: 'J, K, Q, X, Z, V OR W', test: w => /[JKQXZVW]/i.test(w) },
    double: { label: 'A DOUBLE LETTER', test: w => /(.)\1/i.test(w) },
    bcmp: { label: 'B, C, M OR P', test: w => /[BCMP]/i.test(w) },
    stStart: { label: 'STARTS WITH S OR T', test: w => /^[ST]/i.test(w) },
    oneVowel: { label: 'ONLY ONE VOWEL (4+ LETTERS)', test: w => w.length >= 4 && (w.match(/[AEIOU]/gi) ?? []).length === 1 },
    five: { label: '5+ LETTERS', test: w => w.length >= 5 },
};
export const finalCategoryDeal = (rand: () => number = Math.random): string => {
    const ids = Object.keys(FINAL_CATEGORIES);
    return ids[Math.min(ids.length - 1, Math.floor(rand() * ids.length))];
};
/** A Final Jeopardy bet: this percent of the score, rounded, never more than the cap. */
export const finalBet = (score: number, percent: number): number =>
    Math.min(FINAL_JEOPARDY.cap, Math.round((Math.max(0, score) * percent / 100) / FINAL_JEOPARDY.roundTo) * FINAL_JEOPARDY.roundTo);

/**
 * ⭕ Center Square (v7.74.0): the squares. The center is always 6+ letters; the other 8 are dealt
 * from the outer pool. Each condition matches roughly 10-35% of the words players play (simulated).
 */
export const CENTER_SQUARES: Record<string, { label: string; test: (w: string) => boolean }> = {
    six: { label: '6+ LETTERS', test: w => w.length >= 6 },
    five: { label: '5+ LETTERS', test: w => w.length >= 5 },
    three: { label: 'EXACTLY 3 LETTERS', test: w => w.length === 3 },
    endsS: { label: 'ENDS IN S', test: w => w.endsWith('S') },
    vowelStart: { label: 'STARTS WITH A VOWEL', test: w => /^[AEIOU]/.test(w) },
    double: { label: 'A DOUBLE LETTER', test: w => /(.)\1/.test(w) },
    rare: { label: 'J, K, Q, X, Z, V OR W', test: w => /[JKQXZVW]/.test(w) },
    oneVowel: { label: 'ONLY ONE VOWEL', test: w => (w.match(/[AEIOU]/g) ?? []).length === 1 },
    vowelEnd: { label: 'ENDS IN A VOWEL', test: w => /[AEIOU]$/.test(w) },
    twoVowels: { label: 'TWO VOWELS IN A ROW', test: w => /[AEIOU]{2}/.test(w) },
    bcmp: { label: 'B, C, M OR P', test: w => /[BCMP]/.test(w) },
    fhw: { label: 'F, H OR W', test: w => /[FHW]/.test(w) },
    stStart: { label: 'STARTS WITH S OR T', test: w => /^[ST]/.test(w) },
};
export const CENTER_SQUARE_LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
/** A fresh board: 8 outer squares dealt at random, the center (index 4) always 6+ letters. */
export const centerSquareDeal = (rand: () => number = Math.random): string[] => {
    const outer = Object.keys(CENTER_SQUARES).filter(id => id !== 'six');
    for (let i = outer.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [outer[i], outer[j]] = [outer[j], outer[i]]; }
    return [...outer.slice(0, 4), 'six', ...outer.slice(4, 8)];
};
/**
 * Which open square a word claims (one per word): of the open squares it matches, the one that
 * finishes a line, else the one on the most started lines, the center first. Null when none.
 */
export const centerSquareClaim = (board: readonly string[], got: readonly boolean[], word: string): number | null => {
    const w = word.toUpperCase();
    const open = board.map((id, i) => i).filter(i => !got[i] && CENTER_SQUARES[board[i]]?.test(w));
    if (!open.length) return null;
    const value = (i: number) => CENTER_SQUARE_LINES.filter(l => l.includes(i)).reduce((v, l) => v + (l.every(j => got[j] || j === i) ? 100 : l.filter(j => got[j]).length * 3), 0) + (i === 4 ? 1 : 0);
    return open.reduce((best, i) => (value(i) > value(best) ? i : best), open[0]);
};
export const centerSquareLines = (got: readonly boolean[]): number => CENTER_SQUARE_LINES.filter(l => l.every(i => got[i])).length;
/** What the board pays before the level boost: each line, plus the full-board bonus. */
export const centerSquarePrize = (got: readonly boolean[]): number =>
    centerSquareLines(got) * POWER_PLAY_VALUES.centerSquareLine + (got.length === 9 && got.every(Boolean) ? POWER_PLAY_VALUES.centerSquareFull : 0);

/**
 * 🎡 Spin & Solve (v7.74.0): what a wedge pays for a called letter, and the board as the player sees it.
 * Wedge values from MINI_GAME_VALUES.wheel: 0 is BANKRUPT, -1 a FREE SPIN, anything else per letter.
 */
export const wheelLetterPay = (word: string, letter: string, wedge: number): number =>
    wedge > 0 ? wedge * [...word.toUpperCase()].filter(c => c === letter.toUpperCase()).length : 0;
export const wheelBoard = (word: string, shown: readonly string[]): string[] =>
    [...word.toUpperCase()].map(c => (shown.includes(c) ? c : ''));
export const wheelSolved = (word: string, shown: readonly string[]): boolean => wheelBoard(word, shown).every(Boolean);

/**
 * Survey Says! (v7.74.0): the board for a list of playable words: one answer of each length, longest
 * first (8, 7, 6, 5, 4...), so the top answer is the longest word and the rest step down. With fewer
 * different lengths than slots, the most plentiful lengths fill the rest. Each slot carries an
 * example word for the reveal. Null when the tiles can't fill a board (fewer answers than slots, or
 * a top answer under `surveyMinTop` letters).
 */
export const surveyBoard = (words: readonly string[], slots = POWER_PLAY_VALUES.surveyPrizes.length): { lengths: number[]; examples: string[] } | null => {
    const sorted = [...new Set(words.map(w => w.toUpperCase()))].sort((a, b) => b.length - a.length || a.localeCompare(b));
    if (sorted.length < slots || sorted[0].length < POWER_PLAY_VALUES.surveyMinTop) return null;
    const byLength = new Map<number, string[]>();
    for (const w of sorted) byLength.set(w.length, [...(byLength.get(w.length) ?? []), w]);
    const picked: string[] = [];
    for (const len of [...byLength.keys()].sort((a, b) => b - a)) if (picked.length < slots) picked.push(byLength.get(len)![0]);
    // Not enough lengths: take more from the lengths with the most words left, shortest first on ties.
    while (picked.length < slots) {
        const [, list] = [...byLength.entries()].map(([l, ws]) => [l, ws.filter(w => !picked.includes(w))] as const)
            .filter(([, ws]) => ws.length).sort((a, b) => b[1].length - a[1].length || a[0] - b[0])[0];
        picked.push(list[0]);
    }
    picked.sort((a, b) => b.length - a.length);
    return { lengths: picked.map(w => w.length), examples: picked };
};
/** Which open slot a word fills (the first one of its length), or -1 when none is open. */
export const surveySlotFor = (lengths: readonly number[], found: readonly (string | null)[], word: string): number =>
    lengths.findIndex((len, i) => len === word.length && !found[i]);
/** What a Survey Says! board pays: each found slot's prize, plus the clear bonus for all of them. */
export const surveyPayout = (found: readonly (string | null)[]): number => {
    const V = POWER_PLAY_VALUES;
    const sum = found.reduce((t, w, i) => t + (w ? V.surveyPrizes[i] ?? 0 : 0), 0);
    return sum + (found.length > 0 && found.every(Boolean) ? V.surveyClear : 0);
};

/**
 * Fortune's Favor (v7.72.5): the Magic 8-Ball's answer, rolled when the card opens. Each outcome has
 * real 8-Ball answers to float up in the window; `answer` picks one of them.
 */
export type FortuneKind = 'lose' | 'win' | 'jackpot';
export const FORTUNE_ANSWERS: Record<FortuneKind, readonly string[]> = {
    lose: ['OUTLOOK NOT SO GOOD', 'MY REPLY IS NO', 'VERY DOUBTFUL', "DON'T COUNT ON IT"],
    win: ['IT IS CERTAIN', 'SIGNS POINT TO YES', 'YES, DEFINITELY', 'MOST LIKELY'],
    jackpot: ['WITHOUT A DOUBT', 'AS I SEE IT, YES!'],
};
export const fortuneRoll = (rand: () => number = Math.random): { kind: FortuneKind; answer: number } => {
    const r = rand();
    const kind: FortuneKind = r < POWER_PLAY_VALUES.fortuneLoseChance ? 'lose' : r < 1 - POWER_PLAY_VALUES.fortuneJackpotChance ? 'win' : 'jackpot';
    return { kind, answer: Math.floor(rand() * FORTUNE_ANSWERS[kind].length) };
};
export const fortunePoints = (kind: FortuneKind): number =>
    kind === 'lose' ? -POWER_PLAY_VALUES.fortuneLose : kind === 'win' ? POWER_PLAY_VALUES.fortuneWin : POWER_PLAY_VALUES.fortuneJackpot;

/** Gump Luck (v7.67.1): what's in the chocolate, 25% each. */
export type GumpPrize = 'time' | 'points' | 'shuffle' | 'empty';
export const gumpRoll = (rand: () => number = Math.random): GumpPrize => (['time', 'points', 'shuffle', 'empty'] as const)[Math.min(3, Math.floor(rand() * 4))];
/** Card Sharks: the pot after this many right calls. */
export const cardSharksPot = (right: number): number =>
    right <= 0 ? 0 : POWER_PLAY_VALUES.cardSharksLadder[Math.min(right, POWER_PLAY_VALUES.cardSharksLadder.length) - 1];
/** Card Sharks: a card from 2 to 14 (11 J, 12 Q, 13 K, 14 A). */
export const drawCard = (rand: () => number = Math.random): number => 2 + Math.floor(rand() * 13);
/** Card Sharks: the card's face (2-10, J, Q, K, A). */
export const cardFace = (card: number): string => ({ 11: 'J', 12: 'Q', 13: 'K', 14: 'A' } as Record<number, string>)[card] ?? String(card);
/** Smell Ya Later!: the rival's score after this many seconds, at `rate` points a second. */
export const rivalScore = (seconds: number, rate: number = POWER_PLAY_VALUES.rivalPointsPerSecond): number =>
    Math.round(Math.max(0, seconds) * rate);
/**
 * Smell Ya Later!: the rival's points a second for a race starting now (v7.47.1): the player's own
 * pace this run (score per second the clock has run) x rivalPace, at least rivalPointsPerSecond.
 * Under 20 seconds of play there's no pace yet, so the floor applies.
 */
export const rivalRateFor = (score: number, playMs: number): number => {
    const V = POWER_PLAY_VALUES;
    const seconds = playMs / 1000;
    const pace = seconds >= 20 ? (Math.max(0, score) / seconds) * V.rivalPace : 0;
    return Math.max(V.rivalPointsPerSecond, Math.round(pace));
};
/** REDRUM: the word spelled backward (lowercase) when it's long enough to count, else null. */
export const redrumReverse = (word: string): string | null =>
    word.length >= POWER_PLAY_VALUES.redrumLetters ? word.split('').reverse().join('').toLowerCase() : null;

/**
 * Mission: Impossible (v7.55.0): the missions a card can deal. Pull one off within
 * POWER_PLAY_VALUES.missionWords words for missionPrize; failing costs nothing.
 */
export const MISSIONS: { id: string; text: string; test: (word: string) => boolean }[] = [
    { id: 'rare', text: 'Play a word with a J, K, Q, X or Z', test: w => /[JKQXZ]/.test(w) },
    { id: 'long', text: 'Play a word of 6 or more letters', test: w => w.length >= 6 },
    { id: 'ing', text: 'Play a word that ends in ING', test: w => w.endsWith('ING') && w.length > 3 },
    { id: 'bookends', text: 'Play a word that starts and ends with the same letter', test: w => w.length >= 3 && w[0] === w[w.length - 1] },
    { id: 'vowels', text: 'Play a word with 3 or more vowels', test: w => [...w].filter(c => 'AEIOU'.includes(c)).length >= 3 },
    { id: 'double', text: 'Play a word with a double letter (like BOOK or BELL)', test: w => /(.)\1/.test(w) },
];
export const missionById = (id: string | undefined) => MISSIONS.find(m => m.id === id);

/** v7.61.0: the next Score Gate this run hasn't crossed (for the marker under the score), or null. */
export const nextGateFor = (gs: { score: number; gatesPassed?: number[] } | null | undefined): number | null => {
    if (!gs) return null;
    const scores = [GATES.password.score, GATES.winners.score, GATES.bonusStage.score, GATES.ladder.score, GATES.bigOne.score];
    return scores.find(s => !(gs.gatesPassed ?? []).includes(s) && s > gs.score) ?? null;
};

/** The gate before `next` (0 for the first), so the marker's bar runs between the two. */
export const previousGateFor = (next: number): number => {
    const scores = [0, GATES.password.score, GATES.winners.score, GATES.bonusStage.score, GATES.ladder.score, GATES.bigOne.score];
    return scores[Math.max(0, scores.indexOf(next) - 1)] ?? 0;
};


/**
 * I Feel the Need… for Speed (v7.66.0): the speed streak after this word. A 4+ letter word played
 * within speedSeconds of the last word extends it; a slower 4+ letter word starts a new one (at 1);
 * a shorter word ends it (0). Pays from the 2nd word in a row (speedStreakPoints).
 */
export const nextSpeedStreak = (streak: number, letters: number, secondsSinceLast: number | null): number =>
    letters < CHARM_BONUS.speedLetters ? 0 : (streak >= 1 && secondsSinceLast !== null && secondsSinceLast <= CHARM_BONUS.speedSeconds ? streak + 1 : 1);
/** What the speed streak pays on a word: nothing for the first, then +25, +50... up to speedMax. */
export const speedStreakPoints = (streak: number): number =>
    streak >= 2 ? Math.min(CHARM_BONUS.speedMax, CHARM_BONUS.speedStep * (streak - 1)) : 0;
