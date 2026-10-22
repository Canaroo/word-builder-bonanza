// The curated words from data/internalWords.ts, minus anything in words/blocked.txt.
// Use this (not internalWords) whenever a word might be suggested, dealt or accepted at runtime.
import { internalWords } from '../data/internalWords';
import blockedText from '../words/blocked.txt?raw';
import noSuggestText from '../words/no-suggest.txt?raw';

export const BLOCKED_WORDS: ReadonlySet<string> = new Set(
    blockedText.split(/\r?\n/).map(l => l.trim().toLowerCase()).filter(l => l && !l.startsWith('#'))
);

export const isBlocked = (word: string): boolean => BLOCKED_WORDS.has(word.toLowerCase());

/** Valid when a player types them, but never offered by the game (words/no-suggest.txt). */
export const NO_SUGGEST_WORDS: ReadonlySet<string> = new Set(
    noSuggestText.split(/\r?\n/).map(l => l.trim().toLowerCase()).filter(l => l && !l.startsWith('#'))
);

export const curatedWords: ReadonlyMap<string, string> = new Map(
    [...internalWords].filter(([word]) => !BLOCKED_WORDS.has(word))
);

/** Curated words the game may offer: Power Words, hints, rack balancing. Excludes no-suggest words. */
export const suggestableWords: ReadonlyMap<string, string> = new Map(
    [...curatedWords].filter(([word]) => !NO_SUGGEST_WORDS.has(word))
);
