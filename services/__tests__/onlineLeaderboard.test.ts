// The online board talks to Firebase's REST API with fetch.
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

vi.stubEnv('VITE_LEADERBOARD', 'online');
vi.stubEnv('VITE_FIREBASE_DATABASE_URL', 'https://example-db.firebaseio.com/');
const { onlineLeaderboard, LeaderboardError } = await import('../onlineLeaderboard');

const json = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body }) as Response;
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => { fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => vi.unstubAllGlobals());

describe('online leaderboard (REST)', () => {
    test('lists the top scores, highest first, ignoring bad rows and unknown bling', async () => {
        fetchMock.mockResolvedValue(json(200, {
            a: { name: 'Nicole', score: 22428, timestamp: 1792376877438 },
            b: { name: 'Tex', score: 55689, timestamp: 1792455742526, badge: 'b_vhs', title: 'nope', streak: 3 },
            c: { score: 'oops' },
        }));
        const rows = await onlineLeaderboard.list();
        expect(fetchMock.mock.calls[0][0]).toBe('https://example-db.firebaseio.com/leaderboard.json?orderBy=%22score%22&limitToLast=50');
        expect(rows.map(r => [r.name, r.rank, r.badge, r.title, r.streak])).toEqual([['Tex', 1, 'b_vhs', null, 3], ['Nicole', 2, null, null, 0]]);
    });

    test('an empty board is an empty list', async () => {
        fetchMock.mockResolvedValue(json(200, null));
        expect(await onlineLeaderboard.list()).toEqual([]);
    });

    test('posts a score with a server timestamp and returns the new id', async () => {
        fetchMock.mockResolvedValue(json(200, { name: '-Nxyz' }));
        expect(await onlineLeaderboard.submit('Tex', 500, { badge: 'b_vhs', title: null, streak: 2 })).toBe('-Nxyz');
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe('https://example-db.firebaseio.com/leaderboard.json');
        expect(JSON.parse(init.body)).toEqual({ name: 'Tex', score: 500, timestamp: { '.sv': 'timestamp' }, badge: 'b_vhs', streak: 2 });
    });

    test('if the rules reject the bling, it posts the score alone', async () => {
        fetchMock.mockResolvedValueOnce(json(401, { error: 'Permission denied' })).mockResolvedValueOnce(json(200, { name: '-Nabc' }));
        expect(await onlineLeaderboard.submit('Tex', 500, { badge: 'b_vhs', title: null, streak: 0 })).toBe('-Nabc');
        expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ name: 'Tex', score: 500, timestamp: { '.sv': 'timestamp' } });
    });

    test('failures carry a short reason', async () => {
        fetchMock.mockResolvedValue(json(401, { error: 'Permission denied' }));
        await expect(onlineLeaderboard.list()).rejects.toMatchObject({ reason: 'permission denied', status: 401 });
        fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
        const err = await onlineLeaderboard.list().catch(e => e);
        expect(err).toBeInstanceOf(LeaderboardError);
        expect(err.reason).toBe('no connection');
    });
});

describe('Boss Badges on the online board', () => {
    test('reads the Boss Badge count, ignoring junk', async () => {
        fetchMock.mockResolvedValue(json(200, {
            a: { name: 'Ann', score: 900, timestamp: 1792376877438, bosses: 4 },
            b: { name: 'Bo', score: 800, timestamp: 1792376877438, bosses: 'lots' },
        }));
        expect((await onlineLeaderboard.list()).map(r => [r.name, r.bosses])).toEqual([['Ann', 4], ['Bo', 0]]);
    });

    test('posts the count; if the rules reject it, keeps the rest of the bling', async () => {
        fetchMock.mockResolvedValueOnce(json(400, { error: 'Permission denied' })).mockResolvedValueOnce(json(200, { name: '-Nb' }));
        expect(await onlineLeaderboard.submit('Tex', 500, { badge: 'b_vhs', title: null, streak: 2, bosses: 3 })).toBe('-Nb');
        expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ badge: 'b_vhs', streak: 2, bosses: 3 });
        expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ name: 'Tex', score: 500, timestamp: { '.sv': 'timestamp' }, badge: 'b_vhs', streak: 2 });
    });

    test('a count of 0 is not sent', async () => {
        fetchMock.mockResolvedValue(json(200, { name: '-Nc' }));
        await onlineLeaderboard.submit('Tex', 500, { badge: null, title: null, streak: 0, bosses: 0 });
        expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ name: 'Tex', score: 500, timestamp: { '.sv': 'timestamp' } });
    });
});

describe('player ID snapshots on the online board', () => {
    const card = { runs: 12, best: 9000, avg: 3100, level: 7, word: 'JAZZ', wordScore: 180, longest: 'PLANETS', secrets: 9 };

    test('reads a posted card, ignoring a malformed one', async () => {
        fetchMock.mockResolvedValue(json(200, {
            a: { name: 'Ann', score: 900, timestamp: 1792376877438, card },
            b: { name: 'Bo', score: 800, timestamp: 1792376877438, card: { runs: 'many' } },
        }));
        const rows = await onlineLeaderboard.list();
        expect(rows[0].card).toEqual(card);
        expect(rows[1].card).toBeUndefined();
    });

    test('posts the card; rules that reject it drop the card first, then Boss Badges, then everything', async () => {
        fetchMock
            .mockResolvedValueOnce(json(400, { error: 'Permission denied' }))
            .mockResolvedValueOnce(json(400, { error: 'Permission denied' }))
            .mockResolvedValueOnce(json(200, { name: '-Nd' }));
        expect(await onlineLeaderboard.submit('Tex', 500, { badge: 'b_vhs', title: null, streak: 2, bosses: 3, card })).toBe('-Nd');
        const bodies = fetchMock.mock.calls.map(c => JSON.parse(c[1].body));
        expect(bodies[0]).toMatchObject({ card, bosses: 3, badge: 'b_vhs' });
        expect(bodies[1]).not.toHaveProperty('card');
        expect(bodies[1]).toMatchObject({ bosses: 3, badge: 'b_vhs' });
        expect(bodies[2]).toEqual({ name: 'Tex', score: 500, timestamp: { '.sv': 'timestamp' }, badge: 'b_vhs', streak: 2 });
    });
});
