import { describe, test, expect } from 'vitest';
import { curatedWords, isBlocked, BLOCKED_WORDS } from '../curatedWords';
import { internalWords } from '../../data/internalWords';
import { dictionaryService } from '../dictionaryService';

describe('curated words respect words/blocked.txt', () => {
    test('blocked words are read from the file, case-insensitively', () => {
        expect(BLOCKED_WORDS.size).toBeGreaterThan(0);
        expect(isBlocked('GYP')).toBe(true);
        expect(isBlocked('cat')).toBe(false);
    });

    test('blocked words in the internal list never reach the game', () => {
        const blockedInternal = [...internalWords.keys()].filter(w => BLOCKED_WORDS.has(w));
        expect(blockedInternal.length).toBeGreaterThan(0); // e.g. gyp, yid
        for (const w of blockedInternal) {
            expect(curatedWords.has(w)).toBe(false);
            expect([...dictionaryService.getDictionaryWords()]).not.toContain(w);
        }
    });

    test('lookups reject blocked words without asking the word list', async () => {
        expect(await dictionaryService.lookupWord('gyp')).toEqual({ isValid: false });
    });
});
