// Comparing two player IDs: the higher number leads each row; ties are even.
import { describe, test, expect } from 'vitest';
import { compareRows } from '../IdCompare';

const card = (o = {}) => ({ runs: 10, best: 5000, avg: 2000, level: 5, word: 'JAZZ', wordScore: 180, longest: 'PLANET', secrets: 4, ...o });

describe('IdCompare', () => {
    test('each row goes to the higher value; equal is a tie', () => {
        const rows = compareRows(
            { name: 'Tex', card: card({ best: 9000, longest: 'STRANGER' }), bosses: 2, streak: 0 },
            { name: 'Dad', card: card({ runs: 30 }), bosses: 2, streak: 4 },
        );
        const winner = Object.fromEntries(rows.map(r => [r.label, r.winner]));
        expect(winner).toMatchObject({ 'Best score': 'them', 'Runs': 'me', 'Longest word': 'them', 'Boss Badges': 'tie', 'Day streak': 'me', 'Avg score': 'tie' });
        expect(rows.find(r => r.label === 'Best word')!.show(180, card())).toBe('180 pts');
        expect(rows.find(r => r.label === 'Best word')!.sub!(card())).toBe('JAZZ');
    });
});
