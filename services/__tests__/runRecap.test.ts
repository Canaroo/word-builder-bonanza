import { describe, test, expect } from 'vitest';
import { buildShareText, pickNextHint, RunRecap } from '../runRecap';
import { EASTER_EGGS } from '../../data/easterEggs';
import { SECRET_BONUSES } from '../../data/secretBonuses';

const egg = (id: string) => EASTER_EGGS.find(e => e.id === id)!;
const recap: RunRecap = { newSecretIds: ['heroOfHyrule'], collection: { found: 18, total: 46 }, previousBest: 3000, nextHint: null };

describe('buildShareText', () => {
    test('summarises the run and ends with the link', () => {
        const text = buildShareText(
            { score: 4812, highestScoringWord: { word: 'link', score: 189 } as never, foundEasterEggs: [egg('heroOfHyrule'), egg('homersDelight'), egg('theAnswer')] },
            recap, true, 'https://wordnerd-game.netlify.app/',
        );
        expect(text).toBe([
            'WORD NERD 🕹️ 4,812 pts',
            '★ New personal best!',
            '🏆 Top word: LINK (189)',
            '🎮📼🕹️ 3 secrets · 18/46 collected',
            'https://wordnerd-game.netlify.app/',
        ].join('\n'));
    });

    test('handles a run with no secrets or top word', () => {
        const text = buildShareText({ score: 0, highestScoringWord: null, foundEasterEggs: [] }, recap, false, 'u');
        expect(text).toBe('WORD NERD 🕹️ 0 pts\n🔒 No secrets this time · 18/46 collected\nu');
    });
});

describe('pickNextHint', () => {
    test('returns a clue for an uncollected bonus, or null when all are found', () => {
        const allButFirst = new Set(SECRET_BONUSES.slice(1).map(b => b.id));
        expect(pickNextHint(allButFirst, () => 0)).toBeTruthy();
        expect(pickNextHint(new Set(SECRET_BONUSES.map(b => b.id)))).toBeNull();
    });
});
