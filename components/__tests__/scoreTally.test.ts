import { describe, it, expect } from 'vitest';
import { rollValue, LANDED_ROLL_MS, LANDED_HOLD_MS } from '../../services/screens/GameScreenView';

describe('the landed score pop (v7.94.1)', () => {
  it('rolls from the base to the real total, then stays on it', () => {
    expect(rollValue(25, 150, 0)).toBe(25);
    const mid = rollValue(25, 150, LANDED_ROLL_MS / 2);
    expect(mid).toBeGreaterThan(25);
    expect(mid).toBeLessThan(150);
    expect(rollValue(25, 150, LANDED_ROLL_MS)).toBe(150);
    expect(rollValue(25, 150, LANDED_ROLL_MS * 3)).toBe(150);
  });
  it('does not roll when nothing changed the score', () => {
    expect(rollValue(40, 40, 0)).toBe(40);
  });
  it('holds the final number for at least a second', () => {
    expect(LANDED_HOLD_MS).toBeGreaterThanOrEqual(1000);
  });
});
