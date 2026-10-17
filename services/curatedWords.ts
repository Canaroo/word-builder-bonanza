// The curated words from data/internalWords.ts, minus anything in words/blocked.txt.
// Use this (not internalWords) whenever a word might be suggested, dealt or accepted at runtime.
import { internalWords } from '../data/internalWords';
import blockedText from '../words/blocked.txt?raw';

export const BLOCKED_WORDS: ReadonlySet<string> = new Set(
    blockedText.split(/\r?\n/).map(l => l.trim().toLowerCase()).filter(l => l && !l.startsWith('#'))
);

export const isBlocked = (word: string): boolean => BLOCKED_WORDS.has(word.toLowerCase());

export const curatedWords: ReadonlyMap<string, string> = new Map(
    [...internalWords].filter(([word]) => !BLOCKED_WORDS.has(word))
);
