// @vitest-environment jsdom
import { describe, test, expect, beforeEach } from 'vitest';
import { powerWordService } from '../powerWordService';
import { storage, STORAGE_KEYS } from '../storage';

const spunAt = (d: Date) => storage.setJSON(STORAGE_KEYS.powerWord, { powerWord: 'JAZZ', definition: 'x', spinTimestamp: d.getTime() });

beforeEach(() => localStorage.clear());

describe('Power Word daily reset (8 AM)', () => {
  test('first spin is always allowed', () => {
    expect(powerWordService.canSpin()).toBe(true);
  });

  test('a spin yesterday afternoon unlocks at 8 AM today, not before', () => {
    spunAt(new Date(2026, 9, 19, 15, 0));
    expect(powerWordService.canSpin(new Date(2026, 9, 19, 23, 59))).toBe(false);
    expect(powerWordService.canSpin(new Date(2026, 9, 20, 7, 59))).toBe(false);
    expect(powerWordService.canSpin(new Date(2026, 9, 20, 8, 0))).toBe(true);
  });

  test('a spin before 8 AM unlocks again at 8 AM the same day', () => {
    spunAt(new Date(2026, 9, 20, 6, 30));
    expect(powerWordService.canSpin(new Date(2026, 9, 20, 7, 59))).toBe(false);
    expect(powerWordService.canSpin(new Date(2026, 9, 20, 8, 1))).toBe(true);
  });

  test('a spin several days ago can spin again', () => {
    spunAt(new Date(2026, 9, 14, 9, 0));
    expect(powerWordService.canSpin(new Date(2026, 9, 20, 12, 0))).toBe(true);
  });
});
