import React, { useState } from 'react';
import ArcadeButton from './ArcadeButton';
import { POWER_PLAY_VALUES as V } from '../config/gameplay';
import { doorsForRound, minesweeperPot, bankerOffer, dealGame, cardSharksPot, drawCard, cardFace } from '../services/rules';
import { createTile, createTileBag, shuffleArray } from '../services/gameUtils';
import type { Tile } from '../types';
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
  const [round, setRound] = useState(0);
  const [pot, setPot] = useState(0);
  const [doors, setDoors] = useState(() => doorsForRound(0));
  const [last, setLast] = useState<string | null>(null);
  // Walking away opens the doors you passed on (v7.28.6), so you see what you'd have faced.
  const [walked, setWalked] = useState<{ amount: number; played: number } | null>(null);
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
  const [game] = useState(() => dealGame());
  const [round, setRound] = useState(0);
  const opened = game.others.slice(0, V.dealOpenPerRound.slice(0, round + 1).reduce((a, b) => a + b, 0));
  const left = game.others.slice(opened.length);
  const offer = bankerOffer([game.mine, ...left], round);
  const lastRound = round >= V.dealOpenPerRound.length - 1;
  // Taking the deal opens your case (v7.28.7), so you see whether the Banker beat it.
  const [dealt, setDealt] = useState<number | null>(null);
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

const Whammies: React.FC<{ onResolve: (r: GambleResult) => void }> = ({ onResolve }) => {
  const [pot, setPot] = useState(0);
  const [spins, setSpins] = useState(0);
  // Stopping spins the board once more for show (v7.28.6): was the next spin a Whammy?
  const [stopped, setStopped] = useState<{ amount: number; spun: number; whammy: boolean } | null>(null);
  const nextSpin = (whammy: boolean) => whammy ? 'The next spin was a WHAMMY. Good call!' : `The next spin was safe: it would have added +${V.whammyPot}.`;
  const bank = (amount: number, spun: number, whammy?: boolean) => onResolve({ points: amount, headline: `BANKED: +${amount} POINTS`, detail: `You stopped after ${spun} ${spun === 1 ? 'spin' : 'spins'} with no Whammy.${whammy !== undefined ? ` ${nextSpin(whammy)}` : ''}`, tone: 'win' });
  const spin = () => {
    if (stopped) return;
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
  if (stopped) {
    return (
      <>
        <div className={`w-full rounded-xl ring-2 py-4 font-display text-3xl level-stage-in ${stopped.whammy ? 'bg-neon-red/20 ring-neon-red text-neon-red' : 'bg-crt-950 ring-neon-green text-neon-green'}`} aria-label={stopped.whammy ? 'Next spin: Whammy' : `Next spin: +${V.whammyPot}`}>
          {stopped.whammy ? '👺 WHAMMY!' : `+${V.whammyPot}`}
        </div>
        <p className="text-slate-200" aria-live="polite">{nextSpin(stopped.whammy)}</p>
        <p className="font-display text-3xl text-neon-yellow">BANKED: {stopped.amount}</p>
        <ArcadeButton color="green" className="w-full" onClick={() => bank(stopped.amount, stopped.spun, stopped.whammy)}>Take the {stopped.amount}</ArcadeButton>
      </>
    );
  }
  return (
    <>
      <p className="text-slate-200">Each spin adds +{V.whammyPot}. A Whammy ({V.whammyChance * 100}% a spin) wipes the pot. {V.whammySpins - spins} {V.whammySpins - spins === 1 ? 'spin' : 'spins'} left.</p>
      <p className="font-display text-4xl text-neon-yellow" aria-live="polite">POT: {pot}</p>
      <ArcadeButton color="pink" className="w-full" onClick={spin}>{spins === 0 ? 'Spin!' : 'Spin again'}</ArcadeButton>
      {spins > 0 && <ArcadeButton color="green" className="w-full" onClick={() => { soundService.playTileClick(); setStopped({ amount: pot, spun: spins, whammy: Math.random() < V.whammyChance }); }}>Stop and bank {pot}</ArcadeButton>}
    </>
  );
};

/** Minesweeper: keep picking squares to grow the pot; the mine wipes it. Bank any time. After a
 * bank the board reveals where the mine was (and the odds the next pick had) before paying out. */
const Mines: React.FC<{ onResolve: (r: GambleResult) => void }> = ({ onResolve }) => {
  const [mine] = useState(() => Math.floor(Math.random() * V.minesweeperSquares));
  const [cleared, setCleared] = useState<number[]>([]);
  const [banked, setBanked] = useState<{ amount: number; picks: number } | null>(null);
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
  const [packs] = useState(() => {
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
  const [card, setCard] = useState(() => drawCard());
  const [right, setRight] = useState(0);
  const [last, setLast] = useState<string | null>(null);
  const [banked, setBanked] = useState<{ amount: number; calls: number; next: number } | null>(null);
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

const GAMES: Record<string, React.FC<{ onResolve: (r: GambleResult) => void; hand?: (Tile | null)[] }>> = {
  letsMakeADeal: Doors, dealOrNoDeal: Deal, noWhammies: Whammies, minesweeper: Mines,
  priceIsRight: PriceIsRight, draftDay: DraftDay, cardSharks: CardSharks,
};

/** The interactive part of a gamble PowerPlay. */
const GambleCard: React.FC<{ id: string; icon: string; name: string; onResolve: (r: GambleResult) => void; hand?: (Tile | null)[] }> = ({ id, icon, name, onResolve, hand }) => {
  const Game = GAMES[id];
  if (!Game) return null;
  return <Frame icon={icon} name={name}><Game onResolve={onResolve} hand={hand} /></Frame>;
};

export const GAMBLE_CARD_IDS = Object.keys(GAMES);
export default GambleCard;
