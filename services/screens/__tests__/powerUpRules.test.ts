// @vitest-environment jsdom
// Charm slots, PowerPlay keep-or-swap, and the PowerPlays/charms added or moved in v6.8.
import { describe, test, expect, vi, afterEach } from 'vitest';
import { greatestHitFor, hitInProgress, nextHit, playCounts, ordinal } from '../../greatestHits';
import { gameReducer, crocModal, screenInitialState, maxStrikesFor, savableScreenState, RESUME_COUNTDOWN, POST_WORD_MODALS, type GameScreenState } from '../GameScreen';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { POWER_PLAYS_LIST, INSTANT_POWER_PLAY_IDS, PRIZE_POWER_PLAY_IDS } from '../../../data/powerPlays';
import { GAMBLE_CARD_IDS } from '../../../components/GambleCard';
import { wildcardIndex, ITEM_MULTIPLIER_LINES, MISSIONS, missionById } from '../../rules';
import { COSMETICS } from '../../../data/cosmetics';
import { CHARMS_LIST } from '../../../data/charms';
import { SECRET_BONUSES } from '../../../data/secretBonuses';
import { QUACK_ATTACK, BLUE_STEEL, MYSTERY_TAPE, GREATEST_HITS, CHARM_SLOTS, GAMEPLAY, POWER_GLOVE_BANK_MAX, TIME_BONUS, POWER_PLAY_VALUES, CHARM_BONUS } from '../../../config/gameplay';
import { calculateScore } from '../../gameUtils';
import * as gameUtils from '../../gameUtils';
import { RACK_SIZE } from '../../../constants';
import type { GameState, Tile } from '../../../types';
import { catchVowels, handSizeFor, meterLettersFor, bossHitsToWin, advanceBoss, plinkoPayout, hotTubSeconds, dailyDoubleWager, dealDoors, minesweeperPot, bankerOffer, dealGame } from '../../rules';

afterEach(() => vi.restoreAllMocks());

const pp = (id: string) => POWER_PLAYS_LIST.find(p => p.id === id)!;
const charm = (id: string) => CHARMS_LIST.find(c => c.id === id)!;

const start = (overrides: Partial<GameState> = {}, time = 40): GameScreenState => {
    const { hand, tileBag } = gameUtils.dealNewHand(gameUtils.createTileBag());
    const padded = Array(RACK_SIZE).fill(null);
    hand.forEach((t, i) => (padded[i] = t));
    return { ...screenInitialState, hand: padded, tileBag, time, isLoading: false, gameState: { ...screenInitialState.gameState, ...overrides } };
};
const tilesIn = (s: GameScreenState) => s.hand.filter(Boolean).length;

describe('reclassified items', () => {
    test('charms are always-on and PowerPlays are pressed', () => {
        const charmIds = new Set(CHARMS_LIST.map(c => c.id));
        for (const id of ['philsosophy', 'powerGlove', 'goldenSnitch', 'lTrainShuffle', 'diceRollProtocol', 'finalFrontier']) expect(charmIds).toContain(id);
        for (const id of ['deepFreeze', 'groundhogsDay', 'wildcardWake', 'oneTileToRuleThemAll', 'shapeshiftersTongue']) {
            expect(charmIds).not.toContain(id);
            expect(pp(id)).toBeTruthy();
        }
        expect(CHARMS_LIST.every(c => c.durationTag === 'PERSISTENT')).toBe(true);
        expect(POWER_PLAYS_LIST.every(p => p.durationTag !== 'PERSISTENT')).toBe(true);
    });

    test('no id is both a charm and a PowerPlay', () => {
        const ppIds = new Set(POWER_PLAYS_LIST.map(p => p.id));
        expect(CHARMS_LIST.filter(c => ppIds.has(c.id)).map(c => c.id)).toEqual([]);
    });
});

describe('charm slots', () => {
    const five = CHARMS_LIST.slice(0, CHARM_SLOTS);
    const extra = charm('powerPellet');

    test('a 6th charm needs a slot freed', () => {
        const s = start({ activeCharms: five });
        const blocked = gameReducer(s, { type: 'CHOOSE_CHARM', payload: { charm: extra, hand: s.hand, allOffered: [extra] } });
        expect(blocked).toBe(s);
        const swapped = gameReducer(s, { type: 'CHOOSE_CHARM', payload: { charm: extra, hand: s.hand, allOffered: [extra], replaceId: five[0].id } });
        expect(swapped.gameState.activeCharms.map(c => c.id)).toEqual([...five.slice(1).map(c => c.id), extra.id]);
        expect(swapped.gameState.activeBuffs.some(b => b.id === five[0].id)).toBe(false);
    });

    test('passing keeps your charms and puts the offer on cooldown', () => {
        const s = start({ activeCharms: five });
        const passed = gameReducer(s, { type: 'PASS_CHARM', payload: { allOffered: [extra] } });
        expect(passed.gameState.activeCharms).toEqual(five);
        expect(passed.gameState.charmCooldowns[extra.id]).toBe(3);
    });

    test('Power Glove raises the bank to 120s and adds 15s; dropping it lowers it again', () => {
        const s = start({}, 85);
        const gloved = gameReducer(s, { type: 'CHOOSE_CHARM', payload: { charm: charm('powerGlove'), hand: s.hand, allOffered: [] } });
        expect(gloved.time).toBe(100);
        expect(gameReducer(gloved, { type: 'ADD_TIME', payload: 50 }).time).toBe(POWER_GLOVE_BANK_MAX);
        const full = { ...gloved, gameState: { ...gloved.gameState, activeCharms: [...CHARMS_LIST.slice(2, 6), charm('powerGlove')] } };
        const dropped = gameReducer(full, { type: 'CHOOSE_CHARM', payload: { charm: charm('powerPellet'), hand: s.hand, allOffered: [], replaceId: 'powerGlove' } });
        expect(dropped.time).toBe(GAMEPLAY.timeBank.max);
    });
});

describe('Time pressure', () => {
    const shuffle = (s: GameScreenState, isFree = false) =>
        gameReducer(s, { type: 'PERFORM_SHUFFLE', payload: { hand: s.hand, tileBag: s.tileBag, isFree } });

    test('every shuffle (paid or free) adds 5s, up to the bank max, and only a paid one uses a shuffle', () => {
        const paid = shuffle(start({ shuffleCount: 3 }, 40));
        expect(paid.time).toBe(40 + GAMEPLAY.timeBank.shuffleTimeBonus);
        expect(paid.gameState.shuffleCount).toBe(2);
        const free = shuffle(start({ shuffleCount: 3 }, 40), true);
        expect(free.time).toBe(45);
        expect(free.gameState.shuffleCount).toBe(3);
        expect(shuffle(start({}, GAMEPLAY.timeBank.max - 2)).time).toBe(GAMEPLAY.timeBank.max);
    });

    test('a shuffle keeps your streaks going', () => {
        const s = shuffle(start({ consecutiveSuccesses: 4, consecutiveValidWords: 6, powerSurgeProgress: 3, perfectChainProgress: 2 }));
        expect(s.gameState).toMatchObject({ consecutiveSuccesses: 4, consecutiveValidWords: 6, powerSurgeProgress: 3, perfectChainProgress: 2 });
    });

    test('word time is halved when it lands on a bank above 60s', () => {
        const next = (time: number) => gameReducer(start({ pendingTimeBonus: 7 }, time), { type: 'START_NEXT_ROUND' });
        expect(next(50).time).toBe(57);
        const taxed = next(70);
        expect(taxed.time).toBe(73);
        expect(taxed.timeGain?.taxed).toBe(true);
    });
});

describe('PowerPlay keep-or-swap', () => {
    test('picking a new one swaps out the held one', () => {
        const s = start({ availablePowerPlays: [pp('biglyScore')] });
        const after = gameReducer(s, { type: 'CHOOSE_POWER_PLAY', payload: { powerPlay: pp('konamiCode'), allOffered: [pp('konamiCode')] } });
        expect(after.gameState.availablePowerPlays.map(p => p.id)).toEqual(['konamiCode']);
    });

    test('an instant one fires right away and swaps out what you hold', () => {
        const s = start({ availablePowerPlays: [pp('biglyScore')] });
        const after = gameReducer(s, { type: 'CHOOSE_POWER_PLAY', payload: { powerPlay: pp('wildcardWake'), allOffered: [pp('wildcardWake')] } });
        expect(after.gameState.availablePowerPlays).toEqual([]);
        expect(after.gameState.shuffleCount).toBe(s.gameState.shuffleCount + 2);
    });

    test('keeping clears the offer and keeps the held one', () => {
        const offered = [pp('konamiCode'), pp('warpZone')];
        const s = start({ availablePowerPlays: [pp('biglyScore')], powerPlayOffer: offered });
        const after = gameReducer(s, { type: 'KEEP_POWER_PLAY', payload: { allOffered: offered } });
        expect(after.gameState.availablePowerPlays.map(p => p.id)).toEqual(['biglyScore']);
        expect(after.gameState.powerPlayOffer).toEqual([]);
        expect(after.gameState.powerPlayCooldowns.konamiCode).toBe(3);
    });
});

describe('new PowerPlays', () => {
    const activate = (s: GameScreenState, id: string) => gameReducer(s, { type: 'ACTIVATE_POWER_PLAY', payload: pp(id) });

    test('Who You Gonna Call? clears strikes for 15s, never below 5s', () => {
        expect(activate(start({ strikes: 2 }, 40), 'whoYouGonnaCall')).toMatchObject({ time: 25, gameState: { strikes: 0 } });
        expect(activate(start({ strikes: 2 }, 12), 'whoYouGonnaCall').time).toBe(5);
    });

    test('Life Finds a Way survives the run-ending strike once', () => {
        const max = maxStrikesFor(screenInitialState.gameState);
        const armed = gameReducer(start({ strikes: max - 1 }, 30), { type: 'CHOOSE_POWER_PLAY', payload: { powerPlay: pp('lifeFindsAWay'), allOffered: [] } });
        const saved = gameReducer(armed, { type: 'ADD_STRIKE' });
        expect(saved.gameState.strikes).toBe(max - 1);
        expect(saved.time).toBe(50);
        expect(saved.gameState.activePowerPlays.lifeFindsAWay).toBeUndefined();
        expect(gameReducer(saved, { type: 'ADD_STRIKE' }).gameState.strikes).toBe(max);
    });

    test('Warp Zone sets up a Golden Round on the next word', () => {
        const s = start();
        expect(activate(s, 'warpZone').gameState.consecutiveValidWords).toBe(s.gameState.goldenRoundThreshold - 1);
    });

    test('Go-Go-Gadget Hands adds 2 tiles now', () => {
        const s = start();
        expect(tilesIn(activate(s, 'gadgetHands'))).toBe(tilesIn(s) + 2);
    });

    test('One Tile to Rule Them All makes one tile worth 30', () => {
        const after = activate(start(), 'oneTileToRuleThemAll');
        expect(after.hand.filter(t => t?.tempPoints === 30)).toHaveLength(1);
    });

    test('Letter Upgrade and Polish last 5 words at x3', () => {
        const s = start();
        const lu = pp('letterUpgrade').activate(s.gameState, { letter: 'E' });
        expect(lu.letterMultipliers).toEqual({ E: 3 });
        expect(lu.activePowerPlays).toMatchObject({ letterUpgrade: { words: 5, letter: 'E' } });
        const po = pp('polish').activate(s.gameState, { letter: 'S' });
        expect(po.wordMultipliersByLetter).toEqual({ S: 3 });
    });
});

describe('new PowerPlay scoring', () => {
    const tiles = (letters: string, points = 1): Tile[] => letters.split('').map((letter, i) => ({ id: `${letter}${i}`, letter, points }));
    const state = (activePowerPlays: Record<string, unknown>) => ({
        roundType: 'normal', activeCharms: [], activePowerPlays, letterMultipliers: {}, wordMultipliersByLetter: {}, powerStarResidualActive: false,
    }) as unknown as GameState;

    test('Konami Code x2, Ludicrous Speed x2 (v7.55.0), Combo Breaker x3 on 4+ letters', () => {
        expect(calculateScore('cat', tiles('CAT'), state({ konamiCode: { words: 3 } })).totalScore).toBe(6);
        expect(calculateScore('cat', tiles('CAT'), state({ ludicrousSpeed: true })).totalScore).toBe(6);
        // 6 letters: length x2 + Combo Breaker x3 = x5
        expect(calculateScore('carton', tiles('CARTON'), state({ comboBreaker: { words: 3 } })).totalScore).toBe(30);
        // 4 letters qualifies: length x1.25 + Combo Breaker x3 = x4.25
        const cart = calculateScore('cart', tiles('CART'), state({ comboBreaker: { words: 3 } }));
        expect(cart.bonuses.some(b => b.name === 'Combo Breaker')).toBe(true);
        expect(cart.totalScore).toBe(17); // 5 without it
        expect(calculateScore('cat', tiles('CAT'), state({ comboBreaker: { words: 3 } })).bonuses.some(b => b.name === 'Combo Breaker')).toBe(false); // 3 letters: zeroed later, in the turn
    });

    test('Big Head Mode doubles tiles; The Upside Down flips values', () => {
        expect(calculateScore('cat', tiles('CAT', 2), state({ bigHeadMode: { words: 2 } })).totalScore).toBe(12);
        const qi: Tile[] = [{ id: 'q', letter: 'Q', points: 10 }, { id: 'i', letter: 'I', points: 1 }];
        expect(calculateScore('qi', qi, state({ upsideDown: true })).totalScore).toBe(11);
    });
});

describe('resuming a saved game', () => {
    test('rebuilds held power-ups from current definitions and drops moved ones', async () => {
        const { rehydratePowerUps } = await import('../GameScreen');
        const saved = JSON.parse(JSON.stringify({
            ...screenInitialState.gameState,
            availablePowerPlays: [pp('biglyScore')],
            activeCharms: [charm('powerPellet'), { id: 'deepFreeze', name: 'Deep Freeze' }],
            activeBuffs: [{ ...pp('letterUpgrade'), instanceId: 'x', description: "'E' tiles are worth 3x" }],
        }));
        const gs = rehydratePowerUps(saved);
        expect(typeof gs.availablePowerPlays[0].activate).toBe('function');
        expect(gs.activeCharms.map(c => c.id)).toEqual(['powerPellet']);
        expect(gs.activeBuffs[0].description).toBe("'E' tiles are worth 3x");
        expect(typeof gs.activeBuffs[0].activate).toBe('function');
    });
});

describe('Captain Planet', () => {
    const activate = () => {
        const s = start({ availablePowerPlays: [pp('captainPlanet')] });
        const idx = s.hand.findIndex(Boolean);
        const tile = s.hand[idx]!;
        const after = gameReducer({ ...s, tileForSelection: { tile, originalIndex: idx } }, { type: 'COMPLETE_POWER_PLAY_ACTIVATION', payload: { powerPlay: pp('captainPlanet') } });
        return { after, idx, tile };
    };

    test('the picked tile is worth 20, it is logged, and the PowerPlay is used up', () => {
        const { after, idx, tile } = activate();
        expect(after.hand[idx]).toMatchObject({ letter: tile.letter, tempPoints: 20, tempPointsSource: 'Captain Planet' });
        expect(after.gameState.availablePowerPlays).toHaveLength(0);
        expect(after.gameState.log.at(-1)).toMatchObject({ type: 'event', name: 'Captain Planet' });
        expect(after.gameState.lastPowerPlayResult?.message).toContain('20 points');
    });

    test('the 20 points last one turn: they clear after the next word', () => {
        const { after, idx } = activate();
        const next = gameReducer(after, { type: 'START_NEXT_ROUND' });
        expect(next.hand[idx]?.tempPoints).toBeUndefined();
        expect(next.hand[idx]?.tempPointsSource).toBeUndefined();
    });

    test('the score breakdown shows the boosted tile', () => {
        const { after, idx } = activate();
        const result = calculateScore(after.hand[idx]!.letter.repeat(3), [after.hand[idx]!, ...after.hand.filter((t, i) => t && i !== idx).slice(0, 2) as Tile[]], after.gameState);
        expect(result.bonuses.some(b => b.name.startsWith('Captain Planet'))).toBe(true);
    });
});

describe('tile point boosts are labeled in the score breakdown', () => {
    test('One Tile to Rule Them All marks its tile', () => {
        const s = start();
        const after = gameReducer(s, { type: 'ACTIVATE_POWER_PLAY', payload: pp('oneTileToRuleThemAll') });
        const boosted = after.hand.filter(t => t?.tempPoints === 30);
        expect(boosted).toHaveLength(1);
        expect(boosted[0]?.tempPointsSource).toBe('One Tile to Rule Them All');
    });

    test.each([
        ['One Tile to Rule Them All', 30],
        ['Rescue Drop', 20],
        ['Treehouse of Horror', 7],
    ])('%s shows "1 → N pts"', (source, points) => {
        const tile = { id: 'e', letter: 'E', points: 1, tempPoints: points, tempPointsSource: source } as Tile;
        const others = [{ id: 'a', letter: 'A', points: 1 }, { id: 't', letter: 'T', points: 1 }] as Tile[];
        const result = calculateScore('eat', [tile, ...others], start().gameState);
        expect(result.bonuses).toContainEqual(expect.objectContaining({ name: `${source} (E)`, description: `1 → ${points} pts` }));
    });
});

describe('Time PowerPlays pay in full (v7.40.2)', () => {
    test('Time Turner adds its full +10s per round, even above 60s', () => {
        const low = gameReducer(start({ activePowerPlays: { timeTurner: { rounds: 2 } } }, 30), { type: 'START_NEXT_ROUND' });
        expect(low.time).toBe(40);
        const high = gameReducer(start({ activePowerPlays: { timeTurner: { rounds: 2 } } }, 70), { type: 'START_NEXT_ROUND' });
        expect(high.time).toBe(80);
        expect(high.timeGain?.charm).toBeUndefined();
    });

    test('Charm time above 60s is halved and the time pop-up says so', () => {
        const next = gameReducer(start({ multiverseTimeBonus: 10 }, 70), { type: 'START_NEXT_ROUND' });
        expect(next.time).toBe(75);
        expect(next.timeGain?.charm).toMatchObject({ full: 10, paid: 5, halved: true });
    });

    test('Charm time in full carries no note', () => {
        const next = gameReducer(start({ multiverseTimeBonus: 10 }, 30), { type: 'START_NEXT_ROUND' });
        expect(next.time).toBe(40);
        expect(next.timeGain?.charm).toBeUndefined();
    });

    test('Time Boost adds 10s', () => {
        const s = start({}, 30);
        expect(gameReducer(s, { type: 'ACTIVATE_POWER_PLAY', payload: pp('timeBoost') }).time).toBe(40);
    });
});

describe('Perfectly Balanced charm', () => {
    const withCharm = () => ({ ...start().gameState, activeCharms: [charm('perfectlyBalanced')] });
    const tilesFor = (w: string) => w.split('').map((letter, i) => ({ id: `t${i}`, letter, points: 1 })) as Tile[];
    test.each([['team', true], ['road', true], ['tree', true], ['banana', true], ['idea', false], ['cat', false], ['strength', false]])('%s balanced: %s', (word, balanced) => {
        const result = calculateScore(word, tilesFor(word.toUpperCase()), withCharm());
        expect(result.bonuses.some(b => b.name === 'Perfectly Balanced')).toBe(balanced);
    });
});

describe('v6.13 additions', () => {
    const tilesFor = (w: string, points = 1) => w.split('').map((letter, i) => ({ id: `t${i}`, letter, points })) as Tile[];
    const gs = (over: Partial<GameState> = {}) => ({ ...start().gameState, ...over });
    const has = (r: { bonuses: { name: string }[] }, name: string) => r.bonuses.some(b => b.name.startsWith(name));

    test('Hold Onto Your Butts: rare letters score x3 on the next word', () => {
        const plain = calculateScore('zax', tilesFor('ZAX', 10), gs());
        const butts = calculateScore('zax', tilesFor('ZAX', 10), gs({ activePowerPlays: { holdOntoYourButts: true } }));
        expect(has(butts, 'Hold Onto Your Butts (Z)')).toBe(true);
        expect(has(butts, 'Hold Onto Your Butts (A)')).toBe(false);
        expect(butts.totalScore).toBeGreaterThan(plain.totalScore);
    });

    test("Rubik's Cube: 5+ letters with no repeats (v7.35: was 6+ for 150)", () => {
        const charms = { activeCharms: [charm('rubiksCube')] };
        expect(has(calculateScore('planet', tilesFor('PLANET'), gs(charms)), "Rubik's Cube")).toBe(true);
        expect(calculateScore('planet', tilesFor('PLANET'), gs(charms)).totalScore - calculateScore('planet', tilesFor('PLANET'), gs({})).totalScore).toBe(CHARM_BONUS.rubiksCube);
        expect(has(calculateScore('banana', tilesFor('BANANA'), gs(charms)), "Rubik's Cube")).toBe(false);
        expect(has(calculateScore('plane', tilesFor('PLANE'), gs(charms)), "Rubik's Cube")).toBe(true);
        expect(has(calculateScore('plan', tilesFor('PLAN'), gs(charms)), "Rubik's Cube")).toBe(false);
    });

    test('Sick Combo: longer than your last valid word', () => {
        const log = [{ type: 'word', word: 'CAT', status: 'valid', score: 5 } as any];
        const charms = { activeCharms: [charm('sickCombo')], log };
        expect(has(calculateScore('tree', tilesFor('TREE'), gs(charms)), 'Sick Combo')).toBe(true);
        expect(has(calculateScore('dog', tilesFor('DOG'), gs(charms)), 'Sick Combo')).toBe(false);
    });

    test('Mixtape (v7.58): a flat +75 for starting with the last letter of the previous word', () => {
        const at = (links: number, word: string) => calculateScore(word.toLowerCase(), tilesFor(word), gs({ activeCharms: [charm('mixtape')], mixtapeChain: { next: 'T', links } }));
        expect(at(0, 'TOP').bonuses.find(b => b.name === 'Mixtape')?.description).toBe(`+${CHARM_BONUS.mixtape} pts (picks up the T)`);
        expect(at(9, 'TOP').bonuses.find(b => b.name === 'Mixtape')?.description).toBe(`+${CHARM_BONUS.mixtape} pts (picks up the T)`);
        expect(has(at(3, 'CAT'), 'Mixtape')).toBe(false);
        expect(CHARMS_LIST.find(c => c.id === 'mixtape')!.description).not.toMatch(/chain|link/i);
    });

    test('Mixtape chain resets on a strike', () => {
        const s = start({ mixtapeChain: { next: 'T', links: 3 } });
        expect(gameReducer(s, { type: 'ADD_STRIKE' }).gameState.mixtapeChain).toBeNull();
    });

    test('Buy a Vowel: costs 100 and adds the vowel; too poor keeps it in the pocket', () => {
        const rich = start({ score: 150, availablePowerPlays: [pp('buyAVowel')] });
        const handWithGap = [...rich.hand]; handWithGap[7] = null;
        const bought = gameReducer({ ...rich, hand: handWithGap }, { type: 'COMPLETE_POWER_PLAY_ACTIVATION', payload: { powerPlay: pp('buyAVowel'), option: { letter: 'E' } } });
        expect(bought.gameState.score).toBe(50);
        expect(bought.hand[7]?.letter).toBe('E');
        expect(bought.gameState.availablePowerPlays).toEqual([]);

        const poor = start({ score: 60, availablePowerPlays: [pp('buyAVowel')] });
        const tried = gameReducer(poor, { type: 'ACTIVATE_POWER_PLAY', payload: pp('buyAVowel') });
        expect(tried.gameState.availablePowerPlays.map(p => p.id)).toEqual(['buyAVowel']);
        expect(tried.gameState.lastPowerPlayResult?.message).toContain('100 points');
    });

    test('Shake It Like a Polaroid keeps the vowels and redraws the rest', () => {
        const s = start({ availablePowerPlays: [pp('shakeItLikeAPolaroid')] });
        const letters = 'AEBCDFGH';
        const hand = s.hand.map((t, i) => (t && i < 8 ? { ...t, letter: letters[i] } : t));
        const after = gameReducer({ ...s, hand }, { type: 'ACTIVATE_POWER_PLAY', payload: pp('shakeItLikeAPolaroid') });
        const tiles = after.hand.filter(Boolean);
        expect(tiles).toHaveLength(8);
        expect(tiles.slice(0, 2).map(t => t!.letter)).toEqual(['A', 'E']);
        expect(after.time).toBe(s.time);
        expect(after.gameState.availablePowerPlays).toEqual([]);
    });
});

describe('v7.8 additions', () => {
    const tilesFor = (w: string, points = 1) => w.split('').map((letter, i) => ({ id: `t${i}`, letter, points })) as Tile[];
    const gs = (over: Partial<GameState> = {}) => ({ ...start().gameState, ...over });
    const has = (r: { bonuses: { name: string }[] }, name: string) => r.bonuses.some(b => b.name.startsWith(name));
    const played = (...words: string[]) => words.map(word => ({ type: 'word', word, status: 'valid', score: 5 } as any));

    test('descriptions read their numbers from config', () => {
        expect(pp('continueScreen').description).toContain(`${TIME_BONUS.continueScreen} seconds`);
        expect(pp('actClear').description).toContain(`+${POWER_PLAY_VALUES.actClearMaxSeconds * POWER_PLAY_VALUES.actClearPointsPerSecond}`);
        expect(charm('sandsOfTime').description).toContain(`${TIME_BONUS.sandsOfTimeLetters}+ letters add +${TIME_BONUS.sandsOfTime} seconds`);
        expect(charm('finishHim').description).toContain(`${CHARM_BONUS.finishHimBelow} seconds or less`);
        expect(charm('gottaCatchEmAll').description).toContain(`+${CHARM_BONUS.gottaCatchEmAll} points`);
    });

    test('Continue? is a once-per-run rescue that arms when picked; Act Clear! is pressed', () => {
        expect(pp('continueScreen').oncePerRun).toBe(true);
        expect(INSTANT_POWER_PLAY_IDS.has('continueScreen')).toBe(true);
        expect(INSTANT_POWER_PLAY_IDS.has('actClear')).toBe(false);
        const armed = gameReducer(start(), { type: 'CHOOSE_POWER_PLAY', payload: { powerPlay: pp('continueScreen'), allOffered: [pp('continueScreen')] } });
        expect(armed.gameState.activePowerPlays.continueScreen).toBe(true);
    });

    test('Act Clear!: 40 points a second, up to 15 seconds, always leaving 10 (v7.35)', () => {
        const { actClearMaxSeconds: maxS, actClearPointsPerSecond: per } = POWER_PLAY_VALUES;
        const full = gameReducer(start({ score: 100, availablePowerPlays: [pp('actClear')] }, 40), { type: 'ACTIVATE_POWER_PLAY', payload: pp('actClear') });
        expect(full.time).toBe(40 - maxS);
        expect(full.gameState.score).toBe(100 + maxS * per);
        expect(full.gameState.availablePowerPlays).toEqual([]);

        const partial = gameReducer(start({ score: 0, availablePowerPlays: [pp('actClear')] }, 25), { type: 'ACTIVATE_POWER_PLAY', payload: pp('actClear') });
        expect(partial.time).toBe(10);
        expect(partial.gameState.score).toBe(15 * per);

        const low = gameReducer(start({ score: 0, availablePowerPlays: [pp('actClear')] }, 10), { type: 'ACTIVATE_POWER_PLAY', payload: pp('actClear') });
        expect(low.time).toBe(10);
        expect(low.gameState.score).toBe(0);
        expect(low.gameState.availablePowerPlays.map(p => p.id)).toEqual(['actClear']);
        expect(low.gameState.lastPowerPlayResult?.message).toContain('still in your pocket');
    });

    test("Gotta Catch 'Em All: vowels add up across words, and equipping starts a fresh Pokédex", () => {
        expect(catchVowels('', 'CAT')).toBe('A');
        expect(catchVowels('A', 'pie')).toBe('AEI');
        expect(catchVowels('AEI', 'SOUP')).toBe('AEIOU');
        expect(catchVowels('AE', 'RHYTHM')).toBe('AE');
        const s = start({ pokedexVowels: 'AEI' });
        const equipped = gameReducer(s, { type: 'CHOOSE_CHARM', payload: { charm: charm('gottaCatchEmAll'), hand: s.hand, allOffered: [charm('gottaCatchEmAll')] } });
        expect(equipped.gameState.pokedexVowels).toBe('');
    });

    test('The Opposite: no letters shared with your last valid word', () => {
        const charms = { activeCharms: [charm('theOpposite')], log: played('CAT') };
        expect(has(calculateScore('mind', tilesFor('MIND'), gs(charms)), 'The Opposite')).toBe(true);
        expect(has(calculateScore('ten', tilesFor('TEN'), gs(charms)), 'The Opposite')).toBe(false);
        expect(has(calculateScore('mind', tilesFor('MIND'), gs({ activeCharms: [charm('theOpposite')] })), 'The Opposite')).toBe(false); // first word
    });

    test('Eagle!: +40 on the word right after a 5+ letter word', () => {
        const after = (last: string) => calculateScore('dog', tilesFor('DOG'), gs({ activeCharms: [charm('eagle')], log: played('CAT', last) }));
        expect(after('PLANT').totalScore - after('CAT').totalScore).toBe(CHARM_BONUS.eagle);
        expect(has(after('PLANT'), 'Eagle!')).toBe(true);
        expect(has(after('TREE'), 'Eagle!')).toBe(false);
    });

    test('We Were on a Break!: a shuffle arms x2 for the next word, only with the charm', () => {
        const shuffle = (s: GameScreenState) => gameReducer(s, { type: 'PERFORM_SHUFFLE', payload: { hand: s.hand, tileBag: s.tileBag, isFree: false } } as any);
        expect(shuffle(start({ activeCharms: [charm('weWereOnABreak')] })).gameState.breakReady).toBe(true);
        expect(shuffle(start()).gameState.breakReady).toBeFalsy();
        const ready = gs({ activeCharms: [charm('weWereOnABreak')], breakReady: true });
        expect(calculateScore('cat', tilesFor('CAT'), ready).totalScore).toBe(6);
        expect(calculateScore('cat', tilesFor('CAT'), { ...ready, breakReady: false }).totalScore).toBe(3);
    });

    test('Survivor: no leftover bonus-word counter (v7.35 pays per strike carried, in the turn hook)', () => {
        const s = start({ activeCharms: [charm('survivor')] });
        expect(gameReducer(s, { type: 'ADD_STRIKE' }).gameState.survivorWords).toBeFalsy();
        expect(charm('survivor').description).toContain(`+${CHARM_BONUS.survivor}`);
    });

    test("I'm Ready!: equipping right before a new level still pays that level's first word", () => {
        const equip = (words: number) => {
            const s = start({ log: played(...Array(words).fill('CAT')) });
            return gameReducer(s, { type: 'CHOOSE_CHARM', payload: { charm: charm('imReady'), hand: s.hand, allOffered: [charm('imReady')] } }).gameState.readyLevel;
        };
        expect(equip(5)).toBe(1);   // pays on level 2's first word
        expect(equip(18)).toBe(1);  // the next word starts level 2, and still pays
        expect(equip(20)).toBe(2);  // mid level 2: waits for level 3
    });

    test('Backpack, Backpack!: +60 for each PowerPlay used, not for swaps or failed uses', () => {
        const withPack = { activeCharms: [charm('backpack')] };
        const used = gameReducer(start({ ...withPack, score: 0, availablePowerPlays: [pp('actClear')] }, 40), { type: 'ACTIVATE_POWER_PLAY', payload: pp('actClear') });
        expect(used.gameState.score).toBe(POWER_PLAY_VALUES.actClearMaxSeconds * POWER_PLAY_VALUES.actClearPointsPerSecond + CHARM_BONUS.backpack);
        expect(used.gameState.log.some(e => e.type === 'event' && e.name === 'Backpack, Backpack!')).toBe(true);

        const noPack = gameReducer(start({ score: 0, availablePowerPlays: [pp('actClear')] }, 40), { type: 'ACTIVATE_POWER_PLAY', payload: pp('actClear') });
        expect(noPack.gameState.score).toBe(POWER_PLAY_VALUES.actClearMaxSeconds * POWER_PLAY_VALUES.actClearPointsPerSecond);

        const instant = gameReducer(start({ ...withPack, score: 0 }), { type: 'CHOOSE_POWER_PLAY', payload: { powerPlay: pp('fluncleIsProud'), allOffered: [pp('fluncleIsProud')] } });
        expect(instant.gameState.score).toBe(300 + CHARM_BONUS.backpack);

        const swap = gameReducer(start({ ...withPack, score: 0, availablePowerPlays: [pp('timeBoost')] }), { type: 'CHOOSE_POWER_PLAY', payload: { powerPlay: pp('konamiCode'), allOffered: [pp('konamiCode')] } });
        expect(swap.gameState.score).toBe(0);

        const failed = gameReducer(start({ ...withPack, score: 0, availablePowerPlays: [pp('actClear')] }, 8), { type: 'ACTIVATE_POWER_PLAY', payload: pp('actClear') });
        expect(failed.gameState.score).toBe(0);
    });
});

describe('PowerPlays used mid-round', () => {
    test("One Tile's boost survives its pop-up: only a played word waits for the next round", () => {
        const s = start({ availablePowerPlays: [pp('oneTileToRuleThemAll')] });
        const used = gameReducer(s, { type: 'ACTIVATE_POWER_PLAY', payload: pp('oneTileToRuleThemAll') });
        expect(used.hand.filter(t => t?.tempPoints === 30)).toHaveLength(1);
        expect(used.awaitingNextRound).toBeFalsy();
        const played = gameReducer(used, { type: 'HANDLE_SUBMIT_SUCCESS', payload: { gameState: used.gameState, hand: used.hand, tileBag: used.tileBag, modalQueue: [] } } as any);
        expect(played.awaitingNextRound).toBe(true);
        expect(gameReducer(played, { type: 'START_NEXT_ROUND' }).awaitingNextRound).toBe(false);
    });

    test('every PowerPlay use is in the event log, once', () => {
        const s = start({ availablePowerPlays: [pp('oneTileToRuleThemAll')] });
        const used = gameReducer(s, { type: 'ACTIVATE_POWER_PLAY', payload: pp('oneTileToRuleThemAll') });
        expect(used.gameState.log.filter(e => e.type === 'event' && e.name === 'One Tile to Rule Them All')).toHaveLength(1);
        // Fluncle logs its own result, so it isn't logged twice.
        const fluncle = gameReducer(start(), { type: 'CHOOSE_POWER_PLAY', payload: { powerPlay: pp('fluncleIsProud'), allOffered: [pp('fluncleIsProud')] } });
        expect(fluncle.gameState.log.filter(e => e.type === 'event' && e.name === 'Fluncle is Proud')).toHaveLength(1);
        // A swap is not a use.
        const swap = gameReducer(start({ availablePowerPlays: [pp('timeBoost')] }), { type: 'CHOOSE_POWER_PLAY', payload: { powerPlay: pp('konamiCode'), allOffered: [pp('konamiCode')] } });
        expect(swap.gameState.log.some(e => e.type === 'event' && e.name === 'Time Boost')).toBe(false);
    });
});

describe('v7.16 charms', () => {
    const tilesFor = (w: string, points = 1) => w.split('').map((letter, i) => ({ id: `t${i}`, letter, points })) as Tile[];
    const gs = (over: Partial<GameState> = {}) => ({ ...start().gameState, ...over });
    const has = (r: { bonuses: { name: string }[] }, name: string) => r.bonuses.some(b => b.name.startsWith(name));
    const score = (id: string, word: string, tiles = tilesFor(word), over: Partial<GameState> = {}) => calculateScore(word.toLowerCase(), tiles, gs({ activeCharms: [charm(id)], ...over }));

    test('A-Team: words starting with A', () => {
        expect(has(score('aTeam', 'ATOM'), 'A-Team')).toBe(true);
        expect(has(score('aTeam', 'TOMB'), 'A-Team')).toBe(false);
    });

    test('Conjunction Junction: letters in alphabetical order', () => {
        for (const w of ['BEST', 'CHIPS', 'FLOW', 'ALMOST']) expect(has(score('conjunctionJunction', w), 'Conjunction Junction')).toBe(true);
        expect(has(score('conjunctionJunction', 'TRAIN'), 'Conjunction Junction')).toBe(false);
    });

    test("Average Joe's (was Vote for Pedro, id kept): only 1-point tiles", () => {
        expect(CHARMS_LIST.find(c => c.id === 'voteForPedro')!.name).toBe("Average Joe's");
        expect(has(score('voteForPedro', 'TRAIN'), "Average Joe's")).toBe(true);
        const withP = [{ id: 'p', letter: 'P', points: 3 }, ...tilesFor('INT')] as Tile[];
        expect(has(score('voteForPedro', 'PINT', withP), "Average Joe's")).toBe(false);
    });

    test('Form Voltron: a combo tile in the word', () => {
        const quiz = [{ id: 'qu', letter: 'QU', points: 11, isCombo: true }, ...tilesFor('IZ')] as Tile[];
        expect(has(score('formVoltron', 'QUIZ', quiz), 'Form Voltron')).toBe(true);
        expect(has(score('formVoltron', 'QUIZ'), 'Form Voltron')).toBe(false);
    });

    test('Titans, Go!: +4 per equipped charm, up to the 5 slots', () => {
        const titans = (n: number) => calculateScore('cat', tilesFor('CAT'), gs({ activeCharms: [charm('titansGo'), ...CHARMS_LIST.filter(c => c.id === 'theValve' || c.id === 'oneRing').slice(0, n - 1)] })).bonuses.find(b => b.name === 'Titans, Go!')?.description;
        expect(titans(1)).toBe(`+${CHARM_BONUS.titansPerCharm} pts`);
        expect(titans(3)).toBe(`+${CHARM_BONUS.titansPerCharm * 3} pts`);
    });

    test("I'm Always Here: an invalid word is still a strike but costs no time", () => {
        const withCharm = gameReducer(start({ activeCharms: [charm('imAlwaysHere')] }, 30), { type: 'ADD_STRIKE', payload: { source: 'invalid_word' } } as any);
        expect(withCharm.gameState.strikes).toBe(1);
        expect(withCharm.time).toBe(30);
        const without = gameReducer(start({}, 30), { type: 'ADD_STRIKE', payload: { source: 'invalid_word' } } as any);
        expect(without.time).toBe(30 - GAMEPLAY.timeBank.invalidPenalty);
    });

    test('Cross the Road (v7.58): a strike no longer sends the frog back; equipping starts fresh', () => {
        expect(gameReducer(start({ frogStreak: 2 }), { type: 'ADD_STRIKE' }).gameState.frogStreak).toBe(2);
        const s = start({ frogStreak: 2 });
        expect(gameReducer(s, { type: 'CHOOSE_CHARM', payload: { charm: charm('crossTheRoad'), hand: s.hand, allOffered: [charm('crossTheRoad')] } }).gameState.frogStreak).toBe(0);
    });
});

describe('v7.17 balance pass', () => {
    const tilesFor = (w: string, points = 1) => w.split('').map((letter, i) => ({ id: `t${i}`, letter, points })) as Tile[];
    const gs = (over: Partial<GameState> = {}) => ({ ...start().gameState, ...over });
    const bonus = (id: string, word: string, name: string, over: Partial<GameState> = {}) =>
        calculateScore(word.toLowerCase(), tilesFor(word), gs({ activeCharms: [charm(id)], ...over })).bonuses.find(b => b.name.startsWith(name))?.description;

    test('Conjunction Junction, Vote for Pedro and LUNA skip 3-letter words', () => {
        expect(bonus('conjunctionJunction', 'ACE', 'Conjunction')).toBeUndefined();
        expect(bonus('conjunctionJunction', 'BEST', 'Conjunction')).toBe(`+${CHARM_BONUS.conjunctionJunction} pts`);
        expect(bonus('voteForPedro', 'TEA', "Average Joe's")).toBeUndefined();
        expect(bonus('voteForPedro', 'TRAIN', "Average Joe's")).toBe(`+${CHARM_BONUS.voteForPedro} pts`);
        expect(bonus('luna', 'AGE', 'LUNA')).toBeUndefined();
        expect(bonus('luna', 'AREA', 'LUNA')).toBe(`+${CHARM_BONUS.luna} pts`);
    });

    test('loosened rare charms pay flat points', () => {
        expect(bonus('sacredHeart', 'DOG', 'Sacred Heart')).toBe(`+${CHARM_BONUS.sacredHeart} pts`);
        expect(bonus('sacredHeart', 'CAT', 'Sacred Heart')).toBeUndefined();
        expect(bonus('trueLove', 'LAMP', 'True Love')).toBe(`+${CHARM_BONUS.trueLove} pts`);
        expect(bonus('trueLove', 'LOVE', 'True Love')).toBe(`+${CHARM_BONUS.trueLoveBoth} pts`);
        expect(bonus('trueLove', 'CAT', 'True Love')).toBeUndefined();
        expect(bonus('starPower', 'STOP', 'Star Power')).toBe(`+${CHARM_BONUS.starPower} pts`);
        expect(bonus('starPower', 'SOAP', 'Star Power')).toBeUndefined();
        expect(bonus('silentKiller', 'MYTH', 'Silent Killer')).toBe(`+${CHARM_BONUS.silentKiller} pts`);
        expect(bonus('silentKiller', 'HAND', 'Silent Killer')).toBe(`+${CHARM_BONUS.silentKiller} pts`);
        expect(bonus('silentKiller', 'GYM', 'Silent Killer')).toBeUndefined(); // too short since v7.35
        expect(bonus('silentKiller', 'HEAD', 'Silent Killer')).toBeUndefined();
        expect(bonus('silentKiller', 'GEM', 'Silent Killer')).toBeUndefined();
        // v7.58: ends in A, I or O (it was AN).
        expect(bonus('italianRestaurantEnding', 'PASTA', 'Italian')).toBe(`+${CHARM_BONUS.italianRestaurant} pts`);
        expect(bonus('italianRestaurantEnding', 'RADIO', 'Italian')).toBe(`+${CHARM_BONUS.italianRestaurant} pts`);
        expect(bonus('italianRestaurantEnding', 'ITALIAN', 'Italian')).toBeUndefined();
        expect(bonus('cleverGirl', 'TRAP', 'Clever Girl')).toBe(`+${CHARM_BONUS.cleverGirl} pts`);
        // v7.58: a word that starts with a RAPTOR letter (R, A, P, T or O).
        expect(bonus('cleverGirl', 'OAK', 'Clever Girl')).toBe(`+${CHARM_BONUS.cleverGirl} pts`);
        expect(bonus('cleverGirl', 'DOG', 'Clever Girl')).toBeUndefined();
        expect(bonus('cleverGirl', 'SPORT', 'Clever Girl')).toBeUndefined();
        // Why? Because Chuck Norris. (v7.58): Y words score x2 (it used to turn a random tile 2x).
        const chuck = (w: string) => calculateScore(w.toLowerCase(), tilesFor(w), gs({ activeCharms: [charm('chuckNorrisWhy')] }));
        expect(chuck('PLAY').bonuses.find(b => b.name.startsWith('Why?'))?.description).toBe(`x${CHARM_BONUS.chuckNorrisMultiplier} Score`);
        expect(chuck('PLAY').totalScore).toBeGreaterThan(calculateScore('play', tilesFor('PLAY'), gs()).totalScore);
        expect(chuck('PLAN').bonuses.some(b => b.name.startsWith('Why?'))).toBe(false);
        expect(bonus('radioactiveSpiderBite', 'RED', 'Radioactive')).toBe(`+${CHARM_BONUS.radioactiveAll} pts`);
        expect(bonus('radioactiveSpiderBite', 'DOE', 'Radioactive')).toBe(`+${CHARM_BONUS.radioactive} pts`);
        expect(bonus('radioactiveSpiderBite', 'DOG', 'Radioactive')).toBeUndefined();
        expect(bonus('inigosRevenge', 'IRIS', 'Inigo')).toBe(`+${CHARM_BONUS.inigosRevenge} pts`);
    });

    test('Finisher adds points to the last tile', () => {
        const withIt = calculateScore('cat', tilesFor('CAT'), gs({ activeCharms: [charm('finisher')] }));
        const without = calculateScore('cat', tilesFor('CAT'), gs());
        expect(withIt.totalScore - without.totalScore).toBe(CHARM_BONUS.finisher);
    });

    test('Nuclear Option is x3 now; Rewind and Deep Freeze are once per run', () => {
        expect(calculateScore('cat', tilesFor('CAT'), gs({ activePowerPlays: { nuclearOption: true } } as any)).totalScore).toBe(3 * POWER_PLAY_VALUES.nuclearOptionMultiplier);
        expect(pp('rewind').oncePerRun).toBe(true);
        expect(pp('deepFreeze').oncePerRun).toBe(true);
        expect(pp('swapOut').swapConfig).toEqual({ min: 4, max: 5 });
    });
});

describe('v7.18 charms', () => {
    const tilesFor = (w: string, points = 1) => w.split('').map((letter, i) => ({ id: `t${i}`, letter, points })) as Tile[];
    const gs = (over: Partial<GameState> = {}) => ({ ...start().gameState, ...over });
    const bonus = (id: string, word: string, name: string, over: Partial<GameState> = {}) =>
        calculateScore(word.toLowerCase(), tilesFor(word), gs({ activeCharms: [charm(id)], ...over })).bonuses.find(b => b.name.startsWith(name))?.description;

    test('Honey, I Shrunk the Kids: one fewer tile, +points every word', () => {
        expect(handSizeFor({ activeCharms: [charm('honeyIShrunkTheKids')] })).toBe(GAMEPLAY.handSize - 1);
        expect(handSizeFor({})).toBe(GAMEPLAY.handSize);
        expect(bonus('honeyIShrunkTheKids', 'CAT', 'Honey')).toBe(`+${CHARM_BONUS.honeyShrunk} pts`);
    });

    test('Mr. Glass: +points every word, one fewer strike', () => {
        expect(bonus('mrGlass', 'CAT', 'Mr. Glass')).toBe(`+${CHARM_BONUS.mrGlass} pts`);
        expect(maxStrikesFor({ charmUses: {}, activeCharms: [charm('mrGlass')] } as any)).toBe(2);
        expect(maxStrikesFor({ charmUses: { strikeBank: 1 }, activeCharms: [charm('mrGlass')] } as any)).toBe(3);
    });

    test('Turbo Button and Little Mac change the meter and the boss target', () => {
        expect(meterLettersFor(1, { activeCharms: [charm('turboButton')] })).toBe(GAMEPLAY.powerPlayMeterLetters - CHARM_BONUS.turboButtonLetters);
        expect(bossHitsToWin({ activeCharms: [charm('littleMac')] })).toBe(5);
        expect(bossHitsToWin({ activeCharms: [] })).toBe(6);
        expect(advanceBoss({ id: 'x', number: 1, wordsLeft: 4, hits: 4 } as any, true, 5).outcome).toBe('won');
        expect(advanceBoss({ id: 'x', number: 1, wordsLeft: 4, hits: 4 } as any, true).outcome).toBe(null);
    });

    test('Sesame Street pays for the letter of the day only', () => {
        const sesameLetter = { letter: 'T', level: 1 };
        expect(bonus('sesameStreet', 'CAT', 'Sesame Street', { sesameLetter })).toBe(`+${CHARM_BONUS.sesameStreet} pts`);
        expect(bonus('sesameStreet', 'DOG', 'Sesame Street', { sesameLetter })).toBeUndefined();
        const equipped = gameReducer(start(), { type: 'CHOOSE_CHARM', payload: { charm: charm('sesameStreet'), hand: start().hand, allOffered: [charm('sesameStreet')] } } as any);
        expect(CHARM_BONUS.sesameLetters).toContain(equipped.gameState.sesameLetter!.letter);
    });

    test('Happy Little Accidents: the first invalid word each level costs time, not a strike', () => {
        const s0 = start({ activeCharms: [charm('happyLittleAccidents')] }, 30);
        const first = gameReducer(s0, { type: 'ADD_STRIKE', payload: { source: 'invalid_word' } } as any);
        expect(first.gameState.strikes).toBe(0);
        expect(first.time).toBe(30 - CHARM_BONUS.happyAccidentSeconds);
        const second = gameReducer(first, { type: 'ADD_STRIKE', payload: { source: 'invalid_word' } } as any);
        expect(second.gameState.strikes).toBe(1);
    });

    test('Wile E. Coyote: a strike pays points and time, unless it ends the run', () => {
        const s0 = start({ activeCharms: [charm('wileECoyote')], score: 100 }, 30);
        const hit = gameReducer(s0, { type: 'ADD_STRIKE', payload: { source: 'challenge' } } as any);
        expect(hit.gameState.strikes).toBe(1);
        expect(hit.gameState.score).toBe(100 + CHARM_BONUS.wileECoyote);
        expect(hit.time).toBe(30 + TIME_BONUS.wileECoyote);
        const last = gameReducer(start({ activeCharms: [charm('wileECoyote')], score: 100, strikes: 2 }, 30), { type: 'ADD_STRIKE', payload: { source: 'challenge' } } as any);
        expect(last.gameState.score).toBe(100);
    });

    test('Double Dare pays through a logged charm payout', () => {
        const paid = gameReducer(start({ score: 10 }), { type: 'CHARM_PAYOUT', payload: { id: 'doubleDare', points: CHARM_BONUS.doubleDare, description: 'x' } } as any);
        expect(paid.gameState.score).toBe(10 + CHARM_BONUS.doubleDare);
        expect(paid.gameState.log.at(-1)).toMatchObject({ type: 'event', name: 'Double Dare', scoreChange: CHARM_BONUS.doubleDare });
    });
});

describe('v7.22 power words', () => {
    const tilesFor = (w: string) => w.split('').map((letter, i) => ({ id: `t${i}`, letter, points: 1 })) as Tile[];
    test('SPICE: the next word scores x3', () => {
        const spiced = calculateScore('cat', tilesFor('CAT'), { ...start().gameState, spiceNext: true });
        expect(spiced.totalScore).toBe(3 * 3);
        expect(spiced.bonuses.some(b => b.name.includes('Spice'))).toBe(true);
        expect(calculateScore('cat', tilesFor('CAT'), start().gameState).totalScore).toBe(3);
    });
    test('there are 10 power words, none paying points', () => {
        const power = SECRET_BONUSES.filter(b => b.effect);
        expect(power.map(b => b.word).sort()).toEqual(['CAKE', 'HEAL', 'REWIND', 'RINGS', 'SLOT', 'SLOW', 'SNOW', 'SPICE', 'SWORD', 'TWIN']);
        for (const b of power) expect(b.points).toBeUndefined();
    });
});

describe('auto-save and resume', () => {
    test('the saved state keeps plain pop-ups (like an offer) and drops ones with rich content', () => {
        const base = start();
        const offer = { type: 'charm-selection', title: 'Charm Earned!', content: 'Pick one.', data: [charm('aTeam')] } as any;
        const rich = { type: 'game-over-summary', title: 'GAME OVER', content: { $$typeof: 'react' } } as any;
        const saved = savableScreenState({ ...base, modalContent: offer, modalQueue: [rich, offer], isLoading: true, resumeCountdown: 2 });
        expect(saved.modalContent).toEqual(offer);
        expect(saved.modalQueue).toEqual([offer]);
        expect(saved).toMatchObject({ isLoading: false, resumeCountdown: 0, lastTurnState: null });
    });

    test('the resume countdown ticks down, then the clock runs again unless a pop-up is open', () => {
        const s3 = { ...start(), resumeCountdown: RESUME_COUNTDOWN, isPaused: true, modalContent: null };
        const s2 = gameReducer(s3, { type: 'RESUME_COUNTDOWN_TICK' } as any);
        expect(s2).toMatchObject({ resumeCountdown: RESUME_COUNTDOWN - 1, isPaused: true });
        let s = s2; while ((s.resumeCountdown ?? 0) > 0) s = gameReducer(s, { type: 'RESUME_COUNTDOWN_TICK' } as any);
        expect(s.isPaused).toBe(false);
        const withPopup = gameReducer({ ...s3, resumeCountdown: 1, modalContent: { type: 'info', title: 'x' } } as any, { type: 'RESUME_COUNTDOWN_TICK' } as any);
        expect(withPopup.isPaused).toBe(true);
    });
});

describe('closing the last pop-up after a word starts the next round', () => {
    test('every pop-up type a word can queue is a post-word pop-up (v7.19 level-up regression)', () => {
        const src = readFileSync(resolve(__dirname, '../GameScreen.tsx'), 'utf8');
        const queued = new Set([...src.matchAll(/modalQueue\.push\(\{ type: '([a-z-]+)'/g), ...src.matchAll(/return \{ type: '([a-z-]+)', title/g)].map(m => m[1]));
        expect(queued.size).toBeGreaterThan(5);
        for (const type of queued) expect(POST_WORD_MODALS, `${type} must be in POST_WORD_MODALS`).toContain(type);
        expect(POST_WORD_MODALS).toContain('level-up');
    });
});

describe('chance PowerPlays show their result on a card that waits for Continue', () => {
    test("Fortune's Favor (an 8-Ball card since v7.72.5) shows its result on an outcome card that waits", () => {
        const after = gameReducer({ ...start({ score: 1000 }), modalContent: null }, { type: 'APPLY_GAMBLE', payload: { powerPlay: pp('fortunesFavor'), points: -200, headline: '-200 POINTS', detail: 'x', tone: 'lose' } } as any);
        expect(after.modalContent).toMatchObject({ type: 'outcome', title: pp('fortunesFavor').name });
        expect(after.modalContent!.autoClose).toBeUndefined();
        expect(after.gameState.score).toBe(800);
        expect(after.isPaused).toBe(true);
    });
    test('outcome cards start the next round when they close after a word', () => {
        expect(POST_WORD_MODALS).toContain('outcome');
    });
    test('Space Invader reads its numbers from config', () => {
        expect(pp('spaceInvader').description).toContain(`x${POWER_PLAY_VALUES.spaceInvaderMultiplier}`);
        expect(pp('spaceInvader').description).toContain(`${POWER_PLAY_VALUES.spaceInvaderCap} points`);
    });
});

describe('v7.25 gamble PowerPlays', () => {
    test('the rolls pay what the config says, and expected values sit near Fluncle', () => {
        const { plinko, hotTub, dealCases } = POWER_PLAY_VALUES;
        expect(plinkoPayout(0)).toBe(plinko[0].points);
        expect(plinkoPayout(0.999)).toBe(plinko[plinko.length - 1].points);
        const ev = plinko.reduce((s, p) => s + p.points * p.chance, 0);
        expect(ev).toBeGreaterThan(250); expect(ev).toBeLessThan(400);
        expect(hotTubSeconds(0)).toBe(hotTub[0].seconds);
        expect(hotTubSeconds(0.99)).toBe(hotTub[2].seconds);
        expect(dealCases.reduce((a, b) => a + b, 0) / dealCases.length).toBe(425);
    });
    test('Daily Double bets a flat 200, never more than the score (v7.58)', () => {
        expect(dailyDoubleWager(0)).toBe(0); // never more than the score (v7.28.8)
        expect(dailyDoubleWager(60)).toBe(60);
        expect(dailyDoubleWager(500)).toBe(POWER_PLAY_VALUES.dailyDoubleBet);
        expect(dailyDoubleWager(99999)).toBe(POWER_PLAY_VALUES.dailyDoubleBet);
        expect(PRIZE_POWER_PLAY_IDS.has('dailyDouble')).toBe(true);
    });
    test('push your luck: doors, Minesweeper and Deal or No Deal', () => {
        // v7.68.0: one row of doors, the prizes and a Zonk (0), shuffled.
        expect(dealDoors(() => 0).sort((a, b) => a - b)).toEqual([0, ...POWER_PLAY_VALUES.doorPrizes].sort((a, b) => a - b));
        expect(dealDoors(() => 0.5).filter(d => d === 0)).toHaveLength(1);
        // The Minesweeper pot climbs the ladder.
        expect(minesweeperPot(0)).toBe(0);
        expect(minesweeperPot(1)).toBe(POWER_PLAY_VALUES.minesweeperLadder[0]);
        expect(minesweeperPot(5)).toBe(825);
        // The Banker offers a share of what's left, rising each round.
        expect(bankerOffer([0, 100, 200, 400], 0)).toBe(Math.round(175 * 0.6 / 5) * 5);
        expect(bankerOffer([1500, 0], 2)).toBe(Math.round(750 * 0.9 / 5) * 5);
        const g = dealGame(() => 0.3);
        expect([g.mine, ...g.others].sort((a, b) => a - b)).toEqual([...POWER_PLAY_VALUES.dealCases].sort((a, b) => a - b));
    });
    test('a gamble result applies points and time, empties the pocket and opens the outcome card', () => {
        const base = { ...start({ score: 100, availablePowerPlays: [pp('plinko')] }, 30), modalContent: null };
        const after = gameReducer(base, { type: 'APPLY_GAMBLE', payload: { powerPlay: pp('plinko'), points: 300, seconds: 10, headline: '+300 POINTS', detail: 'x', tone: 'win' } } as any);
        expect(after.gameState.score).toBe(400);
        expect(after.time).toBe(40);
        expect(after.gameState.availablePowerPlays).toEqual([]);
        expect(after.modalContent).toMatchObject({ type: 'outcome', data: { headline: '+300 POINTS' } });
    });
    test('Neuralyzer (v7.35): keeps the charms and lines up a charm offer for the next valid word', () => {
        const base = start({ activeCharms: [charm('aTeam'), charm('luna')], activeBuffs: [charm('aTeam'), charm('luna'), pp('konamiCode')], availablePowerPlays: [pp('neuralyzer')] });
        const after = gameReducer(base, { type: 'NEURALYZE', payload: { powerPlay: pp('neuralyzer') } } as any);
        expect(after.gameState.activeCharms.map(c => c.id)).toEqual(['aTeam', 'luna']);
        expect(after.gameState.wordMilestoneProgress.count).toBe(after.gameState.wordMilestoneProgress.nextUnlock - 1);
        expect(after.gameState.availablePowerPlays).toEqual([]);
        expect(pp('neuralyzer').oncePerRun).toBe(true);
    });

});

describe('Mission: Impossible', () => {
    test('v7.55.0: a secret mission within a few words for a prize; failing costs nothing', () => {
        const d = pp('missionImpossible').description;
        expect(d).toContain(`within ${POWER_PLAY_VALUES.missionWords} words for +${POWER_PLAY_VALUES.missionPrize}`);
        expect(d).toContain('fail and you lose nothing');
        expect(PRIZE_POWER_PLAY_IDS.has('missionImpossible')).toBe(true);
    });
    test('each mission tests what it says', () => {
        const t = (id: string, w: string) => missionById(id)!.test(w);
        expect(t('rare', 'JOKE')).toBe(true); expect(t('rare', 'TONE')).toBe(false);
        expect(t('long', 'GARDEN')).toBe(true); expect(t('long', 'GARDE')).toBe(false);
        expect(t('ing', 'SING')).toBe(true); expect(t('ing', 'ING')).toBe(false);
        expect(t('bookends', 'TOAST')).toBe(true); expect(t('bookends', 'TOASTS')).toBe(false);
        expect(t('vowels', 'AUDIO')).toBe(true); expect(t('vowels', 'TONE')).toBe(false);
        expect(t('double', 'BOOK')).toBe(true); expect(t('double', 'BAKE')).toBe(false);
        expect(MISSIONS).toHaveLength(6);
    });
});

describe('WILDCARD (v7.50.0)', () => {
    test('four outcomes at the owner\'s odds: 30 / 30 / 30 / 10', () => {
        expect(POWER_PLAY_VALUES.wildcard.map(o => [o.kind, o.chance])).toEqual([['time', 0.3], ['points', 0.3], ['tile', 0.3], ['strike', 0.1]]);
        expect(POWER_PLAY_VALUES.wildcard.reduce((a, o) => a + o.chance, 0)).toBeCloseTo(1);
        expect(POWER_PLAY_VALUES.wildcard[0].seconds).toBe(5);
        expect(POWER_PLAY_VALUES.wildcard[1].points).toBe(500);
    });
    test('a roll lands on each outcome in its share', () => {
        const counts = [0, 0, 0, 0];
        for (let i = 0; i < 1000; i++) counts[wildcardIndex(i / 1000)]++;
        expect(counts).toEqual([300, 300, 300, 100]);
    });
    test('it is a pocket gamble card, its +500 grows with the level, and the text reads from config', () => {
        const pp = POWER_PLAYS_LIST.find(p => p.id === 'wildcard')!;
        expect(pp.name).toBe('Wildcard, B*tches!'); // v7.68.0: Charlie's line
        expect(INSTANT_POWER_PLAY_IDS.has('wildcard')).toBe(false);
        expect(GAMBLE_CARD_IDS).toContain('wildcard');
        expect(PRIZE_POWER_PLAY_IDS.has('wildcard')).toBe(true);
        expect(pp.description).toContain('+5 seconds');
        expect(pp.description).toContain('+500 points');
        expect(pp.description).toContain('10% a strike');
    });
    test('the free tile fills an empty slot (never one a word-row tile returns to), else adds one', () => {
        const s = start({});
        const empty = s.hand.indexOf(null);
        expect(empty).toBeGreaterThan(-1);
        const after = gameReducer(s, { type: 'ADD_FREE_TILE', payload: { letter: 'q' } });
        expect(after.hand).toHaveLength(s.hand.length);
        expect(after.hand[empty]?.letter).toBe('Q');
        // The first tile sits in the word row: its slot stays reserved.
        const moved = gameReducer(s, { type: 'MOVE_TILE_TO_BUILD', payload: { tile: s.hand[0]!, fromIndex: 0 } });
        const q = gameReducer(moved, { type: 'ADD_FREE_TILE', payload: { letter: 'Q' } });
        expect(q.hand[0]).toBeNull();
        // A full hand grows by one.
        const full = { ...s, hand: s.hand.map(t => t ?? gameUtils.createTile('E')) };
        const grown = gameReducer(full, { type: 'ADD_FREE_TILE', payload: { letter: 'Z' } });
        expect(grown.hand).toHaveLength(full.hand.length + 1);
        expect(grown.hand[full.hand.length]?.letter).toBe('Z');
        expect(gameReducer(s, { type: 'ADD_FREE_TILE', payload: { letter: '7' } })).toBe(s);
    });
    test('its strike goes through ADD_STRIKE, so a shield blocks it', () => {
        const s = start({ activePowerPlays: { strikeShield: true }, activeBuffs: [] });
        const after = gameReducer(s, { type: 'ADD_STRIKE' });
        expect(after.gameState!.strikes).toBe(s.gameState!.strikes);
        const bare = start({ activePowerPlays: {} });
        expect(gameReducer(bare, { type: 'ADD_STRIKE' }).gameState!.strikes).toBe(bare.gameState!.strikes + 1);
    });
});

describe('Tick-Tock Croc (v7.51.0)', () => {
    const croc = charm('tickTockCroc');
    test('the card reads its numbers from config', () => {
        expect(croc.description).toContain(`Every ${TIME_BONUS.crocEvery} words`);
        expect(croc.description).toContain('60% +10 seconds, 40% -300 points');
    });
    test('surfaces on every 25th valid word while equipped, then counts again', () => {
        const gs = { ...screenInitialState.gameState!, activeCharms: [croc], crocWords: 0 } as GameState;
        let opened = 0;
        for (let i = 1; i <= 75; i++) { const m = crocModal(gs); if (m) { opened++; expect(i % 25).toBe(0); expect(m.type).toBe('croc'); } }
        expect(opened).toBe(3);
        const bare = { ...screenInitialState.gameState!, activeCharms: [] } as GameState;
        for (let i = 0; i < 30; i++) expect(crocModal(bare)).toBeNull();
    });
    test('the roll comes in at about 60%', () => {
        const gs = { ...screenInitialState.gameState!, activeCharms: [croc], crocWords: 0 } as GameState;
        let wins = 0, n = 0;
        for (let i = 0; i < 25 * 2000; i++) { const m = crocModal(gs); if (m) { n++; if (m.data?.win) wins++; } }
        expect(wins / n).toBeGreaterThan(0.55); expect(wins / n).toBeLessThan(0.65);
    });
    test('a win adds charm time (at most 10, less at higher levels); a loss bites 300, never below 0', () => {
        const s = { ...start({ score: 1000 }, 30), modalContent: { type: 'croc', title: 'Tick-Tock Croc', data: { win: true } } } as GameScreenState;
        const won = gameReducer(s, { type: 'CROC_RESULT' });
        expect(won.time - s.time).toBe(10);
        expect(won.gameState!.score).toBe(1000);
        expect(won.modalContent?.type).toBe('outcome');
        const lost = gameReducer({ ...s, modalContent: { type: 'croc', title: 'x', data: { win: false } } } as GameScreenState, { type: 'CROC_RESULT' });
        expect(lost.time).toBe(s.time);
        expect(lost.gameState!.score).toBe(700);
        const broke = gameReducer({ ...s, gameState: { ...s.gameState!, score: 120 }, modalContent: { type: 'croc', title: 'x', data: { win: false } } } as GameScreenState, { type: 'CROC_RESULT' });
        expect(broke.gameState!.score).toBe(0);
        expect(gameReducer({ ...s, modalContent: null }, { type: 'CROC_RESULT' })).toEqual({ ...s, modalContent: null });
    });
    test('equipping it starts the count over', () => {
        const s = start({ activeCharms: [], crocWords: 17 });
        const after = gameReducer(s, { type: 'CHOOSE_CHARM', payload: { charm: croc, hand: s.hand, allOffered: [croc] } });
        expect(after.gameState!.crocWords).toBe(0);
    });
});

describe('Greatest Hits (v7.52.0)', () => {
    const w = (word: string, status: 'valid' | 'invalid' = 'valid') => ({ type: 'word', word, status, score: 5, baseScore: 5, bonuses: [], definition: '', cumulativeScore: 5 }) as any;
    test('an N-letter word played N times earns its record, once a run', () => {
        expect(greatestHitFor('TEA', 2, [])).toBeUndefined();
        expect(greatestHitFor('TEA', 3, [])).toMatchObject({ title: 'GOLD', points: 500 });
        expect(greatestHitFor('EAT', 3, [3])).toBeUndefined();          // GOLD already paid
        expect(greatestHitFor('WOOD', 3, [])).toBeUndefined();          // 4 letters needs 4 plays
        expect(greatestHitFor('WOOD', 4, [3])).toMatchObject({ title: 'PLATINUM', points: 1000 });
        expect(greatestHitFor('STONE', 5, [3, 4])).toMatchObject({ title: 'DIAMOND', points: 1500 });
        expect(greatestHitFor('WOOD', 4, [])).toMatchObject({ title: 'PLATINUM' }); // any order
        expect(GREATEST_HITS.tiers.map(t => [t.letters, t.points])).toEqual([[3, 500], [4, 1000], [5, 1500], [6, 2000], [7, 2500], [8, 3000]]);
    });
    test('plays count valid words only, any case', () => {
        expect(playCounts([w('tea'), w('TEA'), w('TEA', 'invalid'), w('EAT')]).get('TEA')).toBe(2);
    });
    test('the chip shows the word closest to an open record, from 2 plays', () => {
        expect(hitInProgress([w('TEA')], [])).toBeNull();
        expect(hitInProgress([w('TEA'), w('TEA')], [])).toMatchObject({ word: 'TEA', plays: 2 });
        expect(hitInProgress([w('TEA'), w('TEA'), w('WOOD'), w('WOOD'), w('WOOD')], [])).toMatchObject({ word: 'WOOD', plays: 3 }); // both 1 away: bigger prize
        expect(hitInProgress([w('TEA'), w('TEA')], [3])).toBeNull();
        expect(nextHit([3])?.title).toBe('PLATINUM');
        expect(ordinal(3)).toBe('3rd'); expect(ordinal(4)).toBe('4th'); expect(ordinal(22)).toBe('22nd');
    });
});

describe('Psychic Friends Network: Call It! (v7.54.0)', () => {
    test('fires on pick, pays a prize that grows with level, and lists every call', () => {
        const p = pp('psychicFriends');
        expect(INSTANT_POWER_PLAY_IDS.has('psychicFriends')).toBe(true);
        expect(PRIZE_POWER_PLAY_IDS.has('psychicFriends')).toBe(true);
        expect(GAMBLE_CARD_IDS).toContain('psychicFriends');
        expect(p.description).toContain('3 letters +50, 4 letters +100, 5 letters +250, 6 letters +500, 7+ letters +1,500');
        expect(MYSTERY_TAPE.pool).not.toContain('psychicFriends'); // a bet never hides in a Mystery Tape
    });
    test('the old tile peek is gone: arming from the pocket no longer sets a word countdown', () => {
        const s = start({ availablePowerPlays: [pp('psychicFriends')] });
        const next = gameReducer(s, { type: 'ACTIVATE_POWER_PLAY', payload: pp('psychicFriends') });
        expect(next.gameState!.activePowerPlays.psychicFriends).not.toEqual({ words: 8 });
    });
});

describe('Blue Steel (v7.57.0)', () => {
    test('ZOO four times arms x5 on the next word, once a run', () => {
        expect(BLUE_STEEL).toMatchObject({ word: 'ZOO', plays: 4, multiplier: 5 });
        expect(screenInitialState.gameState!.blueSteelDone).toBe(false);
        expect(POST_WORD_MODALS).toContain('blue-steel');
    });
    test('the badge is a run reward, never sold', () => {
        const badge = COSMETICS.find(c => c.id === BLUE_STEEL.badgeId)!;
        expect(badge).toMatchObject({ kind: 'badge', icon: '💙', earnedBy: 'zoo' });
        expect(badge.cost).toBeUndefined();
        expect(badge.id).toMatch(/^b_[A-Za-z]+$/);
    });
});

describe('Quack Attack (v7.54.0)', () => {
    test('QUA four times; the next 4 words score x4, charm points included', () => {
        expect(QUACK_ATTACK).toMatchObject({ word: 'QUA', plays: 4, multiplier: 4, words: 4 });
        const gs = { ...start({}).gameState!, activePowerPlays: { quackAttack: { words: 4 } } } as GameState;
        // Plain tiles: createTile makes a random x2 tile 15% of the time, which made this test flaky.
        const tiles = ['C', 'A', 'T'].map(l => ({ ...gameUtils.createTile(l), multiplier: undefined, isSuper: false }));
        const plain = calculateScore('CAT', tiles, { ...gs, activePowerPlays: {} } as GameState);
        const quack = calculateScore('CAT', tiles, gs);
        expect(quack.bonuses.some(b => b.name === '🦆 Quack Attack' && b.description === 'x4 Word Score')).toBe(true);
        expect(quack.totalScore).toBeGreaterThanOrEqual(plain.totalScore * 3);
        expect(ITEM_MULTIPLIER_LINES).toContain('🦆 Quack Attack');
    });
    test('once a run: every new run starts with it unused', () => {
        expect(screenInitialState.gameState!.quackDone).toBe(false);
    });
    test('the Quack Pack badge is a run reward, never sold', () => {
        const badge = COSMETICS.find(c => c.id === QUACK_ATTACK.badgeId)!;
        expect(badge).toMatchObject({ kind: 'badge', icon: '🦆', earnedBy: 'quack' });
        expect(badge.cost).toBeUndefined();
    });
});

describe('CTU Safe House clock rescue (v7.67)', () => {
    const ctu = CHARMS_LIST.find(c => c.id === 'ctuSafeHouse')!;
    test('under 10 seconds it adds 15 once a level; not above the line, not twice, not without the charm', () => {
        const s = start({ activeCharms: [ctu] }, 8);
        const saved = gameReducer(s, { type: 'CTU_RESCUE' });
        expect(saved.time).toBe(8 + TIME_BONUS.ctuSafeHouse);
        expect(saved.gameState!.ctuLevel).toBe(1);
        // Once a level: dropping under the line again on the same level does nothing.
        const again = gameReducer({ ...saved, time: 5 }, { type: 'CTU_RESCUE' });
        expect(again.time).toBe(5);
        expect(gameReducer(start({ activeCharms: [ctu] }, 12), { type: 'CTU_RESCUE' }).time).toBe(12);
        expect(gameReducer(start({ activeCharms: [] }, 8), { type: 'CTU_RESCUE' }).time).toBe(8);
        expect(gameReducer(start({ activeCharms: [ctu] }, 0), { type: 'CTU_RESCUE' }).time).toBe(0);
    });
    test('the family charms pay flat points', () => {
        expect(CHARM_BONUS.nicolesGrace).toBe(75);
        expect(CHARM_BONUS.christiansHoodie).toBe(40);
        expect(CHARM_BONUS.lena).toBe(25);
        const lena = CHARMS_LIST.find(c => c.id === 'lenaOfTheLostLights')!;
        expect(lena.description).toContain(`+${CHARM_BONUS.lena} points`);
        expect(lena.description).not.toContain('%');
    });
});
