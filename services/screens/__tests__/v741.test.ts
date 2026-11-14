// @vitest-environment jsdom
// v7.41: Phoenix Down (continue for Credits), charm sets, the Mystery Tape and power word hints.
import { describe, test, expect } from 'vitest';
import { gameReducer, screenInitialState, pullSetPiece, dealMysteryTape, type GameScreenState } from '../GameScreen';
import { CHARMS_LIST } from '../../../data/charms';
import { POWER_PLAYS_LIST, INSTANT_POWER_PLAY_IDS, TIME_CARD_IDS } from '../../../data/powerPlays';
import { CHARM_SETS, completedSets, setBonusFor, setPullCandidates, setsWith } from '../../../data/charmSets';
import { CHARM_SET_BONUS, CHARM_SLOTS, MYSTERY_TAPE } from '../../../config/gameplay';
import { PHOENIX_DOWN } from '../../../config/progression';
import { findPowerWordHint, powerWordHintStands } from '../../powerWordHint';
import { prizeFor } from '../../rules';
import type { GameState, Charm, PowerPlay } from '../../../types';

const start = (overrides: Partial<GameState> = {}, screen: Partial<GameScreenState> = {}): GameScreenState =>
    ({ ...screenInitialState, time: 40, isLoading: false, ...screen, gameState: { ...screenInitialState.gameState, ...overrides } });
const charm = (id: string): Charm => CHARMS_LIST.find(c => c.id === id)!;
const pp = (id: string): PowerPlay => POWER_PLAYS_LIST.find(p => p.id === id)!;

describe('Phoenix Down', () => {
    test('the offer pauses the run and is marked as shown', () => {
        const s = gameReducer(start({ strikes: 3 }), { type: 'OFFER_CONTINUE', payload: { reason: 'strikes' } });
        expect(s.isPaused).toBe(true);
        expect(s.modalContent?.type).toBe('continue-offer');
        expect(s.modalContent?.data.reason).toBe('strikes');
        expect(s.gameState.continueOffered).toBe(true);
    });
    test('accepting wipes strikes, restores the clock and keeps the score', () => {
        const offered = gameReducer(start({ strikes: 3, score: 4321 }, { time: 2 }), { type: 'OFFER_CONTINUE', payload: { reason: 'strikes' } });
        const s = gameReducer(offered, { type: 'ACCEPT_CONTINUE' });
        expect(s.gameState.strikes).toBe(0);
        expect(s.time).toBe(PHOENIX_DOWN.seconds);
        expect(s.gameState.score).toBe(4321);
        expect(s.gameState.continued).toBe(true);
        expect(s.modalContent).toBeNull();
        expect(s.isPaused).toBe(false);
        expect(s.gameState.log.some(e => e.type === 'event' && e.name === PHOENIX_DOWN.name)).toBe(true);
    });
    test('a clock-out continue never lowers a bigger clock', () => {
        const offered = gameReducer(start({}, { time: 0 }), { type: 'OFFER_CONTINUE', payload: { reason: 'time' } });
        expect(gameReducer(offered, { type: 'ACCEPT_CONTINUE' }).time).toBe(PHOENIX_DOWN.seconds);
        expect(gameReducer({ ...offered, time: 55 }, { type: 'ACCEPT_CONTINUE' }).time).toBe(55);
    });
});

describe('charm sets', () => {
    test('every member is a real charm, in one set only, and sets fit the slots', () => {
        const seen = new Set<string>();
        for (const set of CHARM_SETS) {
            expect(set.members.length).toBeGreaterThanOrEqual(2);
            expect(set.members.length).toBeLessThanOrEqual(Math.min(3, CHARM_SLOTS));
            for (const id of set.members) {
                expect(charm(id), `${set.id}: ${id}`).toBeTruthy();
                expect(seen.has(id), `${id} is in two sets`).toBe(false);
                seen.add(id);
            }
            // A set line must not look like a charm's own line (upgrades and boosts match by name).
            expect(CHARMS_LIST.some(c => `🧩 ${set.name} set`.startsWith(c.name))).toBe(false);
        }
    });
    test('pairs and trios pay their bonus only when complete', () => {
        const pair = CHARM_SETS.find(s => s.members.length === 2)!;
        const trio = CHARM_SETS.find(s => s.members.length === 3)!;
        expect(setBonusFor(pair)).toBe(CHARM_SET_BONUS.pair);
        expect(setBonusFor(trio)).toBe(CHARM_SET_BONUS.trio);
        expect(completedSets(trio.members.slice(0, 2))).toEqual([]);
        expect(completedSets([...trio.members, ...pair.members]).map(s => s.id).sort()).toEqual([pair.id, trio.id].sort());
        expect(setPullCandidates([trio.members[0]])).toEqual(trio.members.slice(1));
        expect(setPullCandidates(trio.members)).toEqual([]);
        expect(setsWith(pair.members[0])).toEqual([pair]);
    });
    test('equipping the last piece announces the set', () => {
        const pair = CHARM_SETS.find(s => s.members.length === 2)!;
        const s = start({ activeCharms: [charm(pair.members[0])] });
        const after = gameReducer(s, { type: 'CHOOSE_CHARM', payload: { charm: charm(pair.members[1]), hand: [], allOffered: [charm(pair.members[1])] } });
        expect(after.gameState.lastPowerPlayResult?.message).toContain('SET COMPLETE');
        expect(after.gameState.lastPowerPlayResult?.message).toContain(pair.name);
        expect(after.gameState.log.some(e => e.type === 'event' && e.name === `Set complete: ${pair.name}`)).toBe(true);
    });
    test('offers lean toward a missing piece about pullChance of the time, and never without a started set', () => {
        const pair = CHARM_SETS.find(s => s.members.length === 2)!;
        const outside = CHARMS_LIST.filter(c => setsWith(c.id).length === 0);
        const offer = { offeredItems: outside.slice(0, 3), offerDetails: outside.slice(0, 3).map(c => ({ id: c.id, score: 1 })) };
        const pool = CHARMS_LIST.filter(c => c.id !== pair.members[0]);
        let pulled = 0;
        for (let n = 0; n < 400; n++) {
            const out = pullSetPiece(offer, pool, { activeCharms: [charm(pair.members[0])], runSeed: 99, totalOffersMade: n });
            expect(out.offeredItems).toHaveLength(3);
            if (out.offeredItems[2].id === pair.members[1]) { pulled++; expect(out.offerDetails[2].id).toBe(pair.members[1]); }
            else expect(out).toBe(offer);
            expect(pullSetPiece(offer, pool, { activeCharms: [], runSeed: 99, totalOffersMade: n })).toBe(offer);
        }
        expect(pulled / 400).toBeGreaterThan(CHARM_SET_BONUS.pullChance - 0.1);
        expect(pulled / 400).toBeLessThan(CHARM_SET_BONUS.pullChance + 0.1);
    });
});

describe('Mystery Tape', () => {
    test('the pool is real pocket PowerPlays: nothing instant, no time cards', () => {
        for (const id of MYSTERY_TAPE.pool) {
            expect(pp(id), id).toBeTruthy();
            expect(INSTANT_POWER_PLAY_IDS.has(id), `${id} fires on pick`).toBe(false);
            expect(TIME_CARD_IDS.has(id), `${id} is a time card`).toBe(false);
        }
        expect(new Set(MYSTERY_TAPE.pool).size).toBe(MYSTERY_TAPE.pool.length);
    });
    test('about one offer in four gets a tape, as the last card, never a duplicate', () => {
        const shown = POWER_PLAYS_LIST.filter(p => !(MYSTERY_TAPE.pool as readonly string[]).includes(p.id)).slice(0, 3);
        const offer = { offeredItems: shown, offerDetails: shown.map(p => ({ id: p.id, score: 1 })) };
        let tapes = 0;
        for (let n = 0; n < 800; n++) {
            const out = dealMysteryTape(offer, POWER_PLAYS_LIST, { runSeed: 7, totalOffersMade: n });
            if (!out.mysteryId) { expect(out.offeredItems).toEqual(shown); continue; }
            tapes++;
            expect(out.offeredItems[2].id).toBe(out.mysteryId);
            expect(MYSTERY_TAPE.pool).toContain(out.mysteryId);
            expect(out.offeredItems.slice(0, 2)).toEqual(shown.slice(0, 2));
            expect(new Set(out.offeredItems.map(p => p.id)).size).toBe(3);
        }
        expect(tapes / 800).toBeGreaterThan(MYSTERY_TAPE.chance - 0.06);
        expect(tapes / 800).toBeLessThan(MYSTERY_TAPE.chance + 0.06);
    });
    test('the same seed and offer number deal the same tape (Daily Run)', () => {
        const shown = POWER_PLAYS_LIST.slice(0, 3);
        const offer = { offeredItems: shown, offerDetails: shown.map(p => ({ id: p.id, score: 1 })) };
        for (let n = 0; n < 50; n++) {
            expect(dealMysteryTape(offer, POWER_PLAYS_LIST, { runSeed: 1234, totalOffersMade: n }).mysteryId)
                .toBe(dealMysteryTape(offer, POWER_PLAYS_LIST, { runSeed: 1234, totalOffersMade: n }).mysteryId);
        }
    });
    test('taking the tape pays the prize once and pockets the PowerPlay; other picks pay nothing', () => {
        const tape = pp(MYSTERY_TAPE.pool[0]);
        const other = pp(MYSTERY_TAPE.pool[1]);
        const s = start({ score: 1000, mysteryTapeId: tape.id });
        const took = gameReducer(s, { type: 'CHOOSE_POWER_PLAY', payload: { powerPlay: tape, allOffered: [other, tape] } });
        expect(took.gameState.score).toBe(1000 + prizeFor(MYSTERY_TAPE.points, 1));
        expect(took.gameState.availablePowerPlays.map(p => p.id)).toEqual([tape.id]);
        expect(took.gameState.mysteryTapeId).toBeNull();
        expect(took.gameState.log.some(e => e.type === 'event' && e.name === 'Mystery Tape')).toBe(true);
        const skipped = gameReducer(s, { type: 'CHOOSE_POWER_PLAY', payload: { powerPlay: other, allOffered: [other, tape] } });
        expect(skipped.gameState.score).toBe(1000);
        expect(skipped.gameState.mysteryTapeId).toBeNull();
    });
});

describe('power word hint', () => {
    test('finds a power word the tiles can spell; the chip gets an icon and a length', () => {
        const hint = findPowerWordHint(['S', 'L', 'O', 'T', 'E', 'A', 'R', 'N'], undefined, 1)!;
        expect(hint).toBeTruthy();
        expect(hint.length).toBe(4);
        // What the chip shows: an icon and a length, never the word.
        expect(hint.icon).not.toMatch(/[A-Za-z]/);
        expect(findPowerWordHint(['X', 'Q', 'Z', 'J', 'V', 'K', 'B', 'B'], undefined, 1)).toBeNull();
    });
    test('skips a power word that already fired this level', () => {
        const letters = ['C', 'A', 'K', 'E', 'X', 'Z', 'Q', 'J'];
        const hint = findPowerWordHint(letters, undefined, 2)!;
        expect(hint.effect).toBe('cake');
        expect(findPowerWordHint(letters, { [hint.id]: 2 }, 2)).toBeNull();
        expect(findPowerWordHint(letters, { [hint.id]: 2 }, 3)?.id).toBe(hint.id);
    });
    test('a hint stands only on its level and while the tiles still spell it', () => {
        const letters = ['C', 'A', 'K', 'E', 'X', 'Z', 'Q', 'J'];
        const hint = findPowerWordHint(letters, undefined, 2)!;
        expect(powerWordHintStands({ level: 2, id: hint.id }, letters, undefined, 2)?.id).toBe(hint.id);
        expect(powerWordHintStands({ level: 2, id: hint.id }, letters, undefined, 3)).toBeNull();
        expect(powerWordHintStands({ level: 2, id: hint.id }, ['C', 'A', 'K', 'X'], undefined, 2)).toBeNull();
        expect(powerWordHintStands(null, letters, undefined, 2)).toBeNull();
    });
});
