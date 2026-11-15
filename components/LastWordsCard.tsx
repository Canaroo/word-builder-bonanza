import React, { useEffect, useState } from 'react';
import type { GameState, Tile } from '../types';
import ArcadeButton from './ArcadeButton';
import { soundService } from '../services/soundService';
import { dictionaryService } from '../services/dictionaryService';
import { calculateScore } from '../services/gameUtils';
import { assignTilesToWord } from '../services/rackMatch';
import { LAST_WORDS } from '../config/gameplay';
import { useArmDelay, END_CARD_ARM_MS } from './useArmDelay';

// Last Words (v7.42): the run is over, but the clock is stopped and the final hand is still on the
// table. One parting word, untimed, scores x3. A wrong guess costs nothing; "No last words" skips.
// It pays outside the run's words (no level, no offers, no time), then the run ends as usual.
export interface LastWordsResult { word: string; points: number }

/** A short bar that fills while taps are held off, so the wait reads as deliberate. */
export const ArmBar: React.FC = () => (
  <div className="w-full h-1 rounded-full bg-crt-950 overflow-hidden" aria-hidden="true">
    <div className="h-full bg-neon-yellow arm-fill" style={{ animationDuration: `${END_CARD_ARM_MS}ms` }} />
  </div>
);

const LastWordsCard: React.FC<{
  reason: 'strikes' | 'time';
  tiles: Tile[];
  gameState: GameState;
  onDone: (r: LastWordsResult | null) => void;
}> = ({ reason, tiles, gameState, onDone }) => {
  const [picked, setPicked] = useState<number[]>([]);
  const [flash, setFlash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<LastWordsResult | null>(null);
  useEffect(() => { soundService.playPowerUp(); }, []);
  const armed = useArmDelay();

  const word = picked.map(i => tiles[i].letter).join('');
  const submit = async () => {
    if (busy || result || word.length < 3) return;
    setBusy(true);
    const lower = word.toLowerCase();
    const ok = await dictionaryService.isValidWord(lower);
    setBusy(false);
    if (!ok) { setFlash(`${word}? Not a word. Try another.`); soundService.playInvalidWord(); setPicked([]); return; }
    const used = picked.map(i => tiles[i]);
    const base = calculateScore(lower, used, gameState).totalScore;
    const points = Math.max(0, Math.round(base * LAST_WORDS.multiplier));
    soundService.playMilestone();
    setResult({ word, points });
  };
  const canSpell = (w: string) => assignTilesToWord(w, tiles.map(t => t.letter));

  return (
    <div className="absolute inset-0 bg-crt-950/90 backdrop-blur-sm flex items-center justify-center z-50 p-3 animate-fade-in" role="dialog" aria-modal="true" aria-label="Last Words">
      <div className="bg-crt-900 border-4 border-neon-orange shadow-[0_0_28px_rgba(255,140,60,0.5)] rounded-2xl px-4 py-5 max-w-md w-full flex flex-col items-center text-center gap-3 level-stage-in">
        <p className="osd-text text-lg tracking-[0.3em] text-neon-red">{reason === 'strikes' ? 'STRUCK OUT' : "TIME'S UP"}</p>
        <h2 className="font-display text-3xl text-neon-orange leading-none">🎤 LAST WORDS</h2>
        {result ? (
          <>
            <p className="font-tile font-extrabold text-3xl tracking-widest text-white">{result.word}</p>
            <p className="font-display text-3xl text-neon-green leading-tight" aria-live="polite">+{result.points.toLocaleString()}</p>
            <p className="text-slate-200">A parting shot at x{LAST_WORDS.multiplier}. Mic dropped.</p>
            <ArcadeButton color="green" className="w-full" onClick={() => onDone(result)}>Take the {result.points.toLocaleString()}</ArcadeButton>
          </>
        ) : (
          <>
            <p className="text-slate-200 leading-snug">
              The clock is stopped. Play <strong className="text-white">one more word</strong> from your final hand and it scores{' '}
              <strong className="text-neon-yellow">x{LAST_WORDS.multiplier}</strong>. No rush, and a wrong guess costs nothing.
            </p>
            <div className="w-full min-h-[3rem] rounded-lg bg-crt-950 ring-1 ring-white/15 flex items-center justify-center gap-1 px-2 font-tile font-extrabold text-2xl tracking-widest text-white">
              {word || <span className="text-slate-600 text-base font-sans font-normal">Tap tiles to build a word</span>}
            </div>
            <p className="osd-text text-lg text-neon-yellow min-h-[1.5rem]" aria-live="polite">{!armed ? 'GET READY…' : busy ? 'Checking…' : flash ?? ''}</p>
            {!armed && <ArmBar />}
            <div className="grid grid-cols-4 gap-1.5 w-full">
              {tiles.map((t, i) => (
                <button key={t.id} type="button"
                  disabled={!armed}
                  onPointerDown={e => { e.preventDefault(); if (!armed) return; setFlash(null); setPicked(p => (p.includes(i) ? p.filter(x => x !== i) : [...p, i])); }}
                  aria-label={`Last Words tile ${t.letter} with ${t.points} points`}
                  className={`relative h-14 rounded-lg grid place-items-center font-tile font-extrabold text-2xl tile-3d select-none touch-none ${picked.includes(i) ? 'bg-neon-yellow text-crt-900 -translate-y-1' : 'bg-[#f6e7c1] text-crt-900'}`}>
                  {t.letter}<span className="absolute bottom-0.5 right-1 font-osd text-xs">{t.points}</span>
                </button>
              ))}
            </div>
            <div className="w-full grid grid-cols-2 gap-2">
              <ArcadeButton color="slate" variant="outline" onClick={() => { setPicked([]); setFlash(null); }}>Clear</ArcadeButton>
              <ArcadeButton color="green" onClick={submit} disabled={!armed || word.length < 3 || busy || !canSpell(word)}>Submit</ArcadeButton>
            </div>
            <ArcadeButton variant="text" color="slate" disabled={!armed} onClick={() => armed && onDone(null)}>No last words, end the run</ArcadeButton>
          </>
        )}
      </div>
    </div>
  );
};

export default LastWordsCard;
