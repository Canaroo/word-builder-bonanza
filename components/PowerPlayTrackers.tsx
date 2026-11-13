import React from 'react';
import type { GameState } from '../types';
import { POWER_PLAY_VALUES as V } from '../config/gameplay';
import { tamagotchiPot, blackjackPayout } from '../services/rules';

// Small chips above the hand for PowerPlays that play out over several words (v7.28): the
// Tamagotchi's pot, a buried Time Capsule, the rival race, the blackjack count (tap to stand),
// Hadouken charges, a Price Is Right bid, and the Psychic Friends Network's look at the next tiles.
const Chip: React.FC<{ icon: string; label: string; children: React.ReactNode }> = ({ icon, label, children }) => (
  <span className="flex items-center gap-1 rounded-full bg-crt-950/80 ring-1 ring-neon-cyan/50 px-2 py-0.5 text-xs text-white whitespace-nowrap" aria-label={label}>
    <span aria-hidden="true">{icon}</span>{children}
  </span>
);

const PowerPlayTrackers: React.FC<{ gameState: GameState; upcomingTiles?: string[]; quizLeft?: number; raceRival?: number; onStand: () => void }> = ({ gameState, upcomingTiles = [], quizLeft, raceRival, onStand }) => {
  const a = (gameState?.activePowerPlays ?? {}) as Record<string, any>;
  const chips: React.ReactNode[] = [];
  // Pop Quiz (v7.36.1): its own countdown in real seconds, so the player can see the 5 s running.
  if (quizLeft !== undefined) {
    const left = Math.ceil(quizLeft);
    chips.push(
      <span key="quiz" className={`flex items-center gap-1.5 rounded-full px-3 py-1 osd-text text-lg leading-none whitespace-nowrap ring-1 ${left > 2 ? 'bg-neon-yellow/20 ring-neon-yellow text-white' : left > 0 ? 'bg-neon-red/30 ring-neon-red text-white animate-pulse' : 'bg-crt-950/80 ring-white/20 text-slate-400'}`}
        role="timer" aria-label={left > 0 ? `Pop Quiz: ${left} seconds left` : 'Pop Quiz: time is up'}>
        <span aria-hidden="true">🚌</span>{left > 0 ? `POP QUIZ ${left}s` : `TOO SLOW · -${V.popQuizPenaltySeconds}s`}
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
  if (a.hadouken) chips.push(<Chip key="hadouken" icon="💥" label={`Hadouken: ${a.hadouken.hits} boss hits saved`}>×{a.hadouken.hits}{gameState.boss ? '' : ' · next boss'}</Chip>);
  if (a.priceIsRight) chips.push(<Chip key="price" icon="🏷️" label={`Bid: ${a.priceIsRight.bid} or more for ${a.priceIsRight.prize}, miss and lose ${a.priceIsRight.miss ?? 0}`}>{a.priceIsRight.bid}+ → +{a.priceIsRight.prize}{a.priceIsRight.miss ? ` / -${a.priceIsRight.miss}` : ''}</Chip>);
  if (a.psychicFriends && upcomingTiles.length) chips.push(<Chip key="psychic" icon="🔮" label={`Next tiles: ${upcomingTiles.join(', ')}`}><span className="font-tile font-bold tracking-widest text-neon-cyan">{upcomingTiles.join(' ')}</span></Chip>);
  if (!chips.length) return null;
  return <div className="flex flex-wrap justify-center gap-1" aria-label="PowerPlay trackers">{chips}</div>;
};

export default PowerPlayTrackers;
