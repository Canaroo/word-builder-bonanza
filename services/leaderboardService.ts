import { LeaderboardEntry, PlayerFlair } from '../types';
import { storage, STORAGE_KEYS } from './storage';
import { localLeaderboard, MAX_LEADERBOARD_ENTRIES } from './localLeaderboard';
import { onlineLeaderboard, isOnlineLeaderboardEnabled } from './onlineLeaderboard';

export { MAX_LEADERBOARD_ENTRIES };

export type LeaderboardSource = 'online' | 'local';

export interface LeaderboardResult {
    entries: LeaderboardEntry[];
    source: LeaderboardSource;
}

export interface SubmitResult {
    /** 1-based rank on the board that was updated, or 0 if it didn't make the top 50. */
    rank: number;
    source: LeaderboardSource;
}

/** The last score this device submitted, used to highlight it on the board. */
export interface SubmittedScore {
    id?: string;
    name: string;
    score: number;
    date: string;
}

const MAX_NAME_LENGTH = 20;

/**
 * Cleans a name to what the online board accepts: letters, numbers, spaces and _ . ' -
 * Accents are dropped (José → Jose), curly apostrophes straightened, anything else removed.
 */
export const sanitizeName = (raw: string): string =>
    raw
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[\u2018\u2019\u02BC]/g, "'")
        .replace(/[^A-Za-z0-9 _.'-]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, MAX_NAME_LENGTH)
        .trim() || 'Player';
// After the online board fails, use the device board for a while instead of waiting again.
const RETRY_ONLINE_AFTER_MS = 60_000;
let onlineFailedAt = 0;

const shouldTryOnline = (): boolean =>
    isOnlineLeaderboardEnabled() &&
    (typeof navigator === 'undefined' || navigator.onLine !== false) &&
    Date.now() - onlineFailedAt > RETRY_ONLINE_AFTER_MS;

const noteOnlineFailure = (error: unknown, what: string) => {
    onlineFailedAt = Date.now();
    console.warn(`Online leaderboard unavailable; ${what}.`, error);
};

/**
 * Saves a score on this device and, when online play is enabled, to the online board.
 * Falls back to the device board if the online one can't be reached.
 */
const submitScore = async (rawName: string, score: number, flair?: PlayerFlair): Promise<SubmitResult> => {
    const name = sanitizeName(rawName);
    const entry: LeaderboardEntry = { name, score, date: new Date().toISOString(), ...(flair ?? {}) };
    const localRank = localLeaderboard.submit(entry);
    const last: SubmittedScore = { name, score, date: entry.date };

    if (shouldTryOnline()) {
        try {
            last.id = await onlineLeaderboard.submit(name, score, flair);
            storage.setJSON(STORAGE_KEYS.lastSubmittedScore, last);
            const board = await onlineLeaderboard.list();
            return { rank: board.findIndex(e => e.id === last.id) + 1, source: 'online' };
        } catch (error) {
            noteOnlineFailure(error, 'score saved on this device');
        }
    }

    storage.setJSON(STORAGE_KEYS.lastSubmittedScore, last);
    return { rank: localRank, source: 'local' };
};

/** The online board when it's reachable, otherwise this device's scores. */
const getLeaderboard = async (): Promise<LeaderboardResult> => {
    if (shouldTryOnline()) {
        try {
            return { entries: await onlineLeaderboard.list(), source: 'online' };
        } catch (error) {
            noteOnlineFailure(error, 'showing this device');
        }
    }
    return { entries: localLeaderboard.list(), source: 'local' };
};

const getLastSubmitted = (): SubmittedScore | null =>
    storage.getJSON<SubmittedScore | null>(STORAGE_KEYS.lastSubmittedScore, null);

/** Whether an entry is the score this device submitted last. */
const isLastSubmitted = (entry: LeaderboardEntry, last: SubmittedScore | null): boolean =>
    !!last && (entry.id ? entry.id === last.id : entry.date === last.date && entry.score === last.score);

/** Test hook: forget a recent online failure. */
const resetOnlineBackoff = () => { onlineFailedAt = 0; };

export const leaderboardService = {
    submitScore,
    getLeaderboard,
    getLastSubmitted,
    isLastSubmitted,
    isOnline: isOnlineLeaderboardEnabled,
    resetOnlineBackoff,
};
