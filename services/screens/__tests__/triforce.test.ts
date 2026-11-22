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
