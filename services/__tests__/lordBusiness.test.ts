import { describe, test, expect } from 'vitest';
import { bossById } from '../../data/bosses';
import type { Tile } from '../../types';

const t = (letter: string, points: number, extra: Partial<Tile> = {}): Tile => ({ id: `${letter}${points}${Math.random()}`, letter, points, ...extra } as Tile);
const ctx = { last: '', score: 0, lastScore: 0 };

// v7.67.6: a player saw every tile turn red against Lord Business. With all tiles tied for the top
// value, every tile was "the rarest" and glowed.
describe('Lord Business (v7.67.6)', () => {
    const boss = bossById('lordBusiness')!;
    test('only the top tile glows', () => {
        const hand = [t('E', 1), t('A', 1), t('K', 5), t('T', 1), t('R', 1)];
        expect(hand.map(x => boss.tileHint!(x, hand, ctx))).toEqual([null, null, 'glow', null, null]);
        expect(boss.check('TREK', hand, ctx)).toBe(true);
        expect(boss.check('TEAR', hand, ctx)).toBe(false);
    });
    test('an all-tied hand lights nothing, and any word counts', () => {
        const hand = [t('E', 1), t('A', 1), t('S', 1), t('T', 1), t('R', 1)];
        expect(hand.map(x => boss.tileHint!(x, hand, ctx)).every(h => h === null)).toBe(true);
        expect(boss.check('STAR', hand, ctx)).toBe(true);
    });
    test('a tile a PowerPlay changed counts at the value it shows', () => {
        const hand = [t('E', 1, { tempPoints: 30 }), t('K', 5), t('T', 1)];
        expect(boss.tileHint!(hand[0], hand, ctx)).toBe('glow');
        expect(boss.tileHint!(hand[1], hand, ctx)).toBe(null);
    });
});
