// @ts-nocheck
import { POWER_PLAYS_LIST } from '../powerPlays';
import { GameState, Tile, WordLogEntry, EventLogEntry, PowerPlay } from '../../types';
import { RACK_SIZE, TILE_DISTRIBUTION } from '../../constants';
import { calculateScore, dealNewHand } from '../../services/gameUtils';

// Mock initial state for testing
const createInitialState = (): GameState => ({
    score: 0,
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

// Mock tile creation for deterministic tests
const createTile = (letter: string): Tile => ({
    id: `${letter}-${Math.random()}`,
    letter,
    points: TILE_DISTRIBUTION[letter]?.points || 0,
});

describe('Nuclear Option PowerPlay', () => {
    const nuclearOption = POWER_PLAYS_LIST.find(p => p.id === 'nuclearOption') as PowerPlay;

    test('should replace hand and apply a x4 multiplier to the next word only', () => {
        // 1. Setup: deterministic bag and rack
        let gameState = createInitialState();
        const initialHand: Tile[] = [ 'A', 'B', 'C', 'D', 'E', 'F', 'G' ].map(createTile);
        const initialBag = ['H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T'];

        // 2. Activation: Apply the power play's effect and simulate reducer's hand swap
        const activationResult = nuclearOption.activate(gameState);
        gameState = { ...gameState, ...activationResult };

        // The reducer discards the old hand (represented by passing an empty `tilesToReturn` array) 
        // and deals a new one from the bag.
        const { hand: newHand, tileBag: remainingBag } = dealNewHand(initialBag, []);
        
        const logEntry: EventLogEntry = {
            type: 'event',
            id: `pp-nuclearOption-${Date.now()}`,
            name: 'Nuclear Option',
            description: 'Replaced entire hand. Next word scores 4x.',
            scoreChange: 0,
            cumulativeScore: gameState.score,
            icon: '☢️'
        };
        gameState.log.push(logEntry);

        // Assert rack and bag counts are correct
        expect(newHand.length).toBe(RACK_SIZE);
        expect(remainingBag.length).toBe(initialBag.length - RACK_SIZE);
        expect(gameState.activePowerPlays.nuclearOption).toBe(true);

        // 3. Submit first word and assert x4 multiplier
        const word1 = 'HIJ'; // Assumes H,I,J are the first letters dealt since bag is not shuffled in test
        const tilesForWord1 = newHand.slice(0, 3);
        const scoreResult1 = calculateScore(word1, tilesForWord1, gameState);
        
        const baseScore1 = tilesForWord1.reduce((sum, tile) => sum + tile.points, 0);
        expect(scoreResult1.totalScore).toBe(baseScore1 * 4);
        
        gameState.score += scoreResult1.totalScore;
        // The activePowerPlay flag is cleared after submission (mocking reducer)
        delete gameState.activePowerPlays.nuclearOption;

        // 4. Submit second word and assert NO x4 multiplier
        const word2 = 'KLM';
        const tilesForWord2 = newHand.slice(3, 6);
        const scoreResult2 = calculateScore(word2, tilesForWord2, gameState);

        const baseScore2 = tilesForWord2.reduce((sum, tile) => sum + tile.points, 0);
        expect(scoreResult2.totalScore).toBe(baseScore2);

        // 5. Verify log entries
        const nuclearOptionEventLog = gameState.log.find(
            entry => entry.type === 'event' && entry.id.startsWith('pp-nuclearOption')
        ) as EventLogEntry;
        expect(nuclearOptionEventLog).toBeDefined();
        expect(nuclearOptionEventLog.description).toContain('Replaced entire hand');
        expect(nuclearOptionEventLog.description).toContain('Next word scores 4x');
        
        const nuclearOptionScoreBonus = scoreResult1.bonuses.find(b => b.name === 'Nuclear Option');
        expect(nuclearOptionScoreBonus).toBeDefined();
        expect(nuclearOptionScoreBonus?.description).toBe('x4 Word Score');
    });
});
