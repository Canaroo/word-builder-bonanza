// @vitest-environment jsdom
// Local players on one device: separate identities and stats, shared purchases.
import { describe, test, expect, beforeEach } from 'vitest';
import { STORAGE_KEYS } from '../storage';
import { listPlayers, currentPlayer, switchToPlayer, playerKey } from '../players';
import { getProfile, buyCosmetic, equipCosmetic, recordBossBadge, publicFlair } from '../progression';
import { recordFound, getCollection } from '../collection';
import { recordRunScore, getPersonalBest } from '../personalBest';
import { recordCareerRun, idCardStats } from '../career';
import { SHOP_BADGES } from '../../data/cosmetics';

beforeEach(() => localStorage.clear());

describe('the player directory', () => {
    test("the device's existing data becomes the last named player's, under the original keys", () => {
        localStorage.setItem(STORAGE_KEYS.playerName, 'Dad');
        localStorage.setItem(STORAGE_KEYS.personalBest, '4210');
        expect(currentPlayer()).toMatchObject({ slot: 0, name: 'Dad' });
        expect(playerKey(STORAGE_KEYS.personalBest)).toBe(STORAGE_KEYS.personalBest);
        expect(getPersonalBest()).toBe(4210);
    });

    test('a new name gets its own slot; a known name (any case) switches back', () => {
        localStorage.setItem(STORAGE_KEYS.playerName, 'Dad');
        switchToPlayer('Dad', 1);
        expect(switchToPlayer('Tex', 2)).toMatchObject({ slot: 1, name: 'Tex' });
        expect(playerKey(STORAGE_KEYS.career)).toBe(`${STORAGE_KEYS.career}#1`);
        expect(switchToPlayer('  dad ', 3).slot).toBe(0);
        expect(listPlayers().map(p => p.name)).toEqual(['dad', 'Tex']);
    });

    test('with no name on the device, the first player claims the placeholder', () => {
        expect(switchToPlayer('Ann').slot).toBe(0);
        expect(listPlayers()).toHaveLength(1);
    });
});

describe('per-player saves, shared purchases', () => {
    test('stats, Collection, Boss Badges and equipped bling are separate; shop items are shared', () => {
        const badge = SHOP_BADGES[0];
        switchToPlayer('Dad');
        expect(buyCosmetic(badge.id, 9999)).toBeGreaterThan(0);
        equipCosmetic('badge', badge.id);
        recordBossBadge('theNoid');
        recordFound('treatYoWaffle');
        recordRunScore(5000);

        switchToPlayer('Tex');
        expect(getProfile().owned).toContain(badge.id);       // shared wallet
        expect(getProfile().badge).toBeNull();                // not wearing Dad's badge
        expect(getProfile().bossBadges).toEqual([]);
        expect(getCollection()).toEqual({});
        expect(getPersonalBest()).toBe(0);
        equipCosmetic('badge', badge.id);                     // can wear it too
        expect(getProfile().badge).toBe(badge.id);

        switchToPlayer('Dad');
        expect(getProfile()).toMatchObject({ badge: badge.id, bossBadges: ['theNoid'] });
        expect(Object.keys(getCollection())).toEqual(['treatYoWaffle']);
        expect(getPersonalBest()).toBe(5000);
    });
});

describe('career and the ID card', () => {
    test('runs add up into the 8 card stats', () => {
        switchToPlayer('Dad');
        recordRunScore(3000);
        recordCareerRun({ score: 1000, level: 2, bestWord: { word: 'jazz', score: 120 }, longestWord: 'PLANET' });
        recordCareerRun({ score: 3000, level: 4, bestWord: { word: 'cat', score: 5 }, longestWord: 'TREE' });
        recordFound('treatYoWaffle');
        recordBossBadge('theNoid');
        expect(idCardStats()).toEqual({ runs: 2, best: 3000, avg: 2000, level: 4, word: 'JAZZ', wordScore: 120, longest: 'PLANET', secrets: 1 });
        expect(publicFlair()).toMatchObject({ bosses: 1, card: { runs: 2, best: 3000 } });
    });

    test('a new player starts with a blank card', () => {
        switchToPlayer('Newbie');
        expect(idCardStats()).toEqual({ runs: 0, best: 0, avg: 0, level: 1, word: '', wordScore: 0, longest: '', secrets: 0 });
    });
});
