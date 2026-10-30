// Anonymous usage stats: small events (a boss reached or finished, a mission shown or done, a
// run's summary) appended to /stats in the same Firebase database as the leaderboard. No names,
// no device id. Sending is fire-and-forget: it never waits, retries or interrupts the game.
// Read them on the hidden page at /?stats. Rules: docs/LEADERBOARD.md.
import { isOnlineLeaderboardEnabled } from './onlineLeaderboard';

export type StatEvent =
    | { type: 'boss_start'; boss: string; number: number }
    | { type: 'boss_end'; boss: string; number: number; outcome: 'won' | 'close' | 'escaped'; hits: number }
    | { type: 'mission_shown'; mission: string; tier: number }
    | { type: 'mission_done'; mission: string; tier: number }
    | { type: 'run_end'; score: number; words: number; level: number; bosses: number }
    | { type: 'power_word'; power: 'slot' | 'freeze' | 'heal' | 'slow' | 'twin'; repeat: boolean; seconds: number; strike: boolean };

export type StoredStat = StatEvent & { timestamp: number };

const STATS_PATH = 'stats';
const databaseURL = () => String(import.meta.env.VITE_FIREBASE_DATABASE_URL ?? '').replace(/\/+$/, '');

let forced: boolean | null = null;
/** Tests turn sending on or off directly (normally it's off in dev and on localhost). */
export const setStatsEnabledForTests = (on: boolean | null) => { forced = on; };

const enabled = (): boolean => {
    if (forced !== null) return forced;
    if (import.meta.env.DEV || !isOnlineLeaderboardEnabled()) return false;
    const host = typeof location !== 'undefined' ? location.hostname : '';
    return host !== 'localhost' && host !== '127.0.0.1';
};

/** Sends one event. Never throws; a lost event is fine. */
export const sendStat = (event: StatEvent): void => {
    if (!enabled()) return;
    try {
        fetch(`${databaseURL()}/${STATS_PATH}.json`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...event, timestamp: { '.sv': 'timestamp' } }),
            keepalive: true, // still sent if the tab is closing (the run summary)
        }).catch(() => {});
    } catch { /* no fetch: ignore */ }
};

/** Events from the last `days` days, oldest first. */
export const fetchStats = async (days: number, now = Date.now()): Promise<StoredStat[]> => {
    const since = now - days * 86_400_000;
    const res = await fetch(`${databaseURL()}/${STATS_PATH}.json?orderBy=%22timestamp%22&startAt=${since}`);
    if (!res.ok) throw new Error(`stats: error ${res.status}`);
    const data = (await res.json()) ?? {};
    return (Object.values(data) as StoredStat[])
        .filter(e => e && typeof e.type === 'string' && typeof e.timestamp === 'number')
        .sort((a, b) => a.timestamp - b.timestamp);
};

export interface StatsSummary {
    runs: { count: number; avgScore: number; medianScore: number; avgWords: number; reachedLevel: Record<number, number> };
    bosses: Record<string, { reached: number; won: number; close: number; escaped: number; avgHits: number }>;
    bossNumbers: Record<number, { reached: number; won: number }>;
    missions: Record<string, { tier: number; shown: number; done: number }>;
    /** Power words by effect: how often they fired (and refired), slot payouts, strikes HEAL removed. */
    powerWords: Record<string, { fired: number; repeats: number; seconds: number; strikes: number; payouts: Record<number, number> }>;
    days: Record<string, { runs: number; bossesWon: number; missionsDone: number }>;
}

const median = (xs: number[]) => {
    if (!xs.length) return 0;
    const s = [...xs].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};
const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Turns raw events into the tables on the stats page. */
export const summarize = (events: StoredStat[]): StatsSummary => {
    const out: StatsSummary = { runs: { count: 0, avgScore: 0, medianScore: 0, avgWords: 0, reachedLevel: {} }, bosses: {}, bossNumbers: {}, missions: {}, powerWords: {}, days: {} };
    const scores: number[] = []; let words = 0;
    const hits: Record<string, number> = {};
    for (const e of events) {
        const day = (out.days[dayOf(e.timestamp)] ??= { runs: 0, bossesWon: 0, missionsDone: 0 });
        if (e.type === 'run_end') {
            out.runs.count++; scores.push(e.score); words += e.words; day.runs++;
            for (let l = 1; l <= e.level; l++) out.runs.reachedLevel[l] = (out.runs.reachedLevel[l] ?? 0) + 1;
        } else if (e.type === 'boss_start' || e.type === 'boss_end') {
            const b = (out.bosses[e.boss] ??= { reached: 0, won: 0, close: 0, escaped: 0, avgHits: 0 });
            const n = (out.bossNumbers[e.number] ??= { reached: 0, won: 0 });
            if (e.type === 'boss_start') { b.reached++; n.reached++; }
            else {
                b[e.outcome]++; hits[e.boss] = (hits[e.boss] ?? 0) + e.hits;
                if (e.outcome === 'won') { n.won++; day.bossesWon++; }
            }
        } else if (e.type === 'power_word') {
            const p = (out.powerWords[e.power] ??= { fired: 0, repeats: 0, seconds: 0, strikes: 0, payouts: {} });
            p.fired++;
            if (e.repeat) p.repeats++;
            p.seconds += e.seconds;
            if (e.strike) p.strikes++;
            if (e.power === 'slot') p.payouts[e.seconds] = (p.payouts[e.seconds] ?? 0) + 1;
        } else if (e.type === 'mission_shown' || e.type === 'mission_done') {
            const m = (out.missions[e.mission] ??= { tier: e.tier, shown: 0, done: 0 });
            if (e.type === 'mission_shown') m.shown++; else { m.done++; day.missionsDone++; }
        }
    }
    out.runs.avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    out.runs.medianScore = median(scores);
    out.runs.avgWords = out.runs.count ? Math.round(words / out.runs.count) : 0;
    for (const [id, b] of Object.entries(out.bosses)) {
        const ended = b.won + b.close + b.escaped;
        b.avgHits = ended ? Math.round((hits[id] ?? 0) / ended * 10) / 10 : 0;
    }
    return out;
};
