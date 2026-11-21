// @vitest-environment jsdom
// v7.67.5: ending a run takes two confirmations, and the second one can't be tapped straight away.
import { describe, test, expect, vi, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import EndRunCard, { END_RUN_SECOND_STEP_MS } from '../EndRunCard';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | null = null; let host: HTMLDivElement;
afterEach(() => { act(() => root?.unmount()); host?.remove(); root = null; vi.useRealTimers(); });
const button = (re: RegExp) => [...host.querySelectorAll('button')].find(b => re.test(b.textContent ?? '')) as HTMLButtonElement;

describe('End run card (v7.67.5)', () => {
    test('two steps; the final button wakes up after a moment', () => {
        vi.useFakeTimers();
        const onConfirm = vi.fn(), onCancel = vi.fn();
        host = document.createElement('div'); document.body.appendChild(host);
        act(() => { root = createRoot(host); root.render(<EndRunCard summary="1,200 pts, level 3" onCancel={onCancel} onConfirm={onConfirm} />); });
        expect(host.textContent).toContain('1,200 pts, level 3');
        act(() => button(/^End this run$/).click());
        expect(onConfirm).not.toHaveBeenCalled();
        // A fast second tap does nothing: the button is still asleep.
        act(() => button(/Wait|end it for good/).click());
        expect(onConfirm).not.toHaveBeenCalled();
        act(() => { vi.advanceTimersByTime(END_RUN_SECOND_STEP_MS + 50); });
        act(() => button(/end it for good/).click());
        expect(onConfirm).toHaveBeenCalledTimes(1);
    });
    test('either step can back out', () => {
        const onConfirm = vi.fn(), onCancel = vi.fn();
        host = document.createElement('div'); document.body.appendChild(host);
        act(() => { root = createRoot(host); root.render(<EndRunCard onCancel={onCancel} onConfirm={onConfirm} />); });
        act(() => button(/Keep playing/).click());
        act(() => button(/^End this run$/).click());
        act(() => button(/keep my run/).click());
        expect(onCancel).toHaveBeenCalledTimes(2);
        expect(onConfirm).not.toHaveBeenCalled();
    });
});
