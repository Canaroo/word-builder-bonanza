
export interface TileData {
  id: string;
  letter: string;
  value: number;
  isDouble: boolean;
  isRecycled?: boolean;
}

export type WordSlot = TileData | null;

export interface Charm {
  id: string;
  name: string;
  description: string;
  apply: (gameState: GameState) => GameState; // Function to apply charm effect
  selected?: boolean; // For UI indication if needed
}

export interface BrainstormAction {
  id: string;
  name: string;
  description: string;
  needsInteraction: boolean; // Does it require user input (e.g., choosing a tile)
  cost?: number; // Optional: if brainstorms have a cost (e.g., score)
  activate?: (gameState: GameState, selectedTile?: TileData) => GameState; // Function to activate brainstorm effect
}

export interface LetterValues {
  [key: string]: number;
}

export interface GameConfig {
  TILE_COUNT: number;
  WORD_SLOTS_COUNT: number;
  MAX_STRIKES: number;
  ROUND_TIME_SECONDS: number;
  DOUBLE_SCORE_CHANCE: number;
  REPLENISH_DIVISOR: number;
  INITIAL_HINTS: number;
  INITIAL_SHUFFLES: number;
  POINTS_FOR_BRAINSTORM: number;
  WORDS_FOR_CHARM: number;
}
export interface GameState {
  score: number;
  shufflesLeft: number;
  strikes: number;
  hintsLeft: number;
  playerHand: TileData[];
  wordSlots: WordSlot[];
  playerName: string;
  bestWord: string;
  selectedTileId: string | null;
  timeLeft: number; // in seconds
  wordsSubmitted: number; // Total words submitted in the game
  activeCharms: Charm[];
  hasBrainstormCharge: boolean; // True if player earned a brainstorm charge but hasn't picked one yet
  heldBrainstorm: BrainstormAction | null; // The specific brainstorm action chosen by the player
  milestonesAchieved: string[]; // e.g., ['score_100', 'word_5_letters']
  letterValues: LetterValues;
  gameConfig: GameConfig;
  isTimerActive: boolean;
  currentMessage: { text: string; type: MessageType; definition?: string } | null;
  polishedLetters: string[]; // For "Polish" brainstorm
  anticipatedScore: number; // For live score preview
  wordsSubmittedSinceLastCharm: number; // Tracks words for charm offering
  nextCharmOfferThreshold: number; // Threshold for next charm offer
}

export enum GameScreenState {
  START,
  PLAYING,
  GAME_OVER,
}

export enum MessageType {
  INFO = 'info',
  SUCCESS = 'success',
  ERROR = 'error',
  LOADING = 'loading',
}

export interface DictionaryEntry {
  word: string;
  phonetic?: string;
  phonetics?: { text?: string; audio?: string }[];
  origin?: string;
  meanings: {
    partOfSpeech: string;
    definitions: {
      definition: string;
      example?: string;
      synonyms?: string[];
      antonyms?: string[];
    }[];
  }[];
}

// For grounding metadata from Gemini Search
export interface GroundingChunkWeb {
  uri: string;
  title: string;
}
export interface GroundingChunk {
  web?: GroundingChunkWeb;
  // other types of chunks could be defined here
}
export interface GroundingMetadata {
  groundingChunks?: GroundingChunk[];
  // other grounding metadata fields
}

export interface Milestone {
  id: string;
  name: string;
  description: string;
  scoreThreshold: number;
  apply: (gameState: GameState) => GameState;
}