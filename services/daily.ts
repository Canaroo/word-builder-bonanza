// The Daily Run (v7.30): one deal per day for everyone. The date picks a seed; the tile bag,
// PowerPlay and charm offers and bosses follow it (gamble rolls stay random). Each player's first
// daily run of the day is the scored one; replays are practice. The day rolls over at the same
// 8 AM reset as missions and streaks (dayKey).
import { dayKey, daysBetween } from './progression';
import { storage, STORAGE_KEYS } from './storage';
import { playerKey } from './players';
import { DAILY_RUN } from '../config/progression';

export interface DailyRun {
    /** The game day, e.g. "2026-11-09". */
    key: string;
    /** Daily Run #1 is the launch day. */
    number: number;
    seed: number;
    /** A replay after the scored run: same deal, nothing posted or paid. */
    practice: boolean;
}

/** What the player did with a day's scored run. */
export interface DailyRecord {
    key: string;
    /** Set once the run ends. */
    score?: number;
    level?: number;
    bosses?: number;
    /** Rank on the day's board when it was posted (0 if it missed the top 50 or couldn't post). */
    rank?: number;
}

/** A 32-bit hash of a string (FNV-1a), for turning the date into a seed. */
export const hashString = (text: string): number => {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
};

/** A small seeded generator (mulberry32). Its whole state is one number, so it can be saved. */
export interface SeededStream { next: () => number; state: () => number }
export const seededStream = (state: number): SeededStream => {
    let s = state >>> 0;
    return {
        next: () => {
            s = (s + 0x6d2b79f5) >>> 0;
            let t = s;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        },
        state: () => s,
    };
};

export const dailySeed = (key: string): number => hashString(`word-nerd-daily:${key}`);
export const dailyNumber = (key: string): number => daysBetween(DAILY_RUN.launchDay, key) + 1;

/** Today's run, practice if the player already used today's scored try. */
export const todaysRun = (now: Date = new Date()): DailyRun => {
    const key = dayKey(now);
    return { key, number: dailyNumber(key), seed: dailySeed(key), practice: scoredRunUsed(key) };
};

const readRecord = (): DailyRecord | null => storage.getJSON<DailyRecord | null>(playerKey(STORAGE_KEYS.dailyRecord), null);
/** The current player's record for a day (only the latest day is kept). */
export const dailyRecord = (key: string): DailyRecord | null => {
    const r = readRecord();
    return r && r.key === key ? r : null;
};
export const scoredRunUsed = (key: string): boolean => !!dailyRecord(key);
/** Starting the scored run uses up the day's try, even if it's never finished. */
export const markScoredRunStarted = (key: string): void => {
    if (!scoredRunUsed(key)) storage.setJSON(playerKey(STORAGE_KEYS.dailyRecord), { key });
};
export const recordScoredRun = (key: string, result: Omit<DailyRecord, 'key'>): DailyRecord => {
    const record = { ...(dailyRecord(key) ?? { key }), ...result, key };
    storage.setJSON(playerKey(STORAGE_KEYS.dailyRecord), record);
    return record;
};

/** Credits for a finished scored run, plus the top-10 bonus. */
export const dailyCredits = (rank: number): number =>
    DAILY_RUN.finishCredits + (rank > 0 && rank <= DAILY_RUN.topRank ? DAILY_RUN.topCredits : 0);

const shortDate = (key: string): string => {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

/** The text a player shares after their daily run. */
export const dailyShareText = (run: Pick<DailyRun, 'key' | 'number'>, result: { score: number; level: number; bosses?: number; rank?: number }): string => [
    `Word Nerd Daily #${run.number} · ${shortDate(run.key)}`,
    [`${result.score.toLocaleString('en-US')} pts`, `LV ${result.level}`, result.bosses ? `🏅${result.bosses}` : '', result.rank ? `#${result.rank} today` : '']
        .filter(Boolean).join(' · '),
    DAILY_RUN.shareUrl,
].join('\n');
