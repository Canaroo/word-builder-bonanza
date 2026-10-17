import { LeaderboardEntry } from '../types';
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
 * Saves a score on this device and, when online play is enabled, to the online board.
 * Falls back to the device board if the online one can't be reached.
 */
const submitScore = async (rawName: string, score: number): Promise<SubmitResult> => {
    const name = rawName.trim().slice(0, MAX_NAME_LENGTH) || 'Player';
    const entry: LeaderboardEntry = { name, score, date: new Date().toISOString() };
    const localRank = localLeaderboard.submit(entry);
    const last: SubmittedScore = { name, score, date: entry.date };

    if (isOnlineLeaderboardEnabled()) {
        try {
            last.id = await onlineLeaderboard.submit(name, score);
            storage.setJSON(STORAGE_KEYS.lastSubmittedScore, last);
            const board = await onlineLeaderboard.list();
            return { rank: board.findIndex(e => e.id === last.id) + 1, source: 'online' };
        } catch (error) {
            console.warn('Online leaderboard unavailable; score saved on this device.', error);
        }
    }

    storage.setJSON(STORAGE_KEYS.lastSubmittedScore, last);
    return { rank: localRank, source: 'local' };
};

/** The online board when it's reachable, otherwise this device's scores. */
const getLeaderboard = async (): Promise<LeaderboardResult> => {
    if (isOnlineLeaderboardEnabled()) {
        try {
            return { entries: await onlineLeaderboard.list(), source: 'online' };
        } catch (error) {
            console.warn('Online leaderboard unavailable; showing this device.', error);
        }
    }
    return { entries: localLeaderboard.list(), source: 'local' };
};

const getLastSubmitted = (): SubmittedScore | null =>
    storage.getJSON<SubmittedScore | null>(STORAGE_KEYS.lastSubmittedScore, null);

/** Whether an entry is the score this device submitted last. */
const isLastSubmitted = (entry: LeaderboardEntry, last: SubmittedScore | null): boolean =>
    !!last && (entry.id ? entry.id === last.id : entry.date === last.date && entry.score === last.score);

export const leaderboardService = {
    submitScore,
    getLeaderboard,
    getLastSubmitted,
    isLastSubmitted,
    isOnline: isOnlineLeaderboardEnabled,
};
