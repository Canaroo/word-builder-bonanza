import React from 'react';
import ArcadeButton from '../../components/ArcadeButton';
import BonusReveal from '../../components/BonusReveal';
import { PowerPlayOffer, CharmOffer } from '../../components/OfferModals';
import { GameState, Tile, WordData, Milestone, Charm, PowerPlay } from '../../types';
import Timer from '../../components/Timer';
import TileComponent from '../../components/Tile';
import PowerSurgeMeter from '../../components/PowerSurgeMeter';
import EventLogDisplay from '../../components/EventLogDisplay';
import { MILESTONES_LIST } from '../../data/milestones';
import DurationBadge from '../../ui/DurationBadge';
import { RACK_SIZE, HAND_SIZE } from '../../constants';
import { GAMEPLAY, CHARM_SLOTS } from '../../config/gameplay';

export type ModalContent = {
  type: 'milestone' | 'charm-selection' | 'powerplay-selection' | 'word-log' | 'info' | 'powerplay-activation' | 'word-bonus' | 'charm-activation' | 'buff-info' | 'easter-egg' | 'super-hand' | 'save-confirmation' | 'game-over-summary' | 'milestone-info' | 'event-log';
  title: string;
  content?: React.ReactNode;
  data?: any;
  autoClose?: number;
} | null;

const BUILD_ROW_SIZE = 8;

export interface GameScreenViewProps {
  gameState: GameState;
  time: number;
  timeGain?: { seconds: number; key: number };
  /** Short game feedback (PowerPlay results, combos, hints). Empty when nothing to say. */
  message?: string;
  hand: (Tile | null)[];
  buildRow: ({tile: Tile, originalIndex: number} | null)[];
  isPaused: boolean;
  isLoading: boolean;
  modalContent: ModalContent;
  tilesToSwap: { tile: Tile, originalIndex: number }[];
  tileToTransform: { tile: Tile, originalIndex: number } | null;
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
  handleKeepPowerPlay: (allOffered: PowerPlay[]) => void;
  handleAddTileToSwap: (tile: Tile, originalIndex: number) => void;
  handleRemoveTileFromSwap: (originalIndex: number) => void;
  handleExecuteSwap: () => void;
  dispatch: React.Dispatch<any>;
}

export const GameScreenView: React.FC<GameScreenViewProps> = ({
    gameState, time, timeGain, message, hand, buildRow, isPaused, isLoading, modalContent, tilesToSwap,
    tileToTransform, wordFromBuildRow, totalWords, potentialScore, maxStrikes, challengeButtonText,
    tileClass, isMuted, isChallengeLock, highlightedTileIds, isStrikeChallenge, strikesRemaining,
    handleMuteToggle, handleCloseModal, handleShowMilestoneInfo, handleShowEventLog,
    handleMoveToBuild, handleReturnToHand, handleShuffle, handleSubmit, handleClear,
    handleChallenge, handleSaveClick, handleConfirmSave, showBuffInfo,
    handleActivatePowerPlay, handleActivateCharm, handleChoosePowerPlay, handleChooseCharm, handlePassCharm, handleKeepPowerPlay,
    handleAddTileToSwap, handleRemoveTileFromSwap, handleExecuteSwap, dispatch
}) => {

    const renderModal = () => {
        if (!modalContent) return null;

        const { type, title, content, data } = modalContent;
        const modalBaseClass = "absolute inset-0 bg-crt-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in";
        const modalBoxBaseClass = "bg-crt-900 border-2 rounded-2xl p-6 shadow-2xl max-w-md w-full flex flex-col max-h-[90vh]";

        // Title, text and an optional points line: used by info, word-bonus and game-over pop-ups.
        function renderPlainCard(cardTitle: string, cardContent: React.ReactNode, cardData: any) {
            return (
                <div className={modalBaseClass}>
                    <div className={`${modalBoxBaseClass} border-neon-yellow shadow-glow-yellow bonus-insert`}>
                        <h2 className="font-display text-2xl text-neon-yellow drop-shadow-glow-yellow mb-2 text-center">{cardTitle}</h2>
                        <div className="text-slate-200 text-center my-4 whitespace-pre-line">{cardContent}</div>
                        {cardData && (cardData.reward?.points || cardData.gauntletBonus) ? (
                            <div className="font-display text-neon-green text-3xl my-4 text-center">
                                {cardData.reward?.points ? `+${cardData.reward.points}` : null}
                                {cardData.gauntletBonus ? `+${cardData.gauntletBonus}` : null}
                            </div>
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

            case 'super-hand':
                return (
                    <div className="absolute inset-0 bg-black/60 flex items-start justify-center pt-20 z-50 p-4 animate-fade-in">
                        <div className={`${modalBoxBaseClass} border-amber-400 max-w-md`}>
                            <h2 className="text-3xl font-bold text-amber-400 mb-4 text-center">{title}</h2>
                            <div className="text-slate-200 text-center my-4">{content}</div>
                            {data && data.gauntletBonus > 0 && (
                                <div className="text-green-400 font-bold text-xl my-2 text-center">
                                    {`+${data.gauntletBonus} Infinity Gauntlet bonus!`}
                                </div>
                            )}
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
                           <p className="text-slate-200 text-center my-4">Save your current game state and return to the main menu? You can resume later.</p>
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
                
                    const buttonText = min > 0
                      ? `Confirm (${(tilesToSwap?.length ?? 0)}/${min}-${max})`
                      : `Confirm (${(tilesToSwap?.length ?? 0)}/${max})`;

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
                                                <div className={`relative ${tilesToSwap?.some(t => t.originalIndex === index) ? 'ring-4 ring-green-400 rounded-lg' : ''}`}>
                                                    <TileComponent tile={tile} onClick={() => tilesToSwap?.some(t => t.originalIndex === index) ? handleRemoveTileFromSwap(index) : handleAddTileToSwap(tile, index)} packTileClass={tileClass} />
                                                </div>
                                            ) : <div className="w-full h-full bg-slate-900 rounded-lg" />}
                                        </div>
                                    ))}
                                </div>
                                <button 
                                    onClick={() => {
                                        dispatch({ type: 'COMPLETE_POWER_PLAY_ACTIVATION', payload: { powerPlay, option: { tilesToDiscard: tilesToSwap } } })
                                    }} 
                                    disabled={!canExecute} 
                                    className="w-full mt-auto px-6 py-3 text-xl font-bold text-slate-900 bg-green-500 rounded-lg shadow-lg hover:bg-green-400 disabled:bg-slate-500 disabled:cursor-not-allowed">
                                    {buttonText}
                                </button>
                                <button onClick={handleCloseModal} className="w-full mt-2 text-sm text-slate-400 hover:text-white">Cancel</button>
                            </div>
                        </div>
                    );
                }

                if (powerPlay.selectionType === 'letter') {
                    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
                    const handleLetterSelect = (letter: string) => {
                        dispatch({ type: 'COMPLETE_POWER_PLAY_ACTIVATION', payload: { powerPlay, option: { letter } } });
                    };
                
                    return (
                        <div className={modalBaseClass}>
                            <div className={`${modalBoxBaseClass} border-green-400`}>
                                <h2 className="text-3xl font-bold text-green-400 mb-2 text-center">{title}</h2>
                                <p className="text-slate-300 text-center mb-4">{powerPlay.description}</p>
                                <div className="grid grid-cols-6 gap-2 my-4">
                                    {alphabet.map(letter => (
                                        <button 
                                            key={letter} 
                                            onClick={() => handleLetterSelect(letter)}
                                            className="w-full h-12 text-xl font-bold text-slate-100 bg-slate-700 rounded-lg shadow-lg hover:bg-slate-600 transition-colors"
                                        >
                                            {letter}
                                        </button>
                                    ))}
                                </div>
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
                                                <div className={`relative ${(tilesToSwap ?? []).some(t => t.originalIndex === index) ? 'ring-4 ring-green-400 rounded-lg' : ''}`}>
                                                    <TileComponent tile={tile} onClick={() => (tilesToSwap ?? []).some(t => t.originalIndex === index) ? handleRemoveTileFromSwap(index) : handleAddTileToSwap(tile, index)} packTileClass={tileClass} />
                                                </div>
                                            ) : <div className="w-full h-full bg-slate-900 rounded-lg" />}
                                        </div>
                                    ))}
                                </div>
                                <button onClick={handleExecuteSwap} disabled={!canExecute} className="w-full mt-auto px-6 py-3 text-xl font-bold text-slate-900 bg-green-500 rounded-lg shadow-lg hover:bg-green-400 disabled:bg-slate-500 disabled:cursor-not-allowed">
                                    Confirm Swap ({(tilesToSwap?.length ?? 0)}/{max})
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
                                        Blue Pill: Freeze time for 10s
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
                    const handlePhoneAFriend = async () => {
                        // This logic is now in the container, the view just calls dispatch
                        dispatch({ type: 'COMPLETE_POWER_PLAY_ACTIVATION', payload: { powerPlay, option: { choice: 'phone' } } });
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
                                    <button onClick={handlePhoneAFriend} className="w-full px-4 py-3 text-lg font-bold text-slate-900 bg-cyan-400 rounded-lg shadow-lg hover:bg-cyan-300">
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
                    const canExecute = modalContent?.data?.tileForSelection !== null;
                    return (
                         <div className={modalBaseClass}>
                            <div className={`${modalBoxBaseClass} border-green-400`}>
                                <h2 className="text-3xl font-bold text-green-400 mb-4 text-center">{title}</h2>
                                <p className="text-slate-300 text-center mb-4">{powerPlay.description}</p>
                                <div className="grid grid-cols-5 gap-2 my-4">
                                    {(hand ?? []).map((tile, index) => (
                                        <div key={tile?.id || index} className="w-full h-16">
                                            {tile ? (
                                                <div className={`relative ${modalContent?.data?.tileForSelection?.originalIndex === index ? 'ring-4 ring-green-400 rounded-lg' : ''}`}>
                                                    <TileComponent tile={tile} onClick={() => dispatch({ type: 'SELECT_TILE_FOR_SELECTION', payload: { tile, originalIndex: index } })} packTileClass={tileClass} />
                                                </div>
                                            ) : <div className="w-full h-full bg-slate-900 rounded-lg" />}
                                        </div>
                                    ))}
                                </div>
                                <button 
                                    onClick={() => dispatch({ type: 'COMPLETE_POWER_PLAY_ACTIVATION', payload: { powerPlay }})} 
                                    disabled={!canExecute} 
                                    className="w-full mt-auto px-6 py-3 text-xl font-bold text-slate-900 bg-green-500 rounded-lg shadow-lg hover:bg-green-400 disabled:bg-slate-500 disabled:cursor-not-allowed">
                                    Confirm Selection
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
                                        <p className="text-amber-300 font-semibold text-center my-2">Now, select the letter you want to change it to:</p>
                                        <div className="grid grid-cols-6 gap-2 my-4">
                                            {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(letter => (
                                                <button 
                                                    key={letter} 
                                                    onClick={() => handleLetterSelect(letter)}
                                                    className="w-full h-12 text-xl font-bold text-slate-100 bg-slate-700 rounded-lg shadow-lg hover:bg-slate-600 transition-colors"
                                                >
                                                    {letter}
                                                </button>
                                            ))}
                                        </div>
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
          <div className="relative">
            <Timer time={time ?? 0} golden={gameState?.roundType === 'golden'} />
            {timeGain && timeGain.seconds !== 0 && (
              <span
                key={timeGain.key}
                className={`time-gain absolute left-1/2 -bottom-5 font-osd text-2xl leading-none pointer-events-none ${timeGain.seconds > 0 ? 'text-neon-green' : 'text-neon-red'}`}
                aria-live="polite"
              >
                {timeGain.seconds > 0 ? '+' : '−'}{Math.abs(timeGain.seconds)}s
              </span>
            )}
          </div>
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

      {gameState?.roundType === 'golden' && (
        <div className="golden-banner flex-shrink-0 rounded-lg px-3 py-1.5 text-center" role="status">
          <div className="font-display text-lg leading-none text-crt-900">★ GOLDEN ROUND ★</div>
          <div className="osd-text text-base leading-tight text-crt-900/80">TILES 2X · GOLDEN TILE 6X · NO STRIKES</div>
        </div>
      )}

      {/* --- STATUS AREA --- */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain flex flex-col gap-1.5">
      {/* --- ICONS BAR --- */}
      <div className="flex justify-between items-center bg-crt-950/60 ring-1 ring-white/5 p-1 rounded-lg flex-shrink-0">
        <div className="flex gap-2 sm:gap-3">
          {MILESTONES_LIST.map(m => (
            <button key={m.id} onClick={() => handleShowMilestoneInfo(m)} disabled={!(gameState?.unlockedMilestoneIds ?? []).includes(m.id)} className="text-2xl transition-opacity disabled:opacity-30 enabled:hover:scale-110" title={m.name}>
              {m.icon}
            </button>
          ))}
        </div>
        <div className="flex gap-3">
          <button onClick={handleShowEventLog} className="text-2xl transition-transform hover:scale-110" title="Event Log">📖</button>
          <button onClick={handleMuteToggle} className="text-2xl transition-transform hover:scale-110" title="Toggle Sound">{isMuted ? '🔇' : '🔊'}</button>
        </div>
      </div>

      {/* --- PROGRESS INDICATORS --- */}
      <div className="flex gap-2 w-full flex-shrink-0">
        {(gameState?.roundType ?? 'normal') === 'normal' && (
          <div className="text-center flex-1">
            <h3 className="osd-text text-base leading-none text-neon-cyan/80 uppercase tracking-widest mb-1">
              Golden Round
            </h3>
            <div className="bg-crt-950/60 ring-1 ring-white/5 p-1 rounded-lg flex justify-center items-center h-10">
              <span className="text-sm font-bold text-white drop-shadow-md">
                Streak: <span className="font-osd text-lg text-neon-yellow">{(gameState?.consecutiveValidWords ?? 0)} / {(gameState?.goldenRoundThreshold ?? 11)}</span>
              </span>
            </div>
          </div>
        )}

        <div className="text-center flex-1">
          <h3 className="osd-text text-base leading-none text-neon-cyan/80 uppercase tracking-widest mb-1">
            PowerPlay
          </h3>
          {(() => {
            // PowerPlay meter: fills from letters played (config/gameplay.ts).
            const letters = gameState?.powerPlayProgress?.letters ?? 0;
            const full = letters >= GAMEPLAY.powerPlayMeterLetters;
            const pct = Math.min(100, (letters / GAMEPLAY.powerPlayMeterLetters) * 100);
            return (
              <div className="bg-crt-950/60 ring-1 ring-white/5 px-2 rounded-lg h-10 flex items-center gap-2" aria-label={`PowerPlay meter ${letters} of ${GAMEPLAY.powerPlayMeterLetters} letters`}>
                <div className="flex-1 h-2.5 rounded-full bg-crt-600 overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-500 ${full ? 'bg-neon-green shadow-glow-cyan animate-pulse' : 'bg-neon-purple'}`} style={{ width: `${pct}%` }} />
                </div>
                <span className="font-osd text-lg leading-none text-slate-200 tabular-nums">{letters}/{GAMEPLAY.powerPlayMeterLetters}</span>
              </div>
            );
          })()}
        </div>

        {(gameState?.perfectChainProgress ?? 0) > 0 && (
            <div className="text-center flex-1">
                <h3 className="osd-text text-base leading-none text-neon-cyan/80 uppercase tracking-widest mb-1">
                    4-Letter Chain
                </h3>
                <div className="bg-crt-950/60 ring-1 ring-white/5 p-1 rounded-lg flex justify-center items-center h-10">
                    <span className="text-2xl tracking-wider animate-pulse">
                        {'4️⃣'.repeat(gameState.perfectChainProgress)}
                    </span>
                </div>
            </div>
        )}
      </div>
      
      {/* --- WORD COMBO METER --- */}
      <div className="flex-shrink-0">
        <PowerSurgeMeter progress={gameState?.powerSurgeProgress ?? 0} />
      </div>

      {/* --- ACTIVE BUFFS TRAY --- */}
      <div className="text-center w-full flex-shrink-0">
        <h3 className="osd-text text-base leading-none text-neon-cyan/80 uppercase tracking-widest mb-1">
          Active Buffs <span className="text-neon-purple">· Charms {(gameState?.activeCharms?.length ?? 0)}/{CHARM_SLOTS}</span>
        </h3>
        <div className="min-h-[2rem] bg-crt-950/60 ring-1 ring-white/5 p-0.5 rounded-lg flex flex-wrap justify-center items-center gap-1">
          {(gameState?.activeBuffs?.length ?? 0) > 0 ? (
            <>
              {(() => {
                  const charmIds = new Set((gameState?.activeCharms ?? []).map(c => c.id));
                  const buffs = gameState?.activeBuffs ?? [];
                  // Running PowerPlay effects get their name (and what's left); charms are compact icons.
                  const progressFor = (buff: Charm | PowerPlay): string => {
                      if (buff.id === 'goldenSnitch') return `${gameState?.consecutiveSuccesses ?? 0}/5`;
                      if (buff.id === 'drMariosCure') return `${gameState?.drMarioCureStreak ?? 0}/3`;
                      if (buff.id === 'thrillerNight') return `${totalWords % 4}/4`;
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
                <button key={pp.id} onClick={() => handleActivatePowerPlay(pp)} className="min-w-0 flex items-center gap-1 bg-neon-green text-crt-900 font-semibold pl-2 pr-3 h-8 rounded-full text-sm hover:brightness-110 transition ring-2 ring-neon-green/40 shadow-[0_0_12px_rgba(61,255,140,0.45)]" title={`Tap to use ${pp.name}`} aria-label={`Use PowerPlay: ${pp.name}`}>
                    <span className="text-base leading-none">{pp.icon}</span>
                    <span className="osd-text text-lg leading-none shrink-0">▶ USE</span>
                    <span className="truncate">{pp.name}</span>
                </button>
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
                          <TileComponent tile={item.tile} onClick={() => handleReturnToHand(index)} packTileClass={tileClass} />
                        </div>
                      )}
                    </div>
                  );
              })}
          </div>
        </div>

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
                    {item ? <TileComponent tile={item} onClick={() => handleMoveToBuild(item, originalIndex)} packTileClass={tileClass} isGolden={item.id === gameState?.goldenTileId} hintOrder={hintOrder} /> : <div className="w-full h-full rounded-lg bg-crt-950/60 ring-1 ring-white/5"></div>}
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
          <ArcadeButton
            color="cyan"
            onClick={() => handleShuffle(false)}
            disabled={(gameState?.shuffleCount ?? 0) <= 0 || isPaused || isChallengeLock || isLoading || (gameState?.roundType === 'golden')}
          >
            Shuffle ({(gameState?.shuffleCount ?? 0)})
          </ArcadeButton>
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
