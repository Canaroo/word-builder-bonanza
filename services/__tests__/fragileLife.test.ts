// @vitest-environment jsdom
// v7.87.0: fragile charms break after FRAGILE.lifeWords valid words (as well as on any strike).
import { describe, test, expect } from 'vitest';
import { wearFragile, createInitialGameState } from '../screens/GameScreen';
import { CHARMS_LIST } from '../../data/charms';
import { FRAGILE } from '../../config/gameplay';
import type { GameState } from '../../types';

const charm = (id: string) => CHARMS_LIST.find(c => c.id === id)!;
const start = (ids: string[]): GameState => ({ ...createInitialGameState(), score: 1000, activeCharms: ids.map(charm), fragileWords: Object.fromEntries(ids.map(id => [id, 0])) });

describe('fragile charms wear out', () => {
    test('a fragile charm lasts exactly FRAGILE.lifeWords words, warns on its last, then breaks for the run', () => {
        let gs = start(['glassJoe', 'stonks']);
        const warnings: (string | null)[] = [];
        for (let i = 1; i < FRAGILE.lifeWords; i++) {
            const r = wearFragile(gs);
            expect(r.card).toBeNull();
            warnings.push(r.warning);
            gs = r.gameState;
            expect(gs.activeCharms.map(c => c.id)).toContain('glassJoe');
        }
        expect(warnings.slice(0, -1).every(w => w === null)).toBe(true);
        expect(warnings[warnings.length - 1]).toMatch(/Glass Joe: LAST WORD/);
        const r = wearFragile(gs);
        expect(r.card?.data?.headline).toBe('💥 GLASS JOE BROKE');
        expect(r.gameState.activeCharms.map(c => c.id)).toEqual(['stonks']);
        expect(r.gameState.shatteredCharms).toContain('glassJoe');
        expect((r.gameState.log.at(-1) as { name?: string })?.name).toBe('Fragile charm broke');
    });

    test('Hamm smashes himself and pays out when he wears out', () => {
        const gs: GameState = { ...start(['hammPiggyBank']), fragileWords: { hammPiggyBank: FRAGILE.lifeWords - 1 }, piggyBank: 640 };
        const r = wearFragile(gs);
        expect(r.gameState.score).toBe(1640);
        expect(r.gameState.piggyBank).toBe(0);
        expect(r.card?.content).toMatch(/\+640 points/);
    });

    test('charms that are not fragile are untouched', () => {
        const gs = start(['stonks']);
        expect(wearFragile(gs)).toEqual({ gameState: gs, card: null, warning: null });
    });

    test('Major Award grows every word: 50, 75, 100, 125, 150', () => {
        const pays = [0, 1, 2, 3, 4].map(held => Math.min(FRAGILE.majorAwardMax, FRAGILE.majorAwardBase + FRAGILE.majorAwardStep * Math.floor(held / FRAGILE.majorAwardEvery)));
        expect(pays).toEqual([50, 75, 100, 125, 150]);
    });
});
