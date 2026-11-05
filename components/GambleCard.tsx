import React, { useState } from 'react';
import ArcadeButton from './ArcadeButton';
import { POWER_PLAY_VALUES as V } from '../config/gameplay';
import { doorsForRound, minesweeperPot, bankerOffer, dealGame } from '../services/rules';
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

/** Let's Make a Deal: each round, two doors pay and one is a Zonk that wipes the pot. Bank after any win. */
const Doors: React.FC<{ onResolve: (r: GambleResult) => void }> = ({ onResolve }) => {
  const rounds = V.doorRounds.length;
  const [round, setRound] = useState(0);
  const [pot, setPot] = useState(0);
  const [doors, setDoors] = useState(() => doorsForRound(0));
  const [last, setLast] = useState<string | null>(null);
  const bank = (amount: number, played: number) =>
    onResolve({ points: amount, headline: `BANKED: +${amount} POINTS`, detail: `You walked away after ${played} ${played === 1 ? 'round' : 'rounds'} with the cash.`, tone: 'win' });
  const pick = (i: number) => {
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
      {pot > 0 && <ArcadeButton color="green" className="w-full" onClick={() => bank(pot, round)}>Take the {pot} and walk away</ArcadeButton>}
    </>
  );
};

/** Deal or No Deal: open cases round by round; each round the Banker makes an offer. */
const Deal: React.FC<{ onResolve: (r: GambleResult) => void }> = ({ onResolve }) => {
  const [game] = useState(() => dealGame());
  const [round, setRound] = useState(0);
  const opened = game.others.slice(0, V.dealOpenPerRound.slice(0, round + 1).reduce((a, b) => a + b, 0));
  const left = game.others.slice(opened.length);
  const offer = bankerOffer([game.mine, ...left], round);
  const lastRound = round >= V.dealOpenPerRound.length - 1;
  const deal = () => onResolve({
    points: offer, headline: `DEAL! +${offer} POINTS`,
    detail: `Your case held ${game.mine}. ${offer >= game.mine ? 'Good deal!' : 'You left points on the table.'}`,
    tone: offer >= game.mine ? 'win' : 'neutral',
  });
  const noDeal = () => {
    if (!lastRound) { soundService.playTileClick(); setRound(round + 1); return; }
    onResolve({ points: game.mine, headline: `YOUR CASE: +${game.mine} POINTS`, detail: game.mine >= offer ? `No deal paid off! The Banker's last offer was ${offer}.` : `The Banker's last offer was ${offer}. Ouch.`, tone: game.mine >= offer ? 'win' : 'lose' });
  };
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

/** Minesweeper: keep picking squares to grow the pot; the mine wipes it. Bank any time. */
const Mines: React.FC<{ onResolve: (r: GambleResult) => void }> = ({ onResolve }) => {
  const [mine] = useState(() => Math.floor(Math.random() * V.minesweeperSquares));
  const [cleared, setCleared] = useState<number[]>([]);
  const pot = minesweeperPot(cleared.length);
  const nextStep = V.minesweeperLadder[cleared.length] ?? 0;
  const bank = (amount: number, picks: number) =>
    onResolve({ points: amount, headline: picks === V.minesweeperSquares - 1 ? `BOARD CLEARED! +${amount}` : `BANKED: +${amount} POINTS`, detail: `You cleared ${picks} ${picks === 1 ? 'square' : 'squares'}. The mine was under square ${mine + 1}.`, tone: 'win' });
  const pick = (i: number) => {
    if (cleared.includes(i)) return;
    if (i === mine) {
      onResolve({ points: 0, headline: 'BOOM! POT WIPED', detail: `Square ${i + 1} was the mine. Your pot of ${pot} points went up in smoke.`, tone: 'lose' });
      return;
    }
    const now = [...cleared, i];
    if (now.length >= V.minesweeperSquares - 1) { bank(minesweeperPot(now.length), now.length); return; }
    soundService.playTileClick();
    setCleared(now);
  };
  return (
    <>
      <p className="text-slate-200">One square hides a mine that wipes your pot. Next safe square: +{nextStep}.</p>
      <p className="font-display text-3xl text-neon-yellow" aria-live="polite">POT: {pot}</p>
      <div className="grid grid-cols-3 gap-2 w-48">
        {Array.from({ length: V.minesweeperSquares }, (_, i) => {
          const safe = cleared.includes(i);
          return (
            <button key={i} type="button" onClick={() => pick(i)} disabled={safe}
              className={`aspect-square rounded-md ring-2 ${safe ? 'bg-crt-950 ring-neon-green/60 text-neon-green' : 'bg-slate-300 ring-white/60 shadow-[inset_-3px_-3px_0_rgba(0,0,0,0.25)] hover:bg-slate-200'}`}
              aria-label={safe ? `Square ${i + 1}, safe` : `Square ${i + 1}`}>
              {safe ? '✓' : ''}
            </button>
          );
        })}
      </div>
      {cleared.length > 0 && <ArcadeButton color="green" className="w-full" onClick={() => bank(pot, cleared.length)}>Stop and bank {pot}</ArcadeButton>}
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
