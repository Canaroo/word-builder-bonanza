import { describe, test, expect } from 'vitest';
import { canBeMadeFromLetters, rackLetterLength } from '../rackMatch';

describe('canBeMadeFromLetters', () => {
    test('uses each tile at most once', () => {
        expect(canBeMadeFromLetters('cat', ['C', 'A', 'T'])).toBe(true);
        expect(canBeMadeFromLetters('tact', ['C', 'A', 'T'])).toBe(false);
        expect(canBeMadeFromLetters('tact', ['C', 'A', 'T', 'T'])).toBe(true);
    });

    test('combo tiles stand in for their letters', () => {
        expect(canBeMadeFromLetters('quit', ['QU', 'I', 'T'])).toBe(true);
        expect(canBeMadeFromLetters('sing', ['S', 'ING'])).toBe(true);
        expect(canBeMadeFromLetters('ship', ['SH', 'I', 'P'])).toBe(true);
    });

    test('a combo tile cannot be split into single letters', () => {
        expect(canBeMadeFromLetters('hat', ['TH', 'A'])).toBe(false);
    });
});

describe('rackLetterLength', () => {
    test('counts combo tiles by their length', () => {
        expect(rackLetterLength(['A', 'ING', 'QU'])).toBe(6);
    });
});
