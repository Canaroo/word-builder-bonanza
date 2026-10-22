// Words in words/no-suggest.txt are valid when typed but never offered by the game.
import { describe, test, expect } from 'vitest';
import { curatedWords, suggestableWords, NO_SUGGEST_WORDS, isBlocked } from '../curatedWords';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('playable but never suggested', () => {
    test('COON is playable with its raccoon definition', () => {
        expect(isBlocked('coon')).toBe(false);
        expect(curatedWords.get('coon')).toBe('A raccoon.');
        const list = new Set(readFileSync(resolve(__dirname, '../../public/words/wordlist.txt'), 'utf8').split('\n'));
        expect(list.has('coon')).toBe(true);
        expect(list.has('coons')).toBe(true);
    });

    test('no-suggest words are never Power Words, hints or Challenge answers', () => {
        expect(NO_SUGGEST_WORDS.has('coon')).toBe(true);
        for (const w of NO_SUGGEST_WORDS) expect(suggestableWords.has(w)).toBe(false);
        const common = new Set(readFileSync(resolve(__dirname, '../../public/words/common.txt'), 'utf8').split('\n'));
        for (const w of NO_SUGGEST_WORDS) expect(common.has(w)).toBe(false);
    });
});
