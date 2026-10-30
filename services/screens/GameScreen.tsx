// Game logic and state. Layout lives in GameScreenView.tsx.
import React, { useReducer, useEffect, useCallback, useMemo, useState } from 'react';
import { GameState, Tile, WordData, Milestone, Charm, PowerPlay, ScoreCalculationResult, ScoreBonusInfo, LogEntry, WordLogEntry, EventLogEntry, GameOverLogEntry, TimeLedger } from '../../types';
import { RACK_SIZE, HAND_SIZE, BALANCE_REPLACE_COUNT, VOWELS, INITIAL_SHUFFLES, MAX_STRIKES_INITIAL, SUPER_HAND_BONUS, TILE_DISTRIBUTION, INITIAL_CHALLENGES, COMBO_TILES } from '../../constants';
import * as gameUtils from '../gameUtils';
import { MILESTONES_LIST } from '../../data/milestones';
import { CHARMS_LIST } from '../../data/charms';
import { POWER_PLAYS_LIST, INSTANT_POWER_PLAY_IDS } from '../../data/powerPlays';
import { EASTER_EGGS } from '../../data/easterEggs';
import { recordFound, collectionProgress } from '../collection';
import { WORD_BONUSES } from '../../data/wordBonuses';
import { soundService } from '../soundService';
import { dictionaryService } from '../dictionaryService';
import { missedWordsService } from '../missedWordsService';
import { storage, STORAGE_KEYS } from '../storage';
import { showToast } from '../toast';
import { assignTilesToWord } from '../rackMatch';
import { useDocumentVisible } from '../useDocumentVisible';
import { explainScoreBonus } from '../scoreBonus';
import { addWordMultiplier, lengthMultiplier, refillCount, clampTime, advancePowerPlayMeter, bankMax, handSizeFor, levelFor, tickMsFor, clockSpeedFor, timeForWordAtLevel, taxWordTime, snitchTargetFor, catchVowels, slotPayout, powerWordReady, bossNumberFor, bossRewardFor, advanceBoss, bonusTime, wordTimeScaleFor, meterLettersFor, levelTierFor } from '../rules';
import { GAMEPLAY, CHARM_BONUS, CHARM_SLOTS, POWER_GLOVE_BANK_MAX, TIME_BONUS, POWER_PLAY_VALUES, BOSS, POWER_WORD_EFFECTS } from '../../config/gameplay';
import { GameScreenView, GameScreenViewProps, ModalContent } from './GameScreenView';
import { recordMissionEvent } from '../missions';
import { currentStreak, powerWordBonusFor, recordBossBadge } from '../progression';
import { BOSSES, bossById, pickBoss } from '../../data/bosses';
import { sendStat } from '../stats';
import { getBonusMedia } from '../../data/bonusMedia';
import type { MissionEvent } from '../../data/missions';


interface GameScreenProps {
  playerName: string;
  onGameOver: (gameState: GameState) => void;
  onSaveGame: (state: GameScreenState) => void;
  isResuming: boolean;
  onTimeLow: (isLow: boolean) => void;
  onGoldenRoundChange: (isGolden: boolean) => void;
  /** A boss round started or ended (App draws the boss frame). */
  onBossRoundChange?: (isBoss: boolean) => void;
  onScoreUpdate: (oldScore: number, newScore: number) => void;
  /** Credits earned (or spent, if negative); label replaces the default toast. */
  onLexCoinChange: (amount: number, label?: string) => void;
  tileClass: string;
  powerWord?: string;
}

const BUILD_ROW_SIZE = 8;

// A fresh starting state for every run. It must be a new object each time: the game updates some
// nested fields in place, and a shared starting object would carry them into the next run.
export const createInitialGameState = (): GameState => ({
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
});

export type GameScreenState = {
  /** Last change to the time bank, shown as a floating +Ns / -Ns next to the clock. */
  timeGain?: { seconds: number; key: number; taxed?: boolean };
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
  /**
   * A word was just played and the next round hasn't started yet. Closing the last pop-up then
   * starts it. Pop-ups from a PowerPlay used mid-round must not, or the round's one-turn tile
   * boosts (One Tile, Captain Planet...) are wiped before the word is played.
   */
  awaitingNextRound?: boolean;
}

const createScreenInitialState = (): GameScreenState => {
  const gameState = createInitialGameState();
  return {
    gameState,
    time: gameState.gameConfig.timerDuration,
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
  };
};

/** The starting screen state (tests use it; a new run calls createScreenInitialState()). */
export const screenInitialState: GameScreenState = createScreenInitialState();

type GameAction =
    | { type: 'SET_IS_LOADING', payload: boolean }
    | { type: 'SET_LOADING_MESSAGE', payload: string | null }
    | { type: 'SET_HAND_AND_BAG', payload: { hand: (Tile | null)[], tileBag: string[] } }
    | { type: 'SET_MESSAGE', payload: string }
    | { type: 'CLEAR_MESSAGE'; payload?: string }
    | { type: 'PAUSE_GAME' }
    | { type: 'RESUME_GAME' }
    | { type: 'TICK_TIMER' }
    | { type: 'TICK_FREEZE' }
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
    | { type: 'CHOOSE_CHARM', payload: { charm: Charm; hand: (Tile | null)[]; allOffered: Charm[]; replaceId?: string } }
    | { type: 'PASS_CHARM', payload: { allOffered: Charm[] } }
    | { type: 'CHOOSE_POWER_PLAY', payload: { powerPlay: PowerPlay; allOffered: PowerPlay[] } }
    | { type: 'KEEP_POWER_PLAY', payload: { allOffered: PowerPlay[] } }
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


/**
 * Saved games keep power-ups as plain JSON, without their activate() code, and may hold items
 * that have since moved between the charm and PowerPlay lists. Rebuild them from the current
 * definitions, keeping per-instance fields (like a buff's live description), and drop the rest.
 */
export const rehydratePowerUps = (gs: GameState): GameState => {
    const charms = new Map(CHARMS_LIST.map(c => [c.id, c]));
    const powerPlays = new Map(POWER_PLAYS_LIST.map(p => [p.id, p]));
    const fromList = <T extends { id: string }>(items: T[] | undefined, defs: Map<string, T>): T[] =>
        (items ?? []).filter(i => defs.has(i.id)).map(i => ({ ...i, ...defs.get(i.id)!, ...('instanceId' in i ? { instanceId: (i as any).instanceId, description: (i as any).description } : {}) }));
    const anyDef = new Map<string, Charm | PowerPlay>([...charms, ...powerPlays]);
    return {
        ...gs,
        activeCharms: fromList(gs.activeCharms, charms),
        availablePowerPlays: fromList(gs.availablePowerPlays, powerPlays),
        powerPlayOffer: fromList(gs.powerPlayOffer, powerPlays),
        availableCharms: [],
        activeBuffs: (gs.activeBuffs ?? []).filter(b => anyDef.has(b.id)).map(b => ({ ...anyDef.get(b.id)!, ...b, activate: anyDef.get(b.id)!.activate }) as Charm | PowerPlay),
    };
};

/** Strikes allowed before the run ends (the Strike Bank charm adds up to two). */
export const maxStrikesFor = (gs: Pick<GameState, 'charmUses'> | null | undefined): number => {
    const strikeBankUses = gs?.charmUses?.['strikeBank'] || 0;
    if (strikeBankUses >= 2) return 5;
    if (strikeBankUses >= 1) return 4;
    return MAX_STRIKES_INITIAL;
};

// Multi-word PowerPlays: activePowerPlays[id] = { words } counts down one valid word at a time.
const WORD_COUNTDOWN_POWER_PLAYS = ['konamiCode', 'bigHeadMode', 'ludicrousSpeed', 'letterUpgrade', 'polish', 'comboBreaker'];

// Time bank (config/gameplay.ts): the clock never resets between words. A Golden Round runs on
// its own short clock; the bank is set aside when it starts and given back when it ends.
// A word's time is taxed (halved) when it lands on a bank that's already above the overflow line.
const settleTimeBank = (time: number, gs: GameState): { time: number; gs: GameState } => {
    const pending = gs.pendingTimeBonus ?? 0;
    if (gs.roundType === 'golden' && gs.bankedTime == null) {
        const bankedTime = clampTime(time + taxWordTime(pending, time), bankMax(gs));
        return { time: GAMEPLAY.goldenRoundSeconds, gs: creditTime({ ...gs, bankedTime, pendingTimeBonus: 0 }, 'words', bankedTime - time) };
    }
    if (gs.roundType !== 'golden' && gs.bankedTime != null) {
        const restored = clampTime(gs.bankedTime + taxWordTime(pending, gs.bankedTime), bankMax(gs));
        return { time: restored, gs: creditTime({ ...gs, bankedTime: null, pendingTimeBonus: 0 }, 'words', restored - gs.bankedTime) };
    }
    return { time, gs };
};

const EMPTY_LEDGER: TimeLedger = { words: 0, powerUps: 0, shuffles: 0, goldenRounds: 0 };

/** Adds to the run's time ledger (seconds by source, or a Golden Round count). */
const creditTime = (gs: GameState, key: keyof TimeLedger, amount: number): GameState =>
    amount > 0 ? { ...gs, timeLedger: { ...EMPTY_LEDGER, ...gs.timeLedger, [key]: (gs.timeLedger?.[key] ?? 0) + amount } } : gs;

// Actions whose time gain the ledger records by diffing the clock. Word time and START_NEXT_ROUND
// bonuses are credited where they're added, since a Golden Round swaps the clock out.
const TIME_GAIN_SOURCE: Partial<Record<GameAction['type'], keyof TimeLedger>> = {
    PERFORM_SHUFFLE: 'shuffles',
    ADD_TIME: 'powerUps',
    ACTIVATE_POWER_PLAY: 'powerUps',
    COMPLETE_POWER_PLAY_ACTIVATION: 'powerUps',
    CHOOSE_CHARM: 'powerUps',
    ADD_STRIKE: 'powerUps',
    RESTART_ROUND_GROUNDHOG: 'powerUps',
};

const LIFELINE_TIP_KEY = 'wordNerdLifelineTipSeen';
/** The run's current level, from the valid words played so far. */
const runLevel = (gs: GameState): number => levelFor(gs.log.filter(e => e.type === 'word' && e.status === 'valid').length);
const CAPTAIN_PLANET_POINTS = 20;
const ONE_TILE_NAME = 'One Tile to Rule Them All';
const TREEHOUSE_NAME = 'Treehouse of Horror';

// Speed-up levels: every few words the clock runs a little faster. Announced when this word crosses a level.
const CONTINUE_TITLE = '🕹️ Continue?';

/**
 * Boss rounds: if this word levels up into a boss level, start the round on `gs` (a copy the
 * caller owns) and return the boss intro pop-up.
 */
const startBossRound = (gs: GameState, wordsBefore: number): ModalContent | null => {
    const level = levelFor(wordsBefore + 1);
    const number = level > levelFor(wordsBefore) ? bossNumberFor(level) : 0;
    if (!number) return null;
    const boss = pickBoss(number, gs.bossesFaced ?? []);
    gs.boss = { id: boss.id, number, wordsLeft: BOSS.words, hits: 0 };
    gs.bossesFaced = [...(gs.bossesFaced ?? []), boss.id];
    sendStat({ type: 'boss_start', boss: boss.id, number });
    const reward = bossRewardFor(number);
    return {
        type: 'info',
        title: `${boss.icon} BOSS: ${boss.name}!`,
        content: `“${boss.taunt}”\n\nRule: ${boss.description}\n\nLand ${BOSS.hitsToWin} hits in your next ${BOSS.words} words to win the Boss Badge: +${reward.points} points and +${reward.seconds}s. Words that break the rule still score; they just don't count as hits.`,
    };
};

const levelUpModal = (wordsBefore: number) => {
    const level = levelFor(wordsBefore + 1);
    if (level <= levelFor(wordsBefore)) return null;
    const notes = [`The clock now runs at x${clockSpeedFor(level)} speed.`];
    if (level === GAMEPLAY.timeBank.shortWordTimeStopsAtLevel) notes.push('3-letter words add no more time.');
    if (wordTimeScaleFor(level) < wordTimeScaleFor(level - 1)) notes.push(`Words now earn ${Math.round(wordTimeScaleFor(level) * 100)}% of their time.`);
    if (meterLettersFor(level) > meterLettersFor(level - 1)) notes.push(`PowerPlays now need ${meterLettersFor(level)} letters.`);
    const tier = levelTierFor(level);
    const newTier = tier !== levelTierFor(level - 1);
    if (newTier) notes.unshift(`You're in ${tier.name}.`);
    return {
        type: 'info' as const,
        title: newTier ? `⏩ Level ${level} · ${tier.name}!` : `⏩ Level ${level} · Speed Up!`,
        content: notes.join(' '),
    };
};

/** The game reducer, plus the time ledger: clock gains from shuffles and power-ups are recorded by source. */
export function gameReducer(state: GameScreenState, action: GameAction): GameScreenState {
    const next = payBackpack(state, logPowerPlayUse(state, baseGameReducer(state, action), action), action);
    const source = TIME_GAIN_SOURCE[action.type];
    const gained = next.time - state.time;
    if (!source || gained <= 0 || !next.gameState || state.gameState?.roundType === 'golden' || next.gameState.roundType === 'golden') return next;
    return { ...next, gameState: creditTime(next.gameState, source, gained) };
}

/**
 * The PowerPlay this action used, if any. A PowerPlay counts as used when the held one leaves the
 * pocket (any action but a swap or keep), or when an instant one is picked.
 */
function usedPowerPlay(state: GameScreenState, next: GameScreenState, action: GameAction): PowerPlay | null {
    const gs = next.gameState;
    if (!gs || action.type === 'KEEP_POWER_PLAY') return null;
    if (action.type === 'CHOOSE_POWER_PLAY') return INSTANT_POWER_PLAY_IDS.has(action.payload.powerPlay.id) ? action.payload.powerPlay : null;
    return (state.gameState?.availablePowerPlays ?? []).find(p => !gs.availablePowerPlays.some(n => n.id === p.id)) ?? null;
}

/** Logs a PowerPlay's use in the event log, unless its own effect already logged it. */
function logPowerPlayUse(state: GameScreenState, next: GameScreenState, action: GameAction): GameScreenState {
    const used = usedPowerPlay(state, next, action);
    if (!used) return next;
    const gs = next.gameState;
    const added = gs.log.slice(state.gameState?.log.length ?? 0);
    if (added.some(e => e.type === 'event' && e.name === used.name)) return next;
    return {
        ...next,
        gameState: {
            ...gs,
            log: [...gs.log, {
                type: 'event', id: `pp-used-${used.id}-${Date.now()}`, name: used.name, icon: used.icon,
                description: used.description, scoreChange: 0, cumulativeScore: gs.score,
            } as EventLogEntry],
        },
    };
}

/** Backpack, Backpack! charm: every PowerPlay used pays a bonus. */
function payBackpack(state: GameScreenState, next: GameScreenState, action: GameAction): GameScreenState {
    const gs = next.gameState;
    if (!gs?.activeCharms?.some(c => c.id === 'backpack')) return next;
    if (!usedPowerPlay(state, next, action)) return next;
    const bonus = CHARM_BONUS.backpack;
    const score = gs.score + bonus;
    const prev = gs.lastPowerPlayResult;
    return {
        ...next,
        gameState: {
            ...gs,
            score,
            log: [...gs.log, {
                type: 'event', id: `charm-backpack-${Date.now()}`, name: 'Backpack, Backpack!', icon: '🎒',
                description: `Used a PowerPlay: +${bonus} points.`, scoreChange: bonus, cumulativeScore: score,
            } as EventLogEntry],
            lastPowerPlayResult: prev
                ? { message: `${prev.message} 🎒 +${bonus}`, scoreChange: prev.scoreChange + bonus }
                : { message: `🎒 Backpack! +${bonus} points.`, scoreChange: bonus },
        },
    };
}

function baseGameReducer(state: GameScreenState, action: GameAction): GameScreenState {
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
        // ❄️ A frozen clock: the freeze counts down instead of the bank.
        case 'TICK_FREEZE': return { ...state, gameState: { ...state.gameState, freezeLeft: Math.max(0, (state.gameState.freezeLeft ?? 0) - 1) } };
        case 'ADD_TIME': return {...state, time: clampTime(state.time + action.payload, bankMax(state.gameState)) };
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
                awaitingNextRound: true,
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
          let revivedByLifeFindsAWay = false;
          
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
            if (activePowerPlays.lifeFindsAWay && strikes >= maxStrikesFor(gameState)) {
                strikes = maxStrikesFor(gameState) - 1;
                delete activePowerPlays.lifeFindsAWay;
                activeBuffs = activeBuffs.filter(b => b.id !== 'lifeFindsAWay');
                lastPowerPlayResult = { message: "🦖 Life finds a way! You survive with +20 seconds.", scoreChange: 0 };
                revivedByLifeFindsAWay = true;
            }
            if (powerSurgeProgress > 0) {
              powerSurgeProgress = 0;
            }
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
          duckHuntComboState = { streakLetters: null, streakCount: 0 }; // Reset Duck Hunt Combo streak

          let newTime = state.time;
          let newHand = [...state.hand];
          let newTileBag = state.tileBag;
          
          const survivorWords = actuallyGotAStrike && activeCharms.some(c => c.id === 'survivor') ? CHARM_BONUS.survivorWords : gameState.survivorWords;
          let tempGameState = { ...gameState, strikes, activePowerPlays, activeBuffs, score, consecutiveSuccesses, flawlessScore, powerPlayProgress: newPowerPlayProgress, activeCharms, powerSurgeProgress, lastPowerPlayResult, duckHuntComboState, consecutiveValidWords, perfectChainProgress, mixtapeChain: null, survivorWords, frogStreak: 0 };
          
          if ((actuallyGotAStrike || strikeBlockedByShield) && action.payload?.source === 'invalid_word') {
              // An invalid word costs time from the bank (not with the I'm Always Here charm).
              if (!activeCharms.some(c => c.id === 'imAlwaysHere')) newTime = clampTime(state.time - GAMEPLAY.timeBank.invalidPenalty, bankMax(gameState));
              
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
          if (revivedByLifeFindsAWay) newTime = clampTime(newTime + 20, bankMax(gameState));
          
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

            const allTilesInPlay = [...state.hand, ...state.buildRow.map(item => item?.tile)].filter((t): t is Tile => t != null);
            if (allTilesInPlay.some(tile => tile.tempPointsSource === ONE_TILE_NAME)) {
                newGameState.activeCharms = newGameState.activeCharms.filter(c => c.id !== 'oneTileToRuleThemAll');
                newGameState.activeBuffs = newGameState.activeBuffs.filter(b => b.id !== 'oneTileToRuleThemAll');
            }

            let newHand = action.payload.hand;

            // Shuffles are a lifeline: fresh tiles plus a few seconds, and streaks carry on.
            const shuffleTime = clampTime(state.time + GAMEPLAY.timeBank.shuffleTimeBonus, bankMax(gameState));

            return {
                ...state,
                hand: newHand,
                tileBag: action.payload.tileBag,
                buildRow: Array(BUILD_ROW_SIZE).fill(null),
                longWordBonusNotified: false,
                highlightedTileIds: { first: null, rest: [] },
                time: shuffleTime,
                timeGain: shuffleTime !== state.time ? { seconds: shuffleTime - state.time, key: Date.now() } : state.timeGain,
                gameState: { 
                  ...newGameState, 
                  shuffleCount: action.payload.isFree ? state.gameState.shuffleCount : state.gameState.shuffleCount - 1,
                  wordsThisRound: 0,
                  breakReady: newGameState.activeCharms.some(c => c.id === 'weWereOnABreak') || newGameState.breakReady,
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
                awaitingNextRound: false,
                hand,
                tileBag,
                buildRow: Array(BUILD_ROW_SIZE).fill(null),
                time,
                gameState: { ...newGameState, wordsThisRound: 0 }
            };
        }

        case 'START_NEXT_ROUND': {
            // Time bank: keep the clock and add what the last word earned, plus charm/PowerPlay bonuses below.
            const settled = settleTimeBank(state.time, { ...state.gameState, activePowerPlays: { ...state.gameState.activePowerPlays } });
            let newGameState = settled.gs;
            const wordTime = newGameState.pendingTimeBonus ?? 0;
            const taxedWordTime = taxWordTime(wordTime, settled.time);
            let timerDuration = settled.time + taxedWordTime;
            newGameState.pendingTimeBonus = 0;
    
            // Clean up temporary effects from previous round
            let hand = [...state.hand].map(tile => {
                if (!tile) return null;
                
                // isLocked, isDuplicate and tempPoints are single-turn effects.
                // isSuper should persist until the tile is used.
                const { isLocked, isDuplicate, tempPoints, tempPointsSource, ...restOfTile } = tile;
                
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
                const returnedTile = { ...rescuedTile, tempPoints: 20, tempPointsSource: 'Rescue Drop' };
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


            // Charm/PowerPlay bonus seconds are collected here and added once at the end, through
            // the bonus-time rules (shrunk by level, halved above the overflow line).
            let bonusSeconds = 0;
            if(newGameState.glitchActive) {
                bonusSeconds += TIME_BONUS.glitchInTheCode;
                newGameState.glitchActive = false;
            }
            
            if(newGameState.multiverseTimeBonus > 0) {
                bonusSeconds += newGameState.multiverseTimeBonus;
                newGameState.multiverseTimeBonus = 0; // Consume the bonus
            }

            if (newGameState.ludicrousTimeCost > 0) {
                timerDuration = Math.max(Math.min(timerDuration, 5), timerDuration - newGameState.ludicrousTimeCost);
                newGameState.ludicrousTimeCost = 0;
            }

            if (newGameState.activePowerPlays.gadgetHands) {
                const rounds = newGameState.activePowerPlays.gadgetHands.rounds - 1;
                if (rounds > 0) {
                    newGameState.activePowerPlays = { ...newGameState.activePowerPlays, gadgetHands: { rounds } };
                } else {
                    const { gadgetHands, ...rest } = newGameState.activePowerPlays;
                    newGameState.activePowerPlays = rest;
                    newGameState.activeBuffs = newGameState.activeBuffs.filter(b => b.id !== 'gadgetHands');
                }
            }

            if(newGameState.warioTimeDebt > 0) {
                timerDuration -= newGameState.warioTimeDebt;
                newGameState.warioTimeDebt = 0;
            }
    
            if (newGameState.activePowerPlays.timeTurner && newGameState.activePowerPlays.timeTurner.rounds > 0) {
                bonusSeconds += TIME_BONUS.timeTurner;
                const newTimeTurnerState = { rounds: newGameState.activePowerPlays.timeTurner.rounds - 1 };
                if (newTimeTurnerState.rounds > 0) {
                    newGameState.activePowerPlays = { ...newGameState.activePowerPlays, timeTurner: newTimeTurnerState };
                } else {
                    delete newGameState.activePowerPlays.timeTurner;
                    newGameState.activeBuffs = newGameState.activeBuffs.filter(b => b.id !== 'timeTurner');
                }
            }
            
            if (newGameState.activePowerPlays.saveByTheBell && newGameState.activePowerPlays.saveByTheBell.rounds > 0) {
                bonusSeconds += TIME_BONUS.saveByTheBell;
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
                    hand = hand.map(tile => tile ? { ...tile, tempPoints: Math.floor(Math.random() * 10) + 1, tempPointsSource: TREEHOUSE_NAME } : null);
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
    
            const diceRounds = (newGameState.charmUses['diceRollProtocol'] || 0) + 1;
            if (diceRollCharm) newGameState.charmUses = { ...newGameState.charmUses, diceRollProtocol: diceRounds };
            if (diceRollCharm && diceRounds % 3 === 0) {
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
    
                }
            }
    
            const bonusApplied = bonusTime(bonusSeconds, timerDuration, runLevel(newGameState));
            // Boss Badge seconds are earned, so they skip the level shrink (still halved above 60s).
            const badgeApplied = taxWordTime(newGameState.pendingBadgeTime ?? 0, timerDuration + bonusApplied);
            newGameState.pendingBadgeTime = 0;
            const finalTime = clampTime(timerDuration + bonusApplied + badgeApplied, bankMax(newGameState));
            const gained = finalTime - settled.time;
            const fromWord = Math.max(0, Math.min(taxedWordTime, gained));
            newGameState = creditTime(creditTime(newGameState, 'words', fromWord), 'powerUps', gained - fromWord);

            return {
                ...state,
                awaitingNextRound: false,
                hand,
                tileBag,
                modalContent: null,
                isPaused: false,
                time: finalTime,
                timeGain: { seconds: gained, key: Date.now(), taxed: taxedWordTime < wordTime || (bonusSeconds > 0 && bonusApplied < bonusSeconds) },
                gameState: { ...newGameState, wordsThisRound: 0 }
            };
        }
        
        case 'PASS_CHARM': {
            const charmCooldowns = { ...gameState.charmCooldowns };
            action.payload.allOffered.forEach(c => { charmCooldowns[c.id] = 3; });
            return { ...state, gameState: { ...gameState, charmCooldowns } };
        }

        case 'CHOOSE_CHARM': {
            const { charm, hand, allOffered, replaceId } = action.payload;
            let newHand = hand;
            let newGameState = { ...gameState };
            let newTime = state.time;

            // Charm slots: a new charm beyond the limit must replace one.
            const droppedCharm = replaceId ? newGameState.activeCharms.find(c => c.id === replaceId) : undefined;
            if (droppedCharm) {
                newGameState.log = [...newGameState.log, {
                    type: 'event', id: `charm-swap-${Date.now()}`, name: 'Charm Swap', icon: '🔄',
                    description: `Swapped ${droppedCharm.icon} ${droppedCharm.name} for ${charm.icon} ${charm.name}.`,
                    scoreChange: 0, cumulativeScore: newGameState.score,
                } as EventLogEntry];
                newGameState.lastPowerPlayResult = { message: `🔄 Charm swapped! ${droppedCharm.icon} ${droppedCharm.name} out, ${charm.icon} ${charm.name} in.`, scoreChange: 0 };
            }
            if (replaceId) {
                newGameState.activeCharms = newGameState.activeCharms.filter(c => c.id !== replaceId);
                newGameState.activeBuffs = newGameState.activeBuffs.filter(b => b.id !== replaceId);
                if (replaceId === 'powerGlove') newTime = clampTime(newTime, GAMEPLAY.timeBank.max);
            } else if (newGameState.activeCharms.length >= CHARM_SLOTS && !newGameState.activeCharms.some(c => c.id === charm.id)) {
                return state;
            }
            if (charm.id === 'powerGlove') newTime = clampTime(newTime + 15, POWER_GLOVE_BANK_MAX);

            const stateChanges = charm.activate(newGameState);

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
            if (charm.id === 'gottaCatchEmAll') newGameState.pokedexVowels = '';
            if (charm.id === 'crossTheRoad') newGameState.frogStreak = 0;
            if (charm.id === 'survivor') newGameState.survivorWords = 0;
            if (charm.id === 'weWereOnABreak') newGameState.breakReady = false;
            // I'm Ready! pays on the first word of a level after this one (or this one, if the next word starts it).
            if (charm.id === 'imReady') {
                const validWords = newGameState.log.filter(e => e.type === 'word' && e.status === 'valid').length;
                newGameState.readyLevel = levelFor(Math.max(0, validWords - 1));
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
                time: newTime,
                gameState: {
                    ...newGameState,
                    ...stateChanges,
                    activeCharms: newActiveCharms,
                    activeBuffs: [...(stateChanges.activeBuffs || newGameState.activeBuffs)],
                }
            }
        }
        
        case 'KEEP_POWER_PLAY': {
            const powerPlayCooldowns = { ...gameState.powerPlayCooldowns };
            action.payload.allOffered.forEach(p => { powerPlayCooldowns[p.id] = 3; });
            return {
                ...state,
                gameState: {
                    ...gameState,
                    powerPlayOffer: [],
                    powerPlayCooldowns,
                    powerPlayProgress: { ...gameState.powerPlayProgress, targetDigit: null, streak: 0, turnsSinceLastOffer: 0 },
                },
            };
        }

        case 'CHOOSE_POWER_PLAY': {
            const { powerPlay, allOffered } = action.payload;
            // The PowerPlay in the player's pocket, if any: every outcome says what happened to it.
            // You hold one PowerPlay at a time: picking ANY card (instant ones too) swaps the held one out.
            // Once-per-run PowerPlays are spent when taken; one swapped away unused can be offered again.
            const held = gameState.availablePowerPlays[0] ?? null;
            const swapped = !!held && held.id !== powerPlay.id;
            const swappedOut = swapped ? ` ${held.icon} ${held.name} was swapped out.` : '';
            const oncePerRunTaken = [
                ...(gameState.oncePerRunTaken ?? []).filter(id => !(swapped && held?.oncePerRun && id === held.id)),
                ...(powerPlay.oncePerRun ? [powerPlay.id] : []),
            ];
            const swapLog: EventLogEntry[] = swapped ? [{
                type: 'event', id: `pp-swap-${Date.now()}`, name: 'PowerPlay Swap', icon: '🔄',
                description: `Swapped ${held.icon} ${held.name} for ${powerPlay.icon} ${powerPlay.name}.`,
                scoreChange: 0, cumulativeScore: gameState.score,
            }] : [];
            gameState = { ...gameState, oncePerRunTaken, availablePowerPlays: [], log: [...gameState.log, ...swapLog] };

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
                const newModalContent: ModalContent = { type: 'info', title: 'Thwomped!', content: `You got an extra Challenge!${swappedOut}`, autoClose: 2500 };
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
                const newModalContent: ModalContent = { type: 'info', title: 'Fluncle is Proud', content: `Fluncle is very proud of you. You gain 300 points!${swappedOut}`, autoClose: 2500 };
                return {
                    ...state,
                    gameState: newGameState,
                    modalQueue: [...state.modalQueue, newModalContent],
                };
            }

            if (INSTANT_POWER_PLAY_IDS.has(powerPlay.id)) {
                let newGameState = {
                    ...gameState,
                    powerPlayOffer: [],
                    powerPlayProgress: resetProgress,
                    powerPlayCooldowns: newPowerPlayCooldowns,
                };
                
                const changes = powerPlay.activate(newGameState);
                newGameState = { ...newGameState, ...changes };
                if (!changes.lastPowerPlayResult) {
                    newGameState.lastPowerPlayResult = { message: `⚡ ${powerPlay.icon} ${powerPlay.name} fired!${swappedOut}`, scoreChange: 0 };
                }
                
                return {
                    ...state,
                    gameState: newGameState,
                };
            } 
            
            return {
                ...state,
                gameState: {
                    ...gameState,
                    lastPowerPlayResult: {
                        message: swapped
                            ? `🔄 Swapped! ${held.icon} ${held.name} out, ${powerPlay.icon} ${powerPlay.name} in your pocket.`
                            : `🎒 ${powerPlay.icon} ${powerPlay.name} is in your pocket. Tap ▶ USE when you're ready.`,
                        scoreChange: 0,
                    },
                    // You hold one PowerPlay at a time: a new pick swaps out the old one.
                    availablePowerPlays: [powerPlay],
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
                
                const { newHand: smashedHand, newBag: finalBag } = gameUtils.postProcessHand(paddedHand, remainingBag, false);
                // A barrel: one tile of the fresh hand becomes a word multiplier tile.
                const finalHand = [...smashedHand];
                const barrelSlots = finalHand.map((t, i) => (t ? i : -1)).filter(i => i >= 0);
                const barrelIndex = barrelSlots[Math.floor(Math.random() * barrelSlots.length)];
                if (barrelIndex !== undefined) finalHand[barrelIndex] = { ...finalHand[barrelIndex]!, multiplier: POWER_PLAY_VALUES.donkeyKongMultiplier };
                const barrelLetter = barrelIndex !== undefined ? finalHand[barrelIndex]!.letter : '';
                
                const newLogEntry: EventLogEntry = {
                    type: 'event', id: `pp-${powerPlay.id}-${Date.now()}`, name: powerPlay.name,
                    description: `Your hand was smashed and replaced! '${barrelLetter}' is a ${POWER_PLAY_VALUES.donkeyKongMultiplier}x tile.`, icon: '🐵',
                    scoreChange: 0, cumulativeScore: state.gameState.score
                };
                
                return {
                    ...state,
                    hand: finalHand,
                    tileBag: finalBag,
                    buildRow: Array(BUILD_ROW_SIZE).fill(null),
                    modalContent: { type: 'info', title: 'Donkey Kong Smash!', content: `Fresh hand, plus a barrel: '${barrelLetter}' is a ${POWER_PLAY_VALUES.donkeyKongMultiplier}x word tile!`, autoClose: 2500 },
                    isPaused: true,
                    gameState: {
                        ...state.gameState,
                        log: [...state.gameState.log, newLogEntry],
                        availablePowerPlays: state.gameState.availablePowerPlays.filter(p => p.id !== powerPlay.id),
                    }
                };
            }
        
            if (powerPlay.id === 'actClear') {
                const { actClearMaxSeconds, actClearPointsPerSecond, actClearKeepSeconds } = POWER_PLAY_VALUES;
                const seconds = Math.min(actClearMaxSeconds, Math.max(0, state.time - actClearKeepSeconds));
                if (seconds <= 0 || state.gameState.roundType === 'golden') {
                    const why = state.gameState.roundType === 'golden' ? 'during a Golden Round' : `with ${actClearKeepSeconds} seconds or less on the clock`;
                    return { ...state, gameState: { ...state.gameState, lastPowerPlayResult: { message: `🦔 Act Clear! can't cash in time ${why}. It's still in your pocket.`, scoreChange: 0 } } };
                }
                const scoreChange = seconds * actClearPointsPerSecond;
                const newScore = state.gameState.score + scoreChange;
                const newLogEntry: EventLogEntry = {
                    type: 'event', id: `pp-${powerPlay.id}-${Date.now()}`, name: powerPlay.name,
                    description: `Cashed in ${seconds} seconds for ${scoreChange} points.`, icon: '🦔',
                    scoreChange, cumulativeScore: newScore
                };
                return {
                    ...state,
                    time: state.time - seconds,
                    timeGain: { seconds: -seconds, key: Date.now() },
                    modalContent: { type: 'info', title: '🦔 Act Clear!', content: `Time bonus! ${seconds} seconds → +${scoreChange} points.`, autoClose: 2500 },
                    isPaused: true,
                    gameState: {
                        ...state.gameState,
                        score: newScore,
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
            // Shake It Like a Polaroid: keep the vowels, redraw every consonant (no time added).
            if (powerPlay.id === 'shakeItLikeAPolaroid') {
                const allTiles = [...state.hand.filter((t): t is Tile => t !== null), ...state.buildRow.filter(i => i).map(item => item!.tile)];
                const vowels = allTiles.filter(t => VOWELS.has(t.letter));
                const consonantCount = allTiles.length - vowels.length;
                const { newTiles, remainingBag } = gameUtils.drawTiles(consonantCount, state.tileBag);
                const padded: (Tile | null)[] = Array(RACK_SIZE).fill(null);
                [...vowels, ...newTiles].forEach((t, i) => { if (i < RACK_SIZE) padded[i] = t; });
                newHand = padded;
                newBag = remainingBag;
                newBuildRow = Array(BUILD_ROW_SIZE).fill(null);
                newModalContent = { type: 'info', title: '📸 Shake It Like a Polaroid!', content: `Kept your ${vowels.length} vowel${vowels.length === 1 ? '' : 's'} and redrew ${consonantCount} consonant${consonantCount === 1 ? '' : 's'}.`, autoClose: 2200 };
                shouldPause = true;
                newLog = [...newLog, { type: 'event', id: `pp-${powerPlay.id}-${Date.now()}`, name: powerPlay.name, icon: powerPlay.icon, description: `Redrew ${consonantCount} consonants, kept the vowels.`, scoreChange: 0, cumulativeScore: state.gameState.score } as EventLogEntry];
                changes = { ...changes, log: newLog };
            }
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
            
            if (powerPlay.id === 'oneTileToRuleThemAll') {
                const slots = newHand.map((tile, index) => ({ tile, index })).filter((item): item is { tile: Tile; index: number } => item.tile !== null);
                if (slots.length > 0) {
                    const chosen = slots[Math.floor(Math.random() * slots.length)];
                    newHand = [...newHand];
                    newHand[chosen.index] = { ...chosen.tile, tempPoints: 30, tempPointsSource: powerPlay.name };
                    newModalContent = { type: 'info', title: '💍 One Tile to Rule Them All', content: `Your '${chosen.tile.letter}' tile is worth 30 points this round.`, autoClose: 2200 };
                    shouldPause = true;
                }
            }
            if (powerPlay.id === 'gadgetHands') {
                const { newTiles, remainingBag } = gameUtils.drawTiles(2, newBag);
                newHand = [...newHand];
                newTiles.forEach(tile => {
                    const empty = newHand.indexOf(null);
                    if (empty !== -1) newHand[empty] = tile;
                });
                newBag = remainingBag;
                newModalContent = { type: 'info', title: '🦾 Go-Go-Gadget Hands!', content: 'Wowsers! +2 tiles now, and your hand refills to 10 for 2 rounds.', autoClose: 2200 };
                shouldPause = true;
            }
            if (powerPlay.id === 'warpZone') {
                newModalContent = { type: 'info', title: '🍄 Warp Zone!', content: 'Your next valid word starts a Golden Round.', autoClose: 2200 };
                shouldPause = true;
            }
            if (powerPlay.id === 'whoYouGonnaCall') {
                newModalContent = { type: 'info', title: '👻 Ghostbusted!', content: 'All strikes busted! That cost you some time.', autoClose: 2200 };
                shouldPause = true;
            }
            if (powerPlay.selectionType === 'tile_transform') {
                return {
                    ...state,
                    modalContent: { type: 'charm-activation', title: `Activate: ${powerPlay.name}`, data: powerPlay },
                    isPaused: true,
                };
            }

            const activationChanges = powerPlay.activate(state.gameState);
            let timeChange = 0;
            if (powerPlay.id === 'timeBoost') timeChange = bonusTime(TIME_BONUS.timeBoost, state.time, runLevel(state.gameState));
            if (powerPlay.id === 'rewind') timeChange = bonusTime(TIME_BONUS.rescue, state.time, runLevel(state.gameState));
            if (powerPlay.id === 'whoYouGonnaCall') timeChange = -Math.min(15, Math.max(0, state.time - 5));

            if (powerPlay.id === 'sonicSpeed') {
                newModalContent = {
                    type: 'info',
                    title: 'Sonic Speed Activated!',
                    content: 'Word 1: 8s timer, 2x score\nWord 2: 7s timer, 4x score'
                };
                shouldPause = true;
            }
            
            // If it's a selection type that requires a modal (e.g., has a selectionType)
            // Buy a Vowel costs points: if the player can't afford it, keep it for later.
            if (powerPlay.id === 'buyAVowel' && state.gameState.score < POWER_PLAY_VALUES.buyAVowelCost) {
                return { ...state, gameState: { ...state.gameState, lastPowerPlayResult: { message: `🎡 You need ${POWER_PLAY_VALUES.buyAVowelCost} points to buy a vowel. It's still in your pocket.`, scoreChange: 0 } } };
            }
            if (powerPlay.effectType === 'selection' && powerPlay.selectionType) {
                return {
                    ...state,
                    modalContent: { type: 'powerplay-activation', title: `Activate: ${powerPlay.name}`, data: powerPlay },
                    isPaused: true,
                };
            }
            
            return {
              ...state,
              time: clampTime(state.time + timeChange, bankMax(gameState)),
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

          // Buy a Vowel: pay the cost, the picked vowel joins the hand.
          if (powerPlay.id === 'buyAVowel' && option?.letter) {
              const cost = POWER_PLAY_VALUES.buyAVowelCost;
              const slot = state.hand.findIndex(t => t === null);
              if (slot === -1 || gameState.score < cost) {
                  return { ...state, modalContent: null, isPaused: false, gameState: { ...gameState, lastPowerPlayResult: { message: slot === -1 ? '🎡 Your hand is full. Play a word first.' : `🎡 You need ${cost} points to buy a vowel.`, scoreChange: 0 } } };
              }
              const hand = [...state.hand];
              hand[slot] = gameUtils.createTile(option.letter);
              const score = gameState.score - cost;
              return {
                  ...state,
                  hand,
                  modalContent: null,
                  isPaused: false,
                  gameState: {
                      ...gameState,
                      score,
                      log: [...gameState.log, { type: 'event', id: `pp-buyAVowel-${Date.now()}`, name: powerPlay.name, icon: powerPlay.icon, description: `Bought an ${option.letter} for ${cost} points.`, scoreChange: -cost, cumulativeScore: score } as EventLogEntry],
                      lastPowerPlayResult: { message: `🎡 One ${option.letter}, coming up! (−${cost} pts)`, scoreChange: -cost },
                      availablePowerPlays: gameState.availablePowerPlays.filter(p => p.id !== powerPlay.id),
                      powerPlayToActivate: null,
                  },
              };
          }
          
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
            // 'phone': the word reveal runs in handlePhoneAFriend (it needs the dictionary); this spends the PowerPlay.
            
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
                timeChange = bonusTime(TIME_BONUS.rescue, state.time, runLevel(gameState));
            } else if (option.choice === 'strike') {
                changes = { strikes: Math.max(0, gameState.strikes - 1) };
            }
            return {
                ...state,
                time: clampTime(state.time + timeChange, bankMax(gameState)),
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
            const picked = handCopy[tileIndex];
            if (picked) {
                handCopy[tileIndex] = { ...picked, tempPoints: CAPTAIN_PLANET_POINTS, tempPointsSource: powerPlay.name };
            }
            const changes = powerPlay.activate(state.gameState);
            const letter = picked?.letter ?? '?';
            newGameState.log = [...newGameState.log, {
                type: 'event', id: `pp-${powerPlay.id}-${Date.now()}`, name: powerPlay.name, icon: powerPlay.icon,
                description: `Your ${letter} tile is worth ${CAPTAIN_PLANET_POINTS} points for your next word.`,
                scoreChange: 0, cumulativeScore: newGameState.score,
            } as EventLogEntry];
            newGameState.lastPowerPlayResult = { message: `🌎 The power is yours! ${letter} is worth ${CAPTAIN_PLANET_POINTS} points: play it in your next word!`, scoreChange: 0 };
            return {
                ...state,
                hand: handCopy,
                modalContent: null,
                isPaused: false,
                tileForSelection: null,
                gameState: {
                    ...changes,
                    ...newGameState,
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
                        availablePowerPlays: gameState.availablePowerPlays.filter(p => p.id !== charm.id),
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

export const GameScreen: React.FC<GameScreenProps> = ({ playerName, onGameOver, onSaveGame, isResuming, onTimeLow, onGoldenRoundChange, onBossRoundChange, onScoreUpdate, onLexCoinChange, tileClass, powerWord }) => {
    
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
                savedData.gameScreenState.gameState = rehydratePowerUps(savedData.gameScreenState.gameState);
                return savedData.gameScreenState;
            } catch (e) {
                console.error("Error parsing saved game. Starting fresh.", e);
                storage.remove(STORAGE_KEYS.savedGame);
            }
        }
    }
    return createScreenInitialState();
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

  // Daily missions: every run gets an id (kept in saves) so "in one run" missions can tell runs apart.
  const fallbackRunId = React.useRef(`run-${Date.now()}`);
  const runKey = gameState.runId ?? fallbackRunId.current;
  useEffect(() => {
      if (!gameState.runId) dispatch({ type: 'UPDATE_GAME_STATE', payload: { runId: fallbackRunId.current } });
  }, [gameState.runId]);
  const trackMission = useCallback((event: MissionEvent) => {
      const payout = recordMissionEvent(event, runKey);
      if (payout.total <= 0) return;
      const [first] = payout.completed;
      const label = payout.completed.length === 1
          ? `✅ Mission complete: ${first.template.text}! +${payout.total} 🪙`
          : payout.completed.length > 1
              ? `✅ ${payout.completed.length} missions complete! +${payout.total} 🪙`
              : `🧹 Daily sweep! +${payout.total} 🪙`;
      onLexCoinChange(payout.total, payout.sweepBonus && payout.completed.length ? `${label} 🧹 Daily sweep!` : label);
  }, [runKey, onLexCoinChange]);
  
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

  useEffect(() => {
    onBossRoundChange?.(!!gameState?.boss && gameState.roundType !== 'golden');
  }, [gameState?.boss, gameState?.roundType, onBossRoundChange]);


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
        newTiles = newTiles.map((tile): Tile | null => tile ? { ...tile, tempPoints: Math.floor(Math.random() * 10) + 1, tempPointsSource: TREEHOUSE_NAME } : null).filter((t): t is Tile => t !== null);
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

  const maxStrikes = useMemo(() => maxStrikesFor(gameState), [gameState?.charmUses]);

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

    if (lastModalTitle === CONTINUE_TITLE) {
      // A once-per-run rescue: the full seconds, outside the bonus-time rules.
      dispatch({ type: 'ADD_TIME', payload: TIME_BONUS.continueScreen });
      dispatch({ type: 'CLOSE_MODAL' });
      return;
    }

    if (lastModalTitle.includes('Deep Freeze')) {
      dispatch({ type: 'ADD_TIME', payload: bonusTime(TIME_BONUS.rescue, state.time, runLevel(state.gameState)) });
      dispatch({ type: 'CLOSE_MODAL' });
      return;
    }

    dispatch({ type: 'CLOSE_MODAL' });

    const postWordModals: (ModalContent['type'])[] = ['milestone', 'easter-egg', 'word-bonus', 'powerplay-selection', 'charm-selection', 'super-hand', 'info', 'slot-machine'];
    const afterAWord = state.awaitingNextRound || lastModalTitle.includes('Sonic Speed');
    if (afterAWord && wasLastInQueue && lastModalType && (postWordModals.includes(lastModalType) || lastModalTitle.includes('Sonic Speed')) && lastModalTitle !== '❌ Strike Challenge Lost') {
        if (state.gameState.roundType === 'normal') {
            handleStartNextRound();
        }
    }
  }, [state.modalContent, state.modalQueue, state.gameState, state.awaitingNextRound, handleStartNextRound, onGameOver, state.hand, state.tileBag, maxStrikes, resetRound]);


  // Only quick PowerPlay/charm results auto-close. Bigger notices (level-ups, milestones, secret
  // bonuses, Golden Rounds, Power Word, big combos) always wait for the player to tap Continue.
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

  // Whether this game was resumed is decided once, when the screen mounts. Reacting to later
  // changes of the prop used to deal a fresh hand over a resumed game.
  const resumedOnMount = React.useRef(isResuming).current;

  useEffect(() => {
    dispatch({ type: 'SET_IS_LOADING', payload: true });
    if (resumedOnMount) {
        // State is already loaded by reducer initializer.
        // We can show a welcome message.
        showMessage(`Welcome back, ${playerName}!`, 2500);
    } else {
        // This is a new game, deal the initial hand.
        initialDeal();
    }
    dispatch({ type: 'SET_IS_LOADING', payload: false });
    // Run once per mounted game.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          
          // Deep Freeze (PowerPlay) check first
          if (gameState?.activePowerPlays?.deepFreeze) {
              dispatch({ type: 'PAUSE_GAME' });
              const { deepFreeze, ...remainingPowerPlays } = gameState.activePowerPlays;
              dispatch({
                  type: 'UPDATE_GAME_STATE',
                  payload: {
                      activePowerPlays: remainingPowerPlays,
                      activeBuffs: (gameState?.activeBuffs ?? []).filter(b => b.id !== 'deepFreeze'),
                  }
              });
              dispatch({ type: 'SET_MODAL_CONTENT', payload: { type: 'info', title: '❄️ Deep Freeze! ❄️', content: 'Time froze solid. You get 10 bonus seconds. Make them count!' }});
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

          // Continue? (PowerPlay) last: it costs points, so the free rescues go first.
          if (gameState?.activePowerPlays?.continueScreen) {
              dispatch({ type: 'PAUSE_GAME' });
              const { continueScreen, ...remainingPowerPlays } = gameState.activePowerPlays;
              const cost = Math.round(gameState.score * POWER_PLAY_VALUES.continueScoreCostPercent / 100);
              const newScore = gameState.score - cost;
              dispatch({
                  type: 'UPDATE_GAME_STATE',
                  payload: {
                      score: newScore,
                      activePowerPlays: remainingPowerPlays,
                      activeBuffs: (gameState.activeBuffs ?? []).filter(b => b.id !== 'continueScreen'),
                      log: [...gameState.log, {
                          type: 'event', id: `pp-continueScreen-${Date.now()}`, name: 'Continue?', icon: '🕹️',
                          description: `Continued with ${TIME_BONUS.continueScreen} seconds for ${POWER_PLAY_VALUES.continueScoreCostPercent}% of your score.`,
                          scoreChange: -cost, cumulativeScore: newScore,
                      } as EventLogEntry],
                  }
              });
              dispatch({ type: 'SET_MODAL_CONTENT', payload: { type: 'info', title: CONTINUE_TITLE, content: `Coin inserted! You keep playing with ${TIME_BONUS.continueScreen} seconds. It cost ${cost.toLocaleString()} points (${POWER_PLAY_VALUES.continueScoreCostPercent}% of your score).` }});
              soundService.playMilestone();
              return;
          }
          
          soundService.playInvalidWord();
          dispatch({ type: 'GAME_OVER_INITIATED', payload: { reason: 'time' } });
          return;
      }
      
      // ❄️ Power word freeze: the bank holds still, one real second at a time.
      const frozen = gameState.roundType !== 'golden' && (gameState.freezeLeft ?? 0) > 0;
      if (!frozen && (time ?? 0) > 0 && (time ?? 0) <= 10) {
        soundService.playTick();
      }

      // Speed-up levels make the bank drain faster; the Golden Round's own clock stays at real time.
      // 🦥 Slow motion (a power word) stretches each tick.
      const slow = gameState.roundType !== 'golden' && (gameState.slowWords ?? 0) > 0 ? POWER_WORD_EFFECTS.slowFactor : 1;
      const tickMs = frozen ? 1000 : gameState.roundType === 'golden' ? 1000 : tickMsFor(levelFor(totalWords)) * slow;
      const interval = setInterval(() => {
          dispatch({ type: frozen ? 'TICK_FREEZE' : 'TICK_TIMER' });
      }, tickMs);

      return () => clearInterval(interval);
  }, [gameState, time, onGameOver, isPaused, isLoading, isVisible, showMessage, maxStrikes, endGoldenRound, totalWords]);
  
  // First time a player's clock runs low (ever), point them at the Shuffle lifeline.
  const lowOnTime = !!gameState && gameState.roundType !== 'golden' && !isPaused && !isLoading
      && time > 0 && time <= GAMEPLAY.timeBank.lifelineHintBelow && gameState.shuffleCount > 0;
  useEffect(() => {
    if (!lowOnTime) return;
    try {
      if (localStorage.getItem(LIFELINE_TIP_KEY)) return;
      localStorage.setItem(LIFELINE_TIP_KEY, '1');
    } catch { return; }
    showMessage(`⏱ Running low? Hold Shuffle for +${GAMEPLAY.timeBank.shuffleTimeBonus} seconds!`, 3500);
  }, [lowOnTime, showMessage]);

  useEffect(() => {
    if (gameState?.lastPowerPlayResult) {
        showMessage(gameState.lastPowerPlayResult.message, 3000);
        dispatch({ type: 'UPDATE_GAME_STATE', payload: { lastPowerPlayResult: null } });
    }
  }, [gameState?.lastPowerPlayResult, showMessage]);

   const handleMoveToBuild = (tile: Tile, fromIndex: number) => {
    if (tile.isLocked || isChallengeLock || (buildRow?.filter(t => t).length ?? 0) >= BUILD_ROW_SIZE) return;
    
    if (gameState?.activePowerPlays?.['wordLock'] && (buildRow?.filter(t => t).length ?? 0) >= 5) {
        showMessage("Game Genie allows a max of 5 tiles.", 2000);
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
    // One-turn tile boosts (One Tile, Captain Planet, Rescue Drop) go back in the bag on a shuffle.
    const boosted = allTilesInPlay.find(tile => tile.tempPointsSource && tile.tempPointsSource !== TREEHOUSE_NAME);
    if (boosted) {
        showMessage(`${boosted.tempPointsSource}: your ${boosted.tempPoints}-point ${boosted.letter} went back in the bag.`, 2500);
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
      const rawBaseScore = rawBaseScoreParam;
      const now = Date.now();
      const modalQueue: ModalContent[] = [];
      if (infoMessage) {
        modalQueue.push({ type: 'info', title: 'PowerPlay Result', content: infoMessage, autoClose: 2500 });
      }
      const eventLogQueue: EventLogEntry[] = [];
      const oldScore = newState.score;
      const totalWordsSubmitted = totalWords + 1;
      let scoreResult: ScoreCalculationResult = { totalScore: finalWordScore, baseScore: rawBaseScoreParam, bonuses: [...baseBonuses], ...scoreBreakdown };

      // --- A: GOLDEN ROUND SUBMISSION ---
        if (newState.roundType === 'golden') {
            scoreResult = gameUtils.calculateScore(word, submittedTiles, newState);
            if (newState.activeCharms.some(c => c.id === 'goldenGirls')) {
                const bonus = Math.round(scoreResult.totalScore * CHARM_BONUS.goldenGirlsPercent / 100);
                scoreResult = { ...scoreResult, totalScore: scoreResult.totalScore + bonus, bonuses: [...scoreResult.bonuses, { name: 'Thank You for Being a Friend', description: `+${bonus} pts (${CHARM_BONUS.goldenGirlsPercent}%)` }] };
            }
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
            newState.pendingTimeBonus = timeForWordAtLevel(word.length, levelFor(totalWords)); // Added back onto the time bank
            const levelUp = levelUpModal(totalWords);
            if (levelUp) modalQueue.push(levelUp);
            const goldenBossIntro = startBossRound(newState, totalWords);
            if (goldenBossIntro) modalQueue.push(goldenBossIntro);

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

            trackMission({ type: 'word', word, score: turnScore });
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
      newState.pendingTimeBonus = timeForWordAtLevel(word.length, levelFor(totalWords));

      const levelUp = levelUpModal(totalWords);
      if (levelUp) modalQueue.push(levelUp);

      if (word.length >= 5 && !isChallengeLock) {
          showToast(`Length bonus x${lengthMultiplier(word.length)}!`);
      }
      
      // --- Combo Breaker: a short word scores nothing and breaks the combo (the PowerPlay ends) ---
      if (newState.activePowerPlays.comboBreaker && word.length < POWER_PLAY_VALUES.comboBreakerMinLength) {
          scoreResult.totalScore = 0;
          scoreResult.bonuses = [{ name: 'Combo Breaker', description: `Under ${POWER_PLAY_VALUES.comboBreakerMinLength} letters: 0 pts, combo broken` }];
          showMessage(`🥊 Combo broken! Under ${POWER_PLAY_VALUES.comboBreakerMinLength} letters scores 0.`, 2500);
          const { comboBreaker: _broken, ...stillActive } = newState.activePowerPlays;
          newState.activePowerPlays = stillActive;
          newState.activeBuffs = newState.activeBuffs.filter(b => b.id !== 'comboBreaker');
      }
      if (newState.activePowerPlays.ludicrousSpeed) {
          newState.ludicrousTimeCost = (newState.ludicrousTimeCost ?? 0) + 8;
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
      const comboFilled = newState.powerSurgeProgress === 4;
      if (comboFilled) { // This is the 5th word in the streak.
          scoreResult = addWordMultiplier(scoreResult, 2);
          scoreResult.bonuses.push({ name: "⚡ 5-Word Combo!", description: "x2 Score"});
          if (newState.activeCharms.some(c => c.id === 'noteStreak')) {
              scoreResult.totalScore += CHARM_BONUS.noteStreak;
              scoreResult.bonuses.push({ name: 'Note Streak', description: `+${CHARM_BONUS.noteStreak} pts` });
          }
          newState.powerSurgeProgress = 0;
      } else {
          newState.powerSurgeProgress++;
      }

      // Flawless Victory (low clock) and I'm Ready! (first word of a new level) add word multipliers.
      // A word already zeroed (Heisenberg, a broken Combo Breaker) stays at zero.
      const wordScored = scoreResult.totalScore > 0;
      if (wordScored && newState.activeCharms.some(c => c.id === 'finishHim') && time <= CHARM_BONUS.finishHimBelow) {
          scoreResult = addWordMultiplier(scoreResult, CHARM_BONUS.finishHimMultiplier);
          scoreResult.bonuses.push({ name: 'Flawless Victory', description: `x${CHARM_BONUS.finishHimMultiplier} Score`, source: 'word' });
          showMessage(`🥊 Flawless Victory! x${CHARM_BONUS.finishHimMultiplier} score.`, 2000);
      }
      const wordLevel = levelFor(totalWords);
      if (wordScored && newState.activeCharms.some(c => c.id === 'imReady') && wordLevel > (newState.readyLevel ?? 1)) {
          newState.readyLevel = wordLevel;
          scoreResult = addWordMultiplier(scoreResult, CHARM_BONUS.imReadyMultiplier);
          scoreResult.bonuses.push({ name: "I'm Ready!", description: `x${CHARM_BONUS.imReadyMultiplier} Score`, source: 'word' });
          showMessage(`🧽 I'm ready! First word of level ${wordLevel}: x${CHARM_BONUS.imReadyMultiplier}.`, 2500);
      }
      // We Were on a Break! is scored in calculateScore; any valid word uses it up.
      newState.breakReady = false;

      // --- 4. STATEFUL & RANDOM BONUSES on top of word score ---
      
      let runningScore = oldScore;
      
      // Power Word Bonus
      if (powerWord && word.toUpperCase() === powerWord.toUpperCase() && !newState.powerWordUsed) {
          newState.powerWordUsed = true; // Mark as used for this run
          const powerWordBonus = powerWordBonusFor(currentStreak());
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
          modalQueue.push({ type: 'info', title: '💥 Power Word!', content: `You played your daily Power Word for a +${powerWordBonus.toLocaleString()} point bonus!` });
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
      if (newState.activeCharms.some(c => c.id === 'goldenTicket') && Math.random() < CHARM_BONUS.goldenTicketChance) {
        scoreResult.totalScore += CHARM_BONUS.goldenTicket;
        scoreResult.bonuses.push({ name: 'Golden Ticket!', description: `+${CHARM_BONUS.goldenTicket} pts` });
        modalQueue.push({ type: 'info', title: '🎟️ Golden Ticket!', content: `You found it! +${CHARM_BONUS.goldenTicket} points!` });
      }
      if (newState.activeCharms.some(c => c.id === 'philsosophy')) {
          const rand = Math.random();
          const { philsosophyWin: win, philsosophyLoss: loss } = CHARM_BONUS;
          if (rand < 0.25) {
              scoreResult.totalScore += win;
              scoreResult.bonuses.push({ name: "Phil's-osophy", description: `+${win} pts`});
              showMessage(`🎲 Phil's-osophy: heads! +${win} points.`, 2500);
          } else if (rand < 0.35) {
              scoreResult.totalScore -= loss;
              scoreResult.bonuses.push({ name: "Phil's-osophy", description: `-${loss} pts`});
              showMessage(`🎲 Phil's-osophy: tails. -${loss} points.`, 2500);
          }
      }

      // Check Blue Shell Surprise
      if (newState.activePowerPlays['blueShellSurprise']) {
          const { blueShellWinChance, blueShellMultiplier: mult, blueShellLoss: loss } = POWER_PLAY_VALUES;
          const isWin = Math.random() < blueShellWinChance;
          let modalContent = '';
          if (isWin) {
              const bonus = scoreResult.totalScore * (mult - 1);
              scoreResult.totalScore *= mult;
              scoreResult.bonuses.push({ name: 'Blue Shell (Win)', description: `x${mult} Word Score` });
              modalContent = `It's a direct hit! Your word score is x${mult}! (+${Math.round(bonus)} points)`;
          } else {
              scoreResult.totalScore -= loss;
              scoreResult.bonuses.push({ name: 'Blue Shell (Loss)', description: `-${loss} pts` });
              modalContent = `Oh no, it backfired! You lost ${loss} points from this turn's score.`;
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
          scoreResult.totalScore += CHARM_BONUS.momentum;
          scoreResult.bonuses.push({ name: "Momentum", description: `Momentum: +${CHARM_BONUS.momentum} pts`});
          showMessage(`💨 Momentum! +${CHARM_BONUS.momentum} bonus points.`, 2000);
      }
      const scoreBeforeEncore = scoreResult.totalScore;
      
      // Nicole's Grace Check
      if (newState.activeCharms.some(c => c.id === 'nicolesGrace')) {
          const endsInVowel = VOWELS.has(word.toUpperCase().slice(-1));
          if (word.toUpperCase().includes('M') || endsInVowel) {
              const bonus = Math.round(scoreResult.totalScore * CHARM_BONUS.nicolesGracePercent / 100);
              scoreResult.totalScore += bonus;
              scoreResult.bonuses.push({ name: "Nicole's Grace", description: `+${bonus} pts (${CHARM_BONUS.nicolesGracePercent}%)` });
          }
      }

      if (newState.pianoManEncoreActive) {
          const bonus = CHARM_BONUS.pianoMan;
          scoreResult.totalScore += bonus;
          scoreResult.bonuses.push({ name: "Piano Man Encore", description: `+${bonus} pts`});
          showMessage(`🎹 Piano Man Encore! +${bonus} bonus points.`, 2000);
      }
      if (newState.activeCharms.some(c => c.id === 'christiansHoodieMode')) {
          if (timeSinceLast < 10000 && /[GAM]/.test(word.toUpperCase())) {
              const bonus = Math.round(scoreResult.totalScore * CHARM_BONUS.christiansHoodiePercent / 100);
              scoreResult.totalScore += bonus;
              scoreResult.bonuses.push({ name: "Christian’s Hoodie Mode", description: `+${bonus} pts (${CHARM_BONUS.christiansHoodiePercent}%)`});
              showMessage(`🎮 Hoodie Mode! +${bonus} bonus points.`, 2000);
          }
      }

      if (newState.activePowerPlays.multiverseOfSadness) {
          const timeBonus = Math.min(TIME_BONUS.multiverseCap, Math.round(scoreResult.totalScore / 2));
          scoreResult.totalScore = Math.floor(scoreResult.totalScore / 2);
          newState.multiverseTimeBonus = timeBonus;
          scoreResult.bonuses.push({ name: "In Time", description: `In Time: /2 Score, +${timeBonus}s next round`});
          showMessage(`🌀 Multiverse: +${timeBonus}s next round!`, 3000);
      }

      // Charm Bonuses that add on top
      if (newState.activeCharms.some(c => c.id === 'downToYourBoxers') && newState.strikes >= maxStrikesFor(newState) - 1) {
        const bonus = Math.round(scoreResult.totalScore * CHARM_BONUS.boxersPercent / 100);
        scoreResult.totalScore += bonus;
        scoreResult.bonuses.push({ name: 'Down to Your Boxers', description: `+${bonus} pts (${CHARM_BONUS.boxersPercent}%)` });
      }
      const currentHour = new Date().getHours();
      if (newState.activeCharms.some(c => c.id === 'buffyBonus') && (currentHour >= 20 || currentHour < 8)) {
        scoreResult.totalScore += CHARM_BONUS.buffy;
        scoreResult.bonuses.push({ name: 'Buffy Bonus', description: `+${CHARM_BONUS.buffy} pts` });
      }
      if (newState.activeCharms.some(c => c.id === 'totallyClueless') && originalWordScore < CHARM_BONUS.totallyCluelessBelow) {
        scoreResult.totalScore += CHARM_BONUS.totallyClueless;
        scoreResult.bonuses.push({ name: 'Totally Clueless', description: `+${CHARM_BONUS.totallyClueless} pts` });
      }
      if (newState.activeCharms.some(c => c.id === 'hesOnFire') && time > CHARM_BONUS.hesOnFireAbove) {
        scoreResult.totalScore += CHARM_BONUS.hesOnFire;
        scoreResult.bonuses.push({ name: "He's On Fire!", description: `+${CHARM_BONUS.hesOnFire} pts` });
      }
      if ((newState.survivorWords ?? 0) > 0) {
        newState.survivorWords = newState.survivorWords! - 1;
        if (newState.activeCharms.some(c => c.id === 'survivor')) {
          scoreResult.totalScore += CHARM_BONUS.survivor;
          scoreResult.bonuses.push({ name: 'Survivor', description: `+${CHARM_BONUS.survivor} pts` });
          showMessage(`🎤 Survivor! +${CHARM_BONUS.survivor} points.`, 2000);
        }
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
              });

              newState.perfectChainProgress = 0; // Reset for the next chain
          }
      } else {
          if (newState.perfectChainProgress > 0) {
              newState.perfectChainProgress = 0;
          }
      }
      
      // Cross the Road: count 5+ letter words in a row; the 3rd pays and the count starts over.
      if (newState.activeCharms.some(c => c.id === 'crossTheRoad')) {
          const streak = word.length >= CHARM_BONUS.crossTheRoadLetters ? (newState.frogStreak ?? 0) + 1 : 0;
          if (streak >= CHARM_BONUS.crossTheRoadWords) {
              scoreResult.totalScore += CHARM_BONUS.crossTheRoad;
              scoreResult.bonuses.push({ name: 'Cross the Road', description: `+${CHARM_BONUS.crossTheRoad} pts` });
              showMessage(`🐸 Crossed the road! +${CHARM_BONUS.crossTheRoad} points.`, 2500);
              newState.frogStreak = 0;
          } else {
              newState.frogStreak = streak;
          }
      }

      // Mixtape: remember the last letter (and grow the chain if this word continued it).
      if (newState.activeCharms.some(c => c.id === 'mixtape')) {
          const upper = word.toUpperCase();
          const prev = newState.mixtapeChain;
          const linked = !!prev?.next && upper.startsWith(prev.next);
          newState.mixtapeChain = { next: upper.slice(-1), links: linked ? prev!.links + 1 : 0 };
      }

      // Execute Order 66 check
      if (newState.activeCharms.some(c => c.id === 'executeOrder66')) {
        const hasDoubleLetter = /(.)\1/i.test(word);
        if (hasDoubleLetter) {
          newState.multiverseTimeBonus = (newState.multiverseTimeBonus || 0) + TIME_BONUS.executeOrder66;
          showMessage(`🛰️ Execute Order 66! +${TIME_BONUS.executeOrder66}s next round.`, 2500);
        }
      }

      // Sands of Time check
      if (newState.activeCharms.some(c => c.id === 'sandsOfTime') && word.length >= TIME_BONUS.sandsOfTimeLetters) {
        newState.multiverseTimeBonus = (newState.multiverseTimeBonus || 0) + TIME_BONUS.sandsOfTime;
        showMessage(`⏳ Sands of Time! +${TIME_BONUS.sandsOfTime}s next round.`, 2500);
      }
      
      // --- 5. GAME STATE BONUSES (Refactored) ---
      runningScore += scoreResult.totalScore;

      const isSuperHand = ((hand ?? []).filter(t => t !== null).length === 0);
      if (isSuperHand) {
          const superHandBonus = SUPER_HAND_BONUS;
          runningScore += superHandBonus;
          scoreResult.bonuses.push({ name: "Super Hand", description: `+${superHandBonus} pts`});
          eventLogQueue.push({ type: 'event', id: `super-hand-${Date.now()}`, name: 'Super Hand!', icon: '✨', description: 'Cleared the entire hand in one word!', scoreChange: superHandBonus, cumulativeScore: runningScore });

          const superHandText = `You've assembled the perfect hand. Consider it a snap. +${SUPER_HAND_BONUS}`;
          modalQueue.push({ type: 'super-hand', title: '✨ SUPER HAND! ✨', content: superHandText, data: { points: superHandBonus } });
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

      if (newState.activeCharms.some(c => c.id === 'fluxCapacitor') && (totalWordsSubmitted) % CHARM_BONUS.fluxCapacitorEvery === 0) {
          const bonus = CHARM_BONUS.fluxCapacitor;
          runningScore += bonus;
          scoreResult.bonuses.push({ name: "Flux Capacitor", description: `+${bonus} pts`});
          showMessage(`🕰️ Flux Capacitor! +${bonus} bonus points.`, 2500);
      }
      if (newState.activeCharms.some(c => c.id === 'thrillerNight') && (totalWordsSubmitted) % 4 === 0) {
        const thrillerBonus = CHARM_BONUS.thrillerNight;
        runningScore += thrillerBonus;
        scoreResult.bonuses.push({ name: 'Thriller Night', description: `+${thrillerBonus} pts` });
        showMessage(`🧟 Thriller Night! +${thrillerBonus} points.`, 3000);
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
              showMessage(`🤖 Glitch in the Code! +${TIME_BONUS.glitchInTheCode}s next round.`, 3000);
          }
      }
      
      // Golden Snitch check
      // Each catch needs a longer streak (5, 8, 12); after the last one the Snitch flies away.
      const snitchCharmActive = newState.activeCharms.some(c => c.id === 'goldenSnitch');
      const snitchCatches = newState.snitchCatches ?? 0;
      const snitchTarget = snitchTargetFor(snitchCatches);
      if (snitchCharmActive && snitchTarget !== null && newState.consecutiveSuccesses >= snitchTarget) {
          const snitchBonus = GAMEPLAY.snitchBonus;
          runningScore += snitchBonus;
          scoreResult.bonuses.push({ name: "Golden Snitch", description: `+${snitchBonus} pts`});
          shouldResetStreak = true;
          newState.snitchCatches = snitchCatches + 1;
          const nextTarget = snitchTargetFor(snitchCatches + 1);
          if (nextTarget === null) {
              newState.activeCharms = newState.activeCharms.filter(c => c.id !== 'goldenSnitch');
              newState.activeBuffs = newState.activeBuffs.filter(b => b.id !== 'goldenSnitch');
              modalQueue.push({ type: 'info', title: '🕊️ Golden Snitch Caught!', content: `${snitchTarget} words in a row! +${snitchBonus} points. That was the last catch: the Snitch flies away and frees up its charm slot.` });
          } else {
              modalQueue.push({ type: 'info', title: '🕊️ Golden Snitch Caught!', content: `${snitchTarget} words in a row! +${snitchBonus} points. It's faster now: catch it again with ${nextTarget} in a row.` });
          }
      }

      if (shouldResetStreak) {
          newState.consecutiveSuccesses = 0;
      }

      // Boss round: does this word follow the boss rule? Every valid word still scores normally.
      const bossRound = newState.boss;
      const boss = bossById(bossRound?.id);
      if (bossRound && !boss) newState.boss = null;
      if (bossRound && boss) {
          const rack = [...(hand ?? []).filter((t): t is Tile => t !== null), ...submittedTiles];
          // This word isn't in the log yet, so the log's last valid word is the one before it.
          const lastWord = [...newState.log].reverse().find(e => e.type === 'word' && e.status === 'valid') as WordLogEntry | undefined;
          const hit = boss.check(word.toUpperCase(), rack, { last: (lastWord?.word ?? '').toUpperCase(), score: scoreResult.totalScore, lastScore: lastWord?.score ?? 0 });
          const { round, outcome } = advanceBoss(bossRound, hit);
          const hits = bossRound.hits + (hit ? 1 : 0);
          scoreResult.bonuses.push(hit
              ? { name: `👊 Boss hit on ${boss.name}`, description: `${hits}/${BOSS.hitsToWin}` }
              : { name: `💨 ${boss.name} dodged`, description: boss.rule });
          newState.boss = round;
          if (hit && newState.activeCharms.some(c => c.id === 'doubleDragon')) {
              runningScore += CHARM_BONUS.doubleDragon;
              scoreResult.bonuses.push({ name: 'Double Dragon', description: `+${CHARM_BONUS.doubleDragon} pts` });
          }
          if (outcome) {
              trackMission({ type: 'boss', id: boss.id, outcome, hits });
              sendStat({ type: 'boss_end', boss: boss.id, number: bossRound.number, outcome, hits });
          }
          if (outcome === 'won') newState.bossesBeaten = (newState.bossesBeaten ?? 0) + 1;
          if (round) showMessage(hit ? `👊 HIT! ${hits}/${BOSS.hitsToWin} on ${boss.name}` : `💨 Dodged! ${boss.rule} · ${round.wordsLeft} left`, 1800);
          const reward = bossRewardFor(bossRound.number);
          if (outcome === 'won') {
              runningScore += reward.points;
              newState.pendingBadgeTime = (newState.pendingBadgeTime ?? 0) + reward.seconds;
              scoreResult.bonuses.push({ name: `🏅 Boss Badge: ${boss.name}`, description: `+${reward.points} pts, +${reward.seconds}s` });
              const { isNew, total } = recordBossBadge(boss.id);
              eventLogQueue.push({ type: 'event', id: `boss-${boss.id}-${now}`, name: `Beat ${boss.name}`, icon: '🏅', description: `${hits}/${BOSS.hitsToWin} hits: Boss Badge earned (+${reward.seconds}s).`, scoreChange: reward.points, cumulativeScore: runningScore });
              modalQueue.push({ type: 'info', title: '🏅 BOSS DEFEATED!', content: `You beat ${boss.icon} ${boss.name}! Boss Badge earned: +${reward.points} points and +${reward.seconds}s.${isNew ? `\n\nNew badge for your Badge Case (${total}/${BOSSES.length})!` : ''}` });
              soundService.playMilestone();
          } else if (outcome === 'close') {
              runningScore += reward.closePoints;
              scoreResult.bonuses.push({ name: `😤 So close: ${boss.name}`, description: `+${reward.closePoints} pts` });
              eventLogQueue.push({ type: 'event', id: `boss-${boss.id}-${now}`, name: `${boss.name} got away`, icon: '😤', description: `${hits}/${BOSS.hitsToWin} hits: so close.`, scoreChange: reward.closePoints, cumulativeScore: runningScore });
              modalQueue.push({ type: 'info', title: '😤 SO CLOSE!', content: `${hits}/${BOSS.hitsToWin} hits on ${boss.icon} ${boss.name}. +${reward.closePoints} points for the effort, but the badge (and its time) got away.` });
          } else if (outcome === 'escaped') {
              modalQueue.push({ type: 'info', title: `💨 ${boss.name} got away`, content: `${hits}/${BOSS.hitsToWin} hits. No badge this time, and nothing lost.`, autoClose: 2500 });
          }
      }
      const bossIntro = startBossRound(newState, totalWords);
      if (bossIntro) modalQueue.push(bossIntro);

      // Gotta Catch 'Em All: collect all five vowels across your words, once per run.
      if (newState.activeCharms.some(c => c.id === 'gottaCatchEmAll')) {
          newState.pokedexVowels = catchVowels(newState.pokedexVowels ?? '', word);
          if (newState.pokedexVowels.length === 5) {
              const pokedexBonus = CHARM_BONUS.gottaCatchEmAll;
              runningScore += pokedexBonus;
              scoreResult.bonuses.push({ name: "Gotta Catch 'Em All!", description: `+${pokedexBonus} pts` });
              newState.multiverseTimeBonus = (newState.multiverseTimeBonus || 0) + TIME_BONUS.gottaCatchEmAll;
              newState.pokedexComplete = true;
              newState.activeCharms = newState.activeCharms.filter(c => c.id !== 'gottaCatchEmAll');
              newState.activeBuffs = newState.activeBuffs.filter(b => b.id !== 'gottaCatchEmAll');
              modalQueue.push({ type: 'info', title: "📕 Gotta Catch 'Em All!", content: `You caught all five vowels! +${pokedexBonus} points and +${TIME_BONUS.gottaCatchEmAll}s next round. Your Pokédex is complete, so the charm frees up its slot.` });
          }
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
              scoreResult.bonuses.push({ name: 'Ditto!', description: `+${duckHuntBonus} pts` });
              modalQueue.push({ type: 'info', title: '🟣 Ditto!', content: 'You used the same letter in 3 straight words! +350 points.' });
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
                  modalQueue.push({ type: 'milestone', title: milestone.name, data: milestone, content: milestone.flavorText });
                  newMilestonesFound = true; // A milestone was found, re-iterate from the start
                  break; 
              }
          }
      }

      // Power words: slow motion counts down one word at a time.
      if ((newState.slowWords ?? 0) > 0) newState.slowWords = newState.slowWords! - 1;
      const thisWordLevel = levelFor(totalWords);
      // A power word's effect (on the next round). Returns the pop-up that explains it.
      const firePowerWord = (egg: typeof EASTER_EGGS[number], again: boolean): ModalContent => {
          const effect = egg.reward.effect!;
          const icon = egg.name.split(' ')[0];
          newState.powerWordLevels = { ...(newState.powerWordLevels ?? {}), [egg.id]: thisWordLevel };
          const head = again ? `${icon} ${word.toUpperCase()} AGAIN!` : '';
          const track = (seconds = 0, strike = false) => sendStat({ type: 'power_word', power: effect, repeat: again, seconds, strike });
          const note = (title: string, content: string, change = 0): ModalContent => {
              scoreResult.bonuses.push({ name: `${icon} ${title}`, description: content });
              eventLogQueue.push({ type: 'event', id: `pw-${egg.id}-${now}`, name: title, icon, description: content, scoreChange: change, cumulativeScore: runningScore });
              return { type: 'info', title: head || `${icon} ${title}`, content, autoClose: 3000 };
          };
          if (effect === 'slot') {
              const pay = slotPayout(Math.random());
              track(pay.seconds);
              newState.multiverseTimeBonus = (newState.multiverseTimeBonus || 0) + pay.seconds;
              scoreResult.bonuses.push({ name: '🎰 Slot machine', description: `+${pay.seconds}s next round` });
              eventLogQueue.push({ type: 'event', id: `pw-${egg.id}-${now}`, name: 'Slot machine', icon: '🎰', description: `Pulled the lever: +${pay.seconds}s next round.`, scoreChange: 0, cumulativeScore: runningScore });
              return { type: 'slot-machine', title: head || '🎰 PULL THE LEVER!', data: { seconds: pay.seconds, reels: pay.reels, jackpot: pay.seconds === Math.max(...POWER_WORD_EFFECTS.slot.map(p => p.seconds)) } };
          }
          if (effect === 'freeze') {
              newState.freezeLeft = POWER_WORD_EFFECTS.freezeSeconds;
              track(POWER_WORD_EFFECTS.freezeSeconds);
              return note('Frozen!', `The clock won't move for the first ${POWER_WORD_EFFECTS.freezeSeconds} seconds of your next round.`);
          }
          if (effect === 'slow') {
              newState.slowWords = POWER_WORD_EFFECTS.slowWords;
              track();
              return note('Slow motion!', `The clock runs at half speed for your next ${POWER_WORD_EFFECTS.slowWords} words.`);
          }
          if (effect === 'heal') {
              track(0, newState.strikes > 0);
              if (newState.strikes > 0) {
                  newState.strikes -= 1;
                  return note('Healed!', 'Heroes never die: one strike removed.');
              }
              const pts = POWER_WORD_EFFECTS.healFallbackPoints;
              runningScore += pts;
              return note('Full health!', `No strikes to heal, so +${pts} points instead.`, pts);
          }
          // twin: your best word is cloned. No points, but its time and a Word Combo step.
          const best = gameState.highestScoringWord?.word ?? word;
          const seconds = timeForWordAtLevel(best.length, thisWordLevel);
          newState.pendingTimeBonus = (newState.pendingTimeBonus ?? 0) + seconds;
          newState.powerSurgeProgress = Math.min(4, newState.powerSurgeProgress + 1);
          track(seconds);
          return note('Cloned!', `Your best word ${best.toUpperCase()} is cloned: +${seconds}s next round and +1 toward your Word Combo.`);
      };

      // Easter eggs: word bonuses and score-number bonuses add their points on top of the turn.
      for (const egg of EASTER_EGGS) {
          const found = newState.foundEasterEggs.some(fe => fe.id === egg.id);
          // Power words can fire again, once per level; every other secret is once per run.
          const again = found && !!egg.reward.effect && powerWordReady(newState.powerWordLevels, egg.id, thisWordLevel);
          if (found && !again) continue;
          if (again) {
              if (egg.trigger(word, runningScore, newState)) {
                  recordFound(egg.id);
                  modalQueue.push(firePowerWord(egg, true));
              }
              continue;
          }
          if (egg.trigger(word, runningScore, newState)) {
              // Remember the exact score that matched, to show the player why the bonus fired.
              const triggerScore = runningScore;
              const explanation = egg.scorePattern ? explainScoreBonus(triggerScore, egg.scorePattern) : '';
              newState.foundEasterEggs = [...newState.foundEasterEggs, egg];
              let eggScoreChange = 0;
              if (egg.reward.points) {
                  const treasure = newState.activeCharms.some(c => c.id === 'nationalTreasure');
                  const eggPoints = egg.reward.points * (treasure ? CHARM_BONUS.nationalTreasureMultiplier : 1);
                  runningScore += eggPoints;
                  eggScoreChange = eggPoints;
                  scoreResult.bonuses.push({ name: egg.name, description: `+${eggPoints} pts${treasure ? ' (National Treasure)' : ''}` });
              }
              if (egg.reward.shuffle) newState.shuffleCount += egg.reward.shuffle;
              // Saved to the device's Bonus Collection straight away, so it survives an abandoned run.
              const firstFind = recordFound(egg.id);
              modalQueue.push({ type: 'easter-egg', title: egg.name, content: egg.reward.message, data: { ...egg, triggerScore, firstFind, collection: collectionProgress() } });
              trackMission({ type: 'secret', id: egg.id, firstFind, media: getBonusMedia(egg.id).media, isScore: !!egg.scorePattern });
              const eggIcon = egg.name.split(' ')[0];
              eventLogQueue.push({ type: 'event', id: `egg-${egg.id}`, name: egg.name, icon: eggIcon, description: explanation ? `${explanation} ${egg.reward.message}` : egg.reward.message, scoreChange: eggScoreChange, cumulativeScore: runningScore });
              if (egg.reward.effect) modalQueue.push(firePowerWord(egg, false));
          }
      }

      // Bean Counter Check
      if (newState.activeCharms.some(c => c.id === 'beanCounter')) {
          const oldMultiple = Math.floor(oldScore / 500);
          const newMultiple = Math.floor(runningScore / 500);
          if (newMultiple > oldMultiple) {
              const beanCounterBonus = (newMultiple - oldMultiple) * CHARM_BONUS.beanCounter;
              runningScore += beanCounterBonus;
              scoreResult.bonuses.push({ name: "Bean Counter", description: `+${beanCounterBonus} pts`});
              eventLogQueue.push({ type: 'event', id: `charm-beanCounter-${Date.now()}`, name: 'Bean Counter', icon: '🫘', description: `Total score hit a multiple of 500!`, scoreChange: beanCounterBonus, cumulativeScore: runningScore });
              showMessage(`🫘 Bean Counter! +${beanCounterBonus} points.`, 3000);
          }
      }

      // The Final Frontier: every 1,000 points earns a Challenge, up to a banked maximum.
      if (newState.activeCharms.some(c => c.id === 'finalFrontier')) {
          const earned = Math.floor(runningScore / 1000) - Math.floor(oldScore / 1000);
          const room = Math.max(0, CHARM_BONUS.maxBankedChallenges - Math.max(0, newState.challengeCount));
          const added = Math.min(earned, room);
          if (added > 0) {
              newState.challengeCount = Math.max(0, newState.challengeCount) + added;
              showMessage(`🧑‍🚀 Final Frontier! +${added} Challenge${added > 1 ? 's' : ''}.`, 3000);
              soundService.playMilestone();
          }
      }

      // --- 7. FINAL SCORE UPDATE ---
      newState.score = Math.round(runningScore);

      // --- Handle Coin Award ---
      const turnScore = newState.score - oldScore;
      
      // --- 8. OTHER STATE UPDATES ---
      
      newState.pianoManEncoreActive = newState.activeCharms.some(c => c.id === 'pianoManEncore') && scoreBeforeEncore >= CHARM_BONUS.pianoManAbove;

      // L Train Shuffle: a word with both L and T earns a free shuffle, up to a banked maximum.
      const lTrainCharm = newState.activeCharms.find(c => c.id === 'lTrainShuffle');
      if (lTrainCharm && /L/i.test(word) && /T/i.test(word) && newState.shuffleCount < CHARM_BONUS.maxBankedShuffles) {
          newState.shuffleCount += 1;
          eventLogQueue.push({ type: 'event', id: `charm-lTrain-${now}`, name: lTrainCharm.name, icon: '🚆', description: `L and T in "${word.toUpperCase()}": free shuffle.`, scoreChange: 0, cumulativeScore: runningScore });
          showMessage('🚆 L Train Shuffle! Free shuffle.', 2500);
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
      
      // The offer checks below update these in place: copy them first, so the previous turn
      // (kept for undo) and other runs never see the changes.
      newState.wordMilestoneProgress = { ...newState.wordMilestoneProgress };
      newState.offerHistory = [...newState.offerHistory];
      newState.itemStats = { ...newState.itemStats };
      newState.sessionOfferCounts = { ...newState.sessionOfferCounts };

      // PowerPlay Offer Check
      let newProgress = { ...newState.powerPlayProgress };
      newProgress.turnsSinceLastOffer++;

      // The PowerPlay meter fills from letters played (config/gameplay.ts).
      const meter = advancePowerPlayMeter(newProgress.letters ?? 0, word.length, levelFor(totalWordsSubmitted));
      newProgress.letters = meter.letters;

      const triggeredByMeter = meter.full;
      const triggeredByWordCount = totalWordsSubmitted > 0 && totalWordsSubmitted % GAMEPLAY.powerPlayEveryWords === 0;

      if (triggeredByMeter || triggeredByWordCount) {
          const canOffer = newState.powerPlayOffer.length === 0 &&
                           newProgress.turnsSinceLastOffer >= 4;

          if (canOffer) {
              const powerPlaysToOfferFrom = POWER_PLAYS_LIST.filter(pp => 
                  !newState.activeBuffs.some(ab => ab.id === pp.id) &&
                  !newState.availablePowerPlays.some(held => held.id === pp.id) &&
                  !(newState.oncePerRunTaken ?? []).includes(pp.id) &&
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
                      const stats = { ...(newState.itemStats[id] || { offered: 0, lastOfferedTurn: -1 }) };
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
                    ? `You played ${meterLettersFor(levelFor(totalWordsSubmitted))} letters and filled the PowerPlay meter!`
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
              !(c.id === 'goldenSnitch' && snitchTargetFor(newState.snitchCatches ?? 0) === null) &&
              !(c.id === 'gottaCatchEmAll' && newState.pokedexComplete) &&
              !newState.charmCooldowns[c.id]
          );
          const { offeredItems: offeredCharms, offerDetails } = gameUtils.getOffer(charmsToOfferFrom, 3, newState);

          if(offeredCharms.length > 0) {
            // Update state for weighting logic
            newState.offerHistory.push(offerDetails);
            newState.totalOffersMade++;
            offerDetails.forEach(offer => {
                const id = offer.id;
                const stats = { ...(newState.itemStats[id] || { offered: 0, lastOfferedTurn: -1 }) };
                stats.offered++;
                stats.lastOfferedTurn = totalWords + 1; // current turn
                newState.itemStats[id] = stats;
                newState.sessionOfferCounts[id] = (newState.sessionOfferCounts[id] || 0) + 1;
            });

            soundService.playModalOpen();
            modalQueue.push({ type: 'charm-selection', title: 'Charm Earned!', content: `You played ${newState.wordMilestoneProgress.nextUnlock} more words.`, data: offeredCharms });
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
          const replenishCount = refillCount(handTilesRemainingCount, handSizeFor(gameState));
          
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

      trackMission({ type: 'word', word, score: wordLogEntry.score, comboFilled, goldenStarted: newState.consecutiveValidWords + 1 >= newState.goldenRoundThreshold });

      // --- 9. GOLDEN ROUND TRIGGER LOGIC ---
      newState.consecutiveValidWords++;
      if (newState.consecutiveValidWords >= newState.goldenRoundThreshold) {
          soundService.playMilestone();
          
          newState.roundType = 'golden';
          newState = creditTime(newState, 'goldenRounds', 1);
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
      ['biglyScore', 'multiverseOfSadness', 'nuclearOption', 'schruteBucks', 'redWedding', 'wakandaForever', 'heisenberg', 'skywalkerBloodline', 'leafOnTheWind', 'thanosGift', 'doubleOrNothing', 'cassiesClue', 'cowabunga', 'holdOntoYourButts', 'tetrisTouch', 'blueShellSurprise', 'pinkyAndTheBrain', 'letsGetDangerous', 'slimShadyShuffle', 'spaceInvader', 'upsideDown'].forEach(id => { 
          if ((consumedPPs as any)[id]) { 
              delete (consumedPPs as any)[id]; 
              consumedBuffs = consumedBuffs.filter(b => b.id !== id); 
          }
      });

      if (consumedPPs.wordionaireCap) { delete consumedPPs.wordionaireCap; consumedBuffs = consumedBuffs.filter(b => b.instanceId !== 'wordionaire_cash'); }
      if (consumedPPs.wordionaireDouble) { delete consumedPPs.wordionaireDouble; consumedBuffs = consumedBuffs.filter(b => b.instanceId !== 'wordionaire_double'); }

      if (consumedPPs.sonicSpeed) { if (consumedPPs.sonicSpeed.count > 1) { consumedPPs.sonicSpeed = { ...consumedPPs.sonicSpeed, count: consumedPPs.sonicSpeed.count - 1 }; } else { delete consumedPPs.sonicSpeed; consumedBuffs = consumedBuffs.filter(b => b.id !== 'sonicSpeed'); }}
      
      WORD_COUNTDOWN_POWER_PLAYS.forEach(id => {
          const entry = (consumedPPs as any)[id];
          if (!entry) return;
          if (entry.words > 1) {
              (consumedPPs as any)[id] = { ...entry, words: entry.words - 1 };
              return;
          }
          delete (consumedPPs as any)[id];
          consumedBuffs = consumedBuffs.filter(b => b.id !== id);
          if (id === 'letterUpgrade' && entry.letter) {
              const { [entry.letter]: _gone, ...rest } = newState.letterMultipliers;
              newState.letterMultipliers = rest;
          }
          if (id === 'polish' && entry.letter) {
              const { [entry.letter]: _gone, ...rest } = newState.wordMultipliersByLetter;
              newState.wordMultipliersByLetter = rest;
          }
      });

      newState.activePowerPlays = consumedPPs;
      newState.activeBuffs = consumedBuffs;


      dispatch({ type: 'HANDLE_SUBMIT_SUCCESS', payload: { gameState: newState, hand: sanitizeHand(finalHand), tileBag: finalBag, modalQueue }});
      dispatch({ type: 'SET_IS_LOADING', payload: false });
      if (modalQueue.length === 0) {
          handleStartNextRound();
      }
  }, [gameState, hand, tileBag, applyMutation, showMessage, handleStartNextRound, onScoreUpdate, isChallengeLock, totalWords, powerWord, trackMission, time]);
  
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
        const replenishCount = refillCount(handTilesRemainingCount, handSizeFor(gameState));
        
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
            const isDouble = Math.random() < POWER_PLAY_VALUES.doubleOrNothingWinChance;
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
                showMessage('Invalid Word! Golden Snitch count reset.', 2000);
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
    
    /** Finds the longest playable word in the hand, highlights its tiles in order, and returns it ('' if none). */
    const revealBestWord = async (searching: string, found: (word: string) => string, none: string): Promise<string> => {
        dispatch({ type: 'SET_IS_LOADING', payload: true });
        dispatch({ type: 'SET_LOADING_MESSAGE', payload: searching });

        const availableTiles = (hand ?? []).filter((t): t is Tile => t !== null);
        const longestWord = await dictionaryService.findPlayableWord(availableTiles.map(t => t.letter), { minLength: 3, longest: true });
        const bestWord = longestWord ? longestWord.toUpperCase() : '';

        if (bestWord) {
            showMessage(found(bestWord), 4000);
            const tileIds = (assignTilesToWord(bestWord, availableTiles.map(t => t.letter)) ?? []).map(i => availableTiles[i].id);
            dispatch({ type: 'SET_HIGHLIGHTED_TILES', payload: { first: tileIds[0] ?? null, rest: tileIds.slice(1) } });
        } else {
            showMessage(none, 3000);
        }
        dispatch({ type: 'SET_IS_LOADING', payload: false });
        return bestWord;
    };

    // Wordionaire's Phone-a-Friend: the reducer has already spent the PowerPlay and closed the picker.
    const handlePhoneAFriend = async () => {
        const bestWord = await revealBestWord('Phoning a friend...', w => `📞 Your friend says: ${w}!`, '📞 Your friend is stumped. No words found!');
        const entry: EventLogEntry = {
            type: 'event', id: `pp-wordionaire-phone-${Date.now()}`, name: 'Wordionaire: Phone-a-Friend',
            description: bestWord ? `Your friend suggested: ${bestWord}` : 'Your friend was stumped.', icon: '📞',
            scoreChange: 0, cumulativeScore: gameState.score,
        };
        dispatch({ type: 'UPDATE_GAME_STATE', payload: { log: [...gameState.log, entry] } });
    };

    const handleCarmenSandiegoActivation = async () => {
        const bestWord = await revealBestWord('Searching the globe for clues...', w => `A clue was found: ${w}!`, 'The trail went cold. No words found!');

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
    };

    const handleActivatePowerPlay = (powerPlay: PowerPlay) => {
        const cantActClear = powerPlay.id === 'actClear' && (time <= POWER_PLAY_VALUES.actClearKeepSeconds || gameState.roundType === 'golden');
        if (!(powerPlay.id === 'buyAVowel' && gameState.score < POWER_PLAY_VALUES.buyAVowelCost) && !cantActClear) {
            trackMission({ type: 'powerplay', id: powerPlay.id, subtheme: powerPlay.subtheme });
        }
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
            const points = POWER_PLAY_VALUES.gumpLuckPoints;
    
            if (rand < 0.25) { // bonus seconds
                timeChange = bonusTime(TIME_BONUS.rescue, time, runLevel(gameState));
                outcomeMessage = `Life is like a box of chocolates... you got ${timeChange} extra seconds!`;
            } else if (rand < 0.5) { // points
                changes.score = gameState.score + points;
                outcomeMessage = `Life is like a box of chocolates... you got a ${points} point bonus!`;
            } else if (rand < 0.75) { // +1 shuffle
                changes.shuffleCount = gameState.shuffleCount + 1;
                outcomeMessage = "Life is like a box of chocolates... you got an extra shuffle!";
            } else { // a dud
                outcomeMessage = "Life is like a box of chocolates... this one was empty. Stupid is as stupid does.";
            }
    
            const scoreChange = changes.score ? points : 0;
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
            
            showMessage(outcomeMessage, 3000);
            return;
        }

        if (powerPlay.id === 'happyPlace') {
            soundService.playPowerUp();
            const newLogEntry: EventLogEntry = {
                type: 'event', id: `pp-${powerPlay.id}-${Date.now()}`, name: powerPlay.name,
                description: `Time bank refilled to ${bankMax(gameState)} seconds.`, icon: '⛳',
                scoreChange: 0, cumulativeScore: gameState.score
            };
            dispatch({ type: 'SET_TIME', payload: Math.max(time, bankMax(gameState)) });
            dispatch({
                type: 'UPDATE_GAME_STATE',
                payload: {
                    log: [...gameState.log, newLogEntry],
                    availablePowerPlays: gameState.availablePowerPlays.filter(p => p.id !== powerPlay.id),
                    powerPlayUses: { ...gameState.powerPlayUses, [powerPlay.id]: (gameState.powerPlayUses[powerPlay.id] || 0) + 1 }
                }
            });
            showMessage(`⛳ Happy Place! Clock refilled to ${bankMax(gameState)} seconds.`, 2500);
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
                description: 'Traded 500 points for 1 Credit.', icon: '🪙',
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
            showMessage("Scrooge Swipe! +1 Credit, -500 points.", 2500);
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
        const held = gameState.availablePowerPlays[0];
        if (held && held.id !== powerPlay.id) trackMission({ type: 'powerplaySwap' });
        // Instant PowerPlays are used the moment they're picked.
        if (INSTANT_POWER_PLAY_IDS.has(powerPlay.id)) trackMission({ type: 'powerplay', id: powerPlay.id, subtheme: powerPlay.subtheme });
        dispatch({ type: 'CHOOSE_POWER_PLAY', payload: { powerPlay, allOffered } });
        handleCloseModal();
    };

    const handleChooseCharm = (charm: Charm, allOffered: Charm[], replaceId?: string) => {
        soundService.playUIClick();
        const alreadyOn = gameState.activeCharms.some(c => c.id === charm.id);
        const equippedCount = Math.min(CHARM_SLOTS, gameState.activeCharms.length + (replaceId || alreadyOn ? 0 : 1));
        trackMission({ type: 'charm', equippedCount, swapped: !!replaceId });
        dispatch({ type: 'CHOOSE_CHARM', payload: { charm, hand: hand ?? [], allOffered, replaceId } });
        handleCloseModal();
    };

    const handlePassCharm = (allOffered: Charm[]) => {
        soundService.playUIClick();
        dispatch({ type: 'PASS_CHARM', payload: { allOffered } });
        handleCloseModal();
    };

    const handleKeepPowerPlay = (allOffered: PowerPlay[]) => {
        soundService.playUIClick();
        dispatch({ type: 'KEEP_POWER_PLAY', payload: { allOffered } });
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
        tileForSelection: state.tileForSelection,
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
        handlePhoneAFriend,
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
        handlePassCharm,
        handleKeepPowerPlay,
        handleAddTileToSwap,
        handleRemoveTileFromSwap,
        handleExecuteSwap,
        dispatch,
    };

    return <GameScreenView {...viewProps} />;
};
