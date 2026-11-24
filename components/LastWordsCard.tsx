import React, { useEffect, useState } from 'react';
import type { GameState, Tile } from '../types';
import ArcadeButton from './ArcadeButton';
import { soundService } from '../services/soundService';
import { dictionaryService } from '../services/dictionaryService';
import { calculateScore } from '../services/gameUtils';
import { assignTilesToWord } from '../services/rackMatch';
import { LAST_WORDS, FINAL_JEOPARDY } from '../config/gameplay';
import { FINAL_CATEGORIES, finalBet } from '../services/rules';
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
  /** 🐷 Hamm's savings lost because time ran out (v7.73.1). */
  piggyLost?: number;
  /** 💡 Final Jeopardy (v7.75.0): the category dealt when the run ended, and the bet once it's made (0 = no bet). */
  category?: string;
  bet?: number;
  onBet?: (bet: number) => void;
  onDone: (r: LastWordsResult | null) => void;
}> = ({ reason, tiles, gameState, piggyLost = 0, category, bet, onBet, onDone }) => {
  const [picked, setPicked] = useState<number[]>([]);
  const [flash, setFlash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<LastWordsResult | null>(null);
  useEffect(() => { soundService.playPowerUp(); }, []);
  const armed = useArmDelay();

  const word = picked.map(i => tiles[i].letter).join('');
  // 💡 Final Jeopardy: bet before a tile can be tapped; the category only shows after the bet.
  const cat = category ? FINAL_CATEGORIES[category] : undefined;
  const bets = FINAL_JEOPARDY.percents.map(p => ({ percent: p, amount: finalBet(gameState.score, p) })).filter(b => b.amount > 0);
  const betting = !!cat && !!onBet && bet === undefined && bets.length > 0;
  const placed = cat && bet && bet > 0 ? bet : 0;
  const fits = placed && word.length >= 3 ? cat!.test(word) : null;
  // v7.77.1 (the owner's ask): after a lost bet, show a word from these tiles that would have fit,
  // so the player sees it was possible and learns one. Found once the bet is placed: the longest
  // everyday word that fits (null when no word in the tiles fits the category).
  const [fitWord, setFitWord] = useState<string | null | undefined>(undefined);
  const [skipped, setSkipped] = useState(false);
  useEffect(() => {
    if (!placed || !cat || fitWord !== undefined) return;
    let alive = true;
    dictionaryService.playableWords(tiles.map(t => t.letter)).then(ws => { if (alive) setFitWord(ws.find(w => cat.test(w)) ?? null); });
    return () => { alive = false; };
  }, [placed]); // eslint-disable-line react-hooks/exhaustive-deps
  const fitReveal = cat && (
    <div className="w-full rounded-lg bg-crt-950/80 ring-1 ring-neon-cyan/50 px-3 py-2" data-testid="fj-fit">
      {fitWord === undefined ? <p className="text-sm text-slate-300">Checking your tiles…</p>
        : fitWord ? (<>
          <p className="osd-text text-base text-neon-cyan leading-none">A WORD THAT FIT {cat.label}</p>
          <p className="font-tile font-extrabold text-2xl tracking-widest text-white">{fitWord}</p>
        </>) : <p className="text-sm text-slate-200 leading-snug">No word in these tiles fit {cat.label}. A tough category: nobody could have made that one.</p>}
    </div>
  );
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
        {piggyLost > 0 && <p className="text-sm text-neon-red leading-snug" data-testid="piggy-lost">🐷 Time ran out before you smashed Hamm: his {piggyLost.toLocaleString()} in savings are gone.</p>}
        {result ? (
          <>
            <p className="font-tile font-extrabold text-3xl tracking-widest text-white">{result.word}</p>
            <p className="font-display text-3xl text-neon-green leading-tight" aria-live="polite">+{result.points.toLocaleString()}</p>
            <p className="text-slate-200">A parting shot at x{LAST_WORDS.multiplier}. Mic dropped.</p>
            {placed > 0 && (cat!.test(result.word)
              ? <p className="font-display text-2xl text-neon-green" data-testid="fj-result">💡 FINAL JEOPARDY: +{placed.toLocaleString()}</p>
              : <><p className="font-display text-2xl text-neon-red" data-testid="fj-result">💡 FINAL JEOPARDY: -{placed.toLocaleString()}</p>{fitReveal}</>)}
            <ArcadeButton color="green" className="w-full" onClick={() => onDone(result)}>Take the {result.points.toLocaleString()}</ArcadeButton>
          </>
        ) : skipped ? (
          // No last word after a bet: the bet is lost, but show a word that would have fit first.
          <>
            <p className="font-display text-2xl text-neon-red" data-testid="fj-result">💡 FINAL JEOPARDY: -{placed.toLocaleString()}</p>
            {fitReveal}
            <ArcadeButton color="slate" className="w-full" onClick={() => onDone(null)}>End the run</ArcadeButton>
          </>
        ) : betting ? (
          // 💡 Final Jeopardy: the bet comes first. The tiles show (you've seen them), the category doesn't.
          <>
            <p className="osd-text text-lg tracking-[0.2em] text-neon-cyan">💡 FINAL JEOPARDY</p>
            <p className="text-slate-200 leading-snug">Bet on your last word? After you bet, a <strong className="text-white">category</strong> is revealed. If your last word fits it, you win the bet. If not, you lose it.</p>
            <div className="grid grid-cols-4 gap-1.5 w-full opacity-80" aria-label="Your final hand">
              {tiles.map(t => (
                <div key={t.id} className="relative h-12 rounded-lg grid place-items-center font-tile font-extrabold text-xl bg-[#f6e7c1] text-crt-900">
                  {t.letter}<span className="absolute bottom-0.5 right-1 font-osd text-xs">{t.points}</span>
                </div>
              ))}
            </div>
            {!armed && <ArmBar />}
            <div className="w-full grid gap-2">
              {bets.map(b => (
                <ArcadeButton key={b.percent} color="cyan" variant={b.percent === bets[bets.length - 1].percent ? undefined : 'outline'} disabled={!armed}
                  onClick={() => { if (!armed) return; soundService.playPowerUp(); onBet!(b.amount); }}>
                  Bet {b.amount.toLocaleString()} ({b.percent}%{b.amount === FINAL_JEOPARDY.cap ? ', the max' : ''})
                </ArcadeButton>
              ))}
              <ArcadeButton color="slate" variant="outline" disabled={!armed} onClick={() => { if (armed) onBet!(0); }}>No bet, just play</ArcadeButton>
            </div>
          </>
        ) : (
          <>
            {placed > 0 && (
              <div className="w-full rounded-lg bg-[#0b2a6b] ring-2 ring-neon-cyan px-3 py-2 level-stage-in" data-testid="fj-category">
                <p className="osd-text text-base text-neon-cyan leading-none">💡 CATEGORY</p>
                <p className="font-display text-xl text-white leading-tight">{cat!.label}</p>
                <p className="text-xs text-slate-200 leading-snug">Your bet: {placed.toLocaleString()}. Fit the category to win it, miss and lose it.</p>
              </div>
            )}
            <p className="text-slate-200 leading-snug">
              The clock is stopped. Play <strong className="text-white">one more word</strong> from your final hand and it scores{' '}
              <strong className="text-neon-yellow">x{LAST_WORDS.multiplier}</strong>. No rush, and a wrong guess costs nothing.
            </p>
            <div className="w-full min-h-[3rem] rounded-lg bg-crt-950 ring-1 ring-white/15 flex items-center justify-center gap-1 px-2 font-tile font-extrabold text-2xl tracking-widest text-white">
              {word || <span className="text-slate-600 text-base font-sans font-normal">Tap tiles to build a word</span>}
            </div>
            <p className="osd-text text-lg text-neon-yellow min-h-[1.5rem]" aria-live="polite">{!armed ? 'GET READY…' : busy ? 'Checking…' : flash ?? (fits === true ? '✔ FITS THE CATEGORY' : fits === false ? "✘ DOESN'T FIT THE CATEGORY" : '')}</p>
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
            <ArcadeButton variant="text" color="slate" disabled={!armed} onClick={() => { if (!armed) return; if (placed > 0) setSkipped(true); else onDone(null); }}>{placed > 0 ? `No last words (lose the ${placed.toLocaleString()} bet)` : 'No last words, end the run'}</ArcadeButton>
          </>
        )}
      </div>
    </div>
  );
};

export default LastWordsCard;
