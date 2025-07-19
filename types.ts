

export interface Tile {
  id: string;
  letter: string;
  points: number;
  multiplier?: number; // For charms/powerplays like 'Letter Upgrade'
  tempPoints?: number; // For charms like 'One Tile to Rule Them All'
  isDuplicate?: boolean; // For Hookshot powerplay
  isSuper?: boolean; // For Mutation Protocol
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
  maxUses?: number;
  effectType?: 'passive' | 'selection' | 'triggered' | 'immediate';
  selectionType?: 'tile_transform';
  activate: (gameState: GameState, options?: any) => Partial<GameState>;
}


export interface PowerPlay {
  id: string;
  instanceId?: string;
  name: string;
  description: string;
  flavorText: string;
  icon: string;
  effectType: 'immediate' | 'passive' | 'next_word' | 'selection';
  selectionType?: 'letter' | 'tile_swap' | 'custom';
  swapConfig?: { min: number, max: number };
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
  reward: {
    points?: number;
    shuffle?: number;
    message: string;
  };
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

export interface GameState {
  score: number;
  words: WordData[];
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
    targetDigit: number | null;
    streak: number;
    turnsSinceLastOffer: number;
    cooldown: number;
  };

  powerSurgeProgress: number;

  activeCharms: Charm[];
  availablePowerPlays: PowerPlay[];
  unlockedMilestoneIds: string[];
  unlockedWordBonusIds: string[];
  
  // Charm and PowerPlay states
  charmUses: { [charmId: string]: number };
  activePowerPlays: { [powerPlayId: string]: any }; // To store temporary effects
  powerPlayToActivate: PowerPlay | null;
  availableCharms: Charm[];
  charmToActivate: Charm | null;
  powerPlayOffer: PowerPlay[];
  lastPowerPlayResult?: { message: string; scoreChange: number; } | null;
  highestScoringWord: WordData | null;
  activeBuffs: (Charm | PowerPlay)[];

  letterMultipliers: { [letter: string]: number };
  wordMultipliersByLetter: { [letter: string]: number };

  // Specific Charm States
  flawlessScore: number;
  pianoManEncoreActive: boolean;
  glitchActive: boolean;
  wordsThisRound: number;
  lastSubmissionTime: number; 
  consecutiveSuccesses: number;
  multiverseTimeBonus: number;
}

export interface LeaderboardEntry {
  name: string;
  score: number;
  rank: number;
  date: string;
}

export interface ScoreBonusInfo {
  name: string;
  description: string;
}

export interface ScoreCalculationResult {
  totalScore: number;
  baseScore: number;
  bonuses: ScoreBonusInfo[];
}