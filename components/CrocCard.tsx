import React, { useEffect, useState } from 'react';
import ArcadeButton from './ArcadeButton';
import { Sec } from './Seconds';
import { soundService } from '../services/soundService';
import { TIME_BONUS } from '../config/gameplay';
import { charmTimeAt } from '../services/rules';

/**
 * Tick-Tock Croc (v7.51.0): the croc surfaces with three clocks floating by. Pick one: the result
 * was rolled when the croc surfaced (the pop-up's `win`), so the pick only reveals it. The picked
 * clock is saved with the run, so quitting and coming back shows the same reveal.
 */
const buzz = (ms: number | number[]) => { try { navigator.vibrate?.(ms); } catch { /* not supported */ } };

const CrocCard: React.FC<{ win: boolean; level: number; saved?: Record<string, unknown>; onSave?: (key: string, value: unknown) => void; onDone: () => void }> = ({ win, level, saved, onSave, onDone }) => {
  // Charm time shrinks with the level, so the card shows what this level pays.
  const secs = charmTimeAt(TIME_BONUS.tickTockCroc, level).paid;
  const [picked, setPicked] = useState<number | null>(typeof saved?.picked === 'number' ? (saved.picked as number) : null);
  const [shown, setShown] = useState(picked !== null);
  useEffect(() => { soundService.playPowerUp(); }, []);
  useEffect(() => {
    if (picked === null || shown) return;
    const t = setTimeout(() => {
      setShown(true);
      if (win) { soundService.playMilestone(); buzz([20, 40, 20]); } else { soundService.playInvalidWord(); buzz(80); }
    }, 650);
    return () => clearTimeout(t);
  }, [picked, shown, win]);
  const pick = (i: number) => {
    if (picked !== null) return;
    soundService.playTileClick(); buzz(15);
    setPicked(i); onSave?.('picked', i);
  };
  const pct = Math.round(TIME_BONUS.crocWinChance * 100);
  return (
    <div className="absolute inset-0 bg-crt-950/90 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" role="dialog" aria-modal="true" aria-label="Tick-Tock Croc: pick a clock">
      <div className="bg-crt-900 border-4 border-neon-green shadow-[0_0_28px_rgba(57,255,20,0.35)] rounded-2xl px-5 py-6 max-w-md w-full flex flex-col items-center text-center gap-3 level-stage-in">
        <p className="osd-text text-lg tracking-[0.3em] text-neon-green">TICK-TOCK… TICK-TOCK…</p>
        <div className="text-6xl leading-none" aria-hidden="true">🐊</div>
        <p className="font-display text-xl text-white leading-tight">Tick-Tock Croc</p>
        <p className="text-slate-200 text-sm leading-snug min-h-[2.5rem] flex items-center justify-center" aria-live="polite">
          {!shown ? (picked === null ? 'The croc surfaced! Pick a clock. One of them might be lunch.' : 'Tick… tock…')
            : win ? <span>It coughs up the clock: <strong className="text-neon-green">+{secs}<Sec /></strong></span>
            : <span>Chomp! It bites <strong className="text-neon-red">{TIME_BONUS.crocLoss} points</strong>.</span>}
        </p>
        <div className="w-full grid grid-cols-3 gap-3 rounded-2xl bg-gradient-to-b from-[#0b3a5c] to-[#062033] p-3 ring-2 ring-neon-cyan/40">
          {[0, 1, 2].map(i => {
            const mine = picked === i;
            const face = shown && mine ? (win ? '⏰' : '🐊') : '⏰';
            return (
              <button key={i} type="button" aria-label={`Clock ${i + 1}`} disabled={picked !== null} onClick={() => pick(i)}
                className={`aspect-square rounded-xl grid place-items-center text-5xl transition-all select-none
                  ${mine ? (shown ? (win ? 'bg-neon-green/30 ring-4 ring-neon-green scale-110' : 'bg-neon-red/30 ring-4 ring-neon-red scale-110') : 'bg-white/20 ring-4 ring-white scale-105')
                    : picked !== null ? 'opacity-40' : 'bg-white/10 ring-2 ring-white/20 hover:bg-white/20 animate-pulse'}`}>
                <span aria-hidden="true">{face}</span>
              </button>
            );
          })}
        </div>
        <p className="osd-text text-sm text-slate-400">{pct}% +{secs}<Sec /> · {100 - pct}% -{TIME_BONUS.crocLoss} POINTS</p>
        {shown && (
          <ArcadeButton color={win ? 'green' : 'slate'} className="w-full" onClick={onDone}>
            {win ? `Take +${secs}s` : `Take the -${TIME_BONUS.crocLoss}`}
          </ArcadeButton>
        )}
      </div>
    </div>
  );
};

export default CrocCard;
