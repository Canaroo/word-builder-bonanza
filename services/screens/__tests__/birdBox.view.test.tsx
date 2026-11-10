// @vitest-environment jsdom
// Bird Box: new tiles peek for a few seconds, then flip face down. Tapping a tile into the word
// (or one coming back) must not flip the rest face up again (v7.32.4).
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { GameScreenView, type GameScreenViewProps } from '../GameScreenView';
import { screenInitialState } from '../GameScreen';
import { POWER_PLAY_VALUES } from '../../../config/gameplay';
import type { Tile } from '../../../types';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const noop = () => {};
const tiles: Tile[] = 'WORDNERD'.split('').map((letter, i) => ({ id: `t${i}`, letter, points: 1 }));

const props = (hand: (Tile | null)[], birdBox: boolean): GameScreenViewProps => {
  const p: any = {
    ...(screenInitialState as any),
    gameState: { ...screenInitialState.gameState, activePowerPlays: birdBox ? { birdBox: true } : {} },
    time: 40, hand: [...hand, null, null], buildRow: Array(8).fill(null), isPaused: false, isLoading: false,
    modalContent: null, tilesToSwap: [], tileToTransform: null, wordFromBuildRow: '', totalWords: 0, potentialScore: 0,
    maxStrikes: 3, challengeButtonText: 'Challenge', tileClass: 'tile-arcade', isMuted: false, isChallengeLock: false,
    highlightedTileIds: { first: null, rest: [] }, isStrikeChallenge: false, strikesRemaining: 3, dispatch: noop,
  };
  return new Proxy(p, { get: (t, k) => (k in t ? t[k] : typeof k === 'string' && (k.startsWith('handle') || k === 'showBuffInfo') ? noop : undefined) });
};

let el: HTMLDivElement; let root: Root;
const render = (hand: (Tile | null)[], birdBox: boolean) => act(() => { root.render(<GameScreenView {...props(hand, birdBox)} />); });
const faceDown = () => el.querySelectorAll('[aria-label="Tile, face down"]').length;
const wait = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

beforeEach(() => { vi.useFakeTimers(); el = document.createElement('div'); document.body.appendChild(el); root = createRoot(el); });
afterEach(() => { act(() => root.unmount()); el.remove(); vi.useRealTimers(); });

describe('Bird Box', () => {
  test('peeks when it starts, then every tile stays face down as tiles are tapped and returned', () => {
    render(tiles, false);
    expect(faceDown()).toBe(0);
    render(tiles, true);
    expect(faceDown()).toBe(0); // the peek
    wait(POWER_PLAY_VALUES.birdBoxSeconds * 1000 + 50);
    expect(faceDown()).toBe(8);
    // Tap one into the word: the other 7 stay hidden.
    const tapped = [null, ...tiles.slice(1)];
    render(tapped, true);
    expect(faceDown()).toBe(7);
    wait(5000);
    expect(faceDown()).toBe(7);
    // It comes back to the hand: still hidden.
    render(tiles, true);
    expect(faceDown()).toBe(8);
  });

  test('a tap during the peek does not keep the tiles face up', () => {
    render(tiles, false);
    render(tiles, true);
    wait(1000);
    render([null, ...tiles.slice(1)], true);
    wait(POWER_PLAY_VALUES.birdBoxSeconds * 1000);
    expect(faceDown()).toBe(7);
  });

  test('new tiles (a fresh deal) get their own peek', () => {
    render(tiles, false);
    render(tiles, true);
    wait(POWER_PLAY_VALUES.birdBoxSeconds * 1000 + 50);
    const fresh = tiles.map((t, i) => ({ ...t, id: `n${i}` }));
    render(fresh, true);
    expect(faceDown()).toBe(0);
    wait(POWER_PLAY_VALUES.birdBoxSeconds * 1000 + 50);
    expect(faceDown()).toBe(8);
  });

  test('resuming a saved run that is already blind does not peek', () => {
    render(tiles, true);
    expect(faceDown()).toBe(8);
  });
});
