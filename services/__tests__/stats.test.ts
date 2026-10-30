// @vitest-environment jsdom
// Anonymous usage stats: what gets sent, when it doesn't, and how the stats page adds it up.
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendStat, fetchStats, summarize, setStatsEnabledForTests, type StoredStat } from '../stats';
import { getTodaysMissions, recordMissionEvent } from '../missions';

let fetchMock: ReturnType<typeof vi.fn>;
const posted = () => fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST').map(([url, init]) => ({ url: String(url), body: JSON.parse(init.body) }));
beforeEach(() => {
    localStorage.clear();
    fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
    setStatsEnabledForTests(true);
});
afterEach(() => { vi.unstubAllGlobals(); setStatsEnabledForTests(null); });

describe('sending stats', () => {
    test('posts one anonymous event with a server timestamp', () => {
        sendStat({ type: 'boss_end', boss: 'theNoid', number: 2, outcome: 'won', hits: 6 });
        const [p] = posted();
        expect(p.url).toMatch(/\/stats\.json$/);
        expect(p.body).toEqual({ type: 'boss_end', boss: 'theNoid', number: 2, outcome: 'won', hits: 6, timestamp: { '.sv': 'timestamp' } });
        expect(fetchMock.mock.calls[0][1].keepalive).toBe(true);
    });

    test('sends nothing when off (dev, localhost, or a local-only build)', () => {
        setStatsEnabledForTests(false);
        sendStat({ type: 'run_end', score: 1, words: 1, level: 1, bosses: 0 });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    test('a network failure is swallowed', async () => {
        fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
        expect(() => sendStat({ type: 'run_end', score: 1, words: 1, level: 1, bosses: 0 })).not.toThrow();
        await Promise.resolve();
    });

    test("today's missions are reported as shown once per device per day; completions as done", () => {
        const day = new Date(2026, 9, 20, 12);
        getTodaysMissions(day);
        getTodaysMissions(day);
        const shown = posted().filter(p => p.body.type === 'mission_shown');
        expect(shown).toHaveLength(3);
        getTodaysMissions(new Date(2026, 9, 21, 12));
        expect(posted().filter(p => p.body.type === 'mission_shown')).toHaveLength(6);

        for (let i = 0; i < 30; i++) recordMissionEvent({ type: 'word', word: 'JAZZIEST', score: 200, goldenStarted: true, comboFilled: true }, 'run', new Date(2026, 9, 21, 13));
        const done = posted().filter(p => p.body.type === 'mission_done');
        expect(done.length).toBeGreaterThan(0);
        expect(done[0].body.mission).toMatch(/^[wpcs]_[A-Za-z]+$/);
    });
});

describe('reading stats', () => {
    test('asks for the last N days by timestamp and keeps only well-formed events, oldest first', async () => {
        fetchMock.mockResolvedValue({ ok: true, json: async () => ({
            a: { type: 'run_end', score: 5, words: 1, level: 1, bosses: 0, timestamp: 200 },
            b: { type: 'run_end', score: 9, words: 1, level: 1, bosses: 0, timestamp: 100 },
            c: { nope: true },
        }) });
        const rows = await fetchStats(7, 7 * 86_400_000 + 50);
        expect(String(fetchMock.mock.calls[0][0])).toMatch(/stats\.json\?orderBy=%22timestamp%22&startAt=50$/);
        expect(rows.map(r => r.timestamp)).toEqual([100, 200]);
    });

    test('summarize: runs, level reach, boss clear rates and hits, mission rates, days', () => {
        const t = Date.UTC(2026, 9, 20, 12);
        const ev = (e: object, dt = 0) => ({ ...e, timestamp: t + dt }) as StoredStat;
        const s = summarize([
            ev({ type: 'run_end', score: 1000, words: 40, level: 3, bosses: 1 }),
            ev({ type: 'run_end', score: 3000, words: 20, level: 2, bosses: 0 }),
            ev({ type: 'run_end', score: 2000, words: 60, level: 4, bosses: 0 }, 86_400_000),
            ev({ type: 'boss_start', boss: 'theNoid', number: 1 }),
            ev({ type: 'boss_end', boss: 'theNoid', number: 1, outcome: 'won', hits: 6 }),
            ev({ type: 'boss_start', boss: 'theNoid', number: 1 }),
            ev({ type: 'boss_end', boss: 'theNoid', number: 1, outcome: 'close', hits: 5 }),
            ev({ type: 'mission_shown', mission: 'w_boss', tier: 3 }),
            ev({ type: 'mission_shown', mission: 'w_boss', tier: 3 }),
            ev({ type: 'mission_done', mission: 'w_boss', tier: 3 }),
        ]);
        expect(s.runs).toEqual({ count: 3, avgScore: 2000, medianScore: 2000, avgWords: 40, reachedLevel: { 1: 3, 2: 3, 3: 2, 4: 1 } });
        expect(s.bosses.theNoid).toEqual({ reached: 2, won: 1, close: 1, escaped: 0, avgHits: 5.5 });
        expect(s.bossNumbers[1]).toEqual({ reached: 2, won: 1 });
        expect(s.missions.w_boss).toEqual({ tier: 3, shown: 2, done: 1 });
        expect(s.days['2026-10-20']).toEqual({ runs: 2, bossesWon: 1, missionsDone: 1 });
        expect(s.days['2026-10-21'].runs).toBe(1);
    });
});
