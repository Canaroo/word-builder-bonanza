import { describe, it, expect } from 'vitest';
import { nextGateFor, previousGateFor } from '../rules';
describe('v7.60.0 next gate', () => {
  it('finds the next uncrossed gate above the score', () => {
    expect(nextGateFor({ score: 500, gatesPassed: [] })).toBe(10000);
    expect(nextGateFor({ score: 12000, gatesPassed: [10000] })).toBe(20000); // v7.76.0: Winner's Circle
    expect(nextGateFor({ score: 80000, gatesPassed: [10000, 20000, 30000, 50000, 70000] })).toBeNull();
    expect(previousGateFor(10000)).toBe(0);
    expect(previousGateFor(50000)).toBe(30000);
  });
});

