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

import { nextGateFor, previousGateFor } from '../rules';
describe('v7.60.0 next gate', () => {
  it('finds the next uncrossed gate above the score', () => {
    expect(nextGateFor({ score: 500, gatesPassed: [] })).toBe(10000);
    expect(nextGateFor({ score: 12000, gatesPassed: [10000] })).toBe(30000);
    expect(nextGateFor({ score: 80000, gatesPassed: [10000, 30000, 50000, 70000] })).toBeNull();
    expect(previousGateFor(10000)).toBe(0);
    expect(previousGateFor(50000)).toBe(30000);
  });
});

import { forkWordsLeft } from '../rules';
describe('v7.61.4 words to the next fork', () => {
  it('counts valid words until the next fork level, none after the last', () => {
    expect(forkWordsLeft(54)).toBe(54);   // just reached level 4: next fork at level 7 (word 108)
    expect(forkWordsLeft(100)).toBe(8);
    expect(forkWordsLeft(108)).toBe(72);  // level 7: next fork at 11 (word 180)
    expect(forkWordsLeft(180)).toBeNull(); // level 11: last fork
  });
});
