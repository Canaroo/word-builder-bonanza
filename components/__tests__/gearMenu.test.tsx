// @vitest-environment jsdom
// v7.71.0: the Gear menu shows everything the run carries and explains what you tap.
import { describe, test, expect, vi, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import GearMenu, { earnedThisRun } from '../GearMenu';
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
