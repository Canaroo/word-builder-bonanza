
import { LetterValues, GameConfig, Charm, BrainstormAction, Milestone, GameState } from './types';

export const INITIAL_LETTER_VALUES: LetterValues = {
  'A': 1, 'B': 3, 'C': 3, 'D': 2, 'E': 1, 'F': 4, 'G': 2, 'H': 4, 'I': 1, 'J': 8, 'K': 5,
  'L': 1, 'M': 3, 'N': 1, 'O': 1, 'P': 3, 'Q': 10, 'R': 1, 'S': 1, 'T': 1, 'U': 1, 'V': 4,
  'W': 4, 'X': 8, 'Y': 4, 'Z': 10
};

export const LETTER_FREQUENCIES = "AAAAAAAAABBCCDDDDEEEEEEEEEEEEFFGGGHHIIIIIIIIIJKLLLLMMNNNNNNOOOOOOOOPPQRRRRRRSSSSTTTTTTUUUUVVWWXYYZ";
export const VOWELS = "AEIOU";

export const DEFAULT_GAME_CONFIG: GameConfig = {
  TILE_COUNT: 10,
  WORD_SLOTS_COUNT: 8,
  MAX_STRIKES: 3,
  ROUND_TIME_SECONDS: 60,
  DOUBLE_SCORE_CHANCE: 0.15,
  REPLENISH_DIVISOR: 2,
  INITIAL_HINTS: 3,
  INITIAL_SHUFFLES: 3,
  POINTS_FOR_BRAINSTORM: 50,
  WORDS_FOR_CHARM: 3,
};

export const AVAILABLE_CHARMS: Charm[] = [
  {
    id: 's-tier',
    name: 'S-Tier Scorer',
    description: "All 'S' tiles are worth 10 points and double the word multiplier!",
    apply: (gs) => {
      // Logic applied during word scoring in useGameLogic / handleSubmitWord
      return gs;
    }
  },
  {
    id: 'finisher',
    name: 'Finisher',
    description: "The last letter of a word is worth 3x its value.",
    apply: (gs) => { 
      // Logic applied during word scoring
      return gs;
    }
  },
  {
    id: 'recycler',
    name: 'Recycler',
    description: "50% chance to keep a 2x score tile after using it.",
    apply: (gs) => {
      // Logic applied during word processing
      return gs;
    }
  },
  {
    id: 'vowel-lover',
    name: 'Vowel Lover',
    description: "Vowels (A,E,I,O,U) are worth +2 points each.",
    apply: (gs) => {
      const newLetterValues = { ...gs.letterValues };
      VOWELS.split('').forEach(vowel => {
        // Ensure base value exists, add 2 to it. If Vowel Lover is applied multiple times, it shouldn't stack infinitely from the modified value.
        newLetterValues[vowel] = (INITIAL_LETTER_VALUES[vowel] || 1) + 2;
      });
      return { ...gs, letterValues: newLetterValues };
    }
  },
];

export const AVAILABLE_BRAINSTORM_ACTIONS: BrainstormAction[] = [
  {
    id: 'upgrade',
    name: 'Letter Upgrade',
    description: "Choose a letter tile from your hand. All tiles of that letter type are worth 3x points for this game!",
    needsInteraction: true,
  },
  {
    id: 'vowel-infusion',
    name: 'Vowel Infusion',
    description: "Replace all consonant tiles in your hand, except for up to two, with new random vowel tiles.",
    needsInteraction: false,
  },
  {
    id: 'polish',
    name: 'Polish',
    description: "Choose one tile in your hand. For the rest of the game, every tile with that letter will act as a 2x Word Score multiplier.",
    needsInteraction: true,
  },
  {
    id: 'time-pause', // ID remains 'time-pause' for less refactoring
    name: 'Pause',
    description: "Completely stop the timer for 15 seconds.",
    needsInteraction: false,
  }
];

export const SPECIAL_SLOT_INDEX = 4; // 5th slot is 0-indexed 4

export const MILESTONES_LIST: Milestone[] = [
  { 
    id: 'hand_expansion_100', 
    name: 'Hand Expansion!', 
    description: 'Your maximum hand size permanently increases from 10 to 11 tiles.', 
    scoreThreshold: 100, 
    apply: (gs: GameState): GameState => ({ ...gs, gameConfig: { ...gs.gameConfig, TILE_COUNT: 11 } }) 
  },
  { 
    id: 'better_odds_250', 
    name: 'Better Odds!', 
    description: 'The chance of new tiles being "2x Word Score" tiles permanently increases by 10%.', 
    scoreThreshold: 250, 
    apply: (gs: GameState): GameState => ({ ...gs, gameConfig: { ...gs.gameConfig, DOUBLE_SCORE_CHANCE: Math.min(gs.gameConfig.DOUBLE_SCORE_CHANCE + 0.1, 0.75) } }) // Cap at 75%
  },
  { 
    id: 'bonus_shuffle_500', 
    name: 'Bonus Shuffle!', 
    description: 'You gain 1 extra Shuffle.', 
    scoreThreshold: 500, 
    apply: (gs: GameState): GameState => ({ ...gs, shufflesLeft: gs.shufflesLeft + 1 }) 
  },
];