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
import { tamagotchiPot, tamagotchiFeed, blackjackPayout, blackjackCard, cardSharksPot, drawCard, cardFace, rivalScore, rivalRateFor, redrumReverse } from '../../rules';

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
    test('all 14 exist, with unique ids, and the total is 106', () => {
        for (const id of NEW_IDS) expect(pp(id), id).toBeTruthy();
        expect(POWER_PLAYS_LIST).toHaveLength(106); // v7.74.0: Survey Says!, Center Square
        expect(new Set(POWER_PLAYS_LIST.map(p => p.id)).size).toBe(106);
    });

    test('descriptions read their numbers from config', () => {
        expect(pp('tamagotchi').description).toContain(`+${tamagotchiPot(V.tamagotchiWords)}`);
        expect(pp('priceIsRight').description).toContain(`+${V.priceIsRightBids[3].prize}`);
        expect(pp('timeCapsule').description).toContain(`x${V.timeCapsuleMultiplier} after ${V.timeCapsuleWords} more words`);
        expect(pp('jackass').description).toContain(`+${TIME_BONUS.jackass} seconds`);
        expect(pp('chickenDinner').description).toContain(`+${V.blackjackWin}`); // v7.67.1: a blackjack card
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
        expect(rivalScore(10, 40)).toBe(400);
        // The rival races at your pace this run (score per second of play), never below the floor.
        expect(rivalRateFor(3100, 100_000)).toBe(31);
        expect(rivalRateFor(500, 100_000)).toBe(V.rivalPointsPerSecond);
        expect(rivalRateFor(9000, 10_000)).toBe(V.rivalPointsPerSecond); // under 20 seconds: no pace yet
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
        for (const [id, value] of [['redrum', { words: V.redrumWords }], ['hadouken', { hits: V.hadoukenHits }], ['tamagotchi', { feeds: 0 }], ['over9000', { words: V.over9000Words }], ['timeCapsule', true], ['birdBox', true]] as const) {
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
        // No pace yet (fresh run): the rival runs at the floor rate.
        expect(race.gameState.activePowerPlays.smellYaLater).toEqual({ words: V.rivalWords, mine: 0, rival: 0, clock: 27, startMs: 0, rate: V.rivalPointsPerSecond });
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
        expect(pp('priceIsRight').description).toContain('Fall short and you lose 50, 100, 150 or 225');
    });
});

describe('Daily Double cheese fixes (v7.28.8)', () => {
    test('fires on pick with a wager set from the score right then', () => {
        expect(INSTANT_POWER_PLAY_IDS.has('dailyDouble')).toBe(true);
        const s = start({ score: 3000, powerPlayOffer: [pp('dailyDouble')] });
        const next = gameReducer(s, { type: 'CHOOSE_POWER_PLAY', payload: { powerPlay: pp('dailyDouble'), allOffered: [pp('dailyDouble')] } });
        expect(next.gameState.availablePowerPlays.some(p => p.id === 'dailyDouble')).toBe(false);
        expect(next.gameState.activePowerPlays.dailyDouble).toEqual({ wager: V.dailyDoubleBet });
        expect(next.gameState.activeBuffs.find(b => b.id === 'dailyDouble')?.description).toContain(`Bet ${V.dailyDoubleBet}`);
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
    });

    test('Mission: Impossible fires on pick: its mission card opens in the offer\'s place (v7.55.0)', () => {
        expect(INSTANT_POWER_PLAY_IDS.has('missionImpossible')).toBe(true);
        const s = start({ powerPlayOffer: [pp('missionImpossible')] }, 30);
        const next = gameReducer(s, { type: 'CHOOSE_POWER_PLAY', payload: { powerPlay: pp('missionImpossible'), allOffered: [pp('missionImpossible')] } });
        expect(next.time).toBe(30); // no time any more
        expect(next.gameState.activePowerPlays.missionImpossible).toBeUndefined(); // armed only when accepted
        expect(next.gameState.availablePowerPlays.some(p => p.id === 'missionImpossible')).toBe(false);
        expect(next.modalContent).toMatchObject({ type: 'gamble', data: { id: 'missionImpossible' } }); // in the offer's place (v7.39.2)
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

describe('PowerPlay time pays in full (v7.40.1)', () => {
    // A level-9 player (144 words) with 70 s on the clock: the card says +10, it used to pay 3.
    const level9 = (time: number) => start({
        log: Array.from({ length: 144 }, (_, i) => ({ type: 'word', word: 'CAT', status: 'valid', score: 5, id: `w${i}` })) as any,
        availablePowerPlays: [pp('timeBoost')],
    }, time);
    test('Most Excellent Detour adds its full seconds late in a run, even above 60 s', () => {
        const s = gameReducer(level9(70), { type: 'ACTIVATE_POWER_PLAY', payload: pp('timeBoost') } as any);
        expect(s.time).toBe(70 + TIME_BONUS.timeBoost);
    });
    test('the 90 s cap still applies', () => {
        const s = gameReducer(level9(85), { type: 'ACTIVATE_POWER_PLAY', payload: pp('timeBoost') } as any);
        expect(s.time).toBe(90);
    });
});

describe('Chicken Dinner blackjack card and Gump Luck box (v7.67.1)', () => {
    test('totals: faces 10, aces 11 or 1', async () => {
        const { blackjackTotal } = await import('../../rules');
        expect(blackjackTotal([14, 13])).toBe(21);
        expect(blackjackTotal([14, 14, 9])).toBe(21);
        expect(blackjackTotal([10, 9, 5])).toBe(24);
        expect(blackjackTotal([14, 6, 10])).toBe(17);
    });
    test('the deal, hits and the dealer drawing to 17 come from the saved deck', async () => {
        const { blackjackHands } = await import('../../rules');
        const deck = [10, 7, 9, 5, 2, 3, 8, 10, 10, 10, 10, 10, 10, 10, 10, 10];
        expect(blackjackHands(deck, 0, false)).toEqual({ player: [10, 7], dealer: [9, 5] });
        // One hit takes the 2; standing then lets the dealer draw 3 (17) and stop.
        expect(blackjackHands(deck, 1, true)).toEqual({ player: [10, 7, 2], dealer: [9, 5, 3] });
        // A bust means the dealer doesn't draw.
        expect(blackjackHands([10, 9, 9, 5, 5, 3], 1, true).dealer).toEqual([9, 5]);
    });
    test('results and prizes', async () => {
        const { blackjackResult, blackjackPrize } = await import('../../rules');
        expect(blackjackResult([14, 13], [10, 9])).toBe('natural');
        expect(blackjackResult([14, 13], [14, 12])).toBe('push');
        expect(blackjackResult([10, 9], [10, 8])).toBe('win');
        expect(blackjackResult([10, 7], [10, 6, 9])).toBe('win'); // dealer busts
        expect(blackjackResult([10, 7], [10, 7])).toBe('push');
        expect(blackjackResult([10, 7], [10, 9])).toBe('lose');
        expect(blackjackResult([10, 9, 5], [10, 7])).toBe('bust');
        expect(blackjackResult([10, 9], [14, 13])).toBe('lose');
        expect(blackjackPrize('natural')).toBe(V.blackjackNatural);
        expect(blackjackPrize('win')).toBe(V.blackjackWin);
        expect(blackjackPrize('push')).toBe(V.blackjackPush);
        expect(blackjackPrize('lose')).toBe(0);
        expect(blackjackPrize('bust')).toBe(0);
    });
    test('both open a card from the pocket; Gump Luck rolls 25% each', async () => {
        const { GAMBLE_CARD_IDS } = await import('../../../components/GambleCard');
        expect(GAMBLE_CARD_IDS).toContain('chickenDinner');
        expect(GAMBLE_CARD_IDS).toContain('gumpLuck');
        const { gumpRoll } = await import('../../rules');
        expect([0, 0.3, 0.6, 0.9].map(r => gumpRoll(() => r))).toEqual(['time', 'points', 'shuffle', 'empty']);
    });
    test('a Gump shuffle from the card adds a shuffle', () => {
        const s = start({ shuffleCount: 2 });
        const next = gameReducer(s, { type: 'APPLY_GAMBLE', payload: { powerPlay: pp('gumpLuck'), shuffles: 1, headline: '+1 SHUFFLE', detail: '', tone: 'win' } });
        expect(next.gameState.shuffleCount).toBe(3);
    });
});

describe("Fortune's Favor: a Magic 8-Ball card (v7.72.5)", () => {
    test('it opens a card from the pocket, with the same odds and amounts as before', async () => {
        const { GAMBLE_CARD_IDS } = await import('../../../components/GambleCard');
        expect(GAMBLE_CARD_IDS).toContain('fortunesFavor');
        const { fortuneRoll, fortunePoints } = await import('../../rules');
        const kinds = [0, 0.39, 0.4, 0.89, 0.9, 0.99].map(r => fortuneRoll(() => r).kind);
        expect(kinds).toEqual(['lose', 'lose', 'win', 'win', 'jackpot', 'jackpot']);
        expect([fortunePoints('lose'), fortunePoints('win'), fortunePoints('jackpot')]).toEqual([-200, 250, 500]);
        expect(pp('fortunesFavor').description).toContain('+250');
    });
    test('a win grows with the level like other gamble prizes; a loss stays 200', () => {
        const log = Array.from({ length: 5 * 18 }, () => ({ type: 'word', word: 'CAT', status: 'valid', score: 5, baseScore: 5, bonuses: [], definition: '', cumulativeScore: 5 })) as any;
        const s = start({ score: 1000, log });
        const win = gameReducer(s, { type: 'APPLY_GAMBLE', payload: { powerPlay: pp('fortunesFavor'), points: 250, headline: '+250 POINTS', detail: 'x', tone: 'win' } } as any);
        expect(win.gameState.score).toBeGreaterThan(1250);
        const lose = gameReducer(s, { type: 'APPLY_GAMBLE', payload: { powerPlay: pp('fortunesFavor'), points: -200, headline: '-200 POINTS', detail: 'x', tone: 'lose' } } as any);
        expect(lose.gameState.score).toBe(800);
    });
});

describe('PowerPlays that fire on pick (v7.67.7)', () => {
    const pick = (s: GameScreenState, id: string) => gameReducer({ ...s, gameState: { ...s.gameState, powerPlayOffer: [pp(id)] } }, { type: 'CHOOSE_POWER_PLAY', payload: { powerPlay: pp(id), allOffered: [pp(id)] } });
    test('Hadouken! arms on pick instead of going to the pocket', () => {
        const next = pick(start(), 'hadouken');
        expect(next.gameState.activePowerPlays.hadouken).toEqual({ hits: V.hadoukenHits });
        expect(next.gameState.availablePowerPlays).toHaveLength(0);
    });
    test('Neuralyzer lines up a charm offer on pick', () => {
        const next = pick(start(), 'neuralyzer');
        expect(next.gameState.neuralyzerOffer).toBe(true);
        expect(next.gameState.availablePowerPlays).toHaveLength(0);
    });
    test("Chubbs' Pep Talk removes a strike now, or waits and erases the next one", () => {
        expect(pick(start({ strikes: 2 }), 'chubbsPepTalk').gameState.strikes).toBe(1);
        const waiting = pick(start({ strikes: 0 }), 'chubbsPepTalk');
        expect(waiting.gameState.activePowerPlays.chubbsPepTalk).toBe(true);
        const hit = gameReducer(waiting, { type: 'ADD_STRIKE' });
        expect(hit.gameState.strikes).toBe(0);
        expect(hit.gameState.activePowerPlays.chubbsPepTalk).toBeUndefined();
        expect(gameReducer(hit, { type: 'ADD_STRIKE' }).gameState.strikes).toBe(1); // only once
    });
    test('Turn Back Time adds its seconds when it erases a strike, now or later', () => {
        const now = pick(start({ strikes: 1 }, 30), 'rewind');
        expect(now.gameState.strikes).toBe(0);
        expect(now.time).toBe(30 + TIME_BONUS.rescue);
        const waiting = pick(start({ strikes: 0 }, 30), 'rewind');
        expect(waiting.time).toBe(30);
        const hit = gameReducer(waiting, { type: 'ADD_STRIKE' });
        expect(hit.gameState.strikes).toBe(0);
        expect(hit.time).toBe(30 + TIME_BONUS.rescue);
    });
    test('none of them is in the Mystery Tape pool', async () => {
        const { MYSTERY_TAPE } = await import('../../../config/gameplay');
        for (const id of ['hadouken', 'chubbsPepTalk', 'rewind', 'neuralyzer']) expect(MYSTERY_TAPE.pool as readonly string[]).not.toContain(id);
    });
});
