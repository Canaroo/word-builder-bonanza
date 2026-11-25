// @vitest-environment jsdom
// v7.71.0: the Gear menu shows everything the run carries and explains what you tap.
import { CHARM_BONUS } from '../../config/gameplay';
import { describe, test, expect, vi, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import GearMenu, { earnedThisRun, lineIsFrom, earnedLabel, paysDirectly } from '../GearMenu';
import { gameReducer } from '../../services/screens/GameScreen';
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
        expect(earnedThisRun(log, 'Stonks')).toMatchObject({ points: 1240, seconds: 0 });
        expect(earnedThisRun(log, 'Crystal Ball')).toMatchObject({ points: 0, seconds: 5 });
        expect(earnedThisRun(log, 'Glass Joe').points).toBe(300);
    });
    test('lines that add detail after the name count too (v7.72.3: Last Action Hero showed nothing)', () => {
        const log = [word([{ name: 'Last Action Hero (E)', description: '+15 pts' }, { name: 'Golden Ticket!', description: '+50 pts' }]),
            word([{ name: 'Last Action Hero (S)', description: '+15 pts' }, { name: '⏳ Sands of Time! +5s next round', description: '+5s next round' }])];
        expect(earnedThisRun(log, 'Last Action Hero').points).toBe(30);
        expect(earnedThisRun(log, 'Golden Ticket').points).toBe(50);
        expect(earnedThisRun(log, 'Sands of Time').seconds).toBe(5);
    });
    test('v7.72.4: payouts logged as events count, losses show, multipliers count words, nothing twice', () => {
        const ev = (name: string, scoreChange: number, description: string, id = `x-${name}`) => ({ type: 'event', id, name, description, scoreChange, cumulativeScore: 0 } as any);
        const log = [
            ev('Double Dare', 250, 'Challenge taken: +250 points.'),
            ev('CTU Safe House', 0, 'CTU pulled you out with 7s left: +15s.'),
            ev('Tick-Tock Croc', 0, 'The croc coughed up +10s.'), ev('Tick-Tock Croc', -300, 'The croc bit 300 points.'),
            ev('Bean Counter', 150, 'Total score hit a multiple of 500!', 'charm-beanCounter-1'),
            word([{ name: 'Bean Counter', description: '+150 pts' }, { name: 'Hammer Time', description: '-10 pts' },
                { name: 'S Club Party', description: 'x2 Word Score' }, { name: 'Mario Kart', description: '+900 pts (National Treasure)' }]),
            word([{ name: "Dr. Strange's Loop", description: "Dr. Strange's Loop: x2 Score" }]),
        ];
        expect(earnedThisRun(log, 'Double Dare').points).toBe(250);
        expect(earnedThisRun(log, 'CTU Safe House').seconds).toBe(15);
        expect(earnedLabel(earnedThisRun(log, 'Tick-Tock Croc'))).toBe('+10s · -300');
        expect(earnedThisRun(log, 'Bean Counter').points).toBe(150);
        expect(earnedThisRun(log, 'Hammer Time').points).toBe(-10);
        expect(earnedLabel(earnedThisRun(log, 'S Club Party'))).toBe('x2 ON 1 WORD');
        expect(earnedThisRun(log, 'Dr. Strange’s Loop').boosts).toBe(1);
        expect(earnedThisRun(log, 'National Treasure').points).toBe(450); // x2: half of 900 is its share
    });
    test('Wile E. Coyote logs its refund, so Gear can show it', () => {
        const gs = { ...screenInitialState.gameState, activeCharms: [charm('wileECoyote')], strikes: 0, score: 100 } as GameState;
        const next = gameReducer({ ...screenInitialState, time: 30, gameState: gs } as any, { type: 'ADD_STRIKE' });
        expect(next.gameState.strikes).toBe(1);
        expect(earnedThisRun(next.gameState.log, 'Wile E. Coyote').points).toBeGreaterThan(0);
        expect(earnedThisRun(next.gameState.log, 'Wile E. Coyote').seconds).toBeGreaterThan(0);
    });
    test("Keymaster's flat bonus gets its own log entry; the gate keeps its listed points", () => {
        const gs = { ...screenInitialState.gameState, activeCharms: [charm('keymaster')], score: 10000 } as GameState;
        const next = gameReducer({ ...screenInitialState, gameState: gs } as any, { type: 'APPLY_MINIGAME', payload: { name: 'The 10,000 Gate', icon: '🔐', points: 1000, headline: '+1,000', detail: 'x', flat: true } } as any);
        expect(next.gameState.score).toBe(11000 + CHARM_BONUS.keymaster);
        expect(earnedThisRun(next.gameState.log, 'Are You the Keymaster?').points).toBe(CHARM_BONUS.keymaster);
        expect(next.gameState.log.at(-2)).toMatchObject({ name: 'The 10,000 Gate', scoreChange: 1000, cumulativeScore: 11000 });
    });
    test('every charm either has a running total in Gear or is listed as changing the rules', () => {
        const RULES_ONLY = ['strikeBank', 'lTrainShuffle', 'diceRollProtocol', 'pivot', 'finalFrontier', 'phoenixDown', 'holdThatThought',
            'imAlwaysHere', 'happyLittleAccidents', 'turboButton', 'littleMac', 'wheresWaldo', 'shineBright'];
        expect(CHARMS_LIST.filter(c => !paysDirectly(c)).map(c => c.id).sort()).toEqual([...RULES_ONLY].sort());
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
