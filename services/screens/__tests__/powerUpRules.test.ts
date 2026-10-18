// @vitest-environment jsdom
// Charm slots, PowerPlay keep-or-swap, and the PowerPlays/charms added or moved in v6.8.
import { describe, test, expect, vi, afterEach } from 'vitest';
import { gameReducer, screenInitialState, maxStrikesFor, type GameScreenState } from '../GameScreen';
import { POWER_PLAYS_LIST } from '../../../data/powerPlays';
import { CHARMS_LIST } from '../../../data/charms';
import { CHARM_SLOTS, GAMEPLAY, POWER_GLOVE_BANK_MAX } from '../../../config/gameplay';
import { calculateScore } from '../../gameUtils';
import * as gameUtils from '../../gameUtils';
import { RACK_SIZE } from '../../../constants';
import type { GameState, Tile } from '../../../types';

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

    test('a paid shuffle costs 3s, a free one costs nothing, and it never empties the clock', () => {
        expect(shuffle(start({}, 40)).time).toBe(40 - GAMEPLAY.timeBank.shuffleCost);
        expect(shuffle(start({}, 40), true).time).toBe(40);
        expect(shuffle(start({}, 2)).time).toBe(1);
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

    test('an instant one fires and you keep what you hold', () => {
        const s = start({ availablePowerPlays: [pp('biglyScore')] });
        const after = gameReducer(s, { type: 'CHOOSE_POWER_PLAY', payload: { powerPlay: pp('wildcardWake'), allOffered: [pp('wildcardWake')] } });
        expect(after.gameState.availablePowerPlays.map(p => p.id)).toEqual(['biglyScore']);
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

    test('Konami Code x2, Ludicrous Speed x3, Combo Breaker x5 on 6+ letters', () => {
        expect(calculateScore('cat', tiles('CAT'), state({ konamiCode: { words: 3 } })).totalScore).toBe(6);
        expect(calculateScore('cat', tiles('CAT'), state({ ludicrousSpeed: { words: 3 } })).totalScore).toBe(9);
        // 6 letters: length x2 + Combo Breaker x5 = x7
        expect(calculateScore('carton', tiles('CARTON'), state({ comboBreaker: true })).totalScore).toBe(42);
        expect(calculateScore('cat', tiles('CAT'), state({ comboBreaker: true })).totalScore).toBe(3); // zeroed later, in the turn
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
