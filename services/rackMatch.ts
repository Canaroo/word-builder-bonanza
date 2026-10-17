import { COMBO_TILES } from '../constants';

// Combo tiles (QU, ING, ...) tried longest first.
const COMBO_LETTERS = COMBO_TILES.map(ct => ct.letter).sort((a, b) => b.length - a.length);

/**
 * Works out which rack tiles spell a word, in word order, letting combo tiles
 * (QU, ING, ...) cover several letters. Returns indexes into `letters`, or null if the
 * word can't be spelled. Empty slots (null) are skipped.
 * Pure (no DOM, no dictionary) so it can run in the dictionary worker too.
 */
export const assignTilesToWord = (word: string, letters: readonly (string | null | undefined)[]): number[] | null => {
    const target = word.toUpperCase();

    // Free tile indexes for each tile letter.
    const free = new Map<string, number[]>();
    letters.forEach((letter, i) => {
        if (letter) free.set(letter, [...(free.get(letter) ?? []), i]);
    });

    const picked: number[] = [];
    const search = (pos: number): boolean => {
        if (pos === target.length) return true;
        for (const piece of [...COMBO_LETTERS, target[pos]]) {
            if (!target.startsWith(piece, pos)) continue;
            const slots = free.get(piece);
            if (!slots?.length) continue;
            picked.push(slots.pop()!);
            if (search(pos + piece.length)) return true;
            slots.push(picked.pop()!);
        }
        return false;
    };

    return search(0) ? picked : null;
};

/** Checks whether a word can be spelled from a rack of tile letters. */
export const canBeMadeFromLetters = (word: string, letters: readonly string[]): boolean =>
    assignTilesToWord(word, letters) !== null;

/** Total number of letters a rack can spell, counting combo tiles by their length. */
export const rackLetterLength = (letters: readonly string[]): number =>
    letters.reduce((sum, letter) => sum + letter.length, 0);
