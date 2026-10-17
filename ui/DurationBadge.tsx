// ui/DurationBadge.tsx
import React from 'react';
import type { DurationTag } from '../types';

const textFor = (tag: DurationTag) =>
  tag === 'PERSISTENT' ? 'Persistent' :
  tag === 'ONE_TIME'   ? 'One-Time'   :
  tag === 'LIMITED'    ? 'Limited'    : '';

const colorFor = (tag: DurationTag) =>
  tag === 'PERSISTENT' ? 'border-green-400 text-green-300 bg-green-400/10' :
  tag === 'ONE_TIME'   ? 'border-blue-400 text-blue-300 bg-blue-400/10'   :
  tag === 'LIMITED'    ? 'border-amber-400 text-amber-300 bg-amber-400/10' :
                         'border-slate-500 text-slate-300';

export default function DurationBadge({ tag }: { tag: DurationTag }) {
  if (!tag) return null;
  return (
    <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${colorFor(tag)}`}>
      {textFor(tag)}
    </span>
  );
}
