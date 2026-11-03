import React, { useState } from 'react';
import ArcadeButton from './ArcadeButton';
import { POWER_PLAY_VALUES as V } from '../config/gameplay';
import { shuffledDoors } from '../services/rules';
import { soundService } from '../services/soundService';

// The PowerPlays where the player makes the call (v7.25): pick a door, take the Banker's deal,
// keep spinning for No Whammies, or pick a Minesweeper square. The card rolls and then hands the
// result to the game, which applies it and shows the outcome card.
export interface GambleResult { points?: number; seconds?: number; strike?: boolean; headline: string; detail: string; tone: 'win' | 'lose' | 'neutral' }

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

const prizeText = (p: { points?: number; seconds?: number }) =>
  p.points ? `+${p.points} points` : (p.seconds ?? 0) > 0 ? `+${p.seconds} seconds` : `a Zonk (${p.seconds} seconds)`;

const Doors: React.FC<{ onResolve: (r: GambleResult) => void }> = ({ onResolve }) => {
  const [doors] = useState(() => shuffledDoors());
  const pick = (i: number) => {
    const prize = doors[i];
    const others = doors.map((d, j) => (j === i ? null : `Door ${j + 1}: ${prizeText(d)}`)).filter(Boolean).join(' · ');
    const zonk = !prize.points && (prize.seconds ?? 0) < 0;
    onResolve({
      ...prize,
      headline: zonk ? `DOOR ${i + 1}: ZONK!` : `DOOR ${i + 1}: ${prizeText(prize).toUpperCase()}`,
      detail: `${zonk ? 'A Zonk! You lose a little time.' : 'Behind your door!'}\n\n${others}`,
      tone: zonk ? 'lose' : 'win',
    });
  };
  return (
    <>
      <p className="text-slate-200">One door hides +{V.doorPrizes[0].points} points, one +{V.doorPrizes[1].seconds} seconds, one a Zonk.</p>
      <div className="grid grid-cols-3 gap-2 w-full">
        {doors.map((_, i) => (
          <button key={i} type="button" onClick={() => pick(i)} className="rounded-xl bg-gradient-to-b from-[#8b5a2b] to-[#5a3a1a] ring-2 ring-neon-yellow/70 py-5 font-display text-2xl text-neon-yellow hover:brightness-110" aria-label={`Door ${i + 1}`}>
            🚪<br />{i + 1}
          </button>
        ))}
      </div>
    </>
  );
};

const Deal: React.FC<{ onResolve: (r: GambleResult) => void }> = ({ onResolve }) => {
  const take = () => onResolve({ points: V.dealOffer, headline: `DEAL! +${V.dealOffer} POINTS`, detail: 'You took the Banker\'s offer. Safe money.', tone: 'neutral' });
  const open = () => {
    const value = V.dealCases[Math.floor(Math.random() * V.dealCases.length)];
    const better = value > V.dealOffer;
    onResolve({
      points: value,
      headline: `YOUR CASE: +${value} POINTS`,
      detail: better ? `No deal paid off! The Banker only offered ${V.dealOffer}.` : `The Banker offered ${V.dealOffer}. Ouch.`,
      tone: better ? 'win' : 'lose',
    });
  };
  return (
    <>
      <p className="text-slate-200">The Banker is calling. Your case holds anywhere from {V.dealCases[0]} to {V.dealCases[V.dealCases.length - 1]} points.</p>
      <p className="font-display text-3xl text-neon-yellow">OFFER: +{V.dealOffer}</p>
      <ArcadeButton color="green" className="w-full" onClick={take}>Deal</ArcadeButton>
      <ArcadeButton color="red" className="w-full" onClick={open}>No deal: open my case</ArcadeButton>
    </>
  );
};

const Whammies: React.FC<{ onResolve: (r: GambleResult) => void }> = ({ onResolve }) => {
  const [pot, setPot] = useState(0);
  const [spins, setSpins] = useState(0);
  const bank = (amount: number, spun: number) => onResolve({ points: amount, headline: `BANKED: +${amount} POINTS`, detail: `You stopped after ${spun} ${spun === 1 ? 'spin' : 'spins'} with no Whammy.`, tone: 'win' });
  const spin = () => {
    soundService.playTileClick();
    const spun = spins + 1;
    if (Math.random() < V.whammyChance) {
      onResolve({ points: 0, headline: 'WHAMMY!', detail: `A Whammy on spin ${spun} wiped your pot of ${pot} points.`, tone: 'lose' });
      return;
    }
    const next = pot + V.whammyPot;
    if (spun >= V.whammySpins) { bank(next, spun); return; }
    setPot(next); setSpins(spun);
  };
  return (
    <>
      <p className="text-slate-200">Each spin adds +{V.whammyPot}. A Whammy ({V.whammyChance * 100}% a spin) wipes the pot. {V.whammySpins - spins} {V.whammySpins - spins === 1 ? 'spin' : 'spins'} left.</p>
      <p className="font-display text-4xl text-neon-yellow" aria-live="polite">POT: {pot}</p>
      <ArcadeButton color="pink" className="w-full" onClick={spin}>{spins === 0 ? 'Spin!' : 'Spin again'}</ArcadeButton>
      {spins > 0 && <ArcadeButton color="green" className="w-full" onClick={() => bank(pot, spins)}>Stop and bank {pot}</ArcadeButton>}
    </>
  );
};

const Mines: React.FC<{ onResolve: (r: GambleResult) => void }> = ({ onResolve }) => {
  const [mine] = useState(() => Math.floor(Math.random() * V.minesweeperSquares));
  const pick = (i: number) => onResolve(i === mine
    ? { strike: true, headline: 'BOOM! A STRIKE', detail: `Square ${i + 1} was the mine.`, tone: 'lose' }
    : { points: V.minesweeperPoints, headline: `SAFE! +${V.minesweeperPoints} POINTS`, detail: `The mine was under square ${mine + 1}.`, tone: 'win' });
  return (
    <>
      <p className="text-slate-200">Safe squares pay +{V.minesweeperPoints}. One hides a mine: a strike.</p>
      <div className="grid grid-cols-3 gap-2 w-48">
        {Array.from({ length: V.minesweeperSquares }, (_, i) => (
          <button key={i} type="button" onClick={() => pick(i)} className="aspect-square rounded-md bg-slate-300 ring-2 ring-white/60 shadow-[inset_-3px_-3px_0_rgba(0,0,0,0.25)] hover:bg-slate-200" aria-label={`Square ${i + 1}`} />
        ))}
      </div>
    </>
  );
};

const GAMES: Record<string, React.FC<{ onResolve: (r: GambleResult) => void }>> = {
  letsMakeADeal: Doors, dealOrNoDeal: Deal, noWhammies: Whammies, minesweeper: Mines,
};

/** The interactive part of a gamble PowerPlay. */
const GambleCard: React.FC<{ id: string; icon: string; name: string; onResolve: (r: GambleResult) => void }> = ({ id, icon, name, onResolve }) => {
  const Game = GAMES[id];
  if (!Game) return null;
  return <Frame icon={icon} name={name}><Game onResolve={onResolve} /></Frame>;
};

export const GAMBLE_CARD_IDS = Object.keys(GAMES);
export default GambleCard;
