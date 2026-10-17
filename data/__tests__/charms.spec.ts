// @ts-nocheck
import { CHARMS_LIST } from '../charms';
import { GameState, Charm, EventLogEntry } from '../../types';

// Mock initial state for testing
const createInitialState = (): GameState => ({
    score: 100,
    log: [],
    longestWord: '',
    foundEasterEggs: [],
    gameConfig: { timerDuration: 60, minWordLength: 3 },
    strikes: 0,
    shuffleCount: 3,
    challengeCount: 2,
    challengeActive: false,
    wordMilestoneProgress: { count: 0, nextUnlock: 10 },
    powerPlayProgress: { targetDigit: null, streak: 0, turnsSinceLastOffer: 4 },
    powerSurgeProgress: 0,
    activeCharms: [],
    availablePowerPlays: [],
    unlockedMilestoneIds: [],
    unlockedWordBonusIds: [],
    charmUses: {},
    powerPlayUses: {},
    activePowerPlays: {},
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
    flawlessScore: 0,
    pianoManEncoreActive: false,
    glitchActive: false,
    wordsThisRound: 0,
    lastSubmissionTime: 0,
    consecutiveSuccesses: 0,
    longestStreak: 0,
    multiverseTimeBonus: 0,
    duckHuntComboState: { streakLetters: null, streakCount: 0 },
    drMarioCureStreak: 0,
    powerStarResidualActive: false,
    warioTimeDebt: 0,
    powerWordUsed: false,
    roundType: 'normal',
    consecutiveValidWords: 0,
    goldenRoundThreshold: 11,
    goldenTileId: null,
});

describe('One Tile to Rule Them All Charm', () => {
    const oneTileCharm = CHARMS_LIST.find(c => c.id === 'oneTileToRuleThemAll') as Charm;

    test('should add an event log entry upon activation', () => {
        // 1. Setup
        const gameState = createInitialState();
        expect(gameState.log.length).toBe(0);

        // 2. Activation
        const stateChanges = oneTileCharm.activate(gameState);
        const newGameState = { ...gameState, ...stateChanges };

        // 3. Assertions
        expect(newGameState.log.length).toBe(1);
        
        const logEntry = newGameState.log[0] as EventLogEntry;
        expect(logEntry.type).toBe('event');
        expect(logEntry.name).toBe('One Tile to Rule Them All');
        expect(logEntry.description).toBe('A random tile in your hand is now worth 25 points for one use.');
        expect(logEntry.icon).toBe('👑');
        expect(logEntry.scoreChange).toBe(0);
        expect(logEntry.cumulativeScore).toBe(100);
    });
});
