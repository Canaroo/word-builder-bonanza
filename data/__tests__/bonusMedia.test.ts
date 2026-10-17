import { describe, test, expect } from 'vitest';
import { getBonusMedia } from '../bonusMedia';
import { EASTER_EGGS } from '../easterEggs';

describe('bonus media', () => {
    test('media comes from data/secretBonuses.ts', () => {
        expect(getBonusMedia('heroOfHyrule')).toEqual({ media: 'cartridge', source: 'The Legend of Zelda' });
    });

    test('bonuses without media fall back to the arcade marquee', () => {
        expect(getBonusMedia('noSuchBonus')).toEqual({ media: 'arcade' });
        expect(getBonusMedia('theAnswer')).toEqual({ media: 'arcade' });
    });

    test('word bonuses trigger on their word, any case', () => {
        const link = EASTER_EGGS.find(e => e.id === 'heroOfHyrule')!;
        expect(link.word).toBe('LINK');
        expect(link.trigger('link', 0, {} as never)).toBe(true);
        expect(link.trigger('links', 0, {} as never)).toBe(false);
    });
});
