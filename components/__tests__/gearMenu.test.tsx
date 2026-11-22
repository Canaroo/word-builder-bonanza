// @vitest-environment jsdom
// v7.71.0: the Gear menu shows everything the run carries and explains what you tap.
import { describe, test, expect, vi, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import GearMenu, { earnedThisRun, lineIsFrom } from '../GearMenu';
import { calculateScore } from '../../services/gameUtils';
import { CHARMS_LIST } from '../../data/charms';
import { POWER_PLAYS_LIST } from '../../data/powerPlays';
import { screenInitialState } from '../../services/screens/GameScreen';
import type { GameState } from '../../types';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | null = null; let host: HTMLDivElement;
afterEach(() => { act(() => root?.unmount()); host?.remove(); root = null; });
const charm = (id: string) => CHARMS_LIST.find(c => c.id === id)!;
const pp = (id: string) => POWER_PLAYS_LIST.find(p => p.id === id)!;
const word = (bonuses: { name: string; description: string }[]) => ({ type: 'word', status: 'valid', word: 'CAT', score: 10, bonuses } as any);

describe('Gear menu (v7.71.0)', () => {
    test('earnings per charm come from its score lines in the log', () => {
        const log = [word([{ name: 'Stonks', description: '+40 pts' }, { name: 'Crystal Ball', description: '+5s on your clock' }]),
            word([{ name: 'Stonks', description: '+1,200 pts' }, { name: '🥊 Glass Joe', description: '+300 pts (x2 whole word)' }])];
        expect(earnedThisRun(log, 'Stonks')).toEqual({ points: 1240, seconds: 0 });
        expect(earnedThisRun(log, 'Crystal Ball')).toEqual({ points: 0, seconds: 5 });
        expect(earnedThisRun(log, 'Glass Joe').points).toBe(300);
    });
    test('lines that add detail after the name count too (v7.72.3: Last Action Hero showed nothing)', () => {
        const log = [word([{ name: 'Last Action Hero (E)', description: '+15 pts' }, { name: 'Golden Ticket!', description: '+50 pts' }]),
            word([{ name: 'Last Action Hero (S)', description: '+15 pts' }, { name: '⏳ Sands of Time! +5s next round', description: '+5s next round' }])];
        expect(earnedThisRun(log, 'Last Action Hero').points).toBe(30);
        expect(earnedThisRun(log, 'Golden Ticket').points).toBe(50);
        expect(earnedThisRun(log, 'Sands of Time').seconds).toBe(5);
    });
    test("no charm's lines are counted for another charm", () => {
        for (const a of CHARMS_LIST) for (const b of CHARMS_LIST) {
            if (a.id !== b.id && lineIsFrom(a.name, b.name)) throw new Error(`${a.name} would count as ${b.name}`);
        }
    });
    test('a real Last Action Hero word pays +15 on its last tile and shows in Gear', () => {
        const gs = { ...screenInitialState.gameState, activeCharms: [charm('finisher')] } as GameState;
        const tiles = 'CAT'.split('').map((letter, i) => ({ id: `t${i}`, letter, points: letter === 'C' ? 3 : 1 }));
        const without = calculateScore('CAT', tiles as any, { ...gs, activeCharms: [] } as GameState);
        const withIt = calculateScore('CAT', tiles as any, gs);
        expect(withIt.totalScore - without.totalScore).toBeGreaterThanOrEqual(15);
        expect(earnedThisRun([word(withIt.bonuses)], 'Last Action Hero').points).toBe(15);
    });
    test('lists charms, the pocket, running effects and sets; tapping explains; USE fires the PowerPlay', () => {
        const gs = { ...screenInitialState.gameState, activeCharms: [charm('stonks'), charm('pivot')], activeBuffs: [charm('stonks'), charm('pivot'), pp('konamiCode')],
            availablePowerPlays: [pp('plinko')], activePowerPlays: { konamiCode: { words: 2 } }, log: [word([{ name: 'Stonks', description: '+80 pts' }])] } as GameState;
        const onUse = vi.fn();
        host = document.createElement('div'); document.body.appendChild(host);
        act(() => { root = createRoot(host); root.render(<GearMenu gameState={gs} level={3} strikesLeft={2} maxStrikes={3} progressFor={() => ''} onUse={onUse} onClose={() => {}} />); });
        const text = host.textContent!;
        for (const s of ['Stonks', 'PIVOT!', 'Plinko', 'Konami Code', 'Central Perk', '+80', 'Strikes left']) expect(text).toContain(s);
        const stonks = [...host.querySelectorAll('button')].find(b => b.textContent?.includes('Stonks'))!;
        act(() => stonks.click());
        expect(host.querySelector('[data-testid="gear-description"]')!.textContent).toContain('This run: +80 points');
        act(() => ([...host.querySelectorAll('button')].find(b => b.textContent?.includes('USE')) as HTMLButtonElement).click());
        expect(onUse).toHaveBeenCalledWith(expect.objectContaining({ id: 'plinko' }));
    });
});
