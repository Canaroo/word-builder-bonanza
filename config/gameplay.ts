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
    /**
     * Bonus time from charms and PowerPlays follows the clock rules too: it is halved above
     * overflowAbove (like word time) and shrinks 5% per level after the first, down to half.
     * Shuffles and the once-per-run rescues (Happy Place, Life Finds a Way) are exempt.
     */
    bonusShrinkPerLevel: 0.05,
    bonusMinScale: 0.5,
    /** Shuffle is press-and-hold for this long, so a stray tap can't spend a shuffle. */
    shuffleHoldMs: 450,
    /** At or below this many seconds, the Shuffle button pulses (and first-timers get a tip). */
    lifelineHintBelow: 15,
  },

  /**
   * Speed-up levels: every this many valid words the level goes up. Each level the clock ticks
   * faster, words pay a little less time, and the PowerPlay meter gets longer. The squeeze is
   * gentle up to lateFromLevel, then steeper, so strong players feel the pressure late in a run.
   */
  levels: {
    wordsPerLevel: 18,
    /** Levels after this one use the steeper "late" rates below (level 7 starts at word 108). */
    lateFromLevel: 6,
    /** Extra clock speed per level (0.05 = 5% faster each level), then per late level. */
    speedUpPerLevel: 0.05,
    lateSpeedUpPerLevel: 0.07,
    /** The clock never runs faster than this (reached at level 17, word 288). */
    maxSpeed: 2.0,
  },

  /**
   * Level tiers: a name and color for each stretch of levels, shown on the level badge and the
   * timer's glow. They start where the rules change: 3-letter words stop paying (3), the PowerPlay
   * meter grows (4), the late squeeze (lateFromLevel + 1 = 7).
   */
  levelTiers: [
    { fromLevel: 1, name: 'WARM-UP', tone: 'cyan' },
    { fromLevel: 4, name: 'HEATING UP', tone: 'yellow' },
    { fromLevel: 7, name: 'OVERDRIVE', tone: 'orange' },
    { fromLevel: 11, name: 'MELTDOWN', tone: 'red' },
  ] as readonly { fromLevel: number; name: string; tone: 'cyan' | 'yellow' | 'orange' | 'red' }[],

  /** After lateFromLevel, words earn this share less time per level (a 7-letter word: 10s, then 9s at level 8…), down to min. */
  wordTimeShrink: { perLateLevel: 0.04, min: 0.65 },

  /** Golden Snitch charm: valid words in a row for each catch. After the last catch it flies away. */
  snitchCatchTargets: [5, 8, 12] as readonly number[],
  snitchBonus: 500,

  /** The Golden Round's own clock. Running out ends the Golden Round, not the run. */
  goldenRoundSeconds: 30,

  /** Word score multiplier by length (a smooth curve instead of one jump at 5). */
  lengthMultipliers: { 4: 1.25, 5: 1.5, 6: 2, 7: 2.5, 8: 3 } as Record<number, number>,

  /** Tiles in hand after dealing or refilling. Power-ups can push the rack up to RACK_SIZE. */
  handSize: 8,

  /** Letters played to fill the PowerPlay meter and earn an offer (at level 1). */
  powerPlayMeterLetters: 25,
  /** The meter gets longer with level: from fromLevel, + perLevel letters (perLateLevel after lateFromLevel), up to max. */
  powerPlayMeterGrowth: { fromLevel: 4, perLevel: 5, perLateLevel: 6, max: 60 },
  /** Fallback: also offer a PowerPlay every this many words. */
  powerPlayEveryWords: 35,
} as const;

// Charm bonus values. Charm descriptions (data/charms.ts) read these too, so the text
// and the rules always match. Percentages are % of the word's score.
// PowerPlay costs and values.
export const POWER_PLAY_VALUES = {
  buyAVowelCost: 100,
  rareLetters: 'JKQXZ',    // Hold Onto Your Butts: these tiles score x3 on the next word
  rareLetterMultiplier: 3,
  // Combo Breaker: for the next few words, each word this long scores the multiplier; a shorter
  // word scores 0 and breaks the combo (the PowerPlay ends).
  comboBreakerMinLength: 4,
  comboBreakerMultiplier: 3,
  comboBreakerWords: 3,
};

// Seconds from the time PowerPlays and charms (before the bonus-time rules above).
export const TIME_BONUS = {
  timeTurner: 10,          // per word, for 2 words
  timeBoost: 10,
  multiverseCap: 15,       // Multiverse of Sadness: half the score as seconds, up to this
  saveByTheBell: 5,        // per turn, for 3 turns
  cleverGirl: 2,
  cleverGirlLetters: 4,    // different R/A/P/T/O letters a word needs
  executeOrder66: 3,
  glitchInTheCode: 3,
  rescue: 10,              // Rewind, Neo's Choice (time), Deep Freeze, Gump's Luck
};

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
  perfectlyBalanced: 75,  // words with as many vowels as consonants
  mixtapeBase: 40,         // first link in a Mixtape chain
  mixtapeStep: 20,         // each further link pays this much more
  mixtapeMax: 120,
  rubiksCube: 150,         // 6+ letters, no repeated letter
  sickCombo: 50,           // word longer than your last one
  lenaPercent: 20,
  nicolesGracePercent: 25,
  christiansHoodiePercent: 25,
  buffyPercent: 25,
  pianoManPercent: 30,
  philsosophyWin: 100,
  philsosophyLoss: 25,
  maxBankedShuffles: 2,    // L Train Shuffle stops adding shuffles at this many
  maxBankedChallenges: 5,  // The Final Frontier stops adding Challenges at this many
} as const;

/** Most charms a player can have at once; a new one beyond this replaces one. */
export const CHARM_SLOTS = 5;

/** Time bank maximum while the Power Glove charm is equipped. */
export const POWER_GLOVE_BANK_MAX = 120;
