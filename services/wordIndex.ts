import { canBeMadeFromLetters, rackLetterLength } from './rackMatch';

export interface FindWordOptions {
    minLength?: number;
    /** Return the longest playable word instead of the first one found. */
    longest?: boolean;
}

export interface WordIndex {
    size: number;
    has: (word: string) => boolean;
    findPlayable: (letters: readonly string[], options?: FindWordOptions) => string | null;
}

/** Parses the newline-separated list produced by scripts/build-wordlist.mjs. */
export const parseWordList = (text: string): string[] =>
    text.split('\n').map(w => w.trim()).filter(Boolean);

export const createWordIndex = (words: Iterable<string>): WordIndex => {
    const set = new Set<string>();
    for (const w of words) set.add(w.toLowerCase());

    // Bucket by length so searches can skip words too long for the rack.
    const byLength: string[][] = [];
    for (const w of set) {
        (byLength[w.length] ??= []).push(w);
    }

    const findPlayable = (letters: readonly string[], { minLength = 3, longest = false }: FindWordOptions = {}): string | null => {
        const maxLength = Math.min(rackLetterLength(letters), byLength.length - 1);
        for (let i = 0; i <= maxLength - minLength; i++) {
            const length = longest ? maxLength - i : minLength + i;
            for (const w of byLength[length] ?? []) {
                if (canBeMadeFromLetters(w, letters)) return w;
            }
        }
        return null;
    };

    return {
        size: set.size,
        has: (word: string) => set.has(word.toLowerCase()),
        findPlayable,
    };
};
