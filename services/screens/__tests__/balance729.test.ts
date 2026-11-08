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
        expect(charm('theValve').description).toContain(`every word costs ${CHARM_BONUS.theValveSeconds} second`);
        expect(charm('theValve').description).not.toContain('1 seconds');
    });
    test('E.T. is +15 an E and Power Star turns on at a reachable score', () => {
        expect(CHARM_BONUS.oneRing).toBe(15);
        expect(charm('powerStarResidual').description).toContain(`${CHARM_BONUS.powerStarResidualTrigger}+ on a single word`);
        expect(CHARM_BONUS.powerStarResidualTrigger).toBeLessThan(150);
    });
});

describe('reworked PowerPlays (v7.29.1)', () => {
    // Uses the reducer directly: CHOOSE_POWER_PLAY for the Money Bin, the tile-pick step for the Zapper.
    test("Scrooge's Money Bin fires on pick and costs nothing", async () => {
        const { gameReducer, screenInitialState } = await import('../GameScreen');
        const { INSTANT_POWER_PLAY_IDS } = await import('../../../data/powerPlays');
        const { POWER_PLAY_VALUES: V } = await import('../../../config/gameplay');
        expect(INSTANT_POWER_PLAY_IDS.has('scroogeSwipe')).toBe(true);
        const s = { ...screenInitialState, isLoading: false, gameState: { ...screenInitialState.gameState, score: 700, powerPlayOffer: [pp('scroogeSwipe')] } };
        const next = gameReducer(s, { type: 'CHOOSE_POWER_PLAY', payload: { powerPlay: pp('scroogeSwipe'), allOffered: [pp('scroogeSwipe')] } });
        expect(next.gameState.score).toBe(700);
        expect(next.gameState.activePowerPlays.scroogeSwipe).toBe(true);
        expect(pp('scroogeSwipe').description).toContain(`${V.moneyBinScore}+ points, earn ${V.moneyBinCredits} Credits`);
    });

    test('Duck Hunt shoots a tile and lands a new one worth triple', async () => {
        const { gameReducer, screenInitialState } = await import('../GameScreen');
        const gameUtils = await import('../../gameUtils');
        const { POWER_PLAY_VALUES: V } = await import('../../../config/gameplay');
        const hand: any[] = 'QZEATRSN'.split('').map(l => ({ ...gameUtils.createTile(l), multiplier: 1 }));
        while (hand.length < 10) hand.push(null);
        const s = {
            ...screenInitialState, isLoading: false, hand, tileBag: gameUtils.createTileBag(),
            tileForSelection: { tile: hand[0], originalIndex: 0 },
            gameState: { ...screenInitialState.gameState, availablePowerPlays: [pp('duckHunt')] },
        };
        const next = gameReducer(s, { type: 'COMPLETE_POWER_PLAY_ACTIVATION', payload: { powerPlay: pp('duckHunt') } });
        const landed = next.hand[0]!;
        expect(landed.id).not.toBe(hand[0].id);
        expect(landed.tempPoints).toBe(landed.points * V.zapperMultiplier);
        expect(next.modalContent?.type).toBe('outcome');
        expect(next.gameState.availablePowerPlays).toHaveLength(0);
    });

    test('Wario Warp pays more for the same time', async () => {
        const { POWER_PLAY_VALUES: V } = await import('../../../config/gameplay');
        expect(V.warioWarpPoints).toBe(300);
        expect(pp('warioWarp').description).toContain(`+${V.warioWarpPoints} points now`);
    });
});
