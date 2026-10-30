// @vitest-environment jsdom
// Keep-or-swap must work for every PowerPlay and every charm, not just the ones we tried by hand.
import { describe, test, expect, vi, afterEach } from 'vitest';
import { gameReducer, screenInitialState, type GameScreenState } from '../GameScreen';
import { POWER_PLAYS_LIST, INSTANT_POWER_PLAY_IDS } from '../../../data/powerPlays';
import { CHARMS_LIST } from '../../../data/charms';
import { CHARM_SLOTS } from '../../../config/gameplay';
import * as gameUtils from '../../gameUtils';
import { RACK_SIZE } from '../../../constants';
import type { GameState } from '../../../types';

afterEach(() => vi.restoreAllMocks());

const start = (overrides: Partial<GameState> = {}): GameScreenState => {
    const { hand, tileBag } = gameUtils.dealNewHand(gameUtils.createTileBag());
    const padded = Array(RACK_SIZE).fill(null);
    hand.forEach((t, i) => (padded[i] = t));
    return { ...screenInitialState, hand: padded, tileBag, time: 40, isLoading: false, gameState: { ...screenInitialState.gameState, ...overrides } };
};

describe('PowerPlay keep-or-swap, every PowerPlay', () => {
    const others = POWER_PLAYS_LIST.filter(p => !INSTANT_POWER_PLAY_IDS.has(p.id));
    test.each(POWER_PLAYS_LIST.map(p => [p.id, p] as const))('choosing %s while holding another', (_id, pp) => {
        const held = others.find(o => o.id !== pp.id)!;
        const s = start({ availablePowerPlays: [held] });
        const after = gameReducer(s, { type: 'CHOOSE_POWER_PLAY', payload: { powerPlay: pp, allOffered: [pp] } });
        const ids = after.gameState.availablePowerPlays.map(p => p.id);
        // Any pick swaps the held one out; instant ones fire instead of going in the pocket.
        expect(ids).toEqual(INSTANT_POWER_PLAY_IDS.has(pp.id) ? [] : [pp.id]);
        expect(after.gameState.log.some(e => e.type === 'event' && e.name === 'PowerPlay Swap')).toBe(true);
        if (!INSTANT_POWER_PLAY_IDS.has(pp.id)) expect(after.gameState.lastPowerPlayResult?.message).toContain(`${held.name} out`);
    });

    test('keeping leaves the held one', () => {
        const held = others[0];
        const after = gameReducer(start({ availablePowerPlays: [held] }), { type: 'KEEP_POWER_PLAY', payload: { allOffered: [others[1]] } });
        expect(after.gameState.availablePowerPlays.map(p => p.id)).toEqual([held.id]);
    });
});

describe('Charm swap, every charm', () => {
    test.each(CHARMS_LIST.map(c => [c.id, c] as const))('swapping %s into full slots', (_id, charm) => {
        const five = CHARMS_LIST.filter(c => c.id !== charm.id).slice(0, CHARM_SLOTS);
        const s = start({ activeCharms: five, activeBuffs: [...five] });
        const out = five[2];
        const after = gameReducer(s, { type: 'CHOOSE_CHARM', payload: { charm, hand: s.hand, allOffered: [charm], replaceId: out.id } });
        const ids = after.gameState.activeCharms.map(c => c.id);
        expect(ids).toContain(charm.id);
        expect(ids).not.toContain(out.id);
        expect(ids).toHaveLength(CHARM_SLOTS);
        expect(after.gameState.activeBuffs.map(b => b.id)).not.toContain(out.id);
        expect(after.gameState.log.some(e => e.type === 'event' && e.name === 'Charm Swap')).toBe(true);
    });
});

test('Heisenberg swapped for Time Turner: Time Turner fires and Heisenberg is gone', () => {
    const held = POWER_PLAYS_LIST.find(p => p.id === 'heisenberg')!;
    const timeTurner = POWER_PLAYS_LIST.find(p => p.id === 'timeTurner')!;
    const after = gameReducer(start({ availablePowerPlays: [held] }), { type: 'CHOOSE_POWER_PLAY', payload: { powerPlay: timeTurner, allOffered: [timeTurner] } });
    expect(after.gameState.availablePowerPlays).toEqual([]);
    expect(after.gameState.activePowerPlays.timeTurner).toBeTruthy();
    expect(after.gameState.lastPowerPlayResult?.message).toContain('Heisenberg was swapped out');
});

describe('Once-per-run PowerPlays', () => {
    const get = (id: string) => POWER_PLAYS_LIST.find(p => p.id === id)!;
    const choose = (s: GameScreenState, id: string) => gameReducer(s, { type: 'CHOOSE_POWER_PLAY', payload: { powerPlay: get(id), allOffered: [get(id)] } });

    test('exactly the run-saving ones are flagged', () => {
        expect(POWER_PLAYS_LIST.filter(p => p.oncePerRun).map(p => p.id).sort())
            .toEqual(['chubbsPepTalk', 'continueScreen', 'deepFreeze', 'groundhogsDay', 'happyPlace', 'lifeFindsAWay', 'rewind', 'sliders', 'timeTurner', 'whoYouGonnaCall']);
    });

    test('taking one marks it spent for the run, even after it is used up', () => {
        const after = choose(start(), 'happyPlace');
        expect(after.gameState.oncePerRunTaken).toEqual(['happyPlace']);
        const used = { ...after, gameState: { ...after.gameState, availablePowerPlays: [] } };
        expect(choose(used, 'biglyScore').gameState.oncePerRunTaken).toEqual(['happyPlace']);
    });

    test('swapping one away unused lets it come back', () => {
        const holding = choose(start(), 'happyPlace');
        expect(choose(holding, 'biglyScore').gameState.oncePerRunTaken).toEqual([]);
    });

    test('an instant once-per-run pick is spent, and the one it swapped out (unused) is freed', () => {
        const holding = choose(start(), 'whoYouGonnaCall');
        const after = choose(holding, 'lifeFindsAWay');
        expect(after.gameState.oncePerRunTaken).toEqual(['lifeFindsAWay']);
        expect(after.gameState.availablePowerPlays).toEqual([]);
    });
});
