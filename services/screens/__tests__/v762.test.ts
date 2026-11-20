import { describe, test, expect } from 'vitest';
import { calculateScore, createTile } from '../../gameUtils';
import { gameReducer, screenInitialState, type GameScreenState } from '../GameScreen';
import { CHARMS_LIST } from '../../../data/charms';
import { POWER_PLAYS_LIST } from '../../../data/powerPlays';
import { CHARM_BONUS, GEM_TILES, POWER_PLAY_VALUES, SHINE_BRIGHT_GEMS, SCRATCH } from '../../../config/gameplay';
import { anagramKey, nextSpeedStreak, speedStreakPoints, freakyFridayMatch, gemMultiplierFor, jengaPot, prizeFor, stonksPoints } from '../../rules';
import { hiddenWordsIn } from '../../wordIndex';
import type { GameState, Tile } from '../../../types';

const start = (overrides: Partial<GameState> = {}): GameScreenState =>
    ({ ...screenInitialState, time: 40, isLoading: false, gameState: { ...screenInitialState.gameState, ...overrides } });
const charm = (id: string) => CHARMS_LIST.find(c => c.id === id)!;
const plain = (word: string): Tile[] => word.split('').map(l => ({ ...createTile(l), multiplier: undefined, isSuper: false }));
const played = (words: string[]) => words.map(w => ({ type: 'word', word: w, status: 'valid', score: 5, baseScore: 5, bonuses: [], definition: '', cumulativeScore: 5 })) as GameState['log'];
const gs = (o: Partial<GameState>) => ({ ...start().gameState!, ...o }) as GameState;

describe('v7.62.0 charms', () => {
    test('all five exist with descriptions that read their numbers from config', () => {
        for (const id of ['stonks', 'shineBright', 'needForSpeed', 'keymaster', 'freakyFriday']) expect(charm(id)).toBeTruthy();
        expect(charm('stonks').description).toContain(`+${CHARM_BONUS.stonksPerLevel * 10} at level 10`);
        expect(charm('needForSpeed').description).toContain(`up to +${CHARM_BONUS.speedMax} a word`);
    });

    test('Stonks pays per level on 4+ letter words, nothing on 3-letter words', () => {
        expect(stonksPoints(4, 10)).toBe(CHARM_BONUS.stonksPerLevel * 10);
        expect(stonksPoints(3, 10)).toBe(0);
        const state = gs({ activeCharms: [charm('stonks')], log: played(Array(90).fill('CAT')) }); // 90 words: level 6
        const r = calculateScore('TERN', plain('TERN'), state);
        expect(r.bonuses.find(b => b.name === 'Stonks')?.description).toBe(`+${CHARM_BONUS.stonksPerLevel * 6} pts (level 6)`);
        expect(calculateScore('TEN', plain('TEN'), state).bonuses.some(b => b.name === 'Stonks')).toBe(false);
    });

    test('Freaky Friday: an anagram of an earlier word scores x3; the same word or a short one does not', () => {
        expect(freakyFridayMatch('RATS', ['STAR'])).toBe('STAR');
        expect(freakyFridayMatch('STAR', ['STAR'])).toBeNull();
        expect(freakyFridayMatch('EAT', ['TEA'])).toBeNull();
        expect(anagramKey('LIVE')).toBe(anagramKey('EVIL'));
        const state = gs({ activeCharms: [charm('freakyFriday')], log: played(['STAR']) });
        const hit = calculateScore('RATS', plain('RATS'), state);
        const miss = calculateScore('RATS', plain('RATS'), gs({ activeCharms: [charm('freakyFriday')], log: played(['TERN']) }));
        expect(hit.bonuses.some(b => b.name === 'Freaky Friday (STAR → RATS)')).toBe(true);
        expect(hit.totalScore).toBeGreaterThanOrEqual(miss.totalScore * 2);
    });

    test('Shine Bright: gems one step bigger, and 5-letter words earn one', () => {
        expect([4, 5, 6, 7, 8, 9].map(n => gemMultiplierFor(n, true))).toEqual([0, SHINE_BRIGHT_GEMS[5], SHINE_BRIGHT_GEMS[6], SHINE_BRIGHT_GEMS[7], SHINE_BRIGHT_GEMS[8], SHINE_BRIGHT_GEMS[8]]);
        expect(gemMultiplierFor(6)).toBe(GEM_TILES[6]);
        expect(gemMultiplierFor(5)).toBe(0);
    });

    test('Need for Speed (v7.66.0): 4+ letter words in a row, fast; pays from the 2nd, capped', () => {
        // first 4+ letter word starts it, fast ones build it, a slow one restarts it, a short one ends it
        let streak = nextSpeedStreak(0, 5, null);
        expect(streak).toBe(1);
        expect(speedStreakPoints(streak)).toBe(0);
        streak = nextSpeedStreak(streak, 4, 2);
        expect([streak, speedStreakPoints(streak)]).toEqual([2, CHARM_BONUS.speedStep]);
        streak = nextSpeedStreak(streak, 6, 3.9);
        expect(speedStreakPoints(streak)).toBe(CHARM_BONUS.speedStep * 2);
        expect(nextSpeedStreak(streak, 5, CHARM_BONUS.speedSeconds + 1)).toBe(1);
        expect(nextSpeedStreak(streak, 3, 1)).toBe(0);
        expect(speedStreakPoints(20)).toBe(CHARM_BONUS.speedMax);
    });

    test('Keymaster: a Score Gate pays 50% more; arcade games are untouched', () => {
        const pay = (charms: string[], flat: boolean) => gameReducer(start({ activeCharms: charms.map(charm), score: 0 }),
            { type: 'APPLY_MINIGAME', payload: { name: 'Gate', icon: '🚪', points: 1000, headline: '+1,000', detail: 'x', flat } }).gameState!.score;
        expect(pay([], true)).toBe(1000);
        expect(pay(['keymaster'], true)).toBe(1000 * (1 + CHARM_BONUS.keymasterPercent / 100));
        expect(pay(['keymaster'], false)).toBe(prizeFor(1000, 1));
    });
});

describe('v7.62.0 PowerPlays', () => {
    test('Inception finds the everyday words hiding inside a word', () => {
        const common = new Set(['car', 'carp', 'pet', 'plan', 'plane', 'lane', 'net', 'planet', 'carpet']);
        expect(hiddenWordsIn('CARPET', w => common.has(w)).sort()).toEqual(['CAR', 'CARP', 'PET']);
        expect(hiddenWordsIn('PLANET', w => common.has(w)).sort()).toEqual(['LANE', 'NET', 'PLAN', 'PLANE']);
        expect(hiddenWordsIn('TEA', w => common.has(w))).toEqual([]);
        expect(POWER_PLAYS_LIST.find(p => p.id === 'inception')!.description).toContain(`+${POWER_PLAY_VALUES.inceptionPerWord * 3}`);
    });

    test('Jenga pot climbs 50, 150, 300... and caps at 6 blocks', () => {
        expect([0, 1, 2, 3, 6, 9].map(jengaPot)).toEqual([0, 50, 150, 300, 1050, 1050]);
    });

    test('Jenga: cashing out pays the pot; a strike topples it for nothing', () => {
        const armed = start({ score: 100, activePowerPlays: { jenga: { blocks: 3 } }, activeBuffs: [{ id: 'jenga' } as never] });
        const cashed = gameReducer(armed, { type: 'JENGA_CASH' });
        expect(cashed.gameState!.score).toBe(100 + prizeFor(300, 1));
        expect(cashed.gameState!.activePowerPlays.jenga).toBeUndefined();
        const toppled = gameReducer(armed, { type: 'ADD_STRIKE', payload: { source: 'invalid_word' } });
        expect(toppled.gameState!.activePowerPlays.jenga).toBeUndefined();
        expect(toppled.gameState!.score).toBe(100);
    });
});

describe('v7.65.0 shields', () => {
    test('a blocked strike names the shield that took it and leaves the old state alone', () => {
        const before = start({ strikes: 0, activePowerPlays: { strikeShield: true }, activeBuffs: [{ id: 'strikeShield', name: 'Ring Shield', icon: '💍' } as never] });
        const after = gameReducer(before, { type: 'ADD_STRIKE', payload: { source: 'invalid_word' } });
        expect(after.gameState!.strikes).toBe(0);
        expect(after.gameState!.activePowerPlays.strikeShield).toBeUndefined();
        expect(after.gameState!.lastPowerPlayResult?.message).toBe('💍 Ring Shield absorbed the hit!');
        expect(before.gameState!.activePowerPlays.strikeShield).toBe(true); // not mutated
    });
});

import { dealScratch, safeFirstScratch, skullOdds } from '../../scratch';
describe('v7.66.0 scratch-off ticket', () => {
    const seeded = (seed: number) => () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    test('a deal has the right number of skulls and prizes, mixed up, and respects slots and pocket', () => {
        const kinds = new Set<string>();
        for (let i = 0; i < 200; i++) {
            const d = dealScratch(seeded(i + 1), { heldCharmIds: ['powerGlove'], slotOpen: true, pocketEmpty: true });
            expect(d).toHaveLength(SCRATCH.squares);
            expect(d.filter(s => s.kind === 'skull')).toHaveLength(SCRATCH.skulls);
            d.forEach(s => kinds.add(s.kind));
            expect(d.some(s => s.kind === 'charm' && s.id === 'powerGlove')).toBe(false); // never one you hold
            const full = dealScratch(seeded(i + 1), { heldCharmIds: [], slotOpen: false, pocketEmpty: false });
            expect(full.some(s => s.kind === 'charm' || s.kind === 'powerplay')).toBe(false);
        }
        expect([...kinds].sort()).toEqual(['challenge', 'charm', 'points', 'powerplay', 'shuffle', 'skull', 'time']);
    });
    test('the first scratch is always safe, and the odds count what is still covered', () => {
        const d = dealScratch(seeded(5), { heldCharmIds: [], slotOpen: true, pocketEmpty: true });
        const skull = d.findIndex(s => s.kind === 'skull');
        const safe = safeFirstScratch(d, skull);
        expect(safe[skull].kind).not.toBe('skull');
        expect(safe.filter(s => s.kind === 'skull')).toHaveLength(SCRATCH.skulls);
        expect(skullOdds(safe, [skull])).toEqual({ skulls: SCRATCH.skulls, left: SCRATCH.squares - 1 });
    });
    test('banked prizes pay; a skull pays nothing', () => {
        const base = start({ score: 100, shuffleCount: 1, challengeCount: 0 });
        const withCard = { ...base, modalContent: { type: 'scratch', title: 'x', data: {} } } as GameScreenState;
        expect(gameReducer(withCard, { type: 'SCRATCH_RESULT', payload: { prize: { kind: 'points', amount: 250 } } }).gameState!.score).toBe(100 + prizeFor(250, 1));
        expect(gameReducer(withCard, { type: 'SCRATCH_RESULT', payload: { prize: { kind: 'shuffle', amount: 2 } } }).gameState!.shuffleCount).toBe(3);
        expect(gameReducer(withCard, { type: 'SCRATCH_RESULT', payload: { prize: { kind: 'challenge', amount: 1 } } }).gameState!.challengeCount).toBe(1);
        const timed = gameReducer({ ...withCard, time: 30 }, { type: 'SCRATCH_RESULT', payload: { prize: { kind: 'time', amount: 10 } } });
        expect(timed.time).toBe(40);
        const pp = gameReducer(withCard, { type: 'SCRATCH_RESULT', payload: { prize: { kind: 'powerplay', id: 'plinko' } } });
        expect(pp.gameState!.availablePowerPlays.map(p => p.id)).toEqual(['plinko']);
        const bust = gameReducer(withCard, { type: 'SCRATCH_RESULT', payload: { prize: null } });
        expect(bust.gameState!.score).toBe(100);
        expect(bust.modalContent?.type).toBe('outcome');
    });
});

describe('v7.66.0 scratch-off prize lists', () => {
    test('every charm and PowerPlay on the ticket exists; PowerPlays are pocket ones, not once-a-run', () => {
        for (const id of SCRATCH.charms) expect(CHARMS_LIST.some(c => c.id === id), id).toBe(true);
        for (const id of SCRATCH.powerPlays) {
            const pp = POWER_PLAYS_LIST.find(p => p.id === id);
            expect(pp, id).toBeTruthy();
            expect(pp!.oncePerRun, id).toBeFalsy();
        }
    });
});
