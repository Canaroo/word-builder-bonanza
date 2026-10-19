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
    /** Overflow tax: above this many seconds, a word adds only half its time (rounded down). */
    overflowAbove: 60,
    /** From this level on, 3-letter words add no time. */
    shortWordTimeStopsAtLevel: 3,
    /** Seconds a shuffle adds: shuffles are the player's limited time lifeline. */
    shuffleTimeBonus: 5,
    /** At or below this many seconds, the Shuffle button pulses (and first-timers get a tip). */
    lifelineHintBelow: 15,
  },

  /** Speed-up levels: every this many valid words the level goes up and the clock ticks faster. */
  levels: {
    wordsPerLevel: 25,
    /** Extra clock speed per level (0.05 = 5% faster each level). */
    speedUpPerLevel: 0.05,
    /** The clock never runs faster than this. */
    maxSpeed: 1.75,
  },

  /** Golden Snitch charm: valid words in a row for each catch. After the last catch it flies away. */
  snitchCatchTargets: [5, 8, 12] as readonly number[],
  snitchBonus: 500,

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
} as const;

// Charm bonus values. Charm descriptions (data/charms.ts) read these too, so the text
// and the rules always match. Percentages are % of the word's score.
export const CHARM_BONUS = {
  theValve: 20,            // per vowel tile
  oneRing: 30,             // per E tile
  batSignal: 60,
  millenniumFalcon: 60,
  triforceOfCourage: 75,
  powerPellet: 75,
  chaosTheory: 50,
  weDidntStartTheFire: 75,
  inigosRevenge: 100,
  sherlocksSyntax: 200,
  scoobyStack: 75,
  hyruleHustle: 50,
  luna: 75,
  theDudeAbides: 40,
  pantsOnFire: 60,
  strangeMagic: 75,
  turtlePower: 75,
  iceAgeBonus: 75,
  powerStarResidual: 15,
  momentum: 75,
  beanCounter: 150,
  thrillerNight: 100,
  totallyClueless: 50,
  totallyCluelessBelow: 20,
  infinityGauntlet: 150,
  lenaPercent: 20,
  nicolesGracePercent: 25,
  christiansHoodiePercent: 25,
  buffyPercent: 25,
  pianoManPercent: 30,
  philsosophyWin: 100,
  philsosophyLoss: 25,
  maxBankedShuffles: 5,    // L Train Shuffle stops adding shuffles at this many
  maxBankedChallenges: 5,  // The Final Frontier stops adding Challenges at this many
} as const;

/** Most charms a player can have at once; a new one beyond this replaces one. */
export const CHARM_SLOTS = 5;

/** Time bank maximum while the Power Glove charm is equipped. */
export const POWER_GLOVE_BANK_MAX = 120;
