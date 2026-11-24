// v7.74.0: game-show features. 📊 Survey Says!, ⭕ Center Square and 🎡 Spin & Solve (SPIN).
import { describe, test, expect } from 'vitest';
import { surveyBoard, surveySlotFor, surveyPayout, CENTER_SQUARES, centerSquareDeal, centerSquareClaim, centerSquareLines, centerSquarePrize, centerSquareFill, centerSquarePay, centerSquareDoneLines, CENTER_SQUARE_ORDER, wheelLetterPay, wheelBoard, wheelSolved } from '../rules';
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
    test('legacy boards (saved runs from v7.74-7.78) still settle by lines', () => {
        expect(centerSquareLines([true, true, true, false, false, false, false, false, false])).toBe(1);
        expect(centerSquarePrize([true, true, true, false, false, false, false, false, false])).toBe(V.centerSquareLine);
        expect(centerSquarePrize(Array(9).fill(true))).toBe(8 * V.centerSquareLine + V.centerSquareFull);
        expect(V.centerSquareWords).toBeGreaterThanOrEqual(9);
    });
    test('v7.79.0: fires on pick as its own card and arms nothing above the tiles', () => {
        const pp = POWER_PLAYS_LIST.find(p => p.id === 'centerSquare')!;
        expect(INSTANT_POWER_PLAY_IDS.has('centerSquare')).toBe(true);
        expect(GAMBLE_CARD_IDS).toContain('centerSquare');
        expect(PRIZE_POWER_PLAY_IDS.has('centerSquare')).toBe(true);
        const after = pp.activate({ activePowerPlays: {}, activeBuffs: [] } as any) as any;
        expect(after.activePowerPlays?.centerSquare).toBeUndefined();
        expect(V.centerSquareTurns).toBe(9);
        expect(pp.description).toContain(`${V.centerSquareTurns} words`);
        expect(pp.description).toContain(`+${V.centerSquarePerSquare}`);
    });
    test('v7.79.0: a word fills the hardest open square it fits; flat pay per square', () => {
        const board = ['three', 'five', 'endsS', 'vowelStart', 'six', 'double', 'rare', 'oneVowel', 'bcmp'];
        const none = Array(9).fill(false);
        // TRAINS fits 5+, 6+ and ENDS IN S: ENDS IN S is the hardest (28% of hands), so it goes there.
        expect(centerSquareFill(board, none, 'TRAINS')).toBe(2);
        const got = [...none]; got[2] = true;
        expect(centerSquareFill(board, got, 'TRAINS')).toBe(4); // then 6+ letters
        expect(centerSquareFill(board, Array(9).fill(true), 'TRAINS')).toBeNull();
        expect(centerSquareFill(board, none, 'TEA')).toBe(0); // only EXACTLY 3 LETTERS fits
        expect(centerSquareFill(board, none, 'TOO')).toBe(5); // fits 3 letters and a double letter: the double is harder
        expect(centerSquarePay(none)).toBe(0);
        expect(centerSquarePay(got)).toBe(V.centerSquarePerSquare);
        expect(centerSquarePay(Array(9).fill(true))).toBe(9 * V.centerSquarePerSquare + 8 * V.centerSquareLineBonus + V.centerSquareFullBonus);
        // v7.79.1: a finished line pays its bonus (top row here)
        expect(centerSquarePay([true, true, true, false, false, false, false, false, false])).toBe(3 * V.centerSquarePerSquare + V.centerSquareLineBonus);
        expect(centerSquareDoneLines([true, false, false, false, true, false, false, false, true])).toEqual([6]); // a diagonal
        // v7.79.1: a square that finishes a line wins over a harder one. Top row 0,1 filled: TRAINS fits
        // 5+ (1, done), ENDS IN S (2) and 6+ (4). Make square 2 the line-finisher and 4 harder: it goes to 2.
        const lineBoard = ['three', 'five', 'stStart', 'vowelStart', 'six', 'double', 'rare', 'oneVowel', 'endsS'];
        const g2 = [true, true, false, false, false, false, false, false, false];
        expect(centerSquareFill(lineBoard, g2, 'TRAINS')).toBe(2); // STARTS WITH S OR T finishes the top row
        expect(centerSquareFill(lineBoard, none, 'TRAINS')).toBe(8); // no line to finish: ENDS IN S, the hardest
        // every square has a difficulty rank
        for (const id of Object.keys(CENTER_SQUARES)) expect(CENTER_SQUARE_ORDER).toContain(id);
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
