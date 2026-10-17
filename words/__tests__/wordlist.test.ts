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

    test('includes every word that triggers an easter egg bonus', () => {
        const source = fs.readFileSync(path.join(root, 'data/easterEggs.ts'), 'utf8');
        const triggers = [...source.matchAll(/word\.toUpperCase\(\) === '([A-Z]+)'/g)].map(m => m[1].toLowerCase());
        expect(triggers.length).toBeGreaterThan(30);
        expect(triggers.filter(w => !words.has(w))).toEqual([]);
    });
});
