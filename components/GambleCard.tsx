import { hotTubIndex, wildcardIndex, MISSIONS, missionById } from '../services/rules';
import { Sec } from './Seconds';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import ArcadeButton, { NamedLabel } from './ArcadeButton';
import { POWER_PLAY_VALUES as V, TIME_BONUS } from '../config/gameplay';
import { dealDoors, minesweeperPot, bankerOffer, dealGame, cardSharksPot, drawCard, cardFace, hotTubSeconds, WHAMMY_BOARD, whammySpin, whammySquareFor, PLINKO_SLOTS, PLINKO_ROWS, plinkoSlotFor, plinkoPath, plinkoPayout, blackjackHands, blackjackTotal, blackjackResult, blackjackPrize, gumpRoll, type GumpPrize, fortuneRoll, fortunePoints, FORTUNE_ANSWERS, type FortuneKind } from '../services/rules';
import { createTile, createTileBag, shuffleArray } from '../services/gameUtils';
import { timesProblem, type TimesProblem } from '../services/miniGameRules';
import type { Tile } from '../types';
import { CHARMS_LIST } from '../data/charms';
import { SHARD_CHARMS } from '../data/triforce';
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
  /** WILDCARD: a free tile of this letter joins the hand. */
  tile?: string;
  /** Scrooge's Money Bin (v7.55.0): Credits caught (paid outside the run). */
  credits?: number;
  /** Gump Luck (v7.67.1): extra shuffles. */
  shuffles?: number;
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

/**
 * Let's Make a Deal (v7.68.0, the owner's design): one row of doors, 4 prizes and 1 Zonk, dealt once
 * and saved. Open a door: a prize stays open and joins the pot, then bank or open another. The
 * Zonk wipes the pot. Find all 4 prizes for a bonus. When it's over, every door turns over.
 */
const Doors: React.FC<{ onResolve: (r: GambleResult) => void }> = ({ onResolve }) => {
  const [doors] = useSaved('board', () => dealDoors());
  const [opened, setOpened] = useSaved<number[]>('opened', []);
  const [banked, setBanked] = useSaved<boolean>('banked', false);
  const zonkAt = doors.indexOf(0);
  const zonked = opened.includes(zonkAt);
  const found = opened.filter(i => doors[i] > 0);
  const pot = found.reduce((t, i) => t + doors[i], 0); // before a Zonk
  const prizesLeft = doors.filter((d, i) => d > 0 && !opened.includes(i)).length;
  const swept = !zonked && prizesLeft === 0;
  const over = zonked || swept || banked;
  const lastOpened = opened.length ? opened[opened.length - 1] : -1;
  const open = (i: number) => {
    if (over || opened.includes(i)) return;
    if (doors[i] === 0) { soundService.playInvalidWord(); try { navigator.vibrate?.([60, 30, 60]); } catch { /* */ } }
    else { soundService.playTileClick(); try { navigator.vibrate?.(12); } catch { /* */ } }
    setOpened([...opened, i]);
  };
  const total = swept ? pot + V.doorSweepBonus : pot;
  const finish = () => {
    if (zonked) onResolve({ points: 0, headline: `DOOR ${zonkAt + 1}: ZONK!`, detail: pot ? `The Zonk took your pot of ${pot} points.` : 'The Zonk was behind your first door. Nothing won this time.', tone: 'lose' });
    else if (swept) onResolve({ points: total, headline: `ALL 4 PRIZES! +${total}`, detail: `You opened every prize door (${pot}) and dodged the Zonk: +${V.doorSweepBonus} more.`, tone: 'win' });
    else onResolve({ points: pot, headline: `BANKED: +${pot}`, detail: `You opened ${found.length} ${found.length === 1 ? 'door' : 'doors'} and walked away. The Zonk was behind door ${zonkAt + 1}.`, tone: 'win' });
  };
  return (
    <>
      <p className="text-slate-200 text-sm leading-snug">
        {V.doorPrizes.length} doors hide prizes ({V.doorPrizes.map(p => `+${p}`).join(', ')}). 1 hides the <strong className="text-neon-red">Zonk</strong>, which wipes your pot.
        Open doors one at a time and walk away whenever you like. Find all {V.doorPrizes.length} for +{V.doorSweepBonus} more.
      </p>
      <p className="font-display text-3xl text-neon-yellow" aria-live="polite">{zonked ? 'ZONK! POT: 0' : swept ? `POT: ${pot} +${V.doorSweepBonus}` : `POT: ${pot}`}</p>
      <div className="grid grid-cols-5 gap-1.5 w-full" style={{ perspective: '600px' }}>
        {doors.map((d, i) => {
          const isOpen = opened.includes(i);
          const turned = !isOpen && over; // turned over at the end: what you passed up
          const zonk = d === 0;
          return (
            <button key={i} type="button" data-testid="deal-door" disabled={isOpen || over} onClick={() => open(i)}
              aria-label={isOpen || turned ? `Door ${i + 1}: ${zonk ? 'Zonk' : `+${d}`}${turned ? ' (not opened)' : ''}` : `Door ${i + 1}`}
              className={`aspect-[3/4] rounded-lg flex flex-col items-center justify-center select-none transition-transform active:scale-95 ${
                isOpen ? `${zonk ? 'bg-neon-red/25 ring-2 ring-neon-red' : 'bg-neon-green/20 ring-2 ring-neon-green'} ${i === lastOpened ? 'door-swing' : ''}`
                : turned ? `bg-crt-950/60 border-2 border-dashed ${zonk ? 'border-neon-red/60' : 'border-white/40'} opacity-75`
                : 'bg-gradient-to-b from-[#8b5a2b] to-[#5a3a1a] ring-2 ring-neon-yellow/70 hover:brightness-110'}`}>
              {isOpen || turned ? (
                <>
                  <span className="text-2xl leading-none" aria-hidden="true">{zonk ? '🐐' : '💰'}</span>
                  <span className={`font-display text-sm leading-tight mt-1 ${zonk ? 'text-neon-red' : 'text-white'}`}>{zonk ? 'ZONK' : `+${d}`}</span>
                  {turned && <span className="osd-text text-[0.65rem] leading-none text-slate-400 mt-0.5">{zonk ? 'DODGED' : 'MISSED'}</span>}
                </>
              ) : (
                <>
                  <span className="text-2xl leading-none" aria-hidden="true">🚪</span>
                  <span className="font-display text-lg leading-none text-neon-yellow mt-1">{i + 1}</span>
                </>
              )}
            </button>
          );
        })}
      </div>
      <p className="osd-text text-base leading-tight text-slate-300 min-h-[1.25rem]" aria-live="polite">
        {zonked ? `🐐 ZONK! THE GOAT ATE YOUR POT` : swept ? '🎉 YOU CLEANED OUT THE SHOWROOM!' : banked ? 'HERE\'S WHAT WAS BEHIND THE OTHER DOORS'
          : opened.length === 0 ? 'PICK A DOOR' : `${prizesLeft} ${prizesLeft === 1 ? 'PRIZE' : 'PRIZES'} AND 1 ZONK LEFT: ODDS ${prizesLeft} IN ${prizesLeft + 1}`}
      </p>
      {over ? (
        <ArcadeButton color={zonked ? 'red' : 'green'} className="w-full" onClick={finish}>{zonked ? 'Continue' : `Take the ${total}`}</ArcadeButton>
      ) : pot > 0 ? (
        <ArcadeButton color="green" className="w-full" onClick={() => { soundService.playTileClick(); setBanked(true); }}>Take the {pot} and walk away</ArcadeButton>
      ) : null}
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
    <p className="text-slate-400 text-sm">Tip: long words, multiplier tiles and your charms all add up. A typical word scores 15 to 40.</p>
  </>
);

/**
 * Psychic Friends Network (v7.54.0): call your next word's length. The call settles on that word;
 * prizes follow how often a hand can spell each length (POWER_PLAY_VALUES.psychicCalls).
 */
const PsychicCall: React.FC<{ onResolve: (r: GambleResult) => void }> = ({ onResolve }) => (
  <>
    <p className="text-slate-200">"I'm seeing... a word. How many letters will it have?"</p>
    <div className="grid grid-cols-2 gap-2 w-full">
      {V.psychicCalls.map(({ letters, prize, orMore }) => {
        const label = `${letters}${orMore ? '+' : ''}`;
        return (
          <button key={letters} type="button" aria-label={`Call ${label} letters: win ${prize}`}
            onClick={() => onResolve({ headline: `YOU CALLED ${label} LETTERS`, detail: `If your next word has ${orMore ? `${letters} or more` : `exactly ${letters}`} letters, you win +${prize}. A wrong call costs nothing.`, tone: 'neutral', arm: { value: { letters, prize, orMore: !!orMore }, description: `Called ${label} letters: if your next word has ${orMore ? `${letters} or more` : `exactly ${letters}`}, win +${prize}.` } })}
            className={`rounded-xl bg-crt-950 ring-2 ring-neon-purple/70 py-3 hover:brightness-125 ${orMore ? 'col-span-2' : ''}`}>
            <span className="block font-display text-3xl text-white leading-none">{label} <span className="text-lg">LETTERS</span></span>
            <span className="block osd-text text-lg text-neon-green leading-none mt-1">WIN +{prize}</span>
          </button>
        );
      })}
    </div>
    <p className="text-slate-400 text-sm">Long words are harder to find in a hand, so they pay more.</p>
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
  const rolling = useRef(false);

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
    // One roll, made once. (It used to be rolled again for each outcome it was compared with, so
    // 29% of spins matched nothing and froze the card, and the odds were off: v7.44.4.)
    if (rolling.current) return; // letting go fires more than one event; roll once
    rolling.current = true;
    setTimeout(() => { setCranking(false); setRoll(hotTubIndex(Math.random())); }, wait);
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
            <p className={`font-display text-xl leading-none ${o.seconds > 0 ? 'text-neon-green' : 'text-neon-red'}`}>{o.seconds > 0 ? '+' : ''}{o.seconds}<Sec /></p>
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
  const charm = [...CHARMS_LIST, ...SHARD_CHARMS].find(c => c.id === extra?.charmId); // v7.69.1: a shard can fall out
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
      {phase === 'out' && flipped && <ArcadeButton color="purple" className="w-full" onClick={take}>{charm.fragile ? '🔺 Take the shard' : <NamedLabel action="Equip" icon={charm.icon} name={charm.name} />}</ArcadeButton>}
    </>
  );
};

/**
 * WILDCARD (v7.50.0): the owner's GIF plays over a wheel of four. SPIN runs a light around the
 * four outcomes, slowing onto the roll (made once and saved, so a quit can't reroll). A free tile
 * opens a letter picker; the tile joins this hand only. The clip is an animated WebP at
 * public/powerplays/wildcard.webp (v7.50.1: 75 KB, from a 1 MB GIF); if it fails to load the card
 * shows a spinning 🎡 instead.
 */
export const WILDCARD_GIF = `${import.meta.env.BASE_URL ?? '/'}powerplays/wildcard.webp`;
const WILDCARD_FACES = [
  { icon: '⏱️', tone: 'text-neon-green', ring: 'ring-neon-green', bg: 'bg-neon-green/25' },
  { icon: '💰', tone: 'text-neon-yellow', ring: 'ring-neon-yellow', bg: 'bg-neon-yellow/25' },
  { icon: '🔤', tone: 'text-neon-cyan', ring: 'ring-neon-cyan', bg: 'bg-neon-cyan/25' },
  { icon: '❌', tone: 'text-neon-red', ring: 'ring-neon-red', bg: 'bg-neon-red/25' },
];
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const Wildcard: React.FC<{ onResolve: (r: GambleResult) => void; extra?: Record<string, unknown> }> = ({ onResolve, extra }) => {
  const outcomes = V.wildcard;
  const [roll, setRoll] = useSaved<number | null>('roll', null);
  const [done, setDone] = useSaved('done', false);
  const [letter, setLetter] = useSaved<string | null>('letter', null);
  const [lit, setLit] = useState<number | null>(null);
  const [gifOk, setGifOk] = useState(true);
  const rolled = useRef(false);
  const shielded = !!extra?.shielded;
  const label = (i: number) => {
    const o = outcomes[i];
    return o.kind === 'time' ? <>+{o.seconds}<Sec /></> : o.kind === 'points' ? `+${o.points}` : o.kind === 'tile' ? 'FREE TILE' : 'STRIKE';
  };

  // The spin: the light runs around the four (clockwise on the 2x2 grid), slowing onto the roll.
  useEffect(() => {
    if (roll === null || done) return;
    if (prefersReducedMotion()) { setLit(roll); setDone(true); return; }
    const order = [0, 1, 3, 2]; // clockwise around a 2x2 grid
    const endAt = order.indexOf(roll);
    const steps = 16 + endAt;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let at = 0;
    for (let i = 0; i <= steps; i++) {
      at += 55 + i * i * 1.6;
      const idx = order[i % 4];
      timers.push(setTimeout(() => {
        setLit(idx);
        soundService.playTileClick();
        if (i === steps) {
          const bad = outcomes[roll].kind === 'strike';
          buzz(bad ? 80 : [20, 40, 20]);
          if (!bad) soundService.playMilestone();
          setDone(true);
        }
      }, at));
    }
    return () => timers.forEach(clearTimeout);
  }, [roll, done]); // eslint-disable-line react-hooks/exhaustive-deps

  const spin = () => {
    if (roll !== null || rolled.current) return;
    rolled.current = true;
    soundService.playPowerUp(); buzz(15);
    setRoll(wildcardIndex(Math.random()));
  };
  const result = done && roll !== null ? outcomes[roll] : null;
  const shown = done && roll !== null ? roll : lit;
  const take = () => {
    if (!result) return;
    if (result.kind === 'time') onResolve({ seconds: result.seconds, headline: `+${result.seconds} SECONDS`, detail: 'The wheel landed on time. Your clock gets a little extra.', tone: 'win' });
    else if (result.kind === 'points') onResolve({ points: result.points, headline: `+${result.points} POINTS`, detail: 'The wheel landed on cash. Straight to your score.', tone: 'win' });
    else if (result.kind === 'tile' && letter) onResolve({ tile: letter, headline: `FREE TILE: ${letter}`, detail: `A ${letter} tile joins your hand. It's yours for this hand only, so use it before your next word.`, tone: 'win' });
    else if (result.kind === 'strike') onResolve({ strike: true, headline: shielded ? 'STRIKE BLOCKED' : 'STRIKE!', detail: shielded ? 'The wheel landed on a strike, but your shield took the hit.' : 'The wheel landed on a strike. Wildcard giveth, wildcard taketh away.', tone: shielded ? 'neutral' : 'lose' });
  };

  return (
    <>
      {gifOk ? (
        <img src={WILDCARD_GIF} alt="" aria-hidden="true" onError={() => setGifOk(false)}
          className="w-full max-h-40 object-contain rounded-xl ring-2 ring-neon-pink/60 bg-crt-950" />
      ) : (
        <div className={`text-6xl leading-none ${roll !== null && !done ? 'animate-spin' : ''}`} aria-hidden="true">🎡</div>
      )}
      <p className="text-slate-200 text-sm leading-snug min-h-[2.5rem] flex items-center justify-center" aria-live="polite">
        {result ? (result.kind === 'tile' ? (letter ? `Your free tile: ${letter}. It's yours for this hand.` : 'A free tile! Pick any letter for this hand.')
            : result.kind === 'strike' ? (shielded ? 'A strike! Your shield blocks it.' : 'Ouch, a strike!')
            : result.kind === 'time' ? `+${result.seconds} seconds on the clock!` : `+${result.points} points!`)
          : roll !== null ? 'Round and round it goes…' : 'Spin the wheel. Three prizes and one strike.'}
      </p>
      <div className="w-full grid grid-cols-2 gap-2">
        {outcomes.map((o, i) => (
          <div key={i} className={`rounded-xl ring-2 py-2 transition-all ${shown === i ? `${WILDCARD_FACES[i].bg} ${WILDCARD_FACES[i].ring} scale-105` : 'bg-crt-950 ring-white/10'}`}>
            <p className="text-2xl leading-none" aria-hidden="true">{WILDCARD_FACES[i].icon}</p>
            <p className={`font-display text-lg leading-tight mt-1 ${WILDCARD_FACES[i].tone}`}>{label(i)}</p>
            <p className="osd-text text-sm leading-none text-slate-400">{Math.round(o.chance * 100)}%</p>
          </div>
        ))}
      </div>
      {result?.kind === 'tile' && (
        <div className="w-full grid grid-cols-7 gap-1" role="group" aria-label="Pick your free letter">
          {ALPHABET.map(l => (
            <button key={l} type="button" aria-label={`Letter ${l}`} aria-pressed={letter === l} onClick={() => { soundService.playTileClick(); setLetter(l); }}
              className={`aspect-square rounded-md grid place-items-center font-tile font-extrabold text-lg tile-3d select-none ${letter === l ? 'bg-neon-yellow text-crt-900 -translate-y-0.5' : 'bg-[#f6e7c1] text-crt-900'}`}>{l}</button>
          ))}
        </div>
      )}
      {roll === null ? (
        <ArcadeButton color="pink" className="w-full" onClick={spin}>🎡 Spin the Wheel</ArcadeButton>
      ) : result ? (
        result.kind === 'tile' ? (
          <ArcadeButton color="green" className="w-full" disabled={!letter} onClick={take}>{letter ? `Take the ${letter}` : 'Pick a letter'}</ArcadeButton>
        ) : (
          <ArcadeButton color={result.kind === 'strike' ? 'slate' : 'green'} className="w-full" onClick={take}>
            {result.kind === 'strike' ? (shielded ? 'Continue' : 'Take the strike') : result.kind === 'time' ? `Take +${result.seconds}s` : `Take +${result.points}`}
          </ArcadeButton>
        )
      ) : null}
    </>
  );
};

// --- v7.55.0 reworks: five low-pick PowerPlays become quick arcade cards ----------------------

/** A countdown in real time that calls onEnd once; returns ms left. */
const useCountdown = (running: boolean, ms: number, onEnd: () => void) => {
  const [left, setLeft] = useState(ms);
  const ended = useRef(false);
  useEffect(() => {
    if (!running) return;
    const start = performance.now();
    const t = setInterval(() => {
      const l = Math.max(0, ms - (performance.now() - start));
      setLeft(l);
      if (l <= 0 && !ended.current) { ended.current = true; clearInterval(t); onEnd(); }
    }, 50);
    return () => clearInterval(t);
  }, [running]); // eslint-disable-line react-hooks/exhaustive-deps
  return left;
};
const SecsLeft: React.FC<{ ms: number }> = ({ ms }) => <span className={`osd-text text-2xl leading-none ${ms < 3000 ? 'text-neon-red' : 'text-white'}`}>{Math.ceil(ms / 1000)}<Sec /></span>;

/** Shake It Like a Polaroid: tap as fast as you can; the photo develops as you shake. */
const Polaroid: React.FC<{ onResolve: (r: GambleResult) => void }> = ({ onResolve }) => {
  const [phase, setPhase] = useSaved<'ready' | 'shaking' | 'done'>('phase', 'ready');
  const [shakes, setShakes] = useSaved('shakes', 0);
  const count = useRef(shakes);
  const pointsFor = (n: number) => Math.min(V.polaroidMax, Math.floor(n / V.polaroidShakesPerStep) * V.polaroidPoints);
  const left = useCountdown(phase === 'shaking', V.polaroidSeconds * 1000, () => { setShakes(count.current); setPhase('done'); soundService.playMilestone(); });
  const shake = () => {
    if (phase === 'done') return;
    if (phase === 'ready') setPhase('shaking');
    count.current += 1; setShakes(count.current); soundService.playTileClick(); buzz(8);
  };
  const pts = pointsFor(shakes);
  const developed = Math.min(1, pts / V.polaroidMax);
  return (
    <>
      <p className="text-slate-200 text-sm">{phase === 'ready' ? `Tap the photo as fast as you can. You have ${V.polaroidSeconds} seconds once you start.` : phase === 'shaking' ? 'Shake it! Shake it!' : `Developed! ${shakes} shakes.`}</p>
      <button type="button" onPointerDown={e => { e.preventDefault(); shake(); }} disabled={phase === 'done'} aria-label="Shake the Polaroid"
        className={`select-none touch-none bg-white rounded-sm p-2 pb-8 w-44 shadow-xl ${phase === 'shaking' ? 'animate-[wiggle_0.15s_ease-in-out_infinite]' : ''}`} style={{ transform: phase === 'shaking' ? `rotate(${(shakes % 2 ? 4 : -4)}deg)` : undefined }}>
        <div className="w-40 h-40 bg-gradient-to-br from-slate-800 to-slate-900 grid place-items-center overflow-hidden">
          <span className="text-7xl transition-opacity" style={{ opacity: developed }} aria-hidden="true">🤩</span>
        </div>
      </button>
      <div className="w-full flex justify-between items-baseline">
        <span className="osd-text text-xl text-neon-yellow">+{pts}</span>
        {phase !== 'done' ? <SecsLeft ms={left} /> : <span className="osd-text text-lg text-slate-400">{shakes} SHAKES</span>}
      </div>
      {phase === 'done' && <ArcadeButton color="green" className="w-full" onClick={() => onResolve({ points: pts, headline: pts ? `+${pts} POINTS` : 'UNDERDEVELOPED', detail: `${shakes} shakes developed the photo. ${pts ? 'Picture perfect!' : 'Shake it harder next time.'}`, tone: pts ? 'win' : 'neutral' })}>{pts ? `Take +${pts}` : 'Continue'}</ArcadeButton>}
    </>
  );
};

/**
 * Duck Hunt (v7.66.2: it was too easy, every duck was a sure hit). Ducks now cross faster and
 * zigzag, 🕊️ doves fly among them and the 🐕 dog pops out of the grass: hitting a dove or the dog
 * costs points. The flight plan is saved, so a resume can't redeal it.
 */
type DuckBird = { at: number; y: number; ltr: boolean; kind: 'duck' | 'dove'; wobble: number };
const dealFlock = (): { birds: DuckBird[]; dogs: { at: number; x: number }[] } => {
  const birds: DuckBird[] = [];
  for (let at = 0; at <= V.duckSeconds * 1000 - V.duckFlightMs; at += V.duckEveryMs) {
    birds.push({ at, y: 6 + Math.random() * 60, ltr: Math.random() < 0.5, kind: Math.random() < V.duckDoveChance ? 'dove' : 'duck', wobble: 0.6 + Math.random() * 0.8 });
  }
  if (!birds.some(b => b.kind === 'duck')) birds[0].kind = 'duck';
  const dogs = Array.from({ length: V.duckDogs }, (_, i) => ({ at: 1500 + i * ((V.duckSeconds * 1000 - 2500) / V.duckDogs) + Math.random() * 600, x: 12 + Math.random() * 70 }));
  return { birds, dogs };
};
const DuckHunt: React.FC<{ onResolve: (r: GambleResult) => void }> = ({ onResolve }) => {
  const [phase, setPhase] = useSaved<'ready' | 'flying' | 'done'>('phase', 'ready');
  const [hits, setHits] = useSaved<number[]>('hits2', []);
  const [dogHits, setDogHits] = useSaved<number[]>('dogHits', []);
  const [flock] = useSaved('flock', dealFlock);
  const [now, setNow] = useState(0);
  const startRef = useRef(0);
  useEffect(() => {
    if (phase !== 'flying') return;
    startRef.current = performance.now();
    const t = setInterval(() => setNow(performance.now() - startRef.current), 33);
    return () => clearInterval(t);
  }, [phase]);
  const left = useCountdown(phase === 'flying', V.duckSeconds * 1000, () => { setPhase('done'); soundService.playMilestone(); });
  const ducksHit = hits.filter(i => flock.birds[i]?.kind === 'duck').length;
  const fouls = hits.length - ducksHit + dogHits.length;
  const pts = Math.max(0, ducksHit * V.duckPoints - fouls * V.duckPenalty);
  const totalDucks = flock.birds.filter(b => b.kind === 'duck').length;
  const shoot = (i: number) => {
    if (phase !== 'flying' || hits.includes(i)) return;
    setHits([...hits, i]);
    if (flock.birds[i].kind === 'duck') { soundService.playValidWord(); buzz(20); } else { soundService.playInvalidWord(); buzz([40, 30, 40]); }
  };
  const shootDog = (j: number) => {
    if (phase !== 'flying' || dogHits.includes(j)) return;
    setDogHits([...dogHits, j]); soundService.playInvalidWord(); buzz([60, 30, 60]);
  };
  return (
    <>
      <p className="text-slate-200 text-sm leading-snug">{phase === 'ready'
        ? <>Shoot the <strong className="text-white">🦆 ducks</strong>: +{V.duckPoints} each. They're fast! Don't hit the <strong className="text-white">🕊️ doves</strong> or the <strong className="text-white">🐕 dog</strong>: −{V.duckPenalty} each. {V.duckSeconds} seconds.</>
        : phase === 'flying' ? 'Ducks only! Pull!' : ducksHit ? `${ducksHit} of ${totalDucks} ducks down${fouls ? `, ${fouls} oops` : ''}!` : 'The dog is laughing at you. 🐕'}</p>
      <div className="relative w-full h-56 rounded-xl overflow-hidden ring-2 ring-neon-cyan/50 bg-gradient-to-b from-sky-500 to-sky-300">
        <div className="absolute bottom-0 inset-x-0 h-10 bg-gradient-to-b from-green-600 to-green-800 z-10" />
        {phase === 'flying' && flock.birds.map((d, i) => {
          const t = (now - d.at) / V.duckFlightMs;
          if (t < 0 || t > 1) return null;
          const x = d.ltr ? t * 110 - 10 : 100 - t * 110;
          const shot = hits.includes(i);
          const y = shot ? d.y + t * 60 : d.y + Math.sin(t * 12 * d.wobble) * V.duckZigzag; // a real zigzag now
          return (
            <button key={i} type="button" onPointerDown={e => { e.preventDefault(); shoot(i); }} aria-label={d.kind === 'duck' ? `Duck ${i + 1}` : `Dove ${i + 1}, don't shoot`}
              className="absolute text-3xl leading-none select-none touch-none p-1" style={{ left: `${x}%`, top: `${y}%`, transform: `scaleX(${d.ltr ? -1 : 1})`, opacity: shot ? 0.5 : 1 }}>
              {shot ? (d.kind === 'duck' ? '💥' : '❌') : d.kind === 'duck' ? '🦆' : '🕊️'}
            </button>
          );
        })}
        {phase === 'flying' && flock.dogs.map((g, j) => {
          const t = now - g.at;
          if (t < 0 || t > V.duckDogMs) return null;
          const rise = Math.min(1, t / 200, (V.duckDogMs - t) / 200);
          return (
            <button key={`dog${j}`} type="button" onPointerDown={e => { e.preventDefault(); shootDog(j); }} aria-label="The dog, don't shoot"
              className="absolute text-4xl leading-none select-none touch-none z-0" style={{ left: `${g.x}%`, bottom: `${-6 + rise * 34}px` }}>
              {dogHits.includes(j) ? '😵' : '🐕'}
            </button>
          );
        })}
        {phase === 'ready' && <div className="absolute inset-0 grid place-items-center text-6xl z-20" aria-hidden="true">🔫</div>}
      </div>
      <div className="w-full flex justify-between items-baseline"><span className="osd-text text-xl text-neon-yellow">🦆{ducksHit}{fouls ? ` · ❌${fouls}` : ''} = +{pts}</span>{phase === 'flying' && <SecsLeft ms={left} />}</div>
      {phase === 'ready' && <ArcadeButton color="cyan" className="w-full" onClick={() => { soundService.playPowerUp(); setPhase('flying'); }}>🦆 Pull!</ArcadeButton>}
      {phase === 'done' && <ArcadeButton color="green" className="w-full" onClick={() => onResolve({ points: pts, headline: pts ? `+${pts} POINTS` : 'NO DUCKS', detail: `You shot ${ducksHit} of ${totalDucks} ducks${fouls ? ` and hit ${fouls} ${fouls === 1 ? 'thing' : 'things'} you shouldn't have (−${fouls * V.duckPenalty})` : ''}.`, tone: pts ? 'win' : 'neutral' })}>{pts ? `Take +${pts}` : 'Continue'}</ArcadeButton>}
    </>
  );
};

/**
 * Scrooge's Money Bin (v7.55.1): coins rain down, worth 1, 2 or 3 seconds of clock; the faster a
 * coin falls, the more it's worth. Tap to catch, capped at moneyBinMaxSeconds. The rain is saved,
 * so a resume can't redeal it.
 */
const MoneyBin: React.FC<{ onResolve: (r: GambleResult) => void }> = ({ onResolve }) => {
  const [phase, setPhase] = useSaved<'ready' | 'raining' | 'done'>('phase', 'ready');
  const [caught, setCaught] = useSaved<number[]>('caughtSec', []);
  const [coins] = useSaved('coinsSec', () => {
    const out: { at: number; x: number; seconds: number; fallMs: number }[] = [];
    const total = V.moneyBinCoins.reduce((a, c) => a + c.weight, 0);
    for (let at = 0; ; at += 450) {
      let r = Math.random() * total, kind = V.moneyBinCoins[0];
      for (const c of V.moneyBinCoins) { if (r < c.weight) { kind = c; break; } r -= c.weight; }
      if (at + kind.fallMs > V.moneyBinSeconds * 1000) { if (at + V.moneyBinCoins[V.moneyBinCoins.length - 1].fallMs > V.moneyBinSeconds * 1000) break; continue; }
      out.push({ at, x: 5 + Math.random() * 80, seconds: kind.seconds, fallMs: kind.fallMs });
    }
    return out;
  });
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (phase !== 'raining') return;
    const start = performance.now();
    const t = setInterval(() => setNow(performance.now() - start), 33);
    return () => clearInterval(t);
  }, [phase]);
  const left = useCountdown(phase === 'raining', V.moneyBinSeconds * 1000, () => { setPhase('done'); soundService.playMilestone(); });
  const raw = caught.reduce((a, i) => a + (coins[i]?.seconds ?? 0), 0);
  const seconds = Math.min(V.moneyBinMaxSeconds, raw);
  const grab = (i: number) => { if (phase !== 'raining' || caught.includes(i)) return; setCaught([...caught, i]); soundService.playTileClick(); buzz(12); };
  const look = (s: number) => s >= 3 ? 'text-5xl drop-shadow-[0_0_8px_rgba(103,232,249,0.9)]' : s === 2 ? 'text-4xl drop-shadow-[0_0_6px_rgba(255,230,0,0.8)]' : 'text-3xl';
  return (
    <>
      <p className="text-slate-200 text-sm">{phase === 'ready' ? `Coins rain down for ${V.moneyBinSeconds} seconds. Each one is worth clock time: the faster it falls, the more it's worth. Catch up to +${V.moneyBinMaxSeconds} seconds!` : phase === 'raining' ? 'Dive in!' : `You caught ${caught.length} ${caught.length === 1 ? 'coin' : 'coins'}.`}</p>
      <div className="w-full flex justify-center gap-3 osd-text text-base text-slate-300" aria-hidden="true">
        {V.moneyBinCoins.map(c => <span key={c.seconds}>{c.seconds >= 3 ? '💎' : '🪙'} +{c.seconds}<Sec /></span>)}
      </div>
      <div className="relative w-full h-56 rounded-xl overflow-hidden ring-2 ring-neon-yellow/60 bg-gradient-to-b from-emerald-900 to-crt-950">
        {phase === 'raining' && coins.map((c, i) => {
          const t = (now - c.at) / c.fallMs;
          if (t < 0 || t > 1 || caught.includes(i)) return null;
          return (
            <button key={i} type="button" onPointerDown={e => { e.preventDefault(); grab(i); }} aria-label={`Coin worth ${c.seconds} seconds`}
              className={`absolute leading-none select-none touch-none p-1 flex flex-col items-center ${look(c.seconds)}`} style={{ left: `${c.x}%`, top: `${t * 100 - 14}%` }}>
              <span>{c.seconds >= 3 ? '💎' : '🪙'}</span>
              <span className="osd-text text-xs text-white leading-none">+{c.seconds}</span>
            </button>
          );
        })}
        {phase === 'ready' && <div className="absolute inset-0 grid place-items-center text-6xl" aria-hidden="true">🎩</div>}
      </div>
      <div className="w-full flex justify-between items-baseline"><span className="osd-text text-xl text-neon-green">⏱️ +{seconds}<Sec />{raw > V.moneyBinMaxSeconds ? ' (MAX)' : ''}</span>{phase === 'raining' && <SecsLeft ms={left} />}</div>
      {phase === 'ready' && <ArcadeButton color="yellow" className="w-full" onClick={() => { soundService.playPowerUp(); setPhase('raining'); }}>🎩 Dive in!</ArcadeButton>}
      {phase === 'done' && <ArcadeButton color="green" className="w-full" onClick={() => onResolve({ seconds, headline: seconds ? `+${seconds} SECONDS` : 'THE BIN STAYS SHUT', detail: seconds ? `Swimming in time! ${caught.length} ${caught.length === 1 ? 'coin' : 'coins'} added to your clock.` : 'Not a single coin. Next time!', tone: seconds ? 'win' : 'neutral' })}>{seconds ? `Take +${seconds}s` : 'Continue'}</ArcadeButton>}
    </>
  );
};

/** Wario: three money bags. Bigger bags cost more seconds, taken off the clock right away. */
const WarioBags: React.FC<{ onResolve: (r: GambleResult) => void; extra?: Record<string, unknown> }> = ({ onResolve, extra }) => {
  const clock = Number(extra?.clock ?? 999);
  return (
    <>
      <p className="text-slate-200 text-sm">WAH! Pick a bag. The seconds come off your clock right now.</p>
      <div className="grid grid-cols-3 gap-2 w-full">
        {V.warioBags.map(({ points, seconds }, i) => {
          const tooMuch = seconds >= clock;
          return (
            <button key={points} type="button" disabled={tooMuch} aria-label={`Bag ${i + 1}: plus ${points} points for minus ${seconds} seconds${tooMuch ? ', not enough time' : ''}`}
              onClick={() => { soundService.playPowerUp(); onResolve({ points, seconds: -seconds, headline: `+${points} POINTS`, detail: `Wario takes ${seconds} seconds off your clock. Money, money, money!`, tone: 'win' }); }}
              className={`rounded-xl py-3 ring-2 flex flex-col items-center gap-1 ${tooMuch ? 'opacity-40 ring-white/10' : 'ring-neon-yellow/70 bg-crt-950 hover:brightness-125'}`}>
              <span className="leading-none" style={{ fontSize: `${2 + i * 0.6}rem` }} aria-hidden="true">💰</span>
              <span className="osd-text text-lg text-neon-green leading-none">+{points}</span>
              <span className="osd-text text-base text-neon-red leading-none">-{seconds}<Sec /></span>
            </button>
          );
        })}
      </div>
      {V.warioBags.some(b => b.seconds >= clock) && <p className="text-xs text-slate-400">Greyed bags would cost more time than you have.</p>}
    </>
  );
};

/** Mission: Impossible: a secret mission for your next few words. Accepting arms it; declining ends it. */
const Mission: React.FC<{ onResolve: (r: GambleResult) => void }> = ({ onResolve }) => {
  const [id] = useSaved('mission', () => MISSIONS[Math.floor(Math.random() * MISSIONS.length)].id);
  const m = missionById(id) ?? MISSIONS[0];
  return (
    <>
      <div className="w-full rounded-lg bg-[#e9dfc4] text-crt-900 p-3 text-left font-mono text-sm shadow-inner">
        <p className="font-bold tracking-widest">TOP SECRET · IMF</p>
        <p className="mt-1">Your mission, should you choose to accept it:</p>
        <p className="mt-1 font-bold text-base">{m.text}</p>
        <p className="mt-1">within your next {V.missionWords} words. Reward: +{V.missionPrize} points.</p>
        <p className="mt-1 italic">This card will self-destruct.</p>
      </div>
      <div className="grid grid-cols-2 gap-2 w-full">
        <ArcadeButton color="slate" variant="outline" onClick={() => onResolve({ headline: 'MISSION DECLINED', detail: 'The tape self-destructs. Nothing lost.', tone: 'neutral' })}>Decline</ArcadeButton>
        <ArcadeButton color="green" onClick={() => onResolve({ headline: 'MISSION ACCEPTED', detail: `${m.text} within your next ${V.missionWords} words for +${V.missionPrize}. Good luck.`, tone: 'neutral', arm: { value: { mission: m.id, words: V.missionWords }, description: `Mission: ${m.text.toLowerCase()} within ${V.missionWords} words for +${V.missionPrize}.` } })}>Accept</ArcadeButton>
      </div>
    </>
  );
};

/**
 * Are You Smarter Than a 5th Grader? (v7.65.0): 10 seconds of times tables. Each right answer climbs
 * the ladder; a wrong one drops a rung. The prize is the rung you finish on. Progress is saved, so
 * a quit can't redeal the problem.
 */
const FifthGrader: React.FC<{ onResolve: (r: GambleResult) => void }> = ({ onResolve }) => {
  const L = V.fifthGraderLadder, G = V.fifthGraderGrades;
  const [phase, setPhase] = useSaved<'ready' | 'quiz' | 'done'>('phase', 'ready');
  const [game, setGame] = useSaved<{ rung: number; right: number; wrong: number; best: number; problem: TimesProblem }>('game', () => ({ rung: 0, right: 0, wrong: 0, best: 0, problem: timesProblem(Math.random, false) }));
  const [flash, setFlash] = useState<{ ok: boolean; text: string; key: number } | null>(null);
  const left = useCountdown(phase === 'quiz', V.fifthGraderSeconds * 1000, () => { setPhase('done'); soundService.playMilestone(); });
  const answer = (c: number) => {
    if (phase !== 'quiz') return;
    const p = game.problem;
    const ok = c === p.answer;
    const rung = ok ? Math.min(L.length, game.rung + 1) : Math.max(0, game.rung - 1);
    const right = game.right + (ok ? 1 : 0);
    setGame({ rung, right, wrong: game.wrong + (ok ? 0 : 1), best: Math.max(game.best, rung), problem: timesProblem(Math.random, right >= V.fifthGraderHardAfter) });
    setFlash(ok ? { ok, text: `${G[rung - 1]?.toUpperCase() ?? ''} · +${L[rung - 1]}`, key: Date.now() } : { ok, text: `${p.a} × ${p.b} = ${p.answer} · DOWN A RUNG`, key: Date.now() });
    if (ok) { soundService.playTileClick(); buzz(8); } else { soundService.playInvalidWord(); buzz(40); }
    if (ok && rung >= L.length) { setPhase('done'); soundService.playMilestone(); }
  };
  const prize = game.rung > 0 ? L[game.rung - 1] : 0;
  const top = game.rung >= L.length;
  const p = game.problem;
  return (
    <>
      {phase === 'ready' && (
        <>
          <p className="text-slate-200 text-sm leading-snug">Times tables for <strong className="text-white">{V.fifthGraderSeconds} seconds</strong>. Each right answer climbs a grade; a wrong one drops you back one. You win the rung you finish on, up to <strong className="text-neon-yellow">+{L[L.length - 1].toLocaleString()}</strong>.</p>
          <ArcadeButton color="green" className="w-full" onClick={() => setPhase('quiz')}>🔔 Start class</ArcadeButton>
        </>
      )}
      <div className="w-full flex items-stretch gap-2">
        {/* The ladder, top rung first, like the show's board. */}
        <ol className="flex flex-col-reverse gap-0.5 w-28 shrink-0" aria-label={`Ladder: rung ${game.rung} of ${L.length}`}>
          {L.map((v, i) => (
            <li key={i} className={`flex justify-between rounded px-1.5 py-0.5 osd-text text-sm leading-none ${i + 1 === game.rung ? 'bg-neon-yellow text-crt-900' : i < game.rung ? 'bg-neon-yellow/15 text-neon-yellow' : 'bg-crt-950/70 text-slate-500'}`}>
              <span>{G[i].replace(' Grade', '')}</span><span>+{v}</span>
            </li>
          ))}
        </ol>
        <div className="flex-1 flex flex-col gap-2 min-w-0">
          <div className="flex justify-between items-baseline">
            <span className="osd-text text-xl text-neon-yellow">+{prize}</span>
            {phase === 'quiz' ? <SecsLeft ms={left} /> : <span className="osd-text text-lg text-slate-400">{game.right} RIGHT</span>}
          </div>
          {phase !== 'done' ? (
            <>
              <div className="rounded-xl bg-crt-950/80 ring-1 ring-white/15 py-3 text-center" aria-live="polite" aria-label={`${p.a} times ${p.b}`}>
                <span className={`font-tile font-extrabold text-4xl tabular-nums ${phase === 'quiz' ? 'text-white' : 'text-slate-600'}`}>{phase === 'quiz' ? `${p.a} × ${p.b}` : '? × ?'}</span>
              </div>
              <p key={flash?.key} className={`osd-text text-base leading-tight min-h-[1.25rem] ${flash ? (flash.ok ? 'text-neon-green message-pop' : 'text-neon-red message-pop') : 'text-transparent'}`}>{flash ? `${flash.ok ? '✔' : '✘'} ${flash.text}` : '.'}</p>
              <div className="grid grid-cols-2 gap-2">
                {p.choices.map(c => (
                  <button key={`${p.a}x${p.b}-${c}`} type="button" data-testid="times-choice" disabled={phase !== 'quiz'} aria-label={`Answer ${c}`}
                    onPointerDown={e => { e.preventDefault(); answer(c); }} onClick={e => { if (e.detail === 0) answer(c); }}
                    className="rounded-xl py-3 bg-neon-cyan/10 ring-2 ring-neon-cyan text-white font-tile font-extrabold text-2xl tabular-nums select-none touch-none active:scale-95 disabled:opacity-40">{c}</button>
                ))}
              </div>
            </>
          ) : (
            <p className="text-slate-200 text-sm leading-snug">{top ? "Top of the class! You're smarter than a 5th grader." : prize ? `Class dismissed: you finished in ${G[game.rung - 1]} with ${game.right} right.` : "I'm not smarter than a 5th grader! No rungs this time."}</p>
          )}
        </div>
      </div>
      {phase === 'done' && (
        <ArcadeButton color="green" className="w-full" onClick={() => onResolve({ points: prize, headline: top ? `SMARTER THAN A 5TH GRADER! +${prize}` : prize ? `${G[game.rung - 1].toUpperCase()}: +${prize}` : 'NOT SMARTER THAN A 5TH GRADER', detail: `${game.right} right${game.wrong ? `, ${game.wrong} wrong` : ''} in ${V.fifthGraderSeconds} seconds.`, tone: prize ? 'win' : 'lose' })}>{prize ? `Take +${prize}` : 'Continue'}</ArcadeButton>
      )}
    </>
  );
};

/**
 * Winner Winner Chicken Dinner (v7.67.1, the owner's pick): one hand of blackjack against the dealer,
 * on the spot. The deck is dealt up front and saved (useSaved), so a quit can't redeal; the dealer
 * draws to 17. Beat the dealer +300, blackjack +500, a tie +100 (prizes grow with the level).
 */
const Blackjack: React.FC<{ onResolve: (r: GambleResult) => void }> = ({ onResolve }) => {
  const [deck] = useSaved('deck', () => Array.from({ length: V.blackjackDeck }, () => drawCard()));
  const [hits, setHits] = useSaved('hits', 0);
  const [stood, setStood] = useSaved('stood', false);
  const mine = blackjackHands(deck, hits, false).player;
  const myTotal = blackjackTotal(mine);
  const over = stood || myTotal >= V.blackjackTarget;
  const { player, dealer } = blackjackHands(deck, hits, over);
  const result = over ? blackjackResult(player, dealer) : null;
  const prize = result ? blackjackPrize(result) : 0;
  const card = (c: number | null, i: number, fresh: boolean) => (
    <div key={i} className={`w-12 h-16 rounded-lg flex items-center justify-center font-display text-2xl shadow-md ${c === null ? 'bg-[repeating-linear-gradient(45deg,#ff2d95_0_6px,#7a1250_6px_12px)] ring-2 ring-white/60' : 'bg-white text-slate-900'} ${fresh ? 'level-stage-in' : ''}`}
      aria-label={c === null ? 'Face-down card' : `Card ${cardFace(c)}`}>{c === null ? '' : cardFace(c)}</div>
  );
  const hit = () => { if (over) return; soundService.playTileClick(); setHits(hits + 1); };
  const stand = () => { if (over) return; soundService.playTileClick(); setStood(true); };
  const dTotal = blackjackTotal(dealer);
  const lines: Record<string, { headline: string; detail: string }> = {
    natural: { headline: `BLACKJACK! +${prize}`, detail: 'Twenty-one with your first two cards. Winner winner, chicken dinner!' },
    win: { headline: `CHICKEN DINNER! +${prize}`, detail: dTotal > V.blackjackTarget ? `The dealer busted with ${dTotal}. You stood on ${myTotal}.` : `Your ${myTotal} beat the dealer's ${dTotal}.` },
    push: { headline: `A TIE: +${prize}`, detail: `You both had ${myTotal}. The house gives you a little something.` },
    lose: { headline: 'THE DEALER WINS', detail: `The dealer's ${dTotal} beat your ${myTotal}. No chicken tonight.` },
    bust: { headline: `BUST! ${myTotal}`, detail: 'You went over 21. No chicken tonight.' },
  };
  return (
    <>
      <p className="text-slate-200 text-sm leading-snug">Get closer to 21 than the dealer without going over. J, Q, K count 10; an A counts 11 or 1.</p>
      <p className="osd-text text-base text-slate-300 leading-none">WIN +{V.blackjackWin} · BLACKJACK +{V.blackjackNatural} · TIE +{V.blackjackPush}</p>
      <div className="w-full flex flex-col gap-2" aria-live="polite">
        <div className="flex items-center gap-2">
          <span className="osd-text text-base text-slate-400 w-16 text-left">DEALER</span>
          <div className="flex gap-1.5 flex-wrap">{(over ? dealer : [dealer[0], null]).map((c, i) => card(c, i, over && i >= 1))}</div>
          {over && <span className="font-display text-xl text-white ml-auto">{dTotal}</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className="osd-text text-base text-slate-400 w-16 text-left">YOU</span>
          <div className="flex gap-1.5 flex-wrap">{player.map((c, i) => card(c, i, i >= 2 && i === player.length - 1))}</div>
          <span className={`font-display text-xl ml-auto ${myTotal > V.blackjackTarget ? 'text-neon-red' : 'text-neon-yellow'}`}>{myTotal}</span>
        </div>
      </div>
      {!over ? (
        <div className="grid grid-cols-2 gap-2 w-full">
          <ArcadeButton color="cyan" onClick={hit}>Hit</ArcadeButton>
          <ArcadeButton color="pink" onClick={stand}>Stand</ArcadeButton>
        </div>
      ) : (
        <>
          <p className={`font-display text-2xl ${prize ? 'text-neon-green' : 'text-neon-red'}`}>{lines[result!].headline}</p>
          <ArcadeButton color="green" className="w-full" onClick={() => onResolve({ points: prize, headline: lines[result!].headline, detail: lines[result!].detail, tone: prize ? 'win' : 'lose' })}>{prize ? `Take +${prize}` : 'Continue'}</ArcadeButton>
        </>
      )}
    </>
  );
};

/**
 * Gump Luck (v7.67.1, the owner's ask: something to tap): a box of chocolates. Tap one to unwrap it.
 * What's inside is rolled when the box opens and saved, so a quit can't reroll it; 25% each.
 */
const GUMP_SHOW: Record<GumpPrize, { icon: string; label: React.ReactNode }> = {
  time: { icon: '⏱️', label: <>+{TIME_BONUS.rescue}<Sec /></> },
  points: { icon: '💰', label: `+${V.gumpLuckPoints}` },
  shuffle: { icon: '🔀', label: '+1 SHUFFLE' },
  empty: { icon: '🫥', label: 'EMPTY' },
};
const GumpBox: React.FC<{ onResolve: (r: GambleResult) => void }> = ({ onResolve }) => {
  const [prize] = useSaved<GumpPrize>('prize', () => gumpRoll());
  const [picked, setPicked] = useSaved<number | null>('picked', null);
  const pick = (i: number) => { if (picked !== null) return; soundService.playTileClick(); try { navigator.vibrate?.(15); } catch { /* */ } setPicked(i); };
  const result: GambleResult =
    prize === 'time' ? { seconds: TIME_BONUS.rescue, headline: `+${TIME_BONUS.rescue} SECONDS`, detail: 'A clock-shaped chocolate. Tastes like extra time.', tone: 'win' }
    : prize === 'points' ? { points: V.gumpLuckPoints, headline: `+${V.gumpLuckPoints} POINTS`, detail: 'A gold-foil truffle. Sweet!', tone: 'win' }
    : prize === 'shuffle' ? { shuffles: 1, headline: '+1 SHUFFLE', detail: 'A nut cluster. Shake things up: you get one more shuffle.', tone: 'win' }
    : { headline: 'EMPTY WRAPPER', detail: 'Somebody already ate this one. Stupid is as stupid does.', tone: 'lose' };
  return (
    <>
      <p className="text-slate-200 text-sm leading-snug">Pick a chocolate and unwrap it: +{TIME_BONUS.rescue} seconds, +{V.gumpLuckPoints} points, +1 shuffle or an empty wrapper.</p>
      <div className="grid grid-cols-3 gap-2 w-full max-w-[16rem] rounded-xl bg-[#5a2e1a] ring-4 ring-[#c9a227] p-2.5">
        {Array.from({ length: V.gumpLuckChocolates }, (_, i) => {
          const open = picked === i;
          return (
            <button key={i} type="button" data-testid="gump-chocolate" disabled={picked !== null} onClick={() => pick(i)}
              aria-label={open ? `Chocolate ${i + 1}: ${prize}` : `Chocolate ${i + 1}`}
              className={`aspect-square rounded-full flex flex-col items-center justify-center select-none transition-transform active:scale-90 ${open ? 'bg-crt-950 ring-2 ring-neon-yellow level-stage-in' : picked !== null ? 'bg-[#3b1d10] opacity-40' : 'bg-[radial-gradient(circle_at_35%_30%,#a0522d,#4a2511)] ring-2 ring-[#e8c766]/70 hover:scale-105'}`}>
              {open ? (<><span className="text-2xl leading-none" aria-hidden="true">{GUMP_SHOW[prize].icon}</span><span className="font-display text-[11px] leading-tight text-white mt-0.5">{GUMP_SHOW[prize].label}</span></>)
                : <span className="text-2xl leading-none" aria-hidden="true">🍬</span>}
            </button>
          );
        })}
      </div>
      {picked === null
        ? <p className="osd-text text-base text-slate-300">TAP A CHOCOLATE</p>
        : <ArcadeButton color={prize === 'empty' ? 'pink' : 'green'} className="w-full" onClick={() => onResolve(result)}>{prize === 'empty' ? 'Continue' : 'Take it'}</ArcadeButton>}
    </>
  );
};

/**
 * Fortune's Favor (v7.72.5, the owner's ask: shake it, don't just tell me): a Magic 8-Ball. Shake it
 * (tap the ball or the button) 3 times, the answer floats up through the murk in its window, then
 * take it. The answer is rolled when the card opens and saved, so a quit can't reroll it.
 */
const FortuneBall: React.FC<{ onResolve: (r: GambleResult) => void }> = ({ onResolve }) => {
  const [roll] = useSaved<{ kind: FortuneKind; answer: number }>('roll', () => fortuneRoll());
  const [shakes, setShakes] = useSaved<number>('shakes', 0);
  const [shaking, setShaking] = useState(false);
  const [risen, setRisen] = useState(shakes >= V.fortuneShakes);
  const done = shakes >= V.fortuneShakes;
  const answer = FORTUNE_ANSWERS[roll.kind][roll.answer % FORTUNE_ANSWERS[roll.kind].length];
  const points = fortunePoints(roll.kind);
  useEffect(() => {
    if (!done || risen) return;
    const t = setTimeout(() => { setRisen(true); if (points > 0) soundService.playMilestone(); }, 1500);
    return () => clearTimeout(t);
  }, [done, risen, points]);
  const shake = () => {
    if (done || shaking) return;
    soundService.playTileClick(); try { navigator.vibrate?.(30); } catch { /* */ }
    setShaking(true); setTimeout(() => setShaking(false), 450);
    setShakes(shakes + 1);
  };
  const headline = points < 0 ? `${points} POINTS` : `+${points} POINTS`;
  const detail = roll.kind === 'lose' ? `"${answer.toLowerCase().replace(/^./, c => c.toUpperCase())}." The ball takes ${-points} points.`
    : `"${answer.toLowerCase().replace(/^./, c => c.toUpperCase())}." You gain ${points} points.`;
  return (
    <>
      <p className="text-slate-200 text-sm leading-snug">Ask it anything, then shake it {V.fortuneShakes} times. Yes pays +{V.fortuneWin}, "without a doubt" +{V.fortuneJackpot}, and "outlook not so good" costs {V.fortuneLose}.</p>
      <button type="button" data-testid="eight-ball" onClick={shake} disabled={done} aria-label={done ? `The 8-Ball says: ${answer}` : `Shake the 8-Ball (${shakes} of ${V.fortuneShakes})`}
        className={`relative w-44 h-44 rounded-full select-none bg-[radial-gradient(circle_at_32%_28%,#5b6170,#1b1d24_45%,#050507_75%)] shadow-[0_12px_28px_rgba(0,0,0,0.7),inset_0_-10px_24px_rgba(0,0,0,0.8)] ring-2 ring-white/10 ${shaking ? 'cereal-shake' : ''} ${done ? '' : 'active:scale-95'}`}>
        <span className="absolute top-5 left-9 w-10 h-5 rounded-full bg-white/25 blur-[3px] rotate-[-25deg]" aria-hidden="true" />
        <span className="absolute inset-0 m-auto w-24 h-24 rounded-full bg-[radial-gradient(circle,#0b1f4d,#030712_75%)] ring-4 ring-black flex items-center justify-center overflow-hidden" aria-hidden="true">
          {!done && <span className="w-14 h-14 rounded-full bg-white text-black font-display text-4xl leading-none flex items-center justify-center">8</span>}
          {done && (
            <span className={`relative flex items-center justify-center transition-all duration-[1400ms] ease-out ${risen ? 'opacity-100 scale-100 blur-0' : 'opacity-0 scale-75 blur-sm'}`}
              style={{ width: 84, height: 74 }}>
              <span className="absolute inset-0 bg-[#2f5bd6]" style={{ clipPath: 'polygon(50% 100%, 0 0, 100% 0)' }} />
              <span className="relative -mt-4 px-3 text-center font-display text-[9px] leading-[1.05] text-white/90">{answer}</span>
            </span>
          )}
        </span>
      </button>
      {!done ? (
        <>
          <div className="flex items-center gap-2" aria-hidden="true">
            {Array.from({ length: V.fortuneShakes }, (_, i) => <span key={i} className={`w-3 h-3 rounded-full ${i < shakes ? 'bg-neon-cyan shadow-[0_0_8px_rgba(0,229,255,0.8)]' : 'bg-white/15'}`} />)}
          </div>
          <ArcadeButton color="cyan" className="w-full" onClick={shake}>🎱 Shake it! ({shakes}/{V.fortuneShakes})</ArcadeButton>
        </>
      ) : !risen ? (
        <p className="osd-text text-lg text-slate-300 animate-pulse">THE ANSWER IS RISING…</p>
      ) : (
        <>
          <p className={`font-display text-2xl ${points > 0 ? 'text-neon-green' : 'text-neon-red'}`}>{headline}</p>
          <ArcadeButton color={points > 0 ? 'green' : 'pink'} className="w-full" onClick={() => onResolve({ points, headline, detail, tone: points > 0 ? 'win' : 'lose' })}>
            {points > 0 ? `Take +${points}` : 'Continue'}
          </ArcadeButton>
        </>
      )}
    </>
  );
};

const GAMES: Record<string, React.FC<{ onResolve: (r: GambleResult) => void; hand?: (Tile | null)[]; extra?: Record<string, unknown> }>> = {
  letsMakeADeal: Doors, dealOrNoDeal: Deal, noWhammies: Whammies, minesweeper: Mines,
  priceIsRight: PriceIsRight, psychicFriends: PsychicCall, draftDay: DraftDay, cardSharks: CardSharks, plinko: Plinko,
  hotTubTimeMachine: HotTub, luckyCharms: LuckyCharms, wildcard: Wildcard,
  shakeItLikeAPolaroid: Polaroid, duckHunt: DuckHunt, scroogeSwipe: MoneyBin, warioWarp: WarioBags, missionImpossible: Mission,
  fifthGrader: FifthGrader, chickenDinner: Blackjack, gumpLuck: GumpBox, fortunesFavor: FortuneBall,
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
