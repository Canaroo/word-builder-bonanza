import { Sec, withSec } from '../../components/Seconds';
import React, { useEffect, useRef, useState } from 'react';
import ArcadeButton from '../../components/ArcadeButton';
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
import { levelFor, snitchTargetFor, meterLettersFor, levelTierFor, bossHitsToWin, prizeScaleFor } from '../rules';
import LevelBadge from '../../components/LevelBadge';
import LevelUpCard from '../../components/LevelUpCard';
import OutcomeCard from '../../components/OutcomeCard';
import ContinueCard from '../../components/ContinueCard';
import LastWordsCard from '../../components/LastWordsCard';
import ForkCard from '../../components/ForkCard';
import CrocCard from '../../components/CrocCard';
import SoundMenu from '../../components/SoundMenu';
import GreatestHitCard from '../../components/GreatestHitCard';
import BonesCard from '../../components/BonesCard';
import { FORK, SKILL_SHOT, GATES, MYSTERY_TAPE } from '../../config/gameplay';
import { skillShotPoints } from '../../services/rules';
import GambleCard, { type GambleResult } from '../../components/GambleCard';
import PowerPlayTrackers from '../../components/PowerPlayTrackers';
import MiniGameCard from '../../components/MiniGames';
import CharmTimeNote from '../../components/CharmTimeNote';
import DangerChip from '../../components/DangerChip';
import { leadingSet, setPayFor } from '../../data/charmSets';
import { nextGateFor, previousGateFor, powerWordInfo, prizeFor } from '../rules';
import ModalTapGuard, { GUARDLESS_MODALS } from '../../components/ModalTapGuard';
import { POWER_PLAY_VALUES } from '../../config/gameplay';

export type ModalContent = {
  type: 'milestone' | 'blue-steel' | 'charm-selection' | 'powerplay-selection' | 'word-log' | 'info' | 'powerplay-activation' | 'word-bonus' | 'charm-activation' | 'buff-info' | 'easter-egg' | 'super-hand' | 'save-confirmation' | 'game-over-summary' | 'milestone-info' | 'event-log' | 'slot-machine' | 'level-up' | 'outcome' | 'gamble' | 'minigame' | 'continue-offer' | 'last-words' | 'fork' | 'bones' | 'skill-intro' | 'gem-intro' | 'croc' | 'greatest-hit' | 'quack';
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
  handleForkPick?: (route: 'easy' | 'danger') => void;
  handleForkBail?: () => void;
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
  showBuffInfo: (buff: Charm | PowerPlay) => void;
  handleActivatePowerPlay: (powerPlay: PowerPlay, confirmed?: boolean) => void;
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
    gameState, time, resumeCountdown = 0, handleResolveGamble, handleResolveMiniGame, handleContinueOffer, handleLastWords, skillShotTileId = '', holdOpen = false, holdArmed = false, handleHoldTap, handleForkPick, handleForkBail, handleCrocPick, handleBonesDone, lexCoins = 0, powerHint = null, handlePowerHintInfo, upcomingTiles, quizLeft, raceRival, timeGain, message, hand, buildRow, isPaused, isLoading, modalContent, tilesToSwap,
    tileToTransform, tileForSelection, wordFromBuildRow, totalWords, potentialScore, maxStrikes, challengeButtonText,
    tileClass, isMuted, isChallengeLock, highlightedTileIds, isStrikeChallenge, strikesRemaining,
    handleMuteToggle, handleCloseModal, handlePhoneAFriend, handleShowMilestoneInfo, handleShowEventLog,
    handleMoveToBuild, handleReturnToHand, handleShuffle, handleSubmit, handleClear,
    handleChallenge, handleSaveClick, handleConfirmSave, showBuffInfo,
    handleActivatePowerPlay, handleActivateCharm, handleChoosePowerPlay, handleChooseCharm, handlePassCharm, handleUpgradeCharm, handleKeepPowerPlay,
    handleAddTileToSwap, handleRemoveTileFromSwap, handleExecuteSwap, dispatch
}) => {
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
    const powerLit = !!powerHint?.word && powerLitWord === powerHint.word;
    const powerPrize = powerHint?.effect ? powerWordInfo(powerHint.effect as any).prize : 'A BONUS';
    const powerLitIds = React.useMemo(() => {
      const ids = new Set<string>();
      if (!powerLit || !powerHint?.word) return ids;
      const pool = [...(hand ?? []), ...(buildRow ?? []).map(i => i?.tile)].filter((t): t is Tile => !!t);
      for (const letter of powerHint.word) {
        const t = pool.find(x => x.letter.toUpperCase() === letter && !ids.has(x.id));
        if (t) ids.add(t.id);
      }
      return ids;
    }, [powerLit, powerHint?.word, hand, buildRow]);
    const nextGate = gameState?.roundType === 'golden' ? null : nextGateFor(gameState);
    // v7.61.0: the best charm set the player has started, so sets aren't a secret.
    const lead = leadingSet((gameState?.activeCharms ?? []).map(c => c.id));
    const setChip = lead ? (() => {
            const n = lead.set.members.length;
            const next = setPayFor(lead.set, lead.held + 1);
            const text = lead.complete ? `${lead.set.name.toUpperCase()} · +${lead.points} A WORD`
              : lead.points > 0 ? `${lead.held}/${n} · +${lead.points} A WORD · +${next} AT ${n}/${n}`
              : `${lead.set.name.toUpperCase()} ${lead.held}/${n} · +${next} AT ${lead.held + 1}/${n}`;
            return (
              <span data-testid="set-chip" className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-white whitespace-nowrap ring-1 max-w-full overflow-hidden ${lead.points > 0 ? 'ring-neon-green/70 bg-neon-green/10' : 'ring-neon-cyan/50 bg-crt-950/70'}`}
                aria-label={`Charm set ${lead.set.name}: ${lead.held} of ${n} held. ${lead.points > 0 ? `Pays ${lead.points} a word.` : ''} ${lead.complete ? '' : `${next} a word with ${lead.held + 1}.`}`}>
                <span aria-hidden="true">🧩{lead.set.icon}</span><span className="truncate">{text}</span>
              </span>
            );
          })() : null;
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
                            <p className="text-sm text-slate-400">6-letter words earn x{GEM_TILES[6]}, 7 letters x{GEM_TILES[7]}, 8 or more x{GEM_TILES[8]}.</p>
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
                return <ForkCard level={Number(data?.level) || 1} delta={data?.delta ?? null} clock={Number(data?.clock) || 0} onPick={route => handleForkPick?.(route)} />;

            case 'last-words':
                return <LastWordsCard reason={data?.reason === 'strikes' ? 'strikes' : 'time'} tiles={(hand ?? []).filter((t): t is Tile => !!t)} gameState={gameState} onDone={r => handleLastWords?.(r)} />;

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
                           <p className="text-slate-200 text-center my-4">Save your run and return to the main menu? Tap Resume there to pick up right where you left off.</p>
                           <p className="text-slate-400 text-sm text-center -mt-2 mb-2">Your run also saves itself after every word, so closing the app by accident won't lose it.</p>
                           <div className="flex gap-4 mt-4">
                                <button onClick={handleCloseModal} className="w-full px-6 py-3 text-xl font-bold text-white bg-red-600 rounded-lg shadow-lg hover:bg-red-500">CANCEL</button>
                                <button onClick={handleConfirmSave} className="w-full px-6 py-3 text-xl font-bold text-slate-900 bg-cyan-400 rounded-lg shadow-lg hover:bg-cyan-300">SAVE & QUIT</button>
                           </div>
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
                                <p className="text-sm text-slate-400 text-center mt-3">The copy replaces Multiplicity in your pocket. Use it whenever you like.</p>
                                {copyTarget && (
                                    <ArcadeButton color="pink" className="w-full mt-3" onClick={() => handleActivatePowerPlay(powerPlay, true)}>
                                        👯 Copy {copyTarget.icon} {copyTarget.name}
                                    </ArcadeButton>
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
    <div className="flex flex-col h-full min-h-0 p-3 text-slate-200 gap-2">
      {/* --- MODALS --- */}
      {renderModal()}
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
      <div className="grid grid-cols-[1fr_auto_1fr] items-center flex-shrink-0 text-white gap-2">
        {/* Score & Words Display */}
        <div className="flex flex-col gap-1 min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="text-left">
            <div className="osd-text text-base leading-none text-neon-yellow">SCORE</div>
            <div className="font-osd text-3xl leading-none text-white">{gameState?.score?.toLocaleString() ?? '0'}</div>
          </div>
          <div className="text-left">
            <div className="osd-text text-base leading-none text-neon-yellow">WORDS</div>
            <div className="font-osd text-3xl leading-none text-white">{totalWords ?? 0}</div>
          </div>
        </div>
        {nextGate != null && (() => {
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
            {/* Charm time cut by the level (v7.40.2): say so under the clock, so it doesn't look like a bug. */}
            {timeGain?.charm && (
              <span
                key={`charm-${timeGain.key}`}
                className="charm-time-note absolute top-full left-1/2 z-20 mt-0.5 whitespace-nowrap rounded-md bg-crt-950/95 ring-1 ring-neon-orange px-2 py-1 osd-text text-sm leading-none text-neon-orange pointer-events-none"
                role="status"
              >
                🍀 CHARM TIME {timeGain.charm.full}→{timeGain.charm.paid} SEC
                {timeGain.charm.percent < 100 && <span className="text-slate-300"> · LVL {levelFor(totalWords ?? 0)}: {timeGain.charm.percent}%</span>}
                {timeGain.charm.halved && <span className="text-neon-yellow"> · ½ OVER {GAMEPLAY.timeBank.overflowAbove}</span>}
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

        {/* Strikes & Save Display */}
        <div className="flex items-center justify-end gap-2">
          <div>
            <div className="osd-text text-base leading-none text-neon-red text-right">STRIKES</div>
            <div className="flex justify-end items-center gap-1.5 mt-1">
              {[...Array(maxStrikes ?? 3)].map((_, i) => (
                <div key={i} className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full transition-colors ${(i < (gameState?.strikes ?? 0)) ? 'bg-neon-red shadow-[0_0_8px_#ff4757]' : 'bg-crt-600'}`}></div>
              ))}
            </div>
          </div>
          <button onClick={handleSaveClick} className="text-2xl text-slate-400 hover:text-white transition-transform hover:scale-110">
            💾
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
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain flex flex-col gap-1.5">
      {/* --- ICONS BAR --- */}
      <div className="flex justify-between items-center bg-crt-950/60 ring-1 ring-white/5 px-1 py-0.5 rounded-lg flex-shrink-0">
        <div className="flex gap-2 sm:gap-3">
          {MILESTONES_LIST.map(m => (
            <button key={m.id} onClick={() => handleShowMilestoneInfo(m)} disabled={!(gameState?.unlockedMilestoneIds ?? []).includes(m.id)} className="text-2xl transition-opacity disabled:opacity-30 enabled:hover:scale-110" title={m.name}>
              {m.icon}
            </button>
          ))}
        </div>
        <div className="flex gap-3">
          <button onClick={handleShowEventLog} className="text-2xl transition-transform hover:scale-110" title="Event Log" aria-label="Event log">📖</button>
          <button onClick={() => setShowSound(true)} className="text-2xl transition-transform hover:scale-110" title="Sound and music" aria-label={`Sound and music (${isMuted ? 'sound off' : 'sound on'})`}>{isMuted ? '🔇' : '🔊'}</button>
        </div>
      </div>

      {/* --- PROGRESS INDICATORS (v7.31): Golden Round, PowerPlay meter and Word Combo share one compact row --- */}
      {(() => {
        const letters = gameState?.powerPlayProgress?.letters ?? 0;
        const needed = meterLettersFor(levelFor(totalWords ?? 0), gameState);
        const ppFull = letters >= needed;
        const ppPct = Math.min(100, (letters / needed) * 100);
        const combo = gameState?.powerSurgeProgress ?? 0;
        const comboReady = combo >= 4;
        const chain = gameState?.perfectChainProgress ?? 0;
        const cell = 'bg-crt-950/60 ring-1 ring-white/5 rounded-lg px-1.5 py-1 flex flex-col justify-center gap-1 min-w-0';
        const label = 'osd-text text-sm leading-none text-neon-cyan/80 uppercase tracking-wider whitespace-nowrap';
        return (
          <div className={`grid gap-1.5 w-full flex-shrink-0 ${(gameState?.roundType ?? 'normal') === 'normal' ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {(gameState?.roundType ?? 'normal') === 'normal' && (
              (() => {
                // v7.60.0: a bar like the meter beside it, and a countdown once the round is close.
                const have = gameState?.consecutiveValidWords ?? 0;
                const need = gameState?.goldenRoundThreshold ?? 11;
                const left = Math.max(0, need - have);
                const close = left > 0 && left <= GAMEPLAY.goldenRound.chipFrom;
                return (
                  <div className={`${cell} ${close ? '!ring-neon-yellow shadow-glow-yellow' : ''}`} data-testid="golden-streak"
                    aria-label={`Golden Round streak ${have} of ${need}. ${left} more valid words in a row for a Golden Round; a strike resets it.`}>
                    <span className={`${label} flex justify-between ${close ? '!text-neon-yellow animate-pulse' : ''}`}>
                      <span>{close ? `★ ${left} more!` : '★ Golden'}</span>
                      <span className="text-slate-300 tabular-nums">{have}/{need}</span>
                    </span>
                    <div className="h-2 rounded-full bg-crt-600 overflow-hidden">
                      <div className="h-full rounded-full bg-neon-yellow transition-all duration-500" style={{ width: `${Math.min(100, (have / need) * 100)}%` }} />
                    </div>
                  </div>
                );
              })()
            )}
            <div className={cell} aria-label={`PowerPlay meter ${letters} of ${needed} letters`}>
              <span className={`${label} flex justify-between`}><span>PowerPlay</span><span className="text-slate-300 tabular-nums">{letters}/{needed}</span></span>
              <div className="h-2 rounded-full bg-crt-600 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${ppFull ? 'bg-neon-green shadow-glow-cyan animate-pulse' : 'bg-neon-purple'}`} style={{ width: `${ppPct}%` }} />
              </div>
            </div>
            <div className={`${cell} ${comboReady ? 'ring-neon-yellow/70' : ''}`} role="meter" aria-valuenow={combo} aria-valuemin={0} aria-valuemax={5} aria-valuetext={`Word Combo ${combo} of 5${comboReady ? ', next word scores x2' : ''}`}>
              <span className={`${label} ${comboReady ? '!text-neon-yellow animate-pulse' : ''}`}>{comboReady ? 'Next x2!' : chain > 0 ? `Combo · ${'4️⃣'.repeat(chain)}` : 'Word Combo'}</span>
              <div className="flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className={`flex-1 h-2 rounded-full transition-all duration-300 ${i < combo ? (comboReady ? 'bg-neon-yellow shadow-glow-yellow' : 'bg-neon-cyan shadow-glow-cyan') : 'bg-crt-600'}`} />
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* --- ACTIVE BUFFS TRAY --- */}
      <div className="text-center w-full flex-shrink-0">
        <div className="min-h-[2rem] bg-crt-950/60 ring-1 ring-white/5 p-0.5 pl-2 rounded-lg flex flex-wrap justify-center items-center gap-1">
          <span className="osd-text text-sm leading-none text-neon-cyan/80 uppercase tracking-wider mr-auto" aria-label={`Active buffs. ${gameState?.activeCharms?.length ?? 0} of ${CHARM_SLOTS} charm slots used`}>
            Buffs <span className="text-neon-purple">{gameState?.activeCharms?.length ?? 0}/{CHARM_SLOTS}</span>
          </span>
          {(gameState?.activeBuffs?.length ?? 0) > 0 ? (
            <>
              {(() => {
                  const charmIds = new Set((gameState?.activeCharms ?? []).map(c => c.id));
                  const buffs = gameState?.activeBuffs ?? [];
                  // Running PowerPlay effects get their name (and what's left); charms are compact icons.
                  const progressFor = (buff: Charm | PowerPlay): string => {
                      if (buff.id === 'goldenSnitch') return `${gameState?.consecutiveSuccesses ?? 0}/${snitchTargetFor(gameState?.snitchCatches ?? 0) ?? '-'}`;
                      if (buff.id === 'drMariosCure') return `${gameState?.drMarioCureStreak ?? 0}/3`;
                      if (buff.id === 'mixtape') return gameState?.mixtapeChain?.next ? `→${gameState.mixtapeChain.next}` : '';
                      if (buff.id === 'thrillerNight') return `${totalWords % 4}/4`;
                      if (buff.id === 'gottaCatchEmAll') return `${gameState?.pokedexVowels?.length ?? 0}/5`;
                      if (buff.id === 'crossTheRoad') return `${gameState?.frogStreak ?? 0}/${CHARM_BONUS.crossTheRoadWords}`;
                      if (buff.id === 'sesameStreet') return gameState?.sesameLetter ? `"${gameState.sesameLetter.letter}"` : '';
                      if (buff.id === 'happyLittleAccidents') return gameState?.happyAccidentLevel === levelFor(totalWords) ? 'used' : 'ready';
                      if (buff.id === 'survivor') return (gameState?.strikes ?? 0) > 0 ? `+${CHARM_BONUS.survivor * gameState.strikes}` : '';
                      const countdown = (gameState?.activePowerPlays as any)?.[buff.id];
                      if (countdown?.words) return `${countdown.words} ${countdown.words === 1 ? 'word' : 'words'}`;
                      if (countdown?.rounds) return `${countdown.rounds} ${countdown.rounds === 1 ? 'round' : 'rounds'}`;
                      if (buff.id === 'groundhogsDay' && (gameState?.groundhogDayCharges ?? 0) > 1) return `×${gameState.groundhogDayCharges}`;
                      return '';
                  };
                  return (
                      <>
                          {buffs.filter(b => !charmIds.has(b.id)).map(buff => {
                              const progress = progressFor(buff);
                              return (
                                  <button key={buff.instanceId || buff.id} onClick={() => showBuffInfo(buff)} className="flex items-center gap-1 bg-neon-cyan/15 ring-1 ring-neon-cyan/50 px-2 py-1 rounded-full text-xs text-white hover:bg-neon-cyan/25 transition-colors" title={buff.name}>
                                      <span className="text-sm">{buff.icon}</span>
                                      <span>{buff.name}{progress ? ` (${progress})` : ''}</span>
                                  </button>
                              );
                          })}
                          {buffs.filter(b => charmIds.has(b.id)).map(buff => {
                              const progress = progressFor(buff);
                              return (
                                  <button key={buff.instanceId || buff.id} onClick={() => showBuffInfo(buff)} className="flex items-center gap-0.5 bg-neon-purple/20 ring-1 ring-neon-purple/50 h-7 min-w-7 px-1.5 rounded-full text-xs text-white hover:bg-neon-purple/35 transition-colors" title={`${buff.name} (charm): tap for details`} aria-label={`Charm: ${buff.name}`}>
                                      <span className="text-sm leading-none">{buff.icon}</span>
                                      {(gameState?.charmUpgrades ?? []).includes(buff.id) && <span className="text-[10px] leading-none" aria-label="upgraded">⭐</span>}
                                      {progress && <span className="osd-text text-sm leading-none text-neon-yellow">{progress}</span>}
                                  </button>
                              );
                          })}
                      </>
                  );
              })()}
            </>
          ) : (
            <span className="text-xs italic text-slate-500">(None Active)</span>
          )}
        </div>
      </div>

      </div>

      {/* --- PLAY AREA (always visible) --- */}
      <div className="relative flex-shrink-0 flex flex-col gap-2 w-full max-w-sm mx-auto">
        {/* Game messages float just above the play area, where the player is looking. */}
        {message && (
          <div className="absolute bottom-full inset-x-0 mb-2 flex justify-center pointer-events-none z-20" role="status" aria-live="polite">
            <div key={message} className="message-pop max-w-full px-3 py-1.5 rounded-lg bg-crt-950/95 ring-1 ring-neon-cyan/60 shadow-glow-cyan osd-text text-xl leading-tight text-neon-cyan text-center whitespace-pre-line">
              {withSec(message ?? '')}
            </div>
          </div>
        )}
        {/* Held PowerPlay (always in reach) + potential score */}
        <div className={`flex-shrink-0 h-8 flex items-center gap-2 ${(gameState?.availablePowerPlays?.length ?? 0) > 0 ? 'justify-between' : 'justify-center'}`}>
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
            {potentialScore > 0 && (
                <div className="shrink-0 bg-crt-950/80 ring-1 ring-neon-yellow/40 px-4 py-0.5 rounded-full">
                    <span className="font-osd text-3xl leading-none text-neon-yellow drop-shadow-glow-yellow animate-fade-in">
                        {potentialScore}
                    </span>
                    <span className="osd-text text-base text-neon-yellow/80 ml-1">PTS</span>
                </div>
            )}
        </div>

        {/* Build Row: slots share the width so all eight fit on any phone */}
        <div className="flex-shrink-0 w-full">
          <div className="grid gap-1 sm:gap-1.5" style={{ gridTemplateColumns: `repeat(${BUILD_ROW_SIZE}, minmax(0, 1fr))` }}>
              {Array.from({ length: BUILD_ROW_SIZE }).map((_, index) => {
                  const item = (buildRow ?? [])[index];
                  const isFifthSlot = index === 4;
                  const isLongWordBonusActive = (buildRow?.filter(i => i).length ?? 0) >= 5;
                  return (
                    <div
                      key={index}
                      className={`relative w-full aspect-[5/6] rounded-lg bg-crt-950/60 ring-1 ring-white/5 flex items-center justify-center
                        ${isFifthSlot && isLongWordBonusActive ? 'ring-2 ring-yellow-400' : ''}
                      `}
                    >
                      {item && (
                        <div className="w-full h-full">
                          <TileComponent tile={item.tile} onClick={() => handleReturnToHand(index)} packTileClass={tileClass} isGolden={item.tile.id === gameState?.goldenTileId} skillShot={item.tile.id === skillShotTileId ? skillShotPrize : undefined} />
                        </div>
                      )}
                    </div>
                  );
              })}
          </div>
        </div>

        {(holdOpen || gameState?.route || setChip) && (
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
            {gameState?.route && <DangerChip route={gameState.route} clock={time} onBail={handleForkBail} />}
            {setChip}
          </div>
        )}

        {(skillShotTileId || ((gameState?.headStart ?? 0) > 0 && totalWords === 0)) && (
          <div className="flex flex-wrap justify-center gap-1">
            {(gameState?.headStart ?? 0) > 0 && totalWords === 0 && (
              <span className="flex items-center gap-1 rounded-full bg-crt-950/80 ring-1 ring-neon-green/60 px-2 py-0.5 text-xs text-white whitespace-nowrap" aria-label={`Head Start: ${gameState.headStart} extra seconds on the clock this run`}>
                <span aria-hidden="true">🛠️</span>HEAD START +{gameState.headStart}<Sec />
              </span>
            )}
            {skillShotTileId && (
              <span className="flex items-center gap-1 rounded-full bg-neon-pink/15 ring-1 ring-neon-pink px-2.5 py-1 text-xs font-semibold text-white whitespace-nowrap" aria-label={`Skill Shot: use the lit tile in your next word for ${skillShotPrize} points`}>
                <span aria-hidden="true">🎯</span>SKILL SHOT: USE THE <span className="text-neon-pink">+{skillShotPrize} TILE</span> IN YOUR NEXT WORD
              </span>
            )}
          </div>
        )}

        {powerHint && (
          <div className="flex justify-center">
            {/* v7.61.0: the chip names the prize; a tap lights the word's tiles (in no order). */}
            <button type="button" onClick={() => { if (powerLitWord === powerHint.word) handlePowerHintInfo?.(); else setPowerLitWord(powerHint.word ?? ''); }}
              aria-label={`Hint: a ${powerHint.length}-letter power word is hiding in this hand. Prize: ${powerPrize}. ${powerLit ? 'Its tiles are lit. Tap for more.' : 'Tap to light its tiles.'}`}
              data-testid="power-hint"
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 osd-text text-lg leading-none whitespace-nowrap ring-1 ring-neon-yellow bg-neon-yellow/15 text-neon-yellow shadow-[0_0_12px_rgba(255,226,122,0.45)] hover:bg-neon-yellow/25 max-w-full overflow-hidden ${powerLit ? '' : 'animate-pulse'}`}>
              <span aria-hidden="true">⚡{powerHint.icon}</span>
              <span className="truncate">{powerLit ? `SPELL ${powerHint.length} LETTERS WITH THE LIT TILES` : `POWER WORD: ${powerPrize} · TAP`}</span>
            </button>
          </div>
        )}

        <PowerPlayTrackers gameState={gameState} upcomingTiles={upcomingTiles} quizLeft={quizLeft} raceRival={raceRival} onStand={() => dispatch({ type: 'BLACKJACK_STAND' })} />

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
                  <div key={item?.id || originalIndex} className="w-full h-12 min-[375px]:h-14 sm:h-16 flex items-center justify-center">
                    {item ? <TileComponent tile={item} onClick={() => handleMoveToBuild(item, originalIndex)} packTileClass={tileClass} isGolden={item.id === gameState?.goldenTileId} skillShot={item.id === skillShotTileId ? skillShotPrize : undefined} powerLit={powerLitIds.has(item.id)} hintOrder={hintOrder} bossHint={bossTileHint(item)} faceDown={blind && !peeking} /> : <div className="w-full h-full rounded-lg bg-crt-950/60 ring-1 ring-white/5"></div>}
                  </div>
                );
              })}
            </div>
          );
        })()}
        
        {/* --- ACTION BUTTONS --- */}
        <div className="grid grid-cols-2 gap-x-2 gap-y-3 pb-1">
          <ArcadeButton
            color="yellow"
            onClick={handleSubmit}
            disabled={(wordFromBuildRow?.length ?? 0) < (gameState?.gameConfig?.minWordLength ?? 3) || isLoading || isPaused}
          >
            Submit
          </ArcadeButton>
          <ShuffleButton
            count={gameState?.shuffleCount ?? 0}
            seconds={GAMEPLAY.timeBank.shuffleTimeBonus}
            disabled={(gameState?.shuffleCount ?? 0) <= 0 || isPaused || isChallengeLock || isLoading || (gameState?.roundType === 'golden')}
            lowTime={gameState?.roundType !== 'golden' && (time ?? 0) <= GAMEPLAY.timeBank.lifelineHintBelow}
            timerRef={timerRef}
            onShuffle={() => handleShuffle(false)}
          />
          <ArcadeButton
            color="slate"
            onClick={handleClear}
            disabled={(buildRow ?? []).every(i => i === null) || isChallengeLock || isLoading || isPaused}
          >
            Clear
          </ArcadeButton>
          <ArcadeButton
            color={isStrikeChallenge ? 'red' : 'green'}
            onClick={handleChallenge}
            disabled={(isStrikeChallenge ? strikesRemaining <= 0 : (gameState?.challengeCount ?? 0) <= 0) || (buildRow ?? []).some(t => t !== null) || isPaused || isChallengeLock || isLoading || (gameState?.roundType === 'golden')}
          >
            {challengeButtonText}
          </ArcadeButton>
        </div>
      </div>

    </div>
  );
};
