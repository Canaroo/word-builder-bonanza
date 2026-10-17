// @vitest-environment jsdom
import { describe, test, expect, beforeEach } from 'vitest';
import { leaderboardService, MAX_LEADERBOARD_ENTRIES } from '../leaderboardService';

beforeEach(() => localStorage.clear());

describe('local leaderboard', () => {
    test('starts empty', async () => {
        expect(await leaderboardService.getLeaderboard()).toEqual([]);
    });

    test('keeps scores sorted and returns the new rank', async () => {
        expect(await leaderboardService.submitScore('Ann', 500)).toBe(1);
        expect(await leaderboardService.submitScore('Bob', 900)).toBe(1);
        expect(await leaderboardService.submitScore('Cy', 700)).toBe(2);

        const board = await leaderboardService.getLeaderboard();
        expect(board.map(e => [e.rank, e.name, e.score])).toEqual([[1, 'Bob', 900], [2, 'Cy', 700], [3, 'Ann', 500]]);
    });

    test('a tie ranks behind the earlier score', async () => {
        await leaderboardService.submitScore('Ann', 500);
        expect(await leaderboardService.submitScore('Bob', 500)).toBe(2);
    });

    test(`keeps only the top ${MAX_LEADERBOARD_ENTRIES} and reports rank 0 when a score misses the cut`, async () => {
        for (let i = 1; i <= MAX_LEADERBOARD_ENTRIES; i++) await leaderboardService.submitScore(`P${i}`, i * 10);
        expect(await leaderboardService.submitScore('Low', 1)).toBe(0);
        const board = await leaderboardService.getLeaderboard();
        expect(board).toHaveLength(MAX_LEADERBOARD_ENTRIES);
        expect(board.some(e => e.name === 'Low')).toBe(false);
    });

    test('remembers the last submitted score for highlighting', async () => {
        await leaderboardService.submitScore('Ann', 500);
        expect(leaderboardService.getLastSubmitted()).toMatchObject({ name: 'Ann', score: 500 });
    });

    test('ignores corrupted saved data', async () => {
        localStorage.setItem('wordNerdLeaderboard', '{not json');
        expect(await leaderboardService.getLeaderboard()).toEqual([]);
        localStorage.setItem('wordNerdLeaderboard', JSON.stringify([{ name: 'Ok', score: 5, date: 'x' }, { bogus: true }]));
        expect((await leaderboardService.getLeaderboard()).map(e => e.name)).toEqual(['Ok']);
    });
});
