// Anonymous usage stats: small events (a boss reached or finished, a mission shown or done, a
// run's summary) appended to /stats in the same Firebase database as the leaderboard. No names,
// no device id. Sending is fire-and-forget: it never waits, retries or interrupts the game.
// Read them on the hidden page at /?stats. Rules: docs/LEADERBOARD.md.
import { isOnlineLeaderboardEnabled } from './onlineLeaderboard';
import type { PowerWordEffect } from '../types';

export type StatEvent =
    | { type: 'boss_start'; boss: string; number: number }
    | { type: 'boss_end'; boss: string; number: number; outcome: 'won' | 'close' | 'escaped'; hits: number }
    | { type: 'mission_shown'; mission: string; tier: number }
    | { type: 'mission_done'; mission: string; tier: number }
    | { type: 'run_end'; score: number; words: number; level: number; bosses: number; charms?: string; daily?: boolean }
    // Charm and PowerPlay offers (ids joined with commas; picked is '' for a pass or a keep), and uses.
    | { type: 'charm_offer'; offered: string; picked: string; level: number }
    | { type: 'pp_offer'; offered: string; picked: string; level: number }
    | { type: 'pp_use'; pp: string; level: number }
    // Phoenix Down: the continue offer at the end of a run, and whether it was bought.
    | { type: 'continue_offer'; taken: boolean; level: number; reason: 'strikes' | 'time' }
    // Power word hint chip shown (v7.41); a power_word that follows one carries `hinted`.
    | { type: 'pw_hint'; power: PowerWordEffect; level: number }
    // Bones (v7.44): a fallen player's hand was found; taken = a charm was won from it.
    | { type: 'bones'; taken: boolean; level: number }
    | { type: 'power_word'; power: PowerWordEffect; repeat: boolean; seconds: number; strike: boolean }
    // v7.61.1 (docs/FEATURE_REVIEW.md): the Fork pick (or a cool-off), each Golden Round, each Score Gate.
    | { type: 'fork'; choice: 'easy' | 'danger' | 'bail'; level: number; clock: number; advice?: 'easy' | 'danger' | 'either' }
    | { type: 'golden'; level: number; score: number; tile: boolean; ok: boolean }
    | { type: 'gate'; gate: number; result: 'played' | 'skip'; points: number };

export type StoredStat = StatEvent & StatExtras & { timestamp: number };

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

/**
 * Newer fields (v7.33) that the Firebase rules may not allow yet. They ride along as `extras`: if
 * the database rejects the event with them, it is sent again without them, so nothing is lost.
 * run_end: how the run ended, seconds the clock ran, seconds earned from words / items / shuffles,
 * and charm upgrades taken. charm_offer: the equipped charm that was upgraded instead of a pick.
 */
export interface StatExtras {
    cause?: 'clock' | 'strikes';
    secs?: number;
    tWords?: number;
    tItems?: number;
    tShuffles?: number;
    upgrades?: number;
    upgraded?: string;
    /** power_word (v7.41): the hint chip was showing for this word. */
    hinted?: boolean;
    /** pp_offer (v7.41): the PowerPlay hidden in that offer's Mystery Tape. */
    mystery?: string;
    /** pp_use (v7.61.1): the PowerPlay came out of a Mystery Tape. */
    tape?: boolean;
    /** run_end (v7.61.1): Golden Rounds, the last Fork route, cool-offs, Skill Shot hits, gems earned, Last Words points. */
    golden?: number;
    route?: 'easy' | 'danger';
    bails?: number;
    skill?: number;
    gems?: number;
    lastWords?: number;
}

/**
 * run_end extras (v7.61.1), read from the run's log so nothing extra is kept in the run state.
 * Gems are counted as 6+ letter words (each earns one).
 */
export const runEndExtras = (gs: {
    log: { type: string; status?: string; word?: string; name?: string; scoreChange?: number; bonuses?: { name: string }[] }[];
    timeLedger?: { goldenRounds?: number }; route?: { choice: 'easy' | 'danger' } | null;
}): StatExtras => {
    const words = gs.log.filter(e => e.type === 'word' && e.status === 'valid');
    const events = gs.log.filter(e => e.type === 'event');
    return {
        golden: gs.timeLedger?.goldenRounds ?? 0,
        ...(gs.route ? { route: gs.route.choice } : {}),
        bails: events.filter(e => e.name === 'Cooled off').length,
        skill: words.filter(e => (e.bonuses ?? []).some(b => b.name === '🎯 Skill Shot')).length,
        gems: words.filter(e => (e.word ?? '').length >= 6).length,
        lastWords: events.filter(e => e.name === 'Last Words').reduce((sum, e) => sum + (e.scoreChange ?? 0), 0),
    };
};

/** Sends one event. Never throws; a lost event is fine. */
/**
 * An item id as the /stats rules accept it: letters and digits only (v7.72.6). Triforce shard ids
 * (shard_power...) have an underscore, so every charm offer that held a shard was rejected and never
 * recorded. They're sent as shardPower, shardWisdom, shardCourage.
 */
export const statId = (id: string): string => id.replace(/_(\w)/g, (_, c: string) => c.toUpperCase());

export const sendStat = (event: StatEvent, extras?: StatExtras): void => {
    if (!enabled()) return;
    const post = (body: object) => fetch(`${databaseURL()}/${STATS_PATH}.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, timestamp: { '.sv': 'timestamp' } }),
        keepalive: true, // still sent if the tab is closing (the run summary)
    });
    try {
        const hasExtras = !!extras && Object.keys(extras).length > 0;
        const first = post(hasExtras ? { ...event, ...extras } : event);
        Promise.resolve(first)
            .then(res => { if (hasExtras && res && !res.ok) return post(event); })
            .catch(() => {});
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
    /** How runs ended, their length and where their time came from (runs that reported it, v7.33+). */
    endings: { reported: number; clock: number; strikes: number; medianMinutes: number; timeWords: number; timeItems: number; timeShuffles: number };
    bosses: Record<string, { reached: number; won: number; close: number; escaped: number; avgHits: number }>;
    bossNumbers: Record<number, { reached: number; won: number }>;
    missions: Record<string, { tier: number; shown: number; done: number }>;
    /** Power words by effect: how often they fired (and refired), slot payouts, strikes HEAL removed. */
    powerWords: Record<string, { fired: number; repeats: number; seconds: number; strikes: number; payouts: Record<number, number> }>;
    days: Record<string, { runs: number; bossesWon: number; missionsDone: number }>;
    /** Charms: times offered and picked, and runs that ended with it equipped (with their average score). */
    charms: Record<string, { offered: number; picked: number; upgraded: number; endRuns: number; avgEndScore: number }>;
    /** PowerPlays: times offered, picked and used. */
    powerPlays: Record<string, { offered: number; picked: number; used: number }>;
    /** Offers turned down: charm passes and PowerPlay keeps. */
    passes: { charm: number; powerPlay: number };
    /** Charm offers answered with an upgrade. */
    upgrades: number;
    /** v7.61.1: Fork picks (and cool-offs), with how often the pick matched the card's advice. */
    forks: { easy: number; danger: number; bail: number; followed: number; advised: number };
    /** v7.61.1: Golden Rounds played (ok) or missed, Golden Tile use, points. */
    golden: { played: number; missed: number; tile: number; points: number[] };
    /** v7.61.1: Score Gates by gate score: played, skipped, points paid. */
    gates: Record<number, { played: number; skipped: number; points: number[] }>;
    /** v7.61.1: tape PowerPlays used; per-run extras from run_end. */
    tapeUses: number;
    runExtras: { reported: number; golden: number; bails: number; skill: number; gems: number; lastWords: number[] };
}

export const median = (xs: number[]) => {
    if (!xs.length) return 0;
    const s = [...xs].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};
const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Turns raw events into the tables on the stats page. */
export const summarize = (events: StoredStat[]): StatsSummary => {
    const out: StatsSummary = { runs: { count: 0, avgScore: 0, medianScore: 0, avgWords: 0, reachedLevel: {} }, bosses: {}, bossNumbers: {}, missions: {}, powerWords: {}, days: {}, charms: {}, powerPlays: {}, passes: { charm: 0, powerPlay: 0 }, upgrades: 0,
        forks: { easy: 0, danger: 0, bail: 0, followed: 0, advised: 0 }, golden: { played: 0, missed: 0, tile: 0, points: [] }, gates: {}, tapeUses: 0,
        runExtras: { reported: 0, golden: 0, bails: 0, skill: 0, gems: 0, lastWords: [] },
        endings: { reported: 0, clock: 0, strikes: 0, medianMinutes: 0, timeWords: 0, timeItems: 0, timeShuffles: 0 } };
    const charm = (id: string) => (out.charms[id] ??= { offered: 0, picked: 0, upgraded: 0, endRuns: 0, avgEndScore: 0 });
    const runSecs: number[] = [];
    const pp = (id: string) => (out.powerPlays[id] ??= { offered: 0, picked: 0, used: 0 });
    const ids = (list: string) => list.split(',').filter(Boolean);
    const endScores: Record<string, number> = {};
    const scores: number[] = []; let words = 0;
    const hits: Record<string, number> = {};
    for (const e of events) {
        const day = (out.days[dayOf(e.timestamp)] ??= { runs: 0, bossesWon: 0, missionsDone: 0 });
        if (e.type === 'run_end') {
            out.runs.count++; scores.push(e.score); words += e.words; day.runs++;
            for (let l = 1; l <= e.level; l++) out.runs.reachedLevel[l] = (out.runs.reachedLevel[l] ?? 0) + 1;
            for (const id of ids(e.charms ?? '')) { charm(id).endRuns++; endScores[id] = (endScores[id] ?? 0) + e.score; }
            if (e.cause) {
                out.endings.reported++; out.endings[e.cause]++;
                if (typeof e.secs === 'number') runSecs.push(e.secs);
                out.endings.timeWords += e.tWords ?? 0; out.endings.timeItems += e.tItems ?? 0; out.endings.timeShuffles += e.tShuffles ?? 0;
            }
            if (typeof e.golden === 'number') {
                const x = out.runExtras;
                x.reported++; x.golden += e.golden; x.bails += e.bails ?? 0; x.skill += e.skill ?? 0; x.gems += e.gems ?? 0; x.lastWords.push(e.lastWords ?? 0);
            }
        } else if (e.type === 'charm_offer' || e.type === 'pp_offer') {
            const get = e.type === 'charm_offer' ? charm : pp;
            for (const id of ids(e.offered)) get(id).offered++;
            if (e.picked) get(e.picked).picked++;
            else if (e.type === 'charm_offer' && e.upgraded) { charm(e.upgraded).upgraded++; out.upgrades++; }
            else out.passes[e.type === 'charm_offer' ? 'charm' : 'powerPlay']++;
        } else if (e.type === 'pp_use') {
            pp(e.pp).used++;
            if (e.tape) out.tapeUses++;
        } else if (e.type === 'fork') {
            out.forks[e.choice]++;
            if (e.choice !== 'bail' && e.advice && e.advice !== 'either') { out.forks.advised++; if (e.advice === e.choice) out.forks.followed++; }
        } else if (e.type === 'golden') {
            if (e.ok) { out.golden.played++; out.golden.points.push(e.score); if (e.tile) out.golden.tile++; } else out.golden.missed++;
        } else if (e.type === 'gate') {
            const g = (out.gates[e.gate] ??= { played: 0, skipped: 0, points: [] });
            if (e.result === 'skip') g.skipped++; else { g.played++; g.points.push(e.points); }
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
    out.endings.medianMinutes = Math.round(median(runSecs) / 6) / 10;
    for (const [id, c] of Object.entries(out.charms)) c.avgEndScore = c.endRuns ? Math.round((endScores[id] ?? 0) / c.endRuns) : 0;
    for (const [id, b] of Object.entries(out.bosses)) {
        const ended = b.won + b.close + b.escaped;
        b.avgHits = ended ? Math.round((hits[id] ?? 0) / ended * 10) / 10 : 0;
    }
    return out;
};
