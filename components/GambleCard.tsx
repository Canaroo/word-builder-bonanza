import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import ArcadeButton from './ArcadeButton';
import { POWER_PLAY_VALUES as V } from '../config/gameplay';
import { doorsForRound, minesweeperPot, bankerOffer, dealGame, cardSharksPot, drawCard, cardFace, hotTubSeconds, WHAMMY_BOARD, whammySpin, whammySquareFor, PLINKO_SLOTS, PLINKO_ROWS, plinkoSlotFor, plinkoPath, plinkoPayout } from '../services/rules';
import { createTile, createTileBag, shuffleArray } from '../services/gameUtils';
import type { Tile } from '../types';
import { CHARMS_LIST } from '../data/charms';
import { soundService } from '../services/soundService';

// The PowerPlays where the player makes the call (v7.25): pick a door, take the Banker's deal,
// keep spinning for No Whammies, or pick a Minesweeper square. The card rolls and then hands the
// result to the game, which applies it and shows the outcome card.
export interface GambleResult {
  points?: number; seconds?: number; strike?: boolean; headline: string; detail: string; tone: 'win' | 'lose' | 'neutral';
  /** Arms the PowerPlay for a later word (The Price Is Right's bid). */
  arm?: { value: unknown; description: string };
  /** Draft Day: letters that replace the lowest-value tiles in the hand. */
  draft?: string[];
  /** Lucky Charms: the charm to equip (and the one it bumps out when slots are full). */
  charm?: { id: string; replaceId?: string };
}

// A gamble card's board is saved with the run (v7.28.9). Without it, quitting and resuming brought
// the card back fresh: a free reroll of Card Sharks' first card, Deal or No Deal's cases, Draft
// Day's packs. Each piece of state lives in the open pop-up's data, so the auto-save keeps it.
const GambleSave = createContext<{ saved?: Record<string, unknown>; save?: (key: string, value: unknown) => void }>({});
function useSaved<T>(key: string, init: T | (() => T)): [T, (value: T) => void] {
  const { saved, save } = useContext(GambleSave);
  const restored = !!saved && key in saved;
  const [value, setValue] = useState<T>(() => (restored ? (saved![key] as T) : typeof init === 'function' ? (init as () => T)() : init));
  // The opening deal (cards, cases, the mine) is saved right away, so a resume can't redraw it.
  useEffect(() => { if (!restored) save?.(key, value); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return [value, (next: T) => { setValue(next); save?.(key, next); }];
}

const Frame: React.FC<{ icon: string; name: string; children: React.ReactNode }> = ({ icon, name, children }) => (
  <div className="absolute inset-0 bg-crt-950/85 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" role="dialog" aria-modal="true" aria-label={name}>
    <div className="bg-crt-900 border-4 border-neon-pink rounded-2xl px-5 py-6 max-w-md w-full flex flex-col items-center text-center gap-3 level-stage-in shadow-[0_0_28px_rgba(255,45,149,0.5)]">
      <p className="osd-text text-lg tracking-[0.3em] text-slate-300">TAKE A CHANCE</p>
      <div className="text-5xl leading-none" aria-hidden="true">{icon}</div>
      <p className="font-display text-xl text-white leading-tight">{name}</p>
      {children}
    </div>
  </div>
);

/** Let's Make a Deal: each round, two doors pay and one is a Zonk that wipes the pot. Bank after any win. */
const Doors: React.FC<{ onResolve: (r: GambleResult) => void }> = ({ onResolve }) => {
  const rounds = V.doorRounds.length;
  const [round, setRound] = useSaved('round', 0);
  const [pot, setPot] = useSaved('pot', 0);
  const [doors, setDoors] = useSaved('doors', () => doorsForRound(0));
  const [last, setLast] = useSaved<string | null>('last', null);
  // Walking away opens the doors you passed on (v7.28.6), so you see what you'd have faced.
  const [walked, setWalked] = useSaved<{ amount: number; played: number } | null>('walked', null);
  const behind = doors.map((d, j) => `Door ${j + 1}: ${d ? `+${d}` : 'Zonk'}`).join(' · ');
  const bank = (amount: number, played: number, revealed = false) =>
    onResolve({ points: amount, headline: `BANKED: +${amount} POINTS`, detail: `You walked away after ${played} ${played === 1 ? 'round' : 'rounds'} with the cash.${revealed ? `\n\nBehind the doors: ${behind}.` : ''}`, tone: 'win' });
  const pick = (i: number) => {
    if (walked) return;
    const prize = doors[i];
    const others = doors.map((d, j) => (j === i ? null : `Door ${j + 1}: ${d ? `+${d}` : 'Zonk'}`)).filter(Boolean).join(' · ');
    if (!prize) {
      onResolve({ points: 0, headline: `DOOR ${i + 1}: ZONK!`, detail: `${pot ? `The Zonk took your pot of ${pot} points.` : 'A Zonk on the first door. Nothing won this time.'}\n\n${others}`, tone: 'lose' });
      return;
    }
    const next = pot + prize;
    if (round + 1 >= rounds) { bank(next, round + 1); return; }
    soundService.playTileClick();
    setPot(next); setRound(round + 1); setDoors(doorsForRound(round + 1));
    setLast(`Door ${i + 1}: +${prize}! (${others})`);
  };
  const prizes = V.doorRounds[round];
  if (walked) {
    return (
      <>
        <p className="osd-text text-lg text-neon-cyan">ROUND {round + 1}: WHAT YOU PASSED ON</p>
        <div className="grid grid-cols-3 gap-2 w-full">
          {doors.map((d, i) => (
            <div key={i} className={`rounded-xl ring-2 py-4 font-display text-xl level-stage-in ${d ? 'bg-crt-950 ring-neon-green text-neon-green' : 'bg-neon-red/20 ring-neon-red text-neon-red'}`} aria-label={`Door ${i + 1}: ${d ? `+${d}` : 'Zonk'}`}>
              {d ? `+${d}` : 'ZONK'}
            </div>
          ))}
        </div>
        <p className="text-slate-200" aria-live="polite">Two of the three doors would have paid. The Zonk was behind <strong className="text-neon-red">door {doors.indexOf(0) + 1}</strong>.</p>
        <p className="font-display text-3xl text-neon-yellow">BANKED: {walked.amount}</p>
        <ArcadeButton color="green" className="w-full" onClick={() => bank(walked.amount, walked.played, true)}>Take the {walked.amount}</ArcadeButton>
      </>
    );
  }
  return (
    <>
      <p className="osd-text text-lg text-neon-cyan">ROUND {round + 1} OF {rounds}</p>
      {last && <p className="text-neon-green text-sm">{last}</p>}
      <p className="text-slate-200">Two doors hold +{prizes[0]} and +{prizes[1]}. One hides a Zonk that wipes your pot.</p>
      <p className="font-display text-3xl text-neon-yellow" aria-live="polite">POT: {pot}</p>
      <div className="grid grid-cols-3 gap-2 w-full">
        {doors.map((_, i) => (
          <button key={`${round}-${i}`} type="button" onClick={() => pick(i)} className="rounded-xl bg-gradient-to-b from-[#8b5a2b] to-[#5a3a1a] ring-2 ring-neon-yellow/70 py-5 font-display text-2xl text-neon-yellow hover:brightness-110" aria-label={`Door ${i + 1}`}>
            🚪<br />{i + 1}
          </button>
        ))}
      </div>
      {pot > 0 && <ArcadeButton color="green" className="w-full" onClick={() => { soundService.playTileClick(); setWalked({ amount: pot, played: round }); }}>Take the {pot} and walk away</ArcadeButton>}
    </>
  );
};

/** Deal or No Deal: open cases round by round; each round the Banker makes an offer. */
const Deal: React.FC<{ onResolve: (r: GambleResult) => void }> = ({ onResolve }) => {
  const [game] = useSaved('game', () => dealGame());
  const [round, setRound] = useSaved('round', 0);
  const opened = game.others.slice(0, V.dealOpenPerRound.slice(0, round + 1).reduce((a, b) => a + b, 0));
  const left = game.others.slice(opened.length);
  const offer = bankerOffer([game.mine, ...left], round);
  const lastRound = round >= V.dealOpenPerRound.length - 1;
  // Taking the deal opens your case (v7.28.7), so you see whether the Banker beat it.
  const [dealt, setDealt] = useSaved<number | null>('dealt', null);
  const verdict = (taken: number) => taken > game.mine ? `You beat your case by ${taken - game.mine}. Good deal!` : taken === game.mine ? 'Dead even with your case.' : `You left ${game.mine - taken} on the table.`;
  const take = (taken: number) => onResolve({
    points: taken, headline: `DEAL! +${taken} POINTS`,
    detail: `Your case held ${game.mine}. ${verdict(taken)}`,
    tone: taken >= game.mine ? 'win' : 'neutral',
  });
  const deal = () => { soundService.playTileClick(); setDealt(offer); };
  const noDeal = () => {
    if (!lastRound) { soundService.playTileClick(); setRound(round + 1); return; }
    onResolve({ points: game.mine, headline: `YOUR CASE: +${game.mine} POINTS`, detail: game.mine >= offer ? `No deal paid off! The Banker's last offer was ${offer}.` : `The Banker's last offer was ${offer}. Ouch.`, tone: game.mine >= offer ? 'win' : 'lose' });
  };
  if (dealt !== null) {
    const good = dealt >= game.mine;
    return (
      <>
        <p className="osd-text text-lg text-neon-cyan">YOUR CASE HELD...</p>
        <div className={`rounded-xl ring-4 px-6 py-3 font-display text-4xl level-stage-in ${good ? 'bg-crt-950 ring-neon-green text-neon-green' : 'bg-neon-red/20 ring-neon-red text-neon-red'}`} aria-label={`Your case: ${game.mine}`}>
          💼 {game.mine}
        </div>
        <p className="text-slate-200" aria-live="polite">You took the Banker's {dealt}. {verdict(dealt)}</p>
        <p className="font-display text-3xl text-neon-yellow">DEAL: {dealt}</p>
        <ArcadeButton color="green" className="w-full" onClick={() => take(dealt)}>Take the {dealt}</ArcadeButton>
      </>
    );
  }
  return (
    <>
      <p className="osd-text text-lg text-neon-cyan">ROUND {round + 1} OF {V.dealOpenPerRound.length}</p>
      <div className="flex flex-wrap justify-center gap-1" aria-label="Cases">
        {V.dealCases.map(v => {
          const gone = opened.includes(v);
          return <span key={v} className={`osd-text text-base leading-none px-2 py-1 rounded ${gone ? 'bg-crt-950 text-slate-600 line-through' : 'bg-neon-yellow/20 text-neon-yellow'}`}>{v}</span>;
        })}
      </div>
      <p className="text-slate-200 text-sm">Crossed-out amounts were in opened cases. Your case is still closed.</p>
      <p className="font-display text-3xl text-neon-yellow">OFFER: +{offer}</p>
      <ArcadeButton color="green" className="w-full" onClick={deal}>Deal</ArcadeButton>
      <ArcadeButton color="red" className="w-full" onClick={noDeal}>{lastRound ? 'No deal: open my case' : 'No deal: open more cases'}</ArcadeButton>
    </>
  );
};

/**
 * No Whammies! (v7.39.1): a Press Your Luck board. A light races around 12 squares; hit STOP and it
 * slows onto a square: cash for the pot, or a Whammy that wipes it. Bank any time. The result is
 * rolled the moment you hit STOP (luck, not timing) and saved, so a quit mid-spin can't reroll it.
 */
const RING = [[0, 0], [0, 1], [0, 2], [0, 3], [1, 3], [2, 3], [3, 3], [3, 2], [3, 1], [3, 0], [2, 0], [1, 0]]; // row, col of each board square
const Whammies: React.FC<{ onResolve: (r: GambleResult) => void }> = ({ onResolve }) => {
  const [pot, setPot] = useSaved('pot', 0);
  const [spins, setSpins] = useSaved('spins', 0);
  // A STOP that's been rolled but not shown yet (saved, so a resume lands it instead of rerolling).
  const [pending, setPending] = useSaved<{ result: number | 'whammy'; square: number } | null>('pending', null);
  // Banking spins the board once more for show: what the next spin would have been.
  const [stopped, setStopped] = useSaved<{ amount: number; spun: number; next: number | 'whammy'; square: number } | null>('stopped', null);
  const [light, setLight] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'racing' | 'slowing'>(pending ? 'slowing' : 'idle');
  const lightRef = useRef(0);
  const settled = useRef(false);

  // Racing: the light jumps around the board until STOP.
  useEffect(() => {
    if (phase !== 'racing') return;
    const t = setInterval(() => { lightRef.current = Math.floor(Math.random() * RING.length); setLight(lightRef.current); soundService.playTileClick(); }, 90);
    return () => clearInterval(t);
  }, [phase]);

  const nextSpinText = (next: number | 'whammy') => (next === 'whammy' ? 'The next spin was a WHAMMY. Good call!' : `The next spin would have added +${next}.`);
  const bank = (amount: number, spun: number, next?: number | 'whammy') =>
    onResolve({ points: amount, headline: `BANKED: +${amount} POINTS`, detail: `You stopped after ${spun} ${spun === 1 ? 'spin' : 'spins'} with no Whammy.${next !== undefined ? ` ${nextSpinText(next)}` : ''}`, tone: 'win' });

  // Slowing: hop around a couple of laps with growing gaps and land on the rolled square.
  const land = (target: number, done: () => void) => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { lightRef.current = target; setLight(target); done(); return; }
    const hops = RING.length + ((target - lightRef.current + RING.length) % RING.length);
    let at = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i <= hops; i++) {
      at += 55 + (i / hops) ** 2 * 320;
      timers.push(setTimeout(() => { lightRef.current = (lightRef.current + 1) % RING.length; setLight(lightRef.current); soundService.playTileClick(); if (i === hops) done(); }, at));
    }
    return () => timers.forEach(clearTimeout);
  };
  useEffect(() => {
    if (phase !== 'slowing' || !pending || settled.current) return;
    return land(pending.square, () => {
      settled.current = true;
      const spun = spins + 1;
      if (pending.result === 'whammy') {
        try { navigator.vibrate?.(120); } catch { /* not supported */ }
        setTimeout(() => onResolve({ points: 0, headline: 'WHAMMY!', detail: pot ? `A Whammy on spin ${spun} wiped your pot of ${pot} points.` : 'A Whammy on the very first spin. No pot to lose, but no prize either.', tone: 'lose' }), 900);
        return;
      }
      const next = pot + pending.result;
      try { navigator.vibrate?.([15, 25, 15]); } catch { /* not supported */ }
      if (spun >= V.whammySpins) { setTimeout(() => bank(next, spun), 700); return; }
      setPot(next); setSpins(spun); setPending(null); setPhase('idle'); settled.current = false;
    });
  }, [phase, pending]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = () => { if (phase === 'idle' && !stopped) { soundService.playPowerUp(); setPhase('racing'); } };
  const stop = () => {
    if (phase !== 'racing') return;
    const result = whammySpin(Math.random(), Math.random());
    setPending({ result, square: whammySquareFor(result) });
    setPhase('slowing');
  };
  const bankNow = () => {
    soundService.playTileClick();
    const next = whammySpin(Math.random(), Math.random());
    const square = whammySquareFor(next);
    setStopped({ amount: pot, spun: spins, next, square });
    land(square, () => {});
  };

  const lit = stopped ? stopped.square : light;
  const landedWhammy = pending?.result === 'whammy' && settled.current;
  return (
    <>
      <div className="relative grid grid-cols-4 gap-1.5 w-full max-w-[19rem]">
        {RING.map(([r, c], i) => {
          const v = WHAMMY_BOARD[i];
          const on = lit === i && (phase !== 'idle' || !!stopped);
          return (
            <div key={i} style={{ gridRow: r + 1, gridColumn: c + 1 }}
              className={`aspect-square rounded-lg grid place-items-center font-display leading-none transition-all duration-75 ring-2 ${
                on ? (v === 'whammy' ? 'bg-neon-red text-white ring-white scale-110 shadow-[0_0_18px_rgba(255,45,85,0.9)]' : 'bg-neon-yellow text-crt-900 ring-white scale-110 shadow-[0_0_18px_rgba(255,226,122,0.9)]')
                  : v === 'whammy' ? 'bg-neon-red/15 text-neon-red ring-neon-red/40' : 'bg-crt-950 text-neon-cyan ring-neon-cyan/30'}`}
              aria-label={v === 'whammy' ? 'Whammy square' : `${v} square`}>
              {v === 'whammy' ? <span className="text-2xl">👺</span> : <span className="text-lg">{v}</span>}
            </div>
          );
        })}
        {/* The middle of the board: the pot */}
        <div className="col-start-2 col-span-2 row-start-2 row-span-2 rounded-xl bg-gradient-to-b from-crt-800 to-crt-950 ring-1 ring-white/15 grid place-items-center text-center px-1">
          <div>
            <p className="osd-text text-sm text-slate-400 leading-none">{landedWhammy ? 'WHAMMY!' : 'POT'}</p>
            <p className={`font-display text-3xl leading-none ${landedWhammy ? 'text-neon-red' : 'text-neon-yellow'}`} aria-live="polite">{landedWhammy ? '👺' : stopped ? stopped.amount : pot}</p>
            <p className="osd-text text-sm text-slate-400 leading-none mt-1">SPIN {Math.min(spins + 1, V.whammySpins)}/{V.whammySpins}</p>
          </div>
        </div>
      </div>
      {stopped ? (
        <>
          <p className="text-slate-200" aria-live="polite">{nextSpinText(stopped.next)}</p>
          <ArcadeButton color="green" className="w-full" onClick={() => bank(stopped.amount, stopped.spun, stopped.next)}>Take the {stopped.amount}</ArcadeButton>
        </>
      ) : phase === 'racing' ? (
        <ArcadeButton color="red" size="lg" className="w-full" onClick={stop}>🛑 STOP!</ArcadeButton>
      ) : phase === 'idle' ? (
        <>
          <p className="text-slate-300 text-sm">Big bucks, no Whammies! {V.whammySpins - spins} {V.whammySpins - spins === 1 ? 'spin' : 'spins'} left. A Whammy wipes the pot.</p>
          <ArcadeButton color="pink" className="w-full" onClick={start}>{spins === 0 ? '🎰 Spin the board!' : '🎰 Spin again'}</ArcadeButton>
          {spins > 0 && <ArcadeButton color="green" variant="outline" className="w-full" onClick={bankNow}>Stop and bank {pot}</ArcadeButton>}
        </>
      ) : <p className="text-slate-300">No whammies, no whammies…</p>}
    </>
  );
};

/** Minesweeper: keep picking squares to grow the pot; the mine wipes it. Bank any time. After a
 * bank the board reveals where the mine was (and the odds the next pick had) before paying out. */
const Mines: React.FC<{ onResolve: (r: GambleResult) => void }> = ({ onResolve }) => {
  const [mine] = useSaved('mine', () => Math.floor(Math.random() * V.minesweeperSquares));
  const [cleared, setCleared] = useSaved<number[]>('cleared', []);
  const [banked, setBanked] = useSaved<{ amount: number; picks: number } | null>('banked', null);
  const pot = minesweeperPot(cleared.length);
  const nextStep = V.minesweeperLadder[cleared.length] ?? 0;
  const boardCleared = (picks: number) => picks === V.minesweeperSquares - 1;
  // Squares still covered when the player banked, the mine among them.
  const leftWhenBanked = V.minesweeperSquares - (banked?.picks ?? 0);
  const take = () => {
    if (!banked) return;
    const { amount, picks } = banked;
    onResolve({
      points: amount, tone: 'win',
      headline: boardCleared(picks) ? `BOARD CLEARED! +${amount}` : `BANKED: +${amount} POINTS`,
      detail: boardCleared(picks)
        ? `You cleared all ${picks} safe squares. The mine was under square ${mine + 1}.`
        : `You cleared ${picks} ${picks === 1 ? 'square' : 'squares'}. The mine was under square ${mine + 1}: your next pick had a 1 in ${leftWhenBanked} chance of hitting it.`,
    });
  };
  const bank = (amount: number, picks: number) => { soundService.playTileClick(); setBanked({ amount, picks }); };
  const pick = (i: number) => {
    if (banked || cleared.includes(i)) return;
    if (i === mine) {
      onResolve({ points: 0, headline: 'BOOM! POT WIPED', detail: `Square ${i + 1} was the mine. Your pot of ${pot} points went up in smoke.`, tone: 'lose' });
      return;
    }
    const now = [...cleared, i];
    soundService.playTileClick();
    setCleared(now);
    if (boardCleared(now.length)) setBanked({ amount: minesweeperPot(now.length), picks: now.length });
  };
  return (
    <>
      {banked ? (
        <p className="text-slate-200" aria-live="polite">
          {boardCleared(banked.picks)
            ? <>Every safe square cleared! The mine was under <strong className="text-neon-red">square {mine + 1}</strong>.</>
            : <>The mine was under <strong className="text-neon-red">square {mine + 1}</strong>. Your next pick had a <strong className="text-white">1 in {leftWhenBanked}</strong> chance of hitting it.</>}
        </p>
      ) : (
        <p className="text-slate-200">One square hides a mine that wipes your pot. Next safe square: +{nextStep}.</p>
      )}
      <p className="font-display text-3xl text-neon-yellow" aria-live="polite">{banked ? `BANKED: ${banked.amount}` : `POT: ${pot}`}</p>
      <div className="grid grid-cols-3 gap-2 w-48">
        {Array.from({ length: V.minesweeperSquares }, (_, i) => {
          const safe = cleared.includes(i);
          const isMine = !!banked && i === mine;
          const unpicked = !!banked && !safe && !isMine; // safe squares the player never opened
          const look = isMine
            ? 'bg-neon-red/25 ring-neon-red text-2xl animate-pulse'
            : safe ? 'bg-crt-950 ring-neon-green/60 text-neon-green'
            : unpicked ? 'bg-crt-950/60 ring-white/15 text-slate-500'
            : 'bg-slate-300 ring-white/60 shadow-[inset_-3px_-3px_0_rgba(0,0,0,0.25)] hover:bg-slate-200';
          return (
            <button key={i} type="button" onClick={() => pick(i)} disabled={safe || !!banked}
              className={`aspect-square rounded-md ring-2 ${look}`}
              aria-label={isMine ? `Square ${i + 1}, the mine` : safe ? `Square ${i + 1}, safe` : unpicked ? `Square ${i + 1}, was safe` : `Square ${i + 1}`}>
              {isMine ? '💣' : safe ? '✓' : unpicked ? '·' : ''}
            </button>
          );
        })}
      </div>
      {banked
        ? <ArcadeButton color="green" className="w-full" onClick={take}>Take the {banked.amount}</ArcadeButton>
        : cleared.length > 0 && <ArcadeButton color="green" className="w-full" onClick={() => bank(pot, cleared.length)}>Stop and bank {pot}</ArcadeButton>}
    </>
  );
};

/** The Price Is Right (v7.28): bid on the next word's score. The bid settles on that word. */
const PriceIsRight: React.FC<{ onResolve: (r: GambleResult) => void }> = ({ onResolve }) => (
  <>
    <p className="text-slate-200">Bid on your next word: it will score at least...</p>
    <div className="grid grid-cols-2 gap-2 w-full">
      {V.priceIsRightBids.map(({ bid, prize, miss }) => (
        <button key={bid} type="button" aria-label={`Bid ${bid} or more: win ${prize}, miss and lose ${miss}`}
          onClick={() => onResolve({ headline: `BID: ${bid}+ POINTS`, detail: `If your next word scores ${bid} or more, you win +${prize}. If not, you lose ${miss}.`, tone: 'neutral', arm: { value: { bid, prize, miss }, description: `Bid ${bid}+: if your next word scores ${bid} or more, win +${prize}. Miss and lose ${miss}.` } })}
          className="rounded-xl bg-crt-950 ring-2 ring-neon-yellow/70 py-3 hover:brightness-125">
          <span className="block font-display text-3xl text-neon-yellow leading-none">{bid}+</span>
          <span className="block osd-text text-lg text-neon-green leading-none mt-1">WIN +{prize}</span>
          <span className="block osd-text text-base text-neon-red leading-none mt-1">MISS -{miss}</span>
        </button>
      ))}
    </div>
    <p className="text-slate-400 text-sm">The score preview above the Submit button shows what a word is worth.</p>
  </>
);

/** Draft Day (v7.28): three face-up packs; the pick replaces the lowest-value tiles in the hand. */
const DraftDay: React.FC<{ onResolve: (r: GambleResult) => void; hand?: (Tile | null)[] }> = ({ onResolve, hand }) => {
  const [packs] = useSaved('packs', () => {
    const letters = shuffleArray(createTileBag()).slice(0, V.draftDayPacks * V.draftDayTiles);
    return Array.from({ length: V.draftDayPacks }, (_, i) => letters.slice(i * V.draftDayTiles, (i + 1) * V.draftDayTiles));
  });
  const lowest = (hand ?? []).filter((t): t is Tile => t !== null).sort((a, b) => (a.tempPoints ?? a.points) - (b.tempPoints ?? b.points)).slice(0, V.draftDayTiles);
  return (
    <>
      <p className="text-slate-200">Pick a pack. It replaces {lowest.length ? <strong className="text-white">{lowest.map(t => t.letter).join(', ')}</strong> : `your ${V.draftDayTiles} lowest tiles`}.</p>
      <div className="flex flex-col gap-2 w-full">
        {packs.map((pack, i) => (
          <button key={i} type="button" aria-label={`Pack ${i + 1}: ${pack.join(', ')}`}
            onClick={() => onResolve({ headline: `DRAFTED: ${pack.join(' ')}`, detail: `${pack.join(', ')} ${lowest.length ? `replace ${lowest.map(t => t.letter).join(', ')}` : 'join your hand'}.`, tone: 'neutral', draft: pack })}
            className="flex items-center justify-center gap-2 rounded-xl bg-crt-950 ring-2 ring-neon-cyan/60 py-2 hover:brightness-125">
            <span className="osd-text text-lg text-neon-cyan w-16">PACK {i + 1}</span>
            {pack.map((l, k) => (
              <span key={k} className="relative w-10 h-10 rounded-md bg-amber-100 text-slate-900 font-tile font-extrabold text-2xl leading-10">
                {l}<span className="absolute bottom-0 right-0.5 font-osd text-xs leading-none">{createTile(l).points}</span>
              </span>
            ))}
          </button>
        ))}
      </div>
    </>
  );
};

/** Card Sharks (v7.28): higher or lower, push your luck. A tie is a free pass. After a bank the
 * next card turns over, so the player sees whether their next call would have been right. */
const CardSharks: React.FC<{ onResolve: (r: GambleResult) => void }> = ({ onResolve }) => {
  const steps = V.cardSharksLadder.length;
  const [card, setCard] = useSaved('card', () => drawCard());
  const [right, setRight] = useSaved('right', 0);
  const [last, setLast] = useSaved<string | null>('last', null);
  const [banked, setBanked] = useSaved<{ amount: number; calls: number; next: number } | null>('banked', null);
  const pot = cardSharksPot(right);
  const verdict = (next: number) =>
    next === card ? `a tie: a free pass either way` : `${next > card ? 'HIGHER' : 'LOWER'} would have been right`;
  const pay = (amount: number, calls: number, next?: number) => onResolve({
    points: amount, tone: 'win',
    headline: calls >= steps ? `RAN THE BOARD! +${amount}` : `BANKED: +${amount} POINTS`,
    detail: `You made ${calls} right ${calls === 1 ? 'call' : 'calls'}.${next !== undefined ? ` The next card was ${cardFace(next)}: ${verdict(next)}.` : ''}`,
  });
  const bank = () => { soundService.playTileClick(); setBanked({ amount: pot, calls: right, next: drawCard() }); };
  const call = (higher: boolean) => {
    if (banked) return;
    const next = drawCard();
    if (next === card) { soundService.playTileClick(); setLast(`${cardFace(next)}: a tie. Free pass!`); setCard(next); return; }
    if ((next > card) !== higher) {
      onResolve({ points: 0, headline: `${cardFace(next)}! WRONG CALL`, detail: `You called ${higher ? 'higher' : 'lower'} than ${cardFace(card)}. ${pot ? `Your pot of ${pot} is gone.` : 'Nothing won this time.'}`, tone: 'lose' });
      return;
    }
    const now = right + 1;
    if (now >= steps) { pay(cardSharksPot(now), now); return; }
    soundService.playTileClick();
    setLast(`${cardFace(next)}: right!`); setRight(now); setCard(next);
  };
  const cardClass = 'w-20 h-28 rounded-xl bg-white text-slate-900 flex items-center justify-center font-display text-5xl shadow-lg';
  if (banked) {
    const tie = banked.next === card;
    return (
      <>
        <div className="flex items-center gap-3">
          <div className={cardClass} aria-label={`Your card: ${cardFace(card)}`}>{cardFace(card)}</div>
          <span className="osd-text text-xl text-slate-400" aria-hidden="true">→</span>
          <div className={`${cardClass} ring-4 ${tie ? 'ring-neon-yellow' : 'ring-neon-cyan'} level-stage-in`} aria-label={`Next card: ${cardFace(banked.next)}`}>{cardFace(banked.next)}</div>
        </div>
        <p className="text-slate-200" aria-live="polite">
          The next card was <strong className="text-white">{cardFace(banked.next)}</strong>: {tie ? <>a tie, so a free pass either way.</> : <><strong className={banked.next > card ? 'text-neon-cyan' : 'text-neon-pink'}>{banked.next > card ? 'HIGHER' : 'LOWER'}</strong> would have been right.</>}
        </p>
        <p className="font-display text-3xl text-neon-yellow">BANKED: {banked.amount}</p>
        <ArcadeButton color="green" className="w-full" onClick={() => pay(banked.amount, banked.calls, banked.next)}>Take the {banked.amount}</ArcadeButton>
      </>
    );
  }
  return (
    <>
      {last && <p className="text-neon-green text-sm">{last}</p>}
      <div className={cardClass} aria-label={`Card: ${cardFace(card)}`}>{cardFace(card)}</div>
      <p className="font-display text-3xl text-neon-yellow" aria-live="polite">POT: {pot}</p>
      <p className="text-slate-200 text-sm">Next right call: {cardSharksPot(right + 1)}. A wrong call wipes the pot.</p>
      <div className="grid grid-cols-2 gap-2 w-full">
        <ArcadeButton color="cyan" onClick={() => call(true)}>Higher</ArcadeButton>
        <ArcadeButton color="pink" onClick={() => call(false)}>Lower</ArcadeButton>
      </div>
      {right > 0 && <ArcadeButton color="green" className="w-full" onClick={bank}>Stop and bank {pot}</ArcadeButton>}
    </>
  );
};

/**
 * Plinko (v7.36.3): slide the chip along the top, drop it, and watch it bounce down the pegs into a
 * slot. The prize is rolled from the same table as before (POWER_PLAY_VALUES.plinko) the moment the
 * chip drops, and saved, so quitting mid-fall replays the same drop; the path is drawn to land there.
 * Each peg clicks and gives a short buzz on phones that support it.
 */
const PLINKO_COL = 36;                       // slot width in the drawing
const PLINKO_TOP = 34;                       // chip's resting line
const PLINKO_ROW_GAP = 27;
const PLINKO_SLOT_Y = PLINKO_TOP + 14 + PLINKO_ROWS * PLINKO_ROW_GAP;
const PLINKO_H = PLINKO_SLOT_Y + 46;
const PLINKO_W = PLINKO_SLOTS.length * PLINKO_COL;
const PLINKO_STEP_MS = 230;
const plinkoX = (col: number) => (col + 0.5) * PLINKO_COL;
const plinkoRowY = (r: number) => PLINKO_TOP + 14 + r * PLINKO_ROW_GAP;
const JACKPOT = Math.max(...PLINKO_SLOTS);

const Plinko: React.FC<{ onResolve: (r: GambleResult) => void }> = ({ onResolve }) => {
  const last = PLINKO_SLOTS.length - 1;
  const [pos, setPos] = useState(last / 2);
  const [drop, setDrop] = useSaved<{ points: number; slot: number; path: number[] } | null>('drop', null);
  const [landed, setLanded] = useSaved('landed', false);
  const [chip, setChip] = useState<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  // The fall: one hop per peg row, a click and a buzz on each peg.
  useEffect(() => {
    if (!drop || landed) return;
    if (reduceMotion) { setLanded(true); return; }
    let raf = 0;
    const t0 = performance.now();
    let lastRow = -1;
    const total = drop.path.length - 1;
    const tick = (now: number) => {
      const t = (now - t0) / PLINKO_STEP_MS;
      const r = Math.min(total, Math.floor(t));
      const f = Math.min(1, t - r);
      if (r !== lastRow) {
        lastRow = r;
        if (r > 0 && r <= total) {
          soundService.playTileClick();
          try { navigator.vibrate?.(r === total ? 25 : 8); } catch { /* not supported */ }
        }
      }
      if (r >= total) { setChip({ x: plinkoX(drop.path[total]), y: PLINKO_SLOT_Y + 14 }); setLanded(true); return; }
      const from = drop.path[r], to = drop.path[r + 1];
      const yFrom = r === 0 ? PLINKO_TOP : plinkoRowY(r - 1) - 9;
      const yTo = r + 1 === total ? PLINKO_SLOT_Y + 14 : plinkoRowY(r) - 9;
      // Falls with gravity (ease-in), with a little hop off the peg it just hit.
      const ease = f * f;
      const hop = r === 0 ? 0 : Math.sin(f * Math.PI) * 7;
      setChip({ x: plinkoX(from + (to - from) * f), y: yFrom + (yTo - yFrom) * ease - hop });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [drop, landed]); // eslint-disable-line react-hooks/exhaustive-deps

  const aimAt = (clientX: number) => {
    const box = svgRef.current?.getBoundingClientRect();
    if (!box || drop) return;
    const col = ((clientX - box.left) / box.width) * PLINKO_SLOTS.length - 0.5;
    setPos(Math.min(last, Math.max(0, col)));
  };
  const nudge = (d: number) => { if (!drop) { soundService.playTileClick(); setPos(p => Math.min(last, Math.max(0, Math.round(p * 2 + d) / 2))); } };
  const release = () => {
    if (drop) return;
    soundService.playPowerUp();
    const points = plinkoPayout(Math.random());
    const slot = plinkoSlotFor(points, pos);
    setDrop({ points, slot, path: plinkoPath(pos, slot) });
  };
  const take = () => {
    if (!drop) return;
    const p = drop.points;
    onResolve({
      points: p,
      headline: p === JACKPOT ? `JACKPOT! +${p} POINTS` : p ? `+${p} POINTS` : 'ZERO SLOT',
      detail: p ? 'The chip bounced your way.' : 'So close. The chip landed in the empty slot.',
      tone: p ? 'win' : 'lose',
    });
  };

  const chipAt = chip ?? (drop && landed ? { x: plinkoX(drop.slot), y: PLINKO_SLOT_Y + 14 } : { x: plinkoX(pos), y: PLINKO_TOP });
  const result = drop && landed ? drop.points : null;
  return (
    <>
      {/* Fixed height, so the card doesn't jump as the line changes. */}
      <p className="text-slate-200 text-sm leading-snug min-h-[2.5rem] flex items-center justify-center" aria-live="polite">
        {!drop ? 'Slide the chip along the top, then drop it. No downside.'
          : !landed ? 'Here it goes…'
          : drop.points === JACKPOT ? 'Dead center. The big one!'
          : drop.points ? `It dropped into the ${drop.points} slot.` : 'Right into a zero. Ouch.'}
      </p>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${PLINKO_W} ${PLINKO_H}`}
        className={`w-full max-w-[22rem] select-none touch-none rounded-xl bg-crt-950 ring-1 ring-white/10 ${drop ? '' : 'cursor-grab'}`}
        role="img"
        aria-label={result !== null ? `The chip landed on ${result || 'zero'}` : 'Plinko board'}
        onPointerDown={e => { if (drop) return; dragging.current = true; (e.target as Element).setPointerCapture?.(e.pointerId); aimAt(e.clientX); }}
        onPointerMove={e => { if (dragging.current) aimAt(e.clientX); }}
        onPointerUp={() => { dragging.current = false; }}
        onPointerCancel={() => { dragging.current = false; }}
      >
        {/* Drop lane */}
        {!drop && <line x1={8} x2={PLINKO_W - 8} y1={PLINKO_TOP} y2={PLINKO_TOP} stroke="rgba(255,255,255,0.12)" strokeWidth={2} strokeDasharray="4 6" />}
        {/* Pegs, staggered */}
        {Array.from({ length: PLINKO_ROWS }, (_, r) => {
          const offset = r % 2 === 0 ? 0.5 : 0;
          const count = r % 2 === 0 ? PLINKO_SLOTS.length - 1 : PLINKO_SLOTS.length;
          return Array.from({ length: count }, (_, c) => (
            <circle key={`${r}-${c}`} cx={(c + offset + 0.5) * PLINKO_COL} cy={plinkoRowY(r)} r={3.2} fill="#c9b8ff" opacity={0.75} />
          ));
        })}
        {/* Slots */}
        {PLINKO_SLOTS.map((p, i) => {
          const hit = result !== null && drop!.slot === i;
          const fill = p === JACKPOT ? '#ffe27a' : p === 0 ? '#64748b' : p >= 700 ? '#ff4dc4' : '#3dff8c';
          return (
            <g key={i}>
              {i > 0 && <line x1={i * PLINKO_COL} x2={i * PLINKO_COL} y1={PLINKO_SLOT_Y - 4} y2={PLINKO_H} stroke="rgba(255,255,255,0.25)" strokeWidth={2} />}
              <rect x={i * PLINKO_COL + 2} y={PLINKO_SLOT_Y + 26} width={PLINKO_COL - 4} height={18} rx={4} fill={hit ? fill : 'transparent'} opacity={hit ? 0.35 : 1} className={hit ? 'animate-pulse' : ''} />
              <text x={plinkoX(i)} y={PLINKO_SLOT_Y + 40} textAnchor="middle" fontSize={p >= 1000 ? 10.5 : 12} fontWeight={700} fill={fill} fontFamily="monospace">
                {p === 0 ? '0' : p >= 1000 ? `${p / 1000}K` : p}
              </text>
            </g>
          );
        })}
        {/* The chip */}
        <circle cx={chipAt.x} cy={chipAt.y} r={10} fill="#ffe27a" stroke="#ff9f1c" strokeWidth={3} style={{ filter: 'drop-shadow(0 0 6px rgba(255,226,122,0.8))' }} />
        <circle cx={chipAt.x - 3} cy={chipAt.y - 3} r={2.5} fill="#fff" opacity={0.8} />
      </svg>
      {result !== null ? (
        <>
          <p className={`font-display text-3xl ${result === JACKPOT ? 'text-neon-yellow' : result ? 'text-neon-green' : 'text-slate-400'}`} aria-live="polite">
            {result === JACKPOT ? `JACKPOT! +${result}` : result ? `+${result}` : 'ZERO!'}
          </p>
          <ArcadeButton color={result ? 'green' : 'slate'} className="w-full" onClick={take}>{result ? `Take the ${result}` : 'Continue'}</ArcadeButton>
        </>
      ) : !drop ? (
        <div className="w-full flex items-center gap-2">
          <ArcadeButton color="slate" variant="outline" onClick={() => nudge(-1)} aria-label="Move the chip left">◀</ArcadeButton>
          <ArcadeButton color="pink" className="flex-1" onClick={release}>▼ Drop the Chip</ArcadeButton>
          <ArcadeButton color="slate" variant="outline" onClick={() => nudge(1)} aria-label="Move the chip right">▶</ArcadeButton>
        </div>
      ) : null}
    </>
  );
};

const buzz = (ms: number | number[]) => { try { navigator.vibrate?.(ms); } catch { /* not supported */ } };
const prefersReducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Hot Tub Time Machine (v7.36.4): hold the lever to crank the year dial, let go, and it spins down
 * onto +25 s, +10 s or -8 s. The result is rolled on release from POWER_PLAY_VALUES.hotTub (odds
 * unchanged) and saved, so quitting mid-spin can't reroll.
 */
const HOT_TUB_YEARS = ['1986', '2006', '2036'];
const HotTub: React.FC<{ onResolve: (r: GambleResult) => void }> = ({ onResolve }) => {
  const outcomes = V.hotTub;
  const [roll, setRoll] = useSaved<number | null>('roll', null);
  const [done, setDone] = useSaved('done', false);
  const [cranking, setCranking] = useState(false);
  const [year, setYear] = useState('2026');
  const [lit, setLit] = useState<number | null>(null);
  const crankStart = useRef(0);

  // Cranking: the year digits whir.
  useEffect(() => {
    if (!cranking) return;
    const t = setInterval(() => { setYear(String(1950 + Math.floor(Math.random() * 99))); }, 55);
    return () => clearInterval(t);
  }, [cranking]);

  // Spin-down: the light runs across the three outcomes, slowing, and stops on the roll.
  useEffect(() => {
    if (roll === null || done) return;
    if (prefersReducedMotion()) { setLit(roll); setYear(HOT_TUB_YEARS[roll]); setDone(true); return; }
    const steps = 11 + ((roll - 11 % outcomes.length + outcomes.length * 3) % outcomes.length); // ends on roll
    const timers: ReturnType<typeof setTimeout>[] = [];
    let at = 0;
    for (let i = 0; i <= steps; i++) {
      at += 60 + i * i * 2.2;
      const idx = i % outcomes.length;
      timers.push(setTimeout(() => {
        setLit(idx);
        setYear(i === steps ? HOT_TUB_YEARS[roll] : String(1950 + Math.floor(Math.random() * 99)));
        soundService.playTileClick();
        if (i === steps) { buzz(outcomes[roll].seconds > 0 ? [20, 40, 20] : 60); if (outcomes[roll].seconds > 0) soundService.playMilestone(); setDone(true); }
      }, at));
    }
    return () => timers.forEach(clearTimeout);
  }, [roll, done]); // eslint-disable-line react-hooks/exhaustive-deps

  const startCrank = () => { if (roll !== null) return; crankStart.current = performance.now(); setCranking(true); soundService.playPowerUp(); buzz(15); };
  const endCrank = () => {
    if (!cranking) return;
    const wait = Math.max(0, 350 - (performance.now() - crankStart.current)); // a tap still cranks a little
    setTimeout(() => { setCranking(false); setRoll(outcomes.findIndex(o => o.seconds === hotTubSeconds(Math.random()))); }, wait);
  };
  const shown = done && roll !== null ? roll : lit;
  const result = done && roll !== null ? outcomes[roll].seconds : null;
  const take = () => result !== null && onResolve({
    seconds: result,
    headline: `${result > 0 ? '+' : ''}${result} SECONDS`,
    detail: result > 0 ? `Great Scott, it worked! You landed in ${HOT_TUB_YEARS[roll!]} with extra time.` : `Overshot to ${HOT_TUB_YEARS[roll!]}. The hot tub went the wrong way: you lost time.`,
    tone: result > 0 ? 'win' : 'lose',
  });

  return (
    <>
      <p className="text-slate-200 text-sm leading-snug min-h-[2.5rem] flex items-center justify-center" aria-live="polite">
        {result !== null ? (result > 0 ? `Welcome to ${HOT_TUB_YEARS[roll!]}! The clock gains ${result} seconds.` : `Whoa, ${HOT_TUB_YEARS[roll!]}?! You lose ${-result} seconds.`)
          : roll !== null ? 'Traveling through time…'
          : cranking ? 'Cranking… let go to travel!' : 'Hold the lever to crank the dial, then let go.'}
      </p>
      {/* The tub: a year dial over bubbling water */}
      <div className="relative w-full rounded-2xl overflow-hidden ring-2 ring-neon-cyan/60 bg-gradient-to-b from-crt-950 to-[#0b3a5c] pt-4 pb-8">
        <p className="osd-text text-sm tracking-[0.3em] text-neon-cyan/80">DESTINATION YEAR</p>
        <p className={`font-osd text-6xl leading-none tabular-nums tracking-widest ${result === null ? 'text-neon-cyan' : result > 0 ? 'text-neon-green' : 'text-neon-red'}`} aria-hidden="true">{year}</p>
        {(cranking || (roll !== null && !done)) && ['12%', '28%', '47%', '63%', '80%', '91%'].map((left, i) => (
          <span key={i} className="tub-bubble absolute bottom-1 w-3 h-3 rounded-full bg-white/60" style={{ left, animationDelay: `${i * 0.21}s` }} aria-hidden="true" />
        ))}
      </div>
      <div className="w-full grid grid-cols-3 gap-2">
        {outcomes.map((o, i) => (
          <div key={i} className={`rounded-xl ring-2 py-2 transition-all ${shown === i ? (o.seconds > 0 ? 'bg-neon-green/25 ring-neon-green scale-105' : 'bg-neon-red/25 ring-neon-red scale-105') : 'bg-crt-950 ring-white/10'}`}>
            <p className={`font-display text-xl leading-none ${o.seconds > 0 ? 'text-neon-green' : 'text-neon-red'}`}>{o.seconds > 0 ? '+' : ''}{o.seconds}s</p>
            <p className="osd-text text-sm leading-none text-slate-400 mt-1">{HOT_TUB_YEARS[i]} · {Math.round(o.chance * 100)}%</p>
          </div>
        ))}
      </div>
      {result !== null ? (
        <ArcadeButton color={result > 0 ? 'green' : 'slate'} className="w-full" onClick={take}>{result > 0 ? `Take +${result}s` : `Take the ${result}s`}</ArcadeButton>
      ) : roll === null ? (
        <ArcadeButton color="cyan" className="w-full select-none touch-none"
          onPointerDown={e => { e.preventDefault(); startCrank(); }} onPointerUp={endCrank} onPointerLeave={endCrank} onPointerCancel={endCrank}
          onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); startCrank(); } }}
          onKeyUp={e => { if (e.key === 'Enter' || e.key === ' ') endCrank(); }}>
          {cranking ? '♨️ Cranking…' : '♨️ Hold to Crank'}
        </ArcadeButton>
      ) : null}
    </>
  );
};

/**
 * Lucky Charms (v7.36.4): shake the cereal box until a charm tumbles out and flips over; with full
 * slots, the charm it bumps out wobbles and pops. The game picks the charm when the PowerPlay is
 * used (it rides in the pop-up's data, so a resume shows the same one); the box only reveals it.
 */
const MARSHMALLOWS = ['⭐', '🌈', '💖', '🍀', '🎈', '🌙', '🐴', '⚡'];
const LuckyCharms: React.FC<{ onResolve: (r: GambleResult) => void; extra?: Record<string, unknown> }> = ({ onResolve, extra }) => {
  const charm = CHARMS_LIST.find(c => c.id === extra?.charmId);
  const replaced = CHARMS_LIST.find(c => c.id === extra?.replaceId);
  const [phase, setPhase] = useSaved<'box' | 'shaking' | 'out'>('phase', 'box');
  const [flipped, setFlipped] = useState(phase === 'out');

  useEffect(() => {
    if (phase !== 'shaking') return;
    if (prefersReducedMotion()) { setPhase('out'); setFlipped(true); return; }
    const rattle = setInterval(() => { soundService.playTileClick(); buzz(10); }, 140);
    const out = setTimeout(() => { clearInterval(rattle); setPhase('out'); buzz(30); }, 1500);
    return () => { clearInterval(rattle); clearTimeout(out); };
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (phase !== 'out' || flipped) return;
    const t = setTimeout(() => { setFlipped(true); soundService.playMilestone(); }, 750);
    return () => clearTimeout(t);
  }, [phase, flipped]);

  if (!charm) return <ArcadeButton color="slate" className="w-full" onClick={() => onResolve({ headline: 'THE BOX WAS EMPTY', detail: 'No charms left to give.', tone: 'neutral' })}>Continue</ArcadeButton>;
  const take = () => onResolve({
    headline: `${charm.icon} ${charm.name.toUpperCase()}`,
    detail: `${charm.description}${replaced ? `\n\nIt replaced ${replaced.icon} ${replaced.name}.` : ''}`,
    tone: 'neutral',
    charm: { id: charm.id, replaceId: replaced?.id },
  });

  return (
    <>
      <p className="text-slate-200 text-sm leading-snug min-h-[2.5rem] flex items-center justify-center" aria-live="polite">
        {phase === 'box' ? 'Shake the box and see what falls out. Any charm can drop, even the trade-offs.'
          : phase === 'shaking' ? 'Shake, shake, shake…'
          : !flipped ? 'Something fell out!' : `You got ${charm.name}!`}
      </p>
      {phase !== 'out' ? (
        // The cereal box
        <div className={`relative w-40 h-48 rounded-lg ring-4 ring-neon-yellow/80 bg-gradient-to-b from-[#ff4d6d] via-[#ff7a3d] to-[#ffd23f] shadow-[0_0_24px_rgba(255,210,63,0.45)] flex flex-col items-center justify-between py-3 ${phase === 'shaking' ? 'cereal-shake' : ''}`} aria-hidden="true">
          <p className="font-display text-lg leading-none text-white drop-shadow">LUCKY</p>
          <div className="grid grid-cols-4 gap-0.5 text-2xl leading-none">{MARSHMALLOWS.map(m => <span key={m}>{m}</span>)}</div>
          <p className="font-display text-lg leading-none text-white drop-shadow">CHARMS</p>
        </div>
      ) : (
        <div className="w-full flex flex-col items-center gap-2" style={{ perspective: 600 }}>
          {!flipped ? (
            <div className="charm-tumble w-24 h-24 rounded-2xl bg-gradient-to-br from-neon-purple to-neon-pink ring-4 ring-white/70 grid place-items-center text-5xl" aria-hidden="true">🍀</div>
          ) : (
            <div className="charm-flip w-full rounded-xl ring-2 ring-neon-purple bg-crt-950/80 p-3 text-left flex items-start gap-3">
              <span className="text-4xl leading-none" aria-hidden="true">{charm.icon}</span>
              <div className="min-w-0">
                <p className="font-display text-base text-white leading-tight">{charm.name}</p>
                <p className="text-sm text-slate-200 leading-snug mt-0.5">{charm.description}</p>
              </div>
            </div>
          )}
          {flipped && replaced && (
            <div className="w-full rounded-xl ring-1 ring-neon-red/60 bg-neon-red/10 p-2 flex items-center gap-2 text-left">
              <span className="slot-wobble text-3xl leading-none inline-block" aria-hidden="true">{replaced.icon}</span>
              <p className="text-sm text-slate-200 leading-snug">Your slots are full, so it bumps out <strong className="text-white">{replaced.name}</strong>.</p>
            </div>
          )}
        </div>
      )}
      {phase === 'box' && <ArcadeButton color="green" className="w-full" onClick={() => { soundService.playPowerUp(); setPhase('shaking'); }}>🍀 Shake the Box</ArcadeButton>}
      {phase === 'out' && flipped && <ArcadeButton color="purple" className="w-full" onClick={take}>Equip {charm.icon} {charm.name}</ArcadeButton>}
    </>
  );
};

const GAMES: Record<string, React.FC<{ onResolve: (r: GambleResult) => void; hand?: (Tile | null)[]; extra?: Record<string, unknown> }>> = {
  letsMakeADeal: Doors, dealOrNoDeal: Deal, noWhammies: Whammies, minesweeper: Mines,
  priceIsRight: PriceIsRight, draftDay: DraftDay, cardSharks: CardSharks, plinko: Plinko,
  hotTubTimeMachine: HotTub, luckyCharms: LuckyCharms,
};

/** The interactive part of a gamble PowerPlay. */
const GambleCard: React.FC<{ id: string; icon: string; name: string; onResolve: (r: GambleResult) => void; hand?: (Tile | null)[]; saved?: Record<string, unknown>; onSave?: (key: string, value: unknown) => void; extra?: Record<string, unknown> }> = ({ id, icon, name, onResolve, hand, saved, onSave, extra }) => {
  const Game = GAMES[id];
  if (!Game) return null;
  return (
    <GambleSave.Provider value={{ saved, save: onSave }}>
      <Frame icon={icon} name={name}><Game onResolve={onResolve} hand={hand} extra={extra} /></Frame>
    </GambleSave.Provider>
  );
};

export const GAMBLE_CARD_IDS = Object.keys(GAMES);
export default GambleCard;
