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
