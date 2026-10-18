import { describe, test, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { internalWords } from '../../data/internalWords';

// Checks the list built by scripts/build-wordlist.mjs (run automatically before tests).
const root = path.resolve(__dirname, '../..');
const words = new Set(fs.readFileSync(path.join(root, 'public/words/wordlist.txt'), 'utf8').split('\n').filter(Boolean));

const readWordFile = (file: string) =>
    fs.readFileSync(path.join(root, 'words', file), 'utf8')
        .split(/\r?\n/).map(l => l.trim().toLowerCase()).filter(l => l && !l.startsWith('#'));

describe('generated word list', () => {
    test('is a full-size Scrabble-style list of lowercase words', () => {
        expect(words.size).toBeGreaterThan(250_000);
        for (const w of ['qi', 'za', 'quixotic', 'xu', 'jo']) expect(words).toContain(w);
    });

    test('includes every curated internal word that is not blocked', () => {
        const blocked = new Set(readWordFile('blocked.txt'));
        const missing = [...internalWords.keys()].filter(w => !blocked.has(w) && !words.has(w));
        expect(missing).toEqual([]);
    });

    test('includes every custom word and excludes every blocked word', () => {
        for (const w of readWordFile('custom.txt')) expect(words).toContain(w);
        for (const w of readWordFile('blocked.txt')) expect(words).not.toContain(w);
    });

    test('includes real Scrabble words the base list dropped (via SCOWL)', () => {
        for (const w of ['vape', 'vaping', 'bum', 'butt', 'crap', 'damn', 'emoji', 'selfie']) expect(words).toContain(w);
    });

    test('keeps slurs and the harshest profanity out', () => {
        for (const w of ['nigger', 'faggot', 'retard', 'wetback', 'cunt', 'fuck', 'fucking', 'slut']) expect(words).not.toContain(w);
        expect(words).toContain('retardant'); // only the exact listed words are blocked
    });

    test('the common list is an everyday subset of the full list', () => {
        const common = fs.readFileSync(path.join(root, 'public/words/common.txt'), 'utf8').split('\n').filter(Boolean);
        expect(common.length).toBeGreaterThan(20_000);
        expect(common.filter(w => !words.has(w))).toEqual([]);
        const set = new Set(common);
        for (const w of ['cat', 'zebra', 'tacos']) expect(set).toContain(w);
        for (const w of ['aas', 'qat', 'aah']) expect(set).not.toContain(w);
        // Hints and Challenge never suggest the vulgar words SCOWL adds back.
        for (const w of ['crap', 'bum', 'butt']) expect(set).not.toContain(w);
    });
});
