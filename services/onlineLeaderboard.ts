// Online leaderboard on Firebase Realtime Database.
// The SDK is loaded on first use, so it costs nothing until someone opens or submits to the board.
import type { Database } from 'firebase/database';
import { LeaderboardEntry } from '../types';

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
    return { id, name: row.name, score: row.score, date: Number.isFinite(ms) ? new Date(ms).toISOString() : '' };
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
 * Writes { name, score, timestamp } — exactly the fields the database rules allow —
 * and returns the new entry's id.
 */
const submit = (name: string, score: number): Promise<string> => withTimeout((async () => {
    const db = await getDb();
    const { ref, push, set, serverTimestamp } = await import('firebase/database');
    // push() picks the id locally, so it's known before the write finishes.
    const newRef = push(ref(db, LEADERBOARD_PATH));
    await set(newRef, { name, score, timestamp: serverTimestamp() });
    return newRef.key!;
})());

export const onlineLeaderboard = { list, submit };
