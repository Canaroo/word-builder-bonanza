// @vitest-environment jsdom
// Boss rounds: the rules, which boss you meet, how a round ends, and permanent Boss Badges.
import { describe, test, expect, beforeEach } from 'vitest';
import { BOSSES, bossById, bossTierFor, pickBoss } from '../../data/bosses';
import { BOSS } from '../../config/gameplay';
import { advanceBoss, bossNumberFor, bossRewardFor } from '../rules';
import { getProfile, publicFlair, recordBossBadge } from '../progression';
import type { BossRound, Tile } from '../../types';
import { STORAGE_KEYS } from '../storage';

const rack = (letters: string, points: Record<string, number> = {}) =>
    [...letters].map((letter, i) => ({ id: `${letter}${i}`, letter, points: points[letter] ?? 1 })) as Tile[];
const ctx = { last: '', score: 0, lastScore: 0 };
const follows = (id: string, word: string, tiles: Tile[] = rack(word), c: Partial<typeof ctx> = {}) => bossById(id)!.check(word, tiles, { ...ctx, ...c });

beforeEach(() => localStorage.clear());

describe('the boss roster', () => {
    test('24 bosses with unique ids, 8 per tier', () => {
        expect(new Set(BOSSES.map(b => b.id)).size).toBe(BOSSES.length);
        for (const tier of ['early', 'mid', 'late'] as const) expect(BOSSES.filter(b => b.tier === tier)).toHaveLength(8);
        for (const b of BOSSES) expect(b.rule && b.description && b.taunt && b.source).toBeTruthy();
    });

    test('each rule accepts a word that follows it and rejects one that does not', () => {
        const cases: [string, string, string][] = [
            ['mojoJojo', 'PLANT', 'TREE'],
            ['cobraCommander', 'TRAIN', 'STAR'],
            ['kingDedede', 'TREE', 'CAT'],
            ['drWily', 'PLANT', 'PIZZA'],
            ['theNoid', 'TRAIN', 'TREE'],
            ['ursula', 'TREE', 'CAT'],
            ['motherBrain', 'RAIN', 'CAT'],
            ['skeletor', 'STRAP', 'RAIN'],
            ['jafar', 'ATOM', 'TOMB'],
            ['noidAndUrsula', 'TRIO', 'RATE'],
            ['bigBoss', 'PLANT', 'TREE'],
            ['oogieBoogie', 'TRAIN', 'TOAST'],
            ['gargamel', 'SLIME', 'TRAIL'],
            ['doctorDoom', 'TREE', 'TRAIN'],
            ['cruella', 'PIZZA', 'PLANT'],
            ['gru', 'CAT', 'TREE'],
            ['zurg', 'TOMATO', 'TRAIN'],
        ];
        for (const [id, yes, no] of cases) {
            expect(follows(id, yes), `${id} should accept ${yes}`).toBe(true);
            expect(follows(id, no), `${id} should reject ${no}`).toBe(false);
        }
    });

    test('score rules read the word\'s score; Drago needs more than your last word', () => {
        expect(follows('kingHippo', 'CAT', undefined, { score: 8 })).toBe(true);
        expect(follows('kingHippo', 'CAT', undefined, { score: 7 })).toBe(false);
        expect(follows('sephiroth', 'CAT', undefined, { score: 10 })).toBe(true);
        expect(follows('predator', 'CAT', undefined, { score: 11 })).toBe(false);
        expect(follows('ivanDrago', 'CAT', undefined, { score: 20, lastScore: 19 })).toBe(true);
        expect(follows('ivanDrago', 'CAT', undefined, { score: 19, lastScore: 19 })).toBe(false);
    });

    test('Magneto: no letter from your last word; its letters are dimmed', () => {
        expect(follows('magneto', 'MIND', undefined, { last: 'CAT' })).toBe(true);
        expect(follows('magneto', 'TEN', undefined, { last: 'CAT' })).toBe(false);
        const [t, m] = rack('TM');
        expect(bossById('magneto')!.tileHint!(t, [], { ...ctx, last: 'CAT' })).toBe('dim');
        expect(bossById('magneto')!.tileHint!(m, [], { ...ctx, last: 'CAT' })).toBeNull();
    });

    test('Hades: the word must use a 3+ point tile, and those tiles glow', () => {
        const tiles = rack('BITE', { B: 3 });
        expect(follows('hades', 'BIT', tiles)).toBe(true);
        expect(follows('hades', 'TIE', tiles)).toBe(false);
        expect(bossById('hades')!.tileHint!(tiles[0], tiles, ctx)).toBe('glow');
    });

    test('Lord Business: the word must use the highest-value tile in the rack', () => {
        const tiles = rack('QUITEABS', { Q: 10, B: 3 });
        expect(follows('lordBusiness', 'QUIT', tiles)).toBe(true);
        expect(follows('lordBusiness', 'BITE', tiles)).toBe(false);
        expect(bossById('lordBusiness')!.tileHint!(tiles[0], tiles, ctx)).toBe('glow');
        expect(bossById('lordBusiness')!.tileHint!(tiles[1], tiles, ctx)).toBeNull();
    });

    test('letter bans dim the banned tiles', () => {
        const [e, t] = rack('ET');
        expect(bossById('theNoid')!.tileHint!(e, [], ctx)).toBe('dim');
        expect(bossById('theNoid')!.tileHint!(t, [], ctx)).toBeNull();
        expect(bossById('noidAndUrsula')!.tileHint!(rack('A')[0], [], ctx)).toBe('dim');
    });
});

describe('which boss you meet', () => {
    test('boss levels are 3, 6, 9...; the 1st is early, the 2nd and 3rd mid, then late', () => {
        expect([1, 2, 3, 4, 6, 9, 12].map(bossNumberFor)).toEqual([0, 0, 1, 0, 2, 3, 4]);
        expect([1, 2, 3, 4, 7].map(bossTierFor)).toEqual(['early', 'mid', 'mid', 'late', 'late']);
        expect(pickBoss(1, [], () => 0).tier).toBe('early');
        expect(pickBoss(4, [], () => 0.99).tier).toBe('late');
    });

    test('a run does not repeat a boss until its tier runs out', () => {
        const mid = BOSSES.filter(b => b.tier === 'mid').map(b => b.id);
        expect(pickBoss(3, mid.slice(0, 3), () => 0).id).toBe(mid[3]);
        expect(mid).toContain(pickBoss(3, mid, () => 0).id);
    });

    test('rewards climb with each boss level, then hold', () => {
        expect(bossRewardFor(1)).toEqual({ points: 200, seconds: 5, closePoints: 50 });
        expect(bossRewardFor(2).seconds).toBe(8);
        expect(bossRewardFor(9)).toEqual(bossRewardFor(BOSS.rewards.length));
    });
});

describe('how a boss round ends', () => {
    const play = (hits: boolean[]) => {
        let round: BossRound | null = { id: 'theNoid', number: 2, wordsLeft: BOSS.words, hits: 0 };
        let outcome: string | null = null; let words = 0;
        for (const hit of hits) {
            if (!round) break;
            ({ round, outcome } = advanceBoss(round, hit)); words++;
        }
        return { outcome, words, round };
    };

    test('6 hits in a row wins on the 6th word', () => {
        expect(play(Array(8).fill(true))).toMatchObject({ outcome: 'won', words: 6, round: null });
    });

    test('two misses are allowed: 6 hits in 8 words still wins', () => {
        expect(play([false, true, true, false, true, true, true, true])).toMatchObject({ outcome: 'won', words: 8 });
    });

    test('4 or 5 hits by the 8th word is close; fewer escapes', () => {
        expect(play([true, true, true, true, true, false, false, false])).toMatchObject({ outcome: 'close', words: 8 });
        expect(play([true, true, true, true, false, false, false, false])).toMatchObject({ outcome: 'close', words: 8 });
        expect(play([true, true, true, false, false, false, false, false]).outcome).toBe('escaped');
    });

    test('it ends early once even the consolation is out of reach', () => {
        expect(play(Array(8).fill(false))).toMatchObject({ outcome: 'escaped', words: 5 });
    });
});

describe('permanent Boss Badges', () => {
    test('a boss adds its badge once; the count shows in the public flair', () => {
        expect(recordBossBadge('theNoid')).toEqual({ isNew: true, total: 1 });
        expect(recordBossBadge('theNoid')).toEqual({ isNew: false, total: 1 });
        expect(recordBossBadge('skeletor')).toEqual({ isNew: true, total: 2 });
        expect(getProfile().bossBadges).toEqual(['theNoid', 'skeletor']);
        expect(publicFlair().bosses).toBe(2);
    });

    test('unknown or duplicate saved ids are dropped', () => {
        localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify({ bossBadges: ['ursula', 'ursula', 'nope'] }));
        expect(getProfile().bossBadges).toEqual(['ursula']);
        expect(recordBossBadge('nope')).toEqual({ isNew: false, total: 1 });
    });
});
