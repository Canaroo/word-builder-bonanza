// @vitest-environment jsdom
// v7.42: Last Words, Head Start, Skill Shot and Gem Tiles.
import { describe, test, expect, beforeEach } from 'vitest';
import { gameReducer, screenInitialState, createInitialGameState, type GameScreenState } from '../GameScreen';
import { GEM_TILES, HEAD_START, SKILL_SHOT } from '../../../config/gameplay';
import { gemMultiplierFor, skillShotPoints } from '../../rules';
import { headStartSeconds, headStartFor, recordRunForHeadStart } from '../../headStart';
import { RACK_SIZE } from '../../../constants';
import type { GameState, Tile } from '../../../types';

const tile = (letter: string, i: number, extra: Partial<Tile> = {}): Tile => ({ id: `${letter}-${i}`, letter, points: 1, ...extra });
const handOf = (letters: string): (Tile | null)[] => {
    const h: (Tile | null)[] = Array(RACK_SIZE).fill(null);
    [...letters].forEach((l, i) => (h[i] = tile(l, i)));
    return h;
};
const start = (overrides: Partial<GameState> = {}, screen: Partial<GameScreenState> = {}): GameScreenState =>
    ({ ...screenInitialState, time: 40, isLoading: false, hand: handOf('TOURSAEP'), ...screen, gameState: { ...screenInitialState.gameState, ...overrides } });

describe('Last Words', () => {
    test('the first ending opens the card once, with the word row back in the hand', () => {
        const s = start({ strikes: 3 }, { hand: handOf('TOURSA'), buildRow: [{ tile: tile('E', 6), originalIndex: 6 }, ...Array(7).fill(null)] });
        const after = gameReducer(s, { type: 'END_RUN', payload: { reason: 'strikes' } });
        expect(after.modalContent?.type).toBe('last-words');
        expect(after.modalContent?.data.reason).toBe('strikes');
        expect(after.gameState.lastWordsDone).toBe(true);
        expect(after.isPaused).toBe(true);
        expect(after.hand.filter(Boolean)).toHaveLength(7);
        expect(after.buildRow.every(b => b === null)).toBe(true);
        expect(after.gameState.log.some(e => e.type === 'game_over')).toBe(false);
    });
    test('a second ending, or a hand too small for a word, goes straight to Game Over', () => {
        const done = gameReducer(start({ lastWordsDone: true }), { type: 'END_RUN', payload: { reason: 'time' } });
        expect(done.modalContent?.type).toBe('game-over-summary');
        expect(done.gameState.endReason).toBe('time');
        const tiny = gameReducer(start({}, { hand: handOf('QZ') }), { type: 'END_RUN', payload: { reason: 'time' } });
        expect(tiny.modalContent?.type).toBe('game-over-summary');
    });
});

describe('Head Start', () => {
    beforeEach(() => localStorage.clear());
    test('early endings add seconds up to the cap, and a good run clears them', () => {
        expect(headStartSeconds()).toBe(0);
        expect(recordRunForHeadStart(1)).toBe(HEAD_START.perRun);
        expect(recordRunForHeadStart(HEAD_START.untilLevel - 1)).toBe(HEAD_START.perRun * 2);
        for (let i = 0; i < 10; i++) recordRunForHeadStart(2);
        expect(headStartSeconds()).toBe(HEAD_START.max);
        expect(recordRunForHeadStart(HEAD_START.untilLevel)).toBe(0);
        expect(headStartSeconds()).toBe(0);
    });
    test('the ladder', () => {
        expect([0, 1, 2, 3, 4, 5, 6].map(headStartFor)).toEqual([0, 3, 6, 9, 12, 15, 15]);
    });
});

describe('Skill Shot', () => {
    test('a new run starts with no lit tile and no streak, and the first one waits for level 2', () => {
        expect(createInitialGameState().skillShot).toBeNull();
        expect(SKILL_SHOT.fromLevel).toBe(2);
    });
    test('pays more for each level in a row, up to the cap', () => {
        expect(skillShotPoints(0)).toBe(0);
        expect(skillShotPoints(1)).toBe(SKILL_SHOT.base);
        expect(skillShotPoints(2)).toBe(SKILL_SHOT.base + SKILL_SHOT.step);
        expect(skillShotPoints(99)).toBe(SKILL_SHOT.max);
    });
});

describe('Gem Tiles', () => {
    test('only long words earn a gem, bigger for longer', () => {
        expect([3, 5, 6, 7, 8, 11].map(n => gemMultiplierFor(n))).toEqual([0, 0, GEM_TILES[6], GEM_TILES[7], GEM_TILES[8], GEM_TILES[8]]);
    });
    test('a waiting gem lands on one plain tile at the next round, never on a special tile', () => {
        const hand = handOf('TOURSAEP');
        hand[0] = tile('T', 0, { multiplier: 2 });
        hand[1] = tile('QU', 1, { isCombo: true });
        const after = gameReducer(start({ pendingGem: 4 }, { hand }), { type: 'START_NEXT_ROUND' });
        const gems = after.hand.filter(t => t?.isGem);
        expect(gems).toHaveLength(1);
        expect(gems[0]!.multiplier).toBe(4);
        expect(['T-0', 'QU-1']).not.toContain(gems[0]!.id);
        expect(after.gameState.pendingGem).toBe(0);
        expect(after.hand.find(t => t?.id === 'T-0')!.multiplier).toBe(2);
    });
    test('no gem waiting, no gem', () => {
        const after = gameReducer(start(), { type: 'START_NEXT_ROUND' });
        expect(after.hand.some(t => t?.isGem)).toBe(false);
    });
});
