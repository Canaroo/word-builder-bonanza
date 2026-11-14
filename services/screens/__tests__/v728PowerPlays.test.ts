// @vitest-environment jsdom
// The v7.28 PowerPlays (86 -> 100): rules, scoring and reducer paths. The per-word settling in the
// turn hook (Tamagotchi, Time Capsule, rival race, blackjack count, REDRUM, Hadouken...) is
// checked in the real game with the playtest helper.
import { describe, test, expect, vi, afterEach } from 'vitest';
import { gameReducer, screenInitialState, RANDOM_TILE_POWER_PLAYS, type GameScreenState } from '../GameScreen';
import { POWER_PLAYS_LIST, INSTANT_POWER_PLAY_IDS } from '../../../data/powerPlays';
import { POWER_PLAY_VALUES as V, TIME_BONUS } from '../../../config/gameplay';
import { calculateScore } from '../../gameUtils';
import * as gameUtils from '../../gameUtils';
import { RACK_SIZE } from '../../../constants';
import type { GameState, Tile } from '../../../types';
import { tamagotchiPot, tamagotchiFeed, blackjackPayout, blackjackCard, cardSharksPot, drawCard, cardFace, rivalScore, redrumReverse } from '../../rules';

afterEach(() => vi.restoreAllMocks());

const NEW_IDS = ['tamagotchi', 'priceIsRight', 'timeCapsule', 'redrum', 'jackass', 'multiplicity', 'hadouken', 'over9000', 'draftDay', 'smellYaLater', 'birdBox', 'chickenDinner', 'cardSharks', 'psychicFriends'];
const pp = (id: string) => POWER_PLAYS_LIST.find(p => p.id === id)!;
const start = (overrides: Partial<GameState> = {}, time = 40): GameScreenState => {
    const { hand, tileBag } = gameUtils.dealNewHand(gameUtils.createTileBag());
    const padded = Array(RACK_SIZE).fill(null);
    hand.forEach((t, i) => (padded[i] = t));
    return { ...screenInitialState, hand: padded, tileBag, time, isLoading: false, gameState: { ...screenInitialState.gameState, ...overrides } };
};
const tiles = (word: string): Tile[] => word.split('').map(l => ({ ...gameUtils.createTile(l), multiplier: 1, isSuper: false, isCombo: false }));
const scoreWith = (active: Record<string, unknown>) =>
    calculateScore('cat', tiles('CAT'), { ...screenInitialState.gameState, activePowerPlays: active }).totalScore;

describe('v7.28 PowerPlays', () => {
    test('all 14 exist, with unique ids, and the total is 100', () => {
        for (const id of NEW_IDS) expect(pp(id), id).toBeTruthy();
        expect(POWER_PLAYS_LIST).toHaveLength(100);
        expect(new Set(POWER_PLAYS_LIST.map(p => p.id)).size).toBe(100);
    });

    test('descriptions read their numbers from config', () => {
        expect(pp('tamagotchi').description).toContain(`+${tamagotchiPot(V.tamagotchiWords)}`);
        expect(pp('priceIsRight').description).toContain(`+${V.priceIsRightBids[3].prize}`);
        expect(pp('timeCapsule').description).toContain(`x${V.timeCapsuleMultiplier} after ${V.timeCapsuleWords} more words`);
        expect(pp('jackass').description).toContain(`+${TIME_BONUS.jackass} seconds`);
        expect(pp('chickenDinner').description).toContain('21 pays +400, 19-20 pays +200, 17-18 pays +100');
        expect(pp('smellYaLater').description).toContain(`+${V.rivalPrize}`);
    });
});

describe('v7.28 rules', () => {
    test('Tamagotchi pot grows by a bigger step each feeding', () => {
        expect([1, 2, 3].map(tamagotchiFeed)).toEqual([20, 40, 60]);
        expect(tamagotchiPot(0)).toBe(0);
        expect(tamagotchiPot(V.tamagotchiWords)).toBe(420);
    });
    test('blackjack pays 17+ and busts over 21', () => {
        expect([16, 17, 18, 19, 20, 21, 22].map(blackjackPayout)).toEqual([0, 100, 100, 200, 200, 400, 0]);
    });
    test('Card Sharks ladder and cards', () => {
        expect([0, 1, 2, 5, 9].map(cardSharksPot)).toEqual([0, 50, 125, 600, 600]);
        expect(drawCard(() => 0)).toBe(2);
        expect(drawCard(() => 0.9999)).toBe(14);
        expect([10, 11, 14].map(cardFace)).toEqual(['10', 'J', 'A']);
    });
    test('rival scores per second; REDRUM needs 4+ letters', () => {
        expect(rivalScore(10)).toBe(10 * V.rivalPointsPerSecond);
        expect(rivalScore(-3)).toBe(0);
        expect(redrumReverse('STAR')).toBe('rats');
        expect(redrumReverse('CAT')).toBeNull();
    });
    test('Card Sharks: calling right on every card is roughly a 70% bet each time', () => {
        // Best call from each card, over 2..14: higher when the card is low, lower when high.
        let right = 0, wrong = 0;
        for (let c = 2; c <= 14; c++) {
            const higher = 14 - c, lower = c - 2;
            right += Math.max(higher, lower); wrong += Math.min(higher, lower);
        }
        expect(right / (right + wrong)).toBeGreaterThan(0.7);
    });
});

describe('v7.28 scoring', () => {
    test('Jackass x3 and Bird Box x4 on the next word, nothing without them', () => {
        const base = scoreWith({});
        expect(scoreWith({ jackass: true })).toBe(base * V.jackassMultiplier);
        expect(scoreWith({ birdBox: true })).toBe(base * V.birdBoxMultiplier);
    });
});

describe('v7.28 reducer paths', () => {
    test('arming from the pocket stores the right starting state', () => {
        for (const [id, value] of [['redrum', { words: V.redrumWords }], ['chickenDinner', { total: 0 }], ['hadouken', { hits: V.hadoukenHits }], ['tamagotchi', { feeds: 0 }], ['over9000', { words: V.over9000Words }], ['psychicFriends', { words: V.psychicWords }], ['timeCapsule', true], ['birdBox', true]] as const) {
            const s = start({ availablePowerPlays: [pp(id)] });
            const next = gameReducer(s, { type: 'ACTIVATE_POWER_PLAY', payload: pp(id) });
            expect(next.gameState.activePowerPlays[id], id).toEqual(value);
            expect(next.gameState.availablePowerPlays.some(p => p.id === id)).toBe(false);
        }
    });

    test('Jackass takes a strike for time and a x3 next word, and scares off a Tamagotchi', () => {
        const s = start({ strikes: 0, availablePowerPlays: [pp('jackass')], activePowerPlays: { tamagotchi: { feeds: 2 } }, activeBuffs: [pp('tamagotchi')] }, 30);
        const next = gameReducer(s, { type: 'JACKASS', payload: { powerPlay: pp('jackass') } });
        expect(next.gameState.strikes).toBe(1);
        expect(next.time).toBeGreaterThan(30);
        expect(next.gameState.activePowerPlays.jackass).toBe(true);
        expect(next.gameState.activePowerPlays.tamagotchi).toBeUndefined();
        expect(next.gameState.activeBuffs.some(b => b.id === 'tamagotchi')).toBe(false);
        expect(next.modalContent?.type).toBe('outcome');
    });

    test('Jackass never takes the strike that would end the run', () => {
        const s = start({ strikes: 2, availablePowerPlays: [pp('jackass')] });
        expect(gameReducer(s, { type: 'JACKASS', payload: { powerPlay: pp('jackass') } })).toBe(s);
    });

    test('standing in blackjack pays by the count and ends the game', () => {
        const s = start({ score: 100, activePowerPlays: { chickenDinner: { total: 19 } }, activeBuffs: [pp('chickenDinner')] });
        const next = gameReducer(s, { type: 'BLACKJACK_STAND' });
        expect(next.gameState.score).toBe(300);
        expect(next.gameState.activePowerPlays.chickenDinner).toBeUndefined();
        expect(next.modalContent?.type).toBe('outcome');
        const low = gameReducer(start({ score: 100, activePowerPlays: { chickenDinner: { total: 12 } } }), { type: 'BLACKJACK_STAND' });
        expect(low.gameState.score).toBe(100);
        const none = start();
        expect(gameReducer(none, { type: 'BLACKJACK_STAND' })).toBe(none);
    });

    test('Draft Day replaces the lowest-value tiles', () => {
        const s = start();
        const hand = [...tiles('QZEATRSN'), null, null];
        const next = gameReducer({ ...s, hand }, { type: 'DRAFT_TILES', payload: { letters: ['X', 'J', 'K'] } });
        const letters = next.hand.filter(Boolean).map(t => t!.letter);
        expect(letters).toContain('Q');
        expect(letters).toContain('Z');
        expect(letters.filter(l => ['X', 'J', 'K'].includes(l))).toHaveLength(3);
        expect(next.hand.filter(Boolean)).toHaveLength(8);
    });

    test('a strike scares off the Tamagotchi', () => {
        const s = start({ strikes: 0, activePowerPlays: { tamagotchi: { feeds: 3 } }, activeBuffs: [pp('tamagotchi')] });
        const next = gameReducer(s, { type: 'ADD_STRIKE' });
        expect(next.gameState.activePowerPlays.tamagotchi).toBeUndefined();
    });

    test('Multiplicity remembers the last PowerPlay used, but not instant, once-per-run or itself', () => {
        const used = gameReducer(start({ availablePowerPlays: [pp('konamiCode')] }), { type: 'ACTIVATE_POWER_PLAY', payload: pp('konamiCode') });
        expect(used.gameState.lastPowerPlayUsed).toBe('konamiCode');
        const instantId = [...INSTANT_POWER_PLAY_IDS][0];
        const instant = gameReducer({ ...used, gameState: { ...used.gameState, powerPlayOffer: [pp(instantId)] } }, { type: 'CHOOSE_POWER_PLAY', payload: { powerPlay: pp(instantId), allOffered: [pp(instantId)] } });
        expect(instant.gameState.lastPowerPlayUsed).toBe('konamiCode');
        const oncePerRun = POWER_PLAYS_LIST.find(p => p.oncePerRun && !INSTANT_POWER_PLAY_IDS.has(p.id))!;
        const saver = gameReducer({ ...used, gameState: { ...used.gameState, availablePowerPlays: [oncePerRun] } }, { type: 'ACTIVATE_POWER_PLAY', payload: oncePerRun });
        expect(saver.gameState.lastPowerPlayUsed).toBe('konamiCode');
    });
});

describe('timed and blind PowerPlays start the moment they are picked (v7.28.1)', () => {
    // Held in the pocket, a player could build a word first, then activate and submit at once.
    test.each(['popQuizHotshot', 'smellYaLater', 'birdBox'])('%s fires on pick, never reaching the pocket', id => {
        expect(INSTANT_POWER_PLAY_IDS.has(id)).toBe(true);
        const s = start({ powerPlayOffer: [pp(id)] }, 33);
        const next = gameReducer(s, { type: 'CHOOSE_POWER_PLAY', payload: { powerPlay: pp(id), allOffered: [pp(id)] } });
        expect(next.gameState.availablePowerPlays.some(p => p.id === id)).toBe(false);
        expect(next.gameState.activePowerPlays[id]).toBeTruthy();
        expect(pp(id).description).toMatch(/^Starts the moment you pick it/);
    });
    test('the Pop Quiz and race clocks start at the clock when picked', () => {
        const quiz = gameReducer(start({ powerPlayOffer: [pp('popQuizHotshot')] }, 33), { type: 'CHOOSE_POWER_PLAY', payload: { powerPlay: pp('popQuizHotshot'), allOffered: [pp('popQuizHotshot')] } });
        expect(quiz.gameState.activePowerPlays.popQuizHotshot).toEqual({ startClock: 33, startMs: 0 });
        const race = gameReducer(start({ powerPlayOffer: [pp('smellYaLater')] }, 27), { type: 'CHOOSE_POWER_PLAY', payload: { powerPlay: pp('smellYaLater'), allOffered: [pp('smellYaLater')] } });
        expect(race.gameState.activePowerPlays.smellYaLater).toEqual({ words: V.rivalWords, mine: 0, rival: 0, clock: 27, startMs: 0 });
    });

    test('The Price Is Right opens the bid on pick, before any word is built (v7.36.5)', () => {
        const s = gameReducer(start({ powerPlayOffer: [pp('priceIsRight')] }, 40), { type: 'CHOOSE_POWER_PLAY', payload: { powerPlay: pp('priceIsRight'), allOffered: [pp('priceIsRight')] } });
        expect(s.gameState.availablePowerPlays.some(p => p.id === 'priceIsRight')).toBe(false);
        // The bid card replaces the offer right away (queued behind it, it was skipped).
        expect(s.modalContent?.type).toBe('gamble');
        expect((s.modalContent?.data as any)?.id).toBe('priceIsRight');
    });

    test('Pop Quiz times real seconds, not the bank clock (v7.36.1)', () => {
        // At a x2 clock, 3 real seconds drain 6 seconds of bank; the quiz must see 3.
        let s = gameReducer(start({ powerPlayOffer: [pp('popQuizHotshot')] }, 40), { type: 'CHOOSE_POWER_PLAY', payload: { powerPlay: pp('popQuizHotshot'), allOffered: [pp('popQuizHotshot')] } });
        const startMs = (s.gameState.activePowerPlays.popQuizHotshot as any).startMs;
        for (let i = 0; i < 6; i++) s = gameReducer(s, { type: 'TICK_TIMER', ms: 500 });
        expect(s.time).toBe(34);
        expect(((s.quizMs ?? 0) - startMs) / 1000).toBe(3);
        // Frozen seconds still count as real time.
        s = gameReducer(s, { type: 'TICK_FREEZE' });
        expect(((s.quizMs ?? 0) - startMs) / 1000).toBe(4);
    });
});

describe('random-tile PowerPlays pick from the whole rack (v7.28.1)', () => {
    // Parking tiles in the word-building row used to protect them from the random pick.
    const parked = () => {
        const s = start();
        const rack = tiles('QZEATRSN');
        return { ...s, hand: [rack[0], null, null, null, null, null, null, null, null, null], buildRow: rack.slice(1).map((tile, i) => ({ tile, originalIndex: i + 1 })).concat([null as any]) };
    };
    test('One Tile to Rule Them All can land on a parked tile, and the row goes back to the hand', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.99);
        const s = { ...parked(), gameState: { ...parked().gameState, availablePowerPlays: [pp('oneTileToRuleThemAll')] } };
        const next = gameReducer(s, { type: 'ACTIVATE_POWER_PLAY', payload: pp('oneTileToRuleThemAll') });
        expect(next.buildRow.every(i => !i)).toBe(true);
        expect(next.hand.filter(Boolean)).toHaveLength(8);
        expect(next.hand[7]?.tempPoints).toBe(30); // a tile that was parked
    });
    test('Red Wedding takes 2 of all 8 tiles, parked ones included', () => {
        const s = { ...parked(), gameState: { ...parked().gameState, availablePowerPlays: [pp('redWedding')] } };
        const next = gameReducer(s, { type: 'ACTIVATE_POWER_PLAY', payload: pp('redWedding') });
        expect(next.buildRow.every(i => !i)).toBe(true);
        expect(next.hand.filter(Boolean)).toHaveLength(6);
    });
    test('the list covers every random-tile PowerPlay', () => {
        expect([...RANDOM_TILE_POWER_PLAYS].sort()).toEqual(['iceIceMaybe', 'morphinTime', 'oneTileToRuleThemAll', 'redWedding', 'rescueDrop']);
    });
});

describe('The Price Is Right: a missed bid costs points (v7.28.3)', () => {
    test('each bid risks half its prize, and the description says so', () => {
        for (const b of V.priceIsRightBids) expect(b.miss).toBe(b.prize / 2);
        expect(pp('priceIsRight').description).toContain(`Miss and you lose ${V.priceIsRightBids.map(b => b.miss).join(', ')}`);
    });
});

describe('Daily Double cheese fixes (v7.28.8)', () => {
    test('fires on pick with a wager set from the score right then', () => {
        expect(INSTANT_POWER_PLAY_IDS.has('dailyDouble')).toBe(true);
        const s = start({ score: 3000, powerPlayOffer: [pp('dailyDouble')] });
        const next = gameReducer(s, { type: 'CHOOSE_POWER_PLAY', payload: { powerPlay: pp('dailyDouble'), allOffered: [pp('dailyDouble')] } });
        expect(next.gameState.availablePowerPlays.some(p => p.id === 'dailyDouble')).toBe(false);
        expect(next.gameState.activePowerPlays.dailyDouble).toEqual({ wager: 300 });
        expect(next.gameState.activeBuffs.find(b => b.id === 'dailyDouble')?.description).toContain('Wager 300');
        expect(pp('dailyDouble').description).toMatch(/^Starts the moment you pick it/);
    });

    test('a Sliders undo keeps a settled bet settled', () => {
        const before = start({ score: 1000, activePowerPlays: { dailyDouble: { wager: 200 } }, activeBuffs: [pp('dailyDouble')], log: [] });
        const loss = { type: 'event', id: 'pp-dailyDouble-1', name: 'Daily Double', description: 'lost', scoreChange: -200, cumulativeScore: 805 } as any;
        const after: GameScreenState = {
            ...before,
            lastTurnState: { gameState: before.gameState, hand: before.hand, buildRow: before.buildRow, time: before.time, tileBag: before.tileBag } as any,
            gameState: { ...before.gameState, score: 805, activePowerPlays: {}, activeBuffs: [], log: [{ type: 'word', word: 'CAT', score: 5 } as any, loss], availablePowerPlays: [pp('sliders')] },
        };
        const undone = gameReducer(after, { type: 'RESTORE_LAST_TURN' });
        expect(undone.gameState.score).toBe(800); // back before the word, but the -200 stays
        expect(undone.gameState.activePowerPlays.dailyDouble).toBeUndefined();
        expect(undone.gameState.log.some(e => e.type === 'event' && e.id === 'pp-dailyDouble-1')).toBe(true);
    });

    test.each(['heisenberg', 'doubleOrNothing', 'blueShellSurprise', 'spaceInvader', 'scroogeSwipe'])('a Sliders undo does not re-arm a used gamble: %s (v7.36.6)', (id) => {
        // The word lost its flip (scored 0); undoing it rewinds the word but must not give a free reroll.
        const before = start({ score: 1000, activePowerPlays: { [id]: true }, activeBuffs: [pp(id)], log: [] });
        const after: GameScreenState = {
            ...before,
            lastTurnState: { gameState: before.gameState, hand: before.hand, buildRow: before.buildRow, time: before.time, tileBag: before.tileBag } as any,
            gameState: { ...before.gameState, score: 1000, activePowerPlays: {}, activeBuffs: [], log: [{ type: 'word', word: 'QUIZ', score: 0 } as any], availablePowerPlays: [pp('sliders')] },
        };
        const undone = gameReducer(after, { type: 'RESTORE_LAST_TURN' });
        expect(undone.gameState.activePowerPlays[id]).toBeUndefined();
        expect(undone.gameState.activeBuffs.some(b => b.id === id)).toBe(false);
        expect(undone.gameState.score).toBe(1000);
    });
});

describe('gamble cheese fixes (v7.28.9)', () => {
    const roll = (card: number) => () => (card - 2 + 0.5) / 13; // drawCard gives 2 + floor(r * 13)
    test('blackjack deals cards: faces count 10, an ace is 11 unless that busts', () => {
        expect(blackjackCard(0, roll(7))).toEqual({ face: '7', value: 7 });
        expect(blackjackCard(0, roll(13))).toEqual({ face: 'K', value: 10 });
        expect(blackjackCard(5, roll(14))).toEqual({ face: 'A', value: 11 });
        expect(blackjackCard(15, roll(14))).toEqual({ face: 'A', value: 1 });
        expect(pp('chickenDinner').description).toContain('each valid word deals you a card');
    });

    test('Mission: Impossible fires on pick: time now, the promise armed', () => {
        expect(INSTANT_POWER_PLAY_IDS.has('missionImpossible')).toBe(true);
        const s = start({ powerPlayOffer: [pp('missionImpossible')] }, 30);
        const next = gameReducer(s, { type: 'CHOOSE_POWER_PLAY', payload: { powerPlay: pp('missionImpossible'), allOffered: [pp('missionImpossible')] } });
        expect(next.time).toBeGreaterThan(30);
        expect(next.gameState.activePowerPlays.missionImpossible).toEqual({ words: V.missionImpossibleWords });
        expect(next.gameState.availablePowerPlays.some(p => p.id === 'missionImpossible')).toBe(false);
        expect(next.modalContent?.type).toBe('outcome'); // in the offer's place, so the next round can't wipe it (v7.39.2)
        expect(pp('missionImpossible').description).toMatch(/^Starts the moment you pick it/);
    });

    test('an open gamble card keeps its board in the pop-up (saved with the run)', () => {
        const s = { ...start(), modalContent: { type: 'gamble', title: 'Card Sharks', data: { id: 'cardSharks', icon: '🃏' } } as any };
        const a = gameReducer(s, { type: 'SET_GAMBLE_STATE', payload: { key: 'card', value: 9 } });
        const b = gameReducer(a, { type: 'SET_GAMBLE_STATE', payload: { key: 'right', value: 2 } });
        expect(b.modalContent?.data.saved).toEqual({ card: 9, right: 2 });
        const closed = { ...start(), modalContent: null };
        expect(gameReducer(closed, { type: 'SET_GAMBLE_STATE', payload: { key: 'card', value: 9 } })).toBe(closed);
    });
});
