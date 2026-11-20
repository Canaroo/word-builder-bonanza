import { describe, test, expect } from 'vitest';
import { gameReducer, screenInitialState, type GameScreenState } from '../GameScreen';
import { CHARM_SETS, setPayFor, payingSets, leadingSet } from '../../../data/charmSets';
import { POWER_PLAYS_LIST } from '../../../data/powerPlays';
import { CHARM_SET_BONUS, MYSTERY_TAPE } from '../../../config/gameplay';
import { prizeFor, powerWordInfo } from '../../rules';
import type { GameState, PowerPlay } from '../../../types';

const start = (overrides: Partial<GameState> = {}): GameScreenState =>
    ({ ...screenInitialState, time: 40, isLoading: false, gameState: { ...screenInitialState.gameState, ...overrides } });
const pp = (id: string): PowerPlay => POWER_PLAYS_LIST.find(p => p.id === id)!;
const trio = CHARM_SETS.find(s => s.members.length === 3)!;
const pair = CHARM_SETS.find(s => s.members.length === 2)!;

describe('v7.61.0 charm sets pay as you build', () => {
    test('a trio pays at two and more at three; a pair only when whole', () => {
        expect(setPayFor(trio, 1)).toBe(0);
        expect(setPayFor(trio, 2)).toBe(CHARM_SET_BONUS.trioPartial);
        expect(setPayFor(trio, 3)).toBe(CHARM_SET_BONUS.trio);
        expect(setPayFor(pair, 1)).toBe(0);
        expect(setPayFor(pair, 2)).toBe(CHARM_SET_BONUS.pair);
    });
    test('payingSets and leadingSet read the held charms', () => {
        expect(payingSets(trio.members.slice(0, 2)).map(s => [s.set.id, s.points])).toEqual([[trio.id, CHARM_SET_BONUS.trioPartial]]);
        expect(payingSets([trio.members[0]])).toEqual([]);
        expect(leadingSet([])).toBeNull();
        expect(leadingSet([trio.members[0], ...pair.members])?.set.id).toBe(pair.id);
    });
});

describe('v7.61.0 Mystery Tape pays again on use', () => {
    const tapeId = MYSTERY_TAPE.pool.find(id => pp(id) && !pp(id).selectionType && pp(id).effectType !== 'selection')!;
    test('using the tape PowerPlay pays the use prize once', () => {
        const tape = pp(tapeId);
        const s = start({ score: 1000, mysteryTapeId: tape.id });
        const took = gameReducer(s, { type: 'CHOOSE_POWER_PLAY', payload: { powerPlay: tape, allOffered: [tape] } });
        expect(took.gameState.tapeBonusId).toBe(tape.id);
        const before = took.gameState.score;
        const used = gameReducer(took, { type: 'ACTIVATE_POWER_PLAY', payload: tape });
        expect(used.gameState.tapeBonusId).toBeNull();
        const entry = used.gameState.log.find(e => e.type === 'event' && e.name === 'Mystery Tape played') as { scoreChange: number } | undefined;
        expect(entry?.scoreChange).toBe(prizeFor(MYSTERY_TAPE.usePoints, 1));
        expect(used.gameState.score).toBeGreaterThanOrEqual(before + prizeFor(MYSTERY_TAPE.usePoints, 1) - 500); // its own effect may cost a little
    });
    test('swapping the tape PowerPlay out drops the bonus', () => {
        const tape = pp(tapeId);
        const other = pp(MYSTERY_TAPE.pool.find(id => id !== tapeId)!);
        const took = gameReducer(start({ mysteryTapeId: tape.id }), { type: 'CHOOSE_POWER_PLAY', payload: { powerPlay: tape, allOffered: [tape] } });
        const swapped = gameReducer(took, { type: 'CHOOSE_POWER_PLAY', payload: { powerPlay: other, allOffered: [other] } });
        expect(swapped.gameState.tapeBonusId).toBeNull();
    });
});

describe('v7.61.0 power word prizes', () => {
    test('every effect names a short prize for the hint chip', () => {
        for (const e of ['slot', 'freeze', 'heal', 'slow', 'twin', 'shield', 'rewind', 'sword', 'spice', 'cake'] as const) {
            expect(powerWordInfo(e).prize.length).toBeGreaterThan(3);
            expect(powerWordInfo(e).prize.length).toBeLessThanOrEqual(22);
        }
    });
});
