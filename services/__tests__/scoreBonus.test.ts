import { describe, test, expect } from 'vitest';
import { matchScorePattern, explainScoreBonus, scoreTrigger } from '../scoreBonus';
import { EASTER_EGGS } from '../../data/easterEggs';

describe('score-number bonuses', () => {
    test('split the score around the matching digits', () => {
        expect(matchScorePattern(742, { kind: 'contains', digits: '42' })).toEqual({ before: '7', match: '42', after: '' });
        expect(matchScorePattern(1469, { kind: 'endsWith', digits: '69' })).toEqual({ before: '14', match: '69', after: '' });
        expect(matchScorePattern(456, { kind: 'equals', digits: '456' })).toEqual({ before: '', match: '456', after: '' });
        expect(matchScorePattern(4567, { kind: 'equals', digits: '456' })).toBeNull();
        expect(matchScorePattern(0, { kind: 'contains', digits: '0' })).toBeNull();
    });

    test('explain why the bonus fired', () => {
        expect(explainScoreBonus(742, { kind: 'contains', digits: '42' })).toBe('Your score hit 742, which contains 42.');
        expect(explainScoreBonus(1469, { kind: 'endsWith', digits: '69' })).toBe('Your score hit 1,469, which ends in 69.');
        expect(explainScoreBonus(2763, { kind: 'equals', digits: '2763' })).toBe('Your score hit exactly 2,763.');
    });

    test('every score-pattern egg triggers exactly when its pattern matches', () => {
        const eggs = EASTER_EGGS.filter(e => e.scorePattern);
        expect(eggs.length).toBe(6);
        for (const egg of eggs) {
            const check = scoreTrigger(egg.scorePattern!);
            for (const score of [69, 142, 421, 456, 1469, 2763, 999]) {
                expect(egg.trigger('word', score, {} as any)).toBe(check('word', score));
            }
        }
    });
});
