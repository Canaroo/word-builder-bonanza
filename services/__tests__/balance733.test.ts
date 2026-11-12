// v7.33 balance pass: charm upgrades, per-boss hit targets, and the extra run_end stats.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { BOSS, CHARM_UPGRADE } from '../../config/gameplay';
import { BOSSES, bossById } from '../../data/bosses';
import { CHARMS_LIST, UPGRADABLE_CHARM_IDS } from '../../data/charms';
import { advanceBoss, bossCloseHits, bossHitsToWin, charmPointsIn, charmUpgradePoints } from '../rules';
import { sendStat, setStatsEnabledForTests, summarize, type StoredStat } from '../stats';
import type { BossRound, Tile } from '../../types';

describe('charm upgrades', () => {
    const bonuses = [
        { name: 'Vowel Lover (E)', description: '+20 pts' },
        { name: 'Vowel Lover (A)', description: '+20 pts' },
        { name: 'Chaos Theory', description: '+50 pts' },
        { name: 'Momentum', description: 'Momentum: +75 pts' },
        { name: "Phil's-osophy", description: '-25 pts' },
        { name: 'S-Tier Scorer', description: 'x2 Word Score' },
        { name: 'Super Hand', description: '+100 pts' },
    ];

    test('counts only the named charms\' "+N pts" lines', () => {
        expect(charmPointsIn(bonuses, ['Vowel Lover'])).toBe(40);
        expect(charmPointsIn(bonuses, ['Chaos Theory', 'Momentum'])).toBe(125);
        expect(charmPointsIn(bonuses, ['Phil’s-osophy', 'S-Tier Scorer'])).toBe(0); // losses and multipliers don't count
        expect(charmPointsIn(bonuses, [])).toBe(0);
    });

    test(`an upgraded charm pays ${CHARM_UPGRADE.percent}% more`, () => {
        expect(charmUpgradePoints(bonuses, ['Vowel Lover'])).toBe(Math.round(40 * CHARM_UPGRADE.percent / 100));
        expect(charmUpgradePoints(bonuses, ['Chaos Theory', 'Momentum'])).toBe(Math.round(125 * CHARM_UPGRADE.percent / 100));
        expect(charmUpgradePoints(bonuses, [])).toBe(0);
    });

    test('curly and straight apostrophes match', () => {
        expect(charmPointsIn([{ name: "Phil's-osophy", description: '+100 pts' }], ['Phil’s-osophy'])).toBe(100);
    });

    test('every upgradable charm exists and pays points under its own name', () => {
        const plain = (s: string) => s.replace(/[‘’]/g, "'").replace(/\\'/g, "'");
        const source = plain(readFileSync('services/gameUtils.ts', 'utf8') + '\n' + readFileSync('services/screens/GameScreen.tsx', 'utf8'))
            .split('\n').filter(l => /bonuses\.push|\bflat\(/.test(l));
        for (const id of UPGRADABLE_CHARM_IDS) {
            const charm = CHARMS_LIST.find(c => c.id === id);
            expect(charm, id).toBeTruthy();
            const name = plain(charm!.name);
            const pays = source.some(l => (l.includes(`'${name}`) || l.includes(`"${name}`) || l.includes(`\`${name}`)) && (/\+\$\{|\+\d+ pts/.test(l) || /\bflat\(/.test(l)));
            expect(pays, `${id} (${name}) has no "+N pts" line`).toBe(true);
        }
        expect(UPGRADABLE_CHARM_IDS.size).toBeGreaterThan(50);
    });
});

describe('boss balance (v7.33)', () => {
    const ctx = { last: '', score: 0, lastScore: 0 };
    const follows = (id: string, word: string, last = '') => bossById(id)!.check(word, [] as Tile[], { ...ctx, last });

    test('the hardest rules need 4 hits, the rest 6', () => {
        for (const id of ['ivanDrago', 'bigBoss', 'cruella', 'jafar']) expect(bossHitsToWin(null, bossById(id)), id).toBe(4);
        expect(bossHitsToWin(null, bossById('theNoid'))).toBe(BOSS.hitsToWin);
        expect(bossHitsToWin(null)).toBe(BOSS.hitsToWin);
        expect(BOSSES.filter(b => b.hitsToWin).length).toBe(4);
    });

    test('Little Mac still takes one hit off', () => {
        const mac = { activeCharms: [{ id: 'littleMac' }] };
        expect(bossHitsToWin(mac, bossById('ivanDrago'))).toBe(3);
        expect(bossHitsToWin(mac, bossById('ursula'))).toBe(BOSS.hitsToWin - 1);
    });

    test('"so close" sits the same gap below the badge', () => {
        expect(bossCloseHits(bossById('theNoid'))).toBe(BOSS.closeHits);
        expect(bossCloseHits(bossById('ivanDrago'))).toBe(2);
    });

    test('a 4-hit boss: 4 hits win, 2-3 are close, fewer escape', () => {
        const drago = bossById('ivanDrago')!;
        const play = (hits: boolean[]) => {
            let round: BossRound | null = { id: drago.id, number: 4, wordsLeft: BOSS.words, hits: 0 };
            let outcome: string | null = null;
            for (const hit of hits) { if (!round) break; ({ round, outcome } = advanceBoss(round, hit, bossHitsToWin(null, drago), bossCloseHits(drago))); }
            return outcome;
        };
        expect(play([true, false, true, false, true, true])).toBe('won');
        expect(play([true, true, true, false, false, false, false, false])).toBe('close');
        expect(play([true, false, false, false, false, false, false, false])).toBe('escaped');
    });

    test('Ursula, The Noid and Magneto no longer count 3-letter words', () => {
        expect(follows('ursula', 'TOE')).toBe(false);
        expect(follows('ursula', 'TONE')).toBe(true);
        expect(follows('ursula', 'TAME')).toBe(false);
        expect(follows('theNoid', 'CAT')).toBe(false);
        expect(follows('theNoid', 'CART')).toBe(true);
        expect(follows('theNoid', 'CARE')).toBe(false);
        expect(follows('magneto', 'DIM', 'CAT')).toBe(false);
        expect(follows('magneto', 'MIND', 'CAT')).toBe(true);
        expect(follows('magneto', 'MINT', 'CAT')).toBe(false);
        for (const id of ['ursula', 'theNoid', 'magneto']) expect(bossById(id)!.rule).toContain('4+');
    });

    test('Doctor Doom is a mid boss and Hades an early one', () => {
        expect(bossById('doctorDoom')!.tier).toBe('mid');
        expect(bossById('hades')!.tier).toBe('early');
    });
});

describe('run_end extras (v7.33)', () => {
    let fetchMock: ReturnType<typeof vi.fn>;
    const bodies = () => fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body));
    const flush = () => new Promise(r => setTimeout(r, 0));
    beforeEach(() => { setStatsEnabledForTests(true); });
    afterEach(() => { setStatsEnabledForTests(null); vi.unstubAllGlobals(); });
    const run = { type: 'run_end', score: 900, words: 12, level: 1, bosses: 0 } as const;

    test('extras ride along with the event', async () => {
        fetchMock = vi.fn().mockResolvedValue({ ok: true });
        vi.stubGlobal('fetch', fetchMock);
        sendStat(run, { cause: 'strikes', secs: 95, tWords: 30, tItems: 10, tShuffles: 5, upgrades: 1 });
        await flush();
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(bodies()[0]).toMatchObject({ type: 'run_end', score: 900, cause: 'strikes', secs: 95, upgrades: 1 });
    });

    test('if the database rejects the extras, the plain event is sent again', async () => {
        fetchMock = vi.fn().mockResolvedValueOnce({ ok: false, status: 401 }).mockResolvedValue({ ok: true });
        vi.stubGlobal('fetch', fetchMock);
        sendStat(run, { cause: 'clock', secs: 60 });
        await flush();
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(bodies()[1].cause).toBeUndefined();
        expect(bodies()[1]).toMatchObject({ type: 'run_end', score: 900, words: 12 });
    });

    test('an event without extras is never re-sent', async () => {
        fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 401 });
        vi.stubGlobal('fetch', fetchMock);
        sendStat(run);
        await flush();
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    test('the summary counts endings, time sources and upgrades', () => {
        const at = (e: object, i: number) => ({ ...e, timestamp: 1000 + i }) as StoredStat;
        const s = summarize([
            at({ ...run, cause: 'clock', secs: 300, tWords: 60, tItems: 30, tShuffles: 10 }, 0),
            at({ ...run, cause: 'strikes', secs: 60, tWords: 20, tItems: 0, tShuffles: 0 }, 1),
            at({ ...run }, 2), // an older run with no extras
            at({ type: 'charm_offer', offered: 'a,b,c', picked: '', level: 7, upgraded: 'goldenTicket' }, 3),
            at({ type: 'charm_offer', offered: 'a,b,c', picked: '', level: 7 }, 4),
        ]);
        expect(s.runs.count).toBe(3);
        expect(s.endings).toMatchObject({ reported: 2, clock: 1, strikes: 1, medianMinutes: 3, timeWords: 80, timeItems: 30, timeShuffles: 10 });
        expect(s.upgrades).toBe(1);
        expect(s.passes.charm).toBe(1);
        expect(s.charms.goldenTicket.upgraded).toBe(1);
    });
});

// v7.34: long words boost charm points, and PowerPlay point prizes grow with the level.
import { CHARM_LENGTH_BOOST, PRIZE_GROWTH } from '../../config/gameplay';
import { NO_LENGTH_BOOST_CHARM_IDS } from '../../data/charms';
import { POWER_PLAYS_LIST, PRIZE_POWER_PLAY_IDS } from '../../data/powerPlays';
import { charmLengthBoostFor, charmLengthPoints, levelUpInfo, prizeFor, prizeScaleFor } from '../rules';

describe('long-word boost (v7.34)', () => {
    const bonuses = [
        { name: 'Chaos Theory', description: '+50 pts' },
        { name: 'Vowel Lover (E)', description: '+20 pts' },
        { name: 'Golden Snitch', description: '+500 pts' },
        { name: 'Super Hand', description: '+100 pts' },
        { name: '⭐ Charm upgrades', description: '+25 pts (50% more from upgraded charms)' },
    ];
    const charms = ['Chaos Theory', 'Vowel Lover'];

    test('short words get nothing; the boost grows with length and holds past 8', () => {
        expect([3, 4].map(charmLengthBoostFor)).toEqual([0, 0]);
        expect([5, 6, 7, 8].map(charmLengthBoostFor)).toEqual([CHARM_LENGTH_BOOST[5], CHARM_LENGTH_BOOST[6], CHARM_LENGTH_BOOST[7], CHARM_LENGTH_BOOST[8]]);
        expect(charmLengthBoostFor(10)).toBe(CHARM_LENGTH_BOOST[8]);
    });

    test('it pays a share of the named charms\' points only', () => {
        expect(charmLengthPoints(bonuses, charms, 4)).toBe(0);
        expect(charmLengthPoints(bonuses, charms, 5)).toBe(Math.round(70 * CHARM_LENGTH_BOOST[5] / 100));
        expect(charmLengthPoints(bonuses, charms, 7)).toBe(Math.round(70 * CHARM_LENGTH_BOOST[7] / 100));
        expect(charmLengthPoints(bonuses, [], 8)).toBe(0);
    });

    test('one-off payouts are left out, and they are real charms', () => {
        for (const id of NO_LENGTH_BOOST_CHARM_IDS) expect(CHARMS_LIST.some(c => c.id === id), id).toBe(true);
        expect(NO_LENGTH_BOOST_CHARM_IDS.has('goldenSnitch')).toBe(true);
    });
});

describe('PowerPlay prize growth (v7.34)', () => {
    test('prizes grow each level up to the cap', () => {
        expect(prizeScaleFor(1)).toBe(1);
        expect(prizeScaleFor(6)).toBe(1 + 5 * PRIZE_GROWTH.perLevel);
        expect(prizeScaleFor(11)).toBe(2);
        expect(prizeScaleFor(40)).toBe(PRIZE_GROWTH.max);
        expect([1, 6, 11, 16, 30].map(l => prizeFor(300, l))).toEqual([300, 450, 600, 750, 750]);
    });

    test('losses and zero are never scaled, and prizes round to 5', () => {
        expect(prizeFor(0, 12)).toBe(0);
        expect(prizeFor(-100, 12)).toBe(-100);
        expect(prizeFor(125, 2) % 5).toBe(0);
    });

    test('every prize PowerPlay exists', () => {
        for (const id of PRIZE_POWER_PLAY_IDS) expect(POWER_PLAYS_LIST.some(p => p.id === id), id).toBe(true);
    });

    test('the level-up card shows the new prize multiplier', () => {
        const row = levelUpInfo(6).changes.find(c => c.label === 'PowerPlay prizes');
        expect(row).toMatchObject({ from: `x${prizeScaleFor(5)}`, to: `x${prizeScaleFor(6)}` });
        expect(levelUpInfo(30).changes.some(c => c.label === 'PowerPlay prizes')).toBe(false);
    });
});
