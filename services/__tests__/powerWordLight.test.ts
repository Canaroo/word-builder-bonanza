// v7.97.0: lighting a hinted power word's tiles costs a flat number of seconds, once.
import { describe, it, expect } from 'vitest';
import { gameReducer, screenInitialState, type GameScreenState } from '../screens/GameScreen';
import { canLightPowerWord } from '../powerWordHint';
import { POWER_WORD_EFFECTS } from '../../config/gameplay';

const at = (time: number, lit = false): GameScreenState => ({ ...screenInitialState, time, isLoading: false,
  gameState: { ...screenInitialState.gameState, powerHint: { level: 1, id: 'heal', lit } } });

describe('lighting a power word', () => {
  it('costs the flat seconds once and stays lit', () => {
    const s = gameReducer(at(30), { type: 'LIGHT_POWER_WORD' });
    expect(s.time).toBe(30 - POWER_WORD_EFFECTS.lightSeconds);
    expect(s.gameState.powerHint?.lit).toBe(true);
    expect((s.gameState.log.at(-1) as { name?: string })?.name).toBe('Power word hint');
    const again = gameReducer(s, { type: 'LIGHT_POWER_WORD' });
    expect(again).toBe(s);
  });
  it('never leaves the clock under 1 second, and needs a hint', () => {
    const low = at(POWER_WORD_EFFECTS.lightSeconds);
    expect(canLightPowerWord(POWER_WORD_EFFECTS.lightSeconds)).toBe(false);
    expect(canLightPowerWord(POWER_WORD_EFFECTS.lightSeconds + 1)).toBe(true);
    expect(gameReducer(low, { type: 'LIGHT_POWER_WORD' })).toBe(low);
    const none = { ...at(30), gameState: { ...at(30).gameState, powerHint: null } };
    expect(gameReducer(none, { type: 'LIGHT_POWER_WORD' })).toBe(none);
  });
});
