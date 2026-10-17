import { describe, test, expect } from 'vitest';
import { checkBonuses } from '../bonusCheck';
import type { SecretBonus, WordBonus } from '../../types';

const lists = { words: new Set(['link', 'air', 'darn']), blocked: new Set(['darn']) };
const bonus = (over: Partial<SecretBonus>): SecretBonus =>
    ({ id: 'heroOfHyrule', word: 'LINK', name: '🗡️ Hero', description: 'd', points: 100, message: 'm', ...over });
const problemsFor = (secret: SecretBonus[], counts: WordBonus[] = []) =>
    checkBonuses(secret, counts, lists).map(p => `${p.id}: ${p.problem}`);

describe('checkBonuses', () => {
    test('accepts valid word and score bonuses', () => {
        expect(problemsFor([
            bonus({ media: 'cartridge', source: 'Zelda', replacesWordScore: true }),
            bonus({ id: 'theAnswer', word: undefined, score: { kind: 'contains', digits: '42' } }),
        ])).toEqual([]);
    });

    test('flags blocked, unknown and duplicate words', () => {
        const problems = problemsFor([
            bonus({ id: 'a', word: 'DARN' }),
            bonus({ id: 'b', word: 'ZZZQ' }),
            bonus({ id: 'c', word: 'air' }),
            bonus({ id: 'd', word: 'AIR' }),
        ]);
        expect(problems).toHaveLength(3);
        expect(problems[0]).toMatch(/^a: .*blocked/);
        expect(problems[1]).toMatch(/^b: .*dictionary/);
        expect(problems[2]).toMatch(/^d: .*already used by c/);
    });

    test('flags structural mistakes', () => {
        const problems = problemsFor([
            bonus({ id: 'x', points: undefined }),
            bonus({ id: 'x', word: 'AIR', media: 'vhs' }),
            bonus({ id: 'y', score: { kind: 'contains', digits: '42' } }),
            bonus({ id: 'z', word: undefined, score: { kind: 'contains', digits: '042' }, replacesWordScore: true }),
            bonus({ id: 'w', word: 'L1NK' }),
        ]);
        expect(problems.join('\n')).toMatch(/x: needs a reward/);
        expect(problems.join('\n')).toMatch(/x: id is used more than once/);
        expect(problems.join('\n')).toMatch(/x: media "vhs" needs a source/);
        expect(problems.join('\n')).toMatch(/y: needs exactly one trigger/);
        expect(problems.join('\n')).toMatch(/z: replacesWordScore only applies/);
        expect(problems.join('\n')).toMatch(/z: score digits/);
        expect(problems.join('\n')).toMatch(/w: .*letters only/);
    });

    test('flags duplicate word-count milestones', () => {
        const counts: WordBonus[] = [
            { id: 'fifty', title: 't', description: 'd', wordCount: 50, reward: { points: 100 } },
            { id: 'fiftyAgain', title: 't', description: 'd', wordCount: 50, reward: { points: 100 } },
        ];
        expect(problemsFor([], counts)).toEqual(['fiftyAgain: wordCount 50 is already used by fifty']);
    });

    test('skips dictionary checks without word lists', () => {
        expect(checkBonuses([bonus({ word: 'ZZZQ' })], [])).toEqual([]);
    });
});
