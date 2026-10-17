import { describe, test, expect } from 'vitest';
import { assignTilesToWord, canBeMadeFromLetters, rackLetterLength } from '../rackMatch';

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

describe('assignTilesToWord', () => {
    test('returns tile indexes in word order', () => {
        expect(assignTilesToWord('cat', ['T', 'A', 'C'])).toEqual([2, 1, 0]);
    });

    test('lets one combo tile cover several letters', () => {
        expect(assignTilesToWord('quit', ['T', 'I', 'QU'])).toEqual([2, 1, 0]);
        expect(assignTilesToWord('singing', ['ING', 'S', 'ING'])).toHaveLength(3);
    });

    test('falls back to single letters when a combo tile is not on the rack', () => {
        expect(assignTilesToWord('that', ['T', 'H', 'A', 'T'])).toEqual([3, 1, 2, 0]);
    });

    test('mixes single letters and a combo tile mid-word', () => {
        expect(assignTilesToWord('tth', ['T', 'TH'])).toEqual([0, 1]);
        expect(assignTilesToWord('bathing', ['ING', 'TH', 'A', 'B'])).toEqual([3, 2, 1, 0]);
    });

    test('skips empty rack slots and returns null when impossible', () => {
        expect(assignTilesToWord('at', [null, 'A', null, 'T'])).toEqual([1, 3]);
        expect(assignTilesToWord('hat', ['TH', 'A'])).toBeNull();
    });
});
