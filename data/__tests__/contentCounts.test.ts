// Keeps the PowerPlay, charm, secret bonus and boss counts in CLAUDE.md in step with the real lists.
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { POWER_PLAYS_LIST } from '../powerPlays';
import { CHARMS_LIST } from '../charms';
import { SECRET_BONUSES } from '../secretBonuses';
import { BOSSES } from '../bosses';

const notes = readFileSync(resolve(__dirname, '../../CLAUDE.md'), 'utf8');
const row = notes.match(/PowerPlays \/ charms \((\d+) \/ (\d+)\)/);
const bonusRow = notes.match(/Secret bonuses \((\d+) words, (\d+) scores\)/);
const bossRow = notes.match(/Bosses \((\d+)\)/);

describe('content counts', () => {
    test('CLAUDE.md lists the PowerPlay and charm counts', () => {
        expect(row, 'CLAUDE.md is missing the "PowerPlays / charms (N / N)" row').not.toBeNull();
    });

    test('PowerPlay count matches CLAUDE.md', () => {
        expect(POWER_PLAYS_LIST.length, 'update "PowerPlays / charms" in CLAUDE.md').toBe(Number(row![1]));
    });

    test('charm count matches CLAUDE.md', () => {
        expect(CHARMS_LIST.length, 'update "PowerPlays / charms" in CLAUDE.md').toBe(Number(row![2]));
    });

    test('CLAUDE.md lists the secret bonus counts', () => {
        expect(bonusRow, 'CLAUDE.md is missing the "Secret bonuses (N words, N scores)" row').not.toBeNull();
    });

    test('secret bonus word and score counts match CLAUDE.md', () => {
        const words = SECRET_BONUSES.filter(b => b.word).length;
        const scores = SECRET_BONUSES.filter(b => b.score).length;
        expect(words, 'update "Secret bonuses" in CLAUDE.md').toBe(Number(bonusRow![1]));
        expect(scores, 'update "Secret bonuses" in CLAUDE.md').toBe(Number(bonusRow![2]));
        expect(words + scores).toBe(SECRET_BONUSES.length);
    });

    test('boss count matches CLAUDE.md', () => {
        expect(bossRow, 'CLAUDE.md is missing the "Bosses (N)" row').not.toBeNull();
        expect(BOSSES.length, 'update "Bosses" in CLAUDE.md').toBe(Number(bossRow![1]));
    });

    test('PowerPlay and charm ids are unique', () => {
        expect(new Set(POWER_PLAYS_LIST.map(p => p.id)).size).toBe(POWER_PLAYS_LIST.length);
        expect(new Set(CHARMS_LIST.map(c => c.id)).size).toBe(CHARMS_LIST.length);
    });
});
