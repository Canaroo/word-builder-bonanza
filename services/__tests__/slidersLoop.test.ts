import { describe, it, expect } from 'vitest';
import { gameReducer, screenInitialState, type GameScreenState } from '../screens/GameScreen';
import { CHARMS_LIST } from '../../data/charms';

// v7.96.6 (the owner's report): Sliders rewound to before the word, which also brought back the meters and
// forgot Sliders was taken, so replaying the word re-earned the same offers (Sliders again) in a loop.
describe('Sliders can not loop', () => {
  const before = { ...screenInitialState.gameState, score: 100, oncePerRunTaken: [], powerPlayProgress: { ...screenInitialState.gameState.powerPlayProgress, letters: 22 }, wordMilestoneProgress: { count: 4, nextUnlock: 5 }, activeCharms: [] };
  const charm = CHARMS_LIST.find(c => c.id === 'stonks')!;
  const after: GameScreenState = {
    ...screenInitialState, time: 40,
    lastTurnState: { ...screenInitialState, time: 50, gameState: before, hand: screenInitialState.hand, buildRow: screenInitialState.buildRow, tileBag: screenInitialState.tileBag } as never,
    gameState: { ...before, score: 160, oncePerRunTaken: ['sliders'], powerPlayProgress: { ...before.powerPlayProgress, letters: 0 }, wordMilestoneProgress: { count: 0, nextUnlock: 5 }, activeCharms: [charm] },
  };
  const undone = gameReducer(after, { type: 'RESTORE_LAST_TURN' } as never);
  it('rewinds the score and clock', () => {
    expect(undone.gameState.score).toBe(100);
    expect(undone.time).toBe(50);
  });
  it('keeps Sliders spent, the meters where they are and the charm taken after the word', () => {
    expect(undone.gameState.oncePerRunTaken).toContain('sliders');
    expect(undone.gameState.powerPlayProgress.letters).toBe(0);
    expect(undone.gameState.wordMilestoneProgress.count).toBe(0);
    expect(undone.gameState.activeCharms.map(c => c.id)).toContain('stonks');
  });
});
