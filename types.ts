
export type DurationTag = 'PERSISTENT' | 'ONE_TIME' | 'LIMITED';


export interface Tile {
  id: string;
  letter: string;
  points: number;
  isCombo?: boolean;
  multiplier?: number; // For charms/powerplays like 'Letter Upgrade'
  tempPoints?: number; // For charms like 'One Tile to Rule Them All'
  isDuplicate?: boolean; // For Hookshot powerplay
  isSuper?: boolean; // For Mutation Protocol
  isLocked?: boolean; // For Rescue Drop powerplay
}

export interface GameConfig {
  timerDuration: number;
  minWordLength: number;
}

export interface Charm {
  id:string;
  instanceId?: string;
  name:string;
  description:string;
  flavorText:string;
  icon:string;
  subtheme: 'score' | 'tile' | 'game' | 'utility';
  maxUses?: number;
  effectType?: 'passive' | 'selection' | 'triggered' | 'immediate';
  selectionType?: 'tile_transform';
  durationTag: DurationTag;
  activate: (gameState: GameState, options?: any) => Partial<GameState>;
}


export interface PowerPlay {
  id: string;
  instanceId?: string;
  name: string;
  description: string;
  flavorText: string;
  icon: string;
  subtheme: 'score' | 'timer' | 'rack' | 'strike' | 'utility';
  effectType: 'immediate' | 'passive' | 'next_word' | 'selection';
  selectionType?: 'letter' | 'tile_swap' | 'custom' | 'tile_transform';
  swapConfig?: { min: number, max: number };
  maxUses?: number;
  durationTag: DurationTag;
  activate: (gameState: GameState, options?: any) => Partial<GameState>;
}


export interface Milestone {
  id: string;
  name: string;
  icon: string;
  scoreThreshold: number;
  reward: {
    points?: number;
  };
  configChange?: Partial<GameConfig>;
  flavorText: string;
}

export interface EasterEgg {
  id: string;
  name: string;
  description: string;
  trigger: (word: string, score: number, gameState: GameState) => boolean;
  /** For score-number bonuses: the pattern the score must match (also used to explain the bonus). */
  scorePattern?: import('./services/scoreBonus').ScorePattern;
  /** For word bonuses: the trigger word, uppercase. */
  word?: string;
  reward: {
    points?: number;
    shuffle?: number;
    message: string;
  };
}

/** One entry in data/secretBonuses.ts. See the comment at the top of that file. */
export interface SecretBonus {
  id: string;
  word?: string;
  score?: import('./services/scoreBonus').ScorePattern;
  name: string;
  description: string;
  points?: number;
  shuffle?: number;
  message: string;
  /** Clue shown in the Collection before the bonus is found. */
  hint?: string;
  media?: 'vhs' | 'cartridge' | 'cd' | 'arcade';
  source?: string;
}

export interface WordBonus {
    id: string;
    title: string;
    description: string;
    wordCount: number;
    reward: {
        points: number;
    };
}

export interface WordData {
  word: string;
  score: number;
  baseScore?: number;
  bonuses?: ScoreBonusInfo[];
  cumulativeScore?: number;
  definition?: string;
  status: 'valid' | 'invalid';
}

export type EventLogEntry = {
  type: 'event';
  id: string; // e.g., milestone.id or easter_egg.id
  name: string;
  description: string;
  scoreChange: number;
  cumulativeScore: number;
  icon: string;
};

export type WordLogEntry = WordData & {
  type: 'word';
};

export interface GameOverLogEntry {
  type: 'game_over';
  id: string;
  reason: 'time' | 'strikes';
  finalHand: string[];
  activeBuffs: { name: string; icon: string; }[];
  cumulativeScore: number;
}

export type LogEntry = WordLogEntry | EventLogEntry | GameOverLogEntry;


export interface GameState {
  score: number;
  log: LogEntry[];
  longestWord: string;
  foundEasterEggs: EasterEgg[];
  gameConfig: GameConfig;
  strikes: number;
  shuffleCount: number;
  challengeCount: number;
  challengeActive: boolean;
  
  wordMilestoneProgress: {
    count: number;
    nextUnlock: number;
  };
  
  powerPlayProgress: {
    /** Legacy score-digit streak; no longer drives offers. */
    targetDigit: number | null;
    streak: number;
    turnsSinceLastOffer: number;
    /** Letters played toward the PowerPlay meter (config/gameplay.ts). */
    letters?: number;
  };
  /** Valid words in a row toward winning back a strike. */

  powerSurgeProgress: number;

  activeCharms: Charm[];
  availablePowerPlays: PowerPlay[];
  unlockedMilestoneIds: string[];
  unlockedWordBonusIds: string[];
  
  // Charm and PowerPlay states
  charmUses: { [charmId: string]: number };
  powerPlayUses: { [powerPlayId: string]: number };
  activePowerPlays: { 
    [powerPlayId: string]: any;
  };
  powerPlayToActivate: PowerPlay | null;
  availableCharms: Charm[];
  charmToActivate: Charm | null;
  powerPlayOffer: PowerPlay[];
  lastPowerPlayResult?: { message: string; scoreChange: number; } | null;
  highestScoringWord: WordData | null;
  activeBuffs: (Charm | PowerPlay)[];

  powerPlayCooldowns: { [id: string]: number };
  charmCooldowns: { [id: string]: number };

  letterMultipliers: { [letter: string]: number };
  wordMultipliersByLetter: { [letter: string]: number };

  // Specific Charm/PowerPlay States
  flawlessScore: number;
  pianoManEncoreActive: boolean;
  glitchActive: boolean;
  wordsThisRound: number;
  lastSubmissionTime: number; 
  consecutiveSuccesses: number;
  longestStreak: number;
  multiverseTimeBonus: number;
  duckHuntComboState: { streakLetters: Set<string> | null, streakCount: number };
  drMarioCureStreak: number;
  powerStarResidualActive: boolean;
  warioTimeDebt: number;
  /** Seconds Ludicrous Speed takes off the clock at the start of the next round. */
  ludicrousTimeCost?: number;
  /** Seconds the last valid word earns for the time bank, added when the next round starts. */
  pendingTimeBonus?: number;
  /** The time bank, set aside while a Golden Round runs on its own clock. */
  bankedTime?: number | null;
  powerWordUsed?: boolean;
  perfectChainProgress: number;
  groundhogDayCharges: number;

  // Golden Round State
  roundType: 'normal' | 'golden';
  consecutiveValidWords: number;
  goldenRoundThreshold: number;
  goldenTileId?: string | null;

  // New state for weighted item selection
  runSeed: number;
  offerHistory: { id: string; score: number }[][];
  itemStats: { [id: string]: { offered: number; lastOfferedTurn: number; } };
  sessionOfferCounts: { [id: string]: number };
  totalOffersMade: number;
}

export interface LeaderboardEntry {
  id?: string;
  name: string;
  score: number;
  rank?: number;
  date: string;
}

export interface ScoreBonusInfo {
  name: string;
  description: string;
  source?: 'tile' | 'word' | 'game';
}

export interface ScoreCalculationResult {
  totalScore: number;
  baseScore: number;
  bonuses: ScoreBonusInfo[];
  /** Word score after tile modifiers, before word multipliers; later multipliers add to this. */
  scoreBeforeMultiplier?: number;
  /** Combined word multiplier applied to scoreBeforeMultiplier. */
  wordMultiplier?: number;
  /** A cap (Schrute Bucks, Wordionaire) fixed the score; later bonuses must not change it. */
  capped?: boolean;
}

export interface FinalGameState {
  score: number;
  log: LogEntry[];
  longestWord: string;
  foundEasterEggs: EasterEgg[];
  activeCharms: Charm[];
  unlockedWordBonusIds: string[];
  activeBuffs: (Charm | PowerPlay)[];
  highestScoringWord: WordData | null;
  longestStreak: number;
  saveTimestamp?: string;
  isPinned?: boolean;
  isViewed?: boolean;
}

export interface Pack {
  id: string;
  name: string;
  description: string;
  cost: number;
  tileClass: string;
  themeClass: string;
  frameClass: string;
  previewClass: string;
}

export interface MissedWord {
  word: string;
  definition: string;
  timestamp: number;
}

export interface PowerWordData {
  powerWord: string;
  definition: string;
  spinTimestamp: number;
}
