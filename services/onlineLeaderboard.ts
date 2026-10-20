// Online leaderboard on Firebase Realtime Database.
// The SDK is loaded on first use, so it costs nothing until someone opens or submits to the board.
import type { Database } from 'firebase/database';
import { LeaderboardEntry, PlayerFlair } from '../types';
import { cosmeticById } from '../data/cosmetics';

const LEADERBOARD_PATH = 'leaderboard';
const TOP_N = 50;
const TIMEOUT_MS = 5000;

const env = import.meta.env;
const firebaseConfig = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    databaseURL: env.VITE_FIREBASE_DATABASE_URL,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    appId: env.VITE_FIREBASE_APP_ID,
};

/** Online play is on when the database is configured and VITE_LEADERBOARD isn't "local". */
export const isOnlineLeaderboardEnabled = (): boolean =>
    env.VITE_LEADERBOARD !== 'local' && !!firebaseConfig.databaseURL && !!firebaseConfig.apiKey;

let dbPromise: Promise<Database> | null = null;
const getDb = (): Promise<Database> => {
    dbPromise ??= (async () => {
        const [{ initializeApp, getApps }, { getDatabase }] = await Promise.all([
            import('firebase/app'),
            import('firebase/database'),
        ]);
        const app = getApps()[0] ?? initializeApp(firebaseConfig);
        return getDatabase(app);
    })();
    return dbPromise;
};

// Realtime Database calls wait forever while offline; give up on the whole request so the game can fall back.
const withTimeout = <T>(promise: Promise<T>): Promise<T> =>
    Promise.race([
        promise,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Leaderboard request timed out')), TIMEOUT_MS)),
    ]);

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
    };
};

/** Top scores, highest first. */
const list = (): Promise<LeaderboardEntry[]> => withTimeout((async () => {
    const db = await getDb();
    const { ref, query, orderByChild, limitToLast, get } = await import('firebase/database');
    const snapshot = await get(query(ref(db, LEADERBOARD_PATH), orderByChild('score'), limitToLast(TOP_N)));
    const rows: LeaderboardEntry[] = [];
    snapshot.forEach(child => {
        const entry = toEntry(child.key!, child.val());
        if (entry) rows.push(entry);
    });
    return rows.sort((a, b) => b.score - a.score).map((e, i) => ({ ...e, rank: i + 1 }));
})());

/**
 * Writes { name, score, timestamp } plus the player's badge, title and streak, and returns the
 * new entry's id. If the database rules don't allow the extra fields yet (they need the
 * update in docs/FIREBASE_RULES.md), it writes the score alone so nothing is lost.
 */
const submit = (name: string, score: number, flair?: PlayerFlair): Promise<string> => withTimeout((async () => {
    const db = await getDb();
    const { ref, push, set, serverTimestamp } = await import('firebase/database');
    const base = { name, score, timestamp: serverTimestamp() };
    const extras: Record<string, unknown> = {};
    if (flair?.badge) extras.badge = flair.badge;
    if (flair?.title) extras.title = flair.title;
    if (flair?.streak) extras.streak = flair.streak;
    // push() picks the id locally, so it's known before the write finishes.
    const newRef = push(ref(db, LEADERBOARD_PATH));
    if (Object.keys(extras).length) {
        try {
            await set(newRef, { ...base, ...extras });
            return newRef.key!;
        } catch (e) {
            console.warn('Leaderboard rejected badge/title/streak; posting the score without them.', e);
        }
    }
    await set(newRef, base);
    return newRef.key!;
})());

export const onlineLeaderboard = { list, submit };
