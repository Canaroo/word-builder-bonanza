// @vitest-environment jsdom
import { describe, test, expect, beforeEach, vi } from 'vitest';
import type { LeaderboardEntry } from '../../types';

const online = vi.hoisted(() => ({
    enabled: false,
    rows: [] as LeaderboardEntry[],
    fail: false,
}));

vi.mock('../onlineLeaderboard', () => ({
    isOnlineLeaderboardEnabled: () => online.enabled,
    onlineLeaderboard: {
        submit: async (name: string, score: number) => {
            if (online.fail) throw new Error('offline');
            const id = `id${online.rows.length}`;
            online.rows.push({ id, name, score, date: new Date().toISOString() });
            return id;
        },
        list: async () => {
            if (online.fail) throw new Error('offline');
            return [...online.rows].sort((a, b) => b.score - a.score).map((e, i) => ({ ...e, rank: i + 1 }));
        },
    },
}));

const { leaderboardService, MAX_LEADERBOARD_ENTRIES } = await import('../leaderboardService');

beforeEach(() => {
    localStorage.clear();
    Object.assign(online, { enabled: false, rows: [], fail: false });
});

describe('device leaderboard', () => {
    test('starts empty', async () => {
        expect(await leaderboardService.getLeaderboard()).toEqual({ entries: [], source: 'local' });
    });

    test('keeps scores sorted and returns the new rank', async () => {
        expect((await leaderboardService.submitScore('Ann', 500)).rank).toBe(1);
        expect((await leaderboardService.submitScore('Bob', 900)).rank).toBe(1);
        expect(await leaderboardService.submitScore('Cy', 700)).toEqual({ rank: 2, source: 'local' });

        const { entries } = await leaderboardService.getLeaderboard();
        expect(entries.map(e => [e.rank, e.name, e.score])).toEqual([[1, 'Bob', 900], [2, 'Cy', 700], [3, 'Ann', 500]]);
    });

    test('a tie ranks behind the earlier score', async () => {
        await leaderboardService.submitScore('Ann', 500);
        expect((await leaderboardService.submitScore('Bob', 500)).rank).toBe(2);
    });

    test(`keeps only the top ${MAX_LEADERBOARD_ENTRIES} and reports rank 0 when a score misses the cut`, async () => {
        for (let i = 1; i <= MAX_LEADERBOARD_ENTRIES; i++) await leaderboardService.submitScore(`P${i}`, i * 10);
        expect((await leaderboardService.submitScore('Low', 1)).rank).toBe(0);
        const { entries } = await leaderboardService.getLeaderboard();
        expect(entries).toHaveLength(MAX_LEADERBOARD_ENTRIES);
        expect(entries.some(e => e.name === 'Low')).toBe(false);
    });

    test('trims names and fills in a blank one', async () => {
        await leaderboardService.submitScore('   ', 10);
        await leaderboardService.submitScore('A'.repeat(40), 20);
        const { entries } = await leaderboardService.getLeaderboard();
        expect(entries.map(e => e.name)).toEqual(['A'.repeat(20), 'Player']);
    });

    test('highlights the last submitted score', async () => {
        await leaderboardService.submitScore('Ann', 500);
        const last = leaderboardService.getLastSubmitted();
        const { entries } = await leaderboardService.getLeaderboard();
        expect(leaderboardService.isLastSubmitted(entries[0], last)).toBe(true);
    });

    test('ignores corrupted saved data', async () => {
        localStorage.setItem('wordNerdLeaderboard', '{not json');
        expect((await leaderboardService.getLeaderboard()).entries).toEqual([]);
        localStorage.setItem('wordNerdLeaderboard', JSON.stringify([{ name: 'Ok', score: 5, date: 'x' }, { bogus: true }]));
        expect((await leaderboardService.getLeaderboard()).entries.map(e => e.name)).toEqual(['Ok']);
    });
});

describe('online leaderboard', () => {
    beforeEach(() => { online.enabled = true; });

    test('submits online, ranks by entry id, and keeps a device copy', async () => {
        online.rows.push({ id: 'x', name: 'Champ', score: 1000, date: '' });
        expect(await leaderboardService.submitScore('Ann', 500)).toEqual({ rank: 2, source: 'online' });

        const { entries, source } = await leaderboardService.getLeaderboard();
        expect(source).toBe('online');
        expect(entries.map(e => e.name)).toEqual(['Champ', 'Ann']);
        expect(leaderboardService.isLastSubmitted(entries[1], leaderboardService.getLastSubmitted())).toBe(true);

        online.enabled = false;
        expect((await leaderboardService.getLeaderboard()).entries.map(e => e.name)).toEqual(['Ann']);
    });

    test('falls back to the device board when the online board is unreachable', async () => {
        online.fail = true;
        expect(await leaderboardService.submitScore('Ann', 500)).toEqual({ rank: 1, source: 'local' });
        expect(await leaderboardService.getLeaderboard()).toMatchObject({ source: 'local', entries: [{ name: 'Ann' }] });
    });
});
