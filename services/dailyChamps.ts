// 🏆 Daily Champ (v7.99.0, the owner's design): whoever posts the top score on a Daily Challenge wins that day.
// Every client works the winners out from the finished boards (daily/<day> in Firebase), so nothing new is stored
// online and nobody has to run a job when the day turns over. Ties all win. Counted from DAILY_CHAMP.firstDay.
import { useEffect, useState } from 'react';
import { DAILY_CHAMP } from '../config/progression';
import { dayKey } from './progression';
import { dailyNumber } from './daily';
import { onlineLeaderboard, isOnlineLeaderboardEnabled } from './onlineLeaderboard';
import { storage, STORAGE_KEYS } from './storage';
import { playerKey } from './players';

/** Names compare like the rest of the game (players.sameName): trimmed, any case. */
export const champKey = (name: string) => name.trim().toUpperCase();

type Boards = Record<string, Record<string, { name?: unknown; score?: unknown }>>;

/** The winners of each finished day (from firstDay, before today): day → names with the top score. */
export const championsByDay = (boards: Boards, today: string, firstDay = DAILY_CHAMP.firstDay): Record<string, string[]> => {
    const out: Record<string, string[]> = {};
    for (const [day, board] of Object.entries(boards ?? {})) {
        if (day < firstDay || day >= today || !board) continue;
        const rows = Object.values(board)
            .filter(r => typeof r?.name === 'string' && r.name.trim() && typeof r?.score === 'number' && Number.isFinite(r.score) && (r.score as number) > 0)
            .map(r => ({ name: (r.name as string).trim(), score: r.score as number }));
        if (!rows.length) continue;
        const top = Math.max(...rows.map(r => r.score));
        const names = [...new Map(rows.filter(r => r.score === top).map(r => [champKey(r.name), r.name])).values()];
        out[day] = names;
    }
    return out;
};

/** How many days each name has won (keyed by champKey). */
export const winsByName = (champs: Record<string, string[]>): Record<string, number> => {
    const wins: Record<string, number> = {};
    for (const names of Object.values(champs)) for (const n of names) wins[champKey(n)] = (wins[champKey(n)] ?? 0) + 1;
    return wins;
};

/** Days this name won that haven't been celebrated yet, oldest first. */
export const unseenWins = (champs: Record<string, string[]>, name: string, seen: readonly string[]): string[] =>
    Object.keys(champs).filter(day => champs[day].some(n => champKey(n) === champKey(name)) && !seen.includes(day)).sort();

export const winsSeen = (): string[] => {
    const v = storage.getJSON<string[]>(playerKey(STORAGE_KEYS.dailyWinsSeen), []);
    return Array.isArray(v) ? v : [];
};
export const markWinsSeen = (days: readonly string[]) => storage.setJSON(playerKey(STORAGE_KEYS.dailyWinsSeen), [...new Set([...winsSeen(), ...days])]);

/** "Daily #21" for a day key. */
export const dailyLabel = (day: string) => `Daily #${dailyNumber(day)}`;

// One fetch per session (refreshed after refreshMs or when the day turns over), shared by every screen.
type Snapshot = { champs: Record<string, string[]>; wins: Record<string, number>; today: string; at: number };
const CACHE = 'wordNerdDailyChamps';
let snapshot: Snapshot | null = (() => { try { return JSON.parse(sessionStorage.getItem(CACHE) ?? 'null'); } catch { return null; } })();
let pending: Promise<Snapshot | null> | null = null;
const listeners = new Set<(s: Snapshot) => void>();

export const loadDailyChamps = (force = false): Promise<Snapshot | null> => {
    const today = dayKey(new Date());
    if (!force && snapshot && snapshot.today === today && Date.now() - snapshot.at < DAILY_CHAMP.refreshMs) return Promise.resolve(snapshot);
    if (!isOnlineLeaderboardEnabled()) return Promise.resolve(snapshot);
    if (pending) return pending;
    pending = onlineLeaderboard.dailyBoardsFrom(DAILY_CHAMP.firstDay)
        .then(boards => {
            const champs = championsByDay(boards, today);
            snapshot = { champs, wins: winsByName(champs), today, at: Date.now() };
            try { sessionStorage.setItem(CACHE, JSON.stringify(snapshot)); } catch { /* private mode */ }
            listeners.forEach(l => l(snapshot!));
            return snapshot;
        })
        .catch(() => snapshot)
        .finally(() => { pending = null; });
    return pending;
};

/** The Daily Champ wins table for any screen; it fills in once the boards load. */
export const useDailyChamps = () => {
    const [snap, setSnap] = useState<Snapshot | null>(snapshot);
    useEffect(() => {
        listeners.add(setSnap);
        loadDailyChamps().then(s => { if (s) setSnap(s); });
        return () => { listeners.delete(setSnap); };
    }, []);
    return {
        champs: snap?.champs ?? {},
        winsFor: (name?: string | null) => (name ? snap?.wins[champKey(name)] ?? 0 : 0),
        ready: !!snap,
    };
};
