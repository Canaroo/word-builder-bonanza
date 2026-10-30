// Power words: secret words with an effect on the next round.
import { describe, test, expect } from 'vitest';
import { slotPayout, powerWordReady } from '../rules';
import { POWER_WORD_EFFECTS } from '../../config/gameplay';
import { SECRET_BONUSES } from '../../data/secretBonuses';

describe('the slot machine', () => {
    test('always pays: +1s, +3s or +10s at 50 / 35 / 15%', () => {
        expect([0, 0.49, 0.5, 0.84, 0.85, 0.999].map(r => slotPayout(r).seconds)).toEqual([1, 1, 3, 3, 10, 10]);
        expect(POWER_WORD_EFFECTS.slot.reduce((s, p) => s + p.chance, 0)).toBeCloseTo(1);
        const average = POWER_WORD_EFFECTS.slot.reduce((s, p) => s + p.seconds * p.chance, 0);
        expect(average).toBeCloseTo(3.05);
    });
});

describe('once per level', () => {
    test('a power word can fire again only at a later level', () => {
        expect(powerWordReady(undefined, 'oceansSlot', 1)).toBe(true);
        expect(powerWordReady({ oceansSlot: 2 }, 'oceansSlot', 2)).toBe(false);
        expect(powerWordReady({ oceansSlot: 2 }, 'oceansSlot', 3)).toBe(true);
    });
});

describe('the power word entries', () => {
    test('five power words, one per effect; HEAL pays its fallback from config, not as a flat reward', () => {
        const power = SECRET_BONUSES.filter(b => b.effect);
        expect(Object.fromEntries(power.map(b => [b.word, b.effect]))).toEqual({ SLOT: 'slot', SNOW: 'freeze', HEAL: 'heal', SLOW: 'slow', TWIN: 'twin' });
        expect(power.every(b => !b.points)).toBe(true);
    });
});
