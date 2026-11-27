// v7.96.9: Hammer Time's text says it slows the clock at every level, with the real speeds.
import { describe, it, expect } from 'vitest';
import { CHARMS_LIST } from '../../data/charms';
import { clockSpeedFor, hammerClockFor } from '../rules';
import { CHARM_BONUS } from '../../config/gameplay';

describe('Hammer Time', () => {
  const h = CHARMS_LIST.find(c => c.id === 'hammerTime')!;
  it('takes the same share off every level, speed-ups included', () => {
    for (const lv of [1, 6, 10, 15, 25]) expect(hammerClockFor(lv)).toBeCloseTo(clockSpeedFor(lv) * (1 - CHARM_BONUS.hammerTimeSlowPercent / 100), 2);
  });
  it('names the real speeds', () => {
    expect(h.description).toContain(`${CHARM_BONUS.hammerTimeSlowPercent}% slower at every level`);
    expect(h.finePrint).toContain(`level 10 x${clockSpeedFor(10).toFixed(2)} → x${hammerClockFor(10).toFixed(2)}`);
  });
});
