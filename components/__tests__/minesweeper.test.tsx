// @vitest-environment jsdom
// Minesweeper: banking reveals where the mine was before paying out (v7.28.4).
import { describe, test, expect, vi, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import GambleCard, { type GambleResult } from '../GambleCard';
import { POWER_PLAY_VALUES as V } from '../../config/gameplay';
import { minesweeperPot } from '../../services/rules';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => vi.restoreAllMocks());

const render = () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // the mine goes under the last square
    const onResolve = vi.fn<(r: GambleResult) => void>();
    const el = document.createElement('div');
    act(() => createRoot(el).render(<GambleCard id="minesweeper" icon="💣" name="Minesweeper" onResolve={onResolve} />));
    const square = (n: number) => el.querySelector(`[aria-label^="Square ${n}"]`) as HTMLButtonElement;
    const button = (text: string) => [...el.querySelectorAll('button')].find(b => b.textContent?.includes(text)) as HTMLButtonElement;
    return { el, onResolve, square, button };
};

describe('Minesweeper reveal', () => {
    test('banking shows the mine and the odds, and pays only when the player takes it', () => {
        const { el, onResolve, square, button } = render();
        act(() => square(1).click());
        act(() => square(2).click());
        act(() => button('Stop and bank').click());
        expect(onResolve).not.toHaveBeenCalled();
        expect(el.querySelector(`[aria-label="Square ${V.minesweeperSquares}, the mine"]`)?.textContent).toBe('💣');
        expect(el.textContent).toContain(`square ${V.minesweeperSquares}`);
        expect(el.textContent).toContain(`1 in ${V.minesweeperSquares - 2}`);
        expect(el.querySelectorAll('[aria-label$=", was safe"]')).toHaveLength(V.minesweeperSquares - 3);
        act(() => square(3).click()); // the board is locked after banking
        expect(onResolve).not.toHaveBeenCalled();
        act(() => button('Take the').click());
        expect(onResolve).toHaveBeenCalledWith(expect.objectContaining({ points: minesweeperPot(2), tone: 'win' }));
    });

    test('hitting the mine still ends it at once', () => {
        const { onResolve, square } = render();
        act(() => square(V.minesweeperSquares).click());
        expect(onResolve).toHaveBeenCalledWith(expect.objectContaining({ points: 0, tone: 'lose' }));
    });
});
