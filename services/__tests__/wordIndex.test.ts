import { describe, test, expect } from 'vitest';
import { createWordIndex, parseWordList } from '../wordIndex';

const index = createWordIndex(parseWordList('at\ncat\ncoat\ncoats\ntacos\nquit\n'));

describe('createWordIndex', () => {
    test('looks words up case-insensitively', () => {
        expect(index.has('cat')).toBe(true);
        expect(index.has('CAT')).toBe(true);
        expect(index.has('dog')).toBe(false);
    });

    test('finds the shortest playable word by default, respecting minLength', () => {
        expect(index.findPlayable(['C', 'A', 'T', 'O', 'S'])).toBe('cat');
        expect(index.findPlayable(['C', 'A', 'T'], { minLength: 2 })).toBe('at');
    });

    test('finds the longest playable word when asked', () => {
        expect(index.findPlayable(['C', 'A', 'T', 'O', 'S'], { longest: true })).toMatch(/^(coats|tacos)$/);
    });

    test('handles combo tiles', () => {
        expect(index.findPlayable(['QU', 'I', 'T'])).toBe('quit');
    });

    test('returns null when nothing can be played', () => {
        expect(index.findPlayable(['X', 'Z', 'V'])).toBeNull();
    });
});
