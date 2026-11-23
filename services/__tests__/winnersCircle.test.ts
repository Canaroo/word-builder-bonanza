// @vitest-environment jsdom
// v7.76.0: 🔺 Winner's Circle, the 20,000 gate.
import { describe, test, expect } from 'vitest';
import fs from 'node:fs';
import { WINNERS_CIRCLE_CLUES } from '../../data/winnersCircle';
import { dealWinners } from '../../components/MiniGames';
import { GATES } from '../../config/gameplay';
import { nextGateFor, previousGateFor } from '../rules';
import { MINI_GAMES } from '../../data/miniGames';

const words = new Set(fs.readFileSync('public/words/wordlist.txt', 'utf8').split('\n').map(w => w.trim().toUpperCase()));
const noSuggest = new Set(fs.readFileSync('words/no-suggest.txt', 'utf8').split('\n').map(w => w.trim().toUpperCase()));

describe("🔺 Winner's Circle", () => {
    test('every clue is a real, 4-6 letter, suggestable word whose clue never gives it away', () => {
        expect(WINNERS_CIRCLE_CLUES.length).toBeGreaterThan(300);
        for (const [word, clue] of WINNERS_CIRCLE_CLUES) {
            expect(words.has(word), word).toBe(true);
            expect(noSuggest.has(word), word).toBe(false);
            expect(word.length).toBeGreaterThanOrEqual(4); expect(word.length).toBeLessThanOrEqual(6);
            expect(clue.toUpperCase().includes(word.slice(0, 4)), `${word}: ${clue}`).toBe(false);
        }
        expect(new Set(WINNERS_CIRCLE_CLUES.map(c => c[0])).size).toBe(WINNERS_CIRCLE_CLUES.length);
    });
    test('a deal is 3 different clues, each board holds its answer plus extras, never in order', () => {
        for (let i = 0; i < 100; i++) {
            const deal = dealWinners();
            expect(deal).toHaveLength(GATES.winners.rungs.length);
            expect(new Set(deal.map(d => d.word)).size).toBe(deal.length);
            for (const d of deal) {
                expect(d.letters).toHaveLength(d.word.length + GATES.winners.extraTiles);
                const pool = [...d.letters];
                for (const ch of d.word) { const k = pool.indexOf(ch); expect(k, `${d.word} in ${d.letters.join('')}`).toBeGreaterThanOrEqual(0); pool.splice(k, 1); }
            }
        }
    });
    test('it sits at 20,000, between the Password Gate and the Bonus Stage, and pays 2,000 for all three', () => {
        expect(GATES.winners.score).toBe(20000);
        expect(nextGateFor({ score: 12000, gatesPassed: [10000] })).toBe(20000);
        expect(nextGateFor({ score: 22000, gatesPassed: [10000, 20000] })).toBe(30000);
        expect(previousGateFor(30000)).toBe(20000);
        expect(GATES.winners.rungs.reduce((a, b) => a + b, 0) + GATES.winners.sweep).toBe(2000);
        expect(MINI_GAMES.winners.name).toBe("Winner's Circle");
    });
});
