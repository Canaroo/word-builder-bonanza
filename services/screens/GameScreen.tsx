

import React, { useReducer, useEffect, useCallback, useMemo, useState } from 'react';
import { GameState, Tile, WordData, Milestone, Charm, PowerPlay, ScoreCalculationResult, EasterEgg, ScoreBonusInfo } from '../../types';
import { RACK_SIZE, BALANCE_REPLACE_COUNT, VOWELS, REPLENISH_DIVISOR, INITIAL_SHUFFLES, MAX_STRIKES_INITIAL, SUPER_HAND_BONUS, TILE_DISTRIBUTION, INITIAL_CHALLENGES, BASE_RACK_SIZE } from '../../constants';
import * as gameUtils from '../gameUtils';
import Timer from '../../components/Timer';
import TileComponent from '../../components/Tile';
import { MILESTONES_LIST } from '../../data/milestones';
import { CHARMS_LIST } from '../../data/charms';
import { POWER_PLAYS_LIST } from '../../data/powerPlays';
import { EASTER_EGGS } from '../../data/easterEggs';
import { WORD_BONUSES } from '../../data/wordBonuses';
import { soundService } from '../soundService';
import { dictionaryService } from '../dictionaryService';
import { geminiService } from '../geminiService';
import { internalWords } from '../../data/internalWords';


interface GameScreenProps {
  playerName: string;
  onGameOver: (gameState: GameState) => void;
  onSaveGame: (state: GameScreenState) => void;
  isResuming: boolean;
  onTimeLow: (isLow: boolean) => void;
}

type ModalContent = {
  type: 'milestone' | 'charm-selection' | 'powerplay-selection' | 'word-log' | 'info' | 'powerplay-activation' | 'word-bonus' | 'charm-activation' | 'buff-info' | 'easter-egg' | 'super-hand' | 'save-confirmation';
  title: string;
  content?: React.ReactNode;
  data?: any;
} | null;

const WordLogModalContent: React.FC<{ words: WordData[] }> = ({ words }) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const WORDS_PER_PAGE = 3;
  const reversedWords = [...words].reverse();
  const totalPages = Math.ceil(reversedWords.length / WORDS_PER_PAGE);

  const wordsForPage = reversedWords.slice(
    currentPage * WORDS_PER_PAGE,
    (currentPage + 1) * WORDS_PER_PAGE
  );

  const handleNextPage = () => {
    if (currentPage < totalPages - 1) {
      soundService.playUIClick();
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 0) {
      soundService.playUIClick();
      setCurrentPage(currentPage - 1);
    }
  };

  const minSwipeDistance = 50;

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      handleNextPage();
    } else if (isRightSwipe) {
      handlePrevPage();
    }
    setTouchStart(null);
    setTouchEnd(null);
  };

  if (words.length === 0) {
    return (
      <div className="text-left my-4 h-[35vh] flex items-center justify-center bg-slate-900/50 p-3 rounded-lg">
        <p className="text-slate-400 text-center">No words yet!</p>
      </div>
    );
  }

  return (
    <>
      <div 
        className="text-left space-y-2 my-4 bg-slate-900/50 p-3 rounded-lg"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {wordsForPage.length > 0 ? (
          wordsForPage.map((wd, i) => (
            <div key={i} className="text-slate-200 py-2 border-b border-slate-700/50 last:border-b-0">
              {wd.status === 'valid' ? (
                <>
                  <div className="flex justify-between items-baseline">
                    <span className="font-bold text-lg text-white flex-grow pr-4">{wd.word.toUpperCase()}</span>
                    <div className="text-right flex-shrink-0">
                      <span className="font-semibold text-xl text-cyan-400">+{wd.score}</span>
                      {wd.cumulativeScore !== undefined && (
                          <span className="block text-xs text-amber-400 font-digital">Total: {wd.cumulativeScore}</span>
                      )}
                    </div>
                  </div>
                  {wd.definition && <p className="text-sm text-slate-400 italic my-1">{wd.definition}</p>}
                  
                  {wd.bonuses && wd.bonuses.length > 0 && (
                      <div className="mt-1.5 text-xs bg-slate-800/60 p-2 rounded">
                          <h4 className="font-bold text-slate-300 mb-1">Score Breakdown:</h4>
                          <div className="space-y-0.5">
                            {wd.baseScore !== undefined && (
                                <div className="flex justify-between leading-tight">
                                    <span className="text-slate-400">Base Score</span>
                                    <span className="font-semibold text-slate-200">{wd.baseScore} pts</span>
                                </div>
                            )}
                            {wd.bonuses.map((bonus, bIndex) => (
                                <div key={bIndex} className="flex justify-between leading-tight">
                                    <span className="text-slate-400">{bonus.name}</span>
                                    <span className="font-semibold text-slate-200">{bonus.description}</span>
                                </div>
                            ))}
                          </div>
                      </div>
                  )}
                </>
              ) : (
                <div className="flex justify-between items-baseline opacity-60">
                  <span className="font-bold text-lg text-red-400 line-through">{wd.word.toUpperCase()}</span>
                  <span className="font-semibold text-red-500">Invalid</span>
                </div>
              )}
            </div>
          ))
        ) : <p className="text-slate-400 text-center m-auto h-[35vh] flex items-center justify-center">No words yet!</p>}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-3">
          <button onClick={handlePrevPage} disabled={currentPage === 0} className="px-4 py-2 font-bold text-slate-100 bg-slate-600 rounded-lg shadow-lg hover:bg-slate-500 disabled:opacity-50 disabled:cursor-not-allowed">
            &larr; Prev
          </button>
          <span className="font-digital text-slate-300">
            {currentPage + 1} / {totalPages}
          </span>
          <button onClick={handleNextPage} disabled={currentPage >= totalPages - 1} className="px-4 py-2 font-bold text-slate-100 bg-slate-600 rounded-lg shadow-lg hover:bg-slate-500 disabled:opacity-50 disabled:cursor-not-allowed">
            Next &rarr;
          </button>
        </div>
      )}
    </>
  );
};


const BUILD_ROW_SIZE = 8;

const initialGameState: GameState = {
  score: 0,
  words: [],
  longestWord: '',
  foundEasterEggs: [],
  gameConfig: {
    timerDuration: 60,
    minWordLength: 3,
  },
  strikes: 0,
  shuffleCount: INITIAL_SHUFFLES,
  challengeCount: INITIAL_CHALLENGES,
  challengeActive: false,
  wordMilestoneProgress: {
    count: 0,
    nextUnlock: 10,
  },
  powerPlayProgress: {
      targetDigit: null,
      streak: 0,
      turnsSinceLastOffer: 4, // Allow an early offer
      cooldown: 0,
  },
  powerSurgeProgress: 0,
  activeCharms: [],
  availablePowerPlays: [],
  availableCharms: [],
  unlockedMilestoneIds: [],
  unlockedWordBonusIds: [],
  activeBuffs: [],
  charmUses: {},
  activePowerPlays: {},
  powerPlayToActivate: null,
  charmToActivate: null,
  powerPlayOffer: [],
  lastPowerPlayResult: null,
  highestScoringWord: null,
  letterMultipliers: {},
  wordMultipliersByLetter: {},
  // Charm states
  flawlessScore: 0,
  pianoManEncoreActive: false,
  glitchActive: false,
  wordsThisRound: 0,
  lastSubmissionTime: 0,
  consecutiveSuccesses: 0,
  multiverseTimeBonus: 0,
};

type GameScreenState = {
  gameState: GameState;
  time: number;
  hand: (Tile | null)[];
  buildRow: ({tile: Tile, originalIndex: number} | null)[];
  tileBag: string[];
  message: string;
  isPaused: boolean;
  isLoading: boolean;
  loadingMessage: string | null;
  modalContent: ModalContent;
  modalQueue: ModalContent[];
  tilesToSwap: { tile: Tile, originalIndex: number }[];
  tileToTransform: { tile: Tile, originalIndex: number } | null;
  challengeWordData: WordData | null;
  tileForHookshot: { tile: Tile, originalIndex: number } | null;
}

const screenInitialState: GameScreenState = {
  gameState: initialGameState,
  time: initialGameState.gameConfig.timerDuration,
  hand: Array(RACK_SIZE).fill(null),
  buildRow: Array(BUILD_ROW_SIZE).fill(null),
  tileBag: [],
  message: '',
  isPaused: false,
  isLoading: true,
  loadingMessage: null,
  modalContent: null,
  modalQueue: [],
  tilesToSwap: [],
  tileToTransform: null,
  challengeWordData: null,
  tileForHookshot: null,
}

type GameAction = 
    | { type: 'SET_IS_LOADING', payload: boolean }
    | { type: 'SET_LOADING_MESSAGE', payload: string | null }
    | { type: 'SET_HAND_AND_BAG', payload: { hand: (Tile | null)[], tileBag: string[] } }
    | { type: 'SET_MESSAGE', payload: string }
    | { type: 'CLEAR_MESSAGE' }
    | { type: 'PAUSE_GAME' }
    | { type: 'RESUME_GAME' }
    | { type: 'TICK_TIMER' }
    | { type: 'ADD_TIME', payload: number }
    | { type: 'MOVE_TILE_TO_BUILD', payload: { tile: Tile, fromIndex: number } }
    | { type: 'RETURN_TILE_TO_HAND', payload: { fromBuildIndex: number } }
    | { type: 'HANDLE_SUBMIT_SUCCESS', payload: any }
    | { type: 'ADD_STRIKE', payload?: { source: 'invalid_word' | 'challenge' } }
    | { type: 'HANDLE_SUBMIT_FAIL' }
    | { type: 'PERFORM_SHUFFLE', payload: { hand: (Tile | null)[], tileBag: string[], isFree: boolean } }
    | { type: 'CHALLENGE_FAILED', payload: { tilesToMove: { tile: Tile, originalIndex: number }[] } }
    | { type: 'HANDLE_CLEAR' }
    | { type: 'SET_MODAL_CONTENT', payload: ModalContent }
    | { type: 'CLOSE_MODAL' }
    | { type: 'UPDATE_GAME_STATE', payload: Partial<GameState> }
    | { type: 'CHOOSE_CHARM', payload: {charm: Charm, hand: (Tile | null)[]} }
    | { type: 'CHOOSE_POWER_PLAY', payload: PowerPlay }
    | { type: 'ACTIVATE_POWER_PLAY', payload: PowerPlay }
    | { type: 'COMPLETE_POWER_PLAY_ACTIVATION', payload: { powerPlay: PowerPlay, option?: any } }
    | { type: 'ADD_TILE_TO_SWAP', payload: { tile: Tile, originalIndex: number } }
    | { type: 'REMOVE_TILE_FROM_SWAP', payload: { originalIndex: number } }
    | { type: 'EXECUTE_SWAP' }
    | { type: 'RESET_ROUND', payload: { hand: (Tile | null)[], tileBag: string[] } }
    | { type: 'START_NEXT_ROUND' }
    | { type: 'ACTIVATE_CHARM', payload: Charm }
    | { type: 'SELECT_TILE_TO_TRANSFORM', payload: { tile: Tile, originalIndex: number } }
    | { type: 'COMPLETE_CHARM_ACTIVATION', payload: { charm: Charm, option?: any } }
    | { type: 'SET_CHALLENGE_WORD_DATA', payload: WordData | null }
    | { type: 'SELECT_TILE_FOR_HOOKSHOT', payload: { tile: Tile, originalIndex: number } }
    | { type: 'SHOW_SAVE_MODAL' }
    | { type: 'RESTART_ROUND_GROUNDHOG' };


function gameReducer(state: GameScreenState, action: GameAction): GameScreenState {
    let { gameState } = state;

    switch (action.type) {
        case 'SET_IS_LOADING': return { ...state, isLoading: action.payload, loadingMessage: action.payload ? state.loadingMessage : null };
        case 'SET_LOADING_MESSAGE': return { ...state, loadingMessage: action.payload };
        case 'SET_HAND_AND_BAG': return { ...state, hand: action.payload.hand, tileBag: action.payload.tileBag };
        case 'SET_MESSAGE': return { ...state, message: action.payload };
        case 'CLEAR_MESSAGE': return { ...state, message: '' };
        case 'PAUSE_GAME': return { ...state, isPaused: true };
        case 'RESUME_GAME': return { ...state, isPaused: false, time: state.time }; // Prevent timer reset on resume
        case 'TICK_TIMER': return { ...state, time: state.time - 1 };
        case 'ADD_TIME': return {...state, time: state.time + action.payload };
        case 'UPDATE_GAME_STATE': return { ...state, gameState: { ...state.gameState, ...action.payload } };
        case 'SET_CHALLENGE_WORD_DATA': return { ...state, challengeWordData: action.payload };
        
        case 'MOVE_TILE_TO_BUILD': {
            const newHand = [...state.hand];
            newHand[action.payload.fromIndex] = null;
            const newBuildRow = [...state.buildRow];
            const emptyBuildIndex = newBuildRow.findIndex(s => s === null);
            if (emptyBuildIndex !== -1) {
                newBuildRow[emptyBuildIndex] = { tile: action.payload.tile, originalIndex: action.payload.fromIndex };
            }
            return { ...state, hand: newHand, buildRow: newBuildRow };
        }
        
        case 'RETURN_TILE_TO_HAND': {
            const item = state.buildRow[action.payload.fromBuildIndex];
            if (!item) return state;

            const newHand = [...state.hand];
            // Put the tile back into its original slot if possible.
            if (newHand[item.originalIndex] === null) {
              newHand[item.originalIndex] = item.tile;
            } else {
              // Otherwise, find any empty slot.
              const emptyIndex = newHand.findIndex(t => t === null);
              if (emptyIndex !== -1) newHand[emptyIndex] = item.tile;
            }
            const newBuildRow = [...state.buildRow];
            newBuildRow[action.payload.fromBuildIndex] = null;
            return { ...state, hand: newHand, buildRow: newBuildRow };
        }

        case 'HANDLE_SUBMIT_SUCCESS': {
            const { gameState: newGameState, hand, tileBag, modalQueue } = action.payload;
            const [firstModal = null, ...restOfQueue] = modalQueue || [];

            return {
                ...state,
                gameState: newGameState,
                hand,
                tileBag,
                buildRow: Array(BUILD_ROW_SIZE).fill(null),
                isPaused: firstModal !== null,
                modalContent: firstModal,
                modalQueue: restOfQueue,
            };
        }
        
        case 'ADD_STRIKE': {
          let { strikes, activePowerPlays, activeBuffs, score, powerPlayProgress, consecutiveSuccesses, flawlessScore, activeCharms, powerSurgeProgress } = gameState;
          let actuallyGotAStrike = false;
          
          if(activePowerPlays.strikeShield) {
            delete activePowerPlays.strikeShield;
            activeBuffs = activeBuffs.filter(b => b.id !== 'strikeShield');
          } else if(activePowerPlays.plotArmor) {
              delete activePowerPlays.plotArmor;
              activeBuffs = activeBuffs.filter(b => b.id !== 'plotArmor');
              score = Math.max(0, score - 150);
          } else {
            strikes++;
            flawlessScore = 0; // Reset flawless score on strike
            actuallyGotAStrike = true;
            if (powerSurgeProgress > 0) {
              powerSurgeProgress = 0;
            }
          }
          
          if (actuallyGotAStrike && activeCharms.some(c => c.id === 'goldenSnitch')) {
             activeCharms = activeCharms.filter(c => c.id !== 'goldenSnitch');
             activeBuffs = activeBuffs.filter(b => b.id !== 'goldenSnitch');
          }

          const newPowerPlayProgress = { ...powerPlayProgress, streak: 0, targetDigit: null };
          consecutiveSuccesses = 0; // Reset streaks on any strike

          let newTime = state.time;
          let newHand = [...state.hand];
          let newTileBag = state.tileBag;
          
          let tempGameState = { ...gameState, strikes, activePowerPlays, activeBuffs, score, consecutiveSuccesses, flawlessScore, powerPlayProgress: newPowerPlayProgress, activeCharms, powerSurgeProgress };
          
          if (actuallyGotAStrike && action.payload?.source === 'invalid_word') {
              // Reset timer to original value for the round
              let timerDuration = tempGameState.gameConfig.timerDuration;
              if (tempGameState.glitchActive) {
                  timerDuration += 5;
                  tempGameState.glitchActive = false;
              }
              if (tempGameState.multiverseTimeBonus > 0) {
                  timerDuration += tempGameState.multiverseTimeBonus;
                  tempGameState.multiverseTimeBonus = 0;
              }
              if (tempGameState.activePowerPlays.timeTurner && tempGameState.activePowerPlays.timeTurner.rounds > 0) {
                  timerDuration += 30;
                  // Don't decrement round count here, that happens at the start of a new round
              }
              if (tempGameState.activePowerPlays.sonicSpeed) {
                  if (tempGameState.activePowerPlays.sonicSpeed.count === 2) timerDuration = 8;
                  else if (tempGameState.activePowerPlays.sonicSpeed.count === 1) timerDuration = 7;
              }
              newTime = timerDuration;
              
              // Add a new tile
              const hasSpace = newHand.some(t => t === null);
              if (hasSpace) {
                  const { newTiles, remainingBag } = gameUtils.drawTiles(1, newTileBag);
                  if (newTiles.length > 0) {
                      const emptySlotIndex = newHand.indexOf(null);
                      if (emptySlotIndex !== -1) {
                          newHand[emptySlotIndex] = newTiles[0];
                          newTileBag = remainingBag;
                      }
                  }
              } else { // No space, replace a random tile.
                  const handTiles = newHand.filter((t): t is Tile => t !== null);
                  if (handTiles.length > 0) {
                      const tileToReplaceIndex = Math.floor(Math.random() * handTiles.length);
                      const tileToReplace = handTiles[tileToReplaceIndex];
                      const originalHandIndex = newHand.findIndex(t => t?.id === tileToReplace.id);

                      const { newTiles, remainingBag } = gameUtils.drawTiles(1, [...newTileBag, tileToReplace.letter]);

                      if (newTiles.length > 0 && originalHandIndex !== -1) {
                          newHand[originalHandIndex] = newTiles[0];
                          newTileBag = remainingBag;
                      }
                  }
              }
          }
          
          return { 
            ...state,
            time: newTime,
            hand: newHand,
            tileBag: newTileBag,
            gameState: tempGameState
          };
        }

        case 'HANDLE_SUBMIT_FAIL': {
            let tempHand = [...state.hand];
            state.buildRow.filter(i => i).forEach(item => {
                if(tempHand[item!.originalIndex] === null){
                    tempHand[item!.originalIndex] = item!.tile;
                } else {
                    const emptyIndex = tempHand.findIndex(t => t === null);
                    if(emptyIndex !== -1) tempHand[emptyIndex] = item!.tile;
                }
            });
            return { ...state, hand: tempHand, buildRow: Array(BUILD_ROW_SIZE).fill(null) };
        }

        case 'PERFORM_SHUFFLE': {
            let newPowerSurgeProgress = state.gameState.powerSurgeProgress;
            if (!action.payload.isFree && newPowerSurgeProgress > 0) {
                newPowerSurgeProgress = 0;
            }
            return {
                ...state,
                hand: action.payload.hand,
                tileBag: action.payload.tileBag,
                buildRow: Array(BUILD_ROW_SIZE).fill(null),
                time: state.gameState.gameConfig.timerDuration,
                gameState: { 
                  ...state.gameState, 
                  shuffleCount: action.payload.isFree ? state.gameState.shuffleCount : state.gameState.shuffleCount - 1,
                  powerSurgeProgress: newPowerSurgeProgress,
                  consecutiveSuccesses: 0,
                  wordsThisRound: 0,
                }
            };
        }

        case 'CHALLENGE_FAILED': {
            const { tilesToMove } = action.payload;
            const newHand = [...state.hand];
            const newBuildRow = Array(BUILD_ROW_SIZE).fill(null);

            tilesToMove.forEach((item, index) => {
                newHand[item.originalIndex] = null;
                if (index < newBuildRow.length) {
                    newBuildRow[index] = item;
                }
            });
            
            return {
                ...state,
                hand: newHand,
                buildRow: newBuildRow,
                gameState: {
                    ...state.gameState,
                    challengeActive: true,
                    powerSurgeProgress: 0,
                }
            };
        }
        
        case 'HANDLE_CLEAR': {
            let newHand = [...state.hand];
            state.buildRow.filter(i => i).forEach(item => { newHand[item!.originalIndex] = item!.tile; });
            return { ...state, hand: newHand, buildRow: Array(BUILD_ROW_SIZE).fill(null) };
        }
        
        case 'SET_MODAL_CONTENT': return { ...state, modalContent: action.payload, isPaused: action.payload !== null };
        
        case 'SHOW_SAVE_MODAL':
            return {
                ...state,
                isPaused: true,
                modalContent: {
                    type: 'save-confirmation',
                    title: '💾 Save Your Spot?',
                }
            };

        case 'CLOSE_MODAL': {
            const previousModalTitle = state.modalContent?.title;

            // Specific handling for Deep Freeze modal
            if (previousModalTitle && previousModalTitle.includes('Deep Freeze')) {
                return { ...state, modalContent: null, isPaused: false, time: 2 };
            }

            // After closing a modal, check if there's another one in the queue.
            if (state.modalQueue.length > 0) {
                const [nextModal, ...rest] = state.modalQueue;
                return {
                    ...state,
                    modalContent: nextModal,
                    modalQueue: rest,
                    isPaused: true,
                    // Keep other modal-related states clean
                    gameState: {...state.gameState, powerPlayToActivate: null, charmToActivate: null, powerPlayOffer: []},
                    tilesToSwap: [],
                    tileToTransform: null,
                    tileForHookshot: null,
                };
            }
            
            return { ...state, modalContent: null, isPaused: false, gameState: {...state.gameState, powerPlayToActivate: null, charmToActivate: null, powerPlayOffer: []}, tilesToSwap: [], tileToTransform: null, tileForHookshot: null };
        }
        
        case 'RESTART_ROUND_GROUNDHOG': {
            // Return tiles in build row to hand.
            let newHand = [...state.hand];
            state.buildRow.filter(i => i).forEach(item => {
                if(item && newHand[item.originalIndex] === null){
                    newHand[item.originalIndex] = item.tile;
                } else if (item) {
                    const emptyIndex = newHand.findIndex(t => t === null);
                    if(emptyIndex !== -1) newHand[emptyIndex] = item.tile;
                }
            });
            
            return {
                ...state,
                modalContent: null,
                isPaused: false,
                hand: newHand,
                buildRow: Array(BUILD_ROW_SIZE).fill(null),
                time: state.gameState.gameConfig.timerDuration,
                gameState: {
                    ...state.gameState,
                    wordsThisRound: 0, // Reset round-specific counters
                }
            };
        }

        case 'RESET_ROUND': {
            let timerDuration = state.gameState.gameConfig.timerDuration;
            let newGameState = { ...state.gameState };

            if(newGameState.glitchActive) {
                timerDuration += 5;
                newGameState.glitchActive = false;
            }
            
            if(newGameState.multiverseTimeBonus > 0) {
                timerDuration += newGameState.multiverseTimeBonus;
                newGameState.multiverseTimeBonus = 0; // Consume the bonus
            }

            if (newGameState.activePowerPlays.timeTurner && newGameState.activePowerPlays.timeTurner.rounds > 0) {
                timerDuration += 30;
                const newTimeTurnerState = { rounds: newGameState.activePowerPlays.timeTurner.rounds - 1 };
                if (newTimeTurnerState.rounds > 0) {
                    newGameState.activePowerPlays = { ...newGameState.activePowerPlays, timeTurner: newTimeTurnerState };
                } else {
                    delete newGameState.activePowerPlays.timeTurner;
                    // Also remove from buffs so the icon disappears
                    newGameState.activeBuffs = newGameState.activeBuffs.filter(b => b.id !== 'timeTurner');
                }
            }

            if (newGameState.activePowerPlays.sonicSpeed) {
                if (newGameState.activePowerPlays.sonicSpeed.count === 2) {
                    timerDuration = 8;
                } else if (newGameState.activePowerPlays.sonicSpeed.count === 1) {
                    timerDuration = 7;
                }
            }

            if (newGameState.activePowerPlays.mutationProtocol) {
                const newMutationState = { rounds: newGameState.activePowerPlays.mutationProtocol.rounds - 1 };
                if (newMutationState.rounds > 0) {
                    newGameState.activePowerPlays = { ...newGameState.activePowerPlays, mutationProtocol: newMutationState };
                    const buffIndex = newGameState.activeBuffs.findIndex(b => b.id === 'mutationProtocol');
                    if (buffIndex > -1) {
                        const newBuff = {...newGameState.activeBuffs[buffIndex], description: `For the next ${newMutationState.rounds} rounds, tiles have a 25% chance of becoming Super Tiles (4x value).` };
                        newGameState.activeBuffs[buffIndex] = newBuff;
                    }
                } else {
                    delete newGameState.activePowerPlays.mutationProtocol;
                    newGameState.activeBuffs = newGameState.activeBuffs.filter(b => b.id !== 'mutationProtocol');
                }
            }
            
            const diceRollCharm = newGameState.activeCharms.find(c => c.id === 'diceRollProtocol');
            let { hand, tileBag } = action.payload;

            if (diceRollCharm && (newGameState.charmUses['diceRollProtocol'] || 0) < (diceRollCharm.maxUses || 3)) {
                const handTiles = hand.filter((t): t is Tile => t !== null);
                if (handTiles.length > 0) {
                    const tileToReplaceIndex = Math.floor(Math.random() * handTiles.length);
                    const tileToReplace = handTiles[tileToReplaceIndex];
                    const originalHandIndex = hand.findIndex(t => t?.id === tileToReplace.id);
                    
                    const { newTiles, remainingBag } = gameUtils.drawTiles(1, [...tileBag, tileToReplace.letter]);
                    tileBag = remainingBag;
                    if(originalHandIndex !== -1) {
                        const newTile = newTiles[0];
                        if (newTile) {
                            newTile.multiplier = 2; // Add the 2x multiplier
                            hand[originalHandIndex] = newTile;
                        }
                    }

                    const newUses = (newGameState.charmUses['diceRollProtocol'] || 0) + 1;
                    newGameState.charmUses = {...newGameState.charmUses, 'diceRollProtocol': newUses };

                    if (newUses >= (diceRollCharm.maxUses || 3)) {
                        newGameState.activeCharms = newGameState.activeCharms.filter(c => c.id !== 'diceRollProtocol');
                        newGameState.activeBuffs = newGameState.activeBuffs.filter(b => b.id !== 'diceRollProtocol');
                    }
                }
            }

            return {
                ...state,
                hand,
                tileBag,
                buildRow: Array(BUILD_ROW_SIZE).fill(null),
                time: timerDuration,
                gameState: { ...newGameState, wordsThisRound: 0 }
            };
        }

        case 'START_NEXT_ROUND': {
            let timerDuration = state.gameState.gameConfig.timerDuration;
            let newGameState = { ...state.gameState };
    
            if(newGameState.glitchActive) {
                timerDuration += 5;
                newGameState.glitchActive = false;
            }
            
            if(newGameState.multiverseTimeBonus > 0) {
                timerDuration += newGameState.multiverseTimeBonus;
                newGameState.multiverseTimeBonus = 0; // Consume the bonus
            }
    
            if (newGameState.activePowerPlays.timeTurner && newGameState.activePowerPlays.timeTurner.rounds > 0) {
                timerDuration += 30;
                const newTimeTurnerState = { rounds: newGameState.activePowerPlays.timeTurner.rounds - 1 };
                if (newTimeTurnerState.rounds > 0) {
                    newGameState.activePowerPlays = { ...newGameState.activePowerPlays, timeTurner: newTimeTurnerState };
                } else {
                    delete newGameState.activePowerPlays.timeTurner;
                    newGameState.activeBuffs = newGameState.activeBuffs.filter(b => b.id !== 'timeTurner');
                }
            }

            if (newGameState.activePowerPlays.mutationProtocol) {
                const newMutationState = { rounds: newGameState.activePowerPlays.mutationProtocol.rounds - 1 };
                if (newMutationState.rounds > 0) {
                    newGameState.activePowerPlays = { ...newGameState.activePowerPlays, mutationProtocol: newMutationState };
                     const buffIndex = newGameState.activeBuffs.findIndex(b => b.id === 'mutationProtocol');
                    if (buffIndex > -1) {
                        const newBuff = {...newGameState.activeBuffs[buffIndex], description: `For the next ${newMutationState.rounds} rounds, tiles have a 25% chance of becoming Super Tiles (4x value).` };
                        newGameState.activeBuffs[buffIndex] = newBuff;
                    }
                } else {
                    delete newGameState.activePowerPlays.mutationProtocol;
                    newGameState.activeBuffs = newGameState.activeBuffs.filter(b => b.id !== 'mutationProtocol');
                }
            }
    
            if (newGameState.activePowerPlays.sonicSpeed) {
                if (newGameState.activePowerPlays.sonicSpeed.count === 2) timerDuration = 8;
                else if (newGameState.activePowerPlays.sonicSpeed.count === 1) timerDuration = 7;
            }
            
            const diceRollCharm = newGameState.activeCharms.find(c => c.id === 'diceRollProtocol');
            let hand = [...state.hand];
            let tileBag = state.tileBag;
    
            if (diceRollCharm && (newGameState.charmUses['diceRollProtocol'] || 0) < (newGameState.charmUses['diceRollProtocol'] || 3)) {
                const handTiles = hand.filter((t): t is Tile => t !== null);
                if (handTiles.length > 0) {
                    const tileToReplaceIndex = Math.floor(Math.random() * handTiles.length);
                    const tileToReplace = handTiles[tileToReplaceIndex];
                    const originalHandIndex = hand.findIndex(t => t?.id === tileToReplace.id);
                    
                    const { newTiles, remainingBag } = gameUtils.drawTiles(1, [...tileBag, tileToReplace.letter]);
                    tileBag = remainingBag;
                    if(originalHandIndex !== -1) {
                        const newTile = newTiles[0];
                        if (newTile) {
                            newTile.multiplier = 2;
                            hand[originalHandIndex] = newTile;
                        }
                    }
    
                    const newUses = (newGameState.charmUses['diceRollProtocol'] || 0) + 1;
                    newGameState.charmUses = {...newGameState.charmUses, 'diceRollProtocol': newUses };
    
                    if (newUses >= (diceRollCharm.maxUses || 3)) {
                        newGameState.activeCharms = newGameState.activeCharms.filter(c => c.id !== 'diceRollProtocol');
                        newGameState.activeBuffs = newGameState.activeBuffs.filter(b => b.id !== 'diceRollProtocol');
                    }
                }
            }
    
            return {
                ...state,
                hand,
                tileBag,
                modalContent: null,
                isPaused: false,
                time: timerDuration,
                gameState: { ...newGameState, wordsThisRound: 0 }
            };
        }
        
        case 'CHOOSE_CHARM': {
            const { charm, hand } = action.payload;
            let newHand = hand;
            const stateChanges = charm.activate(state.gameState);
            
            let newGameState = { ...gameState };

            if (charm.id === 'goldenSnitch') {
                newGameState.consecutiveSuccesses = 0;
            }
            
            // Handle one-and-done immediate charms that shouldn't be added to active lists.
            if (charm.id === 'wildcardWake') {
                 return {
                    ...state,
                    modalContent: null,
                    isPaused: false,
                    gameState: { ...newGameState, ...stateChanges }
                };
            }

            if (charm.effectType === 'selection') {
                return {
                    ...state,
                    modalContent: null,
                    isPaused: false,
                    gameState: { ...newGameState, availableCharms: [...newGameState.availableCharms, charm]}
                };
            }
            
            if (charm.id === 'oneTileToRuleThemAll') {
                const availableTiles = hand.map((tile, index) => ({ tile, index })).filter(item => item.tile !== null);
                if (availableTiles.length > 0) {
                    const randomIndex = Math.floor(Math.random() * availableTiles.length);
                    const chosenItem = availableTiles[randomIndex];
                    
                    const updatedTile: Tile = { ...chosenItem.tile!, tempPoints: 25 };
                    
                    const handCopy = [...hand];
                    handCopy[chosenItem.index] = updatedTile;
                    newHand = handCopy;
                }
            }
            
            return {
                ...state,
                hand: newHand,
                modalContent: null,
                isPaused: false,
                gameState: {
                    ...newGameState,
                    ...stateChanges,
                    activeCharms: [...newGameState.activeCharms, charm],
                }
            }
        }
        
        case 'CHOOSE_POWER_PLAY': {
            const powerPlay = action.payload;
            const automaticPowerPlays = new Set(['strikeShield', 'philsosophy', 'plotArmor', 'fluncleIsProud', 'timeTurner', 'mutationProtocol']);

            // If it's NOT an automatic powerplay, it becomes an activatable ability for the player to use strategically.
            if (!automaticPowerPlays.has(powerPlay.id)) {
                return {
                    ...state,
                    modalContent: null,
                    isPaused: false,
                    gameState: {
                        ...gameState,
                        availablePowerPlays: [...gameState.availablePowerPlays, powerPlay],
                        powerPlayOffer: [],
                        powerPlayProgress: {
                            ...gameState.powerPlayProgress,
                             cooldown: 4,
                             turnsSinceLastOffer: 0,
                        },
                    }
                };
            }
            
            // Otherwise, activate it immediately.
            const changes = powerPlay.activate(state.gameState);
            let timeChange = 0;

            return {
                ...state,
                time: state.time + timeChange,
                modalContent: null,
                isPaused: false,
                gameState: {
                    ...gameState,
                    ...changes,
                    powerPlayOffer: [],
                    powerPlayProgress: {
                        ...gameState.powerPlayProgress,
                        cooldown: 4,
                        turnsSinceLastOffer: 0,
                    },
                }
            };
        }
        
        case 'ACTIVATE_CHARM': {
            const charm = action.payload;
            if (charm.effectType === 'selection') {
                 return {
                    ...state,
                    modalContent: { type: 'charm-activation', title: `Activate: ${charm.name}`, content: '', data: charm },
                    isPaused: true,
                };
            }
            return state;
        }

        case 'ACTIVATE_POWER_PLAY': {
            const powerPlay = action.payload;

            // If it's a selection type that requires a modal (e.g., has a selectionType)
            if (powerPlay.effectType === 'selection' && powerPlay.selectionType) {
                return {
                    ...state,
                    modalContent: { type: 'powerplay-activation', title: `Activate: ${powerPlay.name}`, content: '', data: powerPlay },
                    isPaused: true,
                };
            }

            let newHand = state.hand;
            let newBag = state.tileBag;
            let newBuildRow = state.buildRow;

            // Handle immediate tile-based effects
            if (powerPlay.id === 'nuclearOption') {
                const currentHandTiles = state.hand.filter((t): t is Tile => t !== null);
                const buildRowTiles = state.buildRow.filter(i => i).map(item => item!.tile);
                const tilesToReturn = [...currentHandTiles, ...buildRowTiles];
                
                const { hand: freshHand, tileBag: freshBag } = gameUtils.dealNewHand(state.tileBag, tilesToReturn);
                newHand = freshHand;
                newBag = freshBag;
                newBuildRow = Array(BUILD_ROW_SIZE).fill(null);
            }
            if (powerPlay.id === 'redWedding') {
                const handTilesWithIndices = state.hand.map((tile, index) => ({ tile, index })).filter(item => item.tile !== null);
                const shuffled = gameUtils.shuffleArray(handTilesWithIndices);
                const tilesToRemove = shuffled.slice(0, 2);
                const tempHand = [...state.hand];
                tilesToRemove.forEach(item => { if(item.tile) tempHand[item.index] = null; });
                newHand = tempHand;
            }
            
            if (powerPlay.id === 'thanosGift') {
                const currentHandTiles = state.hand.filter((t): t is Tile => t !== null);
                const buildRowTiles = state.buildRow.filter(i => i).map(item => item!.tile);
                const allPlayerTiles = [...currentHandTiles, ...buildRowTiles];

                if (allPlayerTiles.length > 0) {
                    const tilesToRemoveCount = Math.floor(allPlayerTiles.length / 2);
                    if (tilesToRemoveCount > 0) {
                        const shuffledTiles = gameUtils.shuffleArray(allPlayerTiles);
                        const tilesToRemove = shuffledTiles.slice(0, tilesToRemoveCount);
                        const tileIdsToRemove = new Set(tilesToRemove.map(t => t.id));

                        newHand = state.hand.map(t => t && tileIdsToRemove.has(t.id) ? null : t);
                        newBuildRow = state.buildRow.map(item => item && tileIdsToRemove.has(item.tile.id) ? null : item);
                    }
                }
            }

            const changes = powerPlay.activate(state.gameState);
            let timeChange = 0;
            if (powerPlay.id === 'timeBoost') timeChange = 15;
            if (powerPlay.id === 'rewind') timeChange = 10;
            
            return {
              ...state,
              time: state.time + timeChange,
              hand: newHand,
              tileBag: newBag,
              buildRow: newBuildRow,
              gameState: {
                ...gameState,
                ...changes,
                availablePowerPlays: gameState.availablePowerPlays.filter(p => p.id !== powerPlay.id),
                powerPlayProgress: {
                    ...gameState.powerPlayProgress,
                    cooldown: 4,
                },
              }
            }
        }
        
        case 'COMPLETE_POWER_PLAY_ACTIVATION': {
          const { powerPlay, option } = action.payload;

          if (powerPlay.id === 'neosChoice' && option?.choice) {
            let changes = {};
            let timeChange = 0;
            if (option.choice === 'time') {
                timeChange = 10;
            } else if (option.choice === 'strike') {
                changes = { strikes: Math.max(0, gameState.strikes - 1) };
            }
            return {
                ...state,
                time: state.time + timeChange,
                modalContent: null,
                isPaused: false,
                gameState: {
                    ...gameState,
                    ...changes,
                    availablePowerPlays: gameState.availablePowerPlays.filter(p => p.id !== powerPlay.id),
                }
            };
          }
          if (powerPlay.id === 'hookshot' && state.tileForHookshot) {
            const { tile } = state.tileForHookshot;
            const newTile: Tile = {
              ...tile,
              id: `${tile.letter}-hookshot-${Math.random()}`,
              isDuplicate: true,
            };
      
            const newHand = [...state.hand];
            const emptySlotIndex = newHand.indexOf(null);
            // Prefer filling an empty slot, otherwise expand the hand
            if (emptySlotIndex !== -1) {
              newHand[emptySlotIndex] = newTile;
            } else {
              newHand.push(newTile);
            }
      
            return {
              ...state,
              hand: newHand,
              modalContent: null,
              isPaused: false,
              tileForHookshot: null,
              gameState: {
                ...gameState,
                availablePowerPlays: gameState.availablePowerPlays.filter(p => p.id !== powerPlay.id),
              }
            };
          }

          const changes = powerPlay.activate(state.gameState, option);
          return { 
              ...state,
              modalContent: null, 
              isPaused: false, 
              gameState: { 
                  ...gameState, 
                  ...changes, 
                  availablePowerPlays: gameState.availablePowerPlays.filter(p => p.id !== powerPlay.id), 
                  powerPlayToActivate: null,
                  powerPlayProgress: {
                    ...gameState.powerPlayProgress,
                    cooldown: 4,
                  },
              }
          };
        }
        
        case 'SELECT_TILE_TO_TRANSFORM': {
            return { ...state, tileToTransform: action.payload };
        }
        case 'SELECT_TILE_FOR_HOOKSHOT': {
            return { ...state, tileForHookshot: action.payload };
        }
        
        case 'COMPLETE_CHARM_ACTIVATION': {
            const { charm, option } = action.payload;
            if (charm.id === 'shapeshiftersTongue' && state.tileToTransform && option?.newLetter) {
                const newTile = gameUtils.createTile(option.newLetter);
                const newHand = [...state.hand];
                newHand[state.tileToTransform.originalIndex] = newTile;
                
                const newCharmUses = { ...gameState.charmUses, [charm.id]: (gameState.charmUses[charm.id] || 0) + 1 };
                let newAvailableCharms = [...gameState.availableCharms];
                if(newCharmUses[charm.id] >= (charm.maxUses || 1)) {
                    newAvailableCharms = newAvailableCharms.filter(c => c.id !== charm.id);
                }

                return {
                    ...state,
                    hand: newHand,
                    gameState: {
                        ...state.gameState,
                        availableCharms: newAvailableCharms,
                        charmUses: newCharmUses,
                    },
                    modalContent: null,
                    isPaused: false,
                    tileToTransform: null,
                }
            }
            return state;
        }

        case 'ADD_TILE_TO_SWAP': {
            const max = state.modalContent?.data?.swapConfig?.max ?? 2;
            if(state.tilesToSwap.length >= max) return state;
            return {...state, tilesToSwap: [...state.tilesToSwap, { tile: action.payload.tile, originalIndex: action.payload.originalIndex }]};
        }
        case 'REMOVE_TILE_FROM_SWAP': {
            return {...state, tilesToSwap: state.tilesToSwap.filter(t => t.originalIndex !== action.payload.originalIndex)};
        }
        case 'EXECUTE_SWAP': {
            const powerPlayId = state.modalContent?.data?.id;
            return {
                ...state,
                modalContent: null,
                isPaused: false,
                gameState: { ...gameState, availablePowerPlays: gameState.availablePowerPlays.filter(p => p.id !== powerPlayId), powerPlayToActivate: null},
                tilesToSwap: []
            }
        }
        
        default: return state;
    }
}

const GameScreen: React.FC<GameScreenProps> = ({ playerName, onGameOver, onSaveGame, isResuming, onTimeLow }) => {
    const [state, dispatch] = useReducer(gameReducer, screenInitialState, (initialArg) => {
    if (isResuming) {
        const savedGameJson = localStorage.getItem('wordBuilderBonanzaSave');
        if (savedGameJson) {
            try {
                const savedData = JSON.parse(savedGameJson);
                return savedData.gameScreenState;
            } catch (e) {
                console.error("Error parsing saved game. Starting fresh.", e);
                localStorage.removeItem('wordBuilderBonanzaSave');
            }
        }
    }
    return screenInitialState;
  });
  const { gameState, time, hand, buildRow, tileBag, message, isPaused, isLoading, modalContent, tilesToSwap } = state;
  const isChallengeLock = gameState.challengeActive;
  const [isMuted, setIsMuted] = useState(soundService.getMuteState());

  const handleMuteToggle = () => {
    soundService.initialize();
    const newMuteState = soundService.toggleMute();
    setIsMuted(newMuteState);
  };

  const showMessage = useCallback((text: string, duration = 3000) => {
    dispatch({ type: 'SET_MESSAGE', payload: text });
    setTimeout(() => dispatch({ type: 'CLEAR_MESSAGE' }), duration);
  }, []);

  const handleStartNextRound = useCallback(() => {
    dispatch({ type: 'START_NEXT_ROUND' });
  }, []);

  const handleCloseModal = useCallback(() => {
      soundService.playUIClick();
      const lastModalType = state.modalContent?.type;
      const wasLastInQueue = state.modalQueue.length === 0;
      const lastModalTitle = state.modalContent?.title;

      // Special handling for Groundhog's Day
      if (lastModalTitle && lastModalTitle.includes('Groundhog’s Day')) {
          dispatch({ type: 'RESTART_ROUND_GROUNDHOG' });
          return;
      }
  
      dispatch({ type: 'CLOSE_MODAL' });
  
      const postWordModals: (ModalContent['type'])[] = ['milestone', 'easter-egg', 'word-bonus', 'powerplay-selection', 'charm-selection', 'super-hand'];
      if (wasLastInQueue && lastModalType && postWordModals.includes(lastModalType)) {
          handleStartNextRound();
      }
  }, [state.modalContent, state.modalQueue, handleStartNextRound]);

  const applyMutation = useCallback((tiles: Tile[]): Tile[] => {
    if (gameState.activePowerPlays.mutationProtocol) {
        return tiles.map(tile => {
            if (tile && !tile.isSuper && Math.random() < 0.25) {
                showMessage("✨ Super Tile Created! ✨", 1500);
                soundService.playPowerUp();
                return {
                    ...tile,
                    isSuper: true
                };
            }
            return tile;
        });
    }
    return tiles;
  }, [gameState.activePowerPlays.mutationProtocol, showMessage]);

  const initialDeal = useCallback(() => {
    let bag = gameUtils.createTileBag();
    let { hand: newHand, tileBag: newBag } = gameUtils.dealNewHand(bag);

    newHand = applyMutation(newHand);

    const paddedHand = Array(RACK_SIZE).fill(null);
    newHand.forEach((tile, i) => paddedHand[i] = tile);
    
    const { newHand: finalHand, newBag: finalBag } = gameUtils.postProcessHand(paddedHand, newBag, showMessage);
    
    dispatch({ type: 'SET_HAND_AND_BAG', payload: { hand: finalHand, tileBag: finalBag } });
  }, [showMessage, applyMutation]);

  useEffect(() => {
    dispatch({ type: 'SET_IS_LOADING', payload: true });
    if (isResuming) {
        // State is already loaded by reducer initializer.
        // We can show a welcome message.
        showMessage(`Welcome back, ${playerName}!`, 2500);
    } else {
        // This is a new game, deal the initial hand.
        initialDeal();
    }
    dispatch({ type: 'SET_IS_LOADING', payload: false });
  }, [initialDeal, isResuming, playerName, showMessage]);

  useEffect(() => {
    // This effect is dedicated to notifying the parent about the time status.
    const isLow = time > 0 && time <= 3 && !isPaused && !isLoading;
    onTimeLow(isLow);
  }, [time, isPaused, isLoading, onTimeLow]);

  const resetRound = useCallback((currentGameState: GameState, currentHand: (Tile | null)[], currentBuildRow: ({tile: Tile, originalIndex: number} | null)[], currentTileBag: string[]) => {
    const allTiles = [...currentHand.filter((t): t is Tile => t !== null), ...currentBuildRow.filter(i => i).map(item => item!.tile)];
    let { hand: newHandTiles, tileBag: finalBag } = gameUtils.dealNewHand(currentTileBag, allTiles);
    
    newHandTiles = applyMutation(newHandTiles);

    const paddedHand = Array(RACK_SIZE).fill(null);
    newHandTiles.forEach((tile, i) => paddedHand[i] = tile);

    const { newHand: finalHand, newBag: processedBag } = gameUtils.postProcessHand(paddedHand, finalBag, showMessage);

    dispatch({ type: 'RESET_ROUND', payload: { hand: finalHand, tileBag: processedBag } });
  }, [showMessage, applyMutation]);
  
  const strikeBankUses = useMemo(() => gameState.charmUses['strikeBank'] || 0, [gameState.charmUses]);
  const maxStrikes = useMemo(() => gameState.activeCharms.some(c => c.id === 'strikeBank') 
    ? (strikeBankUses === 2 ? 5 : (strikeBankUses === 1 ? 4 : MAX_STRIKES_INITIAL)) 
    : MAX_STRIKES_INITIAL, [gameState.activeCharms, strikeBankUses]);

  useEffect(() => {
      // First, always check for game-ending strike condition.
      if (gameState.strikes >= maxStrikes) {
          onGameOver(gameState);
          return;
      }

      // Then, apply guards for pause, load, or special power-ups that stop time.
      if (isPaused || isLoading || gameState.activePowerPlays.leafOnTheWind) return;

      // The rest of the timer logic runs only if time is not paused.
      if (time <= 0) {
          // Groundhog's Day Check FIRST
          const groundhogCharm = gameState.activeCharms.find(c => c.id === 'groundhogsDay');
          if (groundhogCharm && gameState.wordsThisRound === 0 && (gameState.charmUses['groundhogsDay'] || 0) < (groundhogCharm.maxUses || 1)) {
              dispatch({ type: 'PAUSE_GAME' });
              const newCharmUses = { ...gameState.charmUses, 'groundhogsDay': (gameState.charmUses['groundhogsDay'] || 0) + 1 };
              dispatch({ 
                  type: 'UPDATE_GAME_STATE', 
                  payload: { 
                      charmUses: newCharmUses, 
                      activeBuffs: gameState.activeBuffs.filter(b => b.id !== 'groundhogsDay'),
                      activeCharms: gameState.activeCharms.filter(c => c.id !== 'groundhogsDay') 
                  }
              });
              dispatch({ type: 'SET_MODAL_CONTENT', payload: { type: 'info', title: '🔄 Groundhog’s Day! 🔄', content: 'Same tiles. Same time. You get one more shot.' }});
              soundService.playMilestone();
              return;
          }

          // Deep Freeze Check SECOND
          const deepFreezeCharm = gameState.activeCharms.find(c => c.id === 'deepFreeze');
          if (deepFreezeCharm && (gameState.charmUses['deepFreeze'] || 0) < (deepFreezeCharm.maxUses || 1)) {
              dispatch({ type: 'PAUSE_GAME' });
              const newCharmUses = { ...gameState.charmUses, 'deepFreeze': (gameState.charmUses['deepFreeze'] || 0) + 1 };
              dispatch({ 
                  type: 'UPDATE_GAME_STATE', 
                  payload: { 
                      charmUses: newCharmUses, 
                      activeBuffs: gameState.activeBuffs.filter(b => b.id !== 'deepFreeze'),
                      activeCharms: gameState.activeCharms.filter(c => c.id !== 'deepFreeze') 
                  }
              });
              dispatch({ type: 'SET_MODAL_CONTENT', payload: { type: 'info', title: '❄️ Deep Freeze! ❄️', content: 'Time has frozen for a moment. You have 2 seconds left. Make it count!' }});
              soundService.playMilestone();
              return;
          }
          
          soundService.playInvalidWord();
          onGameOver(gameState);
          return;
      }
      
      if (time > 0 && time <= 10) {
        soundService.playTick();
      }

      const interval = setInterval(() => {
          dispatch({ type: 'TICK_TIMER' });
      }, 1000);

      return () => clearInterval(interval);
  }, [gameState, time, onGameOver, isPaused, isLoading, showMessage, maxStrikes]);
  
  useEffect(() => {
    if (gameState.lastPowerPlayResult) {
        showMessage(gameState.lastPowerPlayResult.message, 3000);
        dispatch({ type: 'UPDATE_GAME_STATE', payload: { lastPowerPlayResult: null } });
    }
  }, [gameState.lastPowerPlayResult, showMessage]);

   const handleMoveToBuild = (tile: Tile, fromIndex: number) => {
    if (isChallengeLock || buildRow.filter(t => t).length >= BUILD_ROW_SIZE) return;
    soundService.playTileClick();
    dispatch({ type: 'MOVE_TILE_TO_BUILD', payload: { tile, fromIndex } });
  };

  const handleReturnToHand = (fromBuildIndex: number) => {
    if (isChallengeLock) return;
    soundService.playTileClick();
    dispatch({ type: 'RETURN_TILE_TO_HAND', payload: { fromBuildIndex } });
  };
  
  const handleShuffle = (isFree = false) => {
    if((!isFree && gameState.shuffleCount <= 0) || isPaused || isChallengeLock) return;
    soundService.playShuffle();
    
    if (!isFree) {
        if (gameState.powerSurgeProgress === 3 || gameState.powerSurgeProgress === 4) {
            soundService.playComboDrop();
            showMessage("Combo Lost! Don't worry, even Jack couldn’t fix this one.", 3000);
        } else if (gameState.powerSurgeProgress > 0) {
            soundService.playComboDrop();
            showMessage('😵 Combo Dropped!', 2500);
        }
    }

    const tilesToReturn = [...hand, ...buildRow.map(item => item?.tile)].filter((t): t is Tile => t != null);
    let { hand: newHandTiles, tileBag: newBagForShuffle } = gameUtils.dealNewHand(tileBag, tilesToReturn);
    
    newHandTiles = applyMutation(newHandTiles);

    const paddedHand = Array(RACK_SIZE).fill(null);
    newHandTiles.forEach((tile, i) => { 
        if (i < RACK_SIZE) paddedHand[i] = tile;
    });

    const { newHand: finalHand, newBag: finalBag } = gameUtils.postProcessHand(paddedHand, newBagForShuffle, showMessage);
    
    dispatch({ 
        type: 'PERFORM_SHUFFLE', 
        payload: { 
            hand: finalHand, 
            tileBag: finalBag,
            isFree: isFree
        } 
    });
  };
  
   const handleSubmit = async () => {
    const word = buildRow.filter(i => i).map(item => item!.tile.letter).join('');
    if(word.length < gameState.gameConfig.minWordLength || isLoading || isPaused) return;

    if (isChallengeLock) {
        soundService.playValidWord();
        
        let strikeLost = false;
        let newState = { ...gameState, challengeActive: false, consecutiveSuccesses: 0 };
        
        // This was a failed Strike Challenge if challenge count was 0
        if (gameState.challengeCount <= 0) {
            dispatch({ type: 'ADD_STRIKE', payload: {source: 'challenge'} });
            strikeLost = true;
        }

        const message = strikeLost 
            ? `Forced to play ${word.toUpperCase()}. Lost 1 Strike.`
            : `Forced to play ${word.toUpperCase()}. Challenge consumed.`;
        
        showMessage(message, 3000);

        if (state.challengeWordData) {
            const challengedWordData: WordData = {
                ...state.challengeWordData,
                word: `${state.challengeWordData.word} (found by game)`,
                definition: `Score 0. ${state.challengeWordData.definition || ''}`.trim(),
                cumulativeScore: newState.score
            };
            newState.words = [...newState.words, challengedWordData];
        }
        
        const { hand: dealHand, tileBag: newBag } = gameUtils.dealNewHand(tileBag, []);
        const { newHand: finalHand, newBag: finalBag } = gameUtils.postProcessHand(dealHand, newBag, showMessage);

        dispatch({
            type: 'HANDLE_SUBMIT_SUCCESS', payload: {
                gameState: newState, 
                hand: finalHand,
                tileBag: finalBag,
                modalQueue: []
            }
        });
        handleStartNextRound();
        dispatch({ type: 'SET_CHALLENGE_WORD_DATA', payload: null });
        return;
    }

    const submittedTiles = buildRow.filter(i => i).map(item => item!.tile);
    const wordLockActive = gameState.activePowerPlays['wordLock'] && word.length <= 5;
    
    let isValid = false;
    let definition: string | undefined;

    if (wordLockActive) {
        isValid = true;
        definition = 'A rule-breaking word!';
    } else {
        dispatch({ type: 'SET_LOADING_MESSAGE', payload: "📚 Please hold... we're checking the BIG dictionary in the back of the library." });
        dispatch({type: 'SET_IS_LOADING', payload: true});
        const result = await dictionaryService.getWordData(word);
        isValid = result.isValid;
        definition = result.definition;
    }
    
    if (isValid) {
        soundService.playValidWord();
        let newState = { ...gameState };
        const now = Date.now();
        const modalQueue: ModalContent[] = [];
        const oldScore = newState.score;
        const WORD_OVERRIDE_EGG_IDS = new Set(['sex', 'poop', 'kermitWisdom', 'homersDelight', 'dundieAward', 'dangerousAlone', 'totallyBuggin', 'loveBonus', 'timeBonus', 'dieBonus', 'joyBonus', 'chandlerBing', 'deadPoetsSociety', 'terminator', 'spiderman']);


        // --- 1. WORD SCORE CALCULATION (BASE) ---
        const scoreResult = gameUtils.calculateScore(word, submittedTiles, newState);
        let wordScore = scoreResult.totalScore;

        // --- 2. COMBO LOGIC ---
        if (newState.powerSurgeProgress === 4) { // This is the 5th word in the streak.
            wordScore *= 2;
            scoreResult.bonuses.push({ name: "⚡ 5-Word Combo!", description: "x2 Score"});
            newState.powerSurgeProgress = 0; // Reset after bonus.
        } else {
            newState.powerSurgeProgress++; // Increment for next time.
        }
        
        // --- 3. WORD-BASED EASTER EGG OVERRIDE ---
        const wordBasedEgg = EASTER_EGGS.find(egg => 
            WORD_OVERRIDE_EGG_IDS.has(egg.id) && 
            !newState.foundEasterEggs.some(fe => fe.id === egg.id) &&
            egg.trigger(word, 0, newState)
        );
        if (wordBasedEgg) {
            wordScore = wordBasedEgg.reward.points || 0;
            newState.foundEasterEggs = [...newState.foundEasterEggs, wordBasedEgg];
            modalQueue.push({ type: 'easter-egg', title: wordBasedEgg.name, content: wordBasedEgg.reward.message, data: wordBasedEgg });
            scoreResult.bonuses = []; // Clear other bonuses as this overrides them
        }
        
        // --- 4. STATEFUL & RANDOM BONUSES on top of word score ---
        if (newState.activeCharms.some(c => c.id === 'goldenTicket') && Math.random() <= 0.10) {
          wordScore *= 3;
          scoreResult.bonuses.push({ name: 'Golden Ticket!', description: "Golden Ticket! x3 Score"});
        }
        const isSecondSubmission = newState.words.some(wd => wd.word === word);
        if (newState.activeCharms.some(c => c.id === 'doctorStrangesLoop') && isSecondSubmission) {
            wordScore *= 2;
            scoreResult.bonuses.push({ name: "Dr. Strange's Loop", description: "Dr. Strange's Loop: x2 Score"});
        }
        const timeSinceLast = now - newState.lastSubmissionTime;
        if (newState.activeCharms.some(c => c.id === 'momentum') && timeSinceLast < 10000 && newState.consecutiveSuccesses > 0) {
            wordScore += 20;
            scoreResult.bonuses.push({ name: "Momentum", description: "Momentum: +20 pts"});
        }
        const scoreBeforeEncore = wordScore;
        if (newState.pianoManEncoreActive) {
            const bonus = Math.round(wordScore * 0.15);
            wordScore += bonus;
            scoreResult.bonuses.push({ name: "Piano Man Encore", description: `Piano Man Encore: +${bonus} pts`});
        }
        if (newState.activeCharms.some(c => c.id === 'christiansHoodieMode')) {
            if (timeSinceLast < 10000 && /[GAM]/.test(word.toUpperCase())) {
                const bonus = Math.round(wordScore * 0.15);
                wordScore += bonus;
                scoreResult.bonuses.push({ name: "Christian’s Hoodie Mode", description: `+${bonus} pts (15%)`});
            }
        }
        if (newState.activePowerPlays['philsosophy']) {
            const rand = Math.random();
            if(rand < 0.20) { wordScore += 20; scoreResult.bonuses.push({ name: "Phil's-osophy", description: "Phil's-osophy: +20 pts"}); }
            else if (rand < 0.30) { wordScore -= 10; scoreResult.bonuses.push({ name: "Phil's-osophy", description: "Phil's-osophy: -10 pts"}); }
        }
        if (newState.activePowerPlays.multiverseOfSadness) {
            const timeBonus = Math.round(wordScore / 2);
            wordScore = Math.floor(wordScore / 2);
            newState.multiverseTimeBonus = timeBonus;
            scoreResult.bonuses.push({ name: "Multiverse of Sadness", description: `Multiverse: /2 Score, +${timeBonus}s next round`});
        }
        
        // --- 5. GAME STATE BONUSES ---
        let gameStateBonuses = 0;
        const isSuperHand = (hand.filter(t => t !== null).length === 0);
        if (isSuperHand) {
            gameStateBonuses += SUPER_HAND_BONUS;
            scoreResult.bonuses.push({ name: "Super Hand", description: `+${SUPER_HAND_BONUS} pts`});
            if (newState.activeCharms.some(c => c.id === 'infinityGauntlet')) {
                gameStateBonuses += 75;
                scoreResult.bonuses.push({ name: "Infinity Gauntlet", description: `+75 pts`});
            }
        }
        if (newState.activeCharms.some(c => c.id === 'fluxCapacitor') && (newState.words.length + 1) % 8 === 0) {
            const bonus = Math.round(wordScore * 0.55);
            gameStateBonuses += bonus;
            scoreResult.bonuses.push({ name: "Flux Capacitor", description: `+${bonus} pts`});
        }
        
        // --- STREAK BONUSES ---
        newState.consecutiveSuccesses++;
        let shouldResetStreak = false;

        // Glitch in the Code check
        if (newState.activeCharms.some(c => c.id === 'glitchInTheCode')) {
            if (newState.consecutiveSuccesses >= 6) {
                newState.glitchActive = true;
                shouldResetStreak = true;
            }
        }
        
        // Golden Snitch check
        const snitchCharmActive = newState.activeCharms.some(c => c.id === 'goldenSnitch');
        if (snitchCharmActive && newState.consecutiveSuccesses >= 5) {
            gameStateBonuses += 500;
            scoreResult.bonuses.push({ name: "Golden Snitch", description: `+500 pts`});
            shouldResetStreak = true;
            // Consume the charm
            newState.activeCharms = newState.activeCharms.filter(c => c.id !== 'goldenSnitch');
            newState.activeBuffs = newState.activeBuffs.filter(b => b.id !== 'goldenSnitch');
        }

        if (shouldResetStreak) {
            newState.consecutiveSuccesses = 0;
        }

        // --- 6. Aggregate Score and Check Aggregate Bonuses ---
        let runningScore = oldScore + wordScore + gameStateBonuses;

        // Word Bonuses
        const totalWordsSubmitted = newState.words.length + 1;
        const newWordBonus = WORD_BONUSES.find(wb => 
            totalWordsSubmitted === wb.wordCount && 
            !newState.unlockedWordBonusIds.includes(wb.id)
        );
        if (newWordBonus) {
            runningScore += newWordBonus.reward.points;
            newState.unlockedWordBonusIds = [...newState.unlockedWordBonusIds, newWordBonus.id];
            scoreResult.bonuses.push({ name: newWordBonus.title, description: `+${newWordBonus.reward.points} pts` });
            modalQueue.push({ type: 'word-bonus', title: newWordBonus.title, content: newWordBonus.description, data: newWordBonus });
        }

        // Milestone Bonuses (iteratively to handle cascades)
        let newMilestonesFound = true;
        const sortedMilestones = [...MILESTONES_LIST].sort((a, b) => a.scoreThreshold - b.scoreThreshold);
        while (newMilestonesFound) {
            newMilestonesFound = false;
            for (const milestone of sortedMilestones) {
                if (runningScore >= milestone.scoreThreshold && !newState.unlockedMilestoneIds.includes(milestone.id)) {
                    soundService.playMilestone();
                    newState.gameConfig = { ...newState.gameConfig, ...milestone.configChange };
                    if (milestone.reward.points) {
                        runningScore += milestone.reward.points;
                        scoreResult.bonuses.push({ name: milestone.name, description: `+${milestone.reward.points} pts` });
                    }
                    newState.unlockedMilestoneIds.push(milestone.id);
                    modalQueue.push({ type: 'milestone', title: 'Milestone Reached!', data: milestone, content: `You've unlocked ${milestone.name}!` });
                    newMilestonesFound = true; // A milestone was found, re-iterate from the start
                    break; 
                }
            }
        }

        // Score-based Easter Egg Check
        for (const egg of EASTER_EGGS) {
            if (WORD_OVERRIDE_EGG_IDS.has(egg.id) || newState.foundEasterEggs.some(fe => fe.id === egg.id)) continue;
            if (egg.trigger(word, runningScore, newState)) {
                newState.foundEasterEggs = [...newState.foundEasterEggs, egg];
                if (egg.reward.points) {
                    runningScore += egg.reward.points;
                    scoreResult.bonuses.push({ name: egg.name, description: `+${egg.reward.points} pts` });
                }
                if (egg.reward.shuffle) newState.shuffleCount += egg.reward.shuffle;
                modalQueue.push({ type: 'easter-egg', title: egg.name, content: egg.reward.message, data: egg });
            }
        }

        // Bean Counter Check
        if (newState.activeCharms.some(c => c.id === 'beanCounter')) {
            const oldMultiple = Math.floor(oldScore / 500);
            const newMultiple = Math.floor(runningScore / 500);
            if (newMultiple > oldMultiple) {
                const beanCounterBonus = (newMultiple - oldMultiple) * 50;
                runningScore += beanCounterBonus;
                scoreResult.bonuses.push({ name: "Bean Counter", description: `+${beanCounterBonus} pts`});
            }
        }

        // --- 7. FINAL SCORE UPDATE ---
        newState.score = Math.round(runningScore);
        const turnScore = newState.score - oldScore;
        
        // --- 8. OTHER STATE UPDATES ---
        if (isSuperHand) {
            let gauntletBonus = 0;
            if (newState.activeCharms.some(c => c.id === 'infinityGauntlet')) {
                gauntletBonus = 75;
            }
            modalQueue.push({ type: 'super-hand', title: '✨ SUPER HAND! ✨', content: `You cleared your entire hand! That's a master move!`, data: { points: SUPER_HAND_BONUS, gauntletBonus } });
        }
        
        const lTrainCharm = newState.activeCharms.find(c => c.id === 'lTrainShuffle');
        if (lTrainCharm) {
            let charmUses = newState.charmUses['lTrainShuffle'] || 0;
            if (charmUses < (lTrainCharm.maxUses || 2) && word.toUpperCase().includes('L') && word.toUpperCase().includes('T')) {
                newState.shuffleCount++;
                charmUses++;
                newState.charmUses = {...newState.charmUses, 'lTrainShuffle': charmUses};
                if (charmUses >= (lTrainCharm.maxUses || 2)) {
                    newState.activeCharms = newState.activeCharms.filter(c => c.id !== 'lTrainShuffle');
                    newState.activeBuffs = newState.activeBuffs.filter(b => b.id !== 'lTrainShuffle');
                }
            }
        }

        const hasDuplicateLetters = new Set(word.split('')).size < word.length;
        if (newState.activeCharms.some(c => c.id === 'executeOrder66') && hasDuplicateLetters) {
            newState.multiverseTimeBonus += 6;
        }
        
        newState.pianoManEncoreActive = newState.activeCharms.some(c => c.id === 'pianoManEncore') && scoreBeforeEncore >= 45;
        
        if (newState.activeCharms.some(c => c.id === 'strikeBank')) {
            newState.flawlessScore += turnScore;
            const currentUses = newState.charmUses['strikeBank'] || 0;
            if (currentUses < 1 && newState.flawlessScore >= 500) {
                newState.charmUses['strikeBank'] = 1;
            } else if (currentUses < 2 && newState.flawlessScore >= 1000) {
                newState.charmUses['strikeBank'] = 2;
            }
        }
        
        showMessage(`${word.toUpperCase()}: +${Math.round(turnScore)}`, 3000);

        const wordData: WordData = {
          word,
          score: Math.round(turnScore),
          baseScore: scoreResult.baseScore,
          bonuses: scoreResult.bonuses,
          definition,
          status: 'valid',
          cumulativeScore: newState.score
        };
        newState.words = [...newState.words, wordData];
        newState.longestWord = word.length > newState.longestWord.length ? word : newState.longestWord;
        if (!newState.highestScoringWord || turnScore > newState.highestScoringWord.score) {
          newState.highestScoringWord = { ...wordData, score: turnScore };
        }
        newState.wordsThisRound++;
        newState.lastSubmissionTime = now;
        
        // Power Play Offer Check
        let newProgress = { ...newState.powerPlayProgress };
        if (newProgress.cooldown > 0) {
            newProgress.cooldown--;
        } else {
            const tensDigit = Math.floor(turnScore / 10) % 10;
            newProgress.turnsSinceLastOffer++;
            if (turnScore > 0) {
                if (newProgress.targetDigit === null || newProgress.targetDigit === tensDigit) {
                    newProgress.streak++;
                    newProgress.targetDigit = tensDigit;
                } else {
                    newProgress.streak = 1;
                    newProgress.targetDigit = tensDigit;
                }
            } else {
                newProgress.streak = 0;
                newProgress.targetDigit = null;
            }
            if (newProgress.streak >= 3 && newState.availablePowerPlays.length === 0 && newProgress.turnsSinceLastOffer >= 4) {
                const powerPlaysToOfferFrom = POWER_PLAYS_LIST.filter(pp => !newState.activeBuffs.some(ab => ab.id === pp.id) && !newState.availablePowerPlays.some(ap => ap.id === pp.id));
                const offeredPowerPlays = gameUtils.getRandomItems(powerPlaysToOfferFrom, 3);
                if (offeredPowerPlays.length > 0) {
                    newState.powerPlayOffer = offeredPowerPlays;
                    newProgress.streak = 0;
                    newProgress.targetDigit = null;
                    newProgress.turnsSinceLastOffer = 0;
                    soundService.playModalOpen();
                    modalQueue.push({ type: 'powerplay-selection', title: 'PowerPlay Earned!', content: `Choose your power-up!`, data: offeredPowerPlays });
                }
            }
        }
        newState.powerPlayProgress = newProgress;

        // Word Charm Offer Check
        newState.wordMilestoneProgress.count++;
        if (newState.wordMilestoneProgress.count >= newState.wordMilestoneProgress.nextUnlock) {
            const offeredCharms = gameUtils.getRandomItems(CHARMS_LIST.filter(c => !newState.activeCharms.some(ac => ac.id === c.id)), 3);
            if(offeredCharms.length > 0) {
              soundService.playModalOpen();
              modalQueue.push({ type: 'charm-selection', title: 'WordCharm Earned!', content: `Choose your charm!`, data: offeredCharms });
            }
            newState.wordMilestoneProgress.count = 0;
            newState.wordMilestoneProgress.nextUnlock += 2;
        }

        const recycledTiles: Tile[] = [];
        if (newState.activeCharms.some(c => c.id === 'recycler')) {
             submittedTiles.forEach(tile => {
                if ((newState.letterMultipliers[tile.letter] || 1) > 1 && Math.random() < 0.5) {
                    recycledTiles.push(gameUtils.createTile(tile.letter));
                    showMessage('Recycled!', 1000);
                }
            });
        }
        
        let tempNewHand: (Tile | null)[];
        let newBag: string[];
        
        // This is the key change: create a clean hand array of the correct size first
        const cleanHand = hand.filter(t => t === null || !t.isDuplicate);
        while (cleanHand.length < RACK_SIZE) {
            cleanHand.push(null);
        }
        if (cleanHand.length > RACK_SIZE) {
            // This case should not happen if logic is correct, but as a safeguard
            cleanHand.splice(RACK_SIZE);
        }

        if (isSuperHand) {
            const deal = gameUtils.dealNewHand(tileBag, []);
            let finalDealHand = applyMutation(deal.hand);
            const paddedDeal = Array(RACK_SIZE).fill(null);
            finalDealHand.forEach((tile, i) => paddedDeal[i] = tile);
            tempNewHand = paddedDeal;
            newBag = deal.tileBag;
        } else {
            const handTilesRemainingCount = hand.filter(t => t !== null).length;
            const tilesUsedCount = submittedTiles.length;
            const refillStrategyA = Math.ceil(tilesUsedCount / REPLENISH_DIVISOR);
            const refillStrategyB = Math.max(0, BASE_RACK_SIZE - handTilesRemainingCount);
            const replenishCount = Math.max(refillStrategyA, refillStrategyB);
            
            const drawResult = gameUtils.drawTiles(replenishCount, tileBag);
            let finalDrawnTiles = applyMutation(drawResult.newTiles);
            
            let tempHand = [...cleanHand];
            
            recycledTiles.forEach(tile => {
                const emptySlot = tempHand.indexOf(null);
                if (emptySlot !== -1) tempHand[emptySlot] = tile;
            });
            
            finalDrawnTiles.forEach(tile => {
                const emptySlot = tempHand.findIndex(slot => slot === null);
                if(emptySlot !== -1) tempHand[emptySlot] = tile;
            });

            tempNewHand = tempHand;
            newBag = drawResult.remainingBag;
        }

        const { newHand: finalHand, newBag: finalBag } = gameUtils.postProcessHand(tempNewHand, newBag, showMessage);
        
        const consumedPPs = { ...newState.activePowerPlays };
        let consumedBuffs = [...newState.activeBuffs];
        if (wordLockActive) { delete consumedPPs.wordLock; consumedBuffs = consumedBuffs.filter(b => b.id !== 'wordLock'); }
        ['biglyScore', 'multiverseOfSadness', 'nuclearOption', 'schruteBucks', 'redWedding', 'wakandaForever', 'heisenberg', 'skywalkerBloodline', 'leafOnTheWind', 'thanosGift'].forEach(id => { 
            if (consumedPPs[id]) { 
                delete consumedPPs[id]; 
                consumedBuffs = consumedBuffs.filter(b => b.id !== id); 
            }
        });
        if (consumedPPs.sonicSpeed) { if (consumedPPs.sonicSpeed.count > 1) { consumedPPs.sonicSpeed = { ...consumedPPs.sonicSpeed, count: consumedPPs.sonicSpeed.count - 1 }; } else { delete consumedPPs.sonicSpeed; consumedBuffs = consumedBuffs.filter(b => b.id !== 'sonicSpeed'); }}
        newState.activePowerPlays = consumedPPs;
        newState.activeBuffs = consumedBuffs;

        // Correctly handle 'One Tile to Rule Them All' charm
        if (newState.activeCharms.some(c => c.id === 'oneTileToRuleThemAll') && submittedTiles.some(t => t.tempPoints === 25)) {
            newState.activeCharms = newState.activeCharms.filter(c => c.id !== 'oneTileToRuleThemAll');
            newState.activeBuffs = newState.activeBuffs.filter(b => b.id !== 'oneTileToRuleThemAll');
        }

        dispatch({ type: 'HANDLE_SUBMIT_SUCCESS', payload: { gameState: newState, hand: finalHand, tileBag: finalBag, modalQueue }});
        if (modalQueue.length === 0) {
            handleStartNextRound();
        }

    } else {
        if (gameState.powerSurgeProgress === 3 || gameState.powerSurgeProgress === 4) {
            soundService.playComboDrop();
            showMessage("Combo Lost! Don't worry, even Jack couldn’t fix this one.", 3000);
        } else if (gameState.powerSurgeProgress > 0) {
            soundService.playComboDrop();
            showMessage('😵 Combo Dropped!', 2500);
        } else {
            soundService.playInvalidWord();
            const snitchActive = gameState.activeCharms.some(c => c.id === 'goldenSnitch');
            if (snitchActive) {
                showMessage('Invalid Word! Golden Snitch lost!', 2000);
            } else {
                showMessage('Invalid Word! Strike! Timer reset & +1 Tile', 2000);
            }
        }

      const invalidWordData: WordData = { word, score: 0, status: 'invalid' };
      dispatch({ type: 'UPDATE_GAME_STATE', payload: { words: [...gameState.words, invalidWordData] } });
      
      dispatch({ type: 'HANDLE_SUBMIT_FAIL' });
      dispatch({ type: 'ADD_STRIKE', payload: { source: 'invalid_word' } });
    }
    
    if (!wordLockActive) {
        dispatch({ type: 'SET_IS_LOADING', payload: false });
    }
  };

  const handleClear = () => {
    if (isChallengeLock) return;
    soundService.playClear();
    dispatch({ type: 'HANDLE_CLEAR' });
  };

  const handleChallenge = async () => {
    const isStrikeChallenge = state.gameState.challengeCount <= 0;
    const strikesRemaining = maxStrikes - state.gameState.strikes;

    if (isLoading || isPaused || buildRow.some(t => t !== null) || isChallengeLock) return;
    if (!isStrikeChallenge && state.gameState.challengeCount <= 0) return;
    if (isStrikeChallenge && strikesRemaining <= 0) return;

    soundService.playChallenge();
    dispatch({ type: 'SET_LOADING_MESSAGE', payload: "Consulting the word oracles...\n\n\"You've got to ask yourself one question: 'Do I feel lucky?' Well, do you, punk?\"" });
    dispatch({ type: 'SET_IS_LOADING', payload: true });

    const availableTiles = state.hand.filter((t): t is Tile => t !== null);
    let foundWord: string | null = null;
    let challengeLost = false;

    // 1. Internal Search (Quick Scan)
    for (const word of internalWords.keys()) {
        if (word.length >= 3 && gameUtils.canBeMadeFromRack(word, availableTiles)) {
            foundWord = word.toUpperCase();
            challengeLost = true;
            break;
        }
    }

    // 2. Gemini Check if internal search fails
    if (!challengeLost) {
        const letters = availableTiles.map(t => t.letter);
        const result = await geminiService.checkWordPossibility(letters);

        // 3. Quick local validation of Gemini's response
        if (result.possible && result.word && gameUtils.canBeMadeFromRack(result.word, availableTiles)) {
            foundWord = result.word;
            challengeLost = true;
        }
    }
    
    if (challengeLost && foundWord) {
        if (state.gameState.powerSurgeProgress === 3 || state.gameState.powerSurgeProgress === 4) {
            soundService.playComboDrop();
            showMessage("Combo Lost! Don't worry, even Jack couldn’t fix this one.", 3000);
        } else if (state.gameState.powerSurgeProgress > 0) {
            soundService.playComboDrop();
            showMessage('😵 Combo Dropped!', 2500);
        }

        const foundWordUpper = foundWord.toUpperCase();
        if (isStrikeChallenge) {
            // Auto-play the word, add a strike, and reset the round.
            soundService.playInvalidWord();
            showMessage(`Word Found: ${foundWordUpper}. You lose a strike.`, 3500);

            dispatch({ type: 'ADD_STRIKE', payload: { source: 'challenge' } });

            const wordDefForLog = internalWords.get(foundWordUpper.toLowerCase()) ?? (await geminiService.getDefinition(foundWordUpper) ?? "A valid word.");
            const challengedWordData: WordData = {
                word: `${foundWordUpper} (forced)`,
                score: 0,
                definition: `Auto-played after lost Strike Challenge. Original def: ${wordDefForLog}`,
                status: 'valid',
                cumulativeScore: state.gameState.score
            };
            dispatch({ type: 'UPDATE_GAME_STATE', payload: { 
                words: [...state.gameState.words, challengedWordData],
                consecutiveSuccesses: 0 // A lost challenge breaks streaks
            }});

            setTimeout(() => {
                const allTiles = [...state.hand.filter((t): t is Tile => t !== null)];
                resetRound(state.gameState, allTiles, [], state.tileBag);
            }, 1000);
            
            dispatch({ type: 'SET_IS_LOADING', payload: false });
            return;
        } else {
            // Regular challenge lost: force user to play the word.
            let tempHand = [...state.hand];
            let tilesToMove: { tile: Tile; originalIndex: number }[] = [];
            let possible = true;

            for (const letter of foundWordUpper) {
                const tileIndex = tempHand.findIndex(t => t?.letter === letter);
                if (tileIndex !== -1 && tempHand[tileIndex]) {
                    tilesToMove.push({ tile: tempHand[tileIndex]!, originalIndex: tileIndex });
                    tempHand[tileIndex] = null;
                } else {
                    possible = false;
                    break;
                }
            }

            if (possible) {
                const wordDefForLog = internalWords.get(foundWordUpper.toLowerCase()) ?? (await geminiService.getDefinition(foundWordUpper) ?? "A valid word.");
                dispatch({ type: 'SET_CHALLENGE_WORD_DATA', payload: { word: foundWordUpper, score: 0, definition: wordDefForLog, status: 'valid' } });
                soundService.playInvalidWord();
                showMessage(`A word was found: ${foundWordUpper}! Submit it for 0 points.`, 3000);
                dispatch({ type: 'UPDATE_GAME_STATE', payload: { challengeCount: state.gameState.challengeCount - 1 } });
                dispatch({ type: 'CHALLENGE_FAILED', payload: { tilesToMove } });
            } else {
                challengeLost = false; // Fallback to win condition
            }
        }
    }

    if (!challengeLost) {
      // CHALLENGE WON
      soundService.playMilestone();
      let messageText;
      if (isStrikeChallenge) {
        messageText = 'Challenge successful! No word found. Free shuffle!';
      } else {
        messageText = 'Challenge successful! No word found. Free shuffle! Challenge not consumed.';
      }
      showMessage(messageText, 3000);
      handleShuffle(true); // Free shuffle on win
    }

    dispatch({ type: 'SET_IS_LOADING', payload: false });
  };

  const handleActivatePowerPlay = (powerPlay: PowerPlay) => {
    if (isPaused || isChallengeLock) return;
    
    if (powerPlay.id === 'redWedding') {
        const handSize = hand.filter(t => t !== null).length;
        if (handSize < 10) {
            showMessage("Red Wedding requires a full hand of 10 tiles!", 2500);
            return;
        }
    }

    soundService.playPowerUp();

    // Special handling for Bob Kelso
    if (powerPlay.id === 'bobKelso') {
        const changes = powerPlay.activate(gameState);
        dispatch({
            type: 'UPDATE_GAME_STATE',
            payload: {
                ...changes,
                availablePowerPlays: gameState.availablePowerPlays.filter(p => p.id !== powerPlay.id),
            }
        });
        handleShuffle(true); // Free shuffle
        showMessage("✨ +100 points and a fresh hand!", 3000);
        return;
    }

    // Special handling for Echoes of the Past
    if (powerPlay.id === 'echoesOfThePast') {
        if (!gameState.highestScoringWord) {
            showMessage("No highest scoring word recorded yet!", 2000);
            return; // Don't consume if it does nothing
        }
        const changes = powerPlay.activate(gameState);
        dispatch({
            type: 'UPDATE_GAME_STATE',
            payload: {
                ...changes,
                availablePowerPlays: gameState.availablePowerPlays.filter(p => p.id !== powerPlay.id),
            }
        });
        dispatch({
            type: 'SET_MODAL_CONTENT',
            payload: {
                type: 'info',
                title: 'Echoes of the Past!',
                content: `You replayed your highest scoring word "${gameState.highestScoringWord.word.toUpperCase()}" for an extra ${gameState.highestScoringWord.score} points!`,
            }
        });
        return;
    }

    dispatch({ type: 'ACTIVATE_POWER_PLAY', payload: powerPlay });
  };

  const handleActivateCharm = (charm: Charm) => {
      if (isPaused || isChallengeLock) return;
      soundService.playPowerUp();
      dispatch({ type: 'ACTIVATE_CHARM', payload: charm });
  }

  const handleChoosePowerPlay = (powerPlay: PowerPlay) => {
    soundService.playUIClick();
    const immediateEffects: { [key: string]: () => void } = {
        gumpLuck: () => {
            const rand = Math.random();
            if (rand < 0.25) { // +10s
                dispatch({ type: 'ADD_TIME', payload: 10 });
                showMessage('🍫 +10 seconds! Run, Forrest, run!', 3000);
            } else if (rand < 0.50) { // +20 points
                dispatch({ type: 'UPDATE_GAME_STATE', payload: { score: gameState.score + 20 } });
                showMessage('🍫 +20 points! That\'s all I have to say about that.', 3000);
            } else if (rand < 0.75) { // +1 shuffle
                dispatch({ type: 'UPDATE_GAME_STATE', payload: { shuffleCount: gameState.shuffleCount + 1 } });
                showMessage('🍫 +1 Shuffle! Just like a box of chocolates.', 3000);
            } else { // +1 strike
                dispatch({ type: 'ADD_STRIKE' });
                showMessage('🍫 You got a strike! Stupid is as stupid does.', 3000);
            }
        },
    };

    if (immediateEffects[powerPlay.id]) {
        immediateEffects[powerPlay.id]();
        dispatch({ type: 'UPDATE_GAME_STATE', payload: { powerPlayOffer: [] } });
        handleCloseModal();
    } else {
        dispatch({type: 'CHOOSE_POWER_PLAY', payload: powerPlay});
    }
  };
  
  const handleChooseCharm = (charm: Charm) => {
      soundService.playUIClick();
      dispatch({ type: 'CHOOSE_CHARM', payload: { charm, hand } });
  }

  const handleSelectLetter = (letter: string) => {
      soundService.playUIClick();
      const powerPlay = POWER_PLAYS_LIST.find(p => p.id === modalContent?.data?.id);
      if(!powerPlay) return;
      dispatch({type: 'COMPLETE_POWER_PLAY_ACTIVATION', payload: {powerPlay, option: {letter}}});
  }

  const handleSelectTileForSwap = (tile: Tile, index: number) => {
      soundService.playTileClick();
      if(tilesToSwap.some(t => t.originalIndex === index)) {
          dispatch({type: 'REMOVE_TILE_FROM_SWAP', payload: {originalIndex: index}});
      } else {
          dispatch({type: 'ADD_TILE_TO_SWAP', payload: {tile, originalIndex: index}});
      }
  }

  const handleConfirmSwap = () => {
      soundService.playUIClick();
      const config = modalContent?.data?.swapConfig ?? {min: 2, max: 2};
      if (tilesToSwap.length < config.min || tilesToSwap.length > config.max) return;
      
      const indicesToReplace = tilesToSwap.map(t => t.originalIndex);
      const lettersToReturn = tilesToSwap.map(t => t.tile.letter);
      
      let newHand = [...hand];
      indicesToReplace.forEach(i => newHand[i] = null);
      
      const {newTiles, remainingBag} = gameUtils.drawTiles(tilesToSwap.length, [...tileBag, ...lettersToReturn]);
      
      newTiles.forEach(tile => {
          const emptyIndex = newHand.findIndex(slot => slot === null);
          if (emptyIndex !== -1) newHand[emptyIndex] = tile;
      });
      
      const { newHand: finalHand, newBag: finalBag } = gameUtils.postProcessHand(newHand, remainingBag, showMessage);
      
      dispatch({type: 'SET_HAND_AND_BAG', payload: {hand: finalHand, tileBag: finalBag}});
      dispatch({type: 'EXECUTE_SWAP'});
  }

  const handleSelectTileToTransform = (tile: Tile, originalIndex: number) => {
      soundService.playTileClick();
      dispatch({type: 'SELECT_TILE_TO_TRANSFORM', payload: {tile, originalIndex}});
  }
  
  const handleConfirmTransform = (newLetter: string) => {
      soundService.playUIClick();
      if(modalContent?.data) {
          dispatch({type: 'COMPLETE_CHARM_ACTIVATION', payload: {charm: modalContent.data, option: {newLetter}}});
      }
  }

  const handleNeoChoice = (choice: 'time' | 'strike') => {
      soundService.playUIClick();
      if(modalContent?.data) {
          dispatch({type: 'COMPLETE_POWER_PLAY_ACTIVATION', payload: {powerPlay: modalContent.data, option: {choice}}});
      }
  }

  const handleSelectTileForHookshot = (tile: Tile, originalIndex: number) => {
      soundService.playTileClick();
      dispatch({type: 'SELECT_TILE_FOR_HOOKSHOT', payload: {tile, originalIndex}});
  }

  const handleConfirmHookshot = () => {
      soundService.playUIClick();
      if(modalContent?.data) {
          dispatch({type: 'COMPLETE_POWER_PLAY_ACTIVATION', payload: {powerPlay: modalContent.data}});
      }
  }

  const handleSaveClick = () => {
    soundService.playUIClick();
    dispatch({ type: 'SHOW_SAVE_MODAL' });
  };

  const handleConfirmSave = () => {
      soundService.playUIClick();
      onSaveGame(state);
  }

  const calculatedPotentialScore = useMemo(() => {
    if (isChallengeLock) return 0;
    const currentBuild = buildRow.filter(i => i);
    if (currentBuild.length > 0) {
        const word = currentBuild.map(item => item!.tile.letter).join('');
        const tiles = currentBuild.map(item => item!.tile);
        return gameUtils.calculateScore(word, tiles, gameState).totalScore;
    }
    return 0;
  }, [buildRow, gameState, isChallengeLock]);

  if (isLoading && !isResuming) {
    return (
        <div className="flex flex-col h-full items-center justify-center text-center p-4">
             <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-amber-400 mb-4"></div>
             <h2 className="text-2xl font-bold text-slate-300 whitespace-pre-line">{state.loadingMessage || 'Loading Game...'}</h2>
        </div>
    );
  }
  
  const showBuffInfo = (buff: Charm | PowerPlay) => {
     soundService.playModalOpen();
     dispatch({ type: 'SET_MODAL_CONTENT', payload: { type: 'buff-info', title: buff.name, data: buff, content: '' }});
  };

  const renderModal = () => {
    if (!modalContent) return null;
    
    const { type, title, data, content } = modalContent;
    let modalBody: React.ReactNode = null;
    let description: React.ReactNode = null;
    
    const isTransparentModal = type === 'super-hand';

    // All cases will now populate modalBody and break, leading to a single return statement
    switch(type) {
        case 'save-confirmation':
            modalBody = (
                <div className="my-4">
                    <div className="text-left text-slate-200 space-y-3">
                        <p className="italic">"Goonies never say die... but they do take snack breaks."</p>
                        <p>Want to stash your progress in a secret underground cavern and come back later?</p>
                        <p>Saving now will send you back to the Main Menu. When you're ready to rejoin the adventure, just hit the Resume Game button and pick up right where you left off—traps, treasure, and all.</p>
                    </div>
                    <button onClick={handleConfirmSave} className="w-full mt-6 px-6 py-3 text-lg font-bold text-slate-900 bg-green-500 rounded-lg shadow-lg hover:bg-green-400 transition-colors">
                        YEP, STASH IT & HEAD TO THE MENU
                    </button>
                    <button onClick={handleCloseModal} className="w-full mt-2 px-6 py-2 text-md font-bold text-slate-100 bg-red-600 rounded-lg shadow-lg hover:bg-red-500 transition-colors">
                        NOPE, BACK TO THE ADVENTURE
                    </button>
                </div>
            );
            break;
        case 'info':
            modalBody = (
                <p className="text-slate-200 text-md my-4 whitespace-pre-wrap">{content}</p>
            );
            break;
        case 'super-hand':
            modalBody = (
                <>
                    <p className="text-slate-200 text-md my-4 whitespace-pre-wrap">{content}</p>
                    <div className="text-left space-y-2 mb-6 bg-slate-900/50 p-3 rounded-lg text-slate-100">
                        <p className="text-green-400 font-bold">+ {data.points} Super Hand Bonus!</p>
                        {data.gauntletBonus > 0 &&
                            <p className="text-purple-400 font-bold">+ {data.gauntletBonus} Infinity Gauntlet Bonus!</p>
                        }
                    </div>
                </>
            );
            break;
        case 'easter-egg':
            modalBody = (
                <>
                    <p className="text-slate-200 text-md my-4 whitespace-pre-wrap">{content}</p>
                    <div className="text-left space-y-2 mb-6 bg-slate-900/50 p-3 rounded-lg text-slate-100">
                      {data.reward.points > 0 && <p className="text-green-400 font-bold">+ {data.reward.points} Bonus Points!</p>}
                      {data.reward.shuffle > 0 && <p className="text-cyan-400 font-bold">+ {data.reward.shuffle} Shuffle(s)!</p>}
                    </div>
                </>
            );
            break;
        case 'word-bonus':
            modalBody = (
                <>
                    <p className="text-slate-200 text-md my-4 whitespace-pre-wrap">{content}</p>
                    <div className="text-left space-y-2 mb-6 bg-slate-900/50 p-3 rounded-lg text-slate-100">
                      {data.reward.points && <p className="text-green-400 font-bold">+ {data.reward.points} Bonus Points!</p>}
                    </div>
                </>
            );
            break;
        case 'charm-activation':
            if (data.selectionType === 'tile_transform') {
                if(!state.tileToTransform){
                    modalBody = (
                        <div className="my-4">
                            <p className="text-slate-100 mb-4">Select a tile from your hand to transform.</p>
                            <div className="flex flex-wrap justify-center gap-1">
                                {hand.map((tile, index) => (
                                    <div key={tile?.id || index} className="w-14 h-16 flex items-center justify-center">
                                        {tile ? <TileComponent tile={tile} onClick={() => handleSelectTileToTransform(tile, index)} /> : <div className="w-12 h-14 rounded-lg bg-slate-800/50"></div>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                } else {
                    modalBody = (
                        <div className="my-4">
                            <p className="text-slate-100 mb-2">Transform <span className="font-bold text-amber-400">{state.tileToTransform.tile.letter}</span> into:</p>
                             <div className="grid grid-cols-7 gap-1 text-center">
                                {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(char => (
                                    <button key={char} onClick={() => handleConfirmTransform(char)} className="p-2 bg-slate-700 hover:bg-slate-600 rounded text-slate-100">
                                        {char}
                                    </button>
                                ))}
                            </div>
                        </div>
                    );
                }
            }
            break;
        case 'powerplay-activation':
            if (data.selectionType === 'letter') {
                 modalBody = (
                    <div className="my-4">
                        <p className="text-slate-100 mb-4">{data.description}</p>
                        <div className="grid grid-cols-7 gap-1 text-center">
                            {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(char => (
                                <button key={char} onClick={() => handleSelectLetter(char)} className="p-2 bg-slate-700 hover:bg-slate-600 rounded text-slate-100">
                                    {char}
                                </button>
                            ))}
                        </div>
                    </div>
                );
            } else if (data.selectionType === 'tile_swap') {
                const config = data.swapConfig ?? {min: 2, max: 2};
                const message = config.min === config.max ? `Select ${config.max} tiles to swap.` : `Select ${config.min} to ${config.max} tiles to swap.`;
                const buttonDisabled = tilesToSwap.length < config.min || tilesToSwap.length > config.max;

                 modalBody = (
                    <div className="my-4">
                         <p className="text-slate-100 mb-4">{message} ({tilesToSwap.length}/{config.max})</p>
                         <div className="flex flex-wrap justify-center gap-1">
                             {hand.map((tile, index) => (
                                <div key={tile?.id || index} className="w-14 h-16 flex items-center justify-center">
                                    {tile ? (
                                        <div className={`p-1 rounded-lg ${tilesToSwap.some(t=>t.originalIndex === index) ? 'ring-2 ring-amber-400' : ''}`}>
                                          <TileComponent tile={tile} onClick={() => handleSelectTileForSwap(tile, index)} />
                                        </div>
                                    ) : (
                                        <div className="w-12 h-14 rounded-lg bg-slate-800/50"></div>
                                    )}
                                </div>
                            ))}
                         </div>
                         <button onClick={handleConfirmSwap} disabled={buttonDisabled} className="w-full mt-4 px-6 py-3 text-xl font-bold text-slate-900 bg-green-500 rounded-lg shadow-lg hover:bg-green-400 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors">SWAP</button>
                    </div>
                );
            } else if (data.selectionType === 'custom') {
                if (data.id === 'neosChoice') {
                    modalBody = (
                        <div className="my-4 space-y-3">
                            <p className="text-slate-100 mb-4">{data.description}</p>
                            <button onClick={() => handleNeoChoice('time')} className="w-full p-3 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors text-white font-bold">Blue Pill: +10 Seconds</button>
                            <button onClick={() => handleNeoChoice('strike')} disabled={gameState.strikes === 0} className="w-full p-3 bg-red-600 hover:bg-red-500 rounded-lg transition-colors text-white font-bold disabled:bg-slate-600 disabled:cursor-not-allowed">Red Pill: Erase a Strike</button>
                        </div>
                    );
                } else if (data.id === 'hookshot') {
                    if (!state.tileForHookshot) {
                        modalBody = (
                            <div className="my-4">
                                <p className="text-slate-100 mb-4">Select a tile from your hand to duplicate.</p>
                                <div className="flex flex-wrap justify-center gap-1">
                                    {hand.map((tile, index) => (
                                        <div key={tile?.id || index} className="w-14 h-16 flex items-center justify-center">
                                            {tile ? <TileComponent tile={tile} onClick={() => handleSelectTileForHookshot(tile, index)} /> : <div className="w-12 h-14 rounded-lg bg-slate-800/50"></div>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    } else {
                        modalBody = (
                            <div className="my-4">
                                <p className="text-slate-100 mb-2">Duplicate this tile?</p>
                                <div className="flex justify-center my-4">
                                    <TileComponent tile={state.tileForHookshot.tile} onClick={() => {}} />
                                </div>
                                <button onClick={handleConfirmHookshot} className="w-full mt-4 px-6 py-3 text-xl font-bold text-slate-900 bg-green-500 rounded-lg shadow-lg hover:bg-green-400 transition-colors">DUPLICATE</button>
                            </div>
                        );
                    }
                }
            }
            break;
        case 'milestone':
            modalBody = (
              <>
                <div className="text-5xl my-4">{data.icon}</div>
                <p className="text-slate-200 text-lg mb-4">{data.flavorText}</p>
                <div className="text-left space-y-2 mb-6 bg-slate-900/50 p-3 rounded-lg text-slate-100">
                  {data.reward.points && <p className="text-green-400">+ {data.reward.points} Bonus Points!</p>}
                  {data.configChange?.minWordLength && <p>Minimum word length is now {data.configChange.minWordLength}.</p>}
                  {data.configChange?.timerDuration && <p>You now have {data.configChange.timerDuration} seconds per round.</p>}
                </div>
              </>
            );
            break;
        case 'powerplay-selection':
            description = <p className="text-slate-100 mb-4">Your combo earned you a choice of one-time abilities!</p>;
            modalBody = (
                <div className="space-y-3 my-4">
                  {data.map((pp: PowerPlay) => (
                    <button key={pp.id} onClick={() => handleChoosePowerPlay(pp)} className="w-full text-left p-3 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors">
                      <p className="font-bold text-amber-400">{pp.icon} {pp.name}</p>
                      <p className="text-sm text-slate-100">{pp.description}</p>
                      <p className="text-xs text-gray-400 italic mt-1">{pp.flavorText}</p>
                    </button>
                  ))}
                </div>
            );
            break;
        case 'charm-selection':
            description = <p className="text-slate-100 mb-4">Your word count has earned you a new passive charm!</p>;
            modalBody = (
                <div className="space-y-3 my-4">
                  {data.map((c: Charm) => (
                    <button key={c.id} onClick={() => handleChooseCharm(c)} className="w-full text-left p-3 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors">
                      <p className="font-bold text-amber-400">{c.icon} {c.name}</p>
                      <p className="text-sm text-slate-100">{c.description}</p>
                      {c.maxUses === 1 && (
                        <span className="block text-xs font-bold text-red-400/90 uppercase tracking-wider mt-1">One-Time Use</span>
                      )}
                      <p className="text-xs text-gray-400 italic mt-1">{c.flavorText}</p>
                    </button>
                  ))}
                </div>
            );
            break;
        case 'word-log':
             modalBody = <WordLogModalContent words={gameState.words} />;
             break;
        case 'buff-info':
          modalBody = (
            <>
              <div className="text-5xl my-4">{data.icon}</div>
              <p className="text-slate-200 text-lg mb-4">{data.description}</p>
              <p className="text-sm text-gray-400 italic mt-1">{data.flavorText}</p>
            </>
          );
        break;
    }

    const backgroundClass = isTransparentModal
      ? "absolute inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      : "absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4";

    const noGenericButtons = ['powerplay-activation', 'charm-activation', 'powerplay-selection', 'charm-selection', 'save-confirmation', 'word-log'];
    const showContinueButton = !noGenericButtons.includes(type);

    // The single, unified return for all modals.
    return (
        <div className={backgroundClass}>
            <div className="bg-slate-800 border-2 border-amber-400 rounded-2xl p-6 text-center shadow-2xl max-w-md w-full animate-fade-in">
                <h2 className="text-3xl font-bold text-amber-400 mb-2">{title}</h2>
                {description}
                {modalBody}
                {showContinueButton && (
                  <button onClick={handleCloseModal} className="w-full mt-4 px-6 py-3 text-xl font-bold text-slate-900 bg-amber-400 rounded-lg shadow-lg hover:bg-amber-300 transition-colors">CONTINUE</button>
                )}
                {(type === 'powerplay-activation' || type === 'charm-activation') && (
                  <button onClick={handleCloseModal} className="w-full mt-4 px-6 py-2 text-md font-bold text-slate-100 bg-red-600 rounded-lg shadow-lg hover:bg-red-500 transition-colors">CANCEL</button>
                )}
                 {type === 'word-log' && (
                  <button onClick={handleCloseModal} className="w-full mt-4 px-6 py-3 text-xl font-bold text-slate-900 bg-amber-400 rounded-lg shadow-lg hover:bg-amber-300 transition-colors">CLOSE</button>
                )}
            </div>
        </div>
    );
  }

  const showMilestoneInfo = (milestone: Milestone) => {
     soundService.playModalOpen();
     dispatch({ type: 'SET_MODAL_CONTENT', payload: { type: 'milestone', title: milestone.name, data: milestone, content: '' }});
  };
  
  const goldenSnitchActive = gameState.activeCharms.some(c => c.id === 'goldenSnitch');

  return (
    <div className="flex flex-col h-full p-4 space-y-1 relative">
      {renderModal()}
      <header className="grid grid-cols-5 items-center text-center gap-1">
        <div className="text-lg font-bold text-amber-400">SCORE <br/><span className={`font-digital text-white transition-all ${gameState.score >= 10000 ? 'text-2xl' : 'text-3xl'}`}>{gameState.score}</span></div>
        <div className="text-lg font-bold text-cyan-400">WORDS<br/><span className="font-digital text-3xl text-white">{gameState.words.length}</span></div>
        <Timer time={time} />
        <div className="text-lg font-bold text-red-500">STRIKES<br/>
          <div className="flex justify-center items-center space-x-2 mt-1">
            {[...Array(maxStrikes)].map((_, i) => (
              <div key={i} className={`w-5 h-5 rounded-full transition-colors ${i < gameState.strikes ? 'bg-red-500' : 'bg-slate-600'}`}></div>
            ))}
          </div>
        </div>
        <div className="flex justify-end items-center">
            <button onClick={handleSaveClick} className="text-2xl text-slate-400 hover:text-white p-2 transition-transform hover:scale-110" aria-label="Save game">
                💾
            </button>
        </div>
      </header>
      
      <div className="flex justify-center items-center space-x-3 py-1 bg-slate-900/50 rounded-lg">
          {MILESTONES_LIST.map(ms => {
              const isUnlocked = gameState.unlockedMilestoneIds.includes(ms.id);
              return (
                  <button key={ms.id} onClick={() => showMilestoneInfo(ms)} className={`transition-all duration-300 ${isUnlocked ? 'opacity-100' : 'opacity-30'}`} title={`${ms.name} (${ms.scoreThreshold} pts)`}>
                      <span className={`text-2xl ${isUnlocked ? 'text-amber-400' : 'text-slate-500'}`}>{ms.icon}</span>
                  </button>
              )
          })}
           <button onClick={() => { soundService.playUIClick(); dispatch({ type: 'SET_MODAL_CONTENT', payload: { type: 'word-log', title: 'Word Log', content: '' } }); }} className="text-slate-400 hover:text-amber-400 transition-colors" aria-label="Word Log">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
           </button>
            <button onClick={handleMuteToggle} className="text-2xl text-slate-400 hover:text-white p-2 ml-4 transition-transform hover:scale-110" aria-label="Toggle sound">
                {isMuted ? '🔇' : '🔊'}
            </button>
      </div>

       <div className="text-center text-sm font-bold text-slate-300">
        POWERPLAY PROGRESS
        <div className="flex justify-center items-center space-x-3 mt-1">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex flex-col items-center">
              <div className={`w-5 h-5 rounded-full border-2 transition-all duration-300 ${
                i < gameState.powerPlayProgress.streak && gameState.powerPlayProgress.cooldown === 0
                  ? 'bg-yellow-400 border-yellow-400'
                  : 'bg-slate-700 border-slate-600'
              }`}>
              </div>
              {i < gameState.powerPlayProgress.streak && gameState.powerPlayProgress.cooldown === 0 && gameState.powerPlayProgress.targetDigit !== null && (
                <span className="text-xs font-digital text-yellow-500 mt-1">
                  {gameState.powerPlayProgress.targetDigit}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
      
      {goldenSnitchActive && (
          <div className="text-center py-1">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Golden Snitch 🕊️ Streak</span>
              <div className="flex justify-center items-center space-x-2 mt-1">
                  {[...Array(5)].map((_, i) => (
                      <div key={i} className={`w-4 h-4 rounded-full transition-all duration-300 border-2 ${i < gameState.consecutiveSuccesses ? 'bg-amber-400 border-amber-300' : 'bg-slate-700 border-slate-600'}`}></div>
                  ))}
              </div>
          </div>
      )}

       <div className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
        Active Buffs
        {gameState.activeBuffs.length > 0 ? (
          <div className="flex justify-center items-center flex-wrap gap-2 mt-1 bg-slate-900/50 rounded-lg p-2 min-h-[40px]">
            {gameState.activeBuffs.map((buff, index) => (
              <div key={buff.instanceId || `${buff.id}-${index}`} className="relative">
                <button className="text-2xl transform hover:scale-125 transition-transform" title={`${buff.name}: ${buff.description}`} onClick={() => showBuffInfo(buff)}>
                  {buff.icon}
                </button>
                {buff.id === 'goldenSnitch' && (
                  <div className="absolute -top-1 right-[-10px] text-xs font-bold text-amber-300 bg-slate-800 bg-opacity-80 px-1 rounded pointer-events-none">
                    {gameState.consecutiveSuccesses}/5
                  </div>
                )}
                {buff.id === 'glitchInTheCode' && (
                  <div className="absolute -top-1 right-[-10px] text-xs font-bold text-cyan-300 bg-slate-800 bg-opacity-80 px-1 rounded pointer-events-none">
                    {gameState.consecutiveSuccesses}/6
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-slate-500 text-xs italic mt-1 min-h-[40px] flex justify-center items-center">(None active)</div>
        )}
      </div>

      <div className="relative flex-grow flex flex-col justify-end">
        {message && <div className="absolute top-1 left-1/2 -translate-x-1/2 bg-black bg-opacity-70 text-white text-base font-bold px-3 py-1 rounded-lg z-20 animate-pulse text-center max-w-md">{message}</div>}
        
        {buildRow.filter(t => t).length >= 5 && (
            <div className="text-center text-amber-400 font-bold text-lg animate-pulse mb-1" aria-live="polite">
                2x Word Score Bonus!
            </div>
        )}
        
        <div className="w-full min-h-[72px] bg-slate-900/50 rounded-lg flex items-center justify-between p-1 mb-1">
            <div className="flex-grow grid grid-cols-8 gap-1">
                {[...Array(BUILD_ROW_SIZE)].map((_, index) => {
                    const item = buildRow[index];
                    return (
                        <div key={index} 
                            className={`relative w-full h-16 rounded-lg bg-slate-800/50 flex items-center justify-center 
                                        border-2 ${isChallengeLock ? 'border-sky-400' : 'border-transparent'}`}
                        >
                            {item ? (
                                <TileComponent tile={item.tile} onClick={() => handleReturnToHand(index)} />
                            ) : (
                                <div/>
                            )}
                        </div>
                    );
                })}
            </div>
            {buildRow.some(t => t !== null) && 
              <div className="flex-shrink-0 w-24 text-center" title="Potential Score">
                  <span className="font-digital text-amber-400 text-4xl">{calculatedPotentialScore > 0 ? calculatedPotentialScore : ''}</span>
              </div>
            }
        </div>
        
        <div className={`w-full bg-slate-700 rounded-lg flex flex-wrap items-center justify-center p-1 gap-1 ${isChallengeLock || isPaused ? 'opacity-50' : ''}`}>
          {hand.map((tile, index) => (
              <div key={tile?.id || index} className="w-14 h-16 flex items-center justify-center">
                  {tile ? (
                      <TileComponent tile={tile} onClick={() => handleMoveToBuild(tile, index)} />
                  ) : (
                      <div className="w-12 h-14 rounded-lg bg-slate-800/50"></div>
                  )}
              </div>
          ))}
        </div>
      </div>
      
      {(gameState.availablePowerPlays.length > 0 || gameState.availableCharms.length > 0) && (
          <div className="flex justify-center items-center space-x-2 p-2 bg-slate-900/50 rounded-lg">
            <span className="font-bold text-sm text-slate-300">ABILITIES:</span>
            {gameState.availablePowerPlays.map(pp => {
              const isRedWedding = pp.id === 'redWedding';
              const handSize = hand.filter(t => t !== null).length;
              const isRedWeddingDisabled = isRedWedding && handSize < 10;
              return (
              <button 
                key={pp.id} 
                className="text-2xl hover:scale-125 transition-transform disabled:opacity-50 disabled:cursor-not-allowed" 
                title={isRedWeddingDisabled ? `${pp.name}: Requires a full hand of 10 tiles.` : `${pp.name}: ${pp.description}`}
                onClick={() => handleActivatePowerPlay(pp)}
                disabled={isChallengeLock || (pp.id === 'rewind' && gameState.strikes === 0) || isRedWeddingDisabled}
              >
                {pp.icon}
              </button>
            )})}
            {gameState.availableCharms.map(c => (
              <button 
                key={c.id} 
                className="text-2xl hover:scale-125 transition-transform" 
                title={`${c.name}: ${c.description}`}
                onClick={() => handleActivateCharm(c)}
                disabled={isChallengeLock}
              >
                {c.icon}
              </button>
            ))}
          </div>
        )}

      <div className="grid grid-cols-2 gap-2">
         <button onClick={handleSubmit} className="py-3 px-4 font-bold rounded-lg bg-green-600 hover:bg-green-500 transition-colors disabled:bg-slate-500" disabled={buildRow.filter(i=>i).length < gameState.gameConfig.minWordLength || isPaused}>SUBMIT</button>
         <button onClick={() => handleShuffle(false)} disabled={gameState.shuffleCount <= 0 || isPaused || isChallengeLock} className="py-3 px-4 font-bold rounded-lg bg-slate-600 hover:bg-slate-500 transition-colors disabled:bg-gray-700 disabled:cursor-not-allowed">SHUFFLE ({gameState.shuffleCount})</button>
      </div>
       <div className="grid grid-cols-2 gap-2 mt-1">
            <button onClick={handleClear} disabled={isPaused || isChallengeLock} className="py-2 px-4 font-bold rounded-lg bg-yellow-600 hover:bg-yellow-500 transition-colors disabled:bg-gray-700 disabled:cursor-not-allowed">CLEAR</button>
            {gameState.challengeCount > 0 ? (
                <button 
                    onClick={handleChallenge} 
                    disabled={isPaused || isLoading || buildRow.some(t => t !== null) || isChallengeLock} 
                    className="py-2 px-4 font-bold rounded-lg bg-sky-600 hover:bg-sky-500 transition-colors disabled:bg-gray-700 disabled:cursor-not-allowed"
                >
                    CHALLENGE ({gameState.challengeCount})
                </button>
            ) : (
                <button 
                    onClick={handleChallenge} 
                    disabled={(maxStrikes - gameState.strikes <= 0) || isPaused || isLoading || buildRow.some(t => t !== null) || isChallengeLock} 
                    className="py-2 px-4 font-bold rounded-lg bg-red-600 hover:bg-red-500 transition-colors disabled:bg-gray-700 disabled:cursor-not-allowed"
                >
                    STRIKE CHALLENGE ({maxStrikes - gameState.strikes})
                </button>
            )}
       </div>
    </div>
  );
};

export default GameScreen;