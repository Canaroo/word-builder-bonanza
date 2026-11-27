// v7.98.1: a correct STUCK? call gives stuckWinSeconds; a plain shuffle still gives shuffleTimeBonus.
import { describe, it, expect } from 'vitest';
import { gameReducer, screenInitialState, type GameScreenState } from '../screens/GameScreen';
import { GAMEPLAY } from '../../config/gameplay';

const at = (time: number): GameScreenState => ({ ...screenInitialState, time, isLoading: false, hand: [], buildRow: Array(8).fill(null),
  gameState: { ...screenInitialState.gameState, shuffleCount: 3 } });

describe('STUCK? win time', () => {
  it('a correct call adds the full stuck seconds', () => {
    const s = gameReducer(at(20), { type: 'PERFORM_SHUFFLE', payload: { hand: [], tileBag: [], isFree: true, isFromChallengeWin: true } });
    expect(GAMEPLAY.timeBank.stuckWinSeconds).toBe(10);
    expect(s.time).toBe(20 + GAMEPLAY.timeBank.stuckWinSeconds);
    expect(s.gameState.shuffleCount).toBe(3);
  });
  it('a plain shuffle is unchanged', () => {
    const s = gameReducer(at(20), { type: 'PERFORM_SHUFFLE', payload: { hand: [], tileBag: [], isFree: false } });
    expect(s.time).toBe(20 + GAMEPLAY.timeBank.shuffleTimeBonus);
    expect(s.gameState.shuffleCount).toBe(2);
  });
});
