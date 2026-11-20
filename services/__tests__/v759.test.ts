import { describe, it, expect } from 'vitest';
import { forkAdvice } from '../rules';
import { FORK } from '../../config/gameplay';

describe('v7.59.0 Fork advice', () => {
  it('recommends Danger when the clock gained time', () => {
    expect(forkAdvice(FORK.advice.gain, 40)).toBe('danger');
    expect(forkAdvice(12, 30)).toBe('danger');
  });
  it('recommends Danger at a comfy clock that held steady (the bank cap hides gains)', () => {
    expect(forkAdvice(0, 90)).toBe('danger');
    expect(forkAdvice(-FORK.advice.gain, 90)).toBe('either');
  });
  it('recommends Easy when the clock is slipping and tight', () => {
    expect(forkAdvice(-3, 30)).toBe('easy');
    expect(forkAdvice(-20, 44)).toBe('easy');
  });
  it('calls it close otherwise', () => {
    expect(forkAdvice(2, 50)).toBe('either');
    expect(forkAdvice(-3, 50)).toBe('either');
    expect(forkAdvice(null, 40)).toBe('either');
    expect(forkAdvice(null, 70)).toBe('danger');
  });
});

import { nextGateFor } from '../screens/GameScreen';
describe('v7.60.0 next gate', () => {
  it('finds the next uncrossed gate above the score', () => {
    expect(nextGateFor({ score: 500, gatesPassed: [] })).toBe(10000);
    expect(nextGateFor({ score: 12000, gatesPassed: [10000] })).toBe(30000);
    expect(nextGateFor({ score: 80000, gatesPassed: [10000, 30000, 50000, 70000] })).toBeNull();
  });
});
