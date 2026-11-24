// v7.86.0: Greatest Hits shows which word is close to a record (Gear's box and the stage's big news).
import { describe, test, expect } from 'vitest';
import { hitsBoard, hitIfPlayed } from '../greatestHits';

const played = (word: string, n: number) => Array.from({ length: n }, () => ({ type: 'word', word, status: 'valid' })) as any[];

describe('Greatest Hits board', () => {
    test('lists the leading word for each open record once it has 2 plays', () => {
        const rows = hitsBoard([...played('TEA', 2), ...played('ROSE', 2), ...played('DOG', 1)], []);
        const gold = rows.find(r => r.tier.letters === 3)!;
        const plat = rows.find(r => r.tier.letters === 4)!;
        expect(gold).toMatchObject({ word: 'TEA', plays: 2, done: false });
        expect(plat).toMatchObject({ word: 'ROSE', plays: 2, done: false });
        expect(rows.find(r => r.tier.letters === 5)!.word).toBeNull();
    });
    test('a paid record shows the word that earned it; an open one ignores words already past it', () => {
        const log = [...played('CAT', 3), ...played('TEA', 2)];
        expect(hitsBoard(log, [3]).find(r => r.tier.letters === 3)).toMatchObject({ word: 'CAT', done: true });
        expect(hitsBoard(log, []).find(r => r.tier.letters === 3)).toMatchObject({ word: 'TEA', plays: 2 });
    });
    test('the stage knows when this play completes a record', () => {
        expect(hitIfPlayed(played('TEA', 2), [], 'tea')?.title).toBe('GOLD');
        expect(hitIfPlayed(played('TEA', 1), [], 'TEA')).toBeUndefined();
        expect(hitIfPlayed(played('TEA', 2), [3], 'TEA')).toBeUndefined();
        expect(hitIfPlayed(played('ROSE', 3), [], 'ROSE')?.title).toBe('PLATINUM');
    });
});
