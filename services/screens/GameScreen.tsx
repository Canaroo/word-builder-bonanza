// Game logic and state. Layout lives in GameScreenView.tsx.
import React, { useReducer, useEffect, useCallback, useMemo, useState } from 'react';
import { GameState, Tile, WordData, Milestone, Charm, PowerPlay, ScoreCalculationResult, ScoreBonusInfo, LogEntry, WordLogEntry, EventLogEntry, GameOverLogEntry } from '../../types';
import { RACK_SIZE, HAND_SIZE, BALANCE_REPLACE_COUNT, VOWELS, INITIAL_SHUFFLES, MAX_STRIKES_INITIAL, SUPER_HAND_BONUS, TILE_DISTRIBUTION, INITIAL_CHALLENGES, COMBO_TILES } from '../../constants';
import * as gameUtils from '../gameUtils';
import { MILESTONES_LIST } from '../../data/milestones';
import { CHARMS_LIST } from '../../data/charms';
import { POWER_PLAYS_LIST } from '../../data/powerPlays';
import { EASTER_EGGS } from '../../data/easterEggs';
import { WORD_BONUSES } from '../../data/wordBonuses';
import { soundService } from '../soundService';
import { dictionaryService } from '../dictionaryService';
import { missedWordsService } from '../missedWordsService';
import { storage, STORAGE_KEYS } from '../storage';
import { showToast } from '../toast';
import { assignTilesToWord } from '../rackMatch';
import { useDocumentVisible } from '../useDocumentVisible';
import { addWordMultiplier, lengthMultiplier, refillCount, clampTime, timeForWord, advancePowerPlayMeter, advanceStrikeRecovery } from '../rules';
import { GAMEPLAY } from '../../config/gameplay';
import { GameScreenView, GameScreenViewProps, ModalContent } from './GameScreenView';


interface GameScreenProps {
  playerName: string;
  onGameOver: (gameState: GameState) => void;
  onSaveGame: (state: GameScreenState) => void;
  isResuming: boolean;
  onTimeLow: (isLow: boolean) => void;
  onGoldenRoundChange: (isGolden: boolean) => void;
  onScoreUpdate: (oldScore: number, newScore: number) => void;
  onLexCoinChange: (amount: number) => void;
  tileClass: string;
  powerWord?: string;
}

const BUILD_ROW_SIZE = 8;

const initialGameState: GameState = {
  score: 0,
  log: [],
  longestWord: '',
  foundEasterEggs: [],
  gameConfig: {
    timerDuration: GAMEPLAY.timeBank.start,
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
      letters: 0,
  },
  strikeRecoveryStreak: 0,

  powerSurgeProgress: 0,

  activeCharms: [],
  availablePowerPlays: [],
  unlockedMilestoneIds: [],
  unlockedWordBonusIds: [],
  
  // Charm and PowerPlay states
  charmUses: {},
  powerPlayUses: {},
  activePowerPlays: {}, // To store temporary effects
  powerPlayToActivate: null,
  availableCharms: [],
  charmToActivate: null,
  powerPlayOffer: [],
  lastPowerPlayResult: null,
  highestScoringWord: null,
  activeBuffs: [],

  powerPlayCooldowns: {},
  charmCooldowns: {},

  letterMultipliers: {},
  wordMultipliersByLetter: {},

  // Specific Charm/PowerPlay States
  flawlessScore: 0,
  pianoManEncoreActive: false,
  glitchActive: false,
  wordsThisRound: 0,
  lastSubmissionTime: 0, 
  consecutiveSuccesses: 0,
  longestStreak: 0,
  multiverseTimeBonus: 0,
  pendingTimeBonus: 0,
  bankedTime: null,
  duckHuntComboState: { streakLetters: null, streakCount: 0 },
  drMarioCureStreak: 0,
  powerStarResidualActive: false,
  warioTimeDebt: 0,
  powerWordUsed: false,
  perfectChainProgress: 0,
  groundhogDayCharges: 0,

  // Golden Round State
  roundType: 'normal',
  consecutiveValidWords: 0,
  goldenRoundThreshold: 11,
  goldenTileId: null,

  // New state for weighted item selection
  runSeed: Date.now(),
  offerHistory: [],
  itemStats: {},
  sessionOfferCounts: {},
  totalOffersMade: 0,
};

export type GameScreenState = {
  /** Last change to the time bank, shown as a floating +Ns / -Ns next to the clock. */
  timeGain?: { seconds: number; key: number };
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
  tileForSelection: { tile: Tile, originalIndex: number } | null;
  lastTurnState: { gameState: GameState; hand: (Tile | null)[]; buildRow: ({tile: Tile, originalIndex: number} | null)[]; time: number; tileBag: string[] } | null;
  highlightedTileIds: { first: string | null; rest: string[] };
  longWordBonusNotified: boolean;
}

export const screenInitialState: GameScreenState = {
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
  tileForSelection: null,
  lastTurnState: null,
  highlightedTileIds: { first: null, rest: [] },
  longWordBonusNotified: false,
}

type GameAction = 
    | { type: 'SET_IS_LOADING', payload: boolean }
    | { type: 'SET_LOADING_MESSAGE', payload: string | null }
    | { type: 'SET_HAND_AND_BAG', payload: { hand: (Tile | null)[], tileBag: string[] } }
    | { type: 'SET_MESSAGE', payload: string }
    | { type: 'CLEAR_MESSAGE'; payload?: string }
    | { type: 'PAUSE_GAME' }
    | { type: 'RESUME_GAME' }
    | { type: 'TICK_TIMER' }
    | { type: 'ADD_TIME', payload: number }
    | { type: 'SET_TIME', payload: number }
    | { type: 'MOVE_TILE_TO_BUILD', payload: { tile: Tile, fromIndex: number } }
    | { type: 'RETURN_TILE_TO_HAND', payload: { fromBuildIndex: number } }
    | { type: 'HANDLE_SUBMIT_SUCCESS', payload: any }
    | { type: 'ADD_STRIKE', payload?: { source: 'invalid_word' | 'challenge' } }
    | { type: 'HANDLE_SUBMIT_FAIL' }
    | { type: 'PERFORM_SHUFFLE', payload: { hand: (Tile | null)[], tileBag: string[], isFree: boolean, isFromChallengeWin?: boolean } }
    | { type: 'PERFORM_INSTANT_SHUFFLE', payload: { hand: (Tile | null)[], tileBag: string[] } }
    | { type: 'CHALLENGE_FAILED', payload: { tilesToMove: { tile: Tile, originalIndex: number }[] } }
    | { type: 'HANDLE_CLEAR' }
    | { type: 'SET_MODAL_CONTENT', payload: ModalContent }
    | { type: 'CLOSE_MODAL' }
    | { type: 'UPDATE_GAME_STATE', payload: Partial<GameState> }
    | { type: 'CHOOSE_CHARM', payload: { charm: Charm; hand: (Tile | null)[]; allOffered: Charm[] } }
    | { type: 'CHOOSE_POWER_PLAY', payload: { powerPlay: PowerPlay; allOffered: PowerPlay[] } }
    | { type: 'ACTIVATE_POWER_PLAY', payload: PowerPlay }
    | { type: 'COMPLETE_POWER_PLAY_ACTIVATION', payload: { powerPlay: PowerPlay, option?: any } }
    | { type: 'ADD_TILE_TO_SWAP', payload: { tile: Tile, originalIndex: number } }
    | { type: 'REMOVE_TILE_FROM_SWAP', payload: { originalIndex: number } }
    | { type: 'EXECUTE_SWAP' }
    | { type: 'RESET_ROUND', payload: { hand: (Tile | null)[], tileBag: string[] } }
    | { type: 'START_NEXT_ROUND' }
    | { type: 'ACTIVATE_CHARM', payload: Charm }
    | { type: 'SELECT_TILE_TO_TRANSFORM', payload: { tile: Tile, originalIndex: number } | null }
    | { type: 'COMPLETE_CHARM_ACTIVATION', payload: { charm: Charm, option?: any } }
    | { type: 'SET_CHALLENGE_WORD_DATA', payload: WordData | null }
    | { type: 'SHOW_SAVE_MODAL' }
    | { type: 'RESTART_ROUND_GROUNDHOG' }
    | { type: 'GAME_OVER_INITIATED', payload: { reason: 'strikes' | 'time'; word?: string } }
    | { type: 'SELECT_TILE_FOR_SELECTION', payload: { tile: Tile, originalIndex: number } | null }
    | { type: 'STORE_LAST_TURN' }
    | { type: 'RESTORE_LAST_TURN' }
    | { type: 'SET_HIGHLIGHTED_TILES', payload: { first: string | null; rest: string[] } }
    | { type: 'SET_LONG_WORD_BONUS_NOTIFIED', payload: boolean };


// Time bank (config/gameplay.ts): the clock never resets between words. A Golden Round runs on
// its own short clock; the bank is set aside when it starts and given back when it ends.
const settleTimeBank = (time: number, gs: GameState): { time: number; gs: GameState } => {
    const pending = gs.pendingTimeBonus ?? 0;
    if (gs.roundType === 'golden' && gs.bankedTime == null) {
        return { time: GAMEPLAY.goldenRoundSeconds, gs: { ...gs, bankedTime: clampTime(time + pending), pendingTimeBonus: 0 } };
    }
    if (gs.roundType !== 'golden' && gs.bankedTime != null) {
        return { time: clampTime(gs.bankedTime + pending), gs: { ...gs, bankedTime: null, pendingTimeBonus: 0 } };
    }
    return { time, gs };
};

export function gameReducer(state: GameScreenState, action: GameAction): GameScreenState {
    let { gameState } = state;

    switch (action.type) {
        case 'SET_IS_LOADING': return { ...state, isLoading: action.payload, loadingMessage: action.payload ? state.loadingMessage : null };
        case 'SET_LOADING_MESSAGE': return { ...state, loadingMessage: action.payload };
        case 'SET_HAND_AND_BAG': return { ...state, hand: action.payload.hand, tileBag: action.payload.tileBag };
        case 'SET_MESSAGE': return { ...state, message: action.payload };
        // Only clear the message this timer belongs to, so a newer message isn't cut short.
        case 'CLEAR_MESSAGE': return action.payload === undefined || state.message === action.payload ? { ...state, message: '' } : state;
        case 'PAUSE_GAME': return { ...state, isPaused: true };
        case 'RESUME_GAME': return { ...state, isPaused: false, time: state.time }; // Prevent timer reset on resume
        case 'TICK_TIMER': return { ...state, time: state.time - 1 };
        case 'ADD_TIME': return {...state, time: clampTime(state.time + action.payload) };
        case 'SET_TIME': return { ...state, time: action.payload };
        case 'UPDATE_GAME_STATE': return { ...state, gameState: { ...state.gameState, ...action.payload } };
        case 'SET_CHALLENGE_WORD_DATA': return { ...state, challengeWordData: action.payload };
        case 'SELECT_TILE_FOR_SELECTION': return { ...state, tileForSelection: action.payload };
        case 'STORE_LAST_TURN':
            // Snapshot for the Sliders PowerPlay, which rewinds to just before the last word.
            return {
                ...state,
                lastTurnState: {
                    gameState: state.gameState,
                    hand: state.hand,
                    buildRow: state.buildRow,
                    time: state.time,
                    tileBag: state.tileBag,
                },
            };
        case 'SET_HIGHLIGHTED_TILES': return { ...state, highlightedTileIds: action.payload };
        case 'SET_LONG_WORD_BONUS_NOTIFIED': return { ...state, longWordBonusNotified: action.payload };
        case 'RESTORE_LAST_TURN': {
            if (state.lastTurnState) {
                const scoreChange = state.lastTurnState.gameState.score - state.gameState.score;
                const newLogEntry: EventLogEntry = {
                    type: 'event', id: `pp-sliders-${Date.now()}`, name: 'Sliders',
                    description: 'Reverted to the state of the previous turn.', icon: '📼',
                    scoreChange: scoreChange, cumulativeScore: state.lastTurnState.gameState.score
                };

                // Reconstruct the hand by returning tiles from the saved buildRow to the saved hand.
                let restoredHand = [...state.lastTurnState.hand];
                state.lastTurnState.buildRow.forEach(item => {
                    if (item) {
                        // Place tile back in its original slot.
                        restoredHand[item.originalIndex] = item.tile;
                    }
                });
                
                const restoredGameState = {
                    ...state.lastTurnState.gameState,
                    log: [...state.lastTurnState.gameState.log, newLogEntry],
                    availablePowerPlays: state.gameState.availablePowerPlays.filter(p => p.id !== 'sliders'),
                    powerPlayUses: { ...state.gameState.powerPlayUses, sliders: 1 }
                };

                return {
                    ...state,
                    // Restore state from last turn
                    time: state.lastTurnState.time,
                    tileBag: state.lastTurnState.tileBag,
                    hand: restoredHand,
                    buildRow: Array(BUILD_ROW_SIZE).fill(null), // Clear build row for the new-old turn
                    gameState: restoredGameState,

                    // Clear modal and resume game
                    modalContent: null,
                    isPaused: false,
                    lastTurnState: null, // Sliders is one-time use, so we clear the state
                };
            }
            return state;
        }

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
            const { hand, tileBag, modalQueue } = action.payload;
            const [firstModal = null, ...restOfQueue] = modalQueue || [];
            // Entering or leaving a Golden Round swaps between the bank and the Golden clock.
            const { time, gs: newGameState } = settleTimeBank(state.time, action.payload.gameState);
            
            let finalState = {
                ...state,
                time,
                gameState: newGameState,
                hand,
                tileBag,
                buildRow: Array(BUILD_ROW_SIZE).fill(null),
                isPaused: firstModal !== null,
                modalContent: firstModal,
                modalQueue: restOfQueue,
                highlightedTileIds: { first: null, rest: [] }, // Reset highlights on success
                longWordBonusNotified: false,
            };

            return finalState;
        }
        
        case 'ADD_STRIKE': {
          let { strikes, activePowerPlays, activeBuffs, score, powerPlayProgress, consecutiveSuccesses, flawlessScore, activeCharms, powerSurgeProgress, lastPowerPlayResult, duckHuntComboState, consecutiveValidWords, perfectChainProgress } = gameState;
          let actuallyGotAStrike = false;
          let strikeBlockedByShield = false;
          
          if(activePowerPlays.strikeShield) {
            delete activePowerPlays.strikeShield;
            activeBuffs = activeBuffs.filter(b => b.id !== 'strikeShield');
            lastPowerPlayResult = { message: "🛡️ Strike Shield absorbed the hit!", scoreChange: 0 };
            strikeBlockedByShield = true;
          } else if(activePowerPlays.plotArmor) {
              delete activePowerPlays.plotArmor;
              activeBuffs = activeBuffs.filter(b => b.id !== 'plotArmor');
              score = Math.max(0, score - 150);
              lastPowerPlayResult = { message: "💸 Plot Armor was consumed, saving you from a strike for 150 points.", scoreChange: -150 };
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

          if (activePowerPlays.sonicSpeed) {
              delete activePowerPlays.sonicSpeed;
              activeBuffs = activeBuffs.filter(b => b.id !== 'sonicSpeed');
              lastPowerPlayResult = { message: "💨 Sonic Speed challenge failed!", scoreChange: 0 };
          }

          const newPowerPlayProgress = { ...powerPlayProgress, streak: 0, targetDigit: null };
          consecutiveSuccesses = 0; // Reset streaks on any strike
          consecutiveValidWords = 0; // Reset Golden Round streak
          perfectChainProgress = 0;
          const strikeRecoveryStreak = 0; // A strike (even a shielded one) restarts strike recovery
          duckHuntComboState = { streakLetters: null, streakCount: 0 }; // Reset Duck Hunt Combo streak

          let newTime = state.time;
          let newHand = [...state.hand];
          let newTileBag = state.tileBag;
          
          let tempGameState = { ...gameState, strikes, activePowerPlays, activeBuffs, score, consecutiveSuccesses, flawlessScore, powerPlayProgress: newPowerPlayProgress, activeCharms, powerSurgeProgress, lastPowerPlayResult, duckHuntComboState, consecutiveValidWords, perfectChainProgress, strikeRecoveryStreak };
          
          if ((actuallyGotAStrike || strikeBlockedByShield) && action.payload?.source === 'invalid_word') {
              // An invalid word costs time from the bank.
              newTime = clampTime(state.time - GAMEPLAY.timeBank.invalidPenalty);
              
              // Add a new tile while the hand is below the standard size; otherwise swap one.
              const hasSpace = newHand.filter(t => t !== null).length < HAND_SIZE;
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
              // Enforce duplicate rule after adding tile on strike
              const dupeCheckResult = gameUtils.handleDuplicateLetters(newHand, newTileBag);
              newHand = dupeCheckResult.newHand;
              newTileBag = dupeCheckResult.newBag;
          }
          
          return { 
            ...state,
            time: newTime,
            timeGain: newTime !== state.time ? { seconds: newTime - state.time, key: Date.now() } : state.timeGain,
            hand: newHand,
            tileBag: newTileBag,
            gameState: tempGameState,
          };
        }

        case 'HANDLE_SUBMIT_FAIL': {
            let tempHand = [...state.hand];
            state.buildRow.filter(i => i).forEach(item => {
                if(item!.originalIndex < tempHand.length && tempHand[item!.originalIndex] === null){
                    tempHand[item!.originalIndex] = item!.tile;
                } else {
                    const emptyIndex = tempHand.findIndex(t => t === null);
                    if(emptyIndex !== -1) tempHand[emptyIndex] = item!.tile;
                }
            });
            return { ...state, hand: tempHand, buildRow: Array(BUILD_ROW_SIZE).fill(null) };
        }

        case 'PERFORM_SHUFFLE': {
            let newGameState = { ...gameState };
            let newPowerSurgeProgress = newGameState.powerSurgeProgress;
            if (!action.payload.isFree && newPowerSurgeProgress > 0) {
                newPowerSurgeProgress = 0;
            }

            const allTilesInPlay = [...state.hand, ...state.buildRow.map(item => item?.tile)].filter((t): t is Tile => t != null);
            if (allTilesInPlay.some(tile => tile.tempPoints === 25)) {
                newGameState.activeCharms = newGameState.activeCharms.filter(c => c.id !== 'oneTileToRuleThemAll');
                newGameState.activeBuffs = newGameState.activeBuffs.filter(b => b.id !== 'oneTileToRuleThemAll');
            }

            let newHand = action.payload.hand;
            
            const newConsecutiveValidWords = action.payload.isFromChallengeWin 
                ? state.gameState.consecutiveValidWords 
                : 0;

            return {
                ...state,
                hand: newHand,
                tileBag: action.payload.tileBag,
                buildRow: Array(BUILD_ROW_SIZE).fill(null),
                longWordBonusNotified: false,
                highlightedTileIds: { first: null, rest: [] },
                gameState: { 
                  ...newGameState, 
                  shuffleCount: action.payload.isFree ? state.gameState.shuffleCount : state.gameState.shuffleCount - 1,
                  powerSurgeProgress: newPowerSurgeProgress,
                  consecutiveSuccesses: 0,
                  consecutiveValidWords: newConsecutiveValidWords,
                  perfectChainProgress: 0,
                  wordsThisRound: 0,
                }
            };
        }

        case 'PERFORM_INSTANT_SHUFFLE': {
            return {
                ...state,
                hand: action.payload.hand,
                tileBag: action.payload.tileBag,
                buildRow: Array(BUILD_ROW_SIZE).fill(null),
                longWordBonusNotified: false,
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
                    consecutiveSuccesses: 0,
                    consecutiveValidWords: 0,
                    perfectChainProgress: 0,
                }
            };
        }
        
        case 'HANDLE_CLEAR': {
            let newHand = [...state.hand];
            state.buildRow.filter(i => i).forEach(item => { newHand[item!.originalIndex] = item!.tile; });
            return { ...state, hand: newHand, buildRow: Array(BUILD_ROW_SIZE).fill(null), longWordBonusNotified: false, highlightedTileIds: { first: null, rest: [] } };
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
                    tileForSelection: null,
                };
            }
            
            return { ...state, modalContent: null, isPaused: false, gameState: {...state.gameState, powerPlayToActivate: null, charmToActivate: null, powerPlayOffer: []}, tilesToSwap: [], tileToTransform: null, tileForSelection: null };
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
                // Same tiles, fresh clock (the start-of-run bank; ignores old saved milestone timers).
                time: GAMEPLAY.timeBank.start,
                challengeWordData: null, // Clear challenge state
                gameState: {
                    ...state.gameState,
                    challengeActive: false, // Reset challenge lock
                    wordsThisRound: 0, // Reset round-specific counters
                }
            };
        }

        case 'RESET_ROUND': {
            // A new hand without a word played (e.g. a lost Strike Challenge, Golden Round start/end).
            // The time bank carries over; one-shot time bonuses wait for the next word.
            const { hand, tileBag } = action.payload;
            const { time, gs: newGameState } = settleTimeBank(state.time, state.gameState);

            return {
                ...state,
                hand,
                tileBag,
                buildRow: Array(BUILD_ROW_SIZE).fill(null),
                time,
                gameState: { ...newGameState, wordsThisRound: 0 }
            };
        }

        case 'START_NEXT_ROUND': {
            // Time bank: keep the clock and add what the last word earned, plus charm/PowerPlay bonuses below.
            const settled = settleTimeBank(state.time, { ...state.gameState });
            let newGameState = settled.gs;
            let timerDuration = settled.time + (newGameState.pendingTimeBonus ?? 0);
            newGameState.pendingTimeBonus = 0;
    
            // Clean up temporary effects from previous round
            let hand = [...state.hand].map(tile => {
                if (!tile) return null;
                
                // isLocked, isDuplicate and tempPoints are single-turn effects.
                // isSuper should persist until the tile is used.
                const { isLocked, isDuplicate, tempPoints, ...restOfTile } = tile;
                
                // Only create a new object if a property was actually removed to be more efficient.
                if (isLocked || isDuplicate || tempPoints !== undefined) {
                    // 'restOfTile' now contains the tile object without the temporary properties.
                    // It will still contain 'isSuper' if it was present.
                    return restOfTile as Tile;
                }
                
                return tile;
            });
            let tileBag = state.tileBag;

            // Rescue Drop return logic
            if (newGameState.activePowerPlays.rescueDrop) {
                const rescuedTile = newGameState.activePowerPlays.rescueDrop.tile;
                const returnedTile = { ...rescuedTile, tempPoints: 20 };
                const emptySlotIndex = hand.indexOf(null);
                if (emptySlotIndex !== -1) {
                    hand[emptySlotIndex] = returnedTile;
                } else {
                    // Safeguard if hand is full: replace a random tile.
                    const randomIndex = Math.floor(Math.random() * hand.length);
                    const tileToReturn = hand[randomIndex];
                    if (tileToReturn) {
                        tileBag = [...tileBag, tileToReturn.letter];
                    }
                    hand[randomIndex] = returnedTile;
                }
                
                delete newGameState.activePowerPlays.rescueDrop;
                newGameState.activeBuffs = newGameState.activeBuffs.filter(b => b.id !== 'rescueDrop');
            }


            if(newGameState.glitchActive) {
                timerDuration += 5;
                newGameState.glitchActive = false;
            }
            
            if(newGameState.multiverseTimeBonus > 0) {
                timerDuration += newGameState.multiverseTimeBonus;
                newGameState.multiverseTimeBonus = 0; // Consume the bonus
            }

            if(newGameState.warioTimeDebt > 0) {
                timerDuration -= newGameState.warioTimeDebt;
                newGameState.warioTimeDebt = 0;
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
            
            if (newGameState.activePowerPlays.saveByTheBell && newGameState.activePowerPlays.saveByTheBell.rounds > 0) {
                timerDuration += 5;
                const newSaveByTheBellState = { rounds: newGameState.activePowerPlays.saveByTheBell.rounds - 1 };
                if (newSaveByTheBellState.rounds > 0) {
                    newGameState.activePowerPlays = { ...newGameState.activePowerPlays, saveByTheBell: newSaveByTheBellState };
                     const buffIndex = newGameState.activeBuffs.findIndex(b => b.id === 'saveByTheBell');
                    if (buffIndex > -1) {
                        const newBuff = {...newGameState.activeBuffs[buffIndex], description: `Adds +5 seconds for ${newSaveByTheBellState.rounds} more turn(s).` };
                        newGameState.activeBuffs[buffIndex] = newBuff;
                    }
                } else {
                    delete newGameState.activePowerPlays.saveByTheBell;
                    newGameState.activeBuffs = newGameState.activeBuffs.filter(b => b.id !== 'saveByTheBell');
                }
            }

            if (newGameState.activePowerPlays.mutationProtocol) {
                const newMutationState = { rounds: newGameState.activePowerPlays.mutationProtocol.rounds - 1 };
                if (newMutationState.rounds > 0) {
                    newGameState.activePowerPlays = { ...newGameState.activePowerPlays, mutationProtocol: newMutationState };
                    const buffIndex = newGameState.activeBuffs.findIndex(b => b.id === 'mutationProtocol');
                    if (buffIndex > -1) {
                        const newBuff = {...newGameState.activeBuffs[buffIndex], description: `Guaranteed 1 Super Tile for ${newMutationState.rounds} more round(s).` };
                        newGameState.activeBuffs[buffIndex] = newBuff;
                    }
                } else {
                    delete newGameState.activePowerPlays.mutationProtocol;
                    newGameState.activeBuffs = newGameState.activeBuffs.filter(b => b.id !== 'mutationProtocol');
                }
            }

            if (newGameState.activePowerPlays.treehouseOfHorror) {
                const newTreehouseState = { rounds: newGameState.activePowerPlays.treehouseOfHorror.rounds - 1 };
                if (newTreehouseState.rounds >= 0) {
                    // There are still rounds left (including this one, which is the last one if rounds is 0 now).
                    hand = hand.map(tile => tile ? { ...tile, tempPoints: Math.floor(Math.random() * 10) + 1 } : null);
                    if (newTreehouseState.rounds > 0) {
                       newGameState.activePowerPlays = { ...newGameState.activePowerPlays, treehouseOfHorror: newTreehouseState };
                    } else {
                        // This was the last round. Remove the effect for the upcoming turn.
                        delete newGameState.activePowerPlays.treehouseOfHorror;
                        newGameState.activeBuffs = newGameState.activeBuffs.filter(b => b.id !== 'treehouseOfHorror');
                    }
                }
            }

            if (newGameState.activePowerPlays.duckHunt && !newGameState.activePowerPlays.duckHunt.ready) {
                const duckHuntState = newGameState.activePowerPlays.duckHunt;
                newGameState.activePowerPlays.duckHunt = { ...duckHuntState, ready: true };

                const buffIndex = newGameState.activeBuffs.findIndex(b => b.id === 'duckHunt');
                if (buffIndex > -1) {
                    const newBuff = { ...newGameState.activeBuffs[buffIndex], description: `🦆 Use a '${duckHuntState.letter}' this round for +50 pts!` };
                    newGameState.activeBuffs[buffIndex] = newBuff;
                }
            }
    
            if (newGameState.activePowerPlays.sonicSpeed) {
                if (newGameState.activePowerPlays.sonicSpeed.count === 2) timerDuration = Math.min(timerDuration, 8);
                else if (newGameState.activePowerPlays.sonicSpeed.count === 1) timerDuration = Math.min(timerDuration, 7);
            }
            
            const diceRollCharm = newGameState.activeCharms.find(c => c.id === 'diceRollProtocol');
    
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
                time: clampTime(timerDuration),
                timeGain: { seconds: clampTime(timerDuration) - settled.time, key: Date.now() },
                gameState: { ...newGameState, wordsThisRound: 0 }
            };
        }
        
        case 'CHOOSE_CHARM': {
            const { charm, hand, allOffered } = action.payload;
            let newHand = hand;
            const stateChanges = charm.activate(state.gameState);
            
            let newGameState = { ...gameState };

            const newCharmCooldowns = {...newGameState.charmCooldowns};
            allOffered.forEach(offeredCharm => {
                if (offeredCharm.id === charm.id) {
                    newCharmCooldowns[offeredCharm.id] = 5; // 5-turn cooldown for the chosen charm
                } else {
                    newCharmCooldowns[offeredCharm.id] = 3; // 3-turn cooldown for unchosen charms
                }
            });
            newGameState.charmCooldowns = newCharmCooldowns;

            if (charm.id === 'goldenSnitch') {
                newGameState.consecutiveSuccesses = 0;
            }
            if (charm.id === 'duckHuntCombo') {
                newGameState.duckHuntComboState = { streakLetters: null, streakCount: 0 };
            }
            if (charm.id === 'drMariosCure') {
                newGameState.drMarioCureStreak = 0;
            }
            if (charm.id === 'powerStarResidual') {
                newGameState.powerStarResidualActive = false;
            }
            
            if (charm.id === 'wildcardWake') {
                 return {
                    ...state,
                    gameState: { ...newGameState, ...stateChanges }
                };
            }

            if (charm.id === 'oneTileToRuleThemAll') {
                const availableTiles = hand.map((tile, index) => ({ tile, index })).filter((item): item is { tile: Tile, index: number } => item.tile !== null);
                if (availableTiles.length > 0) {
                    const randomIndex = Math.floor(Math.random() * availableTiles.length);
                    const chosenItem = availableTiles[randomIndex];
                    
                    const updatedTile: Tile = { ...chosenItem.tile, tempPoints: 25 };
                    
                    const handCopy = [...hand];
                    handCopy[chosenItem.index] = updatedTile;
                    newHand = handCopy;

                    const buff: Charm = { 
                        ...charm, 
                        description: `The '${updatedTile.letter}' tile is worth 25 points for one use.` 
                    };
                    stateChanges.activeBuffs = [...(stateChanges.activeBuffs || newGameState.activeBuffs), buff];
                }
                
                return {
                    ...state,
                    hand: newHand,
                    gameState: {
                        ...newGameState,
                        ...stateChanges,
                        activeCharms: [...newGameState.activeCharms, charm],
                    }
                };
            }

            if (charm.effectType === 'selection') {
                return {
                    ...state,
                    gameState: { ...newGameState, availableCharms: [...newGameState.availableCharms, charm] }
                };
            }
            
            const charmAlreadyActive = newGameState.activeCharms.some(c => c.id === charm.id);
            const newActiveCharms = charmAlreadyActive ? newGameState.activeCharms : [...newGameState.activeCharms, charm];

            return {
                ...state,
                hand: newHand,
                gameState: {
                    ...newGameState,
                    ...stateChanges,
                    activeCharms: newActiveCharms,
                    activeBuffs: [...(stateChanges.activeBuffs || newGameState.activeBuffs)],
                }
            }
        }
        
        case 'CHOOSE_POWER_PLAY': {
            const { powerPlay, allOffered } = action.payload;

            const resetProgress = {
                targetDigit: null,
                streak: 0,
                turnsSinceLastOffer: 0,
            };
            
            const newPowerPlayCooldowns = {...gameState.powerPlayCooldowns};
            allOffered.forEach(offeredPP => {
                if (offeredPP.id === powerPlay.id) {
                    newPowerPlayCooldowns[offeredPP.id] = 5; // 5-turn cooldown for the chosen one
                } else {
                    newPowerPlayCooldowns[offeredPP.id] = 3; // 3-turn cooldown for unchosen ones
                }
            });

            if (powerPlay.id === 'thwomped') {
                let newGameState = { ...gameState };
                const newChallengeCount = newGameState.challengeCount <= 0 ? 1 : newGameState.challengeCount + 1;
                const changes = { challengeCount: newChallengeCount };
                const newLogEntry: EventLogEntry = {
                    type: 'event', id: `pp-thwomped-${Date.now()}`, name: powerPlay.name,
                    description: 'Gained an extra Challenge.', icon: '🧱',
                    scoreChange: 0, cumulativeScore: newGameState.score
                };
                const newLog = [...newGameState.log, newLogEntry];
                
                newGameState = {
                    ...newGameState,
                    ...changes,
                    log: newLog,
                    powerPlayOffer: [],
                    powerPlayProgress: resetProgress,
                    powerPlayCooldowns: newPowerPlayCooldowns,
                };
                const newModalContent: ModalContent = { type: 'info', title: 'Thwomped!', content: 'You got an extra Challenge!', autoClose: 2000 };
                return {
                    ...state,
                    gameState: newGameState,
                    modalQueue: [...state.modalQueue, newModalContent],
                };
            }

            if (powerPlay.id === 'fluncleIsProud') {
                let newGameState = { ...gameState };
                const scoreChange = 300;
                const newScore = newGameState.score + scoreChange;
                const changes = { score: newScore };

                const newLogEntry: EventLogEntry = {
                    type: 'event', id: `pp-fluncleIsProud-${Date.now()}`, name: powerPlay.name,
                    description: 'Fluncle is proud! +300 points.', icon: '🧓',
                    scoreChange: scoreChange, cumulativeScore: newScore
                };
                const newLog = [...newGameState.log, newLogEntry];

                newGameState = {
                    ...newGameState,
                    ...changes,
                    log: newLog,
                    powerPlayOffer: [],
                    powerPlayProgress: resetProgress,
                    powerPlayCooldowns: newPowerPlayCooldowns,
                };
                const newModalContent: ModalContent = { type: 'info', title: 'Fluncle is Proud', content: `Fluncle is very proud of you. You gain 300 points!`, autoClose: 2500 };
                return {
                    ...state,
                    gameState: newGameState,
                    modalQueue: [...state.modalQueue, newModalContent],
                };
            }

            const AUTOMATIC_POWER_PLAYS = new Set([
                'strikeShield', 'philsosophy', 'plotArmor',
                'saveByTheBell', 'timeTurner', 'mutationProtocol'
            ]);

            if (AUTOMATIC_POWER_PLAYS.has(powerPlay.id)) {
                let newGameState = {
                    ...gameState,
                    powerPlayOffer: [],
                    powerPlayProgress: resetProgress,
                    powerPlayCooldowns: newPowerPlayCooldowns,
                };
                
                const changes = powerPlay.activate(newGameState);
                newGameState = { ...newGameState, ...changes };
                
                return {
                    ...state,
                    gameState: newGameState,
                };
            } 
            
            return {
                ...state,
                gameState: {
                    ...gameState,
                    availablePowerPlays: [...gameState.availablePowerPlays, powerPlay],
                    powerPlayOffer: [],
                    powerPlayProgress: resetProgress,
                    powerPlayCooldowns: newPowerPlayCooldowns,
                }
            };
        }
        
        case 'ACTIVATE_POWER_PLAY': {
            const powerPlay = action.payload;
            let changes = {};
            let newLog = [...state.gameState.log];
            let newModalContent: ModalContent = null;
            let shouldPause = false;

            if (powerPlay.id === 'fortunesFavor') {
                const rand = Math.random();
                let scoreChange = 0;
                let message = '';
        
                if (rand < 0.4) { // 40%
                    scoreChange = -200;
                    message = 'Outlook not so good... You lost 200 points.';
                } else if (rand < 0.9) { // 50%
                    scoreChange = 250;
                    message = 'It is certain! You gained 250 points.';
                } else { // 10%
                    scoreChange = 500;
                    message = 'As I see it, yes! You gained 500 points!';
                }
        
                const newScore = Math.max(0, state.gameState.score + scoreChange);
                const actualScoreChange = newScore - state.gameState.score;
                newLog.push({
                  type: 'event', id: `pp-${powerPlay.id}-${Date.now()}`, name: powerPlay.name,
                  description: message, icon: '🎱',
                  scoreChange: actualScoreChange, cumulativeScore: newScore
                });
                changes = { score: newScore, log: newLog };
                newModalContent = { type: 'info', title: 'Fortune\'s Favor', content: message, autoClose: 3000 };
                shouldPause = true;
            }

            if (powerPlay.id === 'donkeyKongSmash') {
                const tilesToReturn = [...state.hand, ...state.buildRow.map(item => item?.tile)].filter((t): t is Tile => t != null);
                const lettersToReturn = tilesToReturn.map(t => t.letter);
                const newBagForShuffle = gameUtils.shuffleArray([...state.tileBag, ...lettersToReturn]);
                
                const { newTiles, remainingBag } = gameUtils.drawTiles(HAND_SIZE, newBagForShuffle, false);
                
                const paddedHand = Array(RACK_SIZE).fill(null);
                newTiles.forEach((tile, i) => { if (i < RACK_SIZE) paddedHand[i] = tile; });
                
                const { newHand: finalHand, newBag: finalBag } = gameUtils.postProcessHand(paddedHand, remainingBag, false);
                
                const newLogEntry: EventLogEntry = {
                    type: 'event', id: `pp-${powerPlay.id}-${Date.now()}`, name: powerPlay.name,
                    description: 'Your hand was smashed and replaced!', icon: '🐵',
                    scoreChange: 0, cumulativeScore: state.gameState.score
                };
                
                return {
                    ...state,
                    hand: finalHand,
                    tileBag: finalBag,
                    buildRow: Array(BUILD_ROW_SIZE).fill(null),
                    modalContent: { type: 'info', title: 'Donkey Kong Smash!', content: 'Your hand has been smashed and replaced!', autoClose: 2500 },
                    isPaused: true,
                    gameState: {
                        ...state.gameState,
                        log: [...state.gameState.log, newLogEntry],
                        availablePowerPlays: state.gameState.availablePowerPlays.filter(p => p.id !== powerPlay.id),
                    }
                };
            }
        
            if (powerPlay.id === 'bobKelso') {
                const scoreChange = 100;
                const newScore = state.gameState.score + scoreChange;
        
                const tilesToReturn = [...state.hand, ...state.buildRow.map(item => item?.tile)].filter((t): t is Tile => t != null);
                const lettersToReturn = tilesToReturn.map(t => t.letter);
                const newBagForShuffle = gameUtils.shuffleArray([...state.tileBag, ...lettersToReturn]);
                
                const { newTiles, remainingBag } = gameUtils.drawTiles(HAND_SIZE, newBagForShuffle, false);
                
                const paddedHand = Array(RACK_SIZE).fill(null);
                newTiles.forEach((tile, i) => { if (i < RACK_SIZE) paddedHand[i] = tile; });
        
                const { newHand: finalHand, newBag: finalBag } = gameUtils.postProcessHand(paddedHand, remainingBag, false);
                
                const newLogEntry: EventLogEntry = {
                    type: 'event', id: `pp-${powerPlay.id}-${Date.now()}`, name: powerPlay.name,
                    description: 'Gained 100 points and a free hand shuffle.', icon: '👨‍⚕️',
                    scoreChange: scoreChange, cumulativeScore: newScore
                };
                
                return {
                    ...state,
                    hand: finalHand,
                    tileBag: finalBag,
                    buildRow: Array(BUILD_ROW_SIZE).fill(null),
                    modalContent: { type: 'info', title: 'Bob Kelso!', content: '+100 points and a fresh hand.', autoClose: 2500 },
                    isPaused: true,
                    gameState: {
                        ...state.gameState,
                        score: newScore,
                        log: [...state.gameState.log, newLogEntry],
                        availablePowerPlays: state.gameState.availablePowerPlays.filter(p => p.id !== powerPlay.id),
                    }
                };
            }

            if (powerPlay.id === 'rescueDrop') {
                const handTiles = state.hand.filter((t): t is Tile => t !== null);
                if (handTiles.length === 0) {
                    // This is handled in the component now, but as a reducer safeguard:
                    return state; // Do nothing, consume no power play
                }
        
                const randomIndex = Math.floor(Math.random() * handTiles.length);
                const tileToRescue = handTiles[randomIndex];
                const originalHandIndex = state.hand.findIndex(t => t?.id === tileToRescue.id);
        
                const newHand = [...state.hand];
                if (originalHandIndex !== -1) {
                    newHand[originalHandIndex] = null;
                }
        
                const buffDescription = `🐿️ '${tileToRescue.letter}' returns next round worth 20 pts!`;
                const buff = { 
                    ...powerPlay, 
                    description: buffDescription,
                    instanceId: `rescueDrop_${tileToRescue.id}`
                };
        
                const activationChanges = {
                    activePowerPlays: { ...state.gameState.activePowerPlays, rescueDrop: { tile: tileToRescue } },
                    activeBuffs: [...state.gameState.activeBuffs, buff]
                };

                return {
                    ...state,
                    hand: newHand,
                    gameState: {
                      ...gameState,
                      ...activationChanges,
                      availablePowerPlays: gameState.availablePowerPlays.filter(p => p.id !== powerPlay.id),
                    }
                  };
            }

            if (powerPlay.id === 'morphinTime') {
                const handTilesWithIndices = state.hand
                    .map((tile, index) => ({ tile, index }))
                    .filter((item): item is { tile: Tile, index: number } => item.tile !== null);
                
                if (handTilesWithIndices.length < 2) {
                    return { ...state, message: "Not enough tiles to morph!" };
                }
        
                const shuffledItems = gameUtils.shuffleArray(handTilesWithIndices).slice(0, 2);
                const indicesToReplace = shuffledItems.map(item => item.index);
                const tilesToReturn = shuffledItems.map(item => item.tile.letter);
                
                const newBagForDraw = gameUtils.shuffleArray([...state.tileBag, ...tilesToReturn]);
                const { newTiles, remainingBag } = gameUtils.drawTiles(2, newBagForDraw);
        
                if (newTiles.length < 2) { return state; } // Abort on draw failure
        
                const newHand = [...state.hand];
                
                const morphedTiles = gameUtils.shuffleArray([
                    { ...newTiles[0], multiplier: 2 },
                    { ...newTiles[1], multiplier: 4 }
                ]);
                
                newHand[indicesToReplace[0]] = morphedTiles[0];
                newHand[indicesToReplace[1]] = morphedTiles[1];

                const { newHand: finalHand, newBag: finalBag, balancingMessage } = gameUtils.postProcessHand(newHand, remainingBag);
                
                const newLogEntry: EventLogEntry = {
                    type: 'event', id: `pp-${powerPlay.id}-${Date.now()}`, name: powerPlay.name,
                    description: 'Two tiles morphed into a 2x and 4x multiplier tile!', icon: '⚡️',
                    scoreChange: 0, cumulativeScore: state.gameState.score
                };
                
                let modalText = 'It\'s Morphin Time!';
                if (balancingMessage) {
                    modalText += `\n\n${balancingMessage}`;
                }
                
                return {
                    ...state,
                    hand: finalHand,
                    tileBag: finalBag,
                    modalContent: { type: 'info', title: '⚡️ Morphin Time!', content: modalText, autoClose: 2500 },
                    isPaused: true,
                    gameState: {
                        ...state.gameState,
                        log: [...state.gameState.log, newLogEntry],
                        availablePowerPlays: state.gameState.availablePowerPlays.filter(p => p.id !== powerPlay.id),
                    }
                };
            }

            if (powerPlay.id === 'slimShadyShuffle') {
                const tilesToReturn = [...state.hand, ...state.buildRow.map(item => item?.tile)].filter((t): t is Tile => t != null);
                const lettersToReturn = tilesToReturn.map(t => t.letter);
                const newBagForShuffle = gameUtils.shuffleArray([...state.tileBag, ...lettersToReturn]);
                
                const { newTiles, remainingBag } = gameUtils.drawTiles(HAND_SIZE, newBagForShuffle, false);
                
                const paddedHand = Array(RACK_SIZE).fill(null);
                newTiles.forEach((tile, i) => { if (i < RACK_SIZE) paddedHand[i] = tile; });
                
                const { newHand: finalHand, newBag: finalBag, balancingMessage } = gameUtils.postProcessHand(paddedHand, remainingBag, false);
                
                const newLogEntry: EventLogEntry = {
                    type: 'event', id: `pp-${powerPlay.id}-${Date.now()}`, name: powerPlay.name,
                    description: 'Hand replaced. Next word +50 bonus.', icon: '🎤',
                    scoreChange: 0, cumulativeScore: state.gameState.score
                };
                
                let modalText = `Your hand has been replaced. Your next valid word gets a +50 bonus.`;
                if (balancingMessage) {
                    modalText += `\n\n${balancingMessage}`;
                }
                
                const activationChanges = powerPlay.activate(state.gameState);

                return {
                    ...state,
                    hand: finalHand,
                    tileBag: finalBag,
                    buildRow: Array(BUILD_ROW_SIZE).fill(null),
                    modalContent: { type: 'info', title: 'Slim Shady Shuffle!', content: modalText, autoClose: 3000 },
                    isPaused: true,
                    gameState: {
                        ...state.gameState,
                        ...activationChanges,
                        log: [...state.gameState.log, newLogEntry],
                        availablePowerPlays: state.gameState.availablePowerPlays.filter(p => p.id !== powerPlay.id),
                    }
                };
            }

            if (powerPlay.id === 'pinkyAndTheBrain') {
                let immediateBonus = 0;
                if (state.gameState.highestScoringWord) {
                    immediateBonus = Math.round(state.gameState.highestScoringWord.score / 2);
                }
    
                const newScore = state.gameState.score + immediateBonus;
                const description = `Gained ${immediateBonus} points (${state.gameState.highestScoringWord ? `half of ${state.gameState.highestScoringWord.score}` : 'no best word yet'}). Next word is doubled.`;
                
                const newLogEntry: EventLogEntry = {
                    type: 'event', id: `pp-${powerPlay.id}-${Date.now()}`, name: powerPlay.name,
                    description: description, icon: '🧠',
                    scoreChange: immediateBonus, cumulativeScore: newScore
                };
                newLog.push(newLogEntry);
                changes = { score: newScore, log: newLog };
                
                newModalContent = { type: 'info', title: 'Pinky and the Brain!', content: `Genius! ${description}`, autoClose: 3000 };
                shouldPause = true;
            }


            // Handle immediate score effects and logging
            if (powerPlay.id === 'echoesOfThePast') {
              if (state.gameState.highestScoringWord) {
                const scoreChange = state.gameState.highestScoringWord.score;
                const newScore = state.gameState.score + scoreChange;
                newLog.push({
                  type: 'event', id: `pp-${powerPlay.id}-${Date.now()}`, name: powerPlay.name,
                  description: `Replayed "${state.gameState.highestScoringWord.word.toUpperCase()}"`, icon: '🔁',
                  scoreChange, cumulativeScore: newScore
                });
                changes = { score: newScore, log: newLog };
                newModalContent = { type: 'info', title: 'Echoes of the Past', content: `Replayed "${state.gameState.highestScoringWord.word.toUpperCase()}" for ${scoreChange} points!` };
                shouldPause = true;
              }
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
            if (powerPlay.id === 'animaniacsMayhem') {
                const tilesToReturn = [...state.hand, ...state.buildRow.map(item => item?.tile)].filter((t): t is Tile => t != null);
                const lettersToReturn = tilesToReturn.map(t => t.letter);
                const newBagForShuffle = gameUtils.shuffleArray([...state.tileBag, ...lettersToReturn]);
                
                const letters = Object.keys(TILE_DISTRIBUTION);
                const randomLetter1 = letters[Math.floor(Math.random() * letters.length)];
                const multiplierTile1: Tile = {
                    id: `${randomLetter1}-animaniacs-${Math.random()}`,
                    letter: randomLetter1,
                    points: TILE_DISTRIBUTION[randomLetter1]?.points || 0,
                    multiplier: 2
                };

                const randomLetter2 = letters[Math.floor(Math.random() * letters.length)];
                const multiplierTile2: Tile = {
                    id: `${randomLetter2}-animaniacs-${Math.random()}`,
                    letter: randomLetter2,
                    points: TILE_DISTRIBUTION[randomLetter2]?.points || 0,
                    multiplier: 2
                };
                
                const { newTiles, remainingBag } = gameUtils.drawTiles(HAND_SIZE - 2, newBagForShuffle, false);
                
                const freshHandTiles = gameUtils.shuffleArray([multiplierTile1, multiplierTile2, ...newTiles]);
                const paddedHand = Array(RACK_SIZE).fill(null);
                freshHandTiles.forEach((tile, i) => { if (i < RACK_SIZE) paddedHand[i] = tile; });

                const { newHand: finalHand, newBag: finalBag, balancingMessage } = gameUtils.postProcessHand(paddedHand, remainingBag, false);

                newHand = finalHand;
                newBag = finalBag;
                newBuildRow = Array(BUILD_ROW_SIZE).fill(null);
                
                const newLogEntry: EventLogEntry = {
                    type: 'event', id: `pp-${powerPlay.id}-${Date.now()}`, name: powerPlay.name,
                    description: 'Hand reshuffled with two 2x tiles!', icon: '🌪️',
                    scoreChange: 0, cumulativeScore: state.gameState.score
                };
                newLog.push(newLogEntry);
                changes = { log: newLog };
                
                let modalText = 'Total chaos! Your hand has been reshuffled with guaranteed 2x tiles.';
                if (balancingMessage) {
                    modalText += `\n\n${balancingMessage}`;
                }
                newModalContent = { type: 'info', title: 'Animaniacs Mayhem!', content: modalText, autoClose: 2500 };
                shouldPause = true;
            }
            if (powerPlay.id === 'treehouseOfHorror') {
                newModalContent = { type: 'info', title: '🎃 Treehouse of Horror!', content: 'Things just got weird. Tile values are randomized for 3 turns.', autoClose: 2500 };
                shouldPause = true;
            }
            
            const activationChanges = powerPlay.activate(state.gameState);
            let timeChange = 0;
            if (powerPlay.id === 'timeBoost') timeChange = 15;
            if (powerPlay.id === 'rewind') timeChange = 10;

            if (powerPlay.id === 'sonicSpeed') {
                newModalContent = {
                    type: 'info',
                    title: 'Sonic Speed Activated!',
                    content: 'Word 1: 8s timer, 2x score\nWord 2: 7s timer, 4x score'
                };
                shouldPause = true;
            }
            
            // If it's a selection type that requires a modal (e.g., has a selectionType)
            if (powerPlay.effectType === 'selection' && powerPlay.selectionType) {
                return {
                    ...state,
                    modalContent: { type: 'powerplay-activation', title: `Activate: ${powerPlay.name}`, data: powerPlay },
                    isPaused: true,
                };
            }
            
            return {
              ...state,
              time: clampTime(state.time + timeChange),
              hand: newHand,
              tileBag: newBag,
              buildRow: newBuildRow,
              modalContent: newModalContent,
              isPaused: shouldPause,
              gameState: {
                ...gameState,
                ...activationChanges,
                ...changes,
                availablePowerPlays: gameState.availablePowerPlays.filter(p => p.id !== powerPlay.id),
                powerPlayProgress: {
                    targetDigit: null,
                    streak: 0,
                    turnsSinceLastOffer: 0,
                },
              }
            }
        }
        
        case 'COMPLETE_POWER_PLAY_ACTIVATION': {
          const { powerPlay, option } = action.payload;
          
          if (powerPlay.id === 'wordionaire' && option?.choice) {
            let changes: Partial<GameState> = {};
            let scoreChange = 0;
            
            if (option.choice === 'cash') {
                scoreChange = 100;
                changes = {
                    score: gameState.score + scoreChange
                };
                const newLogEntry: EventLogEntry = {
                    type: 'event', id: `pp-wordionaire-cash-${Date.now()}`, name: "Wordionaire: Fast Cash",
                    description: "Gained 100 points.", icon: '💡',
                    scoreChange, cumulativeScore: gameState.score + scoreChange
                };
                changes.log = [...gameState.log, newLogEntry];
            } else if (option.choice === 'double') {
                changes = {
                    activePowerPlays: { ...gameState.activePowerPlays, wordionaireDouble: true }
                };
            }
            // 'phone' choice is handled by its own async function, this just cleans up the powerplay state
            
            // Add the buff to the tray for double
            if(option.choice === 'double') {
              const buffDescription = 'Next word gets x2 score.';
              const buff = { ...powerPlay, description: buffDescription, instanceId: `wordionaire_double` };
              changes.activeBuffs = [...gameState.activeBuffs, buff];
            }
        
            return {
                ...state,
                modalContent: null,
                isPaused: false,
                gameState: {
                    ...gameState,
                    ...changes,
                    availablePowerPlays: gameState.availablePowerPlays.filter(p => p.id !== powerPlay.id),
                    powerPlayToActivate: null,
                }
            };
          }

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
                time: clampTime(state.time + timeChange),
                modalContent: null,
                isPaused: false,
                gameState: {
                    ...gameState,
                    ...changes,
                    availablePowerPlays: gameState.availablePowerPlays.filter(p => p.id !== powerPlay.id),
                    powerPlayToActivate: null,
                }
            };
          }
          if (powerPlay.id === 'hookshot' && state.tileForSelection) {
            const { tile } = state.tileForSelection;
            const newTile: Tile = {
              ...tile,
              id: `${tile.letter}-hookshot-${Math.random()}`,
              isDuplicate: true,
            };
      
            let newHand = [...state.hand];
            const emptySlotIndex = newHand.indexOf(null);
            
            if (emptySlotIndex !== -1) {
              newHand[emptySlotIndex] = newTile;
            }

            const { newHand: finalHand, newBag: finalBag } = gameUtils.handleDuplicateLetters(newHand, state.tileBag);
      
            return {
              ...state,
              hand: finalHand,
              tileBag: finalBag,
              modalContent: null,
              isPaused: false,
              tileForSelection: null,
              gameState: {
                ...gameState,
                availablePowerPlays: gameState.availablePowerPlays.filter(p => p.id !== powerPlay.id),
                powerPlayToActivate: null,
              }
            };
          }
          if (powerPlay.id === 'cassiesClue' && option?.tilesToDiscard) {
            let newHand = [...state.hand];
            const newTiles = ['C', 'A', 'T'].map(l => gameUtils.createTile(l));

            option.tilesToDiscard.forEach((item: { originalIndex: number}) => {
                newHand[item.originalIndex] = null;
            });
      
            newTiles.forEach(tile => {
                const emptyIndex = newHand.findIndex(slot => slot === null);
                if (emptyIndex !== -1) {
                    newHand[emptyIndex] = tile;
                }
            });
            const changes = powerPlay.activate(state.gameState);
            const { newHand: finalHand, newBag: finalBag } = gameUtils.handleDuplicateLetters(newHand, state.tileBag);
            return {
              ...state,
              hand: finalHand,
              tileBag: finalBag,
              modalContent: null,
              isPaused: false,
              tilesToSwap: [],
              gameState: {
                  ...gameState,
                  ...changes,
                  availablePowerPlays: gameState.availablePowerPlays.filter(p => p.id !== powerPlay.id),
                  powerPlayToActivate: null,
              }
            };
          }

          if (powerPlay.id === 'captainPlanet' && state.tileForSelection) {
            let newGameState = { ...state.gameState };
            const handCopy = [...state.hand];
            const tileIndex = state.tileForSelection.originalIndex;
            if (handCopy[tileIndex]) {
                handCopy[tileIndex] = { ...handCopy[tileIndex]!, tempPoints: 20 };
            }
              const changes = powerPlay.activate(state.gameState);
            return {
                ...state,
                hand: handCopy,
                modalContent: null,
                isPaused: false,
                tileForSelection: null,
                gameState: {
                    ...newGameState,
                    ...changes,
                    availablePowerPlays: newGameState.availablePowerPlays.filter(p => p.id !== powerPlay.id),
                    powerPlayToActivate: null,
                }
            };
          }

          if (powerPlay.id === 'moreThanMeets' && state.tileForSelection) {
            const { originalIndex } = state.tileForSelection;
            
            const randomComboTileData = gameUtils.shuffleArray(COMBO_TILES)[0];
            const newTile = gameUtils.createTile(randomComboTileData.letter);

            const newHand = [...state.hand];
            newHand[originalIndex] = newTile;
            
            const { newHand: finalHand, newBag: finalBag } = gameUtils.handleDuplicateLetters(newHand, state.tileBag);
            
            return {
                ...state,
                hand: finalHand,
                tileBag: finalBag,
                modalContent: null,
                isPaused: false,
                tileForSelection: null,
                gameState: {
                    ...gameState,
                    availablePowerPlays: gameState.availablePowerPlays.filter(p => p.id !== powerPlay.id),
                    powerPlayToActivate: null,
                }
            };
          }

          if (powerPlay.id === 'duckHunt' && state.tileForSelection) {
              const { tile, originalIndex } = state.tileForSelection;
              const newHand = [...state.hand];
              newHand[originalIndex] = null;
              const newBag = gameUtils.shuffleArray([...state.tileBag, tile.letter]);
              const buffDescription = `🦆 '${tile.letter}' sniped. Active next round.`;
              const buff = { 
                  ...POWER_PLAYS_LIST.find(p => p.id === 'duckHunt')!, 
                  description: buffDescription,
                  instanceId: `duckHunt_${tile.letter}`
              };

              return {
                  ...state,
                  hand: newHand,
                  tileBag: newBag,
                  modalContent: null,
                  isPaused: false,
                  tileForSelection: null,
                  gameState: {
                      ...gameState,
                      activePowerPlays: { ...gameState.activePowerPlays, duckHunt: { letter: tile.letter, ready: false } },
                      activeBuffs: [...gameState.activeBuffs, buff],
                      availablePowerPlays: gameState.availablePowerPlays.filter(p => p.id !== powerPlay.id),
                      powerPlayToActivate: null,
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
              }
          };
        }
        
        case 'SELECT_TILE_TO_TRANSFORM': {
            return { ...state, tileToTransform: action.payload };
        }
        case 'COMPLETE_CHARM_ACTIVATION': {
            const { charm, option } = action.payload;
            if (charm.id === 'shapeshiftersTongue' && state.tileToTransform && option?.letter) {
                const { originalIndex } = state.tileToTransform;
                const newLetter = option.letter;

                const newTile = gameUtils.createTile(newLetter);

                const newHand = [...state.hand];
                newHand[originalIndex] = newTile;

                const { newHand: finalHand, newBag: finalBag } = gameUtils.handleDuplicateLetters(newHand, state.tileBag);
                
                const newCharmUses = { ...gameState.charmUses, [charm.id]: (gameState.charmUses[charm.id] || 0) + 1 };

                return {
                    ...state,
                    hand: finalHand,
                    tileBag: finalBag,
                    modalContent: null,
                    isPaused: false,
                    tileToTransform: null,
                    gameState: {
                        ...gameState,
                        availableCharms: gameState.availableCharms.filter(c => c.id !== charm.id),
                        charmUses: newCharmUses,
                    }
                };
            }
            // If something went wrong, just close the modal without changes.
            return { ...state, modalContent: null, isPaused: false, tileToTransform: null };
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
            const powerPlay = state.modalContent?.data as PowerPlay | undefined;
            if (!powerPlay) return state; // Safety check

            const newPowerPlayUses = { ...gameState.powerPlayUses, [powerPlay.id]: (gameState.powerPlayUses[powerPlay.id] || 0) + 1 };
            
            let newAvailablePowerPlays = [...gameState.availablePowerPlays];
            const isConsumed = newPowerPlayUses[powerPlay.id] >= (powerPlay.maxUses || 1);

            if (isConsumed) {
                newAvailablePowerPlays = gameState.availablePowerPlays.filter(p => p.id !== powerPlay.id);
            }
            
            return {
                ...state,
                modalContent: null,
                isPaused: false,
                gameState: { 
                  ...gameState, 
                  availablePowerPlays: newAvailablePowerPlays, 
                  powerPlayToActivate: null,
                  powerPlayUses: newPowerPlayUses,
                },
                tilesToSwap: []
            }
        }

        case 'GAME_OVER_INITIATED': {
            const { reason, word } = action.payload;
            let title = "GAME OVER";
            let content: React.ReactNode;
            const finalGameState = { ...state.gameState };

            if (finalGameState.activePowerPlays.sonicSpeed) {
                delete finalGameState.activePowerPlays.sonicSpeed;
                finalGameState.activeBuffs = finalGameState.activeBuffs.filter(b => b.id !== 'sonicSpeed');
            }
            
            const finalHandLetters = state.hand.filter((t): t is Tile => t !== null).map(t => t.letter);
            const gameOverLogEntry: GameOverLogEntry = {
                type: 'game_over',
                id: `game-over-${Date.now()}`,
                reason: reason,
                finalHand: finalHandLetters,
                activeBuffs: finalGameState.activeBuffs.map(b => ({ name: b.name, icon: b.icon })),
                cumulativeScore: finalGameState.score,
            };
            finalGameState.log = [...finalGameState.log, gameOverLogEntry];
            
            if (reason === 'strikes') {
                title = "☠️ Three Strikes, You're Out! ☠️";
                if (word) {
                    content = (
                        <>
                            <p className="my-4 text-slate-200">The oracles found a word you missed, sealing your fate.</p>
                            <p className="font-bold text-red-400">Final Strike Word: <span className="text-2xl font-digital">{word}</span></p>
                        </>
                    );
                } else {
                    content = (
                        <>
                            <p className="my-4 text-slate-200">"Looks like your luck ran out. The house always wins. Or in this case, the dictionary. Better luck next time, pal."</p>
                            <p className="font-bold text-red-400">Reason: Final Strike</p>
                        </>
                    );
                }
            } else { // time
                title = "⏰ Time's Up! ⏰";
                content = (
                    <>
                        <p className="my-4 text-slate-200">"It seems the clock was not on your side. Like sand through the hourglass, so are the points of our lives. Or something dramatic like that."</p>
                        <p className="font-bold text-cyan-400">Reason: Out of Time</p>
                    </>
                );
            }
            
            return {
                ...state,
                gameState: finalGameState,
                isPaused: true,
                modalContent: {
                    type: 'game-over-summary',
                    title,
                    content: content,
                }
            };
        }
        
        default: return state;
    }
}

export const GameScreen: React.FC<GameScreenProps> = ({ playerName, onGameOver, onSaveGame, isResuming, onTimeLow, onGoldenRoundChange, onScoreUpdate, onLexCoinChange, tileClass, powerWord }) => {
    
    /**
     * A robust safeguard to ensure the hand state is always a valid, renderable array.
     * Prevents crashes from corrupted data generated by complex game logic.
     * @param hand The potentially corrupted hand array.
     * @returns A clean, valid hand array of the correct size.
     */
    const sanitizeHand = (hand: (Tile | null)[] | undefined | null): (Tile | null)[] => {
        const potentiallyCorruptedHand = Array.isArray(hand) ? hand : [];
        
        const cleanedHand = potentiallyCorruptedHand.map(tile => 
            (tile && typeof tile === 'object' && tile.id && tile.letter) ? tile : null
        );

        const finalHand = Array(RACK_SIZE).fill(null);
        for (let i = 0; i < RACK_SIZE; i++) {
            if (i < cleanedHand.length) {
                finalHand[i] = cleanedHand[i];
            }
        }
        return finalHand;
    };

    const [state, dispatch] = useReducer(gameReducer, screenInitialState, (initialArg) => {
    if (isResuming) {
        const savedData = storage.getJSON<any>(STORAGE_KEYS.savedGame, null);
        if (savedData) {
            try {
                // We need to ensure transient state like isLoading is reset on resume.
                savedData.gameScreenState.isLoading = false;
                savedData.gameScreenState.loadingMessage = null;
                savedData.gameScreenState.highlightedTileIds = { first: null, rest: [] }; // Reset this non-persistent state
                savedData.gameScreenState.longWordBonusNotified = false; // Also reset this
                savedData.gameScreenState.timeGain = undefined; // Don't replay the last +Ns flash
                // Rehydrate sets
                if(savedData.gameScreenState.gameState.duckHuntComboState.streakLetters) {
                    savedData.gameScreenState.gameState.duckHuntComboState.streakLetters = new Set(savedData.gameScreenState.gameState.duckHuntComboState.streakLetters);
                }
                // Migration logic for Groundhog's Day
                if (savedData.gameScreenState.gameState.groundhogDayCharges === undefined) {
                    const charmIsActiveInList = savedData.gameScreenState.gameState.activeCharms.some((c: Charm) => c.id === 'groundhogsDay');
                    savedData.gameScreenState.gameState.groundhogDayCharges = charmIsActiveInList ? 1 : 0;
                }
                // Sanitize the hand on resume just in case it was saved in a bad state
                savedData.gameScreenState.hand = sanitizeHand(savedData.gameScreenState.hand);
                return savedData.gameScreenState;
            } catch (e) {
                console.error("Error parsing saved game. Starting fresh.", e);
                storage.remove(STORAGE_KEYS.savedGame);
            }
        }
    }
    return screenInitialState;
  });
  const { gameState, time, hand, buildRow, tileBag, message, isPaused, isLoading, modalContent, tilesToSwap, lastTurnState, longWordBonusNotified, tileToTransform } = state;
  const isChallengeLock = gameState.challengeActive;
  // The clock stops while the app is in the background so switching apps never costs a run.
  const isVisible = useDocumentVisible();

  // LEX coin milestones: report every new high score, whatever raised it (words, PowerPlays,
  // bonuses). Tracking the run's highest score means undoing a turn can't earn a coin twice.
  const highestScoreRef = React.useRef(gameState.score);
  useEffect(() => {
      if (gameState.score > highestScoreRef.current) {
          onScoreUpdate(highestScoreRef.current, gameState.score);
          highestScoreRef.current = gameState.score;
      }
  }, [gameState.score, onScoreUpdate]);
  const [isMuted, setIsMuted] = useState(soundService.getMuteState());
  
  const wordFromBuildRow = useMemo(() => (buildRow ?? []).filter(i => i).map(item => item!.tile.letter).join(''), [buildRow]);
  const totalWords = useMemo(() => (gameState?.log ?? []).filter(e => e.type === 'word' && e.status === 'valid').length, [gameState?.log]);


  useEffect(() => {
    if ((wordFromBuildRow?.length ?? 0) >= 5 && !longWordBonusNotified) {
        showToast(`✨ Long word! Length bonus x${lengthMultiplier(wordFromBuildRow.length)} and climbing ✨`);
        dispatch({ type: 'SET_LONG_WORD_BONUS_NOTIFIED', payload: true });
    } else if ((wordFromBuildRow?.length ?? 0) < 5 && longWordBonusNotified) {
        dispatch({ type: 'SET_LONG_WORD_BONUS_NOTIFIED', payload: false });
    }
  }, [wordFromBuildRow, longWordBonusNotified]);

  useEffect(() => {
    onGoldenRoundChange(gameState?.roundType === 'golden');
  }, [gameState?.roundType, onGoldenRoundChange]);


  const handleMuteToggle = () => {
    soundService.initialize();
    const newMuteState = soundService.toggleMute();
    setIsMuted(newMuteState);
  };

  const showMessage = useCallback((text: string, duration = 3000) => {
    dispatch({ type: 'SET_MESSAGE', payload: text });
    setTimeout(() => dispatch({ type: 'CLEAR_MESSAGE', payload: text }), duration);
  }, []);

  const applyMutation = useCallback((tiles: Tile[], isForGoldenRound = false): Tile[] => {
    if (isForGoldenRound) {
        return tiles;
    }

    let newTiles = [...tiles]; // Work on a copy

    if (gameState?.activePowerPlays?.treehouseOfHorror) {
        newTiles = newTiles.map((tile): Tile | null => tile ? { ...tile, tempPoints: Math.floor(Math.random() * 10) + 1 } : null).filter((t): t is Tile => t !== null);
    }

    const mutationActive = gameState?.activePowerPlays?.mutationProtocol && gameState.activePowerPlays.mutationProtocol.rounds >= 1;
    
    if (mutationActive) {
        // Guarantee one super tile
        const nonSuperTileIndices = newTiles
            .map((tile, index) => (tile && !tile.isSuper ? index : -1))
            .filter(index => index !== -1);

        if (nonSuperTileIndices.length > 0) {
            const randomIndexToMutate = nonSuperTileIndices[Math.floor(Math.random() * nonSuperTileIndices.length)];
            newTiles[randomIndexToMutate] = { ...newTiles[randomIndexToMutate]!, isSuper: true };
            showMessage("✨ Super Tile Guaranteed! ✨", 1500);
            soundService.playPowerUp();
        }
        return newTiles;
    }

    // Base 1% random mutation if power-up is not active
    let tileWasMutated = false;
    const mutatedTiles = newTiles.map(tile => {
        if (tile && !tile.isSuper && Math.random() < 0.01) { // 1% base chance
            tileWasMutated = true;
            return { ...tile, isSuper: true };
        }
        return tile;
    });

    if (tileWasMutated) {
        showMessage("✨ Super Tile Created! ✨", 1500);
        soundService.playPowerUp();
    }
    
    return mutatedTiles;
  }, [gameState?.activePowerPlays?.mutationProtocol, gameState?.activePowerPlays?.treehouseOfHorror, showMessage]);

  useEffect(() => {
    // This effect is specifically for the Power Surge Ready notification
    if (gameState?.powerSurgeProgress === 4) {
      soundService.playPowerSurgeReady();
      showMessage("⚡ COMBO READY! Next word x2 score!", 2500);
    }
  }, [gameState?.powerSurgeProgress, showMessage]);

  const handleStartNextRound = useCallback(() => {
    dispatch({ type: 'START_NEXT_ROUND' });
  }, []);

  const handleShowMilestoneInfo = useCallback((milestone: Milestone) => {
    soundService.playModalOpen();
    dispatch({
        type: 'SET_MODAL_CONTENT',
        payload: {
            type: 'milestone-info',
            title: milestone.name,
            data: milestone,
        }
    });
  }, []);

  const handleShowEventLog = useCallback(() => {
      soundService.playModalOpen();
      dispatch({
          type: 'SET_MODAL_CONTENT',
          payload: {
              type: 'event-log',
              title: 'Event Log',
          }
      });
  }, []);

    const resetRound = useCallback((currentGameState: GameState, currentHand: (Tile | null)[], currentBuildRow: ({tile: Tile, originalIndex: number} | null)[], currentTileBag: string[]) => {
    const allTiles = [...currentHand.filter((t): t is Tile => t !== null), ...currentBuildRow.filter(i => i).map(item => item!.tile)];
    let { hand: newHandTiles, tileBag: finalBag } = gameUtils.dealNewHand(currentTileBag, allTiles, currentGameState.roundType === 'golden');
    
    newHandTiles = applyMutation(newHandTiles, currentGameState.roundType === 'golden');

    const paddedHand = Array(RACK_SIZE).fill(null);
    newHandTiles.forEach((tile, i) => paddedHand[i] = tile);

    const { newHand: finalHand, newBag: processedBag, balancingMessage } = gameUtils.postProcessHand(paddedHand, finalBag, currentGameState.roundType === 'golden');
    if (balancingMessage) {
        showMessage(balancingMessage, 1500);
    }

    dispatch({ type: 'RESET_ROUND', payload: { hand: sanitizeHand(finalHand), tileBag: processedBag } });
  }, [showMessage, applyMutation]);

  /** Ends a Golden Round without a scoring word (invalid word or its clock ran out). */
  const endGoldenRound = useCallback((message: string) => {
    soundService.playInvalidWord();
    showMessage(message, 3000);

    const updatedGameState = {
        ...gameState,
        roundType: 'normal' as const,
        goldenRoundThreshold: gameState.goldenRoundThreshold + 5,
        goldenTileId: null,
        consecutiveValidWords: 0,
    };

    // Dispatch the state update first so resetRound deals a normal hand and restores the time bank.
    dispatch({ type: 'UPDATE_GAME_STATE', payload: updatedGameState });
    resetRound(updatedGameState, hand, buildRow, tileBag);
  }, [gameState, hand, buildRow, tileBag, resetRound, showMessage]);

  const maxStrikes = useMemo(() => {
    const strikeBankUses = gameState?.charmUses?.['strikeBank'] || 0;
    if (strikeBankUses >= 2) return 5;
    if (strikeBankUses >= 1) return 4;
    return MAX_STRIKES_INITIAL;
  }, [gameState?.charmUses]);

  const isStrikeChallenge = useMemo(() => (gameState?.challengeCount ?? 0) <= 0, [gameState?.challengeCount]);
  const strikesRemaining = useMemo(() => maxStrikes - (gameState?.strikes ?? 0), [maxStrikes, gameState?.strikes]);


  const handleCloseModal = useCallback(() => {
    soundService.playUIClick();
    const lastModalType = state.modalContent?.type;
    const lastModalTitle = state.modalContent?.title || '';

    if (lastModalType === 'game-over-summary') {
        onGameOver(state.gameState);
        return;
    }
    
    const wasLastInQueue = state.modalQueue.length === 0;

    if (lastModalTitle === '❌ Strike Challenge Lost') {
        dispatch({ type: 'CLOSE_MODAL' });
        if (state.gameState.strikes < maxStrikes) {
            // Not game over yet, so reset the round.
            const allTiles = [...state.hand.filter((t): t is Tile => t !== null)];
            resetRound(state.gameState, allTiles, [], state.tileBag);
        }
        // If it is game over, the main timer useEffect will catch it now that the modal is closed.
        return;
    }

    if (lastModalTitle.includes('Groundhog’s Day')) {
        dispatch({ type: 'RESTART_ROUND_GROUNDHOG' });
        return;
    }

    if (lastModalTitle.includes('Deep Freeze')) {
      dispatch({ type: 'ADD_TIME', payload: 5 });
      dispatch({ type: 'CLOSE_MODAL' });
      return;
    }

    dispatch({ type: 'CLOSE_MODAL' });

    const postWordModals: (ModalContent['type'])[] = ['milestone', 'easter-egg', 'word-bonus', 'powerplay-selection', 'charm-selection', 'super-hand', 'info'];
    if (wasLastInQueue && lastModalType && (postWordModals.includes(lastModalType) || lastModalTitle.includes('Sonic Speed')) && lastModalTitle !== '❌ Strike Challenge Lost') {
        if (state.gameState.roundType === 'normal') {
            handleStartNextRound();
        }
    }
  }, [state.modalContent, state.modalQueue, state.gameState, handleStartNextRound, onGameOver, state.hand, state.tileBag, maxStrikes, resetRound]);


  useEffect(() => {
    if (modalContent?.autoClose) {
        const timer = setTimeout(() => {
            handleCloseModal();
        }, modalContent.autoClose);
        return () => clearTimeout(timer);
    }
  }, [modalContent, handleCloseModal]);


  const initialDeal = useCallback(() => {
    let bag = gameUtils.createTileBag();
    let { hand: newHand, tileBag: newBag } = gameUtils.dealNewHand(bag);

    newHand = applyMutation(newHand);

    const paddedHand = Array(RACK_SIZE).fill(null);
    newHand.forEach((tile, i) => paddedHand[i] = tile);
    
    const { newHand: finalHand, newBag: finalBag, balancingMessage } = gameUtils.postProcessHand(paddedHand, newBag);
    if (balancingMessage) {
        showMessage(balancingMessage, 1500);
    }
    
    dispatch({ type: 'SET_HAND_AND_BAG', payload: { hand: sanitizeHand(finalHand), tileBag: finalBag } });
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
    const isLow = (time ?? 0) > 0 && (time ?? 0) <= 3 && !isPaused && !isLoading;
    onTimeLow(isLow);
  }, [time, isPaused, isLoading, onTimeLow]);

  useEffect(() => {
    if (state.modalContent?.title === 'Sonic Speed Activated!') {
      const timerId = setTimeout(() => {
        if (state.modalContent?.title === 'Sonic Speed Activated!') {
          dispatch({ type: 'CLOSE_MODAL' });
        }
      }, 2000);
      return () => clearTimeout(timerId);
    }
  }, [state.modalContent, dispatch]);
  
  useEffect(() => {
      // Apply guards for pause, load, a backgrounded app, or special rounds/power-ups that stop time.
      if (!isVisible || isPaused || isLoading || gameState?.activePowerPlays?.leafOnTheWind) return;

      // First, check for game-ending strike condition.
      if ((gameState?.strikes ?? 0) >= maxStrikes) {
          soundService.playInvalidWord();
          dispatch({ type: 'GAME_OVER_INITIATED', payload: { reason: 'strikes' } });
          return;
      }

      // The rest of the timer logic runs only if time is not paused.
      if ((time ?? 0) <= 0) {
          // A Golden Round running out of time just ends the Golden Round; the bank comes back.
          if (gameState?.roundType === 'golden') {
              endGoldenRound("Time's up! Golden Round over.");
              return;
          }
          
          // Deep Freeze Check FIRST
          const deepFreezeCharm = (gameState?.activeCharms ?? []).find(c => c.id === 'deepFreeze');
          if (deepFreezeCharm && ((gameState?.charmUses?.['deepFreeze'] ?? 0) < (deepFreezeCharm.maxUses || 1))) {
              dispatch({ type: 'PAUSE_GAME' });
              const newCharmUses = { ...(gameState?.charmUses ?? {}), 'deepFreeze': (gameState?.charmUses?.['deepFreeze'] || 0) + 1 };
              dispatch({ 
                  type: 'UPDATE_GAME_STATE', 
                  payload: { 
                      charmUses: newCharmUses, 
                      activeBuffs: (gameState?.activeBuffs ?? []).filter(b => b.id !== 'deepFreeze'),
                      activeCharms: (gameState?.activeCharms ?? []).filter(c => c.id !== 'deepFreeze') 
                  }
              });
              dispatch({ type: 'SET_MODAL_CONTENT', payload: { type: 'info', title: '❄️ Deep Freeze! ❄️', content: 'Time has frozen for a moment. You have 5 seconds left. Make it count!' }});
              soundService.playMilestone();
              return;
          }

          // Groundhog's Day Check SECOND
          if ((gameState?.groundhogDayCharges ?? 0) > 0 && (gameState?.wordsThisRound ?? 0) === 0) {
              dispatch({ type: 'PAUSE_GAME' });
              
              const newCharges = gameState.groundhogDayCharges - 1;
              let payload: Partial<GameState> = { groundhogDayCharges: newCharges };
              
              if (newCharges === 0) {
                  payload.activeBuffs = (gameState.activeBuffs || []).filter(b => b.id !== 'groundhogsDay');
                  payload.activeCharms = (gameState.activeCharms || []).filter(c => c.id !== 'groundhogsDay');
              }

              dispatch({ type: 'UPDATE_GAME_STATE', payload });

              dispatch({ type: 'SET_MODAL_CONTENT', payload: { type: 'info', title: '🔄 Groundhog’s Day! 🔄', content: 'Same tiles. Same time. You get one more shot.' }});
              soundService.playMilestone();
              return;
          }
          
          soundService.playInvalidWord();
          dispatch({ type: 'GAME_OVER_INITIATED', payload: { reason: 'time' } });
          return;
      }
      
      if ((time ?? 0) > 0 && (time ?? 0) <= 10) {
        soundService.playTick();
      }

      const interval = setInterval(() => {
          dispatch({ type: 'TICK_TIMER' });
      }, 1000);

      return () => clearInterval(interval);
  }, [gameState, time, onGameOver, isPaused, isLoading, isVisible, showMessage, maxStrikes, endGoldenRound]);
  
  useEffect(() => {
    if (gameState?.lastPowerPlayResult) {
        showMessage(gameState.lastPowerPlayResult.message, 3000);
        dispatch({ type: 'UPDATE_GAME_STATE', payload: { lastPowerPlayResult: null } });
    }
  }, [gameState?.lastPowerPlayResult, showMessage]);

   const handleMoveToBuild = (tile: Tile, fromIndex: number) => {
    if (tile.isLocked || isChallengeLock || (buildRow?.filter(t => t).length ?? 0) >= BUILD_ROW_SIZE) return;
    
    if (gameState?.activePowerPlays?.['wordLock'] && (buildRow?.filter(t => t).length ?? 0) >= 5) {
        showMessage("Word Lock allows a max of 5 tiles.", 2000);
        return;
    }

    soundService.playTileClick();
    dispatch({ type: 'MOVE_TILE_TO_BUILD', payload: { tile, fromIndex } });
  };

  const handleReturnToHand = (fromBuildIndex: number) => {
    if (isChallengeLock) return;
    soundService.playTileClick();
    dispatch({ type: 'RETURN_TILE_TO_HAND', payload: { fromBuildIndex } });
  };
  
  const handleShuffle = (isFree = false, isFromChallengeWin = false) => {
    if((!isFree && (gameState?.shuffleCount ?? 0) <= 0) || isPaused || isChallengeLock || isLoading || gameState?.roundType === 'golden') return;


    soundService.playShuffle();

    const allTilesInPlay = [...(hand ?? []), ...(buildRow ?? []).map(item => item?.tile)].filter((t): t is Tile => t != null);
    if (allTilesInPlay.some(tile => tile && tile.tempPoints === 25)) {
        showMessage("👑 'One Tile' effect lost on shuffle.", 2000);
    }

    if (!isFree) {
        if ((gameState?.powerSurgeProgress ?? 0) === 3 || (gameState?.powerSurgeProgress ?? 0) === 4) {
            soundService.playComboDrop();
            showMessage("Combo Lost! Don't worry, even Jack couldn’t fix this one.", 3000);
        } else if ((gameState?.powerSurgeProgress ?? 0) > 0) {
            soundService.playComboDrop();
            showMessage('😵 Combo Dropped!', 2500);
        }
    }

    const tilesToReturn = [...(hand ?? []), ...(buildRow ?? []).map(item => item?.tile)].filter((t): t is Tile => t != null);
    let { hand: newHandTiles, tileBag: newBagForShuffle } = gameUtils.dealNewHand(tileBag, tilesToReturn, gameState?.roundType === 'golden');
    
    newHandTiles = applyMutation(newHandTiles, gameState?.roundType === 'golden');

    const paddedHand = Array(RACK_SIZE).fill(null);
    newHandTiles.forEach((tile, i) => { 
        if (i < RACK_SIZE) paddedHand[i] = tile;
    });

    const { newHand: finalHand, newBag: finalBag, balancingMessage } = gameUtils.postProcessHand(paddedHand, newBagForShuffle, gameState?.roundType === 'golden');
    if (balancingMessage) {
        showMessage(balancingMessage, 1500);
    }
    
    dispatch({ 
        type: 'PERFORM_SHUFFLE', 
        payload: { 
            hand: sanitizeHand(finalHand), 
            tileBag: finalBag,
            isFree: isFree,
            isFromChallengeWin: isFromChallengeWin,
        } 
    });
  };

  const completeSubmission = useCallback(async (
    word: string, 
    submittedTiles: Tile[],
    finalWordScore: number, 
    rawBaseScoreParam: number,
    baseBonuses: ScoreBonusInfo[],
    validationDef: string,
    wordLockActive: boolean,
    infoMessage?: string,
    scoreBreakdown?: Pick<ScoreCalculationResult, 'scoreBeforeMultiplier' | 'wordMultiplier' | 'capped'>
    ) => {
      dispatch({ type: 'STORE_LAST_TURN' });
      let newState = { ...gameState };
      const willTriggerGoldenRound = (newState.consecutiveValidWords + 1) >= newState.goldenRoundThreshold && newState.roundType === 'normal';
      let rawBaseScore = rawBaseScoreParam;
      const now = Date.now();
      const modalQueue: ModalContent[] = [];
      if (infoMessage) {
        modalQueue.push({ type: 'info', title: 'PowerPlay Result', content: infoMessage, autoClose: 2500 });
      }
      const eventLogQueue: EventLogEntry[] = [];
      const oldScore = newState.score;
      const totalWordsSubmitted = totalWords + 1;
      const WORD_OVERRIDE_EGG_IDS = new Set(['sex', 'poop', 'kermitWisdom', 'homersDelight', 'dundieAward', 'dangerousAlone', 'totallyBuggin', 'loveBonus', 'timeBonus', 'dieBonus', 'gunBonus', 'joyBonus', 'chandlerBing', 'deadPoetsSociety', 'terminator', 'spiderman', 'nerd', 'flashsFrenzy', 'lionKingsLegacy', 'starshipEnterprise', 'popIdolAudition', 'hogwartsHousePoints', 'bluePillBonus', 'slimShadySnap', 'spaceJamSlam', 'oneUp', 'jamesBond', 'pinkPonyClub', 'flexAppeal', 'getOffMyPlane', 'sixpenceSwoon', 'heroOfHyrule']);
      let scoreResult: ScoreCalculationResult = { totalScore: finalWordScore, baseScore: rawBaseScoreParam, bonuses: [...baseBonuses], ...scoreBreakdown };

      // --- A: GOLDEN ROUND SUBMISSION ---
        if (newState.roundType === 'golden') {
            scoreResult = gameUtils.calculateScore(word, submittedTiles, newState);
            const turnScore = scoreResult.totalScore;
            
            newState.score += turnScore;
            
            const wordLogEntry: WordLogEntry = { 
                type: 'word', word, score: turnScore, baseScore: scoreResult.baseScore, bonuses: scoreResult.bonuses,
                definition: validationDef, status: 'valid', cumulativeScore: newState.score
            };
            newState.log = [...newState.log, wordLogEntry];
            
            newState.roundType = 'normal';
            newState.goldenRoundThreshold += 5;
            newState.goldenTileId = null;
            newState.consecutiveValidWords = 0; // Reset streak after successful Golden Round
            newState.pendingTimeBonus = timeForWord(word.length); // Added back onto the time bank

            showMessage(`Golden Word: ${word.toUpperCase()}! +${turnScore}. Hand reshuffled!`, 3000);
            
            // Perform a full shuffle after the Golden Round. The next round is normal.
            const allTilesFromHand = (hand ?? []).filter((t): t is Tile => t !== null);
            let { hand: newHandTiles, tileBag: finalBag } = gameUtils.dealNewHand(tileBag, allTilesFromHand, false);
            newHandTiles = applyMutation(newHandTiles, false);
            const paddedHand = Array(RACK_SIZE).fill(null);
            newHandTiles.forEach((tile, i) => paddedHand[i] = tile);
            const { newHand: finalHand, newBag: processedBag, balancingMessage } = gameUtils.postProcessHand(paddedHand, finalBag, false);
            if (balancingMessage) {
                showMessage(balancingMessage, 1500);
            }

            // Dispatch success with the new shuffled hand.
            dispatch({ type: 'HANDLE_SUBMIT_SUCCESS', payload: { gameState: newState, hand: sanitizeHand(finalHand), tileBag: processedBag, modalQueue } });
            dispatch({ type: 'SET_IS_LOADING', payload: false });
            
            if (modalQueue.length === 0) {
                // If there are no other modals, reset the timer for the new hand.
                dispatch({ type: 'RESET_ROUND', payload: { hand: sanitizeHand(finalHand), tileBag: processedBag } });
            }
            return;
        }

      // --- B: NORMAL ROUND SUBMISSION ---
      // The word's time is added to the bank when the next round starts.
      newState.pendingTimeBonus = timeForWord(word.length);

      // Strike recovery: a long enough run of valid words wins back a strike.
      const recovery = advanceStrikeRecovery(newState.strikeRecoveryStreak ?? 0, newState.strikes);
      newState.strikeRecoveryStreak = recovery.streak;
      if (recovery.recovered) {
          newState.strikes -= 1;
          showToast(`🩹 ${GAMEPLAY.strikeRecoveryStreak} in a row! Strike recovered.`);
          soundService.playPowerUp();
          newState.log = [...newState.log, {
              type: 'event', id: `strike-recovery-${now}`, name: 'Comeback Kid', icon: '🩹',
              description: `${GAMEPLAY.strikeRecoveryStreak} valid words in a row won back a strike.`,
              scoreChange: 0, cumulativeScore: newState.score,
          }];
      }
      
      const wordBasedEgg = EASTER_EGGS.find(egg => 
          WORD_OVERRIDE_EGG_IDS.has(egg.id) && 
          !newState.foundEasterEggs.some(fe => fe.id === egg.id) &&
          egg.trigger(word, 0, newState)
      );
      
      if (word.length >= 5 && !wordBasedEgg && !isChallengeLock) {
          showToast(`Length bonus x${lengthMultiplier(word.length)}!`);
      }
      
      // --- Heisenberg PowerPlay ---
      if (newState.activePowerPlays.heisenberg) {
        const isWin = Math.random() < 0.5;
        let modalContent = '';
        if (isWin) {
            scoreResult.totalScore *= 3;
            scoreResult.bonuses.push({ name: 'Heisenberg (Win)', description: 'x3 Score' });
            modalContent = "You are the one who knocks! Triple score!";
        } else {
            scoreResult.totalScore = 0;
            scoreResult.bonuses = [{ name: 'Heisenberg (Loss)', description: 'Score x0' }]; // Overwrite bonuses
            modalContent = "You broke bad. Your score for this word is zero.";
        }
        modalQueue.push({ type: 'info', title: '⚗️ Heisenberg', content: modalContent, autoClose: 2500 });
      }

      // --- 2. WORD COMBO LOGIC ---
      if (newState.powerSurgeProgress === 4) { // This is the 5th word in the streak.
          scoreResult = addWordMultiplier(scoreResult, 2);
          scoreResult.bonuses.push({ name: "⚡ 5-Word Combo!", description: "x2 Score"});
          newState.powerSurgeProgress = 0;
      } else {
          newState.powerSurgeProgress++;
      }

      // --- 3. WORD-BASED EASTER EGG OVERRIDE ---
      if (wordBasedEgg) {
          const eggScore = wordBasedEgg.reward.points || 0;
          // The egg replaces the word score, so later multipliers apply to the egg's points.
          scoreResult = { totalScore: eggScore, baseScore: scoreResult.baseScore, bonuses: scoreResult.bonuses };
          rawBaseScore = 0; // Base score is nullified by the Easter Egg override
          newState.foundEasterEggs = [...newState.foundEasterEggs, wordBasedEgg];
          modalQueue.push({ type: 'easter-egg', title: wordBasedEgg.name, content: wordBasedEgg.reward.message, data: wordBasedEgg });
          // Overwrite bonuses to show the Easter Egg as the primary source of points in the log
          scoreResult.bonuses = [{ name: wordBasedEgg.name, description: `+${eggScore} pts` }];
      }
      
      // --- 4. STATEFUL & RANDOM BONUSES on top of word score ---
      
      let runningScore = oldScore;
      
      // Power Word Bonus
      if (powerWord && word.toUpperCase() === powerWord.toUpperCase() && !newState.powerWordUsed) {
          newState.powerWordUsed = true; // Mark as used for this run
          const powerWordBonus = 500;
          scoreResult.totalScore += powerWordBonus;
          scoreResult.bonuses.push({ name: "Power Word!", description: `+${powerWordBonus} pts`});
          const tempRunningScore = runningScore + scoreResult.totalScore;
          eventLogQueue.push({ 
              type: 'event', 
              id: `power-word-${Date.now()}`, 
              name: 'Power Word Bonus!', 
              icon: '💥', 
              description: `You played your daily Power Word: ${powerWord.toUpperCase()}`, 
              scoreChange: powerWordBonus, 
              cumulativeScore: tempRunningScore
          });
          modalQueue.push({ type: 'info', title: '💥 Power Word!', content: `You played your daily Power Word for a +500 point bonus!`, autoClose: 2500 });
      }
      
      // Duck Hunt Bonus
      if (newState.activePowerPlays.duckHunt?.ready && word.toUpperCase().includes(newState.activePowerPlays.duckHunt.letter)) {
          const duckHuntBonus = 50;
          scoreResult.totalScore += duckHuntBonus;
          scoreResult.bonuses.push({ name: 'Duck Hunt', description: `+${duckHuntBonus} pts`});
          const tempRunningScore = runningScore + scoreResult.totalScore;
          eventLogQueue.push({ 
              type: 'event', 
              id: `pp-duckHunt-${Date.now()}`, 
              name: 'Duck Hunt', 
              icon: '🦆', 
              description: `Bonus for using the sniped letter '${newState.activePowerPlays.duckHunt.letter}'`, 
              scoreChange: duckHuntBonus, 
              cumulativeScore: tempRunningScore
          });
          showMessage(`🦆 Duck Hunt! +50 point bonus!`, 2500);
      }

      const originalWordScore = scoreResult.totalScore;
      if (newState.activeCharms.some(c => c.id === 'goldenTicket') && Math.random() <= 0.10) {
        scoreResult.totalScore *= 3;
        scoreResult.bonuses.push({ name: 'Golden Ticket!', description: "Golden Ticket! x3 Score"});
        modalQueue.push({ type: 'info', title: '🎟️ Golden Ticket!', content: 'You found it! Your score is tripled!' });
      }
      if (newState.activePowerPlays['philsosophy']) {
          const rand = Math.random();
          if(rand < 0.20) { 
              scoreResult.totalScore += 50; 
              scoreResult.bonuses.push({ name: "Phil's-osophy", description: "+50 pts"}); 
              modalQueue.push({ type: 'info', title: "🎲 Phil's-osophy", content: "Life's a coin flip. This time, it came up heads. +50 points." });
          } else if (rand < 0.30) { 
              scoreResult.totalScore -= 10; 
              scoreResult.bonuses.push({ name: "Phil's-osophy", description: "-10 pts"}); 
              modalQueue.push({ type: 'info', title: "🎲 Phil's-osophy", content: "Life's a coin flip. This time, not so good. -10 points." });
          }
      }

      // Check Blue Shell Surprise
      if (newState.activePowerPlays['blueShellSurprise']) {
          const isWin = Math.random() < 0.5;
          let modalContent = '';
          if (isWin) {
              const bonus = scoreResult.totalScore * 3;
              scoreResult.totalScore *= 4;
              scoreResult.bonuses.push({ name: 'Blue Shell (Win)', description: 'x4 Word Score' });
              modalContent = `It's a direct hit! Your word score was quadrupled! (+${Math.round(bonus)} points)`;
          } else {
              scoreResult.totalScore -= 400;
              scoreResult.bonuses.push({ name: 'Blue Shell (Loss)', description: '-400 pts' });
              modalContent = `Oh no, it backfired! You lost 400 points from this turn's score.`;
          }
          modalQueue.push({ type: 'info', title: 'Blue Shell Surprise', content: modalContent, autoClose: 2500 });
      }


      const isSecondSubmission = newState.log.filter(e => e.type === 'word' && e.word === word).length > 0;
      if (newState.activeCharms.some(c => c.id === 'doctorStrangesLoop') && isSecondSubmission) {
          scoreResult = addWordMultiplier(scoreResult, 2);
          scoreResult.bonuses.push({ name: "Dr. Strange's Loop", description: "Dr. Strange's Loop: x2 Score"});
          showMessage("🌀 Dr. Strange's Loop! Word replayed for x2 score.", 3000);
      }
      const timeSinceLast = now - newState.lastSubmissionTime;
      if (newState.activeCharms.some(c => c.id === 'momentum') && timeSinceLast < 10000 && newState.consecutiveSuccesses > 0) {
          scoreResult.totalScore += 20;
          scoreResult.bonuses.push({ name: "Momentum", description: "Momentum: +20 pts"});
          showMessage("💨 Momentum! +20 bonus points.", 2000);
      }
      const scoreBeforeEncore = scoreResult.totalScore;
      
      // Nicole's Grace Check
      if (newState.activeCharms.some(c => c.id === 'nicolesGrace')) {
          const endsInVowel = VOWELS.has(word.toUpperCase().slice(-1));
          if (word.toUpperCase().includes('M') || endsInVowel) {
              const bonus = Math.round(scoreResult.totalScore * 0.15);
              scoreResult.totalScore += bonus;
              scoreResult.bonuses.push({ name: "Nicole's Grace", description: `+${bonus} pts (15%)` });
          }
      }

      if (newState.pianoManEncoreActive) {
          const bonus = Math.round(scoreResult.totalScore * 0.15);
          scoreResult.totalScore += bonus;
          scoreResult.bonuses.push({ name: "Piano Man Encore", description: `Piano Man Encore: +${bonus} pts`});
          showMessage(`🎹 Piano Man Encore! +${bonus} bonus points.`, 2000);
      }
      if (newState.activeCharms.some(c => c.id === 'christiansHoodieMode')) {
          if (timeSinceLast < 10000 && /[GAM]/.test(word.toUpperCase())) {
              const bonus = Math.round(scoreResult.totalScore * 0.15);
              scoreResult.totalScore += bonus;
              scoreResult.bonuses.push({ name: "Christian’s Hoodie Mode", description: `+${bonus} pts (15%)`});
              showMessage(`🎮 Hoodie Mode! +${bonus} bonus points.`, 2000);
          }
      }

      if (newState.activePowerPlays.multiverseOfSadness) {
          const timeBonus = Math.round(scoreResult.totalScore / 2);
          scoreResult.totalScore = Math.floor(scoreResult.totalScore / 2);
          newState.multiverseTimeBonus = timeBonus;
          scoreResult.bonuses.push({ name: "Multiverse of Sadness", description: `Multiverse: /2 Score, +${timeBonus}s next round`});
          showMessage(`🌀 Multiverse: +${timeBonus}s next round!`, 3000);
      }

      // Charm Bonuses that add on top
      const currentHour = new Date().getHours();
      if (newState.activeCharms.some(c => c.id === 'buffyBonus') && (currentHour >= 20 || currentHour < 8)) {
        const bonus = Math.round(scoreResult.totalScore * 0.15);
        scoreResult.totalScore += bonus;
        scoreResult.bonuses.push({ name: 'Buffy Bonus', description: `+${bonus} (15%)` });
      }
      if (newState.activeCharms.some(c => c.id === 'totallyClueless') && originalWordScore < 10) {
        scoreResult.totalScore += 25;
        scoreResult.bonuses.push({ name: 'Totally Clueless', description: `+${25} pts` });
      }

      // --- PERFECT 4-CHAIN LOGIC ---
      if (word.length === 4) {
          newState.perfectChainProgress++;
          const chainBonus = newState.perfectChainProgress * 20;
          scoreResult.totalScore += chainBonus;
          scoreResult.bonuses.push({ name: `4-Letter Chain! (x${newState.perfectChainProgress})`, description: `+${chainBonus} pts` });

          if (newState.perfectChainProgress === 4) {
              const perfectChainBonus = 444;
              scoreResult.totalScore += perfectChainBonus;
              scoreResult.bonuses.push({ name: 'Perfect 4-Chain!', description: `+${perfectChainBonus} pts` });
              
              soundService.playNESFanfare();
              const mainContainer = document.getElementById('main-container');
              if (mainContainer) {
                  mainContainer.classList.add('screen-shake');
                  setTimeout(() => mainContainer.classList.remove('screen-shake'), 500);
              }

              modalQueue.push({
                  type: 'info',
                  title: '⛓️ PERFECT 4-CHAIN! ⛓️',
                  content: `Four 4-letter words in a row! That's some serious skill! You've earned a massive 444 point bonus!`,
                  autoClose: 4000,
              });

              newState.perfectChainProgress = 0; // Reset for the next chain
          }
      } else {
          if (newState.perfectChainProgress > 0) {
              newState.perfectChainProgress = 0;
          }
      }
      
      // Clever Girl check
      if (newState.activeCharms.some(c => c.id === 'cleverGirl')) {
        const raptorLetters = new Set(['R', 'A', 'P', 'T', 'O']);
        const uniqueLettersInWord = new Set(word.toUpperCase().split(''));
        const matchingLetters = [...uniqueLettersInWord].filter(letter => raptorLetters.has(letter));
        if (matchingLetters.length >= 3) {
            newState.multiverseTimeBonus = (newState.multiverseTimeBonus || 0) + 5;
            showMessage("🦖 Clever Girl! +5s next round.", 2500);
        }
      }
      
      // Execute Order 66 check
      if (newState.activeCharms.some(c => c.id === 'executeOrder66')) {
        const hasDoubleLetter = /(.)\1/i.test(word);
        if (hasDoubleLetter) {
          newState.multiverseTimeBonus = (newState.multiverseTimeBonus || 0) + 6;
          showMessage("🛰️ Execute Order 66! +6s next round.", 2500);
        }
      }
      
      // --- 5. GAME STATE BONUSES (Refactored) ---
      runningScore += scoreResult.totalScore;

      const isSuperHand = ((hand ?? []).filter(t => t !== null).length === 0);
      if (isSuperHand) {
          const superHandBonus = SUPER_HAND_BONUS;
          runningScore += superHandBonus;
          scoreResult.bonuses.push({ name: "Super Hand", description: `+${superHandBonus} pts`});
          eventLogQueue.push({ type: 'event', id: `super-hand-${Date.now()}`, name: 'Super Hand!', icon: '✨', description: 'Cleared the entire hand in one word!', scoreChange: superHandBonus, cumulativeScore: runningScore });
          
          let gauntletBonus = 0;
          if (newState.activeCharms.some(c => c.id === 'infinityGauntlet')) {
              gauntletBonus = 75;
              runningScore += gauntletBonus;
              scoreResult.bonuses.push({ name: "Infinity Gauntlet", description: `+${gauntletBonus} pts`});
              eventLogQueue.push({ type: 'event', id: `gauntlet-${Date.now()}`, name: 'Infinity Gauntlet!', icon: '🧤', description: 'Super Hand bonus was enhanced!', scoreChange: gauntletBonus, cumulativeScore: runningScore });
          }
          const superHandText = `You've assembled the perfect hand. Consider it a snap. +${SUPER_HAND_BONUS}`;
          modalQueue.push({ type: 'super-hand', title: '✨ SUPER HAND! ✨', content: superHandText, data: { points: superHandBonus, gauntletBonus } });
      }

      if (word.length === 8) {
          const niceRackBonus = 555;
          runningScore += niceRackBonus;
          scoreResult.bonuses.push({ name: "Whoa, Nice Rack!", description: `+${niceRackBonus} pts`});
          modalQueue.push({ 
              type: 'info', 
              title: '😈 "WHOA, NICE RACK!" 😜', 
              content: "Hot dang, you slapped down an 8-letter word that’s turning heads! That full rack’s so loaded, it’s practically bursting—giggity giggity GOO! You’re strutting that word board with a wink and a grin, you sly dog, you.\n\n+555 bonus points! Ohhh yeah!" 
          });
      }

      if (newState.activeCharms.some(c => c.id === 'fluxCapacitor') && (totalWordsSubmitted) % 8 === 0) {
          const bonus = Math.round((scoreResult.totalScore) * 0.55); // Recalculate based on word score only
          runningScore += bonus;
          scoreResult.bonuses.push({ name: "Flux Capacitor", description: `+${bonus} pts`});
          showMessage(`🕰️ Flux Capacitor! +${bonus} bonus points.`, 2500);
      }
      if (newState.activeCharms.some(c => c.id === 'thrillerNight') && (totalWordsSubmitted) % 4 === 0) {
        const thrillerBonus = 30;
        runningScore += thrillerBonus;
        scoreResult.bonuses.push({ name: 'Thriller Night', description: `+${thrillerBonus} pts` });
        showMessage("🧟 Thriller Night! +30 points.", 3000);
      }
      
      // --- STREAK BONUSES ---
      newState.consecutiveSuccesses++;
      newState.longestStreak = Math.max(newState.longestStreak, newState.consecutiveSuccesses);
      let shouldResetStreak = false;

      // Glitch in the Code check
      if (newState.activeCharms.some(c => c.id === 'glitchInTheCode')) {
          if (newState.consecutiveSuccesses >= 6) {
              newState.glitchActive = true;
              shouldResetStreak = true;
              showMessage("🤖 Glitch in the Code! +5s next round.", 3000);
          }
      }
      
      // Golden Snitch check
      const snitchCharmActive = newState.activeCharms.some(c => c.id === 'goldenSnitch');
      if (snitchCharmActive && newState.consecutiveSuccesses >= 5) {
          const snitchBonus = 500;
          runningScore += snitchBonus;
          scoreResult.bonuses.push({ name: "Golden Snitch", description: `+${snitchBonus} pts`});
          shouldResetStreak = true;
          modalQueue.push({ type: 'info', title: '🕊️ Golden Snitch Caught!', content: '5 words in a row! You earned a massive 500 point bonus!' });
          newState.activeCharms = newState.activeCharms.filter(c => c.id !== 'goldenSnitch');
          newState.activeBuffs = newState.activeBuffs.filter(b => b.id !== 'goldenSnitch');
      }

      if (shouldResetStreak) {
          newState.consecutiveSuccesses = 0;
      }

      // --- DUCK HUNT COMBO and DR MARIO CURE ---
      if (newState.activeCharms.some(c => c.id === 'duckHuntCombo')) {
          const currentWordLetters = new Set(word.toUpperCase().split(''));
          if (newState.duckHuntComboState.streakCount === 0) {
              newState.duckHuntComboState = { streakLetters: currentWordLetters, streakCount: 1 };
          } else {
              const intersection = new Set([...newState.duckHuntComboState.streakLetters!].filter(x => currentWordLetters.has(x)));
              if (intersection.size > 0) {
                  newState.duckHuntComboState.streakLetters = intersection;
                  newState.duckHuntComboState.streakCount++;
              } else {
                  newState.duckHuntComboState = { streakLetters: currentWordLetters, streakCount: 1 };
              }
          }

          if (newState.duckHuntComboState.streakCount >= 3) {
              const duckHuntBonus = 350;
              runningScore += duckHuntBonus;
              scoreResult.bonuses.push({ name: 'Duck Hunt Combo', description: `+${duckHuntBonus} pts` });
              modalQueue.push({ type: 'info', title: '🎯 Duck Hunt Combo!', content: 'You used the same letter in 3 straight words! +350 points.' });
              newState.duckHuntComboState = { streakLetters: null, streakCount: 0 };
          }
      }
      if (newState.activeCharms.some(c => c.id === 'drMariosCure')) {
          const hasMultiplierTile = submittedTiles.some(t => (t.multiplier && t.multiplier > 1) || t.isSuper);
          if (hasMultiplierTile) {
              newState.drMarioCureStreak = 0;
          } else {
              newState.drMarioCureStreak++;
          }

          if (newState.drMarioCureStreak >= 3) {
              const drMarioBonus = 100;
              runningScore += drMarioBonus;
              scoreResult.bonuses.push({ name: 'Dr. Mario’s Cure', description: `+${drMarioBonus} pts` });
              modalQueue.push({ type: 'info', title: '💊 Dr. Mario’s Cure!', content: '3 clean words in a row! +100 bonus points.' });
              newState.drMarioCureStreak = 0;
          }
      }

      // --- 6. Aggregate Score and Check Aggregate Bonuses ---
      const turnScorePreMilestone = runningScore - oldScore;

      // Word Bonuses
      const newWordBonus = WORD_BONUSES.find(wb => 
          totalWordsSubmitted === wb.wordCount && 
          !newState.unlockedWordBonusIds.includes(wb.id)
      );
      if (newWordBonus) {
          runningScore += newWordBonus.reward.points;
          newState.unlockedWordBonusIds = [...newState.unlockedWordBonusIds, newWordBonus.id];
          scoreResult.bonuses.push({ name: newWordBonus.title, description: `+${newWordBonus.reward.points} pts` });
          modalQueue.push({ type: 'word-bonus', title: newWordBonus.title, content: newWordBonus.description, data: newWordBonus });
          eventLogQueue.push({ type: 'event', id: `wb-${newWordBonus.id}`, name: newWordBonus.title, icon: '🏆', description: newWordBonus.description, scoreChange: newWordBonus.reward.points, cumulativeScore: runningScore });
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
                      eventLogQueue.push({ type: 'event', id: `ms-${milestone.id}`, name: milestone.name, icon: milestone.icon, description: milestone.flavorText, scoreChange: milestone.reward.points, cumulativeScore: runningScore });
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
              let eggScoreChange = 0;
              if (egg.reward.points) {
                  runningScore += egg.reward.points;
                  eggScoreChange = egg.reward.points;
                  scoreResult.bonuses.push({ name: egg.name, description: `+${egg.reward.points} pts` });
              }
              if (egg.reward.shuffle) newState.shuffleCount += egg.reward.shuffle;
              modalQueue.push({ type: 'easter-egg', title: egg.name, content: egg.reward.message, data: egg });
              const eggIcon = egg.name.split(' ')[0];
              eventLogQueue.push({ type: 'event', id: `egg-${egg.id}`, name: egg.name, icon: eggIcon, description: egg.reward.message, scoreChange: eggScoreChange, cumulativeScore: runningScore });
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
              eventLogQueue.push({ type: 'event', id: `charm-beanCounter-${Date.now()}`, name: 'Bean Counter', icon: '🫘', description: `Total score hit a multiple of 500!`, scoreChange: beanCounterBonus, cumulativeScore: runningScore });
              showMessage(`🫘 Bean Counter! +${beanCounterBonus} points.`, 3000);
          }
      }

      // The Final Frontier Check
      const finalFrontierCharm = newState.activeCharms.find(c => c.id === 'finalFrontier');
      if (finalFrontierCharm) {
          const uses = newState.charmUses['finalFrontier'] || 0;
          const maxUses = finalFrontierCharm.maxUses || 2;
          if (uses < maxUses) {
              const oldMilestone = Math.floor(oldScore / 1000);
              const newMilestone = Math.floor(runningScore / 1000);
              if (newMilestone > oldMilestone) {
                  const potentialTriggers = newMilestone - oldMilestone;
                  const remainingTriggers = maxUses - uses;
                  const actualTriggers = Math.min(potentialTriggers, remainingTriggers);

                  if (actualTriggers > 0) {
                      const currentChallenges = newState.challengeCount;
                      const maxHeldChallenges = 4;
                      if (currentChallenges < maxHeldChallenges) {
                          const challengesToAdd = Math.min(actualTriggers, maxHeldChallenges - currentChallenges);
                          if (challengesToAdd > 0) {
                              newState.challengeCount += challengesToAdd;
                              newState.charmUses['finalFrontier'] = uses + challengesToAdd;
                              
                              const newTotalUses = uses + challengesToAdd;
                              const message = `🧑‍🚀 Final Frontier! +${challengesToAdd} Challenge(s) earned. (${newTotalUses}/${maxUses} used)`;
                              showMessage(message, 3000);
                              soundService.playMilestone();

                              if (newTotalUses >= maxUses) {
                                  const buffIndex = newState.activeBuffs.findIndex(b => b.id === 'finalFrontier');
                                  if (buffIndex > -1) {
                                      const updatedBuff = { ...newState.activeBuffs[buffIndex], description: 'This effect has been used the maximum number of times.' };
                                      newState.activeBuffs[buffIndex] = updatedBuff;
                                  }
                              }
                          }
                      }
                  }
              }
          }
      }

      // --- 7. FINAL SCORE UPDATE ---
      newState.score = Math.round(runningScore);

      // --- Handle Coin Award ---
      const turnScore = newState.score - oldScore;
      
      // --- 8. OTHER STATE UPDATES ---
      
      newState.pianoManEncoreActive = newState.activeCharms.some(c => c.id === 'pianoManEncore') && scoreBeforeEncore >= 45;

      // L Train Shuffle: a word with both L and T earns a free shuffle, twice per game.
      const lTrainCharm = newState.activeCharms.find(c => c.id === 'lTrainShuffle');
      if (lTrainCharm && /L/i.test(word) && /T/i.test(word)) {
          const uses = (newState.charmUses['lTrainShuffle'] || 0) + 1;
          const maxUses = lTrainCharm.maxUses || 2;
          newState.shuffleCount += 1;
          newState.charmUses = { ...newState.charmUses, lTrainShuffle: uses };
          if (uses >= maxUses) {
              newState.activeCharms = newState.activeCharms.filter(c => c.id !== 'lTrainShuffle');
              newState.activeBuffs = newState.activeBuffs.filter(b => b.id !== 'lTrainShuffle');
          }
          eventLogQueue.push({ type: 'event', id: `charm-lTrain-${now}`, name: lTrainCharm.name, icon: '🚆', description: `L and T in "${word.toUpperCase()}": free shuffle (${uses}/${maxUses}).`, scoreChange: 0, cumulativeScore: runningScore });
          showMessage(`🚆 L Train Shuffle! Free shuffle (${uses}/${maxUses}).`, 2500);
      }
      
      if (newState.activeCharms.some(c => c.id === 'strikeBank')) {
          newState.flawlessScore += turnScore;
          const currentUses = newState.charmUses['strikeBank'] || 0;
  
          // Check for the first upgrade
          if (currentUses === 0 && newState.flawlessScore >= 500) {
              newState.charmUses = { ...newState.charmUses, 'strikeBank': 1 };
              newState.flawlessScore -= 500; // Carry over any excess points.
              showMessage("🏦 Strike Bank: 4th Strike Unlocked! Next goal: 1000 flawless points.", 4000);
              soundService.playMilestone();
          // Check for the second upgrade, ONLY if the first is already unlocked
          } else if (currentUses === 1 && newState.flawlessScore >= 1000) {
              newState.charmUses = { ...newState.charmUses, 'strikeBank': 2 };
              
              // Find the buff and update its description to reflect it's maxed out.
              const buffIndex = newState.activeBuffs.findIndex(b => b.id === 'strikeBank');
              if (buffIndex !== -1) {
                  const updatedBuff = { ...newState.activeBuffs[buffIndex], description: 'Fully upgraded. Maximum of 5 strikes reached.' };
                  newState.activeBuffs[buffIndex] = updatedBuff;
              }
  
              // Do NOT remove the charm. This keeps it from being offered again.
  
              showMessage("🏦 Strike Bank: 5th Strike Unlocked! Maximum strikes reached.", 4000);
              soundService.playMilestone();
          }
      }

      if (turnScore >= 150 && newState.activeCharms.some(c => c.id === 'powerStarResidual')) {
        newState.powerStarResidualActive = true;
        // Optionally update the buff description
        const buffIndex = newState.activeBuffs.findIndex(b => b.id === 'powerStarResidual');
        if (buffIndex !== -1) {
            const updatedBuff = { ...newState.activeBuffs[buffIndex], description: 'ACTIVE: All future words get +5 points.' };
            newState.activeBuffs[buffIndex] = updatedBuff;
        }
      }
      
      showMessage(`${word.toUpperCase()}: +${Math.round(turnScorePreMilestone)}`, 3000);

      const wordLogEntry: WordLogEntry = {
        type: 'word',
        word,
        score: Math.round(turnScore),
        baseScore: rawBaseScore,
        bonuses: scoreResult.bonuses,
        definition: validationDef,
        status: 'valid',
        cumulativeScore: newState.score
      };
      newState.log = [...newState.log, wordLogEntry, ...eventLogQueue];
      newState.longestWord = word.length > newState.longestWord.length ? word : newState.longestWord;
      if (!newState.highestScoringWord || turnScore > newState.highestScoringWord.score) {
        newState.highestScoringWord = { ...wordLogEntry, score: turnScore };
      }
      newState.wordsThisRound++;
      newState.lastSubmissionTime = now;

      // --- PowerPlay & Charm Offer Logic ---
      
      // Cooldowns
      const newPowerPlayCooldowns = { ...newState.powerPlayCooldowns };
      for (const id in newPowerPlayCooldowns) {
          newPowerPlayCooldowns[id]--;
          if (newPowerPlayCooldowns[id] <= 0) delete newPowerPlayCooldowns[id];
      }
      newState.powerPlayCooldowns = newPowerPlayCooldowns;
      
      const newCharmCooldowns = { ...newState.charmCooldowns };
      for (const id in newCharmCooldowns) {
          newCharmCooldowns[id]--;
          if (newCharmCooldowns[id] <= 0) delete newCharmCooldowns[id];
      }
      newState.charmCooldowns = newCharmCooldowns;
      
      // PowerPlay Offer Check
      let newProgress = { ...newState.powerPlayProgress };
      newProgress.turnsSinceLastOffer++;

      // The PowerPlay meter fills from letters played (config/gameplay.ts).
      const meter = advancePowerPlayMeter(newProgress.letters ?? 0, word.length);
      newProgress.letters = meter.letters;

      const triggeredByMeter = meter.full;
      const triggeredByWordCount = totalWordsSubmitted > 0 && totalWordsSubmitted % GAMEPLAY.powerPlayEveryWords === 0;

      if (triggeredByMeter || triggeredByWordCount) {
          const canOffer = newState.powerPlayOffer.length === 0 &&
                           newState.availablePowerPlays.length === 0 &&
                           newProgress.turnsSinceLastOffer >= 4;

          if (canOffer) {
              const powerPlaysToOfferFrom = POWER_PLAYS_LIST.filter(pp => 
                  !newState.activeBuffs.some(ab => ab.id === pp.id) &&
                  !newState.powerPlayCooldowns[pp.id]
              );
              const { offeredItems: offeredPowerPlays, offerDetails } = gameUtils.getOffer(powerPlaysToOfferFrom, 3, newState);

              if (offeredPowerPlays.length > 0) {
                  newState.powerPlayOffer = offeredPowerPlays;
                  
                  // Update state for weighting logic
                  newState.offerHistory.push(offerDetails);
                  newState.totalOffersMade++;
                  offerDetails.forEach(offer => {
                      const id = offer.id;
                      const stats = newState.itemStats[id] || { offered: 0, lastOfferedTurn: -1 };
                      stats.offered++;
                      stats.lastOfferedTurn = totalWords + 1; // current turn
                      newState.itemStats[id] = stats;
                      newState.sessionOfferCounts[id] = (newState.sessionOfferCounts[id] || 0) + 1;
                  });
                  
                  // An offer empties the meter, whichever rule triggered it.
                  newProgress.letters = 0;
                  
                  // Reset the offer cooldown timer
                  newProgress.turnsSinceLastOffer = 0;

                  soundService.playModalOpen();
                  const offerReason = triggeredByMeter
                    ? `You played ${GAMEPLAY.powerPlayMeterLetters} letters and filled the PowerPlay meter!`
                    : `Milestone! You've submitted ${totalWordsSubmitted} words and earned a power-up!`;
                  modalQueue.push({ type: 'powerplay-selection', title: 'PowerPlay Earned!', content: offerReason, data: offeredPowerPlays });
              }
          }
      }
      newState.powerPlayProgress = newProgress;

      // Word Charm Offer Check
      newState.wordMilestoneProgress.count++;
      if (newState.wordMilestoneProgress.count >= newState.wordMilestoneProgress.nextUnlock) {
          const charmsToOfferFrom = CHARMS_LIST.filter(c => 
              !newState.activeCharms.some(ac => ac.id === c.id) &&
              !newState.charmCooldowns[c.id]
          );
          const { offeredItems: offeredCharms, offerDetails } = gameUtils.getOffer(charmsToOfferFrom, 3, newState);

          if(offeredCharms.length > 0) {
            // Update state for weighting logic
            newState.offerHistory.push(offerDetails);
            newState.totalOffersMade++;
            offerDetails.forEach(offer => {
                const id = offer.id;
                const stats = newState.itemStats[id] || { offered: 0, lastOfferedTurn: -1 };
                stats.offered++;
                stats.lastOfferedTurn = totalWords + 1; // current turn
                newState.itemStats[id] = stats;
                newState.sessionOfferCounts[id] = (newState.sessionOfferCounts[id] || 0) + 1;
            });

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
      
      const needsHighValueTile = newState.activeCharms.some(c => c.id === 'ctuSafeHouse') && scoreResult.totalScore < 20;

      let tempNewHand: (Tile | null)[];
      let newBag: string[];
      
      const cleanHand = (hand ?? []).filter(t => t === null || !t.isDuplicate);
      while (cleanHand.length < RACK_SIZE) {
          cleanHand.push(null);
      }
      if (cleanHand.length > RACK_SIZE) {
          cleanHand.splice(RACK_SIZE);
      }

      if (isSuperHand) {
          const deal = gameUtils.dealNewHand(tileBag, [], willTriggerGoldenRound);
          let finalDealHand = applyMutation(deal.hand, willTriggerGoldenRound);

          if (needsHighValueTile) {
              const hasHighValue = finalDealHand.some(t => t.points >= 4);
              if (!hasHighValue && finalDealHand.length > 0) {
                  const highValueLetters = Object.keys(TILE_DISTRIBUTION).filter(l => TILE_DISTRIBUTION[l].points >= 4);
                  if (highValueLetters.length > 0) {
                      const randomHighValueLetter = highValueLetters[Math.floor(Math.random() * highValueLetters.length)];
                      const newHighValueTile = gameUtils.createTile(randomHighValueLetter);
                      const indexToReplace = Math.floor(Math.random() * finalDealHand.length);
                      const tileToReturn = finalDealHand[indexToReplace];
                      deal.tileBag = [...deal.tileBag, tileToReturn.letter];
                      finalDealHand[indexToReplace] = newHighValueTile;
                      showMessage('🏠 CTU Safe House: High-value tile secured!', 2000);
                      soundService.playPowerUp();
                  }
              }
          }

          const paddedDeal = Array(RACK_SIZE).fill(null);
          finalDealHand.forEach((tile, i) => paddedDeal[i] = tile);
          tempNewHand = paddedDeal;
          newBag = deal.tileBag;
      } else {
          const handTilesRemainingCount = (hand ?? []).filter(t => t !== null).length;
          // Top the hand back up to the standard hand size (config/gameplay.ts).
          const replenishCount = refillCount(handTilesRemainingCount);
          
          const drawResult = gameUtils.drawTiles(replenishCount, tileBag, willTriggerGoldenRound);
          let finalDrawnTiles = applyMutation(drawResult.newTiles, willTriggerGoldenRound);

          if (needsHighValueTile) {
              const hasHighValue = finalDrawnTiles.some(t => t.points >= 4);
              if (!hasHighValue && finalDrawnTiles.length > 0) {
                  const highValueLetters = Object.keys(TILE_DISTRIBUTION).filter(l => TILE_DISTRIBUTION[l].points >= 4);
                  if (highValueLetters.length > 0) {
                      const randomHighValueLetter = highValueLetters[Math.floor(Math.random() * highValueLetters.length)];
                      const newHighValueTile = gameUtils.createTile(randomHighValueLetter);
                      const indexToReplace = Math.floor(Math.random() * finalDrawnTiles.length);
                      const tileToReturn = finalDrawnTiles[indexToReplace];
                      drawResult.remainingBag = [...drawResult.remainingBag, tileToReturn.letter];
                      finalDrawnTiles[indexToReplace] = newHighValueTile;
                      showMessage('🏠 CTU Safe House: High-value tile secured!', 2000);
                      soundService.playPowerUp();
                  }
              }
          }
          
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

      const { newHand: preChuckHand, newBag: finalBag, balancingMessage } = gameUtils.postProcessHand(tempNewHand, newBag, willTriggerGoldenRound);
      if (balancingMessage) {
        showMessage(balancingMessage, 1500);
      }

      let finalHand = preChuckHand;
      if (newState.activeCharms.some(c => c.id === 'chuckNorrisWhy') && word.toUpperCase().endsWith('Y')) {
          const handTilesWithIndices = finalHand
              .map((tile, index) => ({ tile, index }))
              .filter((item): item is { tile: Tile, index: number } => item.tile !== null);
          
          if (handTilesWithIndices.length > 0) {
              const randomItem = handTilesWithIndices[Math.floor(Math.random() * handTilesWithIndices.length)];
              const tileToUpgrade = randomItem.tile;
              
              const newHandCopy = [...finalHand];
              newHandCopy[randomItem.index] = { ...tileToUpgrade, multiplier: 2 };
              finalHand = newHandCopy;
              
              showMessage(`🥋 Roundhouse kick! A '${tileToUpgrade.letter}' tile is now 2x!`, 2500);
              soundService.playPowerUp();
          }
      }

      // --- 9. GOLDEN ROUND TRIGGER LOGIC ---
      newState.consecutiveValidWords++;
      if (newState.consecutiveValidWords >= newState.goldenRoundThreshold) {
          soundService.playMilestone();
          
          newState.roundType = 'golden';
          const handTiles = finalHand.filter((t): t is Tile => t !== null);
          if (handTiles.length > 0) {
              const randomTile = handTiles[Math.floor(Math.random() * handTiles.length)];
              newState.goldenTileId = randomTile.id;
          }
          
          modalQueue.push({
              type: 'info',
              title: '🌟 GOLDEN ROUND! 🌟',
              content: `Your streak has unlocked a Golden Round!\n\n- ${GAMEPLAY.goldenRoundSeconds}-second clock (your time bank waits)\n- No Strikes\n- All tiles are worth 2x points.\n- Use the special Golden Tile for a 6x WORD SCORE multiplier!`
          });
          
          newState.consecutiveValidWords = 0;
          
          // Dispatch and return early for Golden Round trigger
          dispatch({ type: 'HANDLE_SUBMIT_SUCCESS', payload: { gameState: newState, hand: sanitizeHand(finalHand), tileBag: finalBag, modalQueue } });
          dispatch({ type: 'SET_IS_LOADING', payload: false });
          return;
      }
      
      const consumedPPs = { ...newState.activePowerPlays };
      let consumedBuffs = [...newState.activeBuffs];

      if (consumedPPs.duckHunt?.ready) {
          delete consumedPPs.duckHunt;
          consumedBuffs = consumedBuffs.filter(b => b.id !== 'duckHunt');
      }

      if (wordLockActive) { delete consumedPPs.wordLock; consumedBuffs = consumedBuffs.filter(b => b.id !== 'wordLock'); }
      ['biglyScore', 'multiverseOfSadness', 'nuclearOption', 'schruteBucks', 'redWedding', 'wakandaForever', 'heisenberg', 'skywalkerBloodline', 'leafOnTheWind', 'thanosGift', 'doubleOrNothing', 'cassiesClue', 'cowabunga', 'tetrisTouch', 'blueShellSurprise', 'pinkyAndTheBrain', 'letsGetDangerous', 'slimShadyShuffle', 'spaceInvader'].forEach(id => { 
          if ((consumedPPs as any)[id]) { 
              delete (consumedPPs as any)[id]; 
              consumedBuffs = consumedBuffs.filter(b => b.id !== id); 
          }
      });

      if (consumedPPs.wordionaireCap) { delete consumedPPs.wordionaireCap; consumedBuffs = consumedBuffs.filter(b => b.instanceId !== 'wordionaire_cash'); }
      if (consumedPPs.wordionaireDouble) { delete consumedPPs.wordionaireDouble; consumedBuffs = consumedBuffs.filter(b => b.instanceId !== 'wordionaire_double'); }

      if (consumedPPs.sonicSpeed) { if (consumedPPs.sonicSpeed.count > 1) { consumedPPs.sonicSpeed = { ...consumedPPs.sonicSpeed, count: consumedPPs.sonicSpeed.count - 1 }; } else { delete consumedPPs.sonicSpeed; consumedBuffs = consumedBuffs.filter(b => b.id !== 'sonicSpeed'); }}
      
      newState.activePowerPlays = consumedPPs;
      newState.activeBuffs = consumedBuffs;

      if (newState.activeCharms.some(c => c.id === 'oneTileToRuleThemAll') && submittedTiles.some(t => t.tempPoints === 25)) {
          newState.activeCharms = newState.activeCharms.filter(c => c.id !== 'oneTileToRuleThemAll');
          newState.activeBuffs = newState.activeBuffs.filter(b => b.id !== 'oneTileToRuleThemAll');
      }
      if (submittedTiles.some(t => t.tempPoints === 20)) { // Captain Planet
          // This will automatically clear as the tempPoints are on the tile, which is now gone.
      }


      dispatch({ type: 'HANDLE_SUBMIT_SUCCESS', payload: { gameState: newState, hand: sanitizeHand(finalHand), tileBag: finalBag, modalQueue }});
      dispatch({ type: 'SET_IS_LOADING', payload: false });
      if (modalQueue.length === 0) {
          handleStartNextRound();
      }
  }, [gameState, hand, tileBag, applyMutation, showMessage, handleStartNextRound, onScoreUpdate, isChallengeLock, totalWords, powerWord]);
  
   const handleSubmit = async () => {
    const word = (buildRow ?? []).filter(i => i).map(item => item!.tile.letter).join('');
    
    if (isChallengeLock) {
        soundService.playValidWord();

        let newState = { ...gameState, challengeActive: false, consecutiveSuccesses: 0 };
        
        // When a challenge is lost, the streak is always reset, regardless of success
        newState.consecutiveValidWords = 0;
        
        const message = `Challenge lost. Word "${word.toUpperCase()}" submitted for 0 points.`;
        showMessage(message, 3000);

        if (state.challengeWordData) {
            const challengedWordLogEntry: WordLogEntry = {
                type: 'word',
                word: state.challengeWordData.word,
                score: 0,
                baseScore: 0,
                status: 'valid',
                definition: `(From Challenge) ${state.challengeWordData.definition || ''}`.trim(),
                cumulativeScore: newState.score,
                bonuses: [{ name: 'Challenge Lost', description: '0 pts'}]
            };
            newState.log = [...newState.log, challengedWordLogEntry];
        }
        
        const submittedTiles = (buildRow ?? []).filter(i => i).map(item => item!.tile);
        const handTilesRemainingCount = (hand ?? []).filter(t => t !== null).length;
        const replenishCount = refillCount(handTilesRemainingCount);
        
        const drawResult = gameUtils.drawTiles(replenishCount, tileBag, newState.roundType === 'golden');
        let finalDrawnTiles = applyMutation(drawResult.newTiles, newState.roundType === 'golden');
        
        let tempHand = [...(hand ?? [])];
        finalDrawnTiles.forEach(tile => {
            const emptySlot = tempHand.findIndex(slot => slot === null);
            if(emptySlot !== -1) tempHand[emptySlot] = tile;
        });

        const { newHand: finalHand, newBag: finalBag, balancingMessage } = gameUtils.postProcessHand(tempHand, drawResult.remainingBag, newState.roundType === 'golden');
        if (balancingMessage) {
            showMessage(balancingMessage, 1500);
        }
    
        dispatch({
            type: 'HANDLE_SUBMIT_SUCCESS', payload: {
                gameState: newState, 
                hand: sanitizeHand(finalHand),
                tileBag: finalBag,
                modalQueue: []
            }
        });
        handleStartNextRound();
        dispatch({ type: 'SET_CHALLENGE_WORD_DATA', payload: null });
        return;
    }

    if((word?.length ?? 0) < (gameState?.gameConfig?.minWordLength ?? 3) || isLoading || isPaused) return;

    dispatch({ type: 'SET_IS_LOADING', payload: true });
    dispatch({ type: 'SET_LOADING_MESSAGE', payload: `Validating "${word.toUpperCase()}"...` });

    const submittedTiles = (buildRow ?? []).filter(i => i).map(item => item!.tile);
    const wordLockActive = gameState?.activePowerPlays?.['wordLock'] && submittedTiles.length <= 5;
    
    let validationResult;

    if (wordLockActive) {
        validationResult = { isValid: true, definition: 'A rule-breaking word!' };
    } else {
        validationResult = await dictionaryService.lookupWord(word);
    }
    
    if (validationResult.isValid) {
        soundService.playValidWord();
        
        if (gameState.roundType === 'golden') {
            await completeSubmission(word, submittedTiles, 0, 0, [], validationResult.definition ?? '', false);
            return;
        }

        if (gameState.activePowerPlays.doubleOrNothing) {
            const scoreResult = gameUtils.calculateScore(word, submittedTiles, gameState);
            const isDouble = Math.random() < 0.5;
            let message = '';

            if (isDouble) {
                scoreResult.totalScore *= 2;
                scoreResult.bonuses.push({ name: 'Double or Nothing (Win)', description: 'x2 Score (Coin Flip)'});
                message = `The coin flip was HEADS! Your score for "${word.toUpperCase()}" is doubled!`;
                soundService.playMilestone();
            } else {
                scoreResult.totalScore = 0;
                scoreResult.bonuses = [{ name: 'Double or Nothing (Loss)', description: 'Score set to 0 (Coin Flip)' }];
                message = `The coin flip was TAILS! Your score for "${word.toUpperCase()}" is zero.`;
                soundService.playInvalidWord();
            }
            
            // The coin flip is a gamble on the final score; a lost flip stays at 0.
            await completeSubmission(word, submittedTiles, scoreResult.totalScore, scoreResult.baseScore, scoreResult.bonuses, validationResult.definition ?? '', wordLockActive, message, isDouble ? { scoreBeforeMultiplier: scoreResult.scoreBeforeMultiplier! * 2, wordMultiplier: scoreResult.wordMultiplier } : { capped: true });
            return;
        }
        
        const scoreResult = gameUtils.calculateScore(word, submittedTiles, gameState);

        await completeSubmission(word, submittedTiles, scoreResult.totalScore, scoreResult.baseScore, scoreResult.bonuses, validationResult.definition ?? '', wordLockActive, undefined, scoreResult);

    } else {
        if (gameState.roundType === 'golden') {
            endGoldenRound('Not a valid word. Golden Round over.');
            dispatch({ type: 'SET_IS_LOADING', payload: false });
            return;
        }
        
        if (gameState.perfectChainProgress > 0) {
            // No toast needed, the UI will just disappear.
        }

        if (gameState.powerSurgeProgress === 3 || gameState.powerSurgeProgress === 4) {
            soundService.playComboDrop();
            showMessage("Combo Lost! Don't worry, even Jack couldn’t fix this one.", 3000);
        } else if (gameState.powerSurgeProgress > 0) {
            soundService.playComboDrop();
            showMessage('😵 Combo Dropped!', 3000);
        } else {
            soundService.playInvalidWord();
            const snitchActive = gameState.activeCharms.some(c => c.id === 'goldenSnitch');
            if (snitchActive) {
                showMessage('Invalid Word! Golden Snitch lost!', 2000);
            } else {
                showMessage('Invalid Word! Strike! Timer reset & +1 Tile', 2000);
            }
        }

      const invalidWordLogEntry: WordLogEntry = { type: 'word', word, score: 0, status: 'invalid', cumulativeScore: gameState.score };
      dispatch({ type: 'UPDATE_GAME_STATE', payload: { log: [...gameState.log, invalidWordLogEntry] } });
      
      dispatch({ type: 'HANDLE_SUBMIT_FAIL' });
      dispatch({ type: 'ADD_STRIKE', payload: { source: 'invalid_word' } });
      dispatch({ type: 'SET_IS_LOADING', payload: false });
    }
  };

  const handleClear = () => {
    if (isChallengeLock) return;
    soundService.playClear();
    dispatch({ type: 'HANDLE_CLEAR' });
  };

  const handleChallenge = async () => {
    if (isLoading || isPaused || (buildRow ?? []).some(t => t !== null) || isChallengeLock || gameState?.roundType === 'golden') return;
    if (!isStrikeChallenge && (state.gameState?.challengeCount ?? 0) <= 0) return;
    if (isStrikeChallenge && strikesRemaining <= 0) return;

    soundService.playChallenge();

    dispatch({ type: 'SET_LOADING_MESSAGE', payload: "Consulting the word oracles...\n\n\"You've got to ask yourself one question: 'Do I feel lucky?' Well, do you, punk?\"" });
    dispatch({ type: 'SET_IS_LOADING', payload: true });

    const availableTiles = (state.hand ?? []).filter((t): t is Tile => t !== null);
    let foundWord: string | null = null;
    let challengeLost = false;

    // 1. Search the full word list for any playable word
    const playable = await dictionaryService.findPlayableWord(availableTiles.map(t => t.letter), { minLength: 3 });
    if (playable) {
        foundWord = playable.toUpperCase();
        challengeLost = true;
    }
    
    if (challengeLost && foundWord) {
        if ((state.gameState?.powerSurgeProgress ?? 0) === 3 || (state.gameState?.powerSurgeProgress ?? 0) === 4) {
            soundService.playComboDrop();
            showMessage("Combo Lost! Don't worry, even Jack couldn’t fix this one.", 3000);
        } else if ((state.gameState?.powerSurgeProgress ?? 0) > 0) {
            soundService.playComboDrop();
            showMessage('😵 Combo Dropped!', 3000);
        }

        const foundWordUpper = foundWord.toUpperCase();
        if (isStrikeChallenge) {
            const wordDef = await dictionaryService.getDefinition(foundWordUpper) ?? 'A valid word discovered by the game.';
            missedWordsService.addMissedWord(foundWordUpper, wordDef);

            const strikeChallengeLostLogEntry: WordLogEntry = {
                type: 'word',
                word: foundWordUpper,
                status: 'valid',
                score: 0,
                baseScore: 0,
                cumulativeScore: state.gameState.score,
                definition: wordDef,
                bonuses: [{ name: 'Strike Challenge Lost', description: 'A strike was issued because a valid word was found.' }],
            };

            dispatch({ type: 'ADD_STRIKE', payload: { source: 'challenge' } });
            dispatch({ type: 'UPDATE_GAME_STATE', payload: { log: [...state.gameState.log, strikeChallengeLostLogEntry], consecutiveSuccesses: 0, consecutiveValidWords: 0 } });
            
            dispatch({ type: 'SET_MODAL_CONTENT', payload: { 
                type: 'info', 
                title: '❌ Strike Challenge Lost', 
                content: `A word was found: ${foundWordUpper}. You receive a strike.`
            }});

        } else {
            // Regular challenge lost: force user to play the word.
            const handNow = state.hand ?? [];
            // Combo tiles (QU, ING...) cover several letters, so match tiles to the word properly.
            const tileIndexes = assignTilesToWord(foundWordUpper, handNow.map(t => t?.letter));
            const tilesToMove = (tileIndexes ?? []).map(i => ({ tile: handNow[i]!, originalIndex: i }));

            if (tileIndexes) {
                const wordDefForLog = await dictionaryService.getDefinition(foundWordUpper) ?? "A valid word found by challenge.";
                missedWordsService.addMissedWord(foundWordUpper, wordDefForLog);
                dispatch({ type: 'SET_CHALLENGE_WORD_DATA', payload: { word: foundWordUpper, score: 0, definition: wordDefForLog, status: 'valid' } });
                soundService.playInvalidWord();
                showMessage(`A word was found: ${foundWordUpper}! Submit it for 0 points.`, 3000);
                dispatch({ type: 'UPDATE_GAME_STATE', payload: { challengeCount: (state.gameState?.challengeCount ?? 0) - 1, consecutiveValidWords: 0 } });
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
        messageText = 'Challenge successful! No word found. Challenge not consumed.';
      }
      showMessage(messageText, 3000);
      handleShuffle(true, true); // Free shuffle on win, and from challenge
    }

    dispatch({ type: 'SET_IS_LOADING', payload: false });
  };
    const potentialScore = useMemo(() => {
        const word = wordFromBuildRow;
        if ((word?.length ?? 0) < (gameState?.gameConfig?.minWordLength ?? 3) || (buildRow ?? []).every(i => i === null)) {
            return 0;
        }
        const tiles = (buildRow ?? []).filter((i): i is { tile: Tile, originalIndex: number } => i !== null).map(item => item.tile);
        const scoreResult = gameUtils.calculateScore(word, tiles, gameState);
        return scoreResult.totalScore;
    }, [buildRow, wordFromBuildRow, gameState]);

    const challengeButtonText = useMemo(() => isStrikeChallenge
        ? `GAMBLE STRIKE (${strikesRemaining})`
        : `CHALLENGE (${gameState?.challengeCount ?? 0})`, [isStrikeChallenge, strikesRemaining, gameState?.challengeCount]);

    const handleSaveClick = () => {
        soundService.playUIClick();
        dispatch({ type: 'SHOW_SAVE_MODAL' });
    };
    
    const handleConfirmSave = () => {
        const screenState: GameScreenState = {
            gameState, time, hand, buildRow, tileBag, message: '',
            isPaused: false, isLoading: false, loadingMessage: null, modalContent: null, modalQueue: [],
            tilesToSwap: [], tileToTransform: null, challengeWordData: null, tileForSelection: null, lastTurnState: null, highlightedTileIds: { first: null, rest: [] }, longWordBonusNotified: false,
        };
        onSaveGame(screenState);
    };

    const showBuffInfo = (buff: Charm | PowerPlay) => {
        soundService.playModalOpen();
        dispatch({
            type: 'SET_MODAL_CONTENT',
            payload: {
                type: 'buff-info',
                title: `ℹ️ ${buff.name}`,
                data: buff,
            }
        });
    };
    
    const handleCarmenSandiegoActivation = async () => {
        dispatch({ type: 'SET_IS_LOADING', payload: true });
        dispatch({ type: 'SET_LOADING_MESSAGE', payload: "Searching the globe for clues..." });

        const availableTiles = (hand ?? []).filter((t): t is Tile => t !== null);
        const longestWord = await dictionaryService.findPlayableWord(availableTiles.map(t => t.letter), { minLength: 3, longest: true });
        const bestWord = longestWord ? longestWord.toUpperCase() : '';
        
        if (bestWord) {
            showMessage(`A clue was found: ${bestWord}!`, 4000);
            
            const tileIds = (assignTilesToWord(bestWord, availableTiles.map(t => t.letter)) ?? []).map(i => availableTiles[i].id);
            dispatch({ type: 'SET_HIGHLIGHTED_TILES', payload: { first: tileIds[0] ?? null, rest: tileIds.slice(1) } });
        } else {
            showMessage("The trail went cold. No words found!", 3000);
        }

        const newLogEntry: EventLogEntry = {
            type: 'event', id: `pp-carmenSandiego-${Date.now()}`, name: 'Where in the World is Carmen Sandiego?',
            description: bestWord ? `Revealed the word: ${bestWord}` : 'No possible word was found.', icon: '🗺️',
            scoreChange: 0, cumulativeScore: gameState.score
        };

        dispatch({
            type: 'UPDATE_GAME_STATE',
            payload: {
                log: [...gameState.log, newLogEntry],
                availablePowerPlays: gameState.availablePowerPlays.filter(p => p.id !== 'carmenSandiego'),
                powerPlayUses: { ...gameState.powerPlayUses, carmenSandiego: (gameState.powerPlayUses.carmenSandiego || 0) + 1 }
            }
        });
        
        dispatch({ type: 'SET_IS_LOADING', payload: false });
    };

    const handleActivatePowerPlay = (powerPlay: PowerPlay) => {
        if (powerPlay.id === 'withGreatPower') {
            soundService.playPowerUp();
            if (strikesRemaining > 1) {
                const scoreChange = 500;
                const newScore = gameState.score + scoreChange;
                const newStrikes = gameState.strikes + 1;
                const newLogEntry: EventLogEntry = {
                    type: 'event', id: `pp-${powerPlay.id}-${Date.now()}`, name: powerPlay.name,
                    description: 'Sacrificed a strike for +500 points.', icon: '🕷️',
                    scoreChange: scoreChange, cumulativeScore: newScore
                };
                dispatch({
                    type: 'UPDATE_GAME_STATE',
                    payload: {
                        score: newScore,
                        strikes: newStrikes,
                        log: [...gameState.log, newLogEntry],
                        availablePowerPlays: gameState.availablePowerPlays.filter(p => p.id !== powerPlay.id),
                        powerPlayUses: { ...gameState.powerPlayUses, [powerPlay.id]: (gameState.powerPlayUses[powerPlay.id] || 0) + 1 }
                    }
                });
                showMessage("With Great Power comes a great point bonus!", 2500);
            } else {
                showMessage("Cannot use With Great Power with only 1 strike left.", 3000);
            }
            return;
        }
        if (powerPlay.id === 'carmenSandiego') {
            soundService.playPowerUp();
            handleCarmenSandiegoActivation();
            return;
        }

        if (powerPlay.id === 'gumpLuck') {
            soundService.playPowerUp();
            const rand = Math.random();
            let outcomeMessage = '';
            let changes: Partial<GameState> = {};
            let timeChange = 0;
            let gotStrike = false;
    
            if (rand < 0.25) { // +10s
                timeChange = 10;
                outcomeMessage = "Life is like a box of chocolates... you got 10 extra seconds!";
            } else if (rand < 0.5) { // +20 score
                changes.score = gameState.score + 20;
                outcomeMessage = "Life is like a box of chocolates... you got a 20 point bonus!";
            } else if (rand < 0.75) { // +1 shuffle
                changes.shuffleCount = gameState.shuffleCount + 1;
                outcomeMessage = "Life is like a box of chocolates... you got an extra shuffle!";
            } else { // strike
                gotStrike = true;
                outcomeMessage = "Life is like a box of chocolates... sometimes you get a strike. Stupid is as stupid does.";
            }
    
            const scoreChange = changes.score ? 20 : 0;
            const cumulativeScore = changes.score || (gameState.score + scoreChange);
            const newLogEntry: EventLogEntry = {
                type: 'event', id: `pp-${powerPlay.id}-${Date.now()}`, name: powerPlay.name,
                description: outcomeMessage, icon: '🍫',
                scoreChange: scoreChange, cumulativeScore: cumulativeScore
            };
            changes.log = [...gameState.log, newLogEntry];
            changes.availablePowerPlays = gameState.availablePowerPlays.filter(p => p.id !== powerPlay.id);
            changes.powerPlayUses = { ...gameState.powerPlayUses, [powerPlay.id]: (gameState.powerPlayUses[powerPlay.id] || 0) + 1 };
    
            dispatch({ type: 'UPDATE_GAME_STATE', payload: changes });
            if (timeChange > 0) dispatch({ type: 'ADD_TIME', payload: timeChange });
            if (gotStrike) dispatch({ type: 'ADD_STRIKE' });
            
            showMessage(outcomeMessage, 3000);
            return;
        }

        if (powerPlay.id === 'happyPlace') {
            soundService.playPowerUp();
            const newLogEntry: EventLogEntry = {
                type: 'event', id: `pp-${powerPlay.id}-${Date.now()}`, name: powerPlay.name,
                description: `Time bank refilled to ${GAMEPLAY.timeBank.max} seconds.`, icon: '⛳',
                scoreChange: 0, cumulativeScore: gameState.score
            };
            dispatch({ type: 'SET_TIME', payload: Math.max(time, GAMEPLAY.timeBank.max) });
            dispatch({
                type: 'UPDATE_GAME_STATE',
                payload: {
                    log: [...gameState.log, newLogEntry],
                    availablePowerPlays: gameState.availablePowerPlays.filter(p => p.id !== powerPlay.id),
                    powerPlayUses: { ...gameState.powerPlayUses, [powerPlay.id]: (gameState.powerPlayUses[powerPlay.id] || 0) + 1 }
                }
            });
            showMessage(`⛳ Happy Place! Clock refilled to ${GAMEPLAY.timeBank.max} seconds.`, 2500);
            return;
        }

        if (powerPlay.id === 'warioWarp') {
            soundService.playPowerUp();
            const scoreChange = 100;
            const newScore = gameState.score + scoreChange;
    
            const newLogEntry: EventLogEntry = {
                type: 'event', id: `pp-${powerPlay.id}-${Date.now()}`, name: powerPlay.name,
                description: 'Gained 100 points, lost 10s next turn.', icon: '🛸',
                scoreChange: scoreChange, cumulativeScore: newScore
            };
    
            dispatch({ type: 'UPDATE_GAME_STATE', payload: {
                score: newScore,
                warioTimeDebt: 10,
                log: [...gameState.log, newLogEntry],
                availablePowerPlays: gameState.availablePowerPlays.filter(p => p.id !== powerPlay.id),
            }});
            showMessage("Wario Warp! +100 points, -10s next turn.", 2500);
            return;
        }
        
        if (powerPlay.id === 'schruteBucks') {
            soundService.playPowerUp();
            const scoreChange = 150;
            const newScore = gameState.score + scoreChange;
    
            const newLogEntry: EventLogEntry = {
                type: 'event', id: `pp-${powerPlay.id}-${Date.now()}`, name: powerPlay.name,
                description: 'Gained 150 points. Next word score is capped at 1.', icon: '💵',
                scoreChange: scoreChange, cumulativeScore: newScore
            };
    
            const buff = {
                ...powerPlay,
                description: 'Your next word will score exactly 1 point.'
            };
    
            dispatch({ type: 'UPDATE_GAME_STATE', payload: {
                score: newScore,
                activePowerPlays: { ...gameState.activePowerPlays, schruteBucks: true },
                activeBuffs: [...gameState.activeBuffs, buff],
                log: [...gameState.log, newLogEntry],
                availablePowerPlays: gameState.availablePowerPlays.filter(p => p.id !== powerPlay.id),
            }});
            showMessage("Schrute Bucks! +150 points. Next word is worth 1 point.", 3000);
            return;
        }

        if (powerPlay.id === 'iceIceMaybe') {
            soundService.playPowerUp();
            const handTilesWithIndices = (hand ?? []).map((tile, index) => ({ tile, index })).filter((item): item is { tile: Tile, index: number } => item.tile !== null);
            if (handTilesWithIndices.length === 0) {
                showMessage("Hand is empty, cannot activate!", 2000);
                return;
            }
            const randomItem = handTilesWithIndices[Math.floor(Math.random() * handTilesWithIndices.length)];
            const newHand = [...(hand ?? [])];
            const newTile = { ...randomItem.tile, isSuper: true };
            newHand[randomItem.index] = newTile;
    
            const newLogEntry: EventLogEntry = {
                type: 'event', id: `pp-${powerPlay.id}-${Date.now()}`, name: powerPlay.name,
                description: `'${newTile.letter}' became a 4x Super Tile for this turn.`, icon: '❄️',
                scoreChange: 0, cumulativeScore: gameState.score
            };
            
            dispatch({ type: 'SET_HAND_AND_BAG', payload: { hand: newHand, tileBag } });
            dispatch({ type: 'UPDATE_GAME_STATE', payload: { 
                log: [...gameState.log, newLogEntry],
                availablePowerPlays: gameState.availablePowerPlays.filter(p => p.id !== powerPlay.id),
            }});
            showMessage(`Your '${newTile.letter}' tile is now a 4X Super Tile!`, 2500);
            return;
        }

        if (powerPlay.id === 'rescueDrop' && (hand ?? []).filter(t => t).length === 0) {
            showMessage("Hand is empty, cannot activate Rescue Drop.", 2000);
            return;
        }
        
        if (powerPlay.id === 'scroogeSwipe') {
            soundService.playPowerUp();
            onLexCoinChange(1);
            const scoreChange = -500;
            const newScore = Math.max(0, gameState.score + scoreChange);
            const newLogEntry: EventLogEntry = {
                type: 'event', id: `pp-${powerPlay.id}-${Date.now()}`, name: powerPlay.name,
                description: 'Traded 500 points for 1 LEX Coin.', icon: '🪙',
                scoreChange, cumulativeScore: newScore
            };
            dispatch({
                type: 'UPDATE_GAME_STATE',
                payload: {
                    score: newScore,
                    log: [...gameState.log, newLogEntry],
                    availablePowerPlays: gameState.availablePowerPlays.filter(p => p.id !== powerPlay.id),
                }
            });
            showMessage("Scrooge Swipe! +1 LEX Coin, -500 points.", 2500);
            return;
        }
        
        if (powerPlay.id === 'sliders') {
            if (lastTurnState) {
                soundService.playPowerUp();
                dispatch({ type: 'RESTORE_LAST_TURN' });
                showMessage("Sliders activated! Reverting to the previous turn.", 3000);
            } else {
                showMessage("No previous turn to slide back to!", 2000);
            }
            return;
        }

        soundService.playPowerUp();
        dispatch({ type: 'ACTIVATE_POWER_PLAY', payload: powerPlay });
    };

    const handleActivateCharm = (charm: Charm) => {
        if (charm.effectType === 'selection') {
            soundService.playModalOpen();
            dispatch({
                type: 'SET_MODAL_CONTENT',
                payload: {
                    type: 'charm-activation',
                    title: `Activate: ${charm.name}`,
                    data: charm
                }
            });
        } else {
            // This case is unlikely given the current charms, but is a fallback.
            dispatch({ type: 'ACTIVATE_CHARM', payload: charm });
        }
    };
    
    const handleChoosePowerPlay = (powerPlay: PowerPlay, allOffered: PowerPlay[]) => {
        soundService.playUIClick();
        dispatch({ type: 'CHOOSE_POWER_PLAY', payload: { powerPlay, allOffered } });
        handleCloseModal();
    };

    const handleChooseCharm = (charm: Charm, allOffered: Charm[]) => {
        soundService.playUIClick();
        const handTiles = (hand ?? []).filter((t): t is Tile => t !== null);
        dispatch({ type: 'CHOOSE_CHARM', payload: { charm, hand: handTiles, allOffered } });
        handleCloseModal();
    };

    const handleAddTileToSwap = (tile: Tile, originalIndex: number) => {
        soundService.playTileClick();
        dispatch({ type: 'ADD_TILE_TO_SWAP', payload: { tile, originalIndex } });
    };

    const handleRemoveTileFromSwap = (originalIndex: number) => {
        soundService.playTileClick();
        dispatch({ type: 'REMOVE_TILE_FROM_SWAP', payload: { originalIndex } });
    };
    
    const handleExecuteSwap = () => {
        soundService.playShuffle();
        const powerPlay = modalContent?.data as PowerPlay | undefined;
        if (!powerPlay || (tilesToSwap?.length ?? 0) === 0) {
            dispatch({ type: 'CLOSE_MODAL' });
            return;
        }
        
        let newHand = [...(hand ?? [])];
        const tilesToReturnToBag = (tilesToSwap ?? []).map(item => item.tile.letter);
        let newBag = gameUtils.shuffleArray([...(tileBag ?? []), ...tilesToReturnToBag]);

        const { newTiles, remainingBag } = gameUtils.drawTiles(tilesToSwap.length, newBag, gameState?.roundType === 'golden');
        newBag = remainingBag;

        const indicesToFill = (tilesToSwap ?? []).map(item => item.originalIndex);
        
        indicesToFill.forEach((originalIndex, i) => {
            newHand[originalIndex] = newTiles[i] || null;
        });
        
        const { newHand: finalHand, newBag: finalBag, balancingMessage } = gameUtils.postProcessHand(newHand, newBag, gameState?.roundType === 'golden');
        if (balancingMessage) {
            showMessage(balancingMessage, 1500);
        }

        dispatch({ type: 'SET_HAND_AND_BAG', payload: { hand: sanitizeHand(finalHand), tileBag: finalBag } });
        dispatch({ type: 'EXECUTE_SWAP' });
    };

    const viewProps: GameScreenViewProps = {
        gameState,
        time,
        timeGain: state.timeGain,
        message,
        hand,
        buildRow,
        isPaused,
        isLoading,
        modalContent,
        tilesToSwap,
        tileToTransform,
        wordFromBuildRow,
        totalWords,
        potentialScore,
        maxStrikes,
        challengeButtonText,
        tileClass,
        isMuted,
        isChallengeLock,
        highlightedTileIds: state.highlightedTileIds,
        isStrikeChallenge,
        strikesRemaining,
        handleMuteToggle,
        handleCloseModal,
        handleShowMilestoneInfo,
        handleShowEventLog,
        handleMoveToBuild,
        handleReturnToHand,
        handleShuffle,
        handleSubmit,
        handleClear,
        handleChallenge,
        handleSaveClick,
        handleConfirmSave,
        showBuffInfo,
        handleActivatePowerPlay,
        handleActivateCharm,
        handleChoosePowerPlay,
        handleChooseCharm,
        handleAddTileToSwap,
        handleRemoveTileFromSwap,
        handleExecuteSwap,
        dispatch,
    };

    return <GameScreenView {...viewProps} />;
};
