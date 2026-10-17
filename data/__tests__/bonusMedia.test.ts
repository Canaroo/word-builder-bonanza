import { describe, test, expect } from 'vitest';
import { BONUS_MEDIA, getBonusMedia } from '../bonusMedia';
import { EASTER_EGGS } from '../easterEggs';

describe('bonus media', () => {
    test('every mapped bonus is a real easter egg', () => {
        const ids = new Set(EASTER_EGGS.map(e => e.id));
        expect(Object.keys(BONUS_MEDIA).filter(id => !ids.has(id))).toEqual([]);
    });

    test('unmapped bonuses fall back to the arcade marquee', () => {
        expect(getBonusMedia('noSuchBonus')).toEqual({ media: 'arcade' });
        expect(getBonusMedia('heroOfHyrule')).toEqual({ media: 'cartridge', source: 'The Legend of Zelda' });
    });
});
