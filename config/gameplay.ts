// Gameplay tuning knobs. Change these to rebalance the game; the rules in
// services/rules.ts read from here. See docs/GAMEPLAY_REVIEW.md for the reasoning.

export const GAMEPLAY = {
  timeBank: {
    /** Seconds on the clock when a run starts (and after Groundhog's Day). */
    start: 60,
    /** The bank can't grow past this, so time can't be hoarded forever. */
    max: 90,
    /** Seconds lost for an invalid word (on top of the strike). */
    invalidPenalty: 5,
    /** Seconds added for a valid word, by length. Longer words use the last entry. */
    secondsByLength: { 3: 2, 4: 3, 5: 5, 6: 7, 7: 10 } as Record<number, number>,
  },

  /** The Golden Round's own clock. Running out ends the Golden Round, not the run. */
  goldenRoundSeconds: 30,

  /** Word score multiplier by length (a smooth curve instead of one jump at 5). */
  lengthMultipliers: { 4: 1.25, 5: 1.5, 6: 2, 7: 2.5, 8: 3 } as Record<number, number>,

  /** Tiles in hand after dealing or refilling. Power-ups can push the rack up to RACK_SIZE. */
  handSize: 8,

  /** Letters played to fill the PowerPlay meter and earn an offer. */
  powerPlayMeterLetters: 25,
  /** Fallback: also offer a PowerPlay every this many words. */
  powerPlayEveryWords: 35,

  /** Valid words in a row that win back one strike. */
  strikeRecoveryStreak: 15,
} as const;
