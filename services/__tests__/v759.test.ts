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
