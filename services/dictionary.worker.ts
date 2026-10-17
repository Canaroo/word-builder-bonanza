/// <reference lib="webworker" />
// Loads the full word list off the main thread and answers lookups.
import { createWordIndex, parseWordList, WordIndex, FindWordOptions } from './wordIndex';

export type DictionaryRequest =
    | { id: number; type: 'has'; word: string }
    | { id: number; type: 'find'; letters: string[]; options?: FindWordOptions };

export type DictionaryResponse =
    | { type: 'ready'; size: number }
    | { type: 'error'; message: string }
    | { id: number; type: 'result'; result: boolean | string | null };

declare const self: DedicatedWorkerGlobalScope;

let index: WordIndex | null = null;

const fetchList = async (url: string): Promise<string[]> => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
    return parseWordList(await response.text());
};

const load = async (url: string, commonUrl: string) => {
    try {
        const [words, common] = await Promise.all([
            fetchList(url),
            // Without the common list, Challenge and hints fall back to searching everything.
            fetchList(commonUrl).catch(() => undefined),
        ]);
        index = createWordIndex(words, common);
        self.postMessage({ type: 'ready', size: index.size } satisfies DictionaryResponse);
    } catch (error) {
        self.postMessage({ type: 'error', message: String(error) } satisfies DictionaryResponse);
    }
};

self.onmessage = (event: MessageEvent<DictionaryRequest | { type: 'load'; url: string; commonUrl: string }>) => {
    const msg = event.data;
    if (msg.type === 'load') {
        load(msg.url, msg.commonUrl);
        return;
    }
    if (!index) return; // The client only sends lookups after 'ready'.
    const result = msg.type === 'has' ? index.has(msg.word) : index.findPlayable(msg.letters, msg.options);
    self.postMessage({ id: msg.id, type: 'result', result } satisfies DictionaryResponse);
};
