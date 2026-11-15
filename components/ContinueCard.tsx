import React, { useEffect } from 'react';
import ArcadeButton from './ArcadeButton';
import { soundService } from '../services/soundService';
import { PHOENIX_DOWN } from '../config/progression';

// Phoenix Down: the run just ended and the player is holding the charm. It offers to keep the run
// going for Credits, once; "No thanks" (or too few Credits) ends the run as usual.
const ContinueCard: React.FC<{ reason: 'strikes' | 'time'; credits: number; onAnswer: (accept: boolean) => void }> = ({ reason, credits, onAnswer }) => {
  const canPay = credits >= PHOENIX_DOWN.cost;
  useEffect(() => { soundService.playPowerUp(); }, []);

  return (
    <div className="absolute inset-0 bg-crt-950/85 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" role="dialog" aria-modal="true" aria-label={`${PHOENIX_DOWN.name}: continue for ${PHOENIX_DOWN.cost} Credits?`}>
      <div className="bg-crt-900 border-4 border-neon-pink shadow-[0_0_28px_rgba(255,79,163,0.55)] rounded-2xl px-5 py-6 max-w-md w-full flex flex-col items-center text-center gap-2 level-stage-in">
        <p className="osd-text text-lg tracking-[0.3em] text-neon-red">{reason === 'strikes' ? 'STRUCK OUT' : "TIME'S UP"}</p>
        <p className="osd-text text-base tracking-[0.2em] text-slate-300">🍀 YOUR CHARM WAKES UP</p>
        <div className="text-6xl leading-none" aria-hidden="true">{PHOENIX_DOWN.icon}</div>
        <h2 className="font-display text-2xl text-neon-pink leading-tight">{PHOENIX_DOWN.name}</h2>
        <p className="font-display text-3xl text-neon-yellow leading-tight">CONTINUE?</p>
        <p className="text-slate-200 leading-snug">
          Rise from the ashes: your strikes are wiped and the clock comes back with {PHOENIX_DOWN.seconds} seconds. Your score, charms and level all stay.
        </p>
        <p className="text-sm text-slate-400 leading-snug">It works once and burns up. Say no and the run ends here.</p>
        <p className={`osd-text text-lg ${canPay ? 'text-neon-yellow' : 'text-neon-red'}`}>
          YOU HAVE 🪙 {credits.toLocaleString()}{canPay ? '' : ` · YOU NEED ${PHOENIX_DOWN.cost}`}
        </p>
        <ArcadeButton color="pink" className="w-full mt-1" disabled={!canPay} onClick={() => onAnswer(true)}>
          {canPay ? `▶ Continue · 🪙 ${PHOENIX_DOWN.cost}` : `Not enough Credits`}
        </ArcadeButton>
        <ArcadeButton variant="text" color="slate" onClick={() => onAnswer(false)}>{canPay ? 'No thanks, end the run' : 'End the run'}</ArcadeButton>
      </div>
    </div>
  );
};

export default ContinueCard;
