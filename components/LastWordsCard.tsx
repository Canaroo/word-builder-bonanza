import React, { useEffect, useState } from 'react';
import type { GameState, Tile } from '../types';
import ArcadeButton from './ArcadeButton';
import { soundService } from '../services/soundService';
import { dictionaryService } from '../services/dictionaryService';
import { calculateScore } from '../services/gameUtils';
import { assignTilesToWord } from '../services/rackMatch';
import { LAST_WORDS, FINAL_JEOPARDY } from '../config/gameplay';
import { FINAL_CATEGORIES, finalBet, finalCategoryFor, finalCategorySolution } from '../services/rules';
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
  /** v7.92.0: the category actually played, checked against the final hand and saved with the card ('none': no bet). */
  savedCategory?: string;
  onCategory?: (id: string) => void;
  /** v7.93.0: when the bet's clock runs out (epoch ms), saved with the card so a quit can't restart it. */
  deadline?: number;
  onDeadline?: (at: number) => void;
  onDone: (r: LastWordsResult | null) => void;
}> = ({ reason, tiles, gameState, piggyLost = 0, category, bet, onBet, savedCategory, onCategory, deadline, onDeadline, onDone }) => {
  const [picked, setPicked] = useState<number[]>([]);
  const [flash, setFlash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<LastWordsResult | null>(null);
  useEffect(() => { soundService.playPowerUp(); }, []);
  const armed = useArmDelay();

  const word = picked.map(i => tiles[i].letter).join('');
  // 💡 Final Jeopardy: bet before a tile can be tapped; the category only shows after the bet.
  // v7.92.0 (the owner's rule): the category must be one this final hand can actually make. The card
  // finds every everyday word the tiles spell, keeps the dealt category if one fits it, else picks one
  // that a word fits, and saves the choice ('none' when nothing fits: no bet is offered).
  const [words, setWords] = useState<string[] | null>(null);
  useEffect(() => {
    let alive = true;
    dictionaryService.playableWords(tiles.map(t => t.letter)).then(ws => { if (alive) setWords(ws); }).catch(() => { if (alive) setWords([]); });
    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!words || savedCategory !== undefined || !onCategory) return;
    // A bet placed before this check (an older save) keeps the category it was placed on.
    onCategory(bet !== undefined ? (category ?? 'none') : finalCategoryFor(category ?? '', words));
  }, [words, savedCategory]); // eslint-disable-line react-hooks/exhaustive-deps
  const catId = savedCategory ?? (onCategory ? undefined : category);
  const cat = catId ? FINAL_CATEGORIES[catId] : undefined;
  const bets = FINAL_JEOPARDY.percents.map(p => ({ percent: p, amount: finalBet(gameState.score, p) })).filter(b => b.amount > 0);
  const dealing = !!category && catId === undefined;
  const betting = (!!cat || dealing) && !!onBet && bet === undefined && bets.length > 0;
  const placed = cat && bet && bet > 0 ? bet : 0;
  const fits = placed && word.length >= 3 ? cat!.test(word) : null;
  // v7.77.1: after a lost bet, show a word from these tiles that would have fit. Since v7.92.0 there
  // always is one: the category was picked because a word in this hand fits it.
  const fitWord = words && catId ? finalCategorySolution(catId, words) : undefined;
  const [skipped, setSkipped] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  // v7.93.0 (the owner's call): a bet makes it a challenge, FINAL_JEOPARDY.betSeconds to spell the last
  // word; no bet, no clock. The deadline is set once the bet is placed and saved with the card.
  useEffect(() => {
    if (placed > 0 && deadline === undefined && onDeadline) onDeadline(Date.now() + FINAL_JEOPARDY.betSeconds * 1000);
  }, [placed, deadline]); // eslint-disable-line react-hooks/exhaustive-deps
  const [now, setNow] = useState(() => Date.now());
  const clockOn = placed > 0 && deadline !== undefined && !result && !skipped;
  useEffect(() => {
    if (!clockOn) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [clockOn]);
  const secsLeft = clockOn ? Math.max(0, Math.ceil((deadline! - now) / 1000)) : null;
  const lastTick = React.useRef<number | null>(null);
  useEffect(() => {
    if (secsLeft === null) return;
    if (secsLeft !== lastTick.current && secsLeft > 0 && secsLeft <= 10) soundService.playTick();
    lastTick.current = secsLeft;
    if (secsLeft === 0 && !busy) { soundService.playInvalidWord(); setTimedOut(true); setSkipped(true); }
  }, [secsLeft, busy]);
  const fitReveal = cat && (
    <div className="w-full rounded-lg bg-crt-950/80 ring-1 ring-neon-cyan/50 px-3 py-2" data-testid="fj-fit">
      {fitWord === undefined ? <p className="text-sm text-slate-300">Checking your tiles…</p>
        : fitWord ? (<>
          <p className="osd-text text-base text-neon-cyan leading-none">A WORD THAT FIT {cat.label}</p>
          <p className="font-tile font-extrabold text-2xl tracking-widest text-white">{fitWord}</p>
        </>) : <p className="text-sm text-slate-200 leading-snug">No word in these tiles fit {cat.label}.</p>}
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

  // v7.92.0 (the owner's ask: players missed the bet under the board): the bet is its own card, shown
  // before the Last Words board. It says what Final Jeopardy is in three steps, shows the final hand,
  // and offers the bets. The category stays hidden until the bet is placed.
  if (betting) return (
    <div className="absolute inset-0 bg-crt-950/90 backdrop-blur-sm flex items-center justify-center z-50 p-3 animate-fade-in" role="dialog" aria-modal="true" aria-label="Final Jeopardy">
      <div className="rounded-2xl px-4 py-5 max-w-md w-full flex flex-col items-center text-center gap-3 level-stage-in bg-[#0b1f6b] ring-4 ring-neon-yellow shadow-[0_0_32px_rgba(255,210,63,0.45)]" data-testid="fj-bet-card">
        <p className="osd-text text-base tracking-[0.25em] text-slate-200">{reason === 'strikes' ? 'STRUCK OUT' : "TIME'S UP"} · ONE LAST CHANCE</p>
        <h2 className="font-display text-3xl text-neon-yellow leading-none">💡 FINAL JEOPARDY</h2>
        {piggyLost > 0 && <p className="text-sm text-neon-red leading-snug" data-testid="piggy-lost">🐷 Time ran out before you smashed Hamm: his {piggyLost.toLocaleString()} in savings are gone.</p>}
        <ol className="w-full text-left text-[15px] text-white leading-snug flex flex-col gap-1.5" data-testid="fj-steps">
          <li><span className="text-neon-yellow font-bold">1.</span> Bet some of your score, or skip it.</li>
          <li><span className="text-neon-yellow font-bold">2.</span> A secret <strong>category</strong> is revealed, like "5+ letters".</li>
          <li><span className="text-neon-yellow font-bold">3.</span> Spell your last word from these tiles. It scores x{LAST_WORDS.multiplier}, and if it fits the category you win the bet. Miss and you lose it.</li>
        </ol>
        <div className="w-full grid grid-cols-2 gap-2 text-left" data-testid="fj-choice">
          <div className="rounded-lg bg-neon-yellow/15 ring-1 ring-neon-yellow px-2.5 py-2">
            <p className="osd-text text-base leading-none text-neon-yellow">⏱ BET</p>
            <p className="text-[13px] text-white leading-snug mt-1">You get <strong>{FINAL_JEOPARDY.betSeconds} seconds</strong> to spell it.</p>
          </div>
          <div className="rounded-lg bg-white/5 ring-1 ring-white/25 px-2.5 py-2">
            <p className="osd-text text-base leading-none text-slate-200">🛋️ NO BET</p>
            <p className="text-[13px] text-white leading-snug mt-1">No clock. Take all the time you want.</p>
          </div>
        </div>
        <p className="text-sm text-neon-cyan leading-snug">Your tiles can always make a word that fits.</p>
        <div className="grid grid-cols-4 gap-1.5 w-full" aria-label="Your final hand">
          {tiles.map(t => (
            <div key={t.id} className="relative h-11 rounded-lg grid place-items-center font-tile font-extrabold text-xl bg-[#f6e7c1] text-crt-900">
              {t.letter}<span className="absolute bottom-0.5 right-1 font-osd text-xs">{t.points}</span>
            </div>
          ))}
        </div>
        {(!armed || dealing) && <ArmBar />}
        <div className="w-full grid gap-2">
          {bets.map(b => (
            <ArcadeButton key={b.percent} color="yellow" variant={b.percent === bets[bets.length - 1].percent ? undefined : 'outline'} disabled={!armed || dealing}
              onClick={() => { if (!armed || dealing) return; soundService.playPowerUp(); onBet!(b.amount); }}>
              ⏱ Bet {b.amount.toLocaleString()} ({b.percent}%{b.amount === FINAL_JEOPARDY.cap ? ', max' : ''}) · {FINAL_JEOPARDY.betSeconds} sec
            </ArcadeButton>
          ))}
          <ArcadeButton color="slate" variant="outline" disabled={!armed || dealing} onClick={() => { if (armed && !dealing) onBet!(0); }}>No bet, no clock</ArcadeButton>
        </div>
      </div>
    </div>
  );

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
            {timedOut && <p className="osd-text text-xl text-neon-red" data-testid="fj-timeout">⏱ TIME'S UP! The clock beat you to it.</p>}
            <p className="font-display text-2xl text-neon-red" data-testid="fj-result">💡 FINAL JEOPARDY: -{placed.toLocaleString()}</p>
            {fitReveal}
            <ArcadeButton color="slate" className="w-full" onClick={() => onDone(null)}>End the run</ArcadeButton>
          </>
        ) : betting ? null : (
          <>
            {placed > 0 && (
              <div className="w-full rounded-lg bg-[#0b2a6b] ring-2 ring-neon-cyan px-3 py-2 level-stage-in" data-testid="fj-category">
                <p className="osd-text text-base text-neon-cyan leading-none">💡 CATEGORY</p>
                <p className="font-display text-xl text-white leading-tight">{cat!.label}</p>
                <p className="text-xs text-slate-200 leading-snug">Your bet: {placed.toLocaleString()}. Fit the category to win it, miss and lose it.</p>
                {secsLeft !== null && (
                  <div className="mt-1.5" data-testid="fj-clock" aria-live="polite">
                    <p className={`font-display text-2xl leading-none ${secsLeft <= 10 ? 'text-neon-red animate-pulse' : 'text-neon-yellow'}`}>⏱ {secsLeft} sec</p>
                    <div className="h-1.5 rounded-full bg-crt-950 overflow-hidden mt-1">
                      <div className={`h-full transition-[width] duration-200 ${secsLeft <= 10 ? 'bg-neon-red' : 'bg-neon-yellow'}`} style={{ width: `${Math.min(100, (secsLeft / FINAL_JEOPARDY.betSeconds) * 100)}%` }} />
                    </div>
                  </div>
                )}
              </div>
            )}
            <p className="text-slate-200 leading-snug">
              {placed > 0 ? '' : 'The clock is stopped. '}Play <strong className="text-white">one more word</strong> from your final hand and it scores{' '}
              <strong className="text-neon-yellow">x{LAST_WORDS.multiplier}</strong>. {placed > 0 ? 'Beat the clock to win your bet; a wrong guess costs only time.' : 'No clock, no rush, and a wrong guess costs nothing.'}
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
