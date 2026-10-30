
export type DurationTag = 'PERSISTENT' | 'ONE_TIME' | 'LIMITED';


export interface Tile {
  id: string;
  letter: string;
  points: number;
  isCombo?: boolean;
  multiplier?: number; // For charms/powerplays like 'Letter Upgrade'
  tempPoints?: number; // For charms like 'One Tile to Rule Them All'
  /** The power-up that set tempPoints (e.g. "Captain Planet"); shown in the score breakdown. */
  tempPointsSource?: string;
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
  /** Too strong to repeat: once taken from an offer, it isn't offered again this run. */
  oncePerRun?: boolean;
  /** For selectionType 'letter': only these letters can be picked (e.g. 'AEIOU'). */
  selectionLetters?: string;
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
    effect?: PowerWordEffect;
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
  /** Power words: an effect on the next round (config/gameplay.ts POWER_WORD_EFFECTS). Can fire again once per level. */
  effect?: PowerWordEffect;
}

/** What a power word does when spelled. */
export type PowerWordEffect = 'slot' | 'freeze' | 'heal' | 'slow' | 'twin';

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


/** Seconds a run added to its time bank, by source, plus how many Golden Rounds paused the bank. */
export interface TimeLedger {
  words: number;
  powerUps: number;
  shuffles: number;
  goldenRounds: number;
}

/** A boss round in progress: which boss, which boss level of the run (1st, 2nd...), and progress. */
export interface BossRound {
  id: string;
  number: number;
  wordsLeft: number;
  hits: number;
}

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
  /** Once-per-run PowerPlays already taken this run (swapping one away unused frees it again). */
  oncePerRunTaken?: string[];
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
  /** Golden Snitch catches this run; it flies away after the last one. */
  snitchCatches?: number;
  /** Identifies this run (kept in saves) for "in one run" daily missions. */
  runId?: string;
  /** Mixtape charm: the letter the next word must start with, and how many links so far. */
  mixtapeChain?: { next: string; links: number } | null;
  /** Gotta Catch 'Em All: vowels caught so far, and whether all five were caught this run. */
  pokedexVowels?: string;
  pokedexComplete?: boolean;
  /** Survivor charm: words left that earn its bonus after a strike. */
  survivorWords?: number;
  /** We Were on a Break!: a shuffle happened, so the next valid word scores extra. */
  breakReady?: boolean;
  /** I'm Ready!: the last level whose first word already paid out. */
  readyLevel?: number;
  /** The boss round in progress, if any (data/bosses.ts). */
  boss?: BossRound | null;
  /** Bosses faced this run, so a run doesn't repeat one until the pool runs out. */
  bossesFaced?: string[];
  /** Power words: the level each one last fired at (they can fire again once per level). */
  powerWordLevels?: Record<string, number>;
  /** ❄️ Seconds the clock stays frozen at the start of the next round. */
  freezeLeft?: number;
  /** 🦥 Words left with the clock at half speed. */
  slowWords?: number;
  /** Bosses beaten (6 hits) this run, for the run's stats. */
  bossesBeaten?: number;
  /** Boss Badge seconds waiting for the next round (they skip the per-level shrink). */
  pendingBadgeTime?: number;
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
  /** Where this run's time came from, for the Game Over recap. */
  timeLedger?: TimeLedger;
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
  /** Equipped badge and title (cosmetic ids) and daily streak when the score was posted. */
  badge?: string | null;
  title?: string | null;
  streak?: number;
  /** Boss Badges collected, when the score was posted. */
  bosses?: number;
  /** The player's ID card stats when the score was posted (missing on older scores). */
  card?: IdCardStats;
}

/** The stats on a player's ID card (services/career.ts). Sent with each score as a snapshot. */
export interface IdCardStats {
  /** Finished runs. */
  runs: number;
  /** Best score in one run. */
  best: number;
  /** Average score per finished run. */
  avg: number;
  /** Furthest level reached. */
  level: number;
  /** Highest-scoring word and its score ('' and 0 until there is one). */
  word: string;
  wordScore: number;
  /** Longest word played. */
  longest: string;
  /** Secret bonuses found. */
  secrets: number;
}

/** Player bling sent with a score. */
export interface PlayerFlair {
  badge: string | null;
  title: string | null;
  streak: number;
  /** Boss Badges collected (different bosses beaten, ever). */
  bosses?: number;
  /** ID card stats at the time of posting. */
  card?: IdCardStats;
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
  timeLedger?: TimeLedger;
  saveTimestamp?: string;
  isPinned?: boolean;
  isViewed?: boolean;
}

export interface Pack {
  id: string;
  name: string;
  description: string;
  cost: number;
  /** Earned by reaching this streak length instead of bought. */
  streakDay?: number;
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
