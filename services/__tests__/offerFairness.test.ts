import { describe, test, expect } from 'vitest';
import { getOffer } from '../gameUtils';
import { createInitialGameState } from '../screens/GameScreen';
import { POWER_PLAYS_LIST } from '../../data/powerPlays';
import { CHARMS_LIST } from '../../data/charms';
import type { GameState } from '../../types';

// v7.67.2: offers draw fairly. The seed is mixed for each offer (neighbouring seeds used to draw
// alike), and an offer holds at most 2 cards of one kind (it was 1, which starved the biggest kind).
describe('offer fairness (v7.67.2)', () => {
    test('back-to-back offers from one run spread evenly over the pool', () => {
        const gs = { ...createInitialGameState(), runSeed: 1_795_000_000_123 } as GameState;
        const counts: Record<string, number> = {};
        const offers = 4000;
        for (let n = 0; n < offers; n++) {
            // A fresh weighting each time, so only the random draw differs between offers.
            const { offeredItems } = getOffer(POWER_PLAYS_LIST, 3, { ...gs, totalOffersMade: n, itemStats: Object.fromEntries(POWER_PLAYS_LIST.map(p => [p.id, { offered: 1, lastOfferedTurn: -99 }])) });
            for (const it of offeredItems) counts[it.id] = (counts[it.id] || 0) + 1;
        }
        // Every PowerPlay shows up, and none is starved: at least half of the average share.
        const avg = (offers * 3) / POWER_PLAYS_LIST.length;
        for (const p of POWER_PLAYS_LIST) expect(counts[p.id] ?? 0, p.id).toBeGreaterThan(avg * 0.5);
    });
    test('never three cards of one kind when other kinds are available', () => {
        const gs = createInitialGameState();
        for (const list of [POWER_PLAYS_LIST, CHARMS_LIST]) {
            for (let n = 0; n < 1500; n++) {
                const { offeredItems } = getOffer(list, 3, { ...gs, totalOffersMade: n });
                const kinds = offeredItems.map(i => i.subtheme);
                expect(new Set(kinds).size).toBeGreaterThan(1);
            }
        }
    });
    test('the time-card swap draws from its own stream', () => {
        const gs = { ...createInitialGameState(), runSeed: 42 } as GameState;
        const a = getOffer(POWER_PLAYS_LIST, 3, gs).offeredItems.map(i => i.id);
        expect(getOffer(POWER_PLAYS_LIST, 3, gs).offeredItems.map(i => i.id)).toEqual(a); // same seed, same offer
        let differs = 0;
        for (let n = 0; n < 50; n++) {
            const g = { ...gs, totalOffersMade: n };
            if (getOffer(POWER_PLAYS_LIST, 3, g).offeredItems[0].id !== getOffer(POWER_PLAYS_LIST, 3, g, 'time-swap').offeredItems[0].id) differs++;
        }
        expect(differs).toBeGreaterThan(30);
    });
});
