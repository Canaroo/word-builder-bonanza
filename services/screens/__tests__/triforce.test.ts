import { describe, test, expect } from 'vitest';
import { gameReducer, screenInitialState, dealShard, type GameScreenState } from '../GameScreen';
import * as gameUtils from '../../gameUtils';
import { RACK_SIZE } from '../../../constants';
import { TRIFORCE } from '../../../config/gameplay';
import { CHARMS_LIST } from '../../../data/charms';
import { shardCharm, triforceDone, SHARD_CHARMS } from '../../../data/triforce';
import type { GameState } from '../../../types';

// Fragile charms (v7.69.0): Triforce shards from charm offers, 3 assemble a piece.
const start = (overrides: Partial<GameState> = {}, time = 40): GameScreenState => {
    const { hand, tileBag } = gameUtils.dealNewHand(gameUtils.createTileBag());
    const padded = Array(RACK_SIZE).fill(null); hand.forEach((t, i) => (padded[i] = t));
    return { ...screenInitialState, hand: padded, tileBag, time, isLoading: false, gameState: { ...screenInitialState.gameState, ...overrides } };
};
const take = (s: GameScreenState, id: 'power' | 'wisdom' | 'courage') =>
    gameReducer(s, { type: 'CHOOSE_CHARM', payload: { charm: shardCharm(id), hand: s.hand, allOffered: [CHARMS_LIST[0], shardCharm(id)] } });

describe('fragile charms: the Triforce (v7.69.0)', () => {
    test('shards are never equipped and never need a slot, even with all 5 slots full', () => {
        const full = start({ activeCharms: CHARMS_LIST.slice(0, 5) });
        const next = take(full, 'power');
        expect(next.gameState.triforce?.power).toBe(1);
        expect(next.gameState.activeCharms).toHaveLength(5);
        expect(next.gameState.activeCharms.some(c => c.fragile)).toBe(false);
    });
    test('the third shard assembles the piece and queues its card; all three grant the wish once', () => {
        let s = start({ triforce: { power: 2 } });
        s = take(s, 'power');
        expect(triforceDone(s.gameState, 'power')).toBe(true);
        expect(s.modalQueue.at(-1)).toMatchObject({ type: 'triforce', data: { got: 'power', wish: false } });
        s = start({ triforce: { power: 3, wisdom: 3, courage: 2 }, score: 1000 });
        s = take(s, 'courage');
        expect(s.gameState.score).toBe(1000 + TRIFORCE.wishPoints);
        expect(s.gameState.triforceWish).toBe(true);
    });
    test('offers: a started piece brings its next shard about 40% of the time, a fresh one about 30%', () => {
        const offer = { offeredItems: CHARMS_LIST.slice(0, 3), offerDetails: CHARMS_LIST.slice(0, 3).map(c => ({ id: c.id, score: 1 })) };
        let next = 0, first = 0; const n = 4000;
        for (let i = 0; i < n; i++) {
            if (dealShard(offer, { triforce: { wisdom: 1 }, runSeed: 777, totalOffersMade: i }).offeredItems[2].fragile === 'wisdom') next++;
            if (dealShard(offer, { triforce: {}, runSeed: 777, totalOffersMade: i }).offeredItems[2].fragile) first++;
        }
        // Started: the next shard 40%, else (60%) a fresh piece's first shard 30% of those.
        expect(next / n).toBeGreaterThan(0.35); expect(next / n).toBeLessThan(0.45);
        expect(first / n).toBeGreaterThan(0.25); expect(first / n).toBeLessThan(0.35);
        // A finished piece never offers more shards.
        for (let i = 0; i < 300; i++) expect(dealShard(offer, { triforce: { power: 3, wisdom: 3, courage: 3 }, runSeed: 5, totalOffersMade: i }).offeredItems.some(c => c.fragile)).toBe(false);
    });
    test('Courage blocks one strike a level', () => {
        const s = start({ triforce: { courage: 3 }, strikes: 0 });
        const once = gameReducer(s, { type: 'ADD_STRIKE' });
        expect(once.gameState.strikes).toBe(0);
        expect(gameReducer(once, { type: 'ADD_STRIKE' }).gameState.strikes).toBe(1);
    });
    test('Courage turns the clock hitting 0 into seconds, once a level', () => {
        const s = start({ triforce: { courage: 3 } }, 0);
        const saved = gameReducer(s, { type: 'COURAGE_CLOCK' });
        expect(saved.time).toBeGreaterThan(0);
        expect(gameReducer({ ...saved, time: 0 }, { type: 'COURAGE_CLOCK' }).time).toBe(0);
    });
    test('the old Triforce of Courage charm is now Master Sword, and shard ids never clash with charms', () => {
        expect(CHARMS_LIST.find(c => c.id === 'triforceOfCourage')!.name).toBe('Master Sword');
        for (const sh of SHARD_CHARMS) expect(CHARMS_LIST.some(c => c.id === sh.id)).toBe(false);
    });
});

describe('shards from scratch-off tickets and Lucky Charms (v7.69.1)', () => {
    test('about 1 ticket in 3 has a shard square, never more than one, and none once all are finished', async () => {
        const { dealScratch } = await import('../../scratch');
        let withShard = 0; const n = 5000;
        for (let i = 0; i < n; i++) {
            const t = dealScratch(Math.random, { heldCharmIds: [], slotOpen: true, pocketEmpty: true, shard: 'power' });
            const shards = t.filter(s => s.kind === 'shard').length;
            expect(shards).toBeLessThanOrEqual(1);
            if (shards) withShard++;
        }
        expect(withShard / n).toBeGreaterThan(0.28); expect(withShard / n).toBeLessThan(0.4);
        const { shardFor } = await import('../../../data/triforce');
        expect(shardFor({ triforce: { power: 3, wisdom: 3, courage: 3 } })).toBeNull();
        expect(shardFor({ triforce: { power: 1 } })).toBe('power'); // a started piece comes first
    });
    test('banking a shard square adds it to the shelf; the third opens the assembled card', () => {
        const s = start({ triforce: { wisdom: 1 } });
        const one = gameReducer({ ...s, modalContent: { type: 'scratch', title: 'x' } } as GameScreenState, { type: 'SCRATCH_RESULT', payload: { prize: { kind: 'shard', id: 'wisdom' } } });
        expect(one.gameState.triforce?.wisdom).toBe(2);
        expect(one.modalContent?.type).toBe('outcome');
        const two = gameReducer(one, { type: 'SCRATCH_RESULT', payload: { prize: { kind: 'shard', id: 'wisdom' } } });
        expect(triforceDone(two.gameState, 'wisdom')).toBe(true);
        expect(two.modalContent).toMatchObject({ type: 'triforce', data: { got: 'wisdom' } });
    });
    test('Lucky Charms says shards can fall out', async () => {
        const { POWER_PLAYS_LIST } = await import('../../../data/powerPlays');
        expect(POWER_PLAYS_LIST.find(p => p.id === 'luckyCharms')!.description).toContain('Triforce shard');
    });
});

describe('fragile charms shatter on any invalid word or strike (v7.70.0)', () => {
    const c = (id: string) => CHARMS_LIST.find(x => x.id === id)!;
    test('a strike shatters every fragile charm held, and they never come back this run', () => {
        const s = start({ activeCharms: [c('glassJoe'), c('crystalBall'), c('stonks')], activeBuffs: [c('glassJoe'), c('crystalBall'), c('stonks')] });
        const hit = gameReducer(s, { type: 'ADD_STRIKE' });
        expect(hit.gameState.activeCharms.map(x => x.id)).toEqual(['stonks']);
        expect(hit.gameState.shatteredCharms).toEqual(expect.arrayContaining(['glassJoe', 'crystalBall']));
        expect(hit.modalContent?.type).toBe('outcome');
    });
    test('nothing protects them: a shield blocks the strike, but the charm still shatters', () => {
        const s = start({ activeCharms: [c('majorAward')], activePowerPlays: { strikeShield: true }, strikes: 0 });
        const hit = gameReducer(s, { type: 'ADD_STRIKE' });
        expect(hit.gameState.strikes).toBe(0);               // the shield did its job
        expect(hit.gameState.activeCharms).toHaveLength(0);  // the charm didn't survive
    });
    test('the Triforce of Courage and Happy Little Accidents do not save them either', () => {
        const courage = gameReducer(start({ activeCharms: [c('glassJoe')], triforce: { courage: 3 } }), { type: 'ADD_STRIKE' });
        expect(courage.gameState.strikes).toBe(0);
        expect(courage.gameState.activeCharms).toHaveLength(0);
        const accident = gameReducer(start({ activeCharms: [c('glassJoe'), c('happyLittleAccidents')] }), { type: 'ADD_STRIKE', payload: { source: 'invalid_word' } });
        expect(accident.gameState.activeCharms.map(x => x.id)).toEqual(['happyLittleAccidents']);
    });
    test('descriptions say it plainly', () => {
        for (const id of ['glassJoe', 'majorAward', 'crystalBall']) expect(c(id).description).toContain('Nothing protects it');
        expect(c('glassJoe').description).toContain(`x${2}`);
    });
});

describe('Triforce of Wisdom: ask Zelda (v7.72.0)', () => {
    const withTiles = (overrides: Partial<GameState> = {}) => {
        const s = start({ triforce: { wisdom: 3 }, ...overrides });
        const letters = 'STAREXQZ'.split('');
        const hand = s.hand.map((t, i) => (i < 8 ? { ...(t as any), id: `t${i}`, letter: letters[i] } : t));
        return { ...s, hand } as GameScreenState;
    };
    test('places the tiles in spelling order in the word row and is spent for the level', () => {
        const s = withTiles();
        const next = gameReducer(s, { type: 'ZELDA_PLACE', payload: { word: 'RATES', tileIds: ['t3', 't2', 't1', 't4', 't0'] } });
        expect(next.buildRow.filter(Boolean).map(b => b!.tile.letter).join('')).toBe('RATES');
        expect(next.hand.filter(Boolean)).toHaveLength(3);
        expect(next.gameState.wisdomLevel).toBe(1);
        const again = gameReducer(next, { type: 'ZELDA_PLACE', payload: { word: 'STAR', tileIds: ['t0', 't1', 't2', 't3'] } });
        expect(again).toBe(next);
    });
    test('tiles already in the word row go back first', () => {
        let s = withTiles();
        s = gameReducer(s, { type: 'MOVE_TILE_TO_BUILD', payload: { tile: s.hand[7]!, fromIndex: 7 } });
        const next = gameReducer(s, { type: 'ZELDA_PLACE', payload: { word: 'STAR', tileIds: ['t0', 't1', 't2', 't3'] } });
        expect(next.buildRow.filter(Boolean).map(b => b!.tile.letter).join('')).toBe('STAR');
        expect(next.hand.some(t => t?.id === 't7')).toBe(true);
    });
    test('does nothing without the piece', () => {
        const s = withTiles({ triforce: { wisdom: 2 } });
        expect(gameReducer(s, { type: 'ZELDA_PLACE', payload: { word: 'STAR', tileIds: ['t0', 't1', 't2', 't3'] } })).toBe(s);
    });
});
