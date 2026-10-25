// Online leaderboard on Firebase Realtime Database, over its plain REST API (fetch + JSON).
// No Firebase SDK or live socket: just the same web requests a browser makes when it opens the
// database URL, which work on networks where the SDK's websocket is slow or blocked.
import { LeaderboardEntry, PlayerFlair } from '../types';
import { cosmeticById } from '../data/cosmetics';
import { BOSSES } from '../data/bosses';

const LEADERBOARD_PATH = 'leaderboard';
const TOP_N = 50;
const TIMEOUT_MS = 8000;

const env = import.meta.env;
const databaseURL = String(env.VITE_FIREBASE_DATABASE_URL ?? '').replace(/\/+$/, '');

/** Online play is on when the database is configured and VITE_LEADERBOARD isn't "local". */
export const isOnlineLeaderboardEnabled = (): boolean =>
    env.VITE_LEADERBOARD !== 'local' && !!databaseURL;

/** A failed online request, with a short reason the board can show ("timed out", "permission denied"). */
export class LeaderboardError extends Error {
    constructor(public reason: string, public status = 0) {
        super(`Online leaderboard: ${reason}`);
    }
}

const request = async (path: string, init?: RequestInit): Promise<any> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res: Response;
    try {
        res = await fetch(`${databaseURL}/${path}`, { ...init, signal: controller.signal });
    } catch (e) {
        throw new LeaderboardError(controller.signal.aborted ? 'timed out' : 'no connection');
    } finally {
        clearTimeout(timer);
    }
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new LeaderboardError(String(body?.error ?? `error ${res.status}`).toLowerCase(), res.status);
    return body;
};

const toEntry = (id: string, row: any): LeaderboardEntry | null => {
    const ms = typeof row?.timestamp === 'number' ? row.timestamp
        : typeof row?.date === 'number' ? row.date
        : Date.parse(String(row?.date ?? ''));
    if (typeof row?.name !== 'string' || typeof row?.score !== 'number') return null;
    return {
        id, name: row.name, score: row.score, date: Number.isFinite(ms) ? new Date(ms).toISOString() : '',
        // Bling is only shown if it's a real item (anything else in the database is ignored).
        badge: cosmeticById(row.badge)?.kind === 'badge' ? row.badge : null,
        title: cosmeticById(row.title)?.kind === 'title' ? row.title : null,
        streak: Number.isInteger(row.streak) && row.streak > 0 ? Math.min(row.streak, 9999) : 0,
        bosses: Number.isInteger(row.bosses) && row.bosses > 0 ? Math.min(row.bosses, BOSSES.length) : 0,
    };
};

/** Top scores, highest first. */
const list = async (): Promise<LeaderboardEntry[]> => {
    const data = await request(`${LEADERBOARD_PATH}.json?orderBy=%22score%22&limitToLast=${TOP_N}`);
    const rows = Object.entries(data ?? {})
        .map(([id, row]) => toEntry(id, row))
        .filter((e): e is LeaderboardEntry => e !== null);
    return rows.sort((a, b) => b.score - a.score).map((e, i) => ({ ...e, rank: i + 1 }));
};

/**
 * Writes { name, score, timestamp } plus the player's badge, title, streak and Boss Badge count,
 * and returns the new entry's id. If the database rules reject the extra fields, it tries again
 * without the newest one (Boss Badges, for rules not updated yet), then with the score alone, so
 * nothing is lost.
 */
const submit = async (name: string, score: number, flair?: PlayerFlair): Promise<string> => {
    // The server fills in the timestamp, so the rules can check it against its own clock.
    const base = { name, score, timestamp: { '.sv': 'timestamp' } };
    const extras: Record<string, unknown> = {};
    if (flair?.badge) extras.badge = flair.badge;
    if (flair?.title) extras.title = flair.title;
    if (flair?.streak) extras.streak = flair.streak;
    if (flair?.bosses) extras.bosses = flair.bosses;
    const post = (body: object) => request(`${LEADERBOARD_PATH}.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    // Only a rules rejection is worth retrying with fewer fields.
    const rejected = (e: unknown) => e instanceof LeaderboardError && (e.status === 400 || e.status === 401 || e.status === 403);
    const { bosses, ...olderExtras } = extras;
    const attempts = [extras, ...(bosses !== undefined && Object.keys(olderExtras).length ? [olderExtras] : [])].filter(x => Object.keys(x).length);
    for (const fields of attempts) {
        try {
            return (await post({ ...base, ...fields })).name;
        } catch (e) {
            if (!rejected(e)) throw e;
            console.warn(`Leaderboard rejected ${Object.keys(fields).join('/')}; trying with fewer fields.`, e);
        }
    }
    return (await post(base)).name;
};

export const onlineLeaderboard = { list, submit };
