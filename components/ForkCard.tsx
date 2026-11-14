import React, { useEffect } from 'react';
import { soundService } from '../services/soundService';
import { FORK, HOLD_SLOT } from '../config/gameplay';

// Fork in the Road (v7.43): at the start of a new tier the highway splits. Easy Street slows the
// clock a little; the Danger Zone speeds it up and pays more on every word. The choice lasts until
// the next fork (or the end of the run after the last one).
export type Route = 'easy' | 'danger';
const pct = (factor: number) => Math.round(Math.abs(factor - 1) * 100);

const ForkCard: React.FC<{ level: number; onPick: (route: Route) => void }> = ({ level, onPick }) => {
  useEffect(() => { soundService.playPowerUp(); }, []);
  const next = FORK.levels.find(l => l > level);
  return (
    <div className="absolute inset-0 bg-crt-950/90 backdrop-blur-sm flex items-center justify-center z-50 p-3 animate-fade-in" role="dialog" aria-modal="true" aria-label="Fork in the road: pick a route">
      <div className="bg-crt-900 border-4 border-neon-cyan shadow-[0_0_28px_rgba(61,245,255,0.45)] rounded-2xl px-4 py-5 max-w-md w-full flex flex-col items-center text-center gap-3 level-stage-in">
        <p className="osd-text text-lg tracking-[0.3em] text-neon-cyan">LEVEL {level} · CHECKPOINT</p>
        <h2 className="font-display text-2xl text-white leading-tight">🛣️ FORK IN THE ROAD</h2>
        <p className="text-slate-300 text-sm leading-snug">Pick a route. It lasts {next ? `until the next fork at level ${next}` : 'for the rest of the run'}.</p>
        <div className="grid grid-cols-2 gap-2 w-full">
          <button type="button" onClick={() => onPick('easy')} aria-label={`Easy Street: clock ${pct(FORK.easy.clock)}% slower, normal points`}
            className="rounded-xl p-3 ring-2 ring-neon-green bg-neon-green/10 hover:bg-neon-green/20 flex flex-col items-center gap-1 outline-none focus-visible:ring-white">
            <span className="text-4xl leading-none" aria-hidden="true">🌴</span>
            <span className="font-display text-base text-neon-green leading-tight">EASY STREET</span>
            <span className="osd-text text-lg text-white leading-tight">CLOCK {pct(FORK.easy.clock)}% SLOWER</span>
            <span className="osd-text text-lg text-slate-300 leading-tight">NORMAL POINTS</span>
          </button>
          <button type="button" onClick={() => onPick('danger')} aria-label={`Danger Zone: clock ${pct(FORK.danger.clock)}% faster, points times ${FORK.danger.points}`}
            className="rounded-xl p-3 ring-2 ring-neon-red bg-neon-red/10 hover:bg-neon-red/20 flex flex-col items-center gap-1 outline-none focus-visible:ring-white">
            <span className="text-4xl leading-none" aria-hidden="true">🔥</span>
            <span className="font-display text-base text-neon-red leading-tight">DANGER ZONE</span>
            <span className="osd-text text-lg text-white leading-tight">CLOCK {pct(FORK.danger.clock)}% FASTER</span>
            <span className="osd-text text-lg text-neon-yellow leading-tight">EVERY WORD x{FORK.danger.points}</span>
          </button>
        </div>
        {level === HOLD_SLOT.fromLevel && (
          <p className="text-sm text-slate-200 leading-snug rounded-lg ring-1 ring-neon-purple/60 bg-neon-purple/10 px-3 py-2">
            <strong className="text-neon-purple">🧲 NEW: THE HOLD SLOT.</strong> Tap HOLD above your tiles, then tap a tile to park it. It survives new hands and shuffles until you tap it back.
          </p>
        )}
        <p className="text-xs text-slate-500">You can't skip this one. Choose wisely.</p>
      </div>
    </div>
  );
};

export default ForkCard;
