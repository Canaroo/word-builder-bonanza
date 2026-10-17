// Word validation and definitions.
//
// Validity comes from the bundled word list (public/words/wordlist.txt, built by
// scripts/build-wordlist.mjs), loaded once in a background worker. Definitions come
// from data/internalWords.ts, then a small on-device cache, then dictionaryapi.dev,
// which is never used to decide whether a word is valid.
import { internalWords } from '../data/internalWords';
import { canBeMadeFromLetters } from './rackMatch';
import type { FindWordOptions } from './wordIndex';
import type { DictionaryRequest, DictionaryResponse } from './dictionary.worker';
import { storage, STORAGE_KEYS } from './storage';

export interface WordDataResult {
    isValid: boolean;
    definition?: string | null;
}

const WORD_LIST_URL = `${import.meta.env.BASE_URL}words/wordlist.txt`;
const DEFINITION_TIMEOUT_MS = 1200;
const MAX_CACHED_DEFINITIONS = 500;

// --- Word list worker ---------------------------------------------------------

type WorkerRequest = DictionaryRequest extends infer R ? R extends { id: number } ? Omit<R, 'id'> : never : never;

let worker: Worker | null = null;
let readyPromise: Promise<boolean> | null = null;
let nextRequestId = 1;
const pending = new Map<number, (result: boolean | string | null) => void>();

/** Starts loading the word list. Resolves true when ready, false if it couldn't load. */
const preload = (): Promise<boolean> => {
    if (readyPromise) return readyPromise;
    readyPromise = new Promise<boolean>((resolve) => {
        try {
            worker = new Worker(new URL('./dictionary.worker.ts', import.meta.url), { type: 'module' });
        } catch (error) {
            console.error('Could not start the dictionary worker.', error);
            resolve(false);
            return;
        }
        worker.onmessage = (event: MessageEvent<DictionaryResponse>) => {
            const msg = event.data;
            if (msg.type === 'ready') {
                resolve(true);
            } else if (msg.type === 'error') {
                console.error('Word list failed to load; falling back to the online dictionary.', msg.message);
                resolve(false);
            } else {
                pending.get(msg.id)?.(msg.result);
                pending.delete(msg.id);
            }
        };
        worker.onerror = (event) => {
            console.error('Dictionary worker crashed.', event);
            resolve(false);
        };
        worker.postMessage({ type: 'load', url: new URL(WORD_LIST_URL, location.href).href });
    });
    return readyPromise;
};

const ask = async <T extends boolean | string | null>(request: WorkerRequest): Promise<T | undefined> => {
    if (!(await preload()) || !worker) return undefined;
    const id = nextRequestId++;
    return new Promise<T>((resolve) => {
        pending.set(id, resolve as (result: boolean | string | null) => void);
        worker!.postMessage({ ...request, id });
    });
};

// --- Definitions --------------------------------------------------------------

// Word -> definition, most recently used last.
const definitionCache = new Map<string, string>(
    (() => {
        const saved = storage.getJSON<unknown>(STORAGE_KEYS.definitionCache, []);
        return Array.isArray(saved) ? (saved as [string, string][]).slice(-MAX_CACHED_DEFINITIONS) : [];
    })()
);

const rememberDefinition = (word: string, definition: string) => {
    definitionCache.delete(word);
    definitionCache.set(word, definition);
    while (definitionCache.size > MAX_CACHED_DEFINITIONS) {
        definitionCache.delete(definitionCache.keys().next().value!);
    }
    storage.setJSON(STORAGE_KEYS.definitionCache, Array.from(definitionCache.entries()));
};

/**
 * Asks dictionaryapi.dev about a word.
 * Returns the definition, null if the API doesn't know the word, or undefined on a network/server error.
 */
async function fetchFromApi(word: string, timeoutMs?: number): Promise<string | null | undefined> {
    try {
        const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, {
            signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined,
        });
        if (response.status === 404) return null;
        if (!response.ok) return undefined;
        const data = await response.json();
        return data[0]?.meanings[0]?.definitions[0]?.definition || 'Definition not available.';
    } catch {
        return undefined;
    }
}

const knownDefinition = (wordLower: string): string | undefined =>
    internalWords.get(wordLower) ?? definitionCache.get(wordLower);

/** Fetches a definition for display, waiting at most DEFINITION_TIMEOUT_MS. */
async function lookupDefinition(wordLower: string): Promise<string | null> {
    const known = knownDefinition(wordLower);
    if (known) return known;
    const definition = await fetchFromApi(wordLower, DEFINITION_TIMEOUT_MS);
    if (definition) {
        rememberDefinition(wordLower, definition);
        return definition;
    }
    return null;
}

// --- Public API ---------------------------------------------------------------

/** Checks a word against the word list and returns its definition when one is known. */
async function lookupWord(word: string): Promise<WordDataResult> {
    const wordLower = word.trim().toLowerCase();
    if (!wordLower) return { isValid: false };

    const inList = await ask<boolean>({ type: 'has', word: wordLower });

    if (inList === undefined) {
        // Word list unavailable (e.g. first launch while offline): use the old online check.
        if (internalWords.has(wordLower)) return { isValid: true, definition: internalWords.get(wordLower) };
        const definition = await fetchFromApi(wordLower);
        if (definition) rememberDefinition(wordLower, definition);
        return { isValid: !!definition, definition };
    }

    if (!inList) return { isValid: false };
    return { isValid: true, definition: await lookupDefinition(wordLower) };
}

async function isValidWord(word: string): Promise<boolean> {
    return (await lookupWord(word)).isValid;
}

async function getDefinition(word: string): Promise<string | null> {
    return lookupDefinition(word.trim().toLowerCase());
}

/**
 * Finds a word that can be spelled from the given tile letters, or null if none.
 * Curated internal words are preferred (they have fun definitions); the full list is searched next.
 */
async function findPlayableWord(letters: string[], options: FindWordOptions = {}): Promise<string | null> {
    const { minLength = 3, longest = false } = options;
    let bestInternal: string | null = null;
    for (const w of internalWords.keys()) {
        if (w.length >= minLength && canBeMadeFromLetters(w, letters)) {
            if (!longest) return w;
            if (!bestInternal || w.length > bestInternal.length) bestInternal = w;
        }
    }
    const fromList = await ask<string | null>({ type: 'find', letters, options: { minLength, longest } });
    if (longest && bestInternal && (!fromList || bestInternal.length >= fromList.length)) return bestInternal;
    return fromList ?? bestInternal;
}

/**
 * Words from the curated internal dictionary only. Used for synchronous setup tasks
 * such as finding 3-letter words when balancing a rack.
 */
function getDictionaryWords(): IterableIterator<string> {
    return internalWords.keys();
}

export const dictionaryService = {
    preload,
    isValidWord,
    getDefinition,
    lookupWord,
    findPlayableWord,
    getDictionaryWords,
};
