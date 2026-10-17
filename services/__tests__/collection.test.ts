// @vitest-environment jsdom
import { describe, test, expect, beforeEach } from 'vitest';
import { getCollection, recordFound, collectionProgress, hintFor } from '../collection';
import { storage, STORAGE_KEYS } from '../storage';
import { SECRET_BONUSES } from '../../data/secretBonuses';
import type { SecretBonus } from '../../types';

beforeEach(() => localStorage.clear());

describe('bonus collection', () => {
    test('records the first find and counts repeats', () => {
        expect(recordFound('heroOfHyrule', 1000)).toBe(true);
        expect(recordFound('heroOfHyrule', 2000)).toBe(false);
        expect(getCollection().heroOfHyrule).toEqual({ firstFoundAt: 1000, timesFound: 2 });
        expect(collectionProgress()).toEqual({ found: 1, total: SECRET_BONUSES.length });
    });

    test('ignores unknown ids and corrupt entries', () => {
        expect(recordFound('noSuchBonus')).toBe(false);
        storage.setJSON(STORAGE_KEYS.bonusCollection, { removedBonus: { firstFoundAt: 1, timesFound: 1 }, theAnswer: 'junk' });
        expect(getCollection()).toEqual({});
        storage.setJSON(STORAGE_KEYS.bonusCollection, ['not', 'an', 'object']);
        expect(collectionProgress().found).toBe(0);
    });
});

describe('hintFor', () => {
    const base = { id: 'x', name: 'n', description: 'd', message: 'm', points: 1 };
    test('uses the written hint when there is one', () => {
        expect(hintFor({ ...base, word: 'LINK', hint: 'A Hylian hero.' } as SecretBonus)).toBe('A Hylian hero.');
    });
    test('builds a clue from the word and its source', () => {
        expect(hintFor({ ...base, word: 'LINK', source: 'The Legend of Zelda' } as SecretBonus)).toBe('A 4-letter word from The Legend of Zelda.');
        expect(hintFor({ ...base, word: 'poop' } as SecretBonus)).toBe('A 4-letter word starting with P.');
    });
    test('never gives away a score number', () => {
        const hint = hintFor({ ...base, score: { kind: 'contains', digits: '42' } } as SecretBonus);
        expect(hint).not.toContain('42');
        expect(hint).toMatch(/2-digit/);
    });
});
