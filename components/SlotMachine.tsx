import React, { useEffect, useRef, useState } from 'react';
import { soundService } from '../services/soundService';

const SYMBOLS = ['🍒', '🔔', '7️⃣', '🍋', '💎', '⭐'];
const SPIN_MS = 1400;
const STOP_GAP_MS = 350;

/**
 * 🎰 The SLOT power word: pull the lever, three reels spin and land on the result that was rolled
 * when the word was played (so closing early never changes the prize). Every pull wins.
 */
const SlotMachine: React.FC<{ title: string; seconds: number; reels: string; jackpot?: boolean; onClose: () => void }> = ({ title, seconds, reels, jackpot, onClose }) => {
  const [phase, setPhase] = useState<'ready' | 'spinning' | 'done'>('ready');
  const [faces, setFaces] = useState(['7️⃣', '🍒', '🔔']);
  const stopped = useRef(0);
  const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (phase !== 'spinning') return;
    stopped.current = 0;
    const spin = setInterval(() => {
      setFaces(f => f.map((face, i) => (i < stopped.current ? reels : SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)])));
    }, 80);
    const stops = [0, 1, 2].map(i => setTimeout(() => {
      stopped.current = i + 1;
      setFaces(f => f.map((face, j) => (j <= i ? reels : face)));
      soundService.playTileClick();
      if (i === 2) { clearInterval(spin); setPhase('done'); if (jackpot) soundService.playMilestone(); }
    }, SPIN_MS + i * STOP_GAP_MS));
    return () => { clearInterval(spin); stops.forEach(clearTimeout); };
  }, [phase, reels, jackpot]);

  const pull = () => {
    soundService.playUIClick();
    if (reduceMotion) { setFaces([reels, reels, reels]); setPhase('done'); return; }
    setPhase('spinning');
  };

  const label = jackpot ? 'JACKPOT!' : seconds >= 3 ? 'NICE PULL!' : 'WINNER!';

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-crt-950/85 backdrop-blur-sm animate-fade-in" role="dialog" aria-modal="true" aria-label="Slot machine">
      <div className="w-full max-w-sm rounded-2xl p-[3px] bg-gradient-to-b from-neon-yellow via-neon-orange to-neon-pink shadow-[0_0_28px_rgba(255,210,63,0.5)]">
        <div className="rounded-[14px] bg-crt-900 p-4 flex flex-col items-center gap-4">
          <h2 className="font-display text-2xl text-neon-yellow text-center leading-none">{title}</h2>
          <p className="osd-text text-base text-slate-400 text-center leading-tight">EVERY PULL WINS: 🍒 +1s · 🔔 +3s · 7️⃣ +10s</p>
          <div className="flex gap-2 items-center">
            <div className="flex gap-2 rounded-xl bg-crt-950 ring-2 ring-neon-yellow/60 p-2" aria-live="polite" aria-label={phase === 'done' ? `${reels} ${reels} ${reels}: plus ${seconds} seconds` : 'Reels'}>
              {faces.map((f, i) => (
                <span key={i} className="w-16 h-20 grid place-items-center rounded-lg bg-gradient-to-b from-slate-100 to-slate-300 text-4xl shadow-inner">{f}</span>
              ))}
            </div>
            {/* The lever */}
            <button type="button" onClick={pull} disabled={phase !== 'ready'} aria-label="Pull the lever"
              className="flex flex-col items-center disabled:opacity-60">
              <span className={`w-6 h-6 rounded-full bg-red-500 ring-2 ring-red-300 shadow-[0_0_10px_rgba(239,68,68,0.8)] transition-transform duration-300 ${phase === 'ready' ? '' : 'translate-y-10'}`} />
              <span className="w-1.5 h-12 bg-slate-300 rounded-full" />
            </button>
          </div>
          {phase === 'done' ? (
            <>
              <p className={`font-display text-3xl leading-none ${jackpot ? 'text-neon-yellow neon-flicker' : 'text-neon-cyan'}`}>{label} +{seconds}s</p>
              <p className="osd-text text-base text-slate-400">ADDED TO YOUR NEXT ROUND</p>
              <button type="button" onClick={onClose} className="w-full px-6 py-3 text-xl font-bold text-slate-900 bg-neon-yellow rounded-lg">▶ CONTINUE</button>
            </>
          ) : (
            <button type="button" onClick={pull} disabled={phase !== 'ready'} className="w-full px-6 py-3 text-xl font-display text-slate-900 bg-neon-yellow rounded-lg disabled:opacity-60">
              {phase === 'ready' ? '🎰 PULL!' : 'SPINNING…'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SlotMachine;
