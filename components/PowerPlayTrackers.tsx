import React, { useEffect, useRef, useState } from 'react';

/** A chip that acts only when held (v7.62.0, Jenga's cash-out), so a stray tap above the tiles can't. */
const HoldChip: React.FC<{ ms: number; onHold?: () => void; label: string; testId?: string; children: React.ReactNode }> = ({ ms, onHold, label, testId, children }) => {
  const [holding, setHolding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stop = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; setHolding(false); };
  useEffect(() => stop, []);
  return (
    <button type="button" data-testid={testId} aria-label={label} onContextMenu={e => e.preventDefault()}
      onPointerDown={e => { e.preventDefault(); setHolding(true); timer.current = setTimeout(() => { timer.current = null; setHolding(false); onHold?.(); }, ms); }}
      onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop}
      className="relative overflow-hidden flex items-center gap-1 rounded-full bg-neon-yellow/20 ring-1 ring-neon-yellow px-2 py-0.5 text-xs text-white whitespace-nowrap select-none touch-none">
      {holding && <span className="absolute inset-y-0 left-0 bg-neon-green/40 arm-fill" style={{ animationDuration: `${ms}ms` }} aria-hidden="true" />}
      <span className="relative flex items-center gap-1">{children}</span>
    </button>
  );
};
import type { GameState } from '../types';
import { POWER_PLAY_VALUES as V } from '../config/gameplay';
import { tamagotchiPot, blackjackPayout, jengaPot, prizeFor, levelFor } from '../services/rules';
import { hitInProgress } from '../services/greatestHits';

// Small chips above the hand for PowerPlays that play out over several words (v7.28): the
// Tamagotchi's pot, a buried Time Capsule, the rival race, the blackjack count (tap to stand),
// Hadouken charges, a Price Is Right bid, and the Psychic Friends Network's call (v7.54.0).
const Chip: React.FC<{ icon: string; label: string; children: React.ReactNode }> = ({ icon, label, children }) => (
  <span className="flex items-center gap-1 rounded-full bg-crt-950/80 ring-1 ring-neon-cyan/50 px-2 py-0.5 text-xs text-white whitespace-nowrap" aria-label={label}>
    <span aria-hidden="true">{icon}</span>{children}
  </span>
);

const PowerPlayTrackers: React.FC<{ gameState: GameState; upcomingTiles?: string[]; quizLeft?: number; raceRival?: number; onStand: () => void; onJengaCash?: () => void }> = ({ gameState, upcomingTiles = [], quizLeft, raceRival, onStand, onJengaCash }) => {
  const a = (gameState?.activePowerPlays ?? {}) as Record<string, any>;
  const chips: React.ReactNode[] = [];
  // Greatest Hits (v7.52.0): the word closest to its next record, once it has 2 plays.
  const hit = hitInProgress(gameState?.log ?? [], gameState?.hitsClaimed ?? []);
  if (hit) {
    const left = hit.tier.letters - hit.plays;
    chips.push(
      <span key="hits" className="flex items-center gap-1 rounded-full bg-neon-yellow/15 ring-1 ring-neon-yellow/70 px-2 py-0.5 text-xs text-white whitespace-nowrap"
        aria-label={`Greatest Hits: ${hit.word} played ${hit.plays} of ${hit.tier.letters} times. ${left} more to go ${hit.tier.title} for ${hit.tier.points} points`}>
        <span aria-hidden="true">{hit.tier.icon}</span>{hit.word} {hit.plays}/{hit.tier.letters} · {left === 1 ? 'ONE MORE' : `${left} MORE`} FOR {hit.tier.title} +{hit.tier.points.toLocaleString()}
      </span>);
  }
  // Pop Quiz (v7.36.1): its own countdown in real seconds, so the player can see the 5 s running.
  if (quizLeft !== undefined) {
    const left = Math.ceil(quizLeft);
    chips.push(
      <span key="quiz" className={`flex items-center gap-1.5 rounded-full px-3 py-1 osd-text text-lg leading-none whitespace-nowrap ring-1 ${left > 2 ? 'bg-neon-yellow/20 ring-neon-yellow text-white' : left > 0 ? 'bg-neon-red/30 ring-neon-red text-white animate-pulse' : 'bg-crt-950/80 ring-white/20 text-slate-400'}`}
        role="timer" aria-label={left > 0 ? `Pop Quiz: ${left} seconds left` : 'Pop Quiz: time is up'}>
        <span aria-hidden="true">🚌</span>{left > 0 ? <>POP QUIZ {left}<span className="font-sans text-xs font-semibold lowercase">sec</span></> : <>TOO SLOW · -{V.popQuizPenaltySeconds}<span className="font-sans text-xs font-semibold lowercase">sec</span></>}
      </span>);
  }
  if (a.schruteBucks && typeof a.schruteBucks === 'object') chips.push(<Chip key="beets" icon="💵" label={`Schrute Bucks: ${a.schruteBucks.pot} banked, ${a.schruteBucks.words} words left`}>BUCKS {a.schruteBucks.pot} · {a.schruteBucks.words} left · B/E/T +{V.schruteBucksPerLetter}</Chip>);
  if (a.tamagotchi) chips.push(<Chip key="tama" icon="🥚" label={`Tamagotchi: fed ${a.tamagotchi.feeds} of ${V.tamagotchiWords}`}>{a.tamagotchi.feeds}/{V.tamagotchiWords} · pot {tamagotchiPot(a.tamagotchi.feeds)}</Chip>);
  if (a.timeCapsule && a.timeCapsule !== true) chips.push(<Chip key="capsule" icon="📦" label={`Time Capsule: ${a.timeCapsule.points} points in ${a.timeCapsule.words} words`}>+{a.timeCapsule.points} in {a.timeCapsule.words}</Chip>);
  if (a.smellYaLater) {
    // The rival's score climbs live (v7.36.2), so the race reads as a race.
    const rival = raceRival ?? a.smellYaLater.rival;
    const ahead = a.smellYaLater.mine >= rival;
    chips.push(
      <span key="race" className={`flex items-center gap-1.5 rounded-full px-3 py-1 osd-text text-lg leading-none whitespace-nowrap ring-1 ${ahead ? 'bg-neon-green/15 ring-neon-green text-white' : 'bg-neon-red/25 ring-neon-red text-white'}`}
        aria-label={`Race: you ${a.smellYaLater.mine}, rival ${rival}, ${a.smellYaLater.words} words left`}>
        <span aria-hidden="true">🏃</span>YOU {a.smellYaLater.mine} · RIVAL {rival} · {a.smellYaLater.words} LEFT
      </span>);
  }
  if (a.chickenDinner) {
    const pays = blackjackPayout(a.chickenDinner.total);
    chips.push(
      <button key="dinner" type="button" onClick={onStand} className="flex items-center gap-1 rounded-full bg-neon-yellow/20 ring-1 ring-neon-yellow px-2 py-0.5 text-xs text-white whitespace-nowrap hover:bg-neon-yellow/30" aria-label={`Blackjack count ${a.chickenDinner.total}. Stand${pays ? ` for ${pays}` : ''}`}>
        <span aria-hidden="true">🍗</span>{a.chickenDinner.last ? `${a.chickenDinner.last} → ` : ''}{a.chickenDinner.total}/{V.blackjackTarget} · <strong className="text-neon-yellow">STAND{pays ? ` +${pays}` : ''}</strong>
      </button>);
  }
  // Jenga! (v7.62.0): the tower's pot; tap to cash out once there's a block.
  if (a.jenga) {
    const level = levelFor((gameState?.log ?? []).filter(e => e.type === 'word' && (e as { status?: string }).status === 'valid').length);
    const blocks = a.jenga.blocks ?? 0;
    const pot = prizeFor(jengaPot(blocks), level);
    const next = prizeFor(V.jengaStep * (blocks + 1), level);
    chips.push(blocks > 0
      ? <HoldChip key="jenga" ms={V.jengaHoldMs} onHold={onJengaCash} testId="jenga-chip"
          label={`Jenga tower: ${blocks} of ${V.jengaBlocks} blocks, ${pot} in the pot. Press and hold to cash out. Next block adds ${next}. A word under ${V.jengaMinLetters} letters, an invalid word or a strike topples it.`}>
          <span aria-hidden="true">🧱</span>{blocks}/{V.jengaBlocks} · <strong className="text-neon-yellow">HOLD TO CASH +{pot}</strong> · NEXT +{next} · {V.jengaMinLetters}+ LETTERS
        </HoldChip>
      : <Chip key="jenga" icon="🧱" label={`Jenga: play a ${V.jengaMinLetters}+ letter word to add the first block, worth ${next}.`}>FIRST BLOCK +{next} · {V.jengaMinLetters}+ LETTERS OR IT FALLS</Chip>);
  }
  if (a.inception) {
    const each = prizeFor(V.inceptionPerWord, levelFor((gameState?.log ?? []).filter(e => e.type === 'word' && (e as { status?: string }).status === 'valid').length));
    chips.push(<Chip key="inception" icon="🌀" label={`Inception: every real word hiding inside your next ${a.inception.words} words pays ${each}`}>WORDS INSIDE WORDS +{each} EACH · {a.inception.words} LEFT</Chip>);
  }
  // v7.71.1: Hadouken! waits for a boss on its own; it shows in the Gear strip and menu, not here.
  if (a.priceIsRight) chips.push(<Chip key="price" icon="🏷️" label={`Bid: ${a.priceIsRight.bid} or more for ${a.priceIsRight.prize}, miss and lose ${a.priceIsRight.miss ?? 0}`}>{a.priceIsRight.bid}+ → +{a.priceIsRight.prize}{a.priceIsRight.miss ? ` / -${a.priceIsRight.miss}` : ''}</Chip>);
  if (a.psychicFriends && typeof a.psychicFriends.letters === 'number') chips.push(<Chip key="psychic" icon="🔮" label={`Psychic call: ${a.psychicFriends.letters}${a.psychicFriends.orMore ? ' or more' : ''} letters for ${a.psychicFriends.prize}`}>CALLED: {a.psychicFriends.letters}{a.psychicFriends.orMore ? '+' : ''} LETTERS · +{a.psychicFriends.prize}</Chip>);
  if (!chips.length) return null;
  return <div className="flex flex-wrap justify-center gap-1" aria-label="PowerPlay trackers">{chips}</div>;
};

export default PowerPlayTrackers;
