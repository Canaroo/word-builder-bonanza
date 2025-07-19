
export const INITIAL_TIME = 60;
export const MAX_STRIKES_INITIAL = 3;
export const RACK_SIZE = 10;
export const BASE_RACK_SIZE = 5; // Target hand size for refills
export const INVALID_WORD_PENALTY_SECONDS = 5; // Kept for reference, though strikes are now the main penalty
export const SUPER_HAND_BONUS = 50;

// New Tile Mechanics Constants
export const REPLENISH_DIVISOR = 2;
export const BALANCE_REPLACE_COUNT = 3;
export const VOWELS = new Set(['A', 'E', 'I', 'O', 'U']);

// Gameplay Progression Constants
export const INITIAL_SHUFFLES = 3;
export const INITIAL_CHALLENGES = 2;

// Scrabble Tile Distribution and Points
export const TILE_DISTRIBUTION: { [key: string]: { count: number; points: number } } = {
  A: { count: 9, points: 1 }, B: { count: 2, points: 3 }, C: { count: 2, points: 3 },
  D: { count: 4, points: 2 }, E: { count: 12, points: 1 }, F: { count: 2, points: 4 },
  G: { count: 3, points: 2 }, H: { count: 2, points: 4 }, I: { count: 9, points: 1 },
  J: { count: 1, points: 8 }, K: { count: 1, points: 5 }, L: { count: 4, points: 1 },
  M: { count: 2, points: 3 }, N: { count: 6, points: 1 }, O: { count: 8, points: 1 },
  P: { count: 2, points: 3 }, Q: { count: 1, points: 10 }, R: { count: 6, points: 1 },
  S: { count: 4, points: 1 }, T: { count: 6, points: 1 }, U: { count: 4, points: 1 },
  V: { count: 2, points: 4 }, W: { count: 2, points: 4 }, X: { count: 1, points: 8 },
  Y: { count: 2, points: 4 }, Z: { count: 1, points: 10 },
};