import React from 'react';
import { TRIFORCE } from '../config/gameplay';
import { TRIFORCE_IDS, TRIFORCE_PIECES, type TriforceId } from '../data/triforce';

// Fragile charms (v7.69.0): the Triforce as a picture you complete. Three triangles (Power on top,
// Wisdom bottom left, Courage bottom right), each cut into 3 shards that meet in its middle. A
// collected shard turns gold; a finished piece glows in its color. `next` blinks the shard an offer
// would add, so the offer card shows where it goes.
const TRI: Record<TriforceId, [number, number][]> = {
  power: [[50, 0], [25, 43.3], [75, 43.3]],
  wisdom: [[25, 43.3], [0, 86.6], [50, 86.6]],
  courage: [[75, 43.3], [50, 86.6], [100, 86.6]],
};
const pts = (p: [number, number][]) => p.map(([x, y]) => `${x},${y}`).join(' ');

const TriforceEmblem: React.FC<{ triforce?: Partial<Record<TriforceId, number>>; next?: TriforceId; size?: number; className?: string }> = ({ triforce = {}, next, size = 56, className = '' }) => (
  <svg viewBox="-3 -3 106 93" width={size} height={size * 0.88} className={className} aria-hidden="true">
    {TRIFORCE_IDS.map(id => {
      const [a, b, c] = TRI[id];
      const mid: [number, number] = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3];
      const shards: [number, number][][] = [[a, b, mid], [b, c, mid], [c, a, mid]];
      const have = Math.min(TRIFORCE.shards, triforce[id] ?? 0);
      const done = have >= TRIFORCE.shards;
      const piece = TRIFORCE_PIECES[id];
      return (
        <g key={id} style={done ? { filter: `drop-shadow(0 0 4px ${piece.glow})` } : undefined}>
          {shards.map((s, i) => {
            const filled = i < have;
            const blink = next === id && i === have;
            return (
              <polygon key={i} points={pts(s)}
                fill={filled ? (done ? piece.color : '#ffd84d') : blink ? '#ffd84d' : 'rgba(255,255,255,0.06)'}
                stroke={done ? '#fff7cc' : filled ? '#b8860b' : 'rgba(255,255,255,0.35)'} strokeWidth={1.2} strokeLinejoin="round"
                className={blink ? 'animate-pulse' : undefined} opacity={blink ? 0.85 : 1} />
            );
          })}
        </g>
      );
    })}
  </svg>
);

export default TriforceEmblem;
