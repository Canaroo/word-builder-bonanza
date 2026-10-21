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

const { leaderboardService, MAX_LEADERBOARD_ENTRIES, sanitizeName } = await import('../leaderboardService');

beforeEach(() => {
    localStorage.clear();
    Object.assign(online, { enabled: false, rows: [], fail: false });
    leaderboardService.resetOnlineBackoff();
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

    test('after a failure it skips the online board for a while instead of waiting again', async () => {
        online.fail = true;
        await leaderboardService.getLeaderboard();
        online.fail = false; // back online, but within the back-off window
        expect((await leaderboardService.getLeaderboard()).source).toBe('local');
        leaderboardService.resetOnlineBackoff();
        expect((await leaderboardService.getLeaderboard()).source).toBe('online');
    });
});

describe('name cleanup (matches the online board rules)', () => {
    test('keeps allowed characters, strips the rest', () => {
        expect(sanitizeName('Tex!! 🔥')).toBe('Tex');
        expect(sanitizeName("D'Angelo-Smith_Jr.")).toBe("D'Angelo-Smith_Jr.");
        expect(sanitizeName('José   Núñez')).toBe('Jose Nunez');
        expect(sanitizeName('O\u2019Brien')).toBe("O'Brien");
        expect(sanitizeName('🎮🎮')).toBe('Player');
        expect(sanitizeName('A'.repeat(40))).toHaveLength(20);
        for (const n of ['Tex!! 🔥', 'José', '<script>', '   ']) expect(sanitizeName(n)).toMatch(/^[A-Za-z0-9 _.'-]{1,30}$/);
    });

    test('the cleaned name is what gets posted online', async () => {
        online.enabled = true;
        await leaderboardService.submitScore('Tex ⚡️!', 500);
        expect(online.rows[0].name).toBe('Tex');
    });
});

describe('offline reason and retry', () => {
    test('the board says why it is offline, and Retry skips the back-off', async () => {
        online.enabled = true;
        online.fail = true;
        expect(await leaderboardService.getLeaderboard()).toMatchObject({ source: 'local', offlineReason: 'unavailable' });
        online.fail = false;
        expect((await leaderboardService.getLeaderboard()).source).toBe('local'); // still backing off
        const retried = await leaderboardService.getLeaderboard({ retry: true });
        expect(retried.source).toBe('online');
        expect(retried.offlineReason).toBeUndefined();
    });
});
