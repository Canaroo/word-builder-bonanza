// @vitest-environment jsdom
// Charm slots, PowerPlay keep-or-swap, and the PowerPlays/charms added or moved in v6.8.
import { describe, test, expect, vi, afterEach } from 'vitest';
import { gameReducer, screenInitialState, maxStrikesFor, type GameScreenState } from '../GameScreen';
import { POWER_PLAYS_LIST, INSTANT_POWER_PLAY_IDS } from '../../../data/powerPlays';
import { CHARMS_LIST } from '../../../data/charms';
import { CHARM_SLOTS, GAMEPLAY, POWER_GLOVE_BANK_MAX, TIME_BONUS, POWER_PLAY_VALUES, CHARM_BONUS } from '../../../config/gameplay';
import { calculateScore } from '../../gameUtils';
import * as gameUtils from '../../gameUtils';
import { RACK_SIZE } from '../../../constants';
import type { GameState, Tile } from '../../../types';
import { catchVowels, handSizeFor, meterLettersFor, bossHitsToWin, advanceBoss } from '../../rules';

afterEach(() => vi.restoreAllMocks());

const pp = (id: string) => POWER_PLAYS_LIST.find(p => p.id === id)!;
const charm = (id: string) => CHARMS_LIST.find(c => c.id === id)!;

const start = (overrides: Partial<GameState> = {}, time = 40): GameScreenState => {
    const { hand, tileBag } = gameUtils.dealNewHand(gameUtils.createTileBag());
    const padded = Array(RACK_SIZE).fill(null);
    hand.forEach((t, i) => (padded[i] = t));
    return { ...screenInitialState, hand: padded, tileBag, time, isLoading: false, gameState: { ...screenInitialState.gameState, ...overrides } };
};
const tilesIn = (s: GameScreenState) => s.hand.filter(Boolean).length;

describe('reclassified items', () => {
    test('charms are always-on and PowerPlays are pressed', () => {
        const charmIds = new Set(CHARMS_LIST.map(c => c.id));
        for (const id of ['philsosophy', 'powerGlove', 'goldenSnitch', 'lTrainShuffle', 'diceRollProtocol', 'finalFrontier']) expect(charmIds).toContain(id);
        for (const id of ['deepFreeze', 'groundhogsDay', 'wildcardWake', 'oneTileToRuleThemAll', 'shapeshiftersTongue']) {
            expect(charmIds).not.toContain(id);
            expect(pp(id)).toBeTruthy();
        }
        expect(CHARMS_LIST.every(c => c.durationTag === 'PERSISTENT')).toBe(true);
        expect(POWER_PLAYS_LIST.every(p => p.durationTag !== 'PERSISTENT')).toBe(true);
    });

    test('no id is both a charm and a PowerPlay', () => {
        const ppIds = new Set(POWER_PLAYS_LIST.map(p => p.id));
        expect(CHARMS_LIST.filter(c => ppIds.has(c.id)).map(c => c.id)).toEqual([]);
    });
});

describe('charm slots', () => {
    const five = CHARMS_LIST.slice(0, CHARM_SLOTS);
    const extra = charm('powerPellet');

    test('a 6th charm needs a slot freed', () => {
        const s = start({ activeCharms: five });
        const blocked = gameReducer(s, { type: 'CHOOSE_CHARM', payload: { charm: extra, hand: s.hand, allOffered: [extra] } });
        expect(blocked).toBe(s);
        const swapped = gameReducer(s, { type: 'CHOOSE_CHARM', payload: { charm: extra, hand: s.hand, allOffered: [extra], replaceId: five[0].id } });
        expect(swapped.gameState.activeCharms.map(c => c.id)).toEqual([...five.slice(1).map(c => c.id), extra.id]);
        expect(swapped.gameState.activeBuffs.some(b => b.id === five[0].id)).toBe(false);
    });

    test('passing keeps your charms and puts the offer on cooldown', () => {
        const s = start({ activeCharms: five });
        const passed = gameReducer(s, { type: 'PASS_CHARM', payload: { allOffered: [extra] } });
        expect(passed.gameState.activeCharms).toEqual(five);
        expect(passed.gameState.charmCooldowns[extra.id]).toBe(3);
    });

    test('Power Glove raises the bank to 120s and adds 15s; dropping it lowers it again', () => {
        const s = start({}, 85);
        const gloved = gameReducer(s, { type: 'CHOOSE_CHARM', payload: { charm: charm('powerGlove'), hand: s.hand, allOffered: [] } });
        expect(gloved.time).toBe(100);
        expect(gameReducer(gloved, { type: 'ADD_TIME', payload: 50 }).time).toBe(POWER_GLOVE_BANK_MAX);
        const full = { ...gloved, gameState: { ...gloved.gameState, activeCharms: [...CHARMS_LIST.slice(2, 6), charm('powerGlove')] } };
        const dropped = gameReducer(full, { type: 'CHOOSE_CHARM', payload: { charm: charm('powerPellet'), hand: s.hand, allOffered: [], replaceId: 'powerGlove' } });
        expect(dropped.time).toBe(GAMEPLAY.timeBank.max);
    });
});

describe('Time pressure', () => {
    const shuffle = (s: GameScreenState, isFree = false) =>
        gameReducer(s, { type: 'PERFORM_SHUFFLE', payload: { hand: s.hand, tileBag: s.tileBag, isFree } });

    test('every shuffle (paid or free) adds 5s, up to the bank max, and only a paid one uses a shuffle', () => {
        const paid = shuffle(start({ shuffleCount: 3 }, 40));
        expect(paid.time).toBe(40 + GAMEPLAY.timeBank.shuffleTimeBonus);
        expect(paid.gameState.shuffleCount).toBe(2);
        const free = shuffle(start({ shuffleCount: 3 }, 40), true);
        expect(free.time).toBe(45);
        expect(free.gameState.shuffleCount).toBe(3);
        expect(shuffle(start({}, GAMEPLAY.timeBank.max - 2)).time).toBe(GAMEPLAY.timeBank.max);
    });

    test('a shuffle keeps your streaks going', () => {
        const s = shuffle(start({ consecutiveSuccesses: 4, consecutiveValidWords: 6, powerSurgeProgress: 3, perfectChainProgress: 2 }));
        expect(s.gameState).toMatchObject({ consecutiveSuccesses: 4, consecutiveValidWords: 6, powerSurgeProgress: 3, perfectChainProgress: 2 });
    });

    test('word time is halved when it lands on a bank above 60s', () => {
        const next = (time: number) => gameReducer(start({ pendingTimeBonus: 7 }, time), { type: 'START_NEXT_ROUND' });
        expect(next(50).time).toBe(57);
        const taxed = next(70);
        expect(taxed.time).toBe(73);
        expect(taxed.timeGain?.taxed).toBe(true);
    });
});

describe('PowerPlay keep-or-swap', () => {
    test('picking a new one swaps out the held one', () => {
        const s = start({ availablePowerPlays: [pp('biglyScore')] });
        const after = gameReducer(s, { type: 'CHOOSE_POWER_PLAY', payload: { powerPlay: pp('konamiCode'), allOffered: [pp('konamiCode')] } });
        expect(after.gameState.availablePowerPlays.map(p => p.id)).toEqual(['konamiCode']);
    });

    test('an instant one fires right away and swaps out what you hold', () => {
        const s = start({ availablePowerPlays: [pp('biglyScore')] });
        const after = gameReducer(s, { type: 'CHOOSE_POWER_PLAY', payload: { powerPlay: pp('wildcardWake'), allOffered: [pp('wildcardWake')] } });
        expect(after.gameState.availablePowerPlays).toEqual([]);
        expect(after.gameState.shuffleCount).toBe(s.gameState.shuffleCount + 2);
    });

    test('keeping clears the offer and keeps the held one', () => {
        const offered = [pp('konamiCode'), pp('warpZone')];
        const s = start({ availablePowerPlays: [pp('biglyScore')], powerPlayOffer: offered });
        const after = gameReducer(s, { type: 'KEEP_POWER_PLAY', payload: { allOffered: offered } });
        expect(after.gameState.availablePowerPlays.map(p => p.id)).toEqual(['biglyScore']);
        expect(after.gameState.powerPlayOffer).toEqual([]);
        expect(after.gameState.powerPlayCooldowns.konamiCode).toBe(3);
    });
});

describe('new PowerPlays', () => {
    const activate = (s: GameScreenState, id: string) => gameReducer(s, { type: 'ACTIVATE_POWER_PLAY', payload: pp(id) });

    test('Who You Gonna Call? clears strikes for 15s, never below 5s', () => {
        expect(activate(start({ strikes: 2 }, 40), 'whoYouGonnaCall')).toMatchObject({ time: 25, gameState: { strikes: 0 } });
        expect(activate(start({ strikes: 2 }, 12), 'whoYouGonnaCall').time).toBe(5);
    });

    test('Life Finds a Way survives the run-ending strike once', () => {
        const max = maxStrikesFor(screenInitialState.gameState);
        const armed = gameReducer(start({ strikes: max - 1 }, 30), { type: 'CHOOSE_POWER_PLAY', payload: { powerPlay: pp('lifeFindsAWay'), allOffered: [] } });
        const saved = gameReducer(armed, { type: 'ADD_STRIKE' });
        expect(saved.gameState.strikes).toBe(max - 1);
        expect(saved.time).toBe(50);
        expect(saved.gameState.activePowerPlays.lifeFindsAWay).toBeUndefined();
        expect(gameReducer(saved, { type: 'ADD_STRIKE' }).gameState.strikes).toBe(max);
    });

    test('Warp Zone sets up a Golden Round on the next word', () => {
        const s = start();
        expect(activate(s, 'warpZone').gameState.consecutiveValidWords).toBe(s.gameState.goldenRoundThreshold - 1);
    });

    test('Go-Go-Gadget Hands adds 2 tiles now', () => {
        const s = start();
        expect(tilesIn(activate(s, 'gadgetHands'))).toBe(tilesIn(s) + 2);
    });

    test('One Tile to Rule Them All makes one tile worth 30', () => {
        const after = activate(start(), 'oneTileToRuleThemAll');
        expect(after.hand.filter(t => t?.tempPoints === 30)).toHaveLength(1);
    });

    test('Letter Upgrade and Polish last 5 words at x3', () => {
        const s = start();
        const lu = pp('letterUpgrade').activate(s.gameState, { letter: 'E' });
        expect(lu.letterMultipliers).toEqual({ E: 3 });
        expect(lu.activePowerPlays).toMatchObject({ letterUpgrade: { words: 5, letter: 'E' } });
        const po = pp('polish').activate(s.gameState, { letter: 'S' });
        expect(po.wordMultipliersByLetter).toEqual({ S: 3 });
    });
});

describe('new PowerPlay scoring', () => {
    const tiles = (letters: string, points = 1): Tile[] => letters.split('').map((letter, i) => ({ id: `${letter}${i}`, letter, points }));
    const state = (activePowerPlays: Record<string, unknown>) => ({
        roundType: 'normal', activeCharms: [], activePowerPlays, letterMultipliers: {}, wordMultipliersByLetter: {}, powerStarResidualActive: false,
    }) as unknown as GameState;

    test('Konami Code x2, Ludicrous Speed x3, Combo Breaker x3 on 4+ letters', () => {
        expect(calculateScore('cat', tiles('CAT'), state({ konamiCode: { words: 3 } })).totalScore).toBe(6);
        expect(calculateScore('cat', tiles('CAT'), state({ ludicrousSpeed: { words: 3 } })).totalScore).toBe(9);
        // 6 letters: length x2 + Combo Breaker x3 = x5
        expect(calculateScore('carton', tiles('CARTON'), state({ comboBreaker: { words: 3 } })).totalScore).toBe(30);
        // 4 letters qualifies: length x1.25 + Combo Breaker x3 = x4.25
        const cart = calculateScore('cart', tiles('CART'), state({ comboBreaker: { words: 3 } }));
        expect(cart.bonuses.some(b => b.name === 'Combo Breaker')).toBe(true);
        expect(cart.totalScore).toBe(17); // 5 without it
        expect(calculateScore('cat', tiles('CAT'), state({ comboBreaker: { words: 3 } })).bonuses.some(b => b.name === 'Combo Breaker')).toBe(false); // 3 letters: zeroed later, in the turn
    });

    test('Big Head Mode doubles tiles; The Upside Down flips values', () => {
        expect(calculateScore('cat', tiles('CAT', 2), state({ bigHeadMode: { words: 2 } })).totalScore).toBe(12);
        const qi: Tile[] = [{ id: 'q', letter: 'Q', points: 10 }, { id: 'i', letter: 'I', points: 1 }];
        expect(calculateScore('qi', qi, state({ upsideDown: true })).totalScore).toBe(11);
    });
});

describe('resuming a saved game', () => {
    test('rebuilds held power-ups from current definitions and drops moved ones', async () => {
        const { rehydratePowerUps } = await import('../GameScreen');
        const saved = JSON.parse(JSON.stringify({
            ...screenInitialState.gameState,
            availablePowerPlays: [pp('biglyScore')],
            activeCharms: [charm('powerPellet'), { id: 'deepFreeze', name: 'Deep Freeze' }],
            activeBuffs: [{ ...pp('letterUpgrade'), instanceId: 'x', description: "'E' tiles are worth 3x" }],
        }));
        const gs = rehydratePowerUps(saved);
        expect(typeof gs.availablePowerPlays[0].activate).toBe('function');
        expect(gs.activeCharms.map(c => c.id)).toEqual(['powerPellet']);
        expect(gs.activeBuffs[0].description).toBe("'E' tiles are worth 3x");
        expect(typeof gs.activeBuffs[0].activate).toBe('function');
    });
});

describe('Captain Planet', () => {
    const activate = () => {
        const s = start({ availablePowerPlays: [pp('captainPlanet')] });
        const idx = s.hand.findIndex(Boolean);
        const tile = s.hand[idx]!;
        const after = gameReducer({ ...s, tileForSelection: { tile, originalIndex: idx } }, { type: 'COMPLETE_POWER_PLAY_ACTIVATION', payload: { powerPlay: pp('captainPlanet') } });
        return { after, idx, tile };
    };

    test('the picked tile is worth 20, it is logged, and the PowerPlay is used up', () => {
        const { after, idx, tile } = activate();
        expect(after.hand[idx]).toMatchObject({ letter: tile.letter, tempPoints: 20, tempPointsSource: 'Captain Planet' });
        expect(after.gameState.availablePowerPlays).toHaveLength(0);
        expect(after.gameState.log.at(-1)).toMatchObject({ type: 'event', name: 'Captain Planet' });
        expect(after.gameState.lastPowerPlayResult?.message).toContain('20 points');
    });

    test('the 20 points last one turn: they clear after the next word', () => {
        const { after, idx } = activate();
        const next = gameReducer(after, { type: 'START_NEXT_ROUND' });
        expect(next.hand[idx]?.tempPoints).toBeUndefined();
        expect(next.hand[idx]?.tempPointsSource).toBeUndefined();
    });

    test('the score breakdown shows the boosted tile', () => {
        const { after, idx } = activate();
        const result = calculateScore(after.hand[idx]!.letter.repeat(3), [after.hand[idx]!, ...after.hand.filter((t, i) => t && i !== idx).slice(0, 2) as Tile[]], after.gameState);
        expect(result.bonuses.some(b => b.name.startsWith('Captain Planet'))).toBe(true);
    });
});

describe('tile point boosts are labeled in the score breakdown', () => {
    test('One Tile to Rule Them All marks its tile', () => {
        const s = start();
        const after = gameReducer(s, { type: 'ACTIVATE_POWER_PLAY', payload: pp('oneTileToRuleThemAll') });
        const boosted = after.hand.filter(t => t?.tempPoints === 30);
        expect(boosted).toHaveLength(1);
        expect(boosted[0]?.tempPointsSource).toBe('One Tile to Rule Them All');
    });

    test.each([
        ['One Tile to Rule Them All', 30],
        ['Rescue Drop', 20],
        ['Treehouse of Horror', 7],
    ])('%s shows "1 → N pts"', (source, points) => {
        const tile = { id: 'e', letter: 'E', points: 1, tempPoints: points, tempPointsSource: source } as Tile;
        const others = [{ id: 'a', letter: 'A', points: 1 }, { id: 't', letter: 'T', points: 1 }] as Tile[];
        const result = calculateScore('eat', [tile, ...others], start().gameState);
        expect(result.bonuses).toContainEqual(expect.objectContaining({ name: `${source} (E)`, description: `1 → ${points} pts` }));
    });
});

describe('Time PowerPlays follow the bonus-time rules', () => {
    test('Time Turner adds +10s per round (not 30), halved above 60s', () => {
        const low = gameReducer(start({ activePowerPlays: { timeTurner: { rounds: 2 } } }, 30), { type: 'START_NEXT_ROUND' });
        expect(low.time).toBe(40);
        const high = gameReducer(start({ activePowerPlays: { timeTurner: { rounds: 2 } } }, 70), { type: 'START_NEXT_ROUND' });
        expect(high.time).toBe(75);
    });

    test('Time Boost adds 10s', () => {
        const s = start({}, 30);
        expect(gameReducer(s, { type: 'ACTIVATE_POWER_PLAY', payload: pp('timeBoost') }).time).toBe(40);
    });
});

describe('Perfectly Balanced charm', () => {
    const withCharm = () => ({ ...start().gameState, activeCharms: [charm('perfectlyBalanced')] });
    const tilesFor = (w: string) => w.split('').map((letter, i) => ({ id: `t${i}`, letter, points: 1 })) as Tile[];
    test.each([['team', true], ['road', true], ['tree', true], ['banana', true], ['idea', false], ['cat', false], ['strength', false]])('%s balanced: %s', (word, balanced) => {
        const result = calculateScore(word, tilesFor(word.toUpperCase()), withCharm());
        expect(result.bonuses.some(b => b.name === 'Perfectly Balanced')).toBe(balanced);
    });
});

describe('v6.13 additions', () => {
    const tilesFor = (w: string, points = 1) => w.split('').map((letter, i) => ({ id: `t${i}`, letter, points })) as Tile[];
    const gs = (over: Partial<GameState> = {}) => ({ ...start().gameState, ...over });
    const has = (r: { bonuses: { name: string }[] }, name: string) => r.bonuses.some(b => b.name.startsWith(name));

    test('Hold Onto Your Butts: rare letters score x3 on the next word', () => {
        const plain = calculateScore('zax', tilesFor('ZAX', 10), gs());
        const butts = calculateScore('zax', tilesFor('ZAX', 10), gs({ activePowerPlays: { holdOntoYourButts: true } }));
        expect(has(butts, 'Hold Onto Your Butts (Z)')).toBe(true);
        expect(has(butts, 'Hold Onto Your Butts (A)')).toBe(false);
        expect(butts.totalScore).toBeGreaterThan(plain.totalScore);
    });

    test("Rubik's Cube: 6+ letters with no repeats", () => {
        const charms = { activeCharms: [charm('rubiksCube')] };
        expect(has(calculateScore('planet', tilesFor('PLANET'), gs(charms)), "Rubik's Cube")).toBe(true);
        expect(calculateScore('planet', tilesFor('PLANET'), gs(charms)).totalScore - calculateScore('planet', tilesFor('PLANET'), gs({})).totalScore).toBe(150);
        expect(has(calculateScore('banana', tilesFor('BANANA'), gs(charms)), "Rubik's Cube")).toBe(false);
        expect(has(calculateScore('plane', tilesFor('PLANE'), gs(charms)), "Rubik's Cube")).toBe(false);
    });

    test('Sick Combo: longer than your last valid word', () => {
        const log = [{ type: 'word', word: 'CAT', status: 'valid', score: 5 } as any];
        const charms = { activeCharms: [charm('sickCombo')], log };
        expect(has(calculateScore('tree', tilesFor('TREE'), gs(charms)), 'Sick Combo')).toBe(true);
        expect(has(calculateScore('dog', tilesFor('DOG'), gs(charms)), 'Sick Combo')).toBe(false);
    });

    test('Mixtape: pays 40, 60, 80... up to 120 for chained words', () => {
        const at = (links: number, word: string) => calculateScore(word.toLowerCase(), tilesFor(word), gs({ activeCharms: [charm('mixtape')], mixtapeChain: { next: 'T', links } }));
        expect(at(0, 'TOP').bonuses.find(b => b.name.startsWith('Mixtape'))?.description).toBe('+40 pts');
        expect(at(2, 'TOP').bonuses.find(b => b.name.startsWith('Mixtape'))?.description).toBe('+80 pts');
        expect(at(9, 'TOP').bonuses.find(b => b.name.startsWith('Mixtape'))?.description).toBe('+120 pts');
        expect(has(at(3, 'CAT'), 'Mixtape')).toBe(false);
    });

    test('Mixtape chain resets on a strike', () => {
        const s = start({ mixtapeChain: { next: 'T', links: 3 } });
        expect(gameReducer(s, { type: 'ADD_STRIKE' }).gameState.mixtapeChain).toBeNull();
    });

    test('Buy a Vowel: costs 100 and adds the vowel; too poor keeps it in the pocket', () => {
        const rich = start({ score: 150, availablePowerPlays: [pp('buyAVowel')] });
        const handWithGap = [...rich.hand]; handWithGap[7] = null;
        const bought = gameReducer({ ...rich, hand: handWithGap }, { type: 'COMPLETE_POWER_PLAY_ACTIVATION', payload: { powerPlay: pp('buyAVowel'), option: { letter: 'E' } } });
        expect(bought.gameState.score).toBe(50);
        expect(bought.hand[7]?.letter).toBe('E');
        expect(bought.gameState.availablePowerPlays).toEqual([]);

        const poor = start({ score: 60, availablePowerPlays: [pp('buyAVowel')] });
        const tried = gameReducer(poor, { type: 'ACTIVATE_POWER_PLAY', payload: pp('buyAVowel') });
        expect(tried.gameState.availablePowerPlays.map(p => p.id)).toEqual(['buyAVowel']);
        expect(tried.gameState.lastPowerPlayResult?.message).toContain('100 points');
    });

    test('Shake It Like a Polaroid keeps the vowels and redraws the rest', () => {
        const s = start({ availablePowerPlays: [pp('shakeItLikeAPolaroid')] });
        const letters = 'AEBCDFGH';
        const hand = s.hand.map((t, i) => (t && i < 8 ? { ...t, letter: letters[i] } : t));
        const after = gameReducer({ ...s, hand }, { type: 'ACTIVATE_POWER_PLAY', payload: pp('shakeItLikeAPolaroid') });
        const tiles = after.hand.filter(Boolean);
        expect(tiles).toHaveLength(8);
        expect(tiles.slice(0, 2).map(t => t!.letter)).toEqual(['A', 'E']);
        expect(after.time).toBe(s.time);
        expect(after.gameState.availablePowerPlays).toEqual([]);
    });
});

describe('v7.8 additions', () => {
    const tilesFor = (w: string, points = 1) => w.split('').map((letter, i) => ({ id: `t${i}`, letter, points })) as Tile[];
    const gs = (over: Partial<GameState> = {}) => ({ ...start().gameState, ...over });
    const has = (r: { bonuses: { name: string }[] }, name: string) => r.bonuses.some(b => b.name.startsWith(name));
    const played = (...words: string[]) => words.map(word => ({ type: 'word', word, status: 'valid', score: 5 } as any));

    test('descriptions read their numbers from config', () => {
        expect(pp('continueScreen').description).toContain(`${TIME_BONUS.continueScreen} seconds`);
        expect(pp('actClear').description).toContain(`+${POWER_PLAY_VALUES.actClearMaxSeconds * POWER_PLAY_VALUES.actClearPointsPerSecond}`);
        expect(charm('sandsOfTime').description).toContain(`${TIME_BONUS.sandsOfTimeLetters}+ letters add +${TIME_BONUS.sandsOfTime} seconds`);
        expect(charm('finishHim').description).toContain(`${CHARM_BONUS.finishHimBelow} seconds or less`);
        expect(charm('gottaCatchEmAll').description).toContain(`+${CHARM_BONUS.gottaCatchEmAll} points`);
    });

    test('Continue? is a once-per-run rescue that arms when picked; Act Clear! is pressed', () => {
        expect(pp('continueScreen').oncePerRun).toBe(true);
        expect(INSTANT_POWER_PLAY_IDS.has('continueScreen')).toBe(true);
        expect(INSTANT_POWER_PLAY_IDS.has('actClear')).toBe(false);
        const armed = gameReducer(start(), { type: 'CHOOSE_POWER_PLAY', payload: { powerPlay: pp('continueScreen'), allOffered: [pp('continueScreen')] } });
        expect(armed.gameState.activePowerPlays.continueScreen).toBe(true);
    });

    test('Act Clear!: 20 points a second, up to 20 seconds, always leaving 10', () => {
        const full = gameReducer(start({ score: 100, availablePowerPlays: [pp('actClear')] }, 40), { type: 'ACTIVATE_POWER_PLAY', payload: pp('actClear') });
        expect(full.time).toBe(20);
        expect(full.gameState.score).toBe(500);
        expect(full.gameState.availablePowerPlays).toEqual([]);

        const partial = gameReducer(start({ score: 0, availablePowerPlays: [pp('actClear')] }, 25), { type: 'ACTIVATE_POWER_PLAY', payload: pp('actClear') });
        expect(partial.time).toBe(10);
        expect(partial.gameState.score).toBe(300);

        const low = gameReducer(start({ score: 0, availablePowerPlays: [pp('actClear')] }, 10), { type: 'ACTIVATE_POWER_PLAY', payload: pp('actClear') });
        expect(low.time).toBe(10);
        expect(low.gameState.score).toBe(0);
        expect(low.gameState.availablePowerPlays.map(p => p.id)).toEqual(['actClear']);
        expect(low.gameState.lastPowerPlayResult?.message).toContain('still in your pocket');
    });

    test("Gotta Catch 'Em All: vowels add up across words, and equipping starts a fresh Pokédex", () => {
        expect(catchVowels('', 'CAT')).toBe('A');
        expect(catchVowels('A', 'pie')).toBe('AEI');
        expect(catchVowels('AEI', 'SOUP')).toBe('AEIOU');
        expect(catchVowels('AE', 'RHYTHM')).toBe('AE');
        const s = start({ pokedexVowels: 'AEI' });
        const equipped = gameReducer(s, { type: 'CHOOSE_CHARM', payload: { charm: charm('gottaCatchEmAll'), hand: s.hand, allOffered: [charm('gottaCatchEmAll')] } });
        expect(equipped.gameState.pokedexVowels).toBe('');
    });

    test('The Opposite: no letters shared with your last valid word', () => {
        const charms = { activeCharms: [charm('theOpposite')], log: played('CAT') };
        expect(has(calculateScore('mind', tilesFor('MIND'), gs(charms)), 'The Opposite')).toBe(true);
        expect(has(calculateScore('ten', tilesFor('TEN'), gs(charms)), 'The Opposite')).toBe(false);
        expect(has(calculateScore('mind', tilesFor('MIND'), gs({ activeCharms: [charm('theOpposite')] })), 'The Opposite')).toBe(false); // first word
    });

    test('Eagle!: +40 on the word right after a 5+ letter word', () => {
        const after = (last: string) => calculateScore('dog', tilesFor('DOG'), gs({ activeCharms: [charm('eagle')], log: played('CAT', last) }));
        expect(after('PLANT').totalScore - after('CAT').totalScore).toBe(CHARM_BONUS.eagle);
        expect(has(after('PLANT'), 'Eagle!')).toBe(true);
        expect(has(after('TREE'), 'Eagle!')).toBe(false);
    });

    test('We Were on a Break!: a shuffle arms x2 for the next word, only with the charm', () => {
        const shuffle = (s: GameScreenState) => gameReducer(s, { type: 'PERFORM_SHUFFLE', payload: { hand: s.hand, tileBag: s.tileBag, isFree: false } } as any);
        expect(shuffle(start({ activeCharms: [charm('weWereOnABreak')] })).gameState.breakReady).toBe(true);
        expect(shuffle(start()).gameState.breakReady).toBeFalsy();
        const ready = gs({ activeCharms: [charm('weWereOnABreak')], breakReady: true });
        expect(calculateScore('cat', tilesFor('CAT'), ready).totalScore).toBe(6);
        expect(calculateScore('cat', tilesFor('CAT'), { ...ready, breakReady: false }).totalScore).toBe(3);
    });

    test('Survivor: a real strike arms 2 bonus words; a blocked strike does not', () => {
        const s = start({ activeCharms: [charm('survivor')] });
        expect(gameReducer(s, { type: 'ADD_STRIKE' }).gameState.survivorWords).toBe(CHARM_BONUS.survivorWords);
        const shielded = start({ activeCharms: [charm('survivor')], activePowerPlays: { strikeShield: true } });
        expect(gameReducer(shielded, { type: 'ADD_STRIKE' }).gameState.survivorWords).toBeFalsy();
        expect(gameReducer(start(), { type: 'ADD_STRIKE' }).gameState.survivorWords).toBeFalsy();
    });

    test("I'm Ready!: equipping right before a new level still pays that level's first word", () => {
        const equip = (words: number) => {
            const s = start({ log: played(...Array(words).fill('CAT')) });
            return gameReducer(s, { type: 'CHOOSE_CHARM', payload: { charm: charm('imReady'), hand: s.hand, allOffered: [charm('imReady')] } }).gameState.readyLevel;
        };
        expect(equip(5)).toBe(1);   // pays on level 2's first word
        expect(equip(18)).toBe(1);  // the next word starts level 2, and still pays
        expect(equip(20)).toBe(2);  // mid level 2: waits for level 3
    });

    test('Backpack, Backpack!: +60 for each PowerPlay used, not for swaps or failed uses', () => {
        const withPack = { activeCharms: [charm('backpack')] };
        const used = gameReducer(start({ ...withPack, score: 0, availablePowerPlays: [pp('actClear')] }, 40), { type: 'ACTIVATE_POWER_PLAY', payload: pp('actClear') });
        expect(used.gameState.score).toBe(400 + CHARM_BONUS.backpack);
        expect(used.gameState.log.some(e => e.type === 'event' && e.name === 'Backpack, Backpack!')).toBe(true);

        const noPack = gameReducer(start({ score: 0, availablePowerPlays: [pp('actClear')] }, 40), { type: 'ACTIVATE_POWER_PLAY', payload: pp('actClear') });
        expect(noPack.gameState.score).toBe(400);

        const instant = gameReducer(start({ ...withPack, score: 0 }), { type: 'CHOOSE_POWER_PLAY', payload: { powerPlay: pp('fluncleIsProud'), allOffered: [pp('fluncleIsProud')] } });
        expect(instant.gameState.score).toBe(300 + CHARM_BONUS.backpack);

        const swap = gameReducer(start({ ...withPack, score: 0, availablePowerPlays: [pp('timeBoost')] }), { type: 'CHOOSE_POWER_PLAY', payload: { powerPlay: pp('konamiCode'), allOffered: [pp('konamiCode')] } });
        expect(swap.gameState.score).toBe(0);

        const failed = gameReducer(start({ ...withPack, score: 0, availablePowerPlays: [pp('actClear')] }, 8), { type: 'ACTIVATE_POWER_PLAY', payload: pp('actClear') });
        expect(failed.gameState.score).toBe(0);
    });
});

describe('PowerPlays used mid-round', () => {
    test("One Tile's boost survives its pop-up: only a played word waits for the next round", () => {
        const s = start({ availablePowerPlays: [pp('oneTileToRuleThemAll')] });
        const used = gameReducer(s, { type: 'ACTIVATE_POWER_PLAY', payload: pp('oneTileToRuleThemAll') });
        expect(used.hand.filter(t => t?.tempPoints === 30)).toHaveLength(1);
        expect(used.awaitingNextRound).toBeFalsy();
        const played = gameReducer(used, { type: 'HANDLE_SUBMIT_SUCCESS', payload: { gameState: used.gameState, hand: used.hand, tileBag: used.tileBag, modalQueue: [] } } as any);
        expect(played.awaitingNextRound).toBe(true);
        expect(gameReducer(played, { type: 'START_NEXT_ROUND' }).awaitingNextRound).toBe(false);
    });

    test('every PowerPlay use is in the event log, once', () => {
        const s = start({ availablePowerPlays: [pp('oneTileToRuleThemAll')] });
        const used = gameReducer(s, { type: 'ACTIVATE_POWER_PLAY', payload: pp('oneTileToRuleThemAll') });
        expect(used.gameState.log.filter(e => e.type === 'event' && e.name === 'One Tile to Rule Them All')).toHaveLength(1);
        // Fluncle logs its own result, so it isn't logged twice.
        const fluncle = gameReducer(start(), { type: 'CHOOSE_POWER_PLAY', payload: { powerPlay: pp('fluncleIsProud'), allOffered: [pp('fluncleIsProud')] } });
        expect(fluncle.gameState.log.filter(e => e.type === 'event' && e.name === 'Fluncle is Proud')).toHaveLength(1);
        // A swap is not a use.
        const swap = gameReducer(start({ availablePowerPlays: [pp('timeBoost')] }), { type: 'CHOOSE_POWER_PLAY', payload: { powerPlay: pp('konamiCode'), allOffered: [pp('konamiCode')] } });
        expect(swap.gameState.log.some(e => e.type === 'event' && e.name === 'Time Boost')).toBe(false);
    });
});

describe('v7.16 charms', () => {
    const tilesFor = (w: string, points = 1) => w.split('').map((letter, i) => ({ id: `t${i}`, letter, points })) as Tile[];
    const gs = (over: Partial<GameState> = {}) => ({ ...start().gameState, ...over });
    const has = (r: { bonuses: { name: string }[] }, name: string) => r.bonuses.some(b => b.name.startsWith(name));
    const score = (id: string, word: string, tiles = tilesFor(word), over: Partial<GameState> = {}) => calculateScore(word.toLowerCase(), tiles, gs({ activeCharms: [charm(id)], ...over }));

    test('A-Team: words starting with A', () => {
        expect(has(score('aTeam', 'ATOM'), 'A-Team')).toBe(true);
        expect(has(score('aTeam', 'TOMB'), 'A-Team')).toBe(false);
    });

    test('Conjunction Junction: letters in alphabetical order', () => {
        for (const w of ['BEST', 'CHIPS', 'FLOW', 'ALMOST']) expect(has(score('conjunctionJunction', w), 'Conjunction Junction')).toBe(true);
        expect(has(score('conjunctionJunction', 'TRAIN'), 'Conjunction Junction')).toBe(false);
    });

    test('Vote for Pedro: only 1-point tiles', () => {
        expect(has(score('voteForPedro', 'TRAIN'), 'Vote for Pedro')).toBe(true);
        const withP = [{ id: 'p', letter: 'P', points: 3 }, ...tilesFor('INT')] as Tile[];
        expect(has(score('voteForPedro', 'PINT', withP), 'Vote for Pedro')).toBe(false);
    });

    test('Form Voltron: a combo tile in the word', () => {
        const quiz = [{ id: 'qu', letter: 'QU', points: 11, isCombo: true }, ...tilesFor('IZ')] as Tile[];
        expect(has(score('formVoltron', 'QUIZ', quiz), 'Form Voltron')).toBe(true);
        expect(has(score('formVoltron', 'QUIZ'), 'Form Voltron')).toBe(false);
    });

    test('Titans, Go!: +4 per equipped charm, up to the 5 slots', () => {
        const titans = (n: number) => calculateScore('cat', tilesFor('CAT'), gs({ activeCharms: [charm('titansGo'), ...CHARMS_LIST.filter(c => c.id === 'theValve' || c.id === 'oneRing').slice(0, n - 1)] })).bonuses.find(b => b.name === 'Titans, Go!')?.description;
        expect(titans(1)).toBe(`+${CHARM_BONUS.titansPerCharm} pts`);
        expect(titans(3)).toBe(`+${CHARM_BONUS.titansPerCharm * 3} pts`);
    });

    test("I'm Always Here: an invalid word is still a strike but costs no time", () => {
        const withCharm = gameReducer(start({ activeCharms: [charm('imAlwaysHere')] }, 30), { type: 'ADD_STRIKE', payload: { source: 'invalid_word' } } as any);
        expect(withCharm.gameState.strikes).toBe(1);
        expect(withCharm.time).toBe(30);
        const without = gameReducer(start({}, 30), { type: 'ADD_STRIKE', payload: { source: 'invalid_word' } } as any);
        expect(without.time).toBe(30 - GAMEPLAY.timeBank.invalidPenalty);
    });

    test('Cross the Road: a strike breaks the streak; equipping starts fresh', () => {
        expect(gameReducer(start({ frogStreak: 2 }), { type: 'ADD_STRIKE' }).gameState.frogStreak).toBe(0);
        const s = start({ frogStreak: 2 });
        expect(gameReducer(s, { type: 'CHOOSE_CHARM', payload: { charm: charm('crossTheRoad'), hand: s.hand, allOffered: [charm('crossTheRoad')] } }).gameState.frogStreak).toBe(0);
    });
});

describe('v7.17 balance pass', () => {
    const tilesFor = (w: string, points = 1) => w.split('').map((letter, i) => ({ id: `t${i}`, letter, points })) as Tile[];
    const gs = (over: Partial<GameState> = {}) => ({ ...start().gameState, ...over });
    const bonus = (id: string, word: string, name: string, over: Partial<GameState> = {}) =>
        calculateScore(word.toLowerCase(), tilesFor(word), gs({ activeCharms: [charm(id)], ...over })).bonuses.find(b => b.name.startsWith(name))?.description;

    test('Conjunction Junction, Vote for Pedro and LUNA skip 3-letter words', () => {
        expect(bonus('conjunctionJunction', 'ACE', 'Conjunction')).toBeUndefined();
        expect(bonus('conjunctionJunction', 'BEST', 'Conjunction')).toBe(`+${CHARM_BONUS.conjunctionJunction} pts`);
        expect(bonus('voteForPedro', 'TEA', 'Vote for Pedro')).toBeUndefined();
        expect(bonus('voteForPedro', 'TRAIN', 'Vote for Pedro')).toBe(`+${CHARM_BONUS.voteForPedro} pts`);
        expect(bonus('luna', 'AGE', 'LUNA')).toBeUndefined();
        expect(bonus('luna', 'AREA', 'LUNA')).toBe(`+${CHARM_BONUS.luna} pts`);
    });

    test('loosened rare charms pay flat points', () => {
        expect(bonus('sacredHeart', 'DOG', 'Sacred Heart')).toBe(`+${CHARM_BONUS.sacredHeart} pts`);
        expect(bonus('sacredHeart', 'CAT', 'Sacred Heart')).toBeUndefined();
        expect(bonus('trueLove', 'LAMP', 'True Love')).toBe(`+${CHARM_BONUS.trueLove} pts`);
        expect(bonus('trueLove', 'LOVE', 'True Love')).toBe(`+${CHARM_BONUS.trueLoveBoth} pts`);
        expect(bonus('trueLove', 'CAT', 'True Love')).toBeUndefined();
        expect(bonus('starPower', 'STOP', 'Star Power')).toBe(`+${CHARM_BONUS.starPower} pts`);
        expect(bonus('starPower', 'SOAP', 'Star Power')).toBeUndefined();
        expect(bonus('silentKiller', 'GYM', 'Silent Killer')).toBe(`+${CHARM_BONUS.silentKiller} pts`);
        expect(bonus('silentKiller', 'GEM', 'Silent Killer')).toBeUndefined();
        expect(bonus('italianRestaurantEnding', 'ITALIAN', 'Italian')).toBe(`+${CHARM_BONUS.italianRestaurant} pts`);
        expect(bonus('cleverGirl', 'TRAP', 'Clever Girl')).toBe(`+${CHARM_BONUS.cleverGirl} pts`);
        expect(bonus('cleverGirl', 'TOT', 'Clever Girl')).toBeUndefined();
        expect(bonus('radioactiveSpiderBite', 'RED', 'Radioactive')).toBe(`+${CHARM_BONUS.radioactiveAll} pts`);
        expect(bonus('radioactiveSpiderBite', 'DOE', 'Radioactive')).toBe(`+${CHARM_BONUS.radioactive} pts`);
        expect(bonus('radioactiveSpiderBite', 'DOG', 'Radioactive')).toBeUndefined();
        expect(bonus('inigosRevenge', 'IRIS', 'Inigo')).toBe(`+${CHARM_BONUS.inigosRevenge} pts`);
    });

    test('Finisher adds points to the last tile', () => {
        const withIt = calculateScore('cat', tilesFor('CAT'), gs({ activeCharms: [charm('finisher')] }));
        const without = calculateScore('cat', tilesFor('CAT'), gs());
        expect(withIt.totalScore - without.totalScore).toBe(CHARM_BONUS.finisher);
    });

    test('Nuclear Option is x3 now; Rewind and Deep Freeze are once per run', () => {
        expect(calculateScore('cat', tilesFor('CAT'), gs({ activePowerPlays: { nuclearOption: true } } as any)).totalScore).toBe(3 * POWER_PLAY_VALUES.nuclearOptionMultiplier);
        expect(pp('rewind').oncePerRun).toBe(true);
        expect(pp('deepFreeze').oncePerRun).toBe(true);
        expect(pp('swapOut').swapConfig).toEqual({ min: 4, max: 5 });
    });
});

describe('v7.18 charms', () => {
    const tilesFor = (w: string, points = 1) => w.split('').map((letter, i) => ({ id: `t${i}`, letter, points })) as Tile[];
    const gs = (over: Partial<GameState> = {}) => ({ ...start().gameState, ...over });
    const bonus = (id: string, word: string, name: string, over: Partial<GameState> = {}) =>
        calculateScore(word.toLowerCase(), tilesFor(word), gs({ activeCharms: [charm(id)], ...over })).bonuses.find(b => b.name.startsWith(name))?.description;

    test('Honey, I Shrunk the Kids: one fewer tile, +points every word', () => {
        expect(handSizeFor({ activeCharms: [charm('honeyIShrunkTheKids')] })).toBe(GAMEPLAY.handSize - 1);
        expect(handSizeFor({})).toBe(GAMEPLAY.handSize);
        expect(bonus('honeyIShrunkTheKids', 'CAT', 'Honey')).toBe(`+${CHARM_BONUS.honeyShrunk} pts`);
    });

    test('Mr. Glass: +points every word, one fewer strike', () => {
        expect(bonus('mrGlass', 'CAT', 'Mr. Glass')).toBe(`+${CHARM_BONUS.mrGlass} pts`);
        expect(maxStrikesFor({ charmUses: {}, activeCharms: [charm('mrGlass')] } as any)).toBe(2);
        expect(maxStrikesFor({ charmUses: { strikeBank: 1 }, activeCharms: [charm('mrGlass')] } as any)).toBe(3);
    });

    test('Turbo Button and Little Mac change the meter and the boss target', () => {
        expect(meterLettersFor(1, { activeCharms: [charm('turboButton')] })).toBe(Math.round(GAMEPLAY.powerPlayMeterLetters * 0.8));
        expect(bossHitsToWin({ activeCharms: [charm('littleMac')] })).toBe(5);
        expect(bossHitsToWin({ activeCharms: [] })).toBe(6);
        expect(advanceBoss({ id: 'x', number: 1, wordsLeft: 4, hits: 4 } as any, true, 5).outcome).toBe('won');
        expect(advanceBoss({ id: 'x', number: 1, wordsLeft: 4, hits: 4 } as any, true).outcome).toBe(null);
    });

    test('Sesame Street pays for the letter of the day only', () => {
        const sesameLetter = { letter: 'T', level: 1 };
        expect(bonus('sesameStreet', 'CAT', 'Sesame Street', { sesameLetter })).toBe(`+${CHARM_BONUS.sesameStreet} pts`);
        expect(bonus('sesameStreet', 'DOG', 'Sesame Street', { sesameLetter })).toBeUndefined();
        const equipped = gameReducer(start(), { type: 'CHOOSE_CHARM', payload: { charm: charm('sesameStreet'), hand: start().hand, allOffered: [charm('sesameStreet')] } } as any);
        expect(CHARM_BONUS.sesameLetters).toContain(equipped.gameState.sesameLetter!.letter);
    });

    test('Happy Little Accidents: the first invalid word each level costs time, not a strike', () => {
        const s0 = start({ activeCharms: [charm('happyLittleAccidents')] }, 30);
        const first = gameReducer(s0, { type: 'ADD_STRIKE', payload: { source: 'invalid_word' } } as any);
        expect(first.gameState.strikes).toBe(0);
        expect(first.time).toBe(30 - CHARM_BONUS.happyAccidentSeconds);
        const second = gameReducer(first, { type: 'ADD_STRIKE', payload: { source: 'invalid_word' } } as any);
        expect(second.gameState.strikes).toBe(1);
    });

    test('Wile E. Coyote: a strike pays points and time, unless it ends the run', () => {
        const s0 = start({ activeCharms: [charm('wileECoyote')], score: 100 }, 30);
        const hit = gameReducer(s0, { type: 'ADD_STRIKE', payload: { source: 'challenge' } } as any);
        expect(hit.gameState.strikes).toBe(1);
        expect(hit.gameState.score).toBe(100 + CHARM_BONUS.wileECoyote);
        expect(hit.time).toBe(30 + TIME_BONUS.wileECoyote);
        const last = gameReducer(start({ activeCharms: [charm('wileECoyote')], score: 100, strikes: 2 }, 30), { type: 'ADD_STRIKE', payload: { source: 'challenge' } } as any);
        expect(last.gameState.score).toBe(100);
    });

    test('Double Dare pays through a logged charm payout', () => {
        const paid = gameReducer(start({ score: 10 }), { type: 'CHARM_PAYOUT', payload: { id: 'doubleDare', points: CHARM_BONUS.doubleDare, description: 'x' } } as any);
        expect(paid.gameState.score).toBe(10 + CHARM_BONUS.doubleDare);
        expect(paid.gameState.log.at(-1)).toMatchObject({ type: 'event', name: 'Double Dare', scoreChange: CHARM_BONUS.doubleDare });
    });
});
