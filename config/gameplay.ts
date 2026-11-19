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
     * Bonus time from charms follows the clock rules too: it is halved above overflowAbove (like
     * word time) and shrinks 5% per level after the first, down to half. PowerPlay time always
     * pays the full amount on its card (v7.40.1), and so do shuffles.
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
    /** The normal ramp stops here (level 17); OVERTIME (below) keeps going past it. */
    maxSpeed: 2.0,
  },

  /**
   * Overtime (v7.47): from this level the squeeze keeps going instead of leveling off (the
   * normal ramps stop at level 15-17). Each level from here on adds `clockPerLevel` to the clock
   * speed (up to `clockCap`) and takes `wordTimePerLevel` off the share of time words earn (down
   * to `wordTimeFloor`). Simulated (stats from Nov 12-15, top runs reaching level 18-24): a top
   * player's median run ends at level 17 instead of 21 (best 10%: 18 instead of 24); a strong
   * player's at 14 instead of 15; typical runs (median level 3) never reach it.
   */
  overtime: { fromLevel: 12, clockPerLevel: 0.04, clockCap: 2.4, wordTimePerLevel: 0.02, wordTimeFloor: 0.55 },

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
  // Continue?: when the clock hits 0, keep playing for this share of your score.
  continueScoreCostPercent: 20,
  continueScoreCostMax: 2000,    // ...but never more than this, so a big late score isn't punished harder
  // Act Clear!: cash in clock seconds for points, but always keep a few on the clock.
  actClearMaxSeconds: 15,        // v7.35: was 20 s at 20 points each (never picked in 23 offers)
  actClearPointsPerSecond: 40,
  actClearKeepSeconds: 10,
  // Blue Shell Surprise: next word wins the multiplier, or the shell backfires for a loss.
  blueShellWinChance: 0.65,
  blueShellMultiplier: 4,
  blueShellLoss: 100,
  doubleOrNothingWinChance: 0.6, // otherwise the word scores 0
  nuclearOptionMultiplier: 3,    // next word, on top of the fresh hand
  gumpLuckPoints: 75,            // one of Gump Luck's four outcomes
  spaceInvaderMultiplier: 3,     // Space Invader: 50% for this...
  spaceInvaderCap: 5,            // ...or the word is capped at this many points
  // v7.25 gambles. Expected values sit near Fluncle's sure +300 so a gamble is worth the risk.
  // Let's Make a Deal: each round, two doors hold these prizes and one hides a Zonk that wipes
  // the pot. Bank after any win, or play the next round (bigger prizes). EV if you play all 3: ~340.
  doorRounds: [[150, 250], [300, 400], [500, 700]] as number[][],
  // Deal or No Deal: you hold one of these cases (equal odds, average 425). Each round more cases
  // open and the Banker offers this share of the average of what's left. Deal, or go on.
  dealCases: [0, 25, 100, 200, 400, 750, 1500],
  dealOpenPerRound: [2, 2, 1],
  dealBankerFactors: [0.6, 0.75, 0.9],
  whammyPot: 150,                                // No Whammies!: each spin adds this...
  whammyChance: 0.2,                             // ...unless a Whammy wipes the pot
  whammySpins: 3,
  // v7.39.1: the board's cash squares. A safe landing pays one of these (chances among safe spins),
  // averaging the same +150 a spin as before: 12.5 + 30 + 30 + 37.5 + 40 = 150.
  whammyCash: [{ points: 50, chance: 0.25 }, { points: 100, chance: 0.3 }, { points: 150, chance: 0.2 }, { points: 250, chance: 0.15 }, { points: 400, chance: 0.1 }],
  plinko: [{ points: 0, chance: 0.2 }, { points: 100, chance: 0.35 }, { points: 300, chance: 0.25 }, { points: 700, chance: 0.15 }, { points: 2000, chance: 0.05 }],
  // Minesweeper: pick squares one at a time. Each safe square adds the next step of the ladder to
  // the pot; the mine wipes it. Bank any time. Best stop is around 5-6 picks (EV ~370).
  minesweeperSquares: 9,                         // one is a mine
  minesweeperLadder: [100, 125, 150, 200, 250, 300, 400, 500],
  hotTub: [{ seconds: 25, chance: 0.35 }, { seconds: 10, chance: 0.45 }, { seconds: -8, chance: 0.2 }],
  // WILDCARD (v7.50.0): a wheel of four. The owner's odds: 30 / 30 / 30 / 10. The points grow with
  // the level like other prizes; the free tile is any letter, added to this hand only; the strike
  // is a real strike (a shield blocks it, and it can end the run).
  wildcard: [
    { kind: 'time', seconds: 5, chance: 0.3 },
    { kind: 'points', points: 500, chance: 0.3 },
    { kind: 'tile', chance: 0.3 },
    { kind: 'strike', chance: 0.1 },
  ] as { kind: 'time' | 'points' | 'tile' | 'strike'; seconds?: number; points?: number; chance: number }[],
  dailyDoublePercent: 10,                        // wager this share of your score...
  dailyDoubleMin: 100,
  dailyDoubleMax: 500,
  dailyDoubleLetters: 5,                         // ...on your next word having this many letters (win 2x the wager)
  popQuizSeconds: 5,                             // Pop Quiz, Hotshot: play your next word this fast...
  popQuizPoints: 300,                            // ...for this
  popQuizBonusSeconds: 5,                        // ...and this
  popQuizPenaltySeconds: 10,                     // or lose this
  // Mission: Impossible: time now for a promise. Two 5+ letter words in a row happen in about 63%
  // of random hands, so keeping it takes some effort; breaking it costs more than it gave.
  missionImpossibleSeconds: 20,
  missionImpossibleWords: 2,
  missionImpossibleLetters: 5,
  missionImpossiblePenalty: 15,
  donkeyKongMultiplier: 3,       // one tile of the fresh hand becomes this word multiplier
  // v7.28 PowerPlays. A typical word scores about 14 points (p50; p90 ~44), and the gamble EVs
  // above sit near 300, so rewards here aim for the same 150-400 range.
  // Tamagotchi: each 4+ letter word feeds the pet and its pot grows by step x feed number
  // (20, 40, 60...). A 3-letter word or a strike and it runs off with the pot.
  tamagotchiWords: 6,
  tamagotchiLetters: 4,
  tamagotchiStep: 20,
  // The Price Is Right: bid that your next word scores at least this much; hit it for the prize.
  // A miss costs half the prize (v7.28.3), so overbidding is a real risk, not a free roll.
  priceIsRightBids: [{ bid: 15, prize: 100, miss: 50 }, { bid: 30, prize: 200, miss: 100 }, { bid: 50, prize: 300, miss: 150 }, { bid: 80, prize: 450, miss: 225 }],
  // Time Capsule: the next word scores 0 now and comes back this many times over, this many words later.
  timeCapsuleMultiplier: 4,
  timeCapsuleWords: 4,
  // REDRUM: words of this many letters that are also a word backward (STAR/RATS) score x this.
  // 4+ letter reversible words show up in about 56% of random hands.
  redrumWords: 3,
  redrumLetters: 4,
  redrumMultiplier: 4,
  jackassMultiplier: 3,          // Jackass: take a strike for time (TIME_BONUS.jackass) and this on the next word
  hadoukenHits: 2,               // Hadouken!: this many boss-rule misses count as hits
  over9000Words: 3,              // It's Over 9000!: charm points pay double for this many words
  draftDayTiles: 3,              // Draft Day: packs of this many tiles replace your lowest-value tiles
  draftDayPacks: 3,
  // Smell Ya Later!: a rival earns points per second while you play your next few words. Since
  // v7.47.1 he races at your own pace: your points per second of play this run (score / seconds
  // the clock ran) x rivalPace, never below rivalPointsPerSecond. At a flat 3 a second he scored
  // about 37 in a race where players scored about 380 (Nov 12-15: median 31 points a second).
  rivalPointsPerSecond: 15,
  rivalPace: 1,
  rivalWords: 3,
  rivalPrize: 250,
  birdBoxSeconds: 3,             // Bird Box: tiles flip face down after this many seconds...
  birdBoxMultiplier: 4,          // ...and the next word scores this
  // Winner Winner Chicken Dinner: the letters of your words add up. Stand any time; over 21 busts.
  blackjackTarget: 21,
  blackjackPayouts: [{ min: 21, points: 400 }, { min: 19, points: 200 }, { min: 17, points: 100 }],
  // Card Sharks: higher or lower on cards 2-14 (A high). The pot after each right call; a tie is a free pass.
  cardSharksLadder: [50, 125, 225, 375, 600],
  // v7.29.1 reworks of PowerPlays nobody picked (stats: 0 picks in 24-35 offers each).
  warioWarpPoints: 300,          // Wario Warp: this many points now...
  warioWarpSeconds: 10,          // ...for this many seconds off the next round (was +100 for 10 s)
  moneyBinScore: 40,             // Scrooge's Money Bin: a next word scoring this much...
  moneyBinCredits: 3,            // ...earns these credits (was: lose 500 points for 1 credit)
  zapperMultiplier: 3,           // Duck Hunt: the tile you shoot is replaced by one worth this many times its points
  // v7.35 reworks of PowerPlays nobody picked (0 picks in 20-40 offers each; ids kept for stats).
  thanosGiftPoints: 500,         // Gift From Thanos: this now; your next word of thanosGiftLetters+ letters scores 0
  thanosGiftLetters: 4,          // (v7.36.7: was 400 and any next word, so a throwaway 3-letter word paid for it)
  schruteBucksWords: 5,          // Schrute Bucks (v7.36.7, a beet farm): your next this many valid words...
  schruteBucksPerLetter: 25,     // ...earn this many bucks per B, E or T, paid as points after the last one
  schruteBucksLetters: 'BET',
  // v7.55.0 reworks (ids kept; each was picked about 1 time in 25). Point prizes grow with the level.
  ludicrousSpeedMultiplier: 2,   // Ludicrous Speed: for ludicrousSeconds the clock freezes and words score this
  ludicrousSeconds: 15,
  ludicrousSpeedCost: 4,         // (old version; kept for saves armed before v7.55.0)
  polaroidSeconds: 5,            // Shake It Like a Polaroid: tap to shake for this long...
  polaroidShakesPerStep: 5,      // ...every this many shakes...
  polaroidPoints: 25,            // ...pays this, up to polaroidMax
  polaroidMax: 300,
  duckSeconds: 10,               // Duck Hunt: ducks fly for this long; each one shot pays duckPoints
  duckPoints: 50,
  // Scrooge's Money Bin (v7.55.1, the owner's call: Credits came too easily elsewhere to matter):
  // coins rain for moneyBinSeconds, worth 1, 2 or 3 seconds each; the faster a coin falls, the more
  // it's worth. About 22 seconds fall in all; a catch is capped at moneyBinMaxSeconds.
  moneyBinSeconds: 8,
  moneyBinCoins: [{ seconds: 1, fallMs: 2400, weight: 0.5 }, { seconds: 2, fallMs: 1700, weight: 0.3 }, { seconds: 3, fallMs: 1100, weight: 0.2 }],
  moneyBinMaxSeconds: 15,
  moneyBinMaxCredits: 6, // (the v7.55.0 Credits version; unused)
  warioBags: [{ points: 300, seconds: 5 }, { points: 600, seconds: 10 }, { points: 900, seconds: 15 }],
  missionWords: 3,               // Mission: Impossible: pull off the mission within this many words for missionPrize
  missionPrize: 400,
  moreThanMeetsMultiplier: 3,    // More Than Meets the Eye: the first word using the new combo tile scores this
  shakeTileMultiplier: 2,        // Shake It Like a Polaroid: one redrawn tile is this word multiplier
  shapeshifterPoints: 10,        // Shapeshifter's Tongue: the chosen letter's tile is worth this
  hookshotMultiplier: 3,         // Hookshot: the twin tile is worth this many times its points
  boostWords: 3,                 // Extreme Makeover (Polish): words it lasts (was 5; multipliers now cover charm points)
  // Psychic Friends Network (v7.54.0, reworked: the tile peek was used 3 times ever): call your next
  // word's length. Prizes follow how often an 8-tile hand can spell it (3: 99%, 4: 94%, 5: 72%,
  // 6: 41%, 7+: 10%), so every call is worth roughly 50-200 on average. No cost for a miss.
  psychicCalls: [
    { letters: 3, prize: 50 }, { letters: 4, prize: 100 }, { letters: 5, prize: 250 },
    { letters: 6, prize: 500 }, { letters: 7, prize: 1500, orMore: true },
  ] as { letters: number; prize: number; orMore?: boolean }[],
};

// Seconds from the time PowerPlays and charms (before the bonus-time rules above).
export const TIME_BONUS = {
  timeTurner: 10,          // per word, for 2 words
  timeBoost: 10,
  multiverseCap: 15,       // In Time: half the score as seconds, up to this
  saveByTheBell: 5,        // per turn, for 3 turns
  executeOrder66: 3,
  glitchInTheCode: 3,
  jackass: 15,             // Jackass: a strike taken on purpose
  rescue: 10,              // Turn Back Time (rewind), Neo's Choice (time), Everybody Chill (deepFreeze), Gump's Luck
  continueScreen: 25,      // Continue?: a once-per-run rescue, so it skips the bonus-time rules
  sandsOfTime: 3,          // per word of sandsOfTimeLetters+ letters
  sandsOfTimeLetters: 6,
  gottaCatchEmAll: 10,     // once, when the last vowel is caught
  brewstersMillions: 1,    // every word (and it costs points)
  goSpeedRacer: 3,         // every 3-letter word (which scores 0)
  cliffhanger: 2,          // per word played at cliffhangerBelow seconds or fewer
  cliffhangerBelow: 10,
  wileECoyote: 5,          // per strike
  // Tick-Tock Croc (v7.51.0): every crocEvery valid words while it's equipped, pick 1 of 3 clocks:
  // crocWinChance for +tickTockCroc seconds (charm time: it shrinks with the level, so never more
  // than 10), else lose crocLoss points. The owner's numbers.
  tickTockCroc: 10,
  crocEvery: 25,
  crocWinChance: 0.6,
  crocLoss: 300,
};

export const CHARM_BONUS = {
  theValve: 20,            // per vowel tile...
  theValveSeconds: 1,      // ...but every word costs this many seconds (v7.29: it was +61/word for free; 2 s in v7.29.0)
  oneRing: 15,             // per E tile (was 30: about +31 a word, now about +15)
  batSignal: 60,
  millenniumFalcon: 60,
  triforceOfCourage: 75,
  powerPellet: 75,
  chaosTheory: 50,
  weDidntStartTheFire: 75,
  inigosRevenge: 250,      // two or more I's
  sherlocksSyntax: 400,    // a palindrome (was 200, and the only way it paid)
  sherlocksRepeat: 60,     // v7.35: any repeated letter (about a third of 5-letter words)
  scoobyStack: 75,
  hyruleHustle: 50,
  luna: 75,
  // Conjunction Junction, Vote for Pedro and LUNA only count words this long (3-letter words
  // made them fire on almost every hand).
  chaseMinLetters: 4,
  theDudeAbides: 40,
  pantsOnFire: 60,
  strangeMagic: 75,
  turtlePower: 75,
  iceAgeBonus: 75,
  powerStarResidual: 15,
  powerStarResidualTrigger: 60, // a single word this big turns it on (was 150; a typical word is ~12)
  momentum: 75,
  beanCounter: 150,
  thrillerNight: 100,
  totallyClueless: 30,
  totallyCluelessBelow: 15,
  perfectlyBalanced: 75,  // words with as many vowels as consonants
  mixtapeBase: 40,         // first link in a Mixtape chain
  mixtapeStep: 20,         // each further link pays this much more
  mixtapeMax: 120,
  rubiksCube: 60,          // rubiksCubeLetters+ letters, no repeated letter (v7.35: was 6+ letters for 150; 5+ fires on about half of 5-letter play)
  rubiksCubeLetters: 5,
  sickCombo: 50,           // word longer than your last one
  lenaPercent: 20,
  nicolesGracePercent: 25,
  christiansHoodiePercent: 25,
  buffy: 30,               // per word between 8 PM and 8 AM
  pianoManAbove: 30,       // Piano Man Encore: score this much on a word...
  pianoMan: 60,            // ...and your next word earns this
  sacredHeart: 75,         // a J or a D (for JD)
  trueLove: 60,            // an L or a V...
  trueLoveBoth: 200,       // ...or both
  cleverGirl: 60,
  cleverGirlLetters: 3,    // different R/A/P/T/O letters a word needs
  starPower: 125,          // both S and T
  radioactive: 40,         // two of D, E, R...
  radioactiveAll: 120,     // ...or all three
  silentKiller: 75,        // chaseMinLetters+ letters with at most silentKillerMaxVowels vowels (v7.35: was no vowels at all, +200)
  silentKillerMaxVowels: 1,
  recycler: 40,            // WALL-E (v7.35): a word that reuses recyclerLetters+ letters from your last word
  recyclerLetters: 2,
  goldenTicket: 250,
  goldenTicketChance: 0.1,
  finisher: 15,            // added to the last tile's points
  italianRestaurant: 100,  // words ending in AN
  fluxCapacitor: 88,       // every fluxCapacitorEvery-th word
  fluxCapacitorEvery: 8,
  philsosophyWin: 100,
  philsosophyLoss: 25,
  maxBankedShuffles: 2,    // L Train Shuffle stops adding shuffles at this many
  maxBankedChallenges: 5,  // The Final Frontier stops adding Challenges at this many
  gottaCatchEmAll: 300,    // once, for catching all five vowels
  finishHimBelow: 15,      // Flawless Victory: words played with this many seconds or fewer left...
  finishHimMultiplier: 2,  // ...score this much more
  hesOnFireAbove: 60,      // He's On Fire!: words played with more than this many seconds left...
  hesOnFire: 40,           // ...earn this
  survivor: 30,            // v7.35: every word, per strike you're carrying (was +75 on 2 words after a strike)
  theOpposite: 40,         // word shares no letters with your last one
  weWereOnABreakMultiplier: 2, // first word after a shuffle
  imReadyMultiplier: 3,    // first word of each new level
  backpack: 60,            // per PowerPlay used
  eagle: 40,               // word right after one of eagleLetters+ letters
  eagleLetters: 5,
  doubleDragon: 40,        // per boss hit
  nationalTreasureMultiplier: 2, // secret bonus points
  goldenGirlsPercent: 50,  // Golden Round words
  noteStreak: 75,          // when the Word Combo fills
  boxersPercent: 50,       // words while one strike from game over
  crossTheRoad: 150,       // crossTheRoadWords words in a row of crossTheRoadLetters+ letters
  crossTheRoadWords: 3,
  crossTheRoadLetters: 5,
  aTeam: 75,               // words starting with A
  conjunctionJunction: 90, // letters in alphabetical order
  voteForPedro: 50,        // only 1-point tiles
  formVoltron: 75,         // uses a combo tile
  titansPerCharm: 4,       // per charm equipped, every word
  // v7.18 charms. Trade-offs first: they cost points (or safety) and give time back.
  brewstersMillionsCost: 15,   // per word
  hammerTimeSlowPercent: 15,   // the clock ticks this much slower...
  hammerTimeCost: 10,          // ...and every word scores this much less
  mrGlass: 75,                 // per word, with one fewer strike
  mrGlassStrikes: 1,
  honeyShrunk: 60,             // per word, with one fewer tile in hand
  happyAccidentSeconds: 0,     // the first invalid word each level costs this instead of a strike (v7.35: was 10; now free)
  wileECoyote: 150,            // per strike (plus TIME_BONUS.wileECoyote)
  turboButtonPercent: 20,      // fewer letters to fill the PowerPlay meter
  littleMacHits: 1,            // fewer hits a boss round needs
  doubleDare: 250,             // per Challenge used, win or lose (v7.35: was 75)
  doubleDareChallenges: 1,     // ...and this many Challenges when equipped
  myPrecious: 100,             // per unused shuffle, at each level-up
  flagpolePerSecond: 10,       // per second on the clock, at each level-up
  supermarketSweep: 60,        // a word within supermarketSweepSeconds of a new hand
  supermarketSweepSeconds: 3,
  sesameStreet: 75,            // words with the letter of the level
  sesameLetters: 'RSTLNDCMPBGH',
  hungryHippos: 80,            // a word that uses every vowel in your hand...
  hungryHipposMinVowels: 2,    // ...when the hand has at least this many
} as const;

/**
 * Boss rounds (data/bosses.ts): every `everyLevels` levels, the next `words` valid words face a
 * boss rule. Land `hitsToWin` words that follow it to earn the Boss Badge; `closeHits` or more
 * pays a consolation. Rewards climb with each boss level in a run (the last entry repeats).
 * Badge time skips the per-level shrink (it's earned, like the run-savers) but is still halved
 * above the overflow line, so a badge can't overfill the bank.
 */
export const BOSS = {
  everyLevels: 3,
  words: 8,
  hitsToWin: 6,
  closeHits: 4,
  rewards: [
    { points: 200, seconds: 5, closePoints: 50 },
    { points: 350, seconds: 8, closePoints: 90 },
    { points: 500, seconds: 10, closePoints: 125 },
    { points: 700, seconds: 12, closePoints: 175 },
    { points: 900, seconds: 15, closePoints: 225 },
  ],
} as const;

/**
 * Power words (secret words with an effect, data/secretBonuses.ts `effect`). Each one fires at most
 * once per level. Slot seconds go through bonusTime() like other item time; freeze and slow add no
 * time to the bank, they only hold or slow the clock.
 */
export const POWER_WORD_EFFECTS = {
  slot: [
    { seconds: 1, chance: 0.5, reels: '🍒' },
    { seconds: 3, chance: 0.35, reels: '🔔' },
    { seconds: 10, chance: 0.15, reels: '7️⃣' },
  ],
  freezeSeconds: 10,
  slowWords: 3,
  slowFactor: 2,          // the clock ticks this many times slower
  healFallbackPoints: 100, // HEAL with no strike to remove
  rewindLevelOneSeconds: 3, // REWIND at level 1, where the clock can't go slower
  spiceMultiplier: 3,      // SPICE: the next word's multiplier
} as const;

/** Most charms a player can have at once; a new one beyond this replaces one. */
export const CHARM_SLOTS = 5;

/**
 * Charm upgrades (v7.33): with every slot full, a charm offer can also upgrade one equipped charm
 * (once per charm). An upgraded charm's point bonuses pay this much more. Stats: 49% of charm
 * offers from level 6 on were passed, because a full set had nothing left to gain.
 */
export const CHARM_UPGRADE = { percent: 50 } as const;

/**
 * Charm sets (v7.41, data/charmSets.ts): holding every charm of a themed set pays these points on
 * every valid word (a 2-charm set, a 3-charm set). For scale: Honey, I Shrunk the Kids pays +60 a
 * word for one slot and a smaller hand; a pair costs two slots of charms that were rarely picked.
 * pullChance: with part of a set held, the chance a charm offer swaps its last card for a missing
 * piece (when one can be offered).
 */
export const CHARM_SET_BONUS = { pair: 50, trio: 100, pullChance: 0.5 } as const;

/**
 * v7.42: four mechanics borrowed from other games.
 * LAST_WORDS: when a run ends, one untimed word from the final hand scores x multiplier.
 * HEAD_START: each run that ends before `untilLevel` adds `perRun` seconds to that player's next
 *   starting clock, up to `max`; reaching the level clears it (services/headStart.ts).
 * SKILL_SHOT: each new level (from level 2; never a run's opening hand) lights one tile; using it in the level's first word pays `base`, plus
 *   `step` for each level in a row it was hit, up to `max`.
 * GEM_TILES: a word of this many letters turns one tile of the next hand into a word-multiplier
 *   gem (6 letters x3, 7 x4, 8+ x5). Natural x2 tiles show up on 15% of draws, so a gem has to beat that.
 */
export const LAST_WORDS = { multiplier: 3 } as const;
export const HEAD_START = { perRun: 3, max: 15, untilLevel: 4 } as const;
// fromLevel: the first level that lights a tile (a run's opening hand never does: v7.44.6).
// introShows: times a player sees the explainer card.
export const SKILL_SHOT = { base: 50, step: 25, max: 200, introShows: 2, fromLevel: 2 } as const;
export const GEM_TILES: Record<number, number> = { 6: 3, 7: 4, 8: 5 };
/** Times a player sees the gem explainer card (v7.53.1), like Skill Shot's intro. */
export const GEM_INTRO_SHOWS = 2;

/**
 * v7.43: three more mechanics borrowed from other games.
 * FORK: at these levels (the start of a tier) the player picks a route until the next fork. The
 *   clock factor multiplies the level's clock speed; the points factor multiplies each word's score.
 * HOLD_SLOT: the Hold slot comes from a charm (v7.45, `charmId`): while it's equipped, one tile can be
 *   parked in a slot that survives new hands and shuffles. It used to open for everyone at level 4.
 * GRUDGE: beating a boss that got away from this player before pays its badge points times this.
 */
export const FORK = { levels: [4, 7, 11], easy: { clock: 0.9, points: 1 }, danger: { clock: 1.15, points: 1.5 } } as const;
export const HOLD_SLOT = { charmId: 'holdThatThought' } as const;
export const GRUDGE = { multiplier: 2 } as const;

/**
 * Bones (v7.44, services/bones.ts): a run that ends at `minLevel` or later, holding a charm, leaves
 * its final hand behind. A player reaching that level may find it (at most `perRun` ghosts a run):
 * a word of `minLetters`+ from those tiles within `seconds` wins one of the charms. Bones older
 * than `maxAgeDays` are ignored; a run loads the newest `fetch` when it starts.
 */
export const BONES = { minLevel: 2, minLetters: 5, seconds: 30, perRun: 1, maxAgeDays: 30, fetch: 60 } as const;

/**
 * Mystery Tape (v7.41): now and then the last card of a PowerPlay offer is a face-down tape. It
 * hides one PowerPlay from `pool` (the ones picked under 12% of the time in the usage stats: 146
 * runs, Nov 2026) and pays `points` on the spot for taking it blind (a prize: grows with the
 * level). Only pocket PowerPlays go in the pool: nothing that fires on pick, no bets, no time cards.
 */
export const MYSTERY_TAPE = {
  chance: 0.25,
  points: 150,
  pool: [
    'cassiesClue', 'carmenSandiego', 'yoshisWildRide', 'tetrisTouch', 'letterUpgrade', 'schruteBucks',
    'neuralyzer', 'captainPlanet', 'whoYouGonnaCall', 'buyAVowel', 'moreThanMeets',
    'withGreatPower', 'cowabunga', 'warioWarp', 'shapeshiftersTongue', 'hookshot', 'shakeItLikeAPolaroid',
    'ludicrousSpeed', 'duckHunt', 'actClear', 'echoesOfThePast', 'holdOntoYourButts', 'upsideDown',
    'rescueDrop', 'luckyCharms',
  ],
} as const;

/**
 * Arcade mini-games (v7.38.0): spelling one of these words opens a quick side game (Play or Skip).
 * Points only, paid as a prize (grows with the level, prizeFor). Once per run each, like a secret.
 */
export const MINI_GAME_VALUES = {
  pong: { toWin: 3, prize: 400 },                                   // GAME: first to 3 beats the CPU
  mole: { seconds: 10, perMole: 20, goldMole: 100, goldChance: 0.08 }, // MOLE: bop moles for 10 s (a perfect tapper gets ~17)
  claw: { plush: 200, plushSlip: 0.25, trophy: 600, trophySlip: 0.7 }, // CLAW: aim and drop; it can slip
  darts: { darts: 3, bull: 100, inner: 50, outer: 20 },            // DART: 3 darts at a drifting crosshair
  goal: { kicks: 3, perGoal: 100, hatTrick: 400 },                 // GOAL: 3 penalties, the keeper dives at random
  dice: { triple: 300, straight: 200, pair: 100, perPip: 5 },      // DICE: roll 3, hold, reroll once
  bowl: { strike: 300, spare: 150, perPin: 15 },                   // BOWL: time the aim, one spare ball
  golf: { strokes: 3, prizes: [300, 150, 50] },                    // TEE: hole in one, two strokes, three
  hoops: { shots: 3, swish: 100, bank: 60, perfect: 100 },         // NET: 3 free throws, +100 for 3 swishes
  // v7.46.0 (LANE reuses bowl):
  ringToss: { rings: 3, ringer: 100, rim: 50, near: 20 },          // RING: toss 3 rings at a drifting bottle
  riff: { lengths: [3, 4, 5, 6], perRiff: 60, allBonus: 100, stepMs: 520 }, // NOTE: repeat the riff; a miss ends it
  striker: { swings: 3, bell: 120, close: 60, low: 20, allBells: 100 }, // NAIL: ring the bell on the high striker
  pitStop: { tires: 4, taps: 4, tiers: [{ under: 3.5, points: 300 }, { under: 5, points: 200 }, { under: 7, points: 100 }], slow: 50 }, // TIRE: 16 taps, beat the clock
  coaster: { rides: 3, clean: 120, wobbly: 60, allClean: 100 },    // RIDE: release in the green to clear the loop
  seal: { seconds: 10, perSecond: 25, fullBonus: 100 },            // SEAL: keep the ball on the nose
  monte: { rounds: 3, perFind: 100, allBonus: 100 },               // DEAL: find the queen, 3 rounds
  // v7.56.0: five more words, each a new kind of play (reaction, feel, logic, catching, dodging).
  lure: { casts: 3, whopperMs: 400, keeperMs: 650, minnowMs: 1000, whopper: 120, keeper: 70, minnow: 30, allWhoppers: 100, waitMs: [1300, 3600] }, // LURE: tap when the bobber dips
  dial: { seconds: 20, numbers: 3, size: 40, glow: 3, perNumber: 100, cracked: 150 }, // DIAL: find the combination by feel
  wire: { bombs: 3, seconds: 8, perBomb: 100, allBonus: 150 },     // WIRE: follow the manual, cut the right wire
  nest: { seconds: 10, perEgg: 20, golden: 100, rotten: 20, goldenChance: 0.07, rottenChance: 0.16, spawnMs: [420, 650] }, // NEST: catch the eggs
  leap: { seconds: 15, lanes: 5, perLane: 60, home: 150 },         // LEAP: hop across five lanes of traffic
} as const;

/**
 * Score gates (v7.39.0): crossing a score opens a one-time event. 10,000: unscramble a password
 * (44% of runs got there in the stats). 30,000: a bonus stage on its own clock (11% of runs).
 * Points only and flat (no level boost): the numbers on the card are what it pays.
 */
export const GATES = {
  password: { score: 10000, seconds: 20, solve: 1000, hint: 500, miss: 250 },
  bonusStage: { score: 30000, seconds: 30, multiplier: 3, handSize: 10, perLetter: 25 }, // each word: (its score + 25 a letter) x3
  // v7.49: 9% of Nov 12-15 runs passed 50,000 and 2% passed 70,000. Points (and a badge), never
  // time: late runs are clock-limited, and time would undo Overtime.
  // 50,000: the Word Ladder. Rung N needs a word of rungs[N]+ letters within secondsPerRung; each rung
  // cleared sets the pot (pots[N]). Bank any time; a missed rung loses the pot.
  ladder: { score: 50000, rungs: [3, 4, 5, 6, 7, 8], pots: [250, 500, 1000, 2000, 4000, 8000], secondsPerRung: 15, handSize: 10 },
  // 70,000: the Big One. A hand hiding an 8-letter word; your longest word in `seconds` pays by
  // length. Reaching the gate earns the 70K Club badge (`badgeId`, permanent).
  bigOne: { score: 70000, seconds: 45, prizes: { 8: 5000, 7: 2500, 6: 1000 } as Record<number, number>, extraTiles: 2, badgeId: 'b_seventyKClub' },
} as const;

/**
 * Long-word boost (v7.34): charm points on a word pay this many percent more, by word length
 * (longer words use the last entry). Charm bonuses are flat, so a 4-letter word with a typical
 * charm set averaged 148 points against 138 for a 7-letter word; now long words win on score too.
 * Simulated effect on points per word: 3-5 letter play +2%, 5-letter play +17%, longest-word play +35%.
 */
export const CHARM_LENGTH_BOOST: Record<number, number> = { 5: 25, 6: 50, 7: 100, 8: 150 };

/**
 * PowerPlay point prizes grow with the run level (v7.34): +perLevel per level after the first, up
 * to max times the listed prize (a 300 prize pays 450 at level 6, 600 at level 11, 750 from level
 * 16). Time bonuses shrink 5% a level, so fixed prizes fell behind: time cards were taken 63% of
 * the time they were offered. Losses, costs and wagers stay as listed.
 */
export const PRIZE_GROWTH = { perLevel: 0.1, max: 2.5 } as const;

/** Time bank maximum while the Power Glove charm is equipped. */
export const POWER_GLOVE_BANK_MAX = 120;

/**
 * Greatest Hits (v7.52.0, the owner's idea): replay a word until it "goes platinum". The first
 * time a 3-letter word is played 3 times in a run it goes GOLD (+500); a 4-letter word played
 * 4 times goes PLATINUM (+1,000); 5 letters 5 times DIAMOND (+1,500), and so on. Each record
 * pays once a run, in any order, as a separate reward (not multiplied, never boosted by level).
 * Simulated (best word for each length, 8-tile hands): 3x3 in 98% of 59-word runs; 4x4 in 23%
 * of 59-word runs and 94% of 180-word runs; 5x5 in 6% of 180-word runs and 26% of 292-word
 * runs; 6x6 and up about never. Matching letters to plays keeps it from being farmed.
 */
export const GREATEST_HITS = {
  tiers: [
    { letters: 3, points: 500, title: 'GOLD', icon: '📀' },
    { letters: 4, points: 1000, title: 'PLATINUM', icon: '💿' },
    { letters: 5, points: 1500, title: 'DIAMOND', icon: '💎' },
    { letters: 6, points: 2000, title: 'HALL OF FAME', icon: '🏛️' },
    { letters: 7, points: 2500, title: 'LEGEND', icon: '🎤' },
    { letters: 8, points: 3000, title: 'ICON', icon: '👑' },
  ],
  /** The tracker chip shows a word once it has this many plays toward its record. */
  chipFrom: 2,
} as const;

/**
 * Quack Attack (v7.54.0, the owner's idea): playing QUA a fourth time in one run. QUA-QUA-QUA-QUACK!
 * Your next 4 words score x4 (charm points too), and the 🦆 Quack Pack badge is yours for good.
 * The bag has one Q per 100 tiles, so it's a long-run jackpot: simulated, about 0% of 59-word runs,
 * 4% of 180-word and 18% of 292-word runs by chance, and 86-87% of 180+ word runs for a player
 * who keeps Q, U and A until they meet.
 */
export const QUACK_ATTACK = { word: 'QUA', plays: 4, multiplier: 4, words: 4, badgeId: 'b_quackPack' } as const;
