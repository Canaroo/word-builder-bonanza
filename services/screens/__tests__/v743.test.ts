// @vitest-environment jsdom
// v7.43: Grudge Match, Fork in the Road and the Hold Slot.
import { describe, test, expect, beforeEach } from 'vitest';
import { gameReducer, screenInitialState, POST_WORD_MODALS, type GameScreenState } from '../GameScreen';
import { SCRATCH, GRUDGE, HOLD_SLOT } from '../../../config/gameplay';
import { grudgeFor, grudgeTaunt, recordBossResult } from '../../grudges';
import { BOSSES } from '../../../data/bosses';
import { CHARMS_LIST } from '../../../data/charms';
import { RACK_SIZE } from '../../../constants';
import type { GameState, Tile } from '../../../types';

const tile = (letter: string, i: number): Tile => ({ id: `${letter}-${i}`, letter, points: 1 });
const handOf = (letters: string): (Tile | null)[] => {
    const h: (Tile | null)[] = Array(RACK_SIZE).fill(null);
    [...letters].forEach((l, i) => (h[i] = tile(l, i)));
    return h;
};
const HOLD = CHARMS_LIST.find(c => c.id === HOLD_SLOT.charmId)!;
const start = (overrides: Partial<GameState> = {}, screen: Partial<GameScreenState> = {}): GameScreenState =>
    ({ ...screenInitialState, time: 40, isLoading: false, hand: handOf('TOURSAEP'), ...screen, gameState: { ...screenInitialState.gameState, activeCharms: [HOLD], ...overrides } });

describe('Grudge Match', () => {
    beforeEach(() => localStorage.clear());
    const boss = BOSSES[0];
    test('a boss that gets away builds a streak; a win settles it', () => {
        expect(grudgeFor(boss.id).streak).toBe(0);
        recordBossResult(boss.id, 'escaped');
        expect(recordBossResult(boss.id, 'close')).toMatchObject({ faced: 2, won: 0, streak: 2, settled: 0 });
        expect(recordBossResult(boss.id, 'won')).toMatchObject({ faced: 3, won: 1, streak: 0, settled: 1 });
        // A plain win (no grudge) settles nothing.
        expect(recordBossResult(boss.id, 'won')).toMatchObject({ won: 2, settled: 1 });
        expect(grudgeFor(BOSSES[1].id).faced).toBe(0);
    });
    test('the taunt names the player, the record, and a real number from the run', () => {
        const career = { runs: 3, totalScore: 9000, highestLevel: 5, bestWord: 'RARE', bestWordScore: 200, longestWord: '', since: 1 };
        const run = { words: ['CAT', 'DOG', 'SUN', 'TOE', 'ARE', 'TEA', 'PLANT'], strikes: 0, level: 3 };
        const line = grudgeTaunt(boss, { faced: 2, won: 0, streak: 2, settled: 0 }, run, 'NICOLE', career);
        expect(line).toContain('NICOLE');
        expect(line).toContain('twice');
        expect(line).toContain('never beaten me');
        expect(line).toMatch(/86% of your words|PLANT|level 5/);
        // Same boss and streak: same line. Every boss has something to say even with no data.
        expect(grudgeTaunt(boss, { faced: 2, won: 0, streak: 2, settled: 0 }, run, 'NICOLE', career)).toBe(line);
        for (const b of BOSSES) expect(grudgeTaunt(b, { faced: 1, won: 0, streak: 1, settled: 0 }, { words: [], strikes: 0, level: 3 }, '', { ...career, runs: 0, highestLevel: 0 }).length).toBeGreaterThan(20);
    });
    test('double is the multiplier', () => expect(GRUDGE.multiplier).toBe(2));
});

describe('Scratch-off ticket (v7.66.0, where the Fork was)', () => {
    test('tickets sit on tier starts, never on a boss level, and the card continues the round', () => {
        expect([...SCRATCH.levels]).toEqual([4, 7, 11]);
        for (const l of SCRATCH.levels) expect(l % 3).not.toBe(0);
        expect(POST_WORD_MODALS).toContain('scratch');
    });
});

describe('Hold Slot', () => {
    test('a parked tile leaves the hand, survives a new hand, and comes back to a free slot', () => {
        const s = start();
        const t = s.hand[4]!;
        const held = gameReducer(s, { type: 'HOLD_STASH', payload: { tile: t, fromIndex: 4 } });
        expect(held.hand[4]).toBeNull();
        expect(held.gameState.holdTile?.id).toBe(t.id);
        // A second tile can't be parked on top of it.
        expect(gameReducer(held, { type: 'HOLD_STASH', payload: { tile: held.hand[0]!, fromIndex: 0 } })).toBe(held);
        const dealt = gameReducer(held, { type: 'RESET_ROUND', payload: { hand: handOf('QZXJKVWY'), tileBag: [] } });
        expect(dealt.gameState.holdTile?.id).toBe(t.id);
        const back = gameReducer(dealt, { type: 'HOLD_RETURN' });
        expect(back.gameState.holdTile).toBeNull();
        expect(back.hand.filter(Boolean)).toHaveLength(9);
        expect(back.hand.some(x => x?.id === t.id)).toBe(true);
    });
    test('no room, no return; the wrong tile is ignored', () => {
        const full = start({ holdTile: tile('S', 99) }, { hand: handOf('ABCDEFGHIJ') });
        expect(gameReducer(full, { type: 'HOLD_RETURN' })).toBe(full);
        const s = start();
        expect(gameReducer(s, { type: 'HOLD_STASH', payload: { tile: tile('Z', 50), fromIndex: 0 } })).toBe(s);
    });
    test('the held tile joins the final hand for Last Words', () => {
        const s = start({ holdTile: tile('S', 99) }, { hand: handOf('TOUR') });
        const after = gameReducer(s, { type: 'END_RUN', payload: { reason: 'time' } });
        expect(after.modalContent?.type).toBe('last-words');
        expect(after.hand.some(t => t?.id === 'S-99')).toBe(true);
        expect(after.gameState.holdTile).toBeNull();
    });
    test('it comes from a charm: no charm, no parking', () => {
        const without = start({ activeCharms: [] });
        expect(gameReducer(without, { type: 'HOLD_STASH', payload: { tile: without.hand[0]!, fromIndex: 0 } })).toBe(without);
        expect(CHARMS_LIST.some(c => c.id === HOLD_SLOT.charmId)).toBe(true);
    });
    test('swapping the charm out hands the parked tile back', () => {
        const hold = CHARMS_LIST.find(c => c.id === HOLD_SLOT.charmId)!;
        const other = CHARMS_LIST.find(c => c.id === 'oneRing')!;
        const s = start({ activeCharms: [hold], activeBuffs: [hold], holdTile: tile('Q', 77) }, { hand: handOf('TOUR') });
        const after = gameReducer(s, { type: 'CHOOSE_CHARM', payload: { charm: other, hand: s.hand, allOffered: [other], replaceId: hold.id } });
        expect(after.gameState.holdTile).toBeNull();
        expect(after.hand.some(t => t?.id === 'Q-77')).toBe(true);
        expect(after.gameState.activeCharms.map(c => c.id)).toEqual(['oneRing']);
    });
});

describe('boss fights in the event log (v7.44.7)', () => {
    test('a run that ends mid-fight logs how the fight stood', () => {
        const boss = BOSSES[0];
        const s = start({ boss: { id: boss.id, number: 1, wordsLeft: 3, hits: 2 }, score: 500 });
        const after = gameReducer(s, { type: 'GAME_OVER_INITIATED', payload: { reason: 'time' } });
        const entry = after.gameState.log.find(e => e.type === 'event' && e.name === `${boss.name} was still standing`) as any;
        expect(entry).toBeTruthy();
        expect(entry.description).toContain('2/6 hits, 3 words left');
        // It sits just before the game-over line.
        expect(after.gameState.log[after.gameState.log.length - 1].type).toBe('game_over');
    });
    test('no fight, no extra line', () => {
        const after = gameReducer(start(), { type: 'GAME_OVER_INITIATED', payload: { reason: 'time' } });
        expect(after.gameState.log.some(e => e.type === 'event' && /still standing/.test((e as any).name))).toBe(false);
    });
});
