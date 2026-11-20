import React, { useEffect, useRef, useState } from 'react';
import { FORK } from '../config/gameplay';

/**
 * The route chip above the hand (v7.43). v7.59.0: in the Danger Zone it's a button: hold it to cool
 * off to Easy Street until the next fork. Holding (not tapping) so a stray tap can't spend it, like
 * Shuffle. It fills while held, and pulses with a nudge when the clock runs low.
 */
const DangerChip: React.FC<{ route: { choice: 'easy' | 'danger'; bailed?: boolean }; clock: number; wordsLeft?: number | null; onBail?: () => void }> = ({ route, clock, wordsLeft = null, onBail }) => {
  // v7.61.4: how long the route lasts, so the stretch feels finite.
  const left = wordsLeft == null ? 'REST OF RUN' : `${wordsLeft} WORD${wordsLeft === 1 ? '' : 'S'} LEFT`;
  const [holding, setHolding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stop = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; setHolding(false); };
  useEffect(() => stop, []);

  if (route.choice !== 'danger') {
    return (
      <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-white whitespace-nowrap ring-1 ring-neon-green/70 bg-neon-green/10" data-testid="route-chip"
        aria-label={`Easy Street: clock slower. ${wordsLeft == null ? 'For the rest of the run.' : `${wordsLeft} words until the next fork.`}`}>
        <span aria-hidden="true">🌴</span>EASY STREET{route.bailed ? ' · COOLED OFF' : ''}<span className="osd-text text-sm leading-none text-slate-300">· {left}</span>
      </span>
    );
  }
  const low = clock <= FORK.lowClockNudge;
  const start = (e: React.PointerEvent) => {
    e.preventDefault();
    setHolding(true);
    timer.current = setTimeout(() => { timer.current = null; setHolding(false); onBail?.(); }, FORK.bailHoldMs);
  };
  return (
    <button type="button" onPointerDown={start} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop}
      onContextMenu={e => e.preventDefault()}
      data-testid="route-chip"
      aria-label={`Danger Zone: every word times ${FORK.danger.points}, clock faster. ${wordsLeft == null ? 'For the rest of the run.' : `${wordsLeft} words until the next fork.`} Press and hold to cool off to Easy Street, with no way back in.`}
      className={`relative overflow-hidden flex flex-col items-center rounded-xl px-3 py-1 text-xs text-white whitespace-nowrap ring-2 ring-neon-red bg-neon-red/20 select-none touch-none ${low && !holding ? 'animate-pulse' : ''}`}>
      {holding && <span className="absolute inset-y-0 left-0 bg-neon-green/40 arm-fill" style={{ animationDuration: `${FORK.bailHoldMs}ms` }} aria-hidden="true" />}
      <span className="relative flex items-center gap-1">
        <span aria-hidden="true">🔥</span>DANGER x{FORK.danger.points}
        <span className="osd-text text-sm leading-none text-slate-300">· {left}</span>
      </span>
      <span className={`relative osd-text text-sm leading-none ${low ? 'text-neon-yellow' : 'text-slate-300'}`}>{low ? 'LOW CLOCK? HOLD TO COOL OFF' : 'HOLD TO COOL OFF (NO WAY BACK)'}</span>
    </button>
  );
};

export default DangerChip;
