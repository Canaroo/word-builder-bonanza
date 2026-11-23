// v7.74.0: game-show features. 📊 Survey Says!, ⭕ Center Square and 🎡 Spin & Solve (SPIN).
import { describe, test, expect } from 'vitest';
import { surveyBoard, surveySlotFor, surveyPayout, CENTER_SQUARES, centerSquareDeal, centerSquareClaim, centerSquareLines, centerSquarePrize, wheelLetterPay, wheelBoard, wheelSolved } from '../rules';
import { POWER_PLAY_VALUES as V, MINI_GAME_VALUES as M } from '../../config/gameplay';
import { POWER_PLAYS_LIST, INSTANT_POWER_PLAY_IDS, PRIZE_POWER_PLAY_IDS } from '../../data/powerPlays';
import { SECRET_BONUSES } from '../../data/secretBonuses';
import { GAMBLE_CARD_IDS } from '../../components/GambleCard';
import { createWordIndex } from '../wordIndex';

describe('📊 Survey Says!', () => {
    test('the board is one answer of each length, longest first; repeats only when lengths run out', () => {
        expect(surveyBoard(['STRAINED', 'TRAINED', 'DETAINS', 'STAINED', 'TRAINS', 'STAIN', 'RAIN', 'RAT'])?.lengths).toEqual([8, 7, 6, 5, 4]);
        const b = surveyBoard(['CAT', 'STRAIN', 'TRAIN', 'RAIN', 'ANTS', 'SAT', 'TRAINS']);
        expect(b?.lengths).toEqual([6, 5, 4, 3, 3]);
        expect(b?.examples[0]).toBe('STRAIN');
    });
    test('thin tiles get no board (fewer than 5 answers, or a short top answer)', () => {
        expect(surveyBoard(['CAT', 'ACT', 'TAB'])).toBeNull();
        expect(surveyBoard(['CAT', 'ACT', 'TAB', 'BAT', 'TACT'])).toBeNull(); // top answer only 4 letters
    });
    test('a word fills the first open slot of its length; payout by slot plus the clean sweep', () => {
        const lengths = [6, 6, 5, 4, 4];
        expect(surveySlotFor(lengths, [null, null, null, null, null], 'TRAINS')).toBe(0);
        expect(surveySlotFor(lengths, ['TRAINS', null, null, null, null], 'STRAIN')).toBe(1);
        expect(surveySlotFor(lengths, ['TRAINS', 'STRAIN', null, null, null], 'TRAINS')).toBe(-1);
        expect(surveySlotFor(lengths, [null, null, null, null, null], 'CAT')).toBe(-1);
        expect(surveyPayout(['TRAINS', null, 'TRAIN', null, null])).toBe(V.surveyPrizes[0] + V.surveyPrizes[2]);
        expect(surveyPayout(['A', 'B', 'C', 'D', 'E'])).toBe(V.surveyPrizes.reduce((a, b) => a + b, 0) + V.surveyClear);
    });
    test('the word index lists every everyday word the tiles spell, longest first', () => {
        const idx = createWordIndex(['cat', 'act', 'cats', 'scat', 'zebra'], ['cat', 'act', 'cats', 'scat']);
        expect(idx.allPlayable(['C', 'A', 'T', 'S'])).toEqual(['CATS', 'SCAT', 'CAT', 'ACT']);
    });
    test('a pocket gamble card that grows with the level; its text reads the numbers', () => {
        const pp = POWER_PLAYS_LIST.find(p => p.id === 'surveySays')!;
        expect(GAMBLE_CARD_IDS).toContain('surveySays');
        expect(PRIZE_POWER_PLAY_IDS.has('surveySays')).toBe(true);
        expect(pp.description).toContain(`+${V.surveyPrizes[0]}`);
        expect(pp.description).toContain(`${V.surveySeconds} seconds`);
    });
});

describe('⭕ Center Square', () => {
    test('the board has 9 different squares with 6+ letters in the center', () => {
        for (let i = 0; i < 50; i++) {
            const b = centerSquareDeal();
            expect(b).toHaveLength(9); expect(b[4]).toBe('six'); expect(new Set(b).size).toBe(9);
            for (const id of b) expect(CENTER_SQUARES[id]).toBeDefined();
        }
    });
    test('a word claims one square, preferring the one that finishes a line', () => {
        const board = ['endsS', 'five', 'three', 'vowelStart', 'six', 'double', 'rare', 'oneVowel', 'bcmp'];
        // TRAINS fits "ends in S", "5+ letters" and "6+ letters": it should take the center... unless a line is waiting.
        expect(centerSquareClaim(board, Array(9).fill(false), 'TRAINS')).toBe(4);
        const got = [false, false, false, false, false, false, false, false, false];
        got[1] = true; got[2] = true; // the top row needs square 0 (ends in S)
        expect(centerSquareClaim(board, got, 'TRAINS')).toBe(0);
        expect(centerSquareClaim(board, Array(9).fill(true), 'TRAINS')).toBeNull();
        expect(centerSquareClaim(board, Array(9).fill(false), 'EAT')).not.toBeNull();
    });
    test('lines and prizes; a full board needs 9 words, and there are 10', () => {
        expect(centerSquareLines([true, true, true, false, false, false, false, false, false])).toBe(1);
        expect(centerSquarePrize([true, true, true, false, false, false, false, false, false])).toBe(V.centerSquareLine);
        expect(centerSquarePrize(Array(9).fill(true))).toBe(8 * V.centerSquareLine + V.centerSquareFull);
        expect(V.centerSquareWords).toBeGreaterThanOrEqual(9);
    });
    test('fires on pick and deals a fresh board', () => {
        const pp = POWER_PLAYS_LIST.find(p => p.id === 'centerSquare')!;
        expect(INSTANT_POWER_PLAY_IDS.has('centerSquare')).toBe(true);
        const armed = pp.activate({ activePowerPlays: {}, activeBuffs: [] } as any) as any;
        expect(armed.activePowerPlays.centerSquare.board).toHaveLength(9);
        expect(armed.activePowerPlays.centerSquare.words).toBe(V.centerSquareWords);
    });
});

describe('🎡 Spin & Solve (SPIN)', () => {
    test('SPIN is a secret word that opens the wheel and pays no flat points', () => {
        const b = SECRET_BONUSES.find(x => x.word === 'SPIN')!;
        expect(b.miniGame).toBe('wheel');
        expect(b.points ?? 0).toBe(0);
        expect(SECRET_BONUSES.filter(x => x.word === 'SPIN')).toHaveLength(1);
    });
    test('a letter pays the wedge for each time it appears; BANKRUPT and FREE SPIN pay nothing', () => {
        expect(wheelLetterPay('BALLOON', 'L', 100)).toBe(200);
        expect(wheelLetterPay('BALLOON', 'Z', 100)).toBe(0);
        expect(wheelLetterPay('BALLOON', 'L', 0)).toBe(0);
        expect(wheelLetterPay('BALLOON', 'L', -1)).toBe(0);
        expect(M.wheel.wedges).toContain(0);
        expect(M.wheel.wedges).toContain(-1);
    });
    test('the board shows called letters only, and is solved when every letter is shown', () => {
        expect(wheelBoard('BALLOON', ['L', 'O'])).toEqual(['', '', 'L', 'L', 'O', 'O', '']);
        expect(wheelSolved('BALLOON', ['B', 'A', 'L', 'O'])).toBe(false);
        expect(wheelSolved('BALLOON', ['B', 'A', 'L', 'O', 'N'])).toBe(true);
    });
});

describe('💡 Final Jeopardy on Last Words (v7.75.0)', () => {
    test('bets are 5% or 10% of the score, rounded, never more than 3,000', async () => {
        const { finalBet } = await import('../rules');
        expect(finalBet(12345, 5)).toBe(620);
        expect(finalBet(12345, 10)).toBe(1230);
        expect(finalBet(100000, 10)).toBe(3000);
        expect(finalBet(0, 10)).toBe(0);
    });
    test('categories check the word, and the deal picks one of them', async () => {
        const { FINAL_CATEGORIES, finalCategoryDeal } = await import('../rules');
        expect(FINAL_CATEGORIES.double.test('BALLOON')).toBe(true);
        expect(FINAL_CATEGORIES.double.test('TRAIN')).toBe(false);
        expect(FINAL_CATEGORIES.oneVowel.test('STRAND')).toBe(true);
        expect(FINAL_CATEGORIES.oneVowel.test('CAT')).toBe(false); // needs 4+ letters
        expect(FINAL_CATEGORIES.stStart.test('TRAIN')).toBe(true);
        for (let i = 0; i < 30; i++) expect(FINAL_CATEGORIES[finalCategoryDeal()]).toBeDefined();
    });
});
