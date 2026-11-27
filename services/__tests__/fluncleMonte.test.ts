// v7.96.8: Fluncle is Proud pays points and seconds; Find the Lady shuffles fewer, slower swaps.
import { describe, it, expect } from 'vitest';
import { POWER_PLAYS_LIST, TIME_CARD_IDS, PRIZE_POWER_PLAY_IDS } from '../../data/powerPlays';
import { POWER_PLAY_VALUES, MINI_GAME_VALUES } from '../../config/gameplay';

describe('Fluncle is Proud', () => {
  const f = POWER_PLAYS_LIST.find(p => p.id === 'fluncleIsProud')!;
  it('pays more points and up to 10 seconds, and says so', () => {
    expect(POWER_PLAY_VALUES.fluncleProud).toBeGreaterThan(300);
    expect(POWER_PLAY_VALUES.fluncleSeconds).toBeGreaterThan(0);
    expect(POWER_PLAY_VALUES.fluncleSeconds).toBeLessThanOrEqual(10);
    expect(f.description).toContain(`+${POWER_PLAY_VALUES.fluncleProud} points`);
    expect(f.description).toContain(`+${POWER_PLAY_VALUES.fluncleSeconds} seconds`);
  });
  it('counts as a time card (one per offer) and a growing prize', () => {
    expect(TIME_CARD_IDS.has('fluncleIsProud')).toBe(true);
    expect(PRIZE_POWER_PLAY_IDS.has('fluncleIsProud')).toBe(true);
  });
});

describe('Find the Lady shuffle', () => {
  const m = MINI_GAME_VALUES.monte;
  it('has a pause between swaps and no swap faster than half a second', () => {
    expect(m.swaps).toHaveLength(3);
    expect(Math.min(...m.swapMs)).toBeGreaterThanOrEqual(500);
    expect(m.moveShare).toBeLessThan(1);
    expect(Math.max(...m.swaps)).toBeLessThanOrEqual(6);
  });
});
