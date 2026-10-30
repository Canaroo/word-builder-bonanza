// The current player's career: totals across every finished run, for their ID card.
// Best score and secrets found come from their own saves (personalBest, collection).
import { storage, STORAGE_KEYS } from './storage';
import { playerKey } from './players';
import { getPersonalBest } from './personalBest';
import { getCollection } from './collection';
import type { IdCardStats } from '../types';

interface Career {
    runs: number;
    totalScore: number;
    highestLevel: number;
    bestWord: string;
    bestWordScore: number;
    longestWord: string;
    /** When this player's first counted run finished (ms), for "issued" on the card. */
    since: number | null;
}

const EMPTY: Career = { runs: 0, totalScore: 0, highestLevel: 0, bestWord: '', bestWordScore: 0, longestWord: '', since: null };
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
const word = (v: unknown) => (typeof v === 'string' && /^[A-Za-z]{1,15}$/.test(v) ? v.toUpperCase() : '');

export const getCareer = (): Career => {
    const saved = storage.getJSON<Partial<Career> | null>(playerKey(STORAGE_KEYS.career), null);
    if (!saved || typeof saved !== 'object') return { ...EMPTY };
    return {
        runs: num(saved.runs), totalScore: num(saved.totalScore), highestLevel: num(saved.highestLevel),
        bestWord: word(saved.bestWord), bestWordScore: num(saved.bestWordScore), longestWord: word(saved.longestWord),
        since: typeof saved.since === 'number' ? saved.since : null,
    };
};

/** Adds a finished run to the current player's career. */
export const recordCareerRun = (run: { score: number; level: number; bestWord?: { word: string; score: number } | null; longestWord?: string }, now = Date.now()) => {
    const c = getCareer();
    c.runs += 1;
    c.totalScore += Math.max(0, Math.round(run.score));
    c.highestLevel = Math.max(c.highestLevel, run.level);
    const best = run.bestWord && word(run.bestWord.word);
    if (best && run.bestWord!.score > c.bestWordScore) { c.bestWord = best; c.bestWordScore = Math.round(run.bestWord!.score); }
    const longest = word(run.longestWord);
    if (longest.length > c.longestWord.length) c.longestWord = longest;
    c.since ??= now;
    storage.setJSON(playerKey(STORAGE_KEYS.career), c);
};

/** The 8 stats on the current player's ID card. */
export const idCardStats = (): IdCardStats => {
    const c = getCareer();
    return {
        runs: c.runs,
        best: getPersonalBest(),
        avg: c.runs ? Math.round(c.totalScore / c.runs) : 0,
        level: Math.max(1, c.highestLevel),
        word: c.bestWord,
        wordScore: c.bestWordScore,
        longest: c.longestWord,
        secrets: Object.keys(getCollection()).length,
    };
};
