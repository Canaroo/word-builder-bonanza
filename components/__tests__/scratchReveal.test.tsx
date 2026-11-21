// @vitest-environment jsdom
// v7.67.3 (the owner's ask): after a bank (or a bust), every square still covered turns over, so the
// player sees what they passed up; the prize is paid only on "Take".
import { describe, test, expect, vi, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import ScratchCard from '../ScratchCard';
import type { ScratchPrize } from '../../services/scratch';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const squares: ScratchPrize[] = [
  { kind: 'points', amount: 100 }, { kind: 'time', amount: 10 }, { kind: 'skull' },
  { kind: 'shuffle', amount: 2 }, { kind: 'points', amount: 300 }, { kind: 'challenge', amount: 1 },
  { kind: 'time', amount: 5 }, { kind: 'skull' }, { kind: 'points', amount: 200 },
];
let root: Root | null = null; let host: HTMLDivElement;
const mount = (el: React.ReactElement) => { host = document.createElement('div'); document.body.appendChild(host); act(() => { root = createRoot(host); root.render(el); }); };
afterEach(() => { act(() => root?.unmount()); host?.remove(); root = null; });
const tiles = () => [...host.querySelectorAll('[data-testid="scratch-square"]')] as HTMLButtonElement[];
const button = (re: RegExp) => [...host.querySelectorAll('button')].find(b => re.test(b.textContent ?? ''))!;

describe('scratch-off reveal (v7.67.3)', () => {
  test('banking turns the rest of the card over; Take pays the banked prize', () => {
    const onDone = vi.fn(); const onSave = vi.fn();
    mount(<ScratchCard level={1} squares={squares} onSave={onSave} onDone={onDone} />);
    act(() => tiles()[0].click());
    expect(tiles().filter(t => /^Scratch square/.test(t.getAttribute('aria-label')!))).toHaveLength(8);
    act(() => button(/Bank it/).click());
    expect(onDone).not.toHaveBeenCalled();
    expect(onSave).toHaveBeenCalledWith('banked', true);
    const labels = tiles().map(t => t.getAttribute('aria-label'));
    expect(labels.filter(l => /not scratched/.test(l!))).toHaveLength(8);
    expect(host.textContent).toContain('MISSED');
    expect(host.textContent).toContain('DODGED');
    expect(tiles().every(t => t.disabled)).toBe(true);
    act(() => button(/^Take/).click());
    expect(onDone).toHaveBeenCalledWith(squares[0]);
  });
  test('a bust turns the rest over too; a saved bank comes back revealed', () => {
    mount(<ScratchCard level={1} squares={squares} saved={{ opened: [0, 2] }} onDone={() => {}} />);
    expect(tiles().filter(t => /not scratched/.test(t.getAttribute('aria-label')!))).toHaveLength(7);
    act(() => root!.unmount()); host.remove();
    mount(<ScratchCard level={1} squares={squares} saved={{ opened: [4], banked: true }} onDone={() => {}} />);
    expect(host.textContent).toContain('YOU BANKED');
    expect(button(/^Take/)).toBeTruthy();
  });
    test('a turned-over charm or PowerPlay can be tapped to read it (v7.67.4)', async () => {
        const { CHARMS_LIST } = await import('../../data/charms');
        const deal: ScratchPrize[] = [{ kind: 'charm', id: 'stonks' }, { kind: 'powerplay', id: 'plinko' }, ...squares.slice(2)];
        const onDone = vi.fn();
        mount(<ScratchCard level={1} squares={deal} onDone={onDone} />);
        act(() => tiles()[0].click());          // scratch: the charm turns over
        expect(host.querySelector('[data-testid="scratch-info"]')).toBeNull();
        expect(tiles()[0].disabled).toBe(false);
        act(() => tiles()[0].click());          // tap again: read it
        const info = host.querySelector('[data-testid="scratch-info"]')!;
        expect(info.textContent).toContain(CHARMS_LIST.find(c => c.id === 'stonks')!.name);
        expect(info.textContent).toContain('CHARM');
        expect(tiles().filter(t => /not scratched|^Square/.test(t.getAttribute('aria-label')!))).toHaveLength(1); // reading didn't scratch anything
        act(() => tiles()[0].click());          // tap again: close it
        expect(host.querySelector('[data-testid="scratch-info"]')).toBeNull();
        // After a bank, a missed PowerPlay can be read too.
        act(() => button(/Bank it/).click());
        act(() => tiles()[1].click());
        expect(host.querySelector('[data-testid="scratch-info"]')!.textContent).toContain('POWERPLAY');
        expect(onDone).not.toHaveBeenCalled();
    });
});
