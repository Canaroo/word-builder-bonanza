import { MissedWord } from '../types';

import { storage, STORAGE_KEYS } from './storage';

const MISSED_WORDS_KEY = STORAGE_KEYS.missedWords;
const MAX_WORDS = 10;

const getMissedWords = (): MissedWord[] => {
    try {
        const wordsJson = storage.getString(MISSED_WORDS_KEY);
        const words: MissedWord[] = wordsJson ? JSON.parse(wordsJson) : [];
        return words; // Already sorted by recency when adding
    } catch (e) {
        console.error('Failed to parse missed words:', e);
        return [];
    }
};

const addMissedWord = (word: string, definition: string) => {
    if (!word || !definition) return;

    const currentWords = getMissedWords();
    
    // Avoid adding duplicates
    const wordLower = word.toLowerCase();
    if (currentWords.some(w => w.word.toLowerCase() === wordLower)) {
        return;
    }

    const newWord: MissedWord = {
        word: word.toUpperCase(),
        definition,
        timestamp: Date.now(),
    };

    // Add the new word to the beginning of the list
    const updatedWords = [newWord, ...currentWords];

    // Limit the list to MAX_WORDS
    const trimmedWords = updatedWords.slice(0, MAX_WORDS);

    try {
        storage.setJSON(MISSED_WORDS_KEY, trimmedWords);
    } catch (e) {
        console.error('Failed to save missed word:', e);
    }
};

export const missedWordsService = {
    getMissedWords,
    addMissedWord,
    MAX_WORDS
};
