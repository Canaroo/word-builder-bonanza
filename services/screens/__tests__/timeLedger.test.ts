// @vitest-environment jsdom
// The time ledger records where a run's time came from, for the Game Over recap.
import { describe, test, expect, vi, afterEach } from 'vitest';
import { gameReducer, screenInitialState, type GameScreenState } from '../GameScreen';
import * as gameUtils from '../../gameUtils';
import { RACK_SIZE } from '../../../constants';
import { GAMEPLAY } from '../../../config/gameplay';

const startState = (time = 30): GameScreenState => {
    vi.spyOn(Math, 'random').mockReturnValue(0.42);
    const { hand, tileBag } = gameUtils.dealNewHand(gameUtils.createTileBag());
    const padded = Array(RACK_SIZE).fill(null);
    hand.forEach((t, i) => (padded[i] = t));
    return { ...screenInitialState, hand: padded, tileBag, time, isLoading: false };
};

afterEach(() => vi.restoreAllMocks());

describe('time ledger', () => {
    test('word time is credited to words when the next round starts', () => {
        const s = startState();
        const next = gameReducer({ ...s, gameState: { ...s.gameState, pendingTimeBonus: 7 } }, { type: 'START_NEXT_ROUND' });
        expect(next.time).toBe(37);
        expect(next.gameState.timeLedger).toMatchObject({ words: 7, powerUps: 0, shuffles: 0 });
    });

    test('shuffles and power-up time are credited separately', () => {
        const s = startState();
        const shuffled = gameReducer(s, { type: 'PERFORM_SHUFFLE', payload: { hand: s.hand, tileBag: s.tileBag, isFree: true } });
        const boosted = gameReducer(shuffled, { type: 'ADD_TIME', payload: 8 });
        expect(boosted.gameState.timeLedger).toMatchObject({ words: 0, shuffles: GAMEPLAY.timeBank.shuffleTimeBonus, powerUps: 8 });
    });

    test('only time actually added counts (a full bank adds nothing)', () => {
        const s = startState(GAMEPLAY.timeBank.max);
        const next = gameReducer(s, { type: 'ADD_TIME', payload: 10 });
        expect(next.gameState.timeLedger?.powerUps ?? 0).toBe(0);
    });
});
