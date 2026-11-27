import { assignTilesToWord } from '../rackMatch';
import { Sec, withSec } from '../../components/Seconds';
import EndRunCard from '../../components/EndRunCard';
import GearMenu from '../../components/GearMenu';
import { FRAGILE } from '../../config/gameplay';
import VideoStore from '../../components/VideoStore';
import { genrePay, earlierKeys } from '../../data/videoStore';
import React, { useEffect, useRef, useState } from 'react';
import ArcadeButton, { NamedLabel } from '../../components/ArcadeButton';
import ShuffleButton from '../../components/ShuffleButton';
import BonusReveal from '../../components/BonusReveal';
import SlotMachine from '../../components/SlotMachine';
import { PowerPlayOffer, CharmOffer, SetNote } from '../../components/OfferModals';
import { PRIZE_POWER_PLAY_IDS, POWER_PLAYS_LIST } from '../../data/powerPlays';
import { GameState, Tile, WordData, Milestone, Charm, PowerPlay } from '../../types';
import Timer from '../../components/Timer';
import TileComponent from '../../components/Tile';
import EventLogDisplay from '../../components/EventLogDisplay';
import { MILESTONES_LIST } from '../../data/milestones';
import DurationBadge from '../../ui/DurationBadge';
import { RACK_SIZE, HAND_SIZE } from '../../constants';
import { GAMEPLAY, CHARM_SLOTS, CHARM_UPGRADE, TIME_BONUS, BOSS, CHARM_BONUS, GEM_TILES, QUACK_ATTACK, BLUE_STEEL } from '../../config/gameplay';
import { bossById } from '../../data/bosses';
import { levelFor, snitchTargetFor, meterLettersFor, levelTierFor, bossHitsToWin, prizeScaleFor, timeForWordAtLevel, lengthMultiplier } from '../rules';
import { soundService } from '../soundService';
import { hitIfPlayed } from '../greatestHits';
import LevelBadge from '../../components/LevelBadge';
import LevelUpCard from '../../components/LevelUpCard';
import OutcomeCard from '../../components/OutcomeCard';
import ContinueCard from '../../components/ContinueCard';
import LastWordsCard from '../../components/LastWordsCard';
import ScratchCard from '../../components/ScratchCard';
import type { ScratchPrize } from '../scratch';
import CrocCard from '../../components/CrocCard';
import SoundMenu from '../../components/SoundMenu';
import GreatestHitCard from '../../components/GreatestHitCard';
import BonesCard from '../../components/BonesCard';
import { SKILL_SHOT, GATES, MYSTERY_TAPE, SHINE_BRIGHT_GEMS, CHARM_BONUS as CB } from '../../config/gameplay';
import { skillShotPoints } from '../../services/rules';
import GambleCard, { type GambleResult } from '../../components/GambleCard';
import PowerPlayTrackers, { HitsChip } from '../../components/PowerPlayTrackers';
import MiniGameCard from '../../components/MiniGames';
import CharmTimeNote from '../../components/CharmTimeNote';
import { nextGateFor, previousGateFor, powerWordInfo, prizeFor, speedStreakPoints } from '../rules';
import ModalTapGuard, { GUARDLESS_MODALS } from '../../components/ModalTapGuard';
import { POWER_PLAY_VALUES } from '../../config/gameplay';

export type ModalContent = {
  type: 'milestone' | 'blue-steel' | 'charm-selection' | 'powerplay-selection' | 'word-log' | 'info' | 'powerplay-activation' | 'word-bonus' | 'charm-activation' | 'buff-info' | 'easter-egg' | 'super-hand' | 'save-confirmation' | 'game-over-summary' | 'milestone-info' | 'event-log' | 'slot-machine' | 'level-up' | 'outcome' | 'gamble' | 'minigame' | 'continue-offer' | 'last-words' | 'fork' | 'scratch' | 'bones' | 'skill-intro' | 'gem-intro' | 'croc' | 'greatest-hit' | 'quack' | 'triforce' | 'gear' | 'heads-up' | 'video-store' | 'static-tile' | 'genre-up';
  title: string;
  content?: React.ReactNode;
  data?: any;
  autoClose?: number;
} | null;

const BUILD_ROW_SIZE = 8;

// A–Z grid for "pick a letter" pop-ups: tap to pick (it lights up), tap Confirm to use it.
const LetterPicker: React.FC<{ onConfirm: (letter: string) => void; tone?: 'green' | 'purple'; letters?: string }> = ({ onConfirm, tone = 'green', letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' }) => {
  const [picked, setPicked] = useState<string | null>(null);
  const confirmColor = tone === 'green' ? 'bg-green-500 hover:bg-green-400' : 'bg-purple-500 hover:bg-purple-400';
  return (
    <>
      <div className="grid grid-cols-6 gap-2 my-4">
        {letters.split('').map(letter => {
          const selected = picked === letter;
          return (
            <button
              key={letter}
              type="button"
              aria-pressed={selected}
              onClick={() => setPicked(selected ? null : letter)}
              className={`relative w-full h-12 text-xl font-bold rounded-lg shadow-lg transition ${
                selected
                  ? 'bg-neon-green text-crt-900 ring-4 ring-neon-green/60 scale-110 shadow-[0_0_14px_rgba(61,255,140,0.7)]'
                  : picked ? 'bg-slate-700 text-slate-100 opacity-45' : 'bg-slate-700 text-slate-100 hover:bg-slate-600'
              }`}
            >
              {letter}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => picked && onConfirm(picked)}
        disabled={!picked}
        className={`w-full px-6 py-3 text-xl font-bold text-slate-900 rounded-lg shadow-lg ${confirmColor} disabled:bg-slate-500 disabled:text-slate-300 disabled:cursor-not-allowed`}
      >
        {picked ? `Confirm: ${picked}` : 'Tap a letter to pick it'}
      </button>
    </>
  );
};

/**
 * v7.81.0: ⌫ on the stage. A tap sends the last letter back; holding it (450 ms) clears the whole word,
 * like a keyboard's delete key.
 */
const BackspaceButton: React.FC<{ disabled: boolean; onBack: () => void; onClearAll: () => void }> = ({ disabled, onBack, onClearAll }) => {
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cleared = useRef(false);
  useEffect(() => () => { if (hold.current) clearTimeout(hold.current); }, []);
  return (
    <button type="button" disabled={disabled} data-testid="backspace"
      aria-label="Delete the last letter. Hold to clear the word."
      className="absolute bottom-2 right-2 z-10 w-11 h-11 rounded-xl grid place-items-center text-xl text-slate-200 bg-crt-950/80 ring-1 ring-white/20 hover:ring-neon-cyan/60 active:translate-y-0.5 disabled:opacity-40 select-none touch-none"
      onPointerDown={e => { if (disabled || e.button !== 0) return; e.preventDefault(); cleared.current = false; hold.current = setTimeout(() => { hold.current = null; cleared.current = true; onClearAll(); }, 450); }}
      onPointerUp={() => { if (hold.current) { clearTimeout(hold.current); hold.current = null; onBack(); } }}
      onPointerLeave={() => { if (hold.current) { clearTimeout(hold.current); hold.current = null; } }}
      onClick={e => { if (e.detail === 0 && !disabled) onBack(); }}
      onContextMenu={e => e.preventDefault()}
    >⌫</button>
  );
};

/**
 * v7.84.0: charm time cut by the level, shown in the score column for a few seconds (it used to drop
 * down over the clock and the level badge). After it fades the next-gate marker comes back.
 */
const HudCharmNote: React.FC<{ full: number; paid: number; percent: number; halved: boolean; level: number }> = ({ full, paid, percent, halved, level }) => {
  const [gone, setGone] = useState(false);
  useEffect(() => { const t = setTimeout(() => setGone(true), 3200); return () => clearTimeout(t); }, []);
  if (gone) return null;
  return (
    <div className="hud-charm-note osd-text text-sm leading-tight text-neon-orange" role="status" data-testid="charm-note">
      🍀 CHARM {full}→{paid} SEC
      {percent < 100 && <span className="text-slate-300"> · LV{level} {percent}%</span>}
      {halved && <span className="text-neon-yellow"> · ½ OVER {GAMEPLAY.timeBank.overflowAbove}</span>}
    </div>
  );
};

interface Notice { id: string; icon: string; title: React.ReactNode; text: string; tone: 'yellow' | 'pink' | 'sky' | 'green'; action?: string; onTap?: () => void; label: string; testId?: string }
const NOTICE_TONES: Record<Notice['tone'], { box: string; title: string; btn: string }> = {
  yellow: { box: 'bg-neon-yellow/10 ring-neon-yellow/60', title: 'text-neon-yellow', btn: 'bg-neon-yellow text-crt-900' },
  pink: { box: 'bg-neon-pink/10 ring-neon-pink/60', title: 'text-neon-pink', btn: 'bg-neon-pink text-white' },
  sky: { box: 'bg-[#4dd2ff]/10 ring-[#4dd2ff]/60', title: 'text-[#9be8ff]', btn: 'bg-[#4dd2ff] text-crt-900' },
  green: { box: 'bg-neon-green/10 ring-neon-green/50', title: 'text-neon-green', btn: 'bg-neon-green text-crt-900' },
};
/**
 * v7.82.0: the notice rail's cards. One notice at a time (icon, title, one plain line, a labelled
 * button when it does something); dots flip between several. A new notice jumps to the front and
 * pulses once.
 */
const NoticeRail: React.FC<{ notices: Notice[]; flash?: { id: string; key: number } | null }> = ({ notices, flash }) => {
  const [pick, setPick] = useState<string | null>(null);
  const seen = useRef<Set<string>>(new Set());
  const [fresh, setFresh] = useState<string | null>(null);
  // v7.91.0: after a heads-up card's OK, its notice jumps to the front and flashes for a few seconds.
  const [flashing, setFlashing] = useState<string | null>(null);
  useEffect(() => {
    if (!flash) return;
    setPick(flash.id); setFlashing(flash.id);
    const t = setTimeout(() => setFlashing(f => (f === flash.id ? null : f)), 4200);
    return () => clearTimeout(t);
  }, [flash?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const added = notices.find(n => !seen.current.has(n.id));
    notices.forEach(n => seen.current.add(n.id));
    for (const id of [...seen.current]) if (!notices.some(n => n.id === id)) seen.current.delete(id);
    if (added) { setPick(added.id); setFresh(added.id); const t = setTimeout(() => setFresh(f => (f === added.id ? null : f)), 1600); return () => clearTimeout(t); }
  }, [notices.map(n => n.id).join('|')]); // eslint-disable-line react-hooks/exhaustive-deps
  const n = notices.find(x => x.id === pick) ?? notices[0];
  const tone = NOTICE_TONES[n.tone];
  const body = (
    <>
      <span className="text-xl leading-none shrink-0 w-8 text-center" aria-hidden="true">{n.icon}</span>
      <span className="flex-1 min-w-0 text-left">
        <span className={`block osd-text text-lg leading-none tracking-wide truncate ${tone.title}`}>{n.title}</span>
        <span className="block text-[11.5px] leading-snug text-slate-100 line-clamp-2 [@media(max-height:700px)]:hidden">{n.text}</span>
      </span>
      {n.action && <span className={`shrink-0 osd-text text-base leading-none rounded-md px-2 py-1.5 ${tone.btn}`}>{n.action}</span>}
    </>
  );
  const cls = `w-full flex items-center gap-2 rounded-xl ring-1 px-2 py-1.5 ${tone.box} ${flashing === n.id ? 'notice-flash' : fresh === n.id ? 'notice-new' : ''}`;
  return (
    <div>
      {n.onTap
        ? <button type="button" key={n.id} onClick={n.onTap} className={`${cls} hover:brightness-110`} aria-label={n.label} data-testid={n.testId ?? `notice-${n.id}`}>{body}</button>
        : <div key={n.id} className={cls} role="note" aria-label={n.label} data-testid={n.testId ?? `notice-${n.id}`}>{body}</div>}
      {notices.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-1 [@media(max-height:700px)]:mt-0.5" role="tablist" aria-label="Notices">
          {notices.map(x => (
            <button key={x.id} type="button" role="tab" aria-selected={x.id === n.id} aria-label={`Notice: ${typeof x.title === 'string' ? x.title : x.id}`}
              onClick={() => setPick(x.id)} className={`h-2 rounded-full transition-all ${x.id === n.id ? 'w-5 bg-neon-yellow' : 'w-2 bg-white/25'}`} />
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * v7.85.0 (the owner's call): after a word lands, the score it really earned pops on the stage, big, with
 * the base and what the boosts added (Combo x2, upgrades, multipliers, charms...). It fades on its own
 * after 2.6 s and disappears the moment the next tile is placed.
 */
/**
 * v7.94.1 (the owner's call: the line-by-line tally was too long and too fast to read). After each word
 * a quick payoff pops on the stage: the word, then the big number rolls from the BASE the player saw while
 * spelling up to what the word really scored (about half a second), slams in, holds, and fades. When boosts
 * changed it, "BASE 25 → +150" shows under it; the full breakdown is in 🎒 Gear → Event log. The clock waits
 * while it shows (v7.96.2: no tap-to-skip cover; it's quick enough, and placing a tile ends it).
 */
export const LANDED_ROLL_MS = 550;
export const LANDED_HOLD_MS = 1400;
const LANDED_FADE_MS = 250;
/** The rolling number at time t (ms): eased from base to total over LANDED_ROLL_MS. */
export const rollValue = (base: number, total: number, t: number): number => {
  if (t >= LANDED_ROLL_MS || base === total) return total;
  const k = Math.max(0, t) / LANDED_ROLL_MS;
  return Math.round(base + (total - base) * (1 - Math.pow(1 - k, 3)));
};
const ScoreTally: React.FC<{ word: string; total: number; base: number; onShown: (v: boolean) => void; onDone: () => void }> = ({ word, total, base, onShown, onDone }) => {
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const rolls = total !== base && !reduce;
  const [value, setValue] = useState(rolls ? base : total);
  const [phase, setPhase] = useState<'roll' | 'hold' | 'fade' | 'gone'>(rolls ? 'roll' : 'hold');
  useEffect(() => { onShown(true); return () => onShown(false); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (phase !== 'roll') return;
    const start = performance.now();
    let raf = 0, lastTick = -1;
    const step = () => {
      const t = performance.now() - start;
      const v = rollValue(base, total, t);
      setValue(v);
      const tick = Math.floor(t / 90);
      if (tick !== lastTick) { lastTick = tick; soundService.playTilePlace(Math.min(7, tick)); }
      if (t >= LANDED_ROLL_MS) { setPhase('hold'); return; }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (phase === 'hold') {
      setValue(total);
      if (total > base) soundService.playShimmer();
      const t = setTimeout(() => setPhase('fade'), LANDED_HOLD_MS);
      return () => clearTimeout(t);
    }
    if (phase === 'fade') {
      const t = setTimeout(() => { setPhase('gone'); onShown(false); onDone(); }, LANDED_FADE_MS);
      return () => clearTimeout(t);
    }
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps
  if (phase === 'gone') return null;
  const landed = phase !== 'roll';
  return (
    <div className={`absolute inset-0 z-20 flex items-center justify-center px-3 pointer-events-none transition-opacity duration-200 ${phase === 'fade' ? 'opacity-0' : 'opacity-100'}`} role="status" aria-live="polite" data-testid="score-tally">
      <div className="flex flex-col items-center text-center" data-testid="landed-pop">
        <div className="osd-text text-2xl leading-none text-slate-300 tracking-widest">{word.toUpperCase()}</div>
        <div className={`font-display leading-none mt-2 tabular-nums text-7xl ${landed ? 'tally-slam' : ''} ${total > 0 ? 'text-neon-green drop-shadow-[0_0_18px_rgba(61,255,140,0.7)]' : 'text-slate-400'}`} data-testid="tally-total">
          +{value.toLocaleString()}
        </div>
        {total !== base && landed && (
          <div className="osd-text text-xl leading-none mt-2 text-slate-300" data-testid="landed-breakdown">
            BASE {base.toLocaleString()} → <span className="text-neon-yellow">+{total.toLocaleString()}</span>
          </div>
        )}
      </div>
    </div>
  );
};

/** v7.81.0: a short shimmer the moment the word on the stage would fill the PowerPlay meter or start a Golden Round. */
const StageSounds: React.FC<{ effects: string[] }> = ({ effects }) => {
  const fills = effects.some(e => e.includes('FILLS YOUR POWERPLAY') || e.includes('STARTS A GOLDEN ROUND'));
  const was = useRef(false);
  useEffect(() => { if (fills && !was.current) soundService.playShimmer(); was.current = fills; }, [fills]);
  return null;
};

// A hand tile inside a "pick a tile" pop-up. Picked tiles lift, get a green ring and a check mark;
// once something is picked, the rest dim so the choice is obvious before Confirm.
const PickTile: React.FC<{ tile: Tile; selected: boolean; dimmed?: boolean; onClick: () => void; tileClass: string }> = ({ tile, selected, dimmed, onClick, tileClass }) => (
  <div className={`relative w-full h-full rounded-lg transition-transform duration-150 ${selected ? '-translate-y-1 scale-105 ring-4 ring-neon-green shadow-[0_0_14px_rgba(61,255,140,0.7)]' : dimmed ? 'opacity-45' : ''}`} aria-pressed={selected}>
    <TileComponent tile={tile} onClick={onClick} packTileClass={tileClass} />
    {selected && (
      <span className="absolute -top-2 -right-2 z-20 w-6 h-6 rounded-full bg-neon-green text-crt-900 font-bold text-sm leading-6 text-center shadow-md pointer-events-none" aria-hidden="true">✓</span>
    )}
  </div>
);

export interface GameScreenViewProps {
  gameState: GameState;
  time: number;
  /** Seconds left in the 3-2-1 after resuming a saved run (0 once play continues). */
  resumeCountdown?: number;
  /** A gamble PowerPlay's decision (doors, deal, spins, mines) is in. */
  handleResolveGamble?: (r: GambleResult) => void;
  /** An arcade mini-game finished (null: skipped). */
  handleResolveMiniGame?: (r: { points: number; headline: string; detail: string } | null) => void;
  /** Phoenix Down: buy the continue (true) or let the run end (false). */
  handleContinueOffer?: (accept: boolean) => void;
  /** Credits the player holds. */
  lexCoins?: number;
  /** Last Words: the parting word's result (null: skipped). */
  handleLastWords?: (r: { word: string; points: number } | null) => void;
  /** Skill Shot: the lit tile's id ('' when none). */
  skillShotTileId?: string;
  /** Hold Slot: unlocked, waiting for a tile to park, and the tap handler. */
  holdOpen?: boolean;
  holdArmed?: boolean;
  handleHoldTap?: () => void;
  /** Bones: the word spelled from a fallen player's hand (null: missed or skipped). */
  handleBonesDone?: (word: string | null) => void;
  /** Fork in the Road: the route picked. */
  handleScratchDone?: (prize: ScratchPrize | null) => void;
  /** 📼 The Video Store (v7.96.0). */
  handleStoreRent?: (index: number) => void;
  handleStoreRestock?: () => void;
  handleStoreTradeIn?: (charmId: string) => void;
  handleStoreUndoTrade?: (line: number) => void;
  handleStoreLeave?: () => void;
  /** 📺 Static Tile: the letter the player picked for the blank. */
  handleStaticLetter?: (letter: string) => void;
  handleCrocPick?: () => void;
  /** A power word can be spelled from the tiles in play (the hint chip); tapping it explains. */
  powerHint?: { icon: string; length: number; word?: string; effect?: string } | null;
  handlePowerHintInfo?: () => void;
  /** Psychic Friends Network: the next tiles in the bag, in draw order. */
  upcomingTiles?: string[];
  /** Real seconds left on a running Pop Quiz (undefined when none). */
  quizLeft?: number;
  /** Smell Ya Later!: the rival's live score (undefined when no race). */
  raceRival?: number;
  timeGain?: { seconds: number; key: number; taxed?: boolean; charm?: { full: number; paid: number; percent: number; halved: boolean } };
  /** Short game feedback (PowerPlay results, combos, hints). Empty when nothing to say. */
  message?: string;
  hand: (Tile | null)[];
  buildRow: ({tile: Tile, originalIndex: number} | null)[];
  isPaused: boolean;
  isLoading: boolean;
  modalContent: ModalContent;
  tilesToSwap: { tile: Tile, originalIndex: number }[];
  tileToTransform: { tile: Tile, originalIndex: number } | null;
  /** The tile picked in a single-tile PowerPlay (Hookshot, Captain Planet, Duck Hunt...). */
  tileForSelection: { tile: Tile, originalIndex: number } | null;
  wordFromBuildRow: string;
  totalWords: number;
  potentialScore: number;
  /** v7.85.0: the score the last word really earned (and its base), popped on the stage after submit. */
  landed?: { word: string; total: number; base: number; key: number; tiles?: number; lines?: { name: string; d: string }[] } | null;
  /** v7.94.0: tells the game the score count-up is playing, so the clock waits. */
  onTally?: (on: boolean) => void;
  maxStrikes: number;
  challengeButtonText: string;
  tileClass: string;
  isMuted: boolean;
  isChallengeLock: boolean;
  highlightedTileIds: { first: string | null; rest: string[] };
  isStrikeChallenge: boolean;
  strikesRemaining: number;
  
  handleMuteToggle: () => void;
  handleCloseModal: () => void;
  /** Wordionaire's Phone-a-Friend: reveal the best word in the hand. */
  handlePhoneAFriend: () => void;
  handleShowMilestoneInfo: (milestone: Milestone) => void;
  handleShowEventLog: () => void;
  handleMoveToBuild: (tile: Tile, fromIndex: number) => void;
  handleReturnToHand: (fromBuildIndex: number) => void;
  handleShuffle: (isFree?: boolean, isFromChallengeWin?: boolean) => void;
  handleSubmit: () => Promise<void>;
  handleClear: () => void;
  handleChallenge: () => Promise<void>;
  handleSaveClick: () => void;
  handleConfirmSave: () => void;
  /** Opens the End run card (two confirmations; the run is thrown away). */
  handleEndRun?: () => void;
  /** The End run card while it's open (v7.67.5). */
  endRun?: { summary?: string; onCancel: () => void; onConfirm: () => void } | null;
  /** Another open copy of the game took this run's save slot: back to the start screen (v7.67.5). */
  onLostSave?: (() => void) | null;
  showBuffInfo: (buff: Charm | PowerPlay) => void;
  handleActivatePowerPlay: (powerPlay: PowerPlay, confirmed?: boolean | 'use') => void;
  handleActivateCharm: (charm: Charm) => void;
  handleChoosePowerPlay: (powerPlay: PowerPlay, allOffered: PowerPlay[]) => void;
  handleChooseCharm: (charm: Charm, allOffered: Charm[], replaceId?: string) => void;
  handlePassCharm: (allOffered: Charm[]) => void;
  handleUpgradeCharm: (charmId: string, allOffered: Charm[]) => void;
  handleKeepPowerPlay: (allOffered: PowerPlay[]) => void;
  handleAddTileToSwap: (tile: Tile, originalIndex: number) => void;
  handleRemoveTileFromSwap: (originalIndex: number) => void;
  handleExecuteSwap: () => void;
  dispatch: React.Dispatch<any>;
}

export const GameScreenView: React.FC<GameScreenViewProps> = ({
    gameState, time, resumeCountdown = 0, handleResolveGamble, handleResolveMiniGame, handleContinueOffer, handleLastWords, handleStoreRent, handleStoreRestock, handleStoreTradeIn, handleStoreUndoTrade, handleStoreLeave, handleStaticLetter, skillShotTileId = '', holdOpen = false, holdArmed = false, handleHoldTap, handleScratchDone, handleCrocPick, handleBonesDone, lexCoins = 0, powerHint = null, handlePowerHintInfo, upcomingTiles, quizLeft, raceRival, timeGain, message, hand, buildRow, isPaused, isLoading, modalContent, tilesToSwap,
    tileToTransform, tileForSelection, wordFromBuildRow, totalWords, potentialScore, maxStrikes, challengeButtonText,
    tileClass, isMuted, isChallengeLock, highlightedTileIds, isStrikeChallenge, strikesRemaining,
    handleMuteToggle, handleCloseModal, handlePhoneAFriend, handleShowMilestoneInfo, handleShowEventLog,
    handleMoveToBuild, handleReturnToHand, handleShuffle, handleSubmit, handleClear,
    handleChallenge, handleSaveClick, handleConfirmSave, handleEndRun, endRun, onLostSave, showBuffInfo,
    handleActivatePowerPlay, handleActivateCharm, handleChoosePowerPlay, handleChooseCharm, handlePassCharm, handleUpgradeCharm, handleKeepPowerPlay,
    handleAddTileToSwap, handleRemoveTileFromSwap, handleExecuteSwap, dispatch, landed = null, onTally
}) => {
    const [landedShown, setLandedShown] = useState(false);
    // v7.94.0: the score pop runs while landedShown, and the clock waits.
    const [tallyDoneKey, setTallyDoneKey] = useState(0);
    // v7.96.4 (the owner's report): placing a tile ends this word's pop for good. It used to only hide it, so
    // sending the tile back brought the pop (and its clock pause) back, again and again.
    const placedCount = (buildRow ?? []).filter(Boolean).length;
    useEffect(() => { if (placedCount > 0 && landed && tallyDoneKey !== landed.key) setTallyDoneKey(landed.key); }, [placedCount, landed?.key]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { onTally?.(landedShown); }, [landedShown]); // eslint-disable-line react-hooks/exhaustive-deps
    const skillShotPrize = skillShotPoints((gameState?.skillShot?.streak ?? 0) + 1);
    const timerRef = useRef<HTMLDivElement>(null);
    // Bird Box (v7.28): new tiles show their letters for a few seconds, then flip face down.
    // Only tiles never seen before start a peek (v7.32.4): tapping a tile into the word, or one
    // coming back to the hand, used to change the hand and flip every tile face up again.
    // Resuming a saved run that's already blind doesn't peek either (no quit-and-reload peek).
    // Multiplicity copies the last PowerPlay used that it can copy (lastPowerPlayUsed only ever holds those).
    const copyTarget = gameState?.lastPowerPlayUsed ? POWER_PLAYS_LIST.find(p => p.id === gameState.lastPowerPlayUsed) ?? null : null;
    const blind = !!gameState?.activePowerPlays?.birdBox;
    const handIds = (hand ?? []).filter(Boolean).map(t => t!.id);
    const handKey = handIds.join(',');
    const [peeking, setPeeking] = useState(!blind);
    const seenIds = useRef<Set<string> | null>(null);
    const blindAtMount = useRef(blind);
    const peekTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => () => { if (peekTimer.current) clearTimeout(peekTimer.current); }, []);
    useEffect(() => {
        if (!blind) {
            seenIds.current = null;
            blindAtMount.current = false;
            if (peekTimer.current) clearTimeout(peekTimer.current);
            setPeeking(true);
            return;
        }
        let fresh: boolean;
        if (!seenIds.current) {
            seenIds.current = new Set(handIds);
            fresh = !blindAtMount.current;
            blindAtMount.current = false;
        } else {
            fresh = handIds.some(id => !seenIds.current!.has(id));
            handIds.forEach(id => seenIds.current!.add(id));
        }
        if (!fresh) return;
        setPeeking(true);
        if (peekTimer.current) clearTimeout(peekTimer.current);
        peekTimer.current = setTimeout(() => setPeeking(false), POWER_PLAY_VALUES.birdBoxSeconds * 1000);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [blind, handKey]);
    // After a level-up (once every pop-up it came with is closed), the level badge under the timer
    // flashes in its tier color, so the card and the badge read as one thing.
    const [levelFlash, setLevelFlash] = useState(0);
    const flashPending = useRef(false);
    useEffect(() => {
        if (modalContent?.type === 'level-up') flashPending.current = true;
        else if (!modalContent && flashPending.current) {
            flashPending.current = false;
            setLevelFlash(Date.now());
        }
    }, [modalContent]);
    // v7.61.0: power word hint: the prize on the chip, and (after a tap) the tiles that spell it lit.
    const [powerLitWord, setPowerLitWord] = React.useState('');
    // v7.91.0: which notice to flash after a heads-up card's OK.
    const [noticeFlash, setNoticeFlash] = React.useState<{ id: string; key: number } | null>(null);
    const powerLit = !!powerHint?.word && powerLitWord === powerHint.word;
    const powerPrize = powerHint?.effect ? powerWordInfo(powerHint.effect as any).prize : 'A BONUS';
    const powerLitIds = React.useMemo(() => {
      const ids = new Set<string>();
      if (!powerLit || !powerHint?.word) return ids;
      // v7.91.1: the same matcher the game uses to spell words, so a combo tile (QU, ING...) lights
      // as one tile instead of leaving those letters dark (it used to match single letters only).
      const pool = [...(hand ?? []), ...(buildRow ?? []).map(i => i?.tile)].filter((t): t is Tile => !!t);
      const picked = assignTilesToWord(powerHint.word, pool.map(t => t.letter.toUpperCase()));
      (picked ?? []).forEach(i => ids.add(pool[i].id));
      return ids;
    }, [powerLit, powerHint?.word, hand, buildRow]);
    // v7.66.0: I Feel the Need… for Speed: the streak, so the player knows it's counting.
    const speedOn = (gameState?.activeCharms ?? []).some(c => c.id === 'needForSpeed');
    const speedStreak = gameState?.speedStreak ?? 0;
    const speedChip = speedOn ? (
      <span data-testid="speed-chip" className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-white whitespace-nowrap ring-1 ${speedStreak >= 1 ? 'ring-neon-cyan bg-neon-cyan/15' : 'ring-white/20 bg-crt-950/70'}`}
        aria-label={`Speed streak: ${speedStreak}. Next fast ${CB.speedLetters}+ letter word pays ${speedStreakPoints(speedStreak + 1)}.`}>
        <span aria-hidden="true">🛩️</span>{speedStreak >= 1 ? `SPEED x${speedStreak} · NEXT +${speedStreakPoints(speedStreak + 1)} IF ≤${CB.speedSeconds}` : `${CB.speedLetters}+ LETTERS FAST TO START`}{speedStreak >= 1 && <span className="font-sans text-[10px] lowercase">sec</span>}
      </span>
    ) : null;
    const nextGate = gameState?.roundType === 'golden' ? null : nextGateFor(gameState);
    // v7.71.1 (the owner's call): the charm set chip left the area above the tiles; it lives in the
    // Gear menu now, and the 🎒 button glows when something new lands there.
    const gearIds = (gameState?.activeCharms ?? []).map(c => c.id);
    const upgradeCount = (gameState?.charmUpgrades ?? []).length;
    const gearSeen = React.useRef<{ ids: string[]; upgrades: number } | null>(null);
    const [gearGlow, setGearGlow] = React.useState(false);
    React.useEffect(() => {
        const prev = gearSeen.current;
        gearSeen.current = { ids: gearIds, upgrades: upgradeCount };
        if (!prev) return; // not on the first render (a resumed run)
        const gained = upgradeCount > prev.upgrades || gearIds.some(id => !prev.ids.includes(id));
        if (!gained) return;
        setGearGlow(true);
        const t = setTimeout(() => setGearGlow(false), 3500);
        return () => clearTimeout(t);
    }, [gearIds.join(','), upgradeCount]); // eslint-disable-line react-hooks/exhaustive-deps
    // The Golden Tile's letter, wherever it sits (rack or word row), for the Golden Round banner.
    const goldenLetter = gameState?.goldenTileId
      ? [...(hand ?? []), ...(buildRow ?? []).map(i => i?.tile)].find(t => t?.id === gameState.goldenTileId)?.letter
      : undefined;

    // The 🔊 button opens the sound panel (v7.53.0): mute and the music track. The clock keeps running.
    const [showSound, setShowSound] = React.useState(false);
    // Boss round: dim the tiles that would break the rule, or make the ones it needs glow.
    const activeBoss = gameState?.roundType !== 'golden' ? bossById(gameState?.boss?.id) : undefined;
    const rackTiles = [...(hand ?? []), ...(buildRow ?? []).map(i => i?.tile)].filter((t): t is Tile => !!t);
    const lastValid = [...(gameState?.log ?? [])].reverse().find(e => e.type === 'word' && e.status === 'valid') as { word: string; score: number } | undefined;
    const bossCtx = { last: (lastValid?.word ?? '').toUpperCase(), score: 0, lastScore: lastValid?.score ?? 0 };
    const bossTileHint = (tile: Tile) => activeBoss?.tileHint?.(tile, rackTiles, bossCtx) ?? null;

    // What a running PowerPlay or charm has left (the tray and the Gear menu, v7.71.0).
    const progressFor = (buff: Charm | PowerPlay): string => {
        if (buff.id === 'hadouken') { const h = (gameState?.activePowerPlays as any)?.hadouken?.hits; return h ? `×${h}` : ''; }
        if (buff.id === 'goldenSnitch') return `${gameState?.consecutiveSuccesses ?? 0}/${snitchTargetFor(gameState?.snitchCatches ?? 0) ?? '-'}`;
        if (buff.id === 'drMariosCure') return `${gameState?.drMarioCureStreak ?? 0}/3`;
        if (buff.id === 'mixtape') return gameState?.mixtapeChain?.next ? `→${gameState.mixtapeChain.next}` : '';
        if (buff.id === 'thrillerNight') return `${totalWords % 4}/4`;
        if (buff.id === 'gottaCatchEmAll') return `${gameState?.pokedexVowels?.length ?? 0}/5`;
        if (buff.id === 'crossTheRoad') return `${gameState?.frogStreak ?? 0}/${CHARM_BONUS.crossTheRoadWords}`;
        if (buff.id === 'sesameStreet') return gameState?.sesameLetter ? `"${gameState.sesameLetter.letter}"` : '';
        if (buff.id === 'happyLittleAccidents') return gameState?.happyAccidentLevel === levelFor(totalWords) ? 'used' : 'ready';
        // v7.87.0: fragile charms last FRAGILE.lifeWords words; Gear shows how many are left.
        const wordsLeft = 'breaks' in buff && buff.breaks ? Math.max(1, FRAGILE.lifeWords - (gameState?.fragileWords?.[buff.id] ?? 0)) : 0;
        const leftLabel = wordsLeft ? `${wordsLeft} ${wordsLeft === 1 ? 'WORD' : 'WORDS'} LEFT` : '';
        if (buff.id === 'hammPiggyBank') return `🐷${(gameState?.piggyBank ?? 0).toLocaleString()} · ${leftLabel}`;
        if (leftLabel) return leftLabel;
        if (buff.id === 'survivor') return (gameState?.strikes ?? 0) > 0 ? `+${CHARM_BONUS.survivor * gameState.strikes}` : '';
        const countdown = (gameState?.activePowerPlays as any)?.[buff.id];
        if (countdown?.words) return `${countdown.words} ${countdown.words === 1 ? 'word' : 'words'}`;
        if (countdown?.rounds) return `${countdown.rounds} ${countdown.rounds === 1 ? 'round' : 'rounds'}`;
        if (buff.id === 'groundhogsDay' && (gameState?.groundhogDayCharges ?? 0) > 1) return `×${gameState.groundhogDayCharges}`;
        return '';
    };

    const renderModal = () => {
        if (!modalContent) return null;

        const { type, title, content, data } = modalContent;
        const modalBaseClass = "absolute inset-0 bg-crt-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in";
        const modalBoxBaseClass = "bg-crt-900 border-2 rounded-2xl p-6 shadow-2xl max-w-md w-full flex flex-col modal-max-h";

        // Title, text and an optional points line: used by info, word-bonus and game-over pop-ups.
        function renderPlainCard(cardTitle: string, cardContent: React.ReactNode, cardData: any) {
            return (
                <div className={modalBaseClass}>
                    <div className={`${modalBoxBaseClass} border-neon-yellow shadow-glow-yellow bonus-insert`}>
                        <h2 className="font-display text-2xl text-neon-yellow drop-shadow-glow-yellow mb-2 text-center">{withSec(cardTitle ?? '')}</h2>
                        <div className="text-slate-200 text-center my-4 whitespace-pre-line">{cardContent}</div>
                        {cardData?.reward?.points ? (
                            <div className="font-display text-neon-green text-3xl my-4 text-center">+{cardData.reward.points}</div>
                        ) : null}
                        <ArcadeButton color="yellow" className="w-full mt-2" onClick={handleCloseModal}>Continue</ArcadeButton>
                    </div>
                </div>
            );
        }

        switch (type) {
            case 'milestone':
                // Milestone pop-ups carry the milestone; anything else falls back to the plain card.
                if (!data?.scoreThreshold) return renderPlainCard(title, content, data);
                return (
                    <div className={modalBaseClass}>
                        <div className={`${modalBoxBaseClass} border-neon-yellow shadow-glow-yellow bonus-insert text-center`}>
                            <p className="osd-text text-xl leading-none text-neon-cyan">★ MILESTONE · {data.scoreThreshold.toLocaleString()} PTS ★</p>
                            <div className="text-5xl my-3" aria-hidden="true">{data.icon}</div>
                            <h2 className="font-display text-2xl text-neon-yellow drop-shadow-glow-yellow leading-tight">{data.name}</h2>
                            <p className="text-slate-200 leading-snug my-3">{data.flavorText}</p>
                            {data.reward?.points ? (
                                <div className="font-display text-neon-green text-3xl my-3">+{data.reward.points} <span className="osd-text text-xl text-neon-green/80">BONUS</span></div>
                            ) : null}
                            <ArcadeButton color="yellow" className="w-full mt-2" onClick={handleCloseModal}>Continue</ArcadeButton>
                        </div>
                    </div>
                );

            case 'info':
            case 'word-bonus':
            case 'game-over-summary':
                return renderPlainCard(title, content, data);

            case 'easter-egg':
                return <BonusReveal egg={data} onClose={handleCloseModal} />;

            case 'level-up':
                return <LevelUpCard info={data} onClose={handleCloseModal} />;

            case 'gamble':
                return <GambleCard key={data.id} id={data.id} icon={data.icon} name={title} hand={hand} saved={data.saved} extra={data} onSave={(key, value) => dispatch({ type: 'SET_GAMBLE_STATE', payload: { key, value } })} onResolve={r => handleResolveGamble?.(r)} />;

            case 'minigame':
                return <MiniGameCard key={data.id} id={data.id} title={title} word={data.word} firstFind={data.firstFind} extra={data} gameState={gameState} saved={data.saved} onSave={(key, value) => dispatch({ type: 'SET_GAMBLE_STATE', payload: { key, value } })} onDone={r => handleResolveMiniGame?.(r)} />;

            case 'continue-offer':
                return <ContinueCard reason={data?.reason === 'strikes' ? 'strikes' : 'time'} credits={lexCoins} onAnswer={accept => handleContinueOffer?.(accept)} />;

            case 'skill-intro':
                return (
                    <div className="absolute inset-0 bg-crt-950/90 backdrop-blur-sm flex items-center justify-center z-50 p-3 animate-fade-in" role="dialog" aria-modal="true" aria-label="How the Skill Shot works">
                        <div className="bg-crt-900 border-4 border-neon-pink shadow-[0_0_28px_rgba(255,79,163,0.5)] rounded-2xl px-4 py-5 max-w-md w-full flex flex-col items-center text-center gap-3 level-stage-in">
                            <p className="osd-text text-lg tracking-[0.3em] text-neon-pink">NEW LEVEL BONUS</p>
                            <h2 className="font-display text-3xl text-white leading-none">🎯 SKILL SHOT</h2>
                            <div className="w-20 h-20 my-2">
                                <TileComponent tile={{ id: 'skill-intro', letter: data?.letter ?? 'A', points: data?.points ?? 1 }} onClick={() => {}} packTileClass={tileClass} skillShot={skillShotPrize} />
                            </div>
                            <ol className="text-left text-slate-200 leading-snug space-y-1.5 list-decimal pl-5">
                                <li>Each time you reach a new level, <strong className="text-neon-pink">one tile lights up pink</strong>. Right now it's your <strong className="text-white">{data?.letter ?? 'A'}</strong>.</li>
                                <li>Use that tile in your <strong className="text-white">very next word</strong> and you score <strong className="text-neon-yellow">+{skillShotPrize}</strong> on top.</li>
                                <li>Hit it level after level and it grows: +{SKILL_SHOT.step} more each time, up to +{SKILL_SHOT.max}. Miss once and it starts over.</li>
                            </ol>
                            <p className="text-sm text-slate-400">Skip it if the tile doesn't fit. It costs nothing to miss.</p>
                            <ArcadeButton color="pink" className="w-full" onClick={handleCloseModal}>Got it</ArcadeButton>
                        </div>
                    </div>
                );

            case 'gear': {
                // Opened from the Video Store (v7.96.10): it's a look, so ✕ BACK returns to the store and the
                // run actions (USE, sound, log, save) are left out until the player is back on the board.
                const backTo = data?.returnTo as ModalContent | undefined;
                if (backTo) return (
                    <GearMenu gameState={gameState!} level={levelFor(totalWords)} strikesLeft={strikesRemaining} maxStrikes={maxStrikes} progressFor={progressFor}
                        onClose={() => { soundService.playUIClick(); dispatch({ type: 'SET_MODAL_CONTENT', payload: backTo }); }}
                        backLabel="◀ STORE" note="📼 You're in the Video Store. Tap ◀ STORE to go back and shop."
                        words={totalWords ?? 0}
                        trophies={MILESTONES_LIST.map(m => ({ id: m.id, icon: m.icon, name: m.name, unlocked: (gameState?.unlockedMilestoneIds ?? []).includes(m.id) }))}
                        onTrophy={() => {}} />
                );
                return (
                    <GearMenu gameState={gameState!} level={levelFor(totalWords)} strikesLeft={strikesRemaining} maxStrikes={maxStrikes} progressFor={progressFor}
                        onUse={pp => { handleCloseModal(); handleActivatePowerPlay(pp); }} onClose={handleCloseModal}
                        words={totalWords ?? 0}
                        onSound={() => { handleCloseModal(); setShowSound(true); }}
                        onLog={() => handleShowEventLog()}
                        onSave={() => handleSaveClick()}
                        trophies={MILESTONES_LIST.map(m => ({ id: m.id, icon: m.icon, name: m.name, unlocked: (gameState?.unlockedMilestoneIds ?? []).includes(m.id) }))}
                        onTrophy={id => { const m = MILESTONES_LIST.find(x => x.id === id); if (m) handleShowMilestoneInfo(m); }} />
                );
            }
            case 'gem-intro': {
                const mult = Number(data?.multiplier) || 3;
                return (
                    <div className="absolute inset-0 bg-crt-950/90 backdrop-blur-sm flex items-center justify-center z-50 p-3 animate-fade-in" role="dialog" aria-modal="true" aria-label="How gem tiles work">
                        <div className="bg-crt-900 border-4 border-cyan-300 shadow-[0_0_28px_rgba(103,232,249,0.5)] rounded-2xl px-4 py-5 max-w-md w-full flex flex-col items-center text-center gap-3 level-stage-in">
                            <p className="osd-text text-lg tracking-[0.3em] text-cyan-300">LONG WORD REWARD</p>
                            <h2 className="font-display text-3xl text-white leading-none">💎 GEM TILE</h2>
                            <div className="w-20 h-20 my-2">
                                <TileComponent tile={{ id: 'gem-intro', letter: data?.letter ?? 'A', points: data?.points ?? 1, multiplier: mult, isGem: true }} onClick={() => {}} packTileClass={tileClass} />
                            </div>
                            <ol className="text-left text-slate-200 leading-snug space-y-1.5 list-decimal pl-5">
                                <li>Your long word earned a gem: your <strong className="text-white">{data?.letter ?? 'A'}</strong> is now a <strong className="text-cyan-300">x{mult} word tile</strong>.</li>
                                <li>Use it in a word and the whole word scores <strong className="text-neon-yellow">x{mult}</strong>, charm points included.</li>
                                <li>It stays in your hand until you use it, but a <strong className="text-white">shuffle trades it away</strong>, so play it first.</li>
                            </ol>
                            {(gameState?.activeCharms ?? []).some(c => c.id === 'shineBright')
                              ? <p className="text-sm text-slate-400">💍 Shine Bright: 5-letter words earn x{SHINE_BRIGHT_GEMS[5]}, 6 letters x{SHINE_BRIGHT_GEMS[6]}, 7 letters x{SHINE_BRIGHT_GEMS[7]}, 8 or more x{SHINE_BRIGHT_GEMS[8]}.</p>
                              : <p className="text-sm text-slate-400">6-letter words earn x{GEM_TILES[6]}, 7 letters x{GEM_TILES[7]}, 8 or more x{GEM_TILES[8]}.</p>}
                            <ArcadeButton color="cyan" className="w-full" onClick={handleCloseModal}>Got it</ArcadeButton>
                        </div>
                    </div>
                );
            }

            case 'bones':
                return <BonesCard key={data?.bone?.id} bone={data.bone} heldCharmIds={(gameState?.activeCharms ?? []).map(c => c.id)} onDone={w => handleBonesDone?.(w)} />;

            case 'blue-steel':
                return (
                    <div className="absolute inset-0 bg-crt-950/90 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" role="dialog" aria-modal="true" aria-label="Blue Steel">
                        <div className="bg-crt-900 border-4 border-neon-cyan shadow-[0_0_36px_rgba(61,180,255,0.55)] rounded-2xl px-5 py-6 max-w-md w-full flex flex-col items-center text-center gap-3 level-stage-in">
                            <p className="osd-text text-lg tracking-[0.25em] text-neon-cyan">ZOO · ZOO · ZOO · ZOO</p>
                            <div className="text-7xl leading-none animate-pulse" aria-hidden="true" style={{ filter: 'drop-shadow(0 0 14px rgba(61,160,255,0.9))' }}>😗</div>
                            <h2 className="font-display text-4xl leading-none text-transparent bg-clip-text bg-gradient-to-b from-white to-sky-400">BLUE STEEL</h2>
                            <p className="text-slate-200 leading-snug">You played <strong className="text-white">ZOO</strong> four times this run. Hit your look: your <strong className="text-white">next word</strong> scores <strong className="text-neon-cyan">x{BLUE_STEEL.multiplier}</strong> on its whole score, tiles, charms and every bonus.</p>
                            <p className="text-sm text-slate-400">Make it a big one. Once a run.</p>
                            {data?.badgeNew && <p className="osd-text text-lg text-neon-yellow leading-tight">💙 RIDICULOUSLY GOOD-LOOKING BADGE EARNED!</p>}
                            <p className="text-sm text-slate-400 italic">"Really, really ridiculously good-looking."</p>
                            <ArcadeButton color="cyan" className="w-full" onClick={handleCloseModal}>Strike the pose</ArcadeButton>
                        </div>
                    </div>
                );

            case 'quack':
                return (
                    <div className="absolute inset-0 bg-crt-950/90 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" role="dialog" aria-modal="true" aria-label="Quack Attack">
                        <div className="bg-crt-900 border-4 border-neon-yellow shadow-[0_0_32px_rgba(255,230,0,0.45)] rounded-2xl px-5 py-6 max-w-md w-full flex flex-col items-center text-center gap-3 level-stage-in">
                            <p className="osd-text text-lg tracking-[0.3em] text-neon-yellow">QUA · QUA · QUA · QUACK!</p>
                            <div className="flex gap-1 text-5xl leading-none" aria-hidden="true">
                                {[0, 1, 2, 3].map(i => <span key={i} className="inline-block animate-bounce" style={{ animationDelay: `${i * 0.12}s` }}>🦆</span>)}
                            </div>
                            <h2 className="font-display text-3xl text-white leading-none">QUACK ATTACK!</h2>
                            <p className="text-slate-200 leading-snug">You played <strong className="text-white">QUA</strong> four times this run. The flock flies with you: your <strong className="text-white">next {QUACK_ATTACK.words} words</strong> score <strong className="text-neon-yellow">x{QUACK_ATTACK.multiplier}</strong>, charm points too.</p>
                            {data?.badgeNew && <p className="osd-text text-lg text-neon-cyan leading-tight">🦆 QUACK PACK BADGE EARNED!</p>}
                            <p className="text-sm text-slate-400 italic">"Ducks fly together!"</p>
                            <ArcadeButton color="yellow" className="w-full" onClick={handleCloseModal}>Quack on</ArcadeButton>
                        </div>
                    </div>
                );

            case 'greatest-hit':
                return <GreatestHitCard word={String(data?.word ?? '')} plays={Number(data?.plays) || 0} letters={Number(data?.letters) || 3} next={data?.next ?? null} onDone={handleCloseModal} />;

            case 'croc':
                return <CrocCard win={!!data?.win} level={Number(data?.level) || 1} saved={data?.saved} onSave={(key, value) => dispatch({ type: 'SET_GAMBLE_STATE', payload: { key, value } })} onDone={() => handleCrocPick?.()} />;

            case 'fork':
            case 'triforce': // v7.95.0: the Triforce is gone; an old save's card closes itself
                // v7.66.0: the Fork is gone; a card saved mid-pick just closes (see GameScreen).
                return null;

            case 'video-store':
                // v7.96.10: 🎒 opens the normal Gear menu, and closing it comes back to the store (returnTo).
                return gameState ? <VideoStore data={data} clock={time} gameState={gameState}
                    onRent={i => handleStoreRent?.(i)} onRestock={() => handleStoreRestock?.()} onTradeIn={id => handleStoreTradeIn?.(id)} onUndoTrade={i => handleStoreUndoTrade?.(i)} onLeave={() => handleStoreLeave?.()}
                    onGear={() => { soundService.playUIClick(); dispatch({ type: 'SET_MODAL_CONTENT', payload: { type: 'gear', title: 'Your Gear', data: { returnTo: modalContent } } }); }} /> : null;

            case 'static-tile':
                return (
                    <div className="absolute inset-0 z-50 bg-crt-950/85 flex items-center justify-center p-4 animate-fade-in" role="dialog" aria-modal="true" aria-label="Static Tile">
                        <div className="w-full max-w-sm rounded-2xl bg-crt-900 ring-2 ring-neon-cyan p-4 flex flex-col gap-2" data-testid="static-picker">
                            <h2 className="font-display text-xl text-neon-cyan text-center leading-tight">📺 STATIC TILE</h2>
                            <p className="text-slate-100 text-[15px] leading-snug text-center">Pick any letter for your blank. It scores 0 points itself. The clock waits.</p>
                            <LetterPicker key={String(data?.tileId)} tone="green" onConfirm={l => handleStaticLetter?.(l)} />
                            <button type="button" onClick={handleCloseModal} className="w-full mt-1 text-sm text-slate-400 hover:text-white">Not now</button>
                        </div>
                    </div>
                );

            case 'scratch':
                return <ScratchCard key={`scratch-${data?.level}`} level={Number(data?.level) || 1} squares={data?.squares ?? []} saved={data?.saved}
                    onSave={(key, value) => dispatch({ type: 'SET_GAMBLE_STATE', payload: { key, value } })} onDone={p => handleScratchDone?.(p)} />;

            case 'last-words':
                return <LastWordsCard reason={data?.reason === 'strikes' ? 'strikes' : 'time'} tiles={(hand ?? []).filter((t): t is Tile => !!t)} gameState={gameState} piggyLost={Number(data?.piggyLost) || 0}
                    category={typeof data?.category === 'string' ? data.category : undefined}
                    bet={typeof (data?.saved as Record<string, unknown> | undefined)?.fjBet === 'number' ? (data!.saved as Record<string, number>).fjBet : undefined}
                    onBet={b => dispatch({ type: 'SET_GAMBLE_STATE', payload: { key: 'fjBet', value: b } })}
                    savedCategory={typeof (data?.saved as Record<string, unknown> | undefined)?.fjCategory === 'string' ? (data!.saved as Record<string, string>).fjCategory : undefined}
                    onCategory={id => dispatch({ type: 'SET_GAMBLE_STATE', payload: { key: 'fjCategory', value: id } })}
                    deadline={typeof (data?.saved as Record<string, unknown> | undefined)?.fjDeadline === 'number' ? (data!.saved as Record<string, number>).fjDeadline : undefined}
                    onDeadline={at => dispatch({ type: 'SET_GAMBLE_STATE', payload: { key: 'fjDeadline', value: at } })}
                    onDone={r => handleLastWords?.(r)} />;

            case 'heads-up':
            case 'genre-up':
                // v7.91.0: a small "look here" card for the power word hint; OK flashes the notice.
                // v7.96.5 (the owner's report): the board behind is fully dark, so the tiles can't be read
                // while the card says a power word is hiding in them. 'genre-up' is the same card after a word.
                return (
                    <div className="absolute inset-0 z-50 bg-crt-950 flex items-center justify-center p-5 animate-fade-in" role="dialog" aria-modal="true" aria-label={data?.headline}>
                        <div className="w-full max-w-xs rounded-2xl bg-crt-900 ring-2 ring-neon-yellow shadow-[0_0_28px_rgba(255,210,63,0.45)] p-4 text-center flex flex-col items-center gap-2 bonus-insert" data-testid="heads-up">
                            <div className="text-4xl leading-none" aria-hidden="true">{data?.icon}</div>
                            <h2 className="font-display text-xl leading-tight text-neon-yellow text-balance">{data?.headline}</h2>
                            <p className="text-slate-100 text-[15px] leading-snug">{data?.text}</p>
                            <p className="text-neon-cyan text-sm leading-snug">{data?.next}</p>
                            <ArcadeButton color="yellow" className="w-full mt-1" data-testid="heads-up-ok"
                                onClick={() => { const id = data?.notice; handleCloseModal(); if (id) setNoticeFlash({ id, key: Date.now() }); }}>OK</ArcadeButton>
                        </div>
                    </div>
                );

            case 'outcome':
                return <OutcomeCard name={title} detail={typeof content === 'string' ? content : undefined} data={data} onClose={handleCloseModal} />;

            case 'slot-machine':
                return <SlotMachine title={title} seconds={data.seconds} reels={data.reels} jackpot={data.jackpot} onClose={handleCloseModal} />;

            case 'super-hand':
                return (
                    <div className="absolute inset-0 bg-black/60 flex items-start justify-center pt-20 z-50 p-4 animate-fade-in">
                        <div className={`${modalBoxBaseClass} border-amber-400 max-w-md`}>
                            <h2 className="text-3xl font-bold text-amber-400 mb-4 text-center">{title}</h2>
                            <div className="text-slate-200 text-center my-4">{content}</div>
                            <button onClick={handleCloseModal} className="w-full mt-4 px-6 py-3 text-xl font-bold text-slate-900 bg-amber-400 rounded-lg shadow-lg hover:bg-amber-300">CLOSE</button>
                        </div>
                    </div>
                );

            case 'event-log':
                return (
                     <div className={modalBaseClass}>
                        <div className={`${modalBoxBaseClass} border-green-400`}>
                            <h2 className="text-2xl font-bold text-green-400 mb-2 flex-shrink-0">{title}</h2>
                             <div className="flex-grow overflow-y-auto pr-2">
                                <EventLogDisplay log={gameState?.log ?? []} />
                            </div>
                            <button onClick={handleCloseModal} className="w-full mt-4 px-6 py-3 text-xl font-bold text-slate-900 bg-green-500 rounded-lg shadow-lg hover:bg-green-400">CLOSE</button>
                        </div>
                    </div>
                );
            
            case 'milestone-info':
                 const milestone = data as Milestone;
                 return (
                     <div className={modalBaseClass}>
                        <div className={`${modalBoxBaseClass} border-cyan-400`}>
                           <h2 className="text-3xl font-bold text-cyan-400 mb-4 text-center flex items-center justify-center gap-3"><span className="text-4xl">{milestone.icon}</span> {milestone.name}</h2>
                           <p className="text-slate-300 text-center italic mb-4">"{milestone.flavorText}"</p>
                           <div className="bg-crt-950/60 ring-1 ring-white/5 p-4 rounded-lg text-left space-y-2">
                               <p><strong className="text-white">Score to Unlock:</strong> <span className="text-amber-300 font-digital">{milestone.scoreThreshold}</span></p>
                               {milestone.reward.points && <p><strong className="text-white">Bonus Points:</strong> <span className="text-green-400">+{milestone.reward.points}</span></p>}
                           </div>
                           <button onClick={handleCloseModal} className="w-full mt-4 px-6 py-3 text-xl font-bold text-slate-900 bg-cyan-500 rounded-lg shadow-lg hover:bg-cyan-400">GOT IT</button>
                       </div>
                   </div>
                 );
            
            case 'buff-info':
                const buff = data as Charm | PowerPlay;
                return (
                    <div className={modalBaseClass}>
                        <div className={`${modalBoxBaseClass} border-purple-400`}>
                           <h2 className="text-3xl font-bold text-purple-400 mb-4 text-center flex items-center justify-center gap-3"><span className="text-4xl">{buff.icon}</span> {buff.name}</h2>
                           <p className="text-slate-200 text-center text-lg mb-2">{buff.description}</p>
                           {buff.finePrint && <p className="text-slate-400 text-center text-sm mb-2">{buff.finePrint}</p>}
                           {PRIZE_POWER_PLAY_IDS.has(buff.id) && prizeScaleFor(levelFor(totalWords)) > 1 && (
                               <p className="osd-text text-lg text-neon-yellow text-center mb-2">⬆ LEVEL {levelFor(totalWords)}: POINT PRIZES PAY x{prizeScaleFor(levelFor(totalWords))}</p>
                           )}
                           {(gameState?.activeCharms ?? []).some(c => c.id === buff.id) && (
                               <p className="osd-text text-lg text-center mb-2"><CharmTimeNote charmId={buff.id} level={levelFor(totalWords)} /></p>
                           )}
                           {(gameState?.charmUpgrades ?? []).includes(buff.id) && (gameState?.activeCharms ?? []).some(c => c.id === buff.id) && (
                               <p className="osd-text text-lg text-neon-yellow text-center mb-2">⭐ UPGRADED: ITS POINT BONUSES PAY {CHARM_UPGRADE.percent}% MORE</p>
                           )}
                           {(gameState?.activeCharms ?? []).some(c => c.id === buff.id) && (
                               <p className="osd-text text-lg text-center mb-2"><SetNote charmId={buff.id} after={(gameState?.activeCharms ?? []).map(c => c.id)} /></p>
                           )}
                           {buff.id === 'multiplicity' && (
                               <div className="mb-2 text-center">
                                   <p className="osd-text text-lg text-neon-pink">{copyTarget ? `👯 WOULD COPY: ${copyTarget.icon} ${copyTarget.name.toUpperCase()}` : '👯 NOTHING TO COPY YET: USE A POWERPLAY FIRST'}</p>
                                   {copyTarget && <p className="text-sm text-slate-300 leading-snug mt-1">{copyTarget.description}</p>}
                               </div>
                           )}
                           <p className="text-slate-400 text-center italic mb-4">"{buff.flavorText}"</p>
                           <button onClick={handleCloseModal} className="w-full mt-4 px-6 py-3 text-xl font-bold text-slate-900 bg-purple-500 rounded-lg shadow-lg hover:bg-purple-400">CLOSE</button>
                       </div>
                    </div>
                );

            case 'powerplay-selection': {
                const offered = data as PowerPlay[];
                const held = (gameState?.availablePowerPlays ?? [])[0] ?? null;
                return (
                    <PowerPlayOffer
                        key={offered.map(p => p.id).join()}
                        title={title}
                        reason={content}
                        offered={offered}
                        held={held}
                        level={levelFor(totalWords)}
                        prizeScale={prizeScaleFor(levelFor(totalWords))}
                        copyTarget={copyTarget}
                        mysteryId={gameState?.mysteryTapeId ?? null}
                        onChoose={(pp) => handleChoosePowerPlay(pp, offered)}
                        onKeep={() => handleKeepPowerPlay(offered)}
                    />
                );
            }

            case 'charm-selection': {
                const offered = data as Charm[];
                return (
                    <CharmOffer
                        key={offered.map(c => c.id).join()}
                        title={title}
                        reason={content}
                        offered={offered}
                        equipped={gameState?.activeCharms ?? []}
                        upgradedIds={gameState?.charmUpgrades ?? []}
                        onUpgrade={charmId => handleUpgradeCharm(charmId, offered)}
                        onChoose={(charm, replaceId) => handleChooseCharm(charm, offered, replaceId)}
                        onPass={() => handlePassCharm(offered)}
                        level={levelFor(totalWords)}
                    />
                );
            }
            
            case 'save-confirmation':
                return (
                    <div className={modalBaseClass}>
                        <div className={`${modalBoxBaseClass} border-cyan-400`}>
                           <h2 className="text-3xl font-bold text-cyan-400 mb-4 text-center">{title}</h2>
                           <p className="text-slate-200 text-center my-4">Save your run and return to the main menu? Tap ▶ Continue there to pick up right where you left off.</p>
                           <p className="text-slate-400 text-sm text-center -mt-2 mb-2">Your run also saves itself after every word, so closing the app by accident won't lose it.</p>
                           <div className="flex gap-4 mt-4">
                                <button onClick={handleCloseModal} className="w-full px-6 py-3 text-xl font-bold text-white bg-red-600 rounded-lg shadow-lg hover:bg-red-500">CANCEL</button>
                                <button onClick={handleConfirmSave} className="w-full px-6 py-3 text-xl font-bold text-slate-900 bg-cyan-400 rounded-lg shadow-lg hover:bg-cyan-300">SAVE & QUIT</button>
                           </div>
                           {handleEndRun && (
                               <button type="button" onClick={handleEndRun} className="w-full mt-4 osd-text text-lg text-slate-400 underline hover:text-neon-red">🗑️ End this run without saving</button>
                           )}
                        </div>
                    </div>
                );

            case 'powerplay-activation': {
                const powerPlay = data as PowerPlay;

                // Multiplicity (v7.36.5): read what it copies before deciding.
                if (powerPlay.id === 'multiplicity') {
                    return (
                        <div className={modalBaseClass}>
                            <div className={`${modalBoxBaseClass} border-neon-pink max-w-md`}>
                                <p className="osd-text text-lg tracking-[0.3em] text-slate-300 text-center">👯 MULTIPLICITY</p>
                                <h2 className="font-display text-xl text-neon-pink text-center leading-tight mt-1">COPY THIS POWERPLAY?</h2>
                                {copyTarget ? (
                                    <div className="mt-3 rounded-xl ring-2 ring-neon-pink/70 bg-crt-950/80 p-3 text-left flex items-start gap-3">
                                        <span className="text-4xl leading-none" aria-hidden="true">{copyTarget.icon}</span>
                                        <div className="min-w-0">
                                            <p className="font-display text-base text-white leading-tight">{copyTarget.name}</p>
                                            <p className="text-sm text-slate-200 leading-snug mt-1">{copyTarget.description}</p>
                                            <p className="text-xs text-slate-500 italic mt-1">“{copyTarget.flavorText}”</p>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-slate-300 text-center mt-3">Nothing to copy yet. Use a PowerPlay first.</p>
                                )}
                                {copyTarget && (
                                    <>
                                        {/* v7.84.1: one tap copies AND uses it; keeping the copy for later is the smaller option. */}
                                        <ArcadeButton color="pink" className="w-full mt-3" data-testid="multiplicity-use" onClick={() => handleActivatePowerPlay(powerPlay, 'use')}>
                                            <NamedLabel action="▶ Use" name={`${copyTarget.icon} ${copyTarget.name} now`} />
                                        </ArcadeButton>
                                        <ArcadeButton color="pink" variant="outline" className="w-full mt-2" data-testid="multiplicity-keep" onClick={() => handleActivatePowerPlay(powerPlay, true)}>
                                            👯 Keep the copy for later
                                        </ArcadeButton>
                                    </>
                                )}
                                <ArcadeButton color="slate" variant="text" className="mx-auto mt-2" onClick={handleCloseModal}>Not now</ArcadeButton>
                            </div>
                        </div>
                    );
                }
                
                if (powerPlay.id === 'cassiesClue') {
                    const numTilesInHand = (hand ?? []).filter(Boolean).length;
                    const numEmptySlots = RACK_SIZE - numTilesInHand;
                    const min = Math.max(0, 3 - numEmptySlots);
                
                    const max = powerPlay.swapConfig?.max || 3;
                    const canExecute = (tilesToSwap?.length ?? 0) >= min && (tilesToSwap?.length ?? 0) <= max;
                
                    const descriptionText = min > 0
                      ? `Your hand is full. Select ${min} to ${max} tiles to discard.`
                      : `Select up to ${max} tiles from your hand to discard.`;
                
                    const pickedCount = tilesToSwap?.length ?? 0;
                    const buttonText = pickedCount > 0
                      ? `Discard ${pickedCount} ${pickedCount === 1 ? 'tile' : 'tiles'}${canExecute ? '' : ` (pick ${min}-${max})`}`
                      : min > 0 ? `Tap ${min === max ? min : `${min}-${max}`} tiles to pick them` : 'Discard none';

                    return (
                         <div className={modalBaseClass}>
                            <div className={`${modalBoxBaseClass} border-green-400`}>
                                <h2 className="text-3xl font-bold text-green-400 mb-4 text-center">{title}</h2>
                                <p className="text-slate-300 text-center mb-2">{powerPlay.description}</p>
                                <p className="text-slate-300 text-center mb-4">{descriptionText}</p>
                                <div className="grid grid-cols-5 gap-2 my-4">
                                    {(hand ?? []).map((tile, index) => (
                                        <div key={tile?.id || index} className="w-full h-16">
                                            {tile ? (
                                                <PickTile tile={tile} tileClass={tileClass} selected={!!tilesToSwap?.some(t => t.originalIndex === index)} onClick={() => tilesToSwap?.some(t => t.originalIndex === index) ? handleRemoveTileFromSwap(index) : handleAddTileToSwap(tile, index)} />
                                            ) : <div className="w-full h-full bg-slate-900 rounded-lg" />}
                                        </div>
                                    ))}
                                </div>
                                <button 
                                    onClick={() => {
                                        dispatch({ type: 'COMPLETE_POWER_PLAY_ACTIVATION', payload: { powerPlay, option: { tilesToDiscard: tilesToSwap } } })
                                    }} 
                                    disabled={!canExecute} 
                                    className="w-full mt-auto px-6 py-3 text-xl font-bold text-slate-900 bg-green-500 rounded-lg shadow-lg hover:bg-green-400 disabled:bg-slate-500 disabled:text-slate-300 disabled:cursor-not-allowed">
                                    {buttonText}
                                </button>
                                <button onClick={handleCloseModal} className="w-full mt-2 text-sm text-slate-400 hover:text-white">Cancel</button>
                            </div>
                        </div>
                    );
                }

                if (powerPlay.selectionType === 'letter') {
                    const handleLetterSelect = (letter: string) => {
                        dispatch({ type: 'COMPLETE_POWER_PLAY_ACTIVATION', payload: { powerPlay, option: { letter } } });
                    };
                
                    return (
                        <div className={modalBaseClass}>
                            <div className={`${modalBoxBaseClass} border-green-400`}>
                                <h2 className="text-3xl font-bold text-green-400 mb-2 text-center">{title}</h2>
                                <p className="text-slate-300 text-center mb-4">{powerPlay.description}</p>
                                <LetterPicker key={powerPlay.id} letters={powerPlay.selectionLetters} onConfirm={handleLetterSelect} />
                                <button onClick={handleCloseModal} className="w-full mt-2 text-sm text-slate-400 hover:text-white">Cancel</button>
                            </div>
                        </div>
                    );
                }

                if (powerPlay.selectionType === 'tile_swap') {
                    const min = powerPlay.swapConfig?.min || 1;
                    const max = powerPlay.swapConfig?.max || 1;
                    const canExecute = (tilesToSwap?.length ?? 0) >= min && (tilesToSwap?.length ?? 0) <= max;
                    return (
                         <div className={modalBaseClass}>
                            <div className={`${modalBoxBaseClass} border-green-400`}>
                                <h2 className="text-3xl font-bold text-green-400 mb-4 text-center">{title}</h2>
                                <p className="text-slate-300 text-center mb-4">Select {min === max ? min : `${min} to ${max}`} tile(s) from your hand to replace.</p>
                                <div className="grid grid-cols-5 gap-2 my-4">
                                    {(hand ?? []).map((tile, index) => (
                                        <div key={tile?.id || index} className="w-full h-16">
                                            {tile ? (
                                                <PickTile tile={tile} tileClass={tileClass} selected={(tilesToSwap ?? []).some(t => t.originalIndex === index)} onClick={() => (tilesToSwap ?? []).some(t => t.originalIndex === index) ? handleRemoveTileFromSwap(index) : handleAddTileToSwap(tile, index)} />
                                            ) : <div className="w-full h-full bg-slate-900 rounded-lg" />}
                                        </div>
                                    ))}
                                </div>
                                <button onClick={handleExecuteSwap} disabled={!canExecute} className="w-full mt-auto px-6 py-3 text-xl font-bold text-slate-900 bg-green-500 rounded-lg shadow-lg hover:bg-green-400 disabled:bg-slate-500 disabled:text-slate-300 disabled:cursor-not-allowed">
                                    {(tilesToSwap?.length ?? 0) === 0
                                      ? `Tap ${min === max ? min : `${min}-${max}`} ${max === 1 ? 'tile' : 'tiles'} to pick`
                                      : `Swap ${(tilesToSwap?.length ?? 0)} of ${max}${canExecute ? '' : ` (pick ${min === max ? min : `${min}-${max}`})`}`}
                                </button>
                                <button onClick={handleCloseModal} className="w-full mt-2 text-sm text-slate-400 hover:text-white">Cancel</button>
                            </div>
                        </div>
                    );
                }

                if (powerPlay.id === 'neosChoice') {
                    const handleChoice = (choice: 'time' | 'strike') => {
                        dispatch({ type: 'COMPLETE_POWER_PLAY_ACTIVATION', payload: { powerPlay, option: { choice } } });
                    };
                
                    return (
                        <div className={modalBaseClass}>
                            <div className={`${modalBoxBaseClass} border-green-400`}>
                                <h2 className="text-3xl font-bold text-green-400 mb-4 text-center">{title}</h2>
                                <p className="text-slate-300 text-center mb-4">{powerPlay.description}</p>
                                <div className="flex flex-col gap-4 mt-4">
                                    <button onClick={() => handleChoice('time')} className="w-full px-6 py-4 text-xl font-bold text-white bg-blue-600 rounded-lg shadow-lg hover:bg-blue-500">
                                        Blue Pill: +{TIME_BONUS.rescue}s on the clock
                                    </button>
                                    <button onClick={() => handleChoice('strike')} className="w-full px-6 py-4 text-xl font-bold text-white bg-red-600 rounded-lg shadow-lg hover:bg-red-500">
                                        Red Pill: Erase a strike
                                    </button>
                                </div>
                                <button onClick={handleCloseModal} className="w-full mt-4 text-sm text-slate-400 hover:text-white">Cancel</button>
                            </div>
                        </div>
                    );
                }

                if (powerPlay.id === 'wordionaire') {
                    const handlePhoneChoice = () => {
                        dispatch({ type: 'COMPLETE_POWER_PLAY_ACTIVATION', payload: { powerPlay, option: { choice: 'phone' } } });
                        handlePhoneAFriend();
                    };
                    
                    const handleWordionaireChoice = (choice: 'cash' | 'double') => {
                        dispatch({ type: 'COMPLETE_POWER_PLAY_ACTIVATION', payload: { powerPlay, option: { choice } } });
                    }
                
                    return (
                        <div className={modalBaseClass}>
                            <div className={`${modalBoxBaseClass} border-green-400`}>
                                <h2 className="text-3xl font-bold text-green-400 mb-4 text-center">{title}</h2>
                                <p className="text-slate-300 text-center mb-4">{powerPlay.description}</p>
                                <div className="flex flex-col gap-3 mt-4">
                                    <button onClick={() => handleWordionaireChoice('cash')} className="w-full px-4 py-3 text-lg font-bold text-slate-900 bg-amber-400 rounded-lg shadow-lg hover:bg-amber-300">
                                        Fast Cash (+100pts)
                                    </button>
                                    <button onClick={handlePhoneChoice} className="w-full px-4 py-3 text-lg font-bold text-slate-900 bg-cyan-400 rounded-lg shadow-lg hover:bg-cyan-300">
                                        Phone-a-Friend (Reveal best word)
                                    </button>
                                    <button onClick={() => handleWordionaireChoice('double')} className="w-full px-4 py-3 text-lg font-bold text-slate-900 bg-purple-400 rounded-lg shadow-lg hover:bg-purple-300">
                                        Double Down (Next word x2 score)
                                    </button>
                                </div>
                                <button onClick={handleCloseModal} className="w-full mt-4 text-sm text-slate-400 hover:text-white">Cancel</button>
                            </div>
                        </div>
                    );
                }

                const singleTileSelectionIds = new Set(['hookshot', 'captainPlanet', 'duckHunt', 'moreThanMeets']);
                if (singleTileSelectionIds.has(powerPlay.id)) {
                    const picked = tileForSelection;
                    const canExecute = picked != null;
                    return (
                         <div className={modalBaseClass}>
                            <div className={`${modalBoxBaseClass} border-green-400`}>
                                <h2 className="text-3xl font-bold text-green-400 mb-4 text-center">{title}</h2>
                                <p className="text-slate-300 text-center mb-4">{powerPlay.description}</p>
                                <div className="grid grid-cols-5 gap-2 my-4">
                                    {(hand ?? []).map((tile, index) => (
                                        <div key={tile?.id || index} className="w-full h-16">
                                            {tile ? (
                                                <PickTile
                                                    tile={tile}
                                                    tileClass={tileClass}
                                                    selected={picked?.originalIndex === index}
                                                    dimmed={picked != null}
                                                    onClick={() => dispatch({ type: 'SELECT_TILE_FOR_SELECTION', payload: picked?.originalIndex === index ? null : { tile, originalIndex: index } })}
                                                />
                                            ) : <div className="w-full h-full bg-slate-900 rounded-lg" />}
                                        </div>
                                    ))}
                                </div>
                                <button 
                                    onClick={() => dispatch({ type: 'COMPLETE_POWER_PLAY_ACTIVATION', payload: { powerPlay }})} 
                                    disabled={!canExecute} 
                                    className="w-full mt-auto px-6 py-3 text-xl font-bold text-slate-900 bg-green-500 rounded-lg shadow-lg hover:bg-green-400 disabled:bg-slate-500 disabled:text-slate-300 disabled:cursor-not-allowed">
                                    {picked ? `Confirm: ${picked.tile.letter}` : 'Tap a tile to pick it'}
                                </button>
                                <button onClick={() => { dispatch({ type: 'SELECT_TILE_FOR_SELECTION', payload: null }); handleCloseModal(); }} className="w-full mt-2 text-sm text-slate-400 hover:text-white">Cancel</button>
                            </div>
                        </div>
                    );
                }
                
                return (
                    <div className={modalBaseClass}>
                        <div className={`${modalBoxBaseClass} border-green-400`}>
                             <h2 className="text-3xl font-bold text-green-400 mb-4 text-center">{title}</h2>
                             <p className="text-slate-200 text-center my-4">Activation logic for {powerPlay.name} is not fully implemented.</p>
                             <button onClick={handleCloseModal} className="w-full mt-auto px-6 py-3 text-xl font-bold text-slate-900 bg-green-500 rounded-lg shadow-lg hover:bg-green-400">CLOSE</button>
                        </div>
                    </div>
                );
            }

            case 'charm-activation': {
                const charm = data as Charm;
                if (charm.selectionType === 'tile_transform') {
                    const handleTileSelect = (tile: Tile, originalIndex: number) => {
                        dispatch({ type: 'SELECT_TILE_TO_TRANSFORM', payload: { tile, originalIndex } });
                    };

                    const handleLetterSelect = (letter: string) => {
                        dispatch({ type: 'COMPLETE_CHARM_ACTIVATION', payload: { charm, option: { letter } } });
                    };

                    return (
                        <div className={modalBaseClass}>
                            <div className={`${modalBoxBaseClass} border-purple-400`}>
                                <h2 className="text-3xl font-bold text-purple-400 mb-2 text-center">{title}</h2>
                                <p className="text-slate-300 text-center mb-4">{charm.description}</p>
                                
                                {!tileToTransform ? (
                                    <>
                                        <p className="text-amber-300 font-semibold text-center my-2">First, select a tile from your hand to transform:</p>
                                        <div className="grid grid-cols-5 gap-2 my-4">
                                            {(hand ?? []).map((tile, index) => (
                                                <div key={tile?.id || index} className="w-full h-16">
                                                    {tile ? (
                                                        <TileComponent tile={tile} onClick={() => handleTileSelect(tile, index)} packTileClass={tileClass} />
                                                    ) : <div className="w-full h-full bg-slate-900 rounded-lg" />}
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="flex items-center justify-center gap-3 my-2">
                                            <div className="w-14 h-14"><PickTile tile={tileToTransform.tile} tileClass={tileClass} selected onClick={() => {}} /></div>
                                            <p className="text-amber-300 font-semibold text-left">Changing this {tileToTransform.tile.letter}. Now pick its new letter:</p>
                                        </div>
                                        <LetterPicker key={tileToTransform.originalIndex} tone="purple" onConfirm={handleLetterSelect} />
                                        <button onClick={() => dispatch({ type: 'SELECT_TILE_TO_TRANSFORM', payload: null })} className="w-full mt-2 text-sm text-slate-400 hover:text-white">Back to tile selection</button>
                                    </>
                                )}
                                <button onClick={handleCloseModal} className="w-full mt-4 text-sm text-slate-400 hover:text-white">Cancel Activation</button>
                            </div>
                        </div>
                    );
                }
                // Fallback for other charm selection types if they exist in the future
                return (
                    <div className={modalBaseClass}>
                        <div className={`${modalBoxBaseClass} border-red-500`}>
                            <h2 className="text-2xl font-bold text-red-500 mb-4">Unhandled Modal</h2>
                            <p>Type: {type}</p>
                            <p>Title: {title}</p>
                            <button onClick={handleCloseModal} className="mt-4 p-2 bg-red-500 rounded">Close</button>
                        </div>
                    </div>
                );
            }
                

            default:
                return (
                    <div className={modalBaseClass}>
                        <div className={`${modalBoxBaseClass} border-red-500`}>
                           <h2 className="text-2xl font-bold text-red-500 mb-4">Unhandled Modal</h2>
                           <p>Type: {type}</p>
                           <p>Title: {title}</p>
                           <button onClick={handleCloseModal} className="mt-4 p-2 bg-red-500 rounded">Close</button>
                        </div>
                    </div>
                );
        }
    };
  
    // Layout: a fixed top bar, a status area that takes the leftover height (and scrolls inside
    // itself on short phones), and the play area pinned to the bottom so it's always in reach.
    return (
    <div className="flex flex-col h-full min-h-0 p-3 text-slate-200 gap-2 [@media(max-height:700px)]:gap-1.5 [@media(max-height:700px)]:py-2">
      {/* --- MODALS --- */}
      {renderModal()}
      {endRun && <EndRunCard summary={endRun.summary} onCancel={endRun.onCancel} onConfirm={endRun.onConfirm} />}
      {onLostSave && (
        <div className="absolute inset-0 z-[80] bg-crt-950/95 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="This run is open in another window">
          <div className="bg-crt-900 border-4 border-neon-cyan rounded-2xl px-5 py-6 max-w-sm w-full flex flex-col items-center text-center gap-3">
            <div className="text-5xl leading-none" aria-hidden="true">📼</div>
            <h2 className="font-display text-xl text-neon-cyan leading-tight">THIS TAPE WAS RECORDED OVER</h2>
            <p className="text-slate-200 text-sm leading-snug">Word Nerd is open in another window or tab, and a newer game is using the save. This copy has stopped saving so it can't overwrite it.</p>
            <ArcadeButton color="cyan" className="w-full" onClick={onLostSave}>Back to the start screen</ArcadeButton>
          </div>
        </div>
      )}
      {/* v7.59.0: cards that open on their own swallow taps for a moment (keyed per card, not per save of its state). */}
      {modalContent && !GUARDLESS_MODALS.has(modalContent.type) && (
        <ModalTapGuard key={`${modalContent.type}|${modalContent.title ?? ''}|${(modalContent.data as any)?.id ?? ''}|${(modalContent.data as any)?.level ?? ''}`} />
      )}
      {showSound && <SoundMenu isMuted={isMuted} onToggleMute={handleMuteToggle} onClose={() => setShowSound(false)} inRun />}
      {/* Resumed run: the board stays hidden (no free look at the tiles) until the 3-2-1 ends. */}
      {resumeCountdown > 0 && (
        <div className="absolute inset-0 z-[70] bg-crt-950 flex flex-col items-center justify-center gap-3 text-center" role="status" aria-live="assertive" aria-label={`Run restored. Resuming in ${resumeCountdown}`}>
          <p className="osd-text text-2xl tracking-[0.3em] text-neon-green">RUN RESTORED</p>
          <p key={resumeCountdown} className="font-osd text-9xl leading-none neon-text-cyan level-stage-in">{resumeCountdown}</p>
          <p className="osd-text text-lg text-slate-400">{time}<Sec /> on the clock · get ready</p>
        </div>
      )}
      
      {/* --- TOP BAR --- */}
      {/* v7.84.3: equal side columns keep the clock dead centre (v7.84.0's flexible left column pushed it right). */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center flex-shrink-0 text-white gap-2" data-testid="hud">
        {/* Score & Words Display */}
        <div className="flex flex-col gap-1 min-w-0">
        {/* v7.84.0 (the owner's call): the top shows what matters every second: score, clock, strikes.
            Words played lives in Gear's RUN STATUS; the level's progress is under the clock. */}
        <div className="text-left min-w-0">
          <div className="osd-text text-base leading-none text-neon-yellow">SCORE</div>
          <div className="font-osd leading-none text-white whitespace-nowrap" data-testid="hud-score"
            style={{ fontSize: `calc(clamp(1.2rem, 7vw, 2.25rem) * ${(gameState?.score ?? 0).toLocaleString().length >= 7 ? 0.8 : 1})` }}>
            {gameState?.score?.toLocaleString() ?? '0'}
          </div>
        </div>
        {timeGain?.charm ? (
          // Charm time cut by the level (v7.40.2), said in the score column so it never covers the clock (v7.84.0).
          <HudCharmNote key={`charm-${timeGain.key}`} full={timeGain.charm.full} paid={timeGain.charm.paid} percent={timeGain.charm.percent} halved={!!timeGain.charm.halved} level={levelFor(totalWords ?? 0)} />
        ) : nextGate != null && (() => {
          // v7.61.0: the next Score Gate, so the gates are a goal rather than a surprise.
          const score = gameState?.score ?? 0;
          const from = previousGateFor(nextGate);
          const pct = Math.max(0, Math.min(100, ((score - from) / (nextGate - from)) * 100));
          const near = nextGate - score <= GATES.markerGlowWithin;
          return (
            <div className="w-full max-w-[9rem]" data-testid="gate-marker" aria-label={`Next Score Gate at ${nextGate.toLocaleString()} points: ${(nextGate - score).toLocaleString()} to go. It opens a bonus event.`}>
              <div className={`osd-text text-sm leading-none whitespace-nowrap ${near ? 'text-neon-pink animate-pulse' : 'text-slate-400'}`}>
                🚪 {nextGate >= 1000 ? `${nextGate / 1000}K` : nextGate} GATE{near ? '!' : ''}
              </div>
              <div className="h-1 mt-0.5 rounded-full bg-crt-600 overflow-hidden">
                <div className={`h-full rounded-full ${near ? 'bg-neon-pink' : 'bg-slate-400/70'}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })()}
        </div>

        {/* Timer Display */}
        <div className="text-center">
          <div className="relative" ref={timerRef}>
            <Timer time={time ?? 0} golden={gameState?.roundType === 'golden'} tone={levelTierFor(levelFor(totalWords ?? 0)).tone} />
            {timeGain && timeGain.seconds !== 0 && (
              <span
                key={timeGain.key}
                className={`time-gain-side absolute left-full top-1/2 ml-1 whitespace-nowrap font-osd text-2xl leading-none pointer-events-none ${timeGain.seconds > 0 ? 'text-neon-green' : 'text-neon-red'}`}
                aria-live="polite"
              >
                {timeGain.seconds > 0 ? '+' : '−'}{Math.abs(timeGain.seconds)}<Sec />{timeGain.taxed && <span className="text-neon-yellow text-lg"> ½</span>}
              </span>
            )}
          </div>
          {gameState?.daily && (
            <p className={`osd-text text-sm leading-none mt-0.5 ${gameState.daily.practice ? 'text-slate-400' : 'text-neon-cyan'}`} aria-label={gameState.daily.practice ? `Daily Challenge ${gameState.daily.number}, practice` : `Daily Challenge ${gameState.daily.number}`}>
              📅 DAILY #{gameState.daily.number}{gameState.daily.practice ? ' · PRACTICE' : ''}
            </p>
          )}
          {gameState?.roundType !== 'golden' && (
            <LevelBadge key={levelFlash} validWords={totalWords ?? 0} flash={levelFlash > 0} />
          )}
        </div>

        {/* Strikes, with the 🎒 under them (v7.84.0) so the score gets the width it needs. */}
        <div className="flex flex-col items-end gap-1.5">
          <div>
            <div className="osd-text text-base leading-none text-neon-red text-right whitespace-nowrap">
              {/* v7.65.0: a shield (Hylian Shield, RINGS, Plot Armor) shows right by the strikes it protects. */}
              {(gameState?.activePowerPlays?.strikeShield || gameState?.activePowerPlays?.plotArmor) && (
                <span className="mr-1 text-neon-cyan" data-testid="shield-badge" aria-label="Shield up: your next strike is blocked">{gameState.activeBuffs.find(b => b.id === 'strikeShield')?.icon ?? '🛡️'}</span>
              )}
              STRIKES
            </div>
            <div className="flex justify-end items-center gap-1.5 mt-1">
              {[...Array(maxStrikes ?? 3)].map((_, i) => (
                <div key={i} className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full transition-colors ${(i < (gameState?.strikes ?? 0)) ? 'bg-neon-red shadow-[0_0_8px_#ff4757]' : 'bg-crt-600'}`}></div>
              ))}
            </div>
          </div>
          {/* v7.84.0: one 🎒 button holds Gear, sound and music, the event log, trophies and Save & Quit. */}
          <button type="button" data-testid="gear-button" data-glow={gearGlow ? '1' : undefined}
            onClick={() => dispatch({ type: 'SET_MODAL_CONTENT', payload: { type: 'gear', title: 'Your Gear' } })}
            aria-label={`Your gear, sound, event log and save: ${gameState?.activeCharms?.length ?? 0} of ${CHARM_SLOTS} charms. Tap to open; the game pauses.`}
            className={`relative w-11 h-11 rounded-xl grid place-items-center text-2xl bg-crt-950/80 transition-shadow ${gearGlow ? 'ring-2 ring-neon-yellow shadow-[0_0_16px_rgba(255,216,77,0.7)] animate-pulse' : 'ring-1 ring-white/20 hover:ring-neon-cyan/60'}`}>
            <span aria-hidden="true">🎒</span>
            <span className={`absolute -bottom-1.5 -right-1.5 rounded-full px-1 min-w-[1.25rem] osd-text text-sm leading-[1.1rem] text-center ${gearGlow ? 'bg-neon-yellow text-crt-900' : 'bg-neon-purple text-white'}`} data-testid="gear-count">{gameState?.activeCharms?.length ?? 0}/{CHARM_SLOTS}</span>
          </button>
        </div>
      </div>

      {gameState && gameState.roundType !== 'golden' && ((gameState.freezeLeft ?? 0) > 0 || (gameState.slowWords ?? 0) > 0) && (
        <div className="flex-shrink-0 rounded-lg px-3 py-1 text-center bg-cyan-500/20 ring-1 ring-cyan-300/60" role="status">
          <span className="osd-text text-lg leading-none text-cyan-100">
            {(gameState.freezeLeft ?? 0) > 0 ? withSec(gameState.activePowerPlays?.ludicrousSpeed === true ? `🚀 LUDICROUS SPEED · x${POWER_PLAY_VALUES.ludicrousSpeedMultiplier} · ${gameState.freezeLeft}s` : `❄️ CLOCK FROZEN · ${gameState.freezeLeft}s`) : `🦥 SLOW MOTION · ${gameState.slowWords} ${gameState.slowWords === 1 ? 'WORD' : 'WORDS'} LEFT`}
          </span>
        </div>
      )}

      {activeBoss && gameState?.boss && gameState.roundType !== 'golden' && (
        <div className="boss-banner flex-shrink-0 rounded-lg px-3 py-1.5 text-center" role="status" aria-label={`Boss round: ${activeBoss.name}. ${activeBoss.description} ${gameState.boss.hits} of ${bossHitsToWin(gameState, activeBoss)} hits, ${gameState.boss.wordsLeft} words left.`}>
          <div className="font-display text-lg leading-none text-white">{activeBoss.icon} BOSS ROUND · {activeBoss.name.toUpperCase()}</div>
          <div className="osd-text text-base leading-tight text-white/90">
            <span className="font-bold text-white">{activeBoss.rule}</span> · 👊 {gameState.boss.hits}/{bossHitsToWin(gameState, activeBoss)} · {gameState.boss.wordsLeft} {gameState.boss.wordsLeft === 1 ? 'WORD' : 'WORDS'} LEFT
          </div>
        </div>
      )}

      {gameState?.roundType === 'golden' && (
        <div className="golden-banner flex-shrink-0 rounded-lg px-3 py-1.5 text-center" role="status">
          <div className="font-display text-lg leading-none text-crt-900">★ GOLDEN ROUND ★</div>
          <div className="osd-text text-base leading-tight text-crt-900/80">
            ONE WORD · x{GAMEPLAY.goldenRound.multiplier} · <span className="text-crt-900 font-bold">USE ★ {goldenLetter ?? 'THE GOLDEN TILE'} = x{GAMEPLAY.goldenRound.tileMultiplier}</span> · NO STRIKES
          </div>
        </div>
      )}

      {/* --- STATUS AREA --- */}
      {/* v7.81.0: the status area keeps its own height; the spare height goes to the stage below. */}
      <div className="flex-shrink-0 flex flex-col gap-1.5">
      {/* --- PROGRESS INDICATORS (v7.31): Golden Round, PowerPlay meter and Word Combo share one compact row --- */}
      {(() => {
        const letters = gameState?.powerPlayProgress?.letters ?? 0;
        const needed = meterLettersFor(levelFor(totalWords ?? 0), gameState);
        const ppFull = letters >= needed;
        const ppPct = Math.min(100, (letters / needed) * 100);
        const combo = gameState?.powerSurgeProgress ?? 0;
        const comboReady = combo >= 4;
        const chain = gameState?.perfectChainProgress ?? 0;
        // v7.81.0: what the word on the stage would add, as a faint ghost fill and a glow.
        const stageLen = (wordFromBuildRow?.length ?? 0) >= (gameState?.gameConfig?.minWordLength ?? 3) && (gameState?.roundType ?? 'normal') === 'normal' ? (wordFromBuildRow?.length ?? 0) : 0;
        const ghost = (pct: number, color: string) => stageLen > 0 ? <div className={`absolute inset-y-0 left-0 rounded-full opacity-40 animate-pulse ${color}`} style={{ width: `${Math.min(100, pct)}%` }} data-testid="meter-ghost" /> : null;
        // v7.84.0 (the owner's call): one slim row of bars, no boxes. They still glow and show a ghost fill
        // for the word on the stage, which is how players see what their next word earns.
        const label = 'osd-text text-sm leading-none uppercase tracking-wider whitespace-nowrap';
        const normal = (gameState?.roundType ?? 'normal') === 'normal';
        const have = gameState?.consecutiveValidWords ?? 0;
        const need = gameState?.goldenRoundThreshold ?? 11;
        const left = Math.max(0, need - have);
        const close = left > 0 && left <= GAMEPLAY.goldenRound.chipFrom;
        return (
          <div className={`grid gap-3 w-full flex-shrink-0 px-1 ${normal ? 'grid-cols-3' : 'grid-cols-2'}`} data-testid="meters">
            {normal && (
              <div className="min-w-0" data-testid="golden-streak" aria-label={`Golden Round streak ${have} of ${need}. ${left} more valid words in a row for a Golden Round; a strike resets it.`}>
                <span className={`${label} flex justify-between ${close ? 'text-neon-yellow animate-pulse' : stageLen ? 'text-neon-yellow' : 'text-neon-yellow/80'}`}>
                  <span>{close ? `★ ${left} MORE!` : '★ GOLDEN'}</span><span className="text-slate-300 tabular-nums">{have}/{need}</span>
                </span>
                <div className={`relative h-1.5 mt-1 rounded-full bg-crt-600 overflow-hidden ${close || stageLen ? 'shadow-[0_0_8px_rgba(255,210,63,0.6)]' : ''}`}>
                  {ghost(((have + 1) / need) * 100, 'bg-neon-yellow')}
                  <div className="relative h-full rounded-full bg-neon-yellow transition-all duration-500" style={{ width: `${Math.min(100, (have / need) * 100)}%` }} />
                </div>
              </div>
            )}
            <div className="min-w-0" aria-label={`PowerPlay meter ${letters} of ${needed} letters`}>
              <span className={`${label} flex justify-between ${ppFull ? 'text-neon-green animate-pulse' : stageLen ? 'text-[#d9b6ff]' : 'text-neon-purple'}`}><span>⚡ PWRPLAY</span><span className="text-slate-300 tabular-nums">{letters}/{needed}</span></span>
              <div className={`relative h-1.5 mt-1 rounded-full bg-crt-600 overflow-hidden ${stageLen ? 'shadow-[0_0_8px_rgba(180,92,255,0.7)]' : ''}`}>
                {ghost(((letters + stageLen) / needed) * 100, 'bg-neon-purple')}
                <div className={`relative h-full rounded-full transition-all duration-500 ${ppFull ? 'bg-neon-green animate-pulse' : 'bg-neon-purple'}`} style={{ width: `${ppPct}%` }} />
              </div>
            </div>
            <div className="min-w-0" role="meter" aria-valuenow={combo} aria-valuemin={0} aria-valuemax={5} aria-valuetext={`Word Combo ${combo} of 5${comboReady ? ', next word scores x2' : ''}`}>
              <span className={`${label} flex justify-between ${comboReady ? 'text-neon-yellow animate-pulse' : 'text-neon-cyan'}`}><span>{comboReady ? 'NEXT x2!' : '🔗 COMBO'}</span><span className="text-slate-300 tabular-nums">{chain > 0 ? '4️⃣'.repeat(chain) : `${combo}/5`}</span></span>
              <div className="flex gap-0.5 mt-1">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className={`flex-1 h-1.5 rounded-full transition-all duration-300 ${i < combo ? (comboReady ? 'bg-neon-yellow shadow-glow-yellow' : 'bg-neon-cyan') : 'bg-crt-600'}`} />
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      </div>

      {/* --- THE STAGE (v7.81.0, the owner's redesign): the middle of the screen is where your word lives.
          It grows from the center in big keycaps, with the points and seconds it will earn right under it
          and chips for what it will fill (PowerPlay, Golden, Combo, the next length bonus). --- */}
      {(() => {
        const placed = (buildRow ?? []).map((it, i) => (it ? { ...it, index: i } : null)).filter((x): x is NonNullable<typeof x> => x !== null);
        const n = placed.length;
        const minLen = gameState?.gameConfig?.minWordLength ?? 3;
        const level = levelFor(totalWords ?? 0);
        const normal = (gameState?.roundType ?? 'normal') === 'normal';
        const secs = n >= minLen ? timeForWordAtLevel(n, level) : 0;
        // 🎬 v7.96.0: the genres this word fits that already have a ★ (paid on submit).
        const stageWord = placed.map(p => p.tile.letter).join('');
        const genreLine = n >= minLen && normal && gameState && !stageWord.includes('?')
            ? genrePay(gameState, stageWord, earlierKeys(gameState.log ?? [])) : [];
        // v7.85.0 (the owner's call): no routine pills under the word (the meters up top already preview the
        // fill). Only big news, one readable line each: the word fills the meter, starts a Golden Round, or
        // gets the Combo x2.
        const effects: { text: string; tone: string }[] = [];
        if (n >= minLen && normal) {
          const letters = gameState?.powerPlayProgress?.letters ?? 0;
          const needed = meterLettersFor(level, gameState);
          if (letters + n >= needed) effects.push({ text: '⚡ FILLS YOUR POWERPLAY METER!', tone: 'text-neon-purple' });
          if ((gameState?.consecutiveValidWords ?? 0) + 1 >= (gameState?.goldenRoundThreshold ?? 11)) effects.push({ text: '★ STARTS A GOLDEN ROUND!', tone: 'text-neon-yellow' });
          if ((gameState?.powerSurgeProgress ?? 0) >= 4) effects.push({ text: '🔗 COMBO x2 ON THIS WORD!', tone: 'text-neon-cyan' });
          // v7.86.0 (the owner's ask): this play completes a Greatest Hits record.
          const record = hitIfPlayed(gameState?.log ?? [], gameState?.hitsClaimed ?? [], wordFromBuildRow ?? '');
          if (record) effects.unshift({ text: `${record.icon} ${(wordFromBuildRow ?? '').toUpperCase()} GOES ${record.title}: +${record.points.toLocaleString()}!`, tone: 'text-neon-yellow' });
        }
        // v7.85.0: the open spot after the word glows when one more letter pays more (length bonus, time).
        const nextLen = n >= minLen && n < BUILD_ROW_SIZE ? n + 1 : 0;
        const nextMult = nextLen ? lengthMultiplier(nextLen) : 1;
        const nextSecs = nextLen ? timeForWordAtLevel(nextLen, level) : 0;
        const nextPays = !!nextLen && (nextMult > lengthMultiplier(n) || nextSecs > secs);
        const tileW = `min(var(--stage-tile-max, 3.6rem), calc((100% - ${Math.max(0, n) * 6}px) / ${Math.max(1, n + (n < BUILD_ROW_SIZE ? 0.55 : 0))}))`;
        return (
          <div className="stage-panel relative flex-1 min-h-[9rem] w-full max-w-sm mx-auto rounded-2xl flex flex-col px-2 pt-1.5 pb-2 overflow-y-auto overscroll-contain" data-testid="stage">
            <StageSounds effects={effects.map(e => e.text)} />
            {(gameState?.availablePowerPlays?.length ?? 0) > 0 && (
              <div className="relative z-10 flex-shrink-0 h-8 flex items-center justify-center gap-2">
            {(gameState?.availablePowerPlays ?? []).slice(0, 1).map((pp) => (
                pp.id === 'multiplicity' ? (
                    // Multiplicity (v7.36.1) says what it will become, or that there's nothing to copy yet.
                    <button key={pp.id} onClick={() => handleActivatePowerPlay(pp)} className={`min-w-0 flex items-center gap-1 font-semibold pl-2 pr-3 h-8 rounded-full text-sm transition ${copyTarget ? 'bg-neon-pink text-white ring-2 ring-neon-pink/40 shadow-[0_0_12px_rgba(255,77,196,0.45)] hover:brightness-110' : 'bg-crt-800 text-slate-300 ring-1 ring-white/20'}`}
                        title={copyTarget ? `Turn Multiplicity into ${copyTarget.name}` : 'Use a PowerPlay first, then Multiplicity can copy it'} aria-label={copyTarget ? `Multiplicity: copy ${copyTarget.name}` : 'Multiplicity: nothing to copy yet'}>
                        <span className="text-base leading-none">👯</span>
                        <span className="osd-text text-lg leading-none shrink-0">{copyTarget ? '▶ COPY' : 'NOTHING TO COPY'}</span>
                        {copyTarget && <span className="truncate">{copyTarget.icon} {copyTarget.name}</span>}
                    </button>
                ) : (
                    <button key={pp.id} onClick={() => handleActivatePowerPlay(pp)} className="min-w-0 flex items-center gap-1 bg-neon-green text-crt-900 font-semibold pl-2 pr-3 h-8 rounded-full text-sm hover:brightness-110 transition ring-2 ring-neon-green/40 shadow-[0_0_12px_rgba(61,255,140,0.45)]" title={`Tap to use ${pp.name}`} aria-label={`Use PowerPlay: ${pp.name}`}>
                    <span className="text-base leading-none">{pp.icon}</span>
                    <span className="osd-text text-lg leading-none shrink-0">▶ USE</span>
                    <span className="truncate">{pp.name}</span>
                    {gameState?.tapeBonusId === pp.id && <span className="shrink-0 rounded-full bg-crt-900 text-neon-yellow osd-text text-base leading-none px-1.5 py-0.5" aria-label={`Mystery Tape bonus when used`}>📼+{prizeFor(MYSTERY_TAPE.usePoints, levelFor(totalWords ?? 0))}</span>}
                </button>
                )
            ))}
              </div>
            )}
            {/* --- THE NOTICE RAIL (v7.82.0): what used to be squeezed between the word and the tiles. The
                "tap me / read me" notices are cards, one at a time with dots; live counters (Hold, the speed
                streak, Jenga, Hamm, races, bets, quizzes) stay visible in a strip under them. --- */}
            {(() => {
              const notices: Notice[] = [];
              if (powerHint) notices.push({
                id: 'power', icon: `⚡${powerHint.icon}`, tone: 'yellow', testId: 'power-hint',
                title: powerLit ? 'SPELL THE LIT TILES' : 'A POWER WORD IS HIDING',
                text: powerLit ? `Spell ${powerHint.length} letters using the lit tiles, in any order.` : `Your tiles can spell a ${powerHint.length}-letter power word: ${powerPrize.toLowerCase()}.`,
                action: powerLit ? 'MORE' : 'LIGHT IT',
                onTap: () => { if (powerLitWord === powerHint.word) handlePowerHintInfo?.(); else setPowerLitWord(powerHint.word ?? ''); },
                label: `Hint: a ${powerHint.length}-letter power word is hiding in this hand. Prize: ${powerPrize}. ${powerLit ? 'Its tiles are lit. Tap for more.' : 'Tap to light its tiles.'}`,
              });
              if (skillShotTileId) notices.push({
                id: 'skill', icon: '🎯', tone: 'pink', title: `SKILL SHOT +${skillShotPrize}`,
                text: `Use the pink +${skillShotPrize} tile in your next word.`,
                label: `Skill Shot: use the lit tile in your next word for ${skillShotPrize} points`,
              });
              if ((gameState?.headStart ?? 0) > 0 && totalWords === 0) notices.push({
                id: 'head', icon: '🛠️', tone: 'green', title: <>HEAD START +{gameState?.headStart}<Sec /></>,
                text: 'A bonus from your last run, already on your clock.',
                label: `Head Start: ${gameState?.headStart} extra seconds on the clock this run`,
              });
              return (
                <div className="relative z-10 flex-shrink-0 flex flex-col gap-1.5 mt-1 [@media(max-height:700px)]:gap-1 [@media(max-height:700px)]:mt-0.5" data-testid="notice-rail">
                  {notices.length > 0 && <NoticeRail notices={notices} flash={noticeFlash} />}
          {(holdOpen || speedChip) && (
            <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
              {holdOpen && (
                <button type="button" onPointerDown={e => { e.preventDefault(); handleHoldTap?.(); }} onClick={e => { if (e.detail === 0) handleHoldTap?.(); }}
                  aria-label={gameState?.holdTile ? `Hold slot: ${gameState.holdTile.letter}. Tap to take it back.` : holdArmed ? 'Hold slot: tap a tile to park it' : 'Hold slot, empty. Tap, then tap a tile to park it.'}
                  className={`flex items-center gap-1.5 rounded-xl pl-1 pr-2.5 py-1 ring-2 select-none touch-none ${gameState?.holdTile ? 'ring-neon-purple bg-neon-purple/15' : holdArmed ? 'ring-neon-yellow bg-neon-yellow/15 animate-pulse' : 'ring-white/20 bg-crt-950/70'}`}>
                  <span className={`w-9 h-9 rounded-lg grid place-items-center font-tile font-extrabold text-xl ${gameState?.holdTile ? 'bg-[#f6e7c1] text-crt-900 tile-3d' : 'bg-crt-950 text-slate-600 border border-dashed border-white/20'}`}>
                    {gameState?.holdTile ? gameState.holdTile.letter : '🧲'}
                  </span>
                  <span className="osd-text text-base leading-none text-slate-200">{gameState?.holdTile ? 'HELD · TAP TO USE' : holdArmed ? 'TAP A TILE' : 'HOLD'}</span>
                </button>
              )}
              {speedChip}
            </div>
          )}
                  <div className="[&>div]:justify-center">
                    <PowerPlayTrackers gameState={gameState} upcomingTiles={upcomingTiles} quizLeft={quizLeft} raceRival={raceRival} onStand={() => dispatch({ type: 'BLACKJACK_STAND' })} onJengaCash={() => dispatch({ type: 'JENGA_CASH' })} onPiggySmash={() => dispatch({ type: 'SMASH_PIGGY' })} />
                  </div>
                </div>
              );
            })()}
            <div className="stage-body relative flex-1 min-h-0 flex flex-col items-center gap-2 [@media(max-height:700px)]:gap-1">
              {/* The pop waits for any card the word opened (a PowerPlay offer, a level-up...) to close, so it plays
                  where the player can see it; after 30 s it's old news and is skipped. */}
              {n === 0 && landed && tallyDoneKey !== landed.key && !modalContent && !isPaused && Date.now() - landed.key < 30000 && <ScoreTally key={landed.key} word={landed.word} total={landed.total} base={landed.base} onShown={setLandedShown} onDone={() => setTallyDoneKey(landed.key)} />}
              {/* v7.83.0: a message never covers the word. With an empty word row it sits in the middle of the
                  stage; while you're spelling it sits under the word's chips instead (see below). */}
              {message && n === 0 && !landedShown && (
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center pointer-events-none z-20" role="status" aria-live="polite">
                  <div key={message} className="message-pop max-w-full px-3 py-1.5 rounded-lg bg-crt-950/95 ring-1 ring-neon-cyan/60 shadow-glow-cyan osd-text text-xl leading-tight text-neon-cyan text-center whitespace-pre-line">
                    {withSec(message ?? '')}
                  </div>
                </div>
              )}
              <div className="w-full flex justify-center items-end gap-1.5 min-h-[3.9rem]" data-testid="word-stage" aria-label={n ? `Your word: ${wordFromBuildRow}` : 'Your word: empty'}>
                {n === 0 && !message && !landedShown && <p className="osd-text text-xl leading-none text-slate-500 tracking-wider self-center">TAP TILES TO SPELL A WORD</p>}
                {placed.map(item => (
                  <div key={item.tile.id} className="tile-land stage-tile shrink-0" style={{ width: tileW }}>
                    <div className="w-full aspect-[1/1.08]">
                      <TileComponent tile={item.tile} onClick={() => handleReturnToHand(item.index)} packTileClass={tileClass} isGolden={item.tile.id === gameState?.goldenTileId} skillShot={item.tile.id === skillShotTileId ? skillShotPrize : undefined} powerLit={powerLitIds.has(item.tile.id)} />
                    </div>
                  </div>
                ))}
                {n > 0 && n < BUILD_ROW_SIZE && <div className={`stage-cursor shrink-0 self-center ${nextPays ? 'stage-cursor-pays' : ''}`} style={{ width: `calc(${tileW} * 0.55)` }} aria-hidden="true" data-testid={nextPays ? 'next-slot-pays' : undefined} />}
              </div>
              {nextPays && (
                // The tag sits on its own row, lined up under the glowing spot (invisible spacers match the tiles).
                <div className="w-full flex justify-center gap-1.5 -mt-1 pointer-events-none" aria-label={`One more letter: length bonus x${nextMult}, plus ${nextSecs} seconds`} data-testid="next-letter-tag">
                  {placed.map(item => <div key={item.tile.id} className="shrink-0" style={{ width: tileW }} />)}
                  <div className={`shrink-0 flex ${n >= 5 ? 'justify-end' : 'justify-center'}`} style={{ width: `calc(${tileW} * 0.55)` }}>
                    <span className="stage-next-tag whitespace-nowrap text-center leading-none rounded-md px-1.5 py-1 osd-text">
                      <span className="block text-sm text-neon-yellow">+1 LETTER</span>
                      <span className="block text-sm text-white">x{nextMult}{nextSecs > secs ? <> · +{nextSecs}<Sec /></> : ''}</span>
                    </span>
                  </div>
                </div>
              )}
              {n > 0 && (
                <div className="stage-readout text-center" data-testid="stage-readout">
                  {potentialScore > 0 ? (
                    <>
                      {/* v7.85.0 (the owner's call): this is the BASE score; boosts that land on submit (Combo x2,
                          upgrades, multipliers...) show in the big "+N" that pops after you submit. */}
                      <span className="osd-text text-lg leading-none text-neon-yellow/70 mr-1.5 align-middle" data-testid="base-label">BASE</span>
                      <span className="font-display text-3xl leading-none text-neon-yellow drop-shadow-glow-yellow">{potentialScore.toLocaleString()}</span>
                      <span className="osd-text text-xl leading-none text-neon-yellow/80 ml-1">PTS</span>
                      {secs > 0 && <span className="osd-text text-2xl leading-none text-neon-green ml-3">+{secs}<Sec /></span>}
                    </>
                  ) : n < minLen ? (
                    <span className="osd-text text-xl leading-none text-slate-400">{minLen - n} MORE {minLen - n === 1 ? 'LETTER' : 'LETTERS'} TO SUBMIT</span>
                  ) : null}
                </div>
              )}
              {genreLine.length > 0 && (
                <div className="w-full flex flex-wrap justify-center gap-x-3 gap-y-0.5 pr-11 pl-1" data-testid="stage-genres">
                  {genreLine.map(g => (
                    <span key={g.genre.id} className="osd-text text-lg leading-none text-neon-yellow">{g.genre.icon} {g.genre.name.toUpperCase()} ★{g.stars} +{g.points}</span>
                  ))}
                </div>
              )}
              {effects.length > 0 && (
                <div className="w-full flex flex-col items-center gap-0.5 pr-11 pl-1" data-testid="stage-effects">
                  {effects.map(e => (
                    <span key={e.text} className={`message-pop font-display text-sm leading-tight text-center ${e.tone} animate-pulse`}>{e.text}</span>
                  ))}
                </div>
              )}
              {message && n > 0 && (
                <div className="w-full flex justify-center pointer-events-none pr-11" role="status" aria-live="polite" data-testid="stage-message">
                  <div key={message} className="message-pop max-w-full px-3 py-1 rounded-lg bg-crt-950/95 ring-1 ring-neon-cyan/60 osd-text text-lg leading-tight text-neon-cyan text-center whitespace-pre-line">
                    {withSec(message ?? '')}
                  </div>
                </div>
              )}
            </div>
            {n > 0 && (
              <BackspaceButton
                disabled={isChallengeLock || isLoading || isPaused}
                onBack={() => handleReturnToHand(placed[placed.length - 1].index)}
                onClearAll={handleClear}
              />
            )}
          </div>
        );
      })()}

      {/* --- PLAY AREA (always visible) --- */}
      <div className="relative flex-shrink-0 flex flex-col gap-2 w-full max-w-sm mx-auto">
        {/* Greatest Hits (v7.87.0): right above the tiles, in the player's eyeline while picking letters. */}
        {gameState?.roundType !== 'golden' && <HitsChip gameState={gameState} />}
        {/* --- HAND: the standard hand in a 4x2 grid; widens to all rack slots when a power-up overfills it --- */}
        {(() => {
          const rack = hand ?? Array(RACK_SIZE).fill(null);
          const overfilled = rack.slice(HAND_SIZE).some(t => t !== null);
          const slots = overfilled ? rack : rack.slice(0, HAND_SIZE);
          const columns = overfilled ? 5 : 4;
          return (
            <div className="grid gap-2 w-full" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
              {slots.map((item, originalIndex) => {
                // Hinted word tiles are numbered in spelling order.
                const hintIds = [highlightedTileIds?.first, ...(highlightedTileIds?.rest ?? [])].filter(Boolean);
                const hintIndex = item ? hintIds.indexOf(item.id) : -1;
                const hintOrder = hintIndex >= 0 ? hintIndex + 1 : undefined;
                return (
                  <div key={item?.id || originalIndex} className={`w-full h-12 min-[375px]:h-14 sm:h-16 flex items-center justify-center ${item ? 'tile-deal' : ''}`} style={item ? { animationDelay: `${originalIndex * 45}ms` } : undefined}>
                    {item ? <TileComponent tile={item} onClick={() => handleMoveToBuild(item, originalIndex)} packTileClass={tileClass} isGolden={item.id === gameState?.goldenTileId} skillShot={item.id === skillShotTileId ? skillShotPrize : undefined} powerLit={powerLitIds.has(item.id)} hintOrder={hintOrder} bossHint={bossTileHint(item)} faceDown={blind && !peeking} /> : <div className="w-full h-full rounded-lg tile-socket"></div>}
                  </div>
                );
              })}
            </div>
          );
        })()}
        
        {/* --- ACTION BUTTONS (v7.81.0): one big SUBMIT between SHUFFLE and STUCK?; Clear is the ⌫ on the stage. --- */}
        <div className="grid grid-cols-[5.25rem_minmax(0,1fr)_5.25rem] gap-2 pb-1 h-[4.25rem] [@media(max-height:700px)]:h-[3.6rem]">
          <ShuffleButton
            compact
            count={gameState?.shuffleCount ?? 0}
            seconds={GAMEPLAY.timeBank.shuffleTimeBonus}
            disabled={(gameState?.shuffleCount ?? 0) <= 0 || isPaused || isChallengeLock || isLoading || (gameState?.roundType === 'golden')}
            lowTime={gameState?.roundType !== 'golden' && (time ?? 0) <= GAMEPLAY.timeBank.lifelineHintBelow}
            timerRef={timerRef}
            onShuffle={() => handleShuffle(false)}
          />
          <ArcadeButton
            color="yellow"
            size="lg"
            className={`h-full w-full ${(wordFromBuildRow?.length ?? 0) >= (gameState?.gameConfig?.minWordLength ?? 3) && !isLoading && !isPaused ? 'submit-ready' : ''}`}
            onClick={handleSubmit}
            disabled={(wordFromBuildRow?.length ?? 0) < (gameState?.gameConfig?.minWordLength ?? 3) || isLoading || isPaused}
          >
            Submit
          </ArcadeButton>
          {(() => {
            const stuckDisabled = (isStrikeChallenge ? strikesRemaining <= 0 : (gameState?.challengeCount ?? 0) <= 0) || (buildRow ?? []).some(t => t !== null) || isPaused || isChallengeLock || isLoading || (gameState?.roundType === 'golden');
            return (
              <ArcadeButton
                color={isStrikeChallenge ? 'red' : 'green'}
                onClick={handleChallenge}
                disabled={stuckDisabled}
                className="relative h-full w-full !flex-col !gap-0.5 !px-1 !py-1"
                data-testid="stuck-button"
                aria-label={isStrikeChallenge
                  ? `Stuck? Out of free checks: claim your tiles can't make a word, and risk a strike if they can. ${strikesRemaining} strikes left.`
                  : `Stuck? Claim your tiles can't make a word. If none can be made you get free new tiles. ${gameState?.challengeCount ?? 0} left.`}
              >
                <span className="text-xl leading-none" aria-hidden="true">🤔</span>
                <span className="text-xs leading-none">STUCK?</span>
                <span className="font-osd normal-case text-sm leading-none opacity-80">{isStrikeChallenge ? 'RISK A STRIKE' : 'NO WORD?'}</span>
                <span className={`absolute top-1 right-1 min-w-[1.25rem] h-5 px-1 rounded-full font-osd text-base leading-5 text-center ${stuckDisabled ? 'bg-crt-600 text-slate-400' : 'bg-crt-900 text-white'}`} data-testid="stuck-count">{isStrikeChallenge ? '❌' : gameState?.challengeCount ?? 0}</span>
              </ArcadeButton>
            );
          })()}
        </div>
      </div>

    </div>
  );
};
