// The Plinko board (v7.36.3): the prize is rolled from the same table as before; the board only
// decides where it lands and how the chip gets there.
import { describe, test, expect } from 'vitest';
import { PLINKO_SLOTS, PLINKO_ROWS, plinkoSlotFor, plinkoPath, plinkoPayout } from '../rules';
import { POWER_PLAY_VALUES } from '../../config/gameplay';

describe('Plinko board', () => {
  test('every prize in the table has a slot, and the jackpot is in the middle', () => {
    for (const { points } of POWER_PLAY_VALUES.plinko) expect(PLINKO_SLOTS).toContain(points);
    expect(PLINKO_SLOTS[4]).toBe(Math.max(...PLINKO_SLOTS));
  });

  test('a prize lands in a slot with that value, nearest the drop point', () => {
    for (let start = 0; start <= 8; start++) {
      for (const { points } of POWER_PLAY_VALUES.plinko) {
        const slot = plinkoSlotFor(points, start);
        expect(PLINKO_SLOTS[slot]).toBe(points);
      }
    }
    expect(plinkoSlotFor(100, 0)).toBe(0);
    expect(plinkoSlotFor(100, 8)).toBe(8);
  });

  test('the path starts at the drop point, ends on the slot and stays on the board', () => {
    for (let i = 0; i < 200; i++) {
      const start = Math.random() * 8;
      const slot = Math.floor(Math.random() * 9);
      const path = plinkoPath(start, slot);
      expect(path).toHaveLength(PLINKO_ROWS + 1);
      expect(path[0]).toBe(start);
      expect(path[path.length - 1]).toBe(slot);
      for (const x of path) { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(8); }
    }
  });

  test('the odds are the same as before: the payout still comes from the table', () => {
    const counts: Record<number, number> = {};
    const n = 100000;
    for (let i = 0; i < n; i++) { const p = plinkoPayout(Math.random()); counts[p] = (counts[p] ?? 0) + 1; }
    for (const { points, chance } of POWER_PLAY_VALUES.plinko) expect(Math.abs(counts[points] / n - chance)).toBeLessThan(0.01);
  });
});
