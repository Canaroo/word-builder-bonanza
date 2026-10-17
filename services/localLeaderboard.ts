import { LeaderboardEntry } from '../types';
import { storage, STORAGE_KEYS } from './storage';

// Scores played on this device. Always written, so there is a board to show offline.
export const MAX_LEADERBOARD_ENTRIES = 50;

const readBoard = (): LeaderboardEntry[] => {
    const rows = storage.getJSON<unknown>(STORAGE_KEYS.leaderboard, []);
    if (!Array.isArray(rows)) return [];
    return rows
        .filter((r): r is LeaderboardEntry =>
            typeof r?.name === 'string' && typeof r?.score === 'number' && typeof r?.date === 'string')
        .sort((a, b) => b.score - a.score);
};

/** Adds a score and returns its 1-based rank, or 0 if it didn't make the board. */
const submit = (entry: LeaderboardEntry): number => {
    // Ties keep the earlier score ahead.
    const board = [...readBoard(), entry]
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_LEADERBOARD_ENTRIES);
    storage.setJSON(STORAGE_KEYS.leaderboard, board);
    return board.indexOf(entry) + 1;
};

const list = (): LeaderboardEntry[] => readBoard().map((entry, i) => ({ ...entry, rank: i + 1 }));

const clear = () => storage.remove(STORAGE_KEYS.leaderboard);

export const localLeaderboard = { submit, list, clear };
