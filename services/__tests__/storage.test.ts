// @vitest-environment jsdom
import { describe, test, expect, beforeEach } from 'vitest';
import { storage, STORAGE_KEYS, STORAGE_VERSION } from '../storage';

beforeEach(() => localStorage.clear());

describe('storage', () => {
    test('round-trips JSON values', () => {
        storage.setJSON(STORAGE_KEYS.unlockedPacks, ['default', 'cosmic']);
        expect(storage.getJSON(STORAGE_KEYS.unlockedPacks, [])).toEqual(['default', 'cosmic']);
    });

    test('returns the fallback and clears corrupted JSON', () => {
        localStorage.setItem(STORAGE_KEYS.savedGame, '{broken');
        expect(storage.getJSON(STORAGE_KEYS.savedGame, null)).toBeNull();
        expect(localStorage.getItem(STORAGE_KEYS.savedGame)).toBeNull();
    });

    test('init records the current storage version', () => {
        storage.init();
        expect(localStorage.getItem(STORAGE_KEYS.version)).toBe(String(STORAGE_VERSION));
    });
});
