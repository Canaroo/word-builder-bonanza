import React, { useEffect } from 'react';
import ArcadeButton from './ArcadeButton';
import { soundService } from '../services/soundService';
import { tierFor, ordinal } from '../services/greatestHits';

// Greatest Hits (v7.52.0): a word played as many times as it has letters "goes platinum". The card
// is a record award: a spinning disc, the word on the label, the certification, the points, and
// what's next on the charts.
const GreatestHitCard: React.FC<{ word: string; plays: number; letters: number; next: number | null; onDone: () => void }> = ({ word, plays, letters, next, onDone }) => {
  const tier = tierFor(letters);
  const up = next ? tierFor(next) : undefined;
  useEffect(() => { soundService.playMilestone(); try { navigator.vibrate?.([30, 60, 30]); } catch { /* not supported */ } }, []);
  if (!tier) return null;
  return (
    <div className="absolute inset-0 bg-crt-950/90 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" role="dialog" aria-modal="true" aria-label={`Greatest Hit: ${word} went ${tier.title}`}>
      <div className="bg-crt-900 border-4 border-neon-yellow shadow-[0_0_32px_rgba(255,230,0,0.45)] rounded-2xl px-5 py-6 max-w-md w-full flex flex-col items-center text-center gap-3 level-stage-in">
        <p className="osd-text text-lg tracking-[0.3em] text-neon-yellow">📀 GREATEST HIT!</p>
        {/* The record: grooves, and the word on the label */}
        <div className="relative w-40 h-40 rounded-full bg-[radial-gradient(circle,#111_0%,#222_30%,#0a0a0a_31%,#1c1c1c_45%,#0a0a0a_46%,#1c1c1c_60%,#0a0a0a_61%,#181818_100%)] ring-4 ring-neon-yellow/70 grid place-items-center animate-spin" style={{ animationDuration: '3s' }} aria-hidden="true">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-neon-yellow to-neon-orange grid place-items-center">
            <span className="font-display text-xs text-crt-900 leading-none px-1 break-all">{word}</span>
          </div>
        </div>
        <h2 className="font-display text-2xl text-white leading-tight">{word} WENT {tier.icon} {tier.title}</h2>
        <p className="text-slate-200 text-sm leading-snug">
          That's the <strong className="text-white">{ordinal(plays)} time</strong> you played {word} this run. A {letters}-letter word played {letters} times is certified {tier.title.toLowerCase()}.
        </p>
        <p className="font-display text-3xl text-neon-yellow leading-none">+{tier.points.toLocaleString()}</p>
        <div className="w-full rounded-xl ring-1 ring-white/15 bg-crt-950/70 px-3 py-2">
          {up ? (
            <p className="text-sm text-slate-200 leading-snug">
              <span className="osd-text text-base text-neon-cyan">NEXT ON THE CHARTS:</span> play a <strong className="text-white">{up.letters}-letter word {up.letters} times</strong> to go {up.icon} {up.title} for <strong className="text-neon-yellow">+{up.points.toLocaleString()}</strong>.
            </p>
          ) : (
            <p className="text-sm text-slate-200 leading-snug"><span className="osd-text text-base text-neon-cyan">YOU TOPPED THE CHARTS:</span> every record this run is yours.</p>
          )}
        </div>
        <ArcadeButton color="yellow" className="w-full" onClick={onDone}>Continue</ArcadeButton>
      </div>
    </div>
  );
};

export default GreatestHitCard;
