import React, { useState } from 'react';
import { SCRATCH } from '../config/gameplay';
import { CHARMS_LIST } from '../data/charms';
import { POWER_PLAYS_LIST } from '../data/powerPlays';
import { prizeFor } from '../services/rules';
import { safeFirstScratch, skullOdds, type ScratchPrize } from '../services/scratch';
import { soundService } from '../services/soundService';
import ArcadeButton from './ArcadeButton';
import { Sec } from './Seconds';

// Scratch-off ticket (v7.66.0, the owner's design): dealt at levels 4, 7 and 11 (where the Fork
// was). Scratch a square to win what's under it; each new scratch REPLACES the prize you hold, so
// bank when you like it. Two squares hide a skull, which wipes it. The first scratch is safe.
// The deal comes in the pop-up's data (rolled once); scratched squares are saved, so a quit can't redo it.

const charmById = (id: string) => CHARMS_LIST.find(c => c.id === id);
const ppById = (id: string) => POWER_PLAYS_LIST.find(p => p.id === id);

/** The prize as the player reads it: a big line and a small kind label. */
export const scratchLabel = (p: ScratchPrize, level: number): { icon: string; big: React.ReactNode; small: string; plain: string } => {
  switch (p.kind) {
    case 'points': { const n = prizeFor(p.amount, level); return { icon: '💰', big: `+${n}`, small: 'POINTS', plain: `+${n} points` }; }
    case 'time': return { icon: '⏱️', big: <>+{p.amount}<Sec /></>, small: 'TIME', plain: `+${p.amount} seconds` };
    case 'shuffle': return { icon: '🔀', big: `+${p.amount}`, small: p.amount === 1 ? 'SHUFFLE' : 'SHUFFLES', plain: `+${p.amount} ${p.amount === 1 ? 'shuffle' : 'shuffles'}` };
    case 'challenge': return { icon: '⚔️', big: `+${p.amount}`, small: 'CHALLENGE', plain: `+${p.amount} Challenge` };
    case 'charm': { const c = charmById(p.id); return { icon: c?.icon ?? '🍀', big: c?.name ?? 'Charm', small: 'CHARM', plain: `the ${c?.name ?? 'charm'} charm` }; }
    case 'powerplay': { const pp = ppById(p.id); return { icon: pp?.icon ?? '⚡', big: pp?.name ?? 'PowerPlay', small: 'POWERPLAY', plain: `the ${pp?.name ?? ''} PowerPlay` }; }
    default: return { icon: '💀', big: 'SKULL', small: '', plain: 'a skull' };
  }
};

interface Saved { opened?: number[]; squares?: ScratchPrize[]; banked?: boolean }

const ScratchCard: React.FC<{
  level: number;
  squares: ScratchPrize[];
  saved?: Saved;
  onSave?: (key: string, value: unknown) => void;
  onDone: (prize: ScratchPrize | null) => void;
}> = ({ level, squares: dealt, saved, onSave, onDone }) => {
  const [squares, setSquares] = useState<ScratchPrize[]>(saved?.squares ?? dealt);
  const [opened, setOpened] = useState<number[]>(saved?.opened ?? []);
  const [done, setDone] = useState(false);
  // v7.67.3 (the owner's ask): after a bank, the rest of the card turns over so you see what you passed up.
  const [banked, setBanked] = useState<boolean>(!!saved?.banked);
  const last = opened.length ? opened[opened.length - 1] : -1;
  const held = last >= 0 ? squares[last] : null;
  const busted = held?.kind === 'skull';
  const { skulls, left } = skullOdds(squares, opened);
  const prizesLeft = left - skulls;
  const heldLabel = held && !busted ? scratchLabel(held, level) : null;
  const revealAll = banked || busted;
  const bank = () => { if (done || !held || busted) return; soundService.playTileClick(); setBanked(true); onSave?.('banked', true); };

  const scratch = (i: number) => {
    if (done || busted || banked || opened.includes(i)) return;
    let next = squares;
    if (opened.length === 0) {
      next = safeFirstScratch(squares, i); // the first scratch is always safe
      if (next !== squares) { setSquares(next); onSave?.('squares', next); }
    }
    const o = [...opened, i];
    setOpened(o); onSave?.('opened', o);
    if (next[i].kind === 'skull') { soundService.playInvalidWord(); try { navigator.vibrate?.([60, 30, 60]); } catch { /* */ } }
    else { soundService.playTileClick(); try { navigator.vibrate?.(10); } catch { /* */ } }
  };
  const finish = (prize: ScratchPrize | null) => { if (done) return; setDone(true); onDone(prize); };

  return (
    <div className="absolute inset-0 bg-crt-950/90 backdrop-blur-sm flex items-center justify-center z-50 p-3 animate-fade-in" role="dialog" aria-modal="true" aria-label="Scratch-off ticket">
      <div className="bg-crt-900 border-4 border-neon-yellow shadow-[0_0_28px_rgba(255,226,122,0.4)] rounded-2xl px-4 py-4 max-w-md w-full flex flex-col items-center text-center gap-2.5 level-stage-in">
        <p className="osd-text text-lg tracking-[0.25em] text-neon-yellow">LEVEL {level} · LUCKY TICKET</p>
        <h2 className="font-display text-2xl text-white leading-tight">🎟️ SCRATCH-OFF</h2>
        <p className="text-slate-300 text-sm leading-snug">
          Scratch a square to win what's under it. <strong className="text-white">Each new scratch replaces your prize</strong>, so stop when you like what you're holding.
          {' '}{SCRATCH.skulls} squares hide a 💀 that wipes it. Your first scratch is always safe.
        </p>

        {/* What you'd walk away with right now. */}
        <div className={`w-full rounded-xl px-3 py-2 ring-2 ${busted ? 'ring-neon-red bg-neon-red/10' : held ? 'ring-neon-green bg-neon-green/10' : 'ring-white/15 bg-crt-950/70'}`} data-testid="scratch-held" aria-live="polite">
          <p className="osd-text text-sm leading-none text-slate-400">{busted ? 'BUSTED' : banked ? 'YOU BANKED' : "YOU'RE HOLDING"}</p>
          <p className="font-display text-xl leading-tight text-white mt-1">
            {busted ? '💀 Nothing this time' : heldLabel ? <>{heldLabel.icon} {heldLabel.big} <span className="osd-text text-base text-slate-300">{heldLabel.small}</span></> : <span className="text-slate-500">Nothing yet: scratch one!</span>}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 w-full max-w-[18rem]">
          {squares.map((sq, i) => {
            const isOpen = opened.includes(i);
            const missed = !isOpen && revealAll; // turned over after the bank or the bust
            const isHeld = i === last && !busted;
            const lbl = scratchLabel(sq, level);
            return (
              <button key={i} type="button" data-testid="scratch-square" disabled={isOpen || busted || banked || done}
                onClick={() => scratch(i)} aria-label={isOpen ? `Square ${i + 1}: ${lbl.plain}` : missed ? `Square ${i + 1}, not scratched: ${lbl.plain}` : `Scratch square ${i + 1}`}
                className={`aspect-square rounded-lg flex flex-col items-center justify-center px-1 select-none transition-transform active:scale-95 ${
                  missed ? `bg-crt-950/60 border-2 border-dashed ${sq.kind === 'skull' ? 'border-neon-red/60' : 'border-white/40'} opacity-75 level-stage-in`
                  : !isOpen ? 'bg-[linear-gradient(135deg,#d6d9e0_0%,#9aa1ad_45%,#e8eaef_55%,#a3a9b5_100%)] text-crt-900 shadow-inner ring-1 ring-white/50'
                  : sq.kind === 'skull' ? 'bg-neon-red/20 ring-2 ring-neon-red'
                  : isHeld ? 'bg-neon-green/20 ring-2 ring-neon-green' : 'bg-crt-950/80 ring-1 ring-white/10 opacity-50'}`}>
                {!isOpen && !missed ? (
                  <span className="osd-text text-lg leading-none text-crt-900/70">SCRATCH</span>
                ) : (
                  <>
                    <span className="text-2xl leading-none" aria-hidden="true">{lbl.icon}</span>
                    {sq.kind !== 'skull' && (sq.kind === 'charm' || sq.kind === 'powerplay'
                      ? <span className="text-[10px] leading-tight text-white line-clamp-2 mt-0.5">{lbl.big}</span>
                      : <span className="font-display text-sm leading-tight text-white mt-0.5">{lbl.big}</span>)}
                    {missed && <span className="osd-text text-xs leading-none text-slate-400 mt-0.5">{sq.kind === 'skull' ? 'DODGED' : 'MISSED'}</span>}
                  </>
                )}
              </button>
            );
          })}
        </div>

        {revealAll && (
          <p className="text-slate-300 text-sm leading-snug" aria-live="polite">{busted ? "Here's what was under the rest of the card." : "Here's what you passed up. No regrets: you walked away with a prize."}</p>
        )}
        {!revealAll && (
          <p className="osd-text text-base leading-tight text-slate-300">
            {opened.length === 0 ? 'FIRST SCRATCH IS SAFE' : prizesLeft > 0 ? `NEXT SCRATCH: ${skulls} 💀 IN ${left} SQUARES` : 'NO PRIZES LEFT TO SCRATCH'}
          </p>
        )}

        {busted ? (
          <ArcadeButton color="red" className="w-full" onClick={() => finish(null)}>Tear it up</ArcadeButton>
        ) : banked && held ? (
          <ArcadeButton color="green" className="w-full" onClick={() => finish(held)}>Take {heldLabel?.plain}</ArcadeButton>
        ) : held ? (
          <ArcadeButton color="green" className="w-full" onClick={bank}>✋ Bank it: {heldLabel?.plain}</ArcadeButton>
        ) : null}
      </div>
    </div>
  );
};

export default ScratchCard;
