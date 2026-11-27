// v7.100.1: a Captain Planet tile left out of the next word says it wore off (in the log and a message).
import { describe, test, expect } from 'vitest';
import { gameReducer, screenInitialState, createInitialGameState, type GameScreenState } from '../GameScreen';
import { RACK_SIZE } from '../../../constants';
import type { Tile } from '../../../types';

const tile = (letter: string, extra: Partial<Tile> = {}): Tile => ({ id: `${letter}-${Math.random()}`, letter, points: 1, ...extra });
const start = (hand: (Tile | null)[]): GameScreenState => ({ ...screenInitialState, isLoading: false, time: 40,
  hand: [...hand, ...Array(RACK_SIZE - hand.length).fill(null)], gameState: { ...createInitialGameState(), runSeed: 7 } });

describe('Captain Planet wearing off', () => {
  test('an unused 20-point tile loses its boost on the next hand and the log says so', () => {
    const after = gameReducer(start([tile('A', { tempPoints: 20, tempPointsSource: 'Captain Planet' }), tile('T')]), { type: 'START_NEXT_ROUND' });
    const a = after.hand.find(t => t?.letter === 'A');
    expect(a?.tempPoints).toBeUndefined();
    const entry = after.gameState.log.at(-1) as { name?: string; description?: string };
    expect(entry.name).toBe('Captain Planet wore off');
    expect(entry.description).toContain("20-point A wasn't in your word");
    expect(after.gameState.lastPowerPlayResult?.message).toContain('Captain Planet wore off');
  });
  test('no boosted tile left over, no notice', () => {
    const after = gameReducer(start([tile('C'), tile('T')]), { type: 'START_NEXT_ROUND' });
    expect(after.gameState.log.some(e => (e as { name?: string }).name?.includes('wore off'))).toBe(false);
  });
});
