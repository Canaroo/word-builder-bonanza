import { COMBO_TILES } from '../constants';

// Combo tiles (QU, ING, ...) checked longest first so ING wins over shorter overlaps.
const COMBO_LETTERS = COMBO_TILES.map(ct => ct.letter).sort((a, b) => b.length - a.length);

/**
 * Checks whether a word can be spelled from a rack of tile letters.
 * Pure (no DOM, no dictionary) so it can run in the dictionary worker too.
 */
export const canBeMadeFromLetters = (word: string, letters: readonly string[]): boolean => {
    let wordToCheck = word.toUpperCase();

    const rackLetterCounts: { [key: string]: number } = {};
    letters.forEach(letter => {
        rackLetterCounts[letter] = (rackLetterCounts[letter] || 0) + 1;
    });

    // Greedily use combo tiles first
    for (const combo of COMBO_LETTERS) {
        while (wordToCheck.includes(combo) && rackLetterCounts[combo] > 0) {
            wordToCheck = wordToCheck.replace(combo, '');
            rackLetterCounts[combo]--;
        }
    }

    // Then the remaining single letters
    for (const char of wordToCheck) {
        if (!rackLetterCounts[char]) {
            return false;
        }
        rackLetterCounts[char]--;
    }

    return true;
};

/** Total number of letters a rack can spell, counting combo tiles by their length. */
export const rackLetterLength = (letters: readonly string[]): number =>
    letters.reduce((sum, letter) => sum + letter.length, 0);
