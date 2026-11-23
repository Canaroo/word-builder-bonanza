import { canBeMadeFromLetters, rackLetterLength } from './rackMatch';

export interface FindWordOptions {
    minLength?: number;
    /** Return the longest playable word instead of the first one found. */
    longest?: boolean;
    /** Search only everyday words (Challenge and hints), not the full list. */
    commonOnly?: boolean;
}

export interface WordIndex {
    size: number;
    has: (word: string) => boolean;
    findPlayable: (letters: readonly string[], options?: FindWordOptions) => string | null;
    /** v7.62.0 (Inception): everyday words of 3+ letters hiding inside this word, in its letters' order. */
    hiddenWords: (word: string) => string[];
    /** v7.74.0 (Survey Says!): every everyday word of minLength+ letters these tiles can spell, longest first. */
    allPlayable: (letters: readonly string[], minLength?: number) => string[];
}

/** Everyday words of minLength+ letters spelled by consecutive letters of `word` (not the word itself). */
export const hiddenWordsIn = (word: string, isCommon: (w: string) => boolean, minLength = 3): string[] => {
    const w = word.toLowerCase();
    const found = new Set<string>();
    for (let i = 0; i < w.length; i++) {
        for (let j = i + minLength; j <= w.length; j++) {
            if (j - i === w.length) continue;
            const part = w.slice(i, j);
            if (isCommon(part)) found.add(part.toUpperCase());
        }
    }
    return [...found];
};

/** Parses the newline-separated list produced by scripts/build-wordlist.mjs. */
export const parseWordList = (text: string): string[] =>
    text.split('\n').map(w => w.trim()).filter(Boolean);

// Bucket by length so searches can skip words too long for the rack.
const bucketByLength = (words: Iterable<string>): string[][] => {
    const byLength: string[][] = [];
    for (const w of words) (byLength[w.length] ??= []).push(w);
    return byLength;
};

/**
 * @param words every playable word
 * @param commonWords the everyday subset searched with `commonOnly`; defaults to all words
 */
export const createWordIndex = (words: Iterable<string>, commonWords?: Iterable<string>): WordIndex => {
    const set = new Set<string>();
    for (const w of words) set.add(w.toLowerCase());

    const allByLength = bucketByLength(set);
    const commonByLength = commonWords
        ? bucketByLength([...commonWords].map(w => w.toLowerCase()).filter(w => set.has(w)))
        : allByLength;

    const findPlayable = (letters: readonly string[], { minLength = 3, longest = false, commonOnly = false }: FindWordOptions = {}): string | null => {
        const byLength = commonOnly ? commonByLength : allByLength;
        const maxLength = Math.min(rackLetterLength(letters), byLength.length - 1);
        for (let i = 0; i <= maxLength - minLength; i++) {
            const length = longest ? maxLength - i : minLength + i;
            for (const w of byLength[length] ?? []) {
                if (canBeMadeFromLetters(w, letters)) return w;
            }
        }
        return null;
    };

    const commonSet = commonWords ? new Set(commonByLength.flat()) : set;
    return {
        size: set.size,
        has: (word: string) => set.has(word.toLowerCase()),
        findPlayable,
        hiddenWords: (word: string) => hiddenWordsIn(word, w => commonSet.has(w)),
        allPlayable: (letters: readonly string[], minLength = 3) => {
            const out: string[] = [];
            const maxLength = Math.min(rackLetterLength(letters), commonByLength.length - 1);
            for (let length = maxLength; length >= minLength; length--) {
                for (const w of commonByLength[length] ?? []) if (canBeMadeFromLetters(w, letters)) out.push(w.toUpperCase());
            }
            return out;
        },
    };
};
