// @vitest-environment jsdom
import { describe, test, expect, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import ErrorBoundary from '../ErrorBoundary';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as any).__APP_VERSION__ = 'test';

const Boom = () => { throw new Error('kaboom'); };

describe('ErrorBoundary', () => {
    test('shows a way back to the menu instead of a blank screen', () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const onRecover = vi.fn();
        const el = document.createElement('div');
        const root = createRoot(el);
        act(() => root.render(<ErrorBoundary onRecover={onRecover}><Boom /></ErrorBoundary>));
        expect(el.textContent).toContain('TRACKING ERROR');
        expect(el.textContent).toContain('kaboom');
        expect(JSON.parse(localStorage.getItem('wordNerdLastError')!).message).toBe('kaboom');
        const eject = [...el.querySelectorAll('button')].find(b => b.textContent?.includes('Eject'))!;
        act(() => eject.click());
        expect(onRecover).toHaveBeenCalled();
        act(() => root.unmount());
    });
});
