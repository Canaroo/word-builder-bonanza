// @vitest-environment jsdom
// v7.91.1: the power word hint lights its tiles; the glow wins over a boss rule dimming the same tile,
// and a combo tile (ING) lights as one tile.
import { describe, test, expect, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import TileComponent from '../Tile';
import { assignTilesToWord } from '../../services/rackMatch';

let root: Root | null = null; let host: HTMLDivElement | null = null;
afterEach(() => { act(() => root?.unmount()); host?.remove(); root = null; host = null; });
const render = (el: React.ReactElement) => { host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); act(() => root!.render(el)); return host.querySelector('button')!; };

describe('power word tiles', () => {
  test('a lit tile glows gold even when a boss rule would dim it', () => {
    const btn = render(<TileComponent tile={{ id: 't1', letter: 'S', points: 1 }} onClick={() => {}} packTileClass="" powerLit bossHint="dim" />);
    expect(btn.className).toContain('power-tile-glow');
    expect(btn.className).not.toContain('boss-tile-dim');
  });
  test('RINGS from R, ING, S lights all three tiles', () => {
    const letters = ['R', 'X', 'ING', 'S', 'B'];
    const picked = assignTilesToWord('RINGS', letters)!;
    expect(picked.map(i => letters[i]).sort()).toEqual(['ING', 'R', 'S']);
  });
});
