import { describe, test, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { SECRET_BONUSES } from '../secretBonuses';
import { WORD_BONUSES } from '../wordBonuses';
import { checkBonuses, formatProblems } from '../../services/bonusCheck';

// The build runs this file (npm run check:bonuses) and stops if it fails, so a broken
// bonus edit never reaches the live site. The word list is built first by npm run words.
const root = path.resolve(__dirname, '../..');
const readLines = (file: string) =>
    fs.readFileSync(path.join(root, file), 'utf8')
        .split(/\r?\n/).map(l => l.trim().toLowerCase()).filter(l => l && !l.startsWith('#'));

describe('bonus lists (data/secretBonuses.ts, data/wordBonuses.ts)', () => {
    test('every bonus is valid', () => {
        const problems = checkBonuses(SECRET_BONUSES, WORD_BONUSES, {
            words: new Set(readLines('public/words/wordlist.txt')),
            blocked: new Set(readLines('words/blocked.txt')),
        });
        if (problems.length) {
            throw new Error(`Fix these bonus entries before publishing:\n${formatProblems(problems)}`);
        }
        expect(SECRET_BONUSES.length).toBeGreaterThan(40);
    });
});
