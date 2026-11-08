// @vitest-environment jsdom
// Card Sharks: banking turns over the next card before paying out (v7.28.5).
import { describe, test, expect, vi, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import GambleCard, { type GambleResult } from '../GambleCard';
import { cardSharksPot } from '../../services/rules';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => vi.restoreAllMocks());

/** Cards come from drawCard: 2 + floor(random * 13). */
const deal = (...cards: number[]) => {
    const rolls = cards.map(c => (c - 2 + 0.5) / 13);
    vi.spyOn(Math, 'random').mockImplementation(() => rolls.shift() ?? 0.5);
};
const render = () => {
    const onResolve = vi.fn<(r: GambleResult) => void>();
    const el = document.createElement('div');
    act(() => createRoot(el).render(<GambleCard id="cardSharks" icon="🃏" name="Card Sharks" onResolve={onResolve} />));
    const button = (text: string) => [...el.querySelectorAll('button')].find(b => b.textContent?.includes(text)) as HTMLButtonElement;
    return { el, onResolve, button };
};

describe('Card Sharks reveal', () => {
    test('banking shows the next card and which call would have won, then pays on Take', () => {
        deal(7, 10, 4); // start on 7, call higher (10), bank: the next card is a 4
        const { el, onResolve, button } = render();
        act(() => button('Higher').click());
        act(() => button('Stop and bank').click());
        expect(onResolve).not.toHaveBeenCalled();
        expect(el.querySelector('[aria-label="Next card: 4"]')).toBeTruthy();
        expect(el.textContent).toContain('LOWER would have been right');
        expect(button('Higher')).toBeUndefined(); // no more calls after banking
        act(() => button('Take the').click());
        expect(onResolve).toHaveBeenCalledWith(expect.objectContaining({ points: cardSharksPot(1), tone: 'win' }));
        expect(onResolve.mock.calls[0][0].detail).toContain('The next card was 4: LOWER would have been right.');
    });

    test('a tie on the revealed card says so', () => {
        deal(9, 3, 3);
        const { el, button } = render();
        act(() => button('Lower').click());
        act(() => button('Stop and bank').click());
        expect(el.textContent).toContain('a tie, so a free pass either way');
    });

    test('a wrong call still ends it at once', () => {
        deal(7, 3);
        const { onResolve, button } = render();
        act(() => button('Higher').click());
        expect(onResolve).toHaveBeenCalledWith(expect.objectContaining({ points: 0, tone: 'lose' }));
    });
});
