// @vitest-environment jsdom
// v7.29.0 balance pass from the usage stats: time cards per offer, Vowel Lover, E.T., Power Star.
import { describe, test, expect } from 'vitest';
import { limitTimeCards } from '../GameScreen';
import { POWER_PLAYS_LIST, TIME_CARD_IDS } from '../../../data/powerPlays';
import { CHARMS_LIST } from '../../../data/charms';
import { CHARM_BONUS } from '../../../config/gameplay';
import type { PowerPlay } from '../../../types';

const pp = (id: string) => POWER_PLAYS_LIST.find(p => p.id === id)!;
const charm = (id: string) => CHARMS_LIST.find(c => c.id === id)!;
const offer = (ids: string[]) => ({ offeredItems: ids.map(pp), offerDetails: ids.map(id => ({ id, score: 1 })) });

describe('at most one time card per PowerPlay offer', () => {
    test('every time card exists', () => {
        for (const id of TIME_CARD_IDS) expect(pp(id), id).toBeTruthy();
    });
    test('a second time card is swapped for another PowerPlay from the pool', () => {
        const pool = ['timeBoost', 'happyPlace', 'konamiCode', 'plinko', 'hookshot'].map(pp);
        const draw = (from: PowerPlay[], n: number) => offer(from.slice(0, n).map(p => p.id));
        const out = limitTimeCards(offer(['timeBoost', 'happyPlace', 'hookshot']), pool, draw);
        expect(out.offeredItems.map(p => p.id)).toEqual(['timeBoost', 'hookshot', 'konamiCode']);
        expect(out.offeredItems.filter(p => TIME_CARD_IDS.has(p.id))).toHaveLength(1);
        expect(out.offerDetails.map(o => o.id)).toEqual(['timeBoost', 'hookshot', 'konamiCode']);
    });
    test('an offer with one time card or none is left alone', () => {
        const same = offer(['timeBoost', 'konamiCode', 'plinko']);
        expect(limitTimeCards(same, [], () => { throw new Error('no draw'); })).toBe(same);
    });
});

describe('charm changes', () => {
    test('Vowel Lover keeps +20 a vowel but costs time, and says so', () => {
        expect(CHARM_BONUS.theValve).toBe(20);
        expect(charm('theValve').description).toContain(`every word costs ${CHARM_BONUS.theValveSeconds} seconds`);
    });
    test('E.T. is +15 an E and Power Star turns on at a reachable score', () => {
        expect(CHARM_BONUS.oneRing).toBe(15);
        expect(charm('powerStarResidual').description).toContain(`${CHARM_BONUS.powerStarResidualTrigger}+ on a single word`);
        expect(CHARM_BONUS.powerStarResidualTrigger).toBeLessThan(150);
    });
});
