import React, { useEffect, useRef, useState } from 'react';
import ArcadeButton from '../../components/ArcadeButton';
import ShuffleButton from '../../components/ShuffleButton';
import BonusReveal from '../../components/BonusReveal';
import SlotMachine from '../../components/SlotMachine';
import { PowerPlayOffer, CharmOffer } from '../../components/OfferModals';
import { PRIZE_POWER_PLAY_IDS, POWER_PLAYS_LIST } from '../../data/powerPlays';
import { GameState, Tile, WordData, Milestone, Charm, PowerPlay } from '../../types';
import Timer from '../../components/Timer';
import TileComponent from '../../components/Tile';
import EventLogDisplay from '../../components/EventLogDisplay';
import { MILESTONES_LIST } from '../../data/milestones';
import DurationBadge from '../../ui/DurationBadge';
import { RACK_SIZE, HAND_SIZE } from '../../constants';
import { GAMEPLAY, CHARM_SLOTS, CHARM_UPGRADE, TIME_BONUS, BOSS, CHARM_BONUS } from '../../config/gameplay';
import { bossById } from '../../data/bosses';
import { levelFor, snitchTargetFor, meterLettersFor, levelTierFor, bossHitsToWin, prizeScaleFor } from '../rules';
import LevelBadge from '../../components/LevelBadge';
import LevelUpCard from '../../components/LevelUpCard';
import OutcomeCard from '../../components/OutcomeCard';
import GambleCard, { type GambleResult } from '../../components/GambleCard';
import PowerPlayTrackers from '../../components/PowerPlayTrackers';
import { POWER_PLAY_VALUES } from '../../config/gameplay';

export type ModalContent = {
  type: 'milestone' | 'charm-selection' | 'powerplay-selection' | 'word-log' | 'info' | 'powerplay-activation' | 'word-bonus' | 'charm-activation' | 'buff-info' | 'easter-egg' | 'super-hand' | 'save-confirmation' | 'game-over-summary' | 'milestone-info' | 'event-log' | 'slot-machine' | 'level-up' | 'outcome' | 'gamble';
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
  /** Psychic Friends Network: the next tiles in the bag, in draw order. */
  upcomingTiles?: string[];
  /** Real seconds left on a running Pop Quiz (undefined when none). */
  quizLeft?: number;
  /** Smell Ya Later!: the rival's live score (undefined when no race). */
  raceRival?: number;
  timeGain?: { seconds: number; key: number; taxed?: boolean };
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
  handleActivatePowerPlay: (powerPlay: PowerPlay) => void;
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
    gameState, time, resumeCountdown = 0, handleResolveGamble, upcomingTiles, quizLeft, raceRival, timeGain, message, hand, buildRow, isPaused, isLoading, modalContent, tilesToSwap,
    tileToTransform, tileForSelection, wordFromBuildRow, totalWords, potentialScore, maxStrikes, challengeButtonText,
    tileClass, isMuted, isChallengeLock, highlightedTileIds, isStrikeChallenge, strikesRemaining,
    handleMuteToggle, handleCloseModal, handlePhoneAFriend, handleShowMilestoneInfo, handleShowEventLog,
    handleMoveToBuild, handleReturnToHand, handleShuffle, handleSubmit, handleClear,
    handleChallenge, handleSaveClick, handleConfirmSave, showBuffInfo,
    handleActivatePowerPlay, handleActivateCharm, handleChoosePowerPlay, handleChooseCharm, handlePassCharm, handleUpgradeCharm, handleKeepPowerPlay,
    handleAddTileToSwap, handleRemoveTileFromSwap, handleExecuteSwap, dispatch
}) => {
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
    // The Golden Tile's letter, wherever it sits (rack or word row), for the Golden Round banner.
    const goldenLetter = gameState?.goldenTileId
      ? [...(hand ?? []), ...(buildRow ?? []).map(i => i?.tile)].find(t => t?.id === gameState.goldenTileId)?.letter
      : undefined;

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
                        <h2 className="font-display text-2xl text-neon-yellow drop-shadow-glow-yellow mb-2 text-center">{cardTitle}</h2>
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
                           {(gameState?.charmUpgrades ?? []).includes(buff.id) && (gameState?.activeCharms ?? []).some(c => c.id === buff.id) && (
                               <p className="osd-text text-lg text-neon-yellow text-center mb-2">⭐ UPGRADED: ITS POINT BONUSES PAY {CHARM_UPGRADE.percent}% MORE</p>
                           )}
                           {buff.id === 'multiplicity' && (
                               <p className="osd-text text-lg text-neon-pink text-center mb-2">{copyTarget ? `👯 TAP TO TURN IT INTO ${copyTarget.icon} ${copyTarget.name.toUpperCase()}` : '👯 NOTHING TO COPY YET: USE A POWERPLAY FIRST'}</p>
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
      {/* Resumed run: the board stays hidden (no free look at the tiles) until the 3-2-1 ends. */}
      {resumeCountdown > 0 && (
        <div className="absolute inset-0 z-[70] bg-crt-950 flex flex-col items-center justify-center gap-3 text-center" role="status" aria-live="assertive" aria-label={`Run restored. Resuming in ${resumeCountdown}`}>
          <p className="osd-text text-2xl tracking-[0.3em] text-neon-green">RUN RESTORED</p>
          <p key={resumeCountdown} className="font-osd text-9xl leading-none neon-text-cyan level-stage-in">{resumeCountdown}</p>
          <p className="osd-text text-lg text-slate-400">{time}s on the clock · get ready</p>
        </div>
      )}
      
      {/* --- TOP BAR --- */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center flex-shrink-0 text-white gap-2">
        {/* Score & Words Display */}
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
                {timeGain.seconds > 0 ? '+' : '−'}{Math.abs(timeGain.seconds)}s{timeGain.taxed && <span className="text-neon-yellow text-lg"> ½</span>}
              </span>
            )}
          </div>
          {gameState?.daily && (
            <p className={`osd-text text-sm leading-none mt-0.5 ${gameState.daily.practice ? 'text-slate-400' : 'text-neon-cyan'}`} aria-label={gameState.daily.practice ? `Daily Run ${gameState.daily.number}, practice` : `Daily Run ${gameState.daily.number}`}>
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
            {(gameState.freezeLeft ?? 0) > 0 ? `❄️ CLOCK FROZEN · ${gameState.freezeLeft}s` : `🦥 SLOW MOTION · ${gameState.slowWords} ${gameState.slowWords === 1 ? 'WORD' : 'WORDS'} LEFT`}
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
            TILES 2X · <span className="text-crt-900 font-bold">★ GOLDEN {goldenLetter ?? 'TILE'} = 6X</span> · NO STRIKES
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
          <button onClick={handleMuteToggle} className="text-2xl transition-transform hover:scale-110" title="Toggle Sound">{isMuted ? '🔇' : '🔊'}</button>
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
              <div className={cell} aria-label={`Golden Round streak ${gameState?.consecutiveValidWords ?? 0} of ${gameState?.goldenRoundThreshold ?? 11}`}>
                <span className={label}>★ Golden</span>
                <span className="font-osd text-lg leading-none text-neon-yellow tabular-nums">{gameState?.consecutiveValidWords ?? 0}/{gameState?.goldenRoundThreshold ?? 11}</span>
              </div>
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
              {message}
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
                          <TileComponent tile={item.tile} onClick={() => handleReturnToHand(index)} packTileClass={tileClass} isGolden={item.tile.id === gameState?.goldenTileId} />
                        </div>
                      )}
                    </div>
                  );
              })}
          </div>
        </div>

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
                    {item ? <TileComponent tile={item} onClick={() => handleMoveToBuild(item, originalIndex)} packTileClass={tileClass} isGolden={item.id === gameState?.goldenTileId} hintOrder={hintOrder} bossHint={bossTileHint(item)} faceDown={blind && !peeking} /> : <div className="w-full h-full rounded-lg bg-crt-950/60 ring-1 ring-white/5"></div>}
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
