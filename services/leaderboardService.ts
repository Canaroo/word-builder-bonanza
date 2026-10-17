import { LeaderboardEntry } from '../types';
import { storage, STORAGE_KEYS } from './storage';

// Scores are kept on this device only.
export const MAX_LEADERBOARD_ENTRIES = 50;

export interface SubmittedScore {
    name: string;
    score: number;
    date: string;
}

const readBoard = (): LeaderboardEntry[] => {
    const rows = storage.getJSON<unknown>(STORAGE_KEYS.leaderboard, []);
    if (!Array.isArray(rows)) return [];
    return rows
        .filter((r): r is LeaderboardEntry =>
            typeof r?.name === 'string' && typeof r?.score === 'number' && typeof r?.date === 'string')
        .sort((a, b) => b.score - a.score);
};

/**
 * Adds a score and returns its 1-based rank, or 0 if it didn't make the board.
 */
const submitScore = async (name: string, score: number): Promise<number> => {
    const entry: LeaderboardEntry = { name, score, date: new Date().toISOString() };
    // Ties keep the earlier score ahead.
    const board = [...readBoard(), entry]
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_LEADERBOARD_ENTRIES);

    storage.setJSON(STORAGE_KEYS.leaderboard, board);
    storage.setJSON(STORAGE_KEYS.lastSubmittedScore, entry satisfies SubmittedScore);

    return board.indexOf(entry) + 1;
};

const getLeaderboard = async (): Promise<LeaderboardEntry[]> =>
    readBoard().map((entry, i) => ({ ...entry, rank: i + 1 }));

const getLastSubmitted = (): SubmittedScore | null =>
    storage.getJSON<SubmittedScore | null>(STORAGE_KEYS.lastSubmittedScore, null);

const clearLeaderboard = () => {
    storage.remove(STORAGE_KEYS.leaderboard);
    storage.remove(STORAGE_KEYS.lastSubmittedScore);
};

export const leaderboardService = {
    submitScore,
    getLeaderboard,
    getLastSubmitted,
    clearLeaderboard,
};
