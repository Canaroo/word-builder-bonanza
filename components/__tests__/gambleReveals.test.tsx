// @vitest-environment jsdom
// Let's Make a Deal and No Whammies!: banking shows what would have happened next (v7.28.6).
import { describe, test, expect, vi, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import GambleCard, { type GambleResult } from '../GambleCard';
import { POWER_PLAY_VALUES as V } from '../../config/gameplay';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => vi.restoreAllMocks());

const render = (id: string) => {
    const onResolve = vi.fn<(r: GambleResult) => void>();
    const el = document.createElement('div');
    act(() => createRoot(el).render(<GambleCard id={id} icon="🎲" name={id} onResolve={onResolve} />));
    const button = (text: string) => [...el.querySelectorAll('button')].find(b => b.textContent?.includes(text)) as HTMLButtonElement;
    const byLabel = (label: string) => el.querySelector(`[aria-label="${label}"]`) as HTMLElement;
    return { el, onResolve, button, byLabel };
};

describe("Let's Make a Deal reveal", () => {
    test('walking away opens the next round of doors, then pays on Take', () => {
        // With random 0 the shuffle puts the prizes at [2nd, Zonk, 1st] each round.
        vi.spyOn(Math, 'random').mockReturnValue(0);
        const [a, b] = V.doorRounds[1];
        const { el, onResolve, button, byLabel } = render('letsMakeADeal');
        act(() => byLabel('Door 1').click()); // round 1 prize
        act(() => button('walk away').click());
        expect(onResolve).not.toHaveBeenCalled();
        expect(byLabel(`Door 1: +${b}`)).toBeTruthy();
        expect(byLabel('Door 2: Zonk')).toBeTruthy();
        expect(byLabel(`Door 3: +${a}`)).toBeTruthy();
        expect(el.textContent).toContain('The Zonk was behind door 2');
        act(() => button('Take the').click());
        expect(onResolve).toHaveBeenCalledWith(expect.objectContaining({ points: V.doorRounds[0][1], tone: 'win' }));
        expect(onResolve.mock.calls[0][0].detail).toContain(`Behind the doors: Door 1: +${b} · Door 2: Zonk · Door 3: +${a}.`);
    });
});

describe('No Whammies! board (v7.39.1)', () => {
    // Rolls in order: STOP rolls [whammy?, cash], then the square pick; banking rolls the same again.
    const rolls = (...r: number[]) => vi.spyOn(Math, 'random').mockImplementation(() => r.shift() ?? 0.5);
    const cash = (i: number) => V.whammyCash[i].points;
    test('a safe landing adds that square to the pot; banking shows a Whammy you dodged', () => {
        vi.useFakeTimers();
        rolls(0.99, 0, 0, 0, 0, 0); // safe, cheapest cash; then the reveal is a Whammy
        const { el, onResolve, button } = render('noWhammies');
        act(() => button('Spin the board').click());
        act(() => button('STOP').click());
        act(() => { vi.advanceTimersByTime(8000); });
        expect(el.textContent).toContain(String(cash(0)));
        act(() => button('Stop and bank').click());
        act(() => { vi.advanceTimersByTime(8000); });
        expect(el.textContent).toContain('Good call!');
        act(() => button('Take the').click());
        expect(onResolve).toHaveBeenCalledWith(expect.objectContaining({ points: cash(0), tone: 'win' }));
        vi.useRealTimers();
    });
    test('a Whammy wipes the pot', () => {
        vi.useFakeTimers();
        rolls(0, 0, 0);
        const { onResolve, button } = render('noWhammies');
        act(() => button('Spin the board').click());
        act(() => button('STOP').click());
        act(() => { vi.advanceTimersByTime(8000); });
        expect(onResolve).toHaveBeenCalledWith(expect.objectContaining({ points: 0, headline: 'WHAMMY!', tone: 'lose' }));
        vi.useRealTimers();
    });
    test('the cash squares average the same +150 a spin as before', () => {
        const avg = V.whammyCash.reduce((s, c) => s + c.points * c.chance, 0);
        expect(avg).toBeCloseTo(V.whammyPot, 5);
        expect(V.whammyCash.reduce((s, c) => s + c.chance, 0)).toBeCloseTo(1, 5);
    });
});

describe('Deal or No Deal reveal', () => {
    test('taking the deal opens your case, then pays the offer on Take', () => {
        const { el, onResolve, button } = render('dealOrNoDeal');
        const offer = Number(/OFFER: \+(\d+)/.exec(el.textContent ?? '')?.[1]);
        act(() => button('Deal').click());
        expect(onResolve).not.toHaveBeenCalled();
        const mine = Number(el.querySelector('[aria-label^="Your case: "]')?.getAttribute('aria-label')?.split(': ')[1]);
        expect(V.dealCases).toContain(mine);
        expect(el.textContent).toContain(`You took the Banker's ${offer}.`);
        expect(el.textContent).toMatch(offer > mine ? /beat your case/ : offer === mine ? /Dead even/ : /left \d+ on the table/);
        act(() => button('Take the').click());
        expect(onResolve).toHaveBeenCalledWith(expect.objectContaining({ points: offer }));
        expect(onResolve.mock.calls[0][0].detail).toContain(`Your case held ${mine}.`);
    });
});

describe('a resumed gamble card picks up where it was (v7.28.9)', () => {
    test('Card Sharks restores its card and pot instead of dealing fresh', () => {
        const onResolve = vi.fn<(r: GambleResult) => void>();
        const el = document.createElement('div');
        act(() => createRoot(el).render(<GambleCard id="cardSharks" icon="🃏" name="Card Sharks" onResolve={onResolve} saved={{ card: 14, right: 2, last: null, banked: null }} />));
        expect(el.querySelector('[aria-label="Card: A"]')).toBeTruthy();
        expect(el.textContent).toContain('POT: 125');
    });
    test('a fresh card saves its opening deal right away', () => {
        const onSave = vi.fn();
        const el = document.createElement('div');
        act(() => createRoot(el).render(<GambleCard id="dealOrNoDeal" icon="💼" name="Deal" onResolve={() => {}} onSave={onSave} />));
        expect(onSave).toHaveBeenCalledWith('game', expect.objectContaining({ mine: expect.any(Number) }));
    });
});
