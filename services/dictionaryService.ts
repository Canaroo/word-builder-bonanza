// A service to validate words using an internal list, a persistent cache, and an external API.
import { internalWords } from '../data/internalWords';

// In-memory cache for the current session for rapid lookups
const sessionCache = new Map<string, string | null>();

// Function to get the persisted cache from localStorage
const getPersistentCache = (): Map<string, string> => {
    try {
        const cached = localStorage.getItem('wordBuilderBonanzaCache');
        if (cached) {
            // The stored value is an array of [key, value] pairs
            return new Map(JSON.parse(cached));
        }
    } catch (e) {
        console.error("Failed to parse word cache from localStorage", e);
        // If parsing fails, clear the corrupted cache
        localStorage.removeItem('wordBuilderBonanzaCache');
    }
    return new Map();
};

// Load the persistent cache once on startup
const persistentCache = getPersistentCache();

// Function to save a new valid word to the persistent cache
const updatePersistentCache = (word: string, definition: string) => {
    persistentCache.set(word, definition);
    try {
        // Store as an array of [key, value] pairs, which is JSON-serializable
        localStorage.setItem('wordBuilderBonanzaCache', JSON.stringify(Array.from(persistentCache.entries())));
    } catch (e) {
        console.error("Failed to save word cache to localStorage", e);
    }
};

export interface WordDataResult {
    isValid: boolean;
    definition?: string | null;
}

/**
 * Fetches word definition from the Dictionary API with a retry mechanism.
 * @param {string} word - The word to fetch.
 * @returns {Promise<string | null | undefined>} - The definition, null if not found (404), or undefined on network/server error after retries.
 */
async function fetchFromApi(word: string): Promise<string | null | undefined> {
    const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${word}`;
    const maxRetries = 2; // Will try a total of 3 times (1 initial + 2 retries)
    let delay = 500; // Start with 500ms

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        try {
            const response = await fetch(url);

            if (response.ok) { // Status 200-299
                const data = await response.json();
                const definition = data[0]?.meanings[0]?.definitions[0]?.definition;
                return definition || "Definition not available.";
            }

            if (response.status === 404) {
                // Word not found, this is a definitive answer, no need to retry.
                return null;
            }
            
            // For other server errors (5xx), we will retry.
            console.error(`API server error for "${word}" (attempt ${attempt}):`, response.status);

        } catch (error) {
            // This catches network errors like "Failed to fetch"
            console.error(`Network error fetching word "${word}" (attempt ${attempt}):`, error);
        }

        // If we're here, it means the request failed and it's not a 404.
        // We'll wait before the next attempt, if there is one.
        if (attempt <= maxRetries) {
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2; // Exponential backoff for the next delay
        }
    }

    // If all retries fail, return undefined to signify an unknown state.
    return undefined;
}


/**
 * Looks up a word, checking the internal list, caches, and then the external API.
 * @param {string} word - The word to look up.
 * @returns {Promise<WordDataResult>}
 */
async function lookupWord(word: string): Promise<WordDataResult> {
    if (!word || word.trim().length === 0) {
        return { isValid: false };
    }
    const wordLower = word.toLowerCase();

    // 1. Check internal word list (fastest)
    if (internalWords.has(wordLower)) {
        return { isValid: true, definition: internalWords.get(wordLower) };
    }

    // 2. Check session (in-memory) cache
    if (sessionCache.has(wordLower)) {
        const def = sessionCache.get(wordLower);
        return { isValid: def !== null, definition: def };
    }

    // 3. Check persistent (localStorage) cache
    if (persistentCache.has(wordLower)) {
        const def = persistentCache.get(wordLower)!;
        sessionCache.set(wordLower, def); // Add to session cache for faster access next time
        return { isValid: true, definition: def };
    }

    // 4. Fetch from API as a last resort
    const definition = await fetchFromApi(wordLower);
    
    // Case 1: Network error or unexpected API issue.
    // We don't cache this failure, allowing for a retry on next submission.
    if (definition === undefined) {
        return { isValid: false };
    }

    // Case 2: Confirmed invalid (404 from API) or valid word.
    // Cache this result (null for invalid, string for valid) to prevent future API calls this session.
    sessionCache.set(wordLower, definition);

    if (definition) {
        // If it was a valid word, also add to the persistent cache for future sessions.
        updatePersistentCache(wordLower, definition);
        return { isValid: true, definition };
    }

    // This path is now only for confirmed invalid words (definition is null).
    return { isValid: false };
}

/**
 * Validates a word.
 * @param {string} word - The word to validate.
 * @returns {Promise<boolean>} - True if the word is valid, false otherwise.
 */
async function isValidWord(word: string): Promise<boolean> {
    const result = await lookupWord(word);
    return result.isValid;
}

/**
 * Gets a word's definition.
 * @param {string} word - The word to get the definition for.
 * @returns {Promise<string | null>} - The definition or null if not found.
 */
async function getDefinition(word: string): Promise<string | null> {
    const result = await lookupWord(word);
    return result.definition || null;
}

/**
 * Returns an iterator for all words in the *internal* dictionary only.
 * This is used for synchronous, non-blocking tasks like initial game setup (e.g., finding 3-letter words for balancing).
 * @returns {IterableIterator<string>}
 */
function getDictionaryWords(): IterableIterator<string> {
    return internalWords.keys();
}

/**
 * Returns an array of all known valid words from both the internal dictionary and the persistent cache.
 * This is used for the Challenge mechanic to check against all words the game has ever validated.
 * @returns {string[]}
 */
function getAllKnownWords(): string[] {
    // A Set is used to automatically handle duplicates between the two sources.
    const combinedKeys = new Set([...internalWords.keys(), ...persistentCache.keys()]);
    return Array.from(combinedKeys);
}

export const dictionaryService = {
  isValidWord,
  getDefinition,
  lookupWord,
  getDictionaryWords,
  getAllKnownWords,
};
