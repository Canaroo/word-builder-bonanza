
import { PowerPlay, GameState, EventLogEntry } from '../types';
import { labelize } from '../services/durationTags';
import { TIME_BONUS, POWER_PLAY_VALUES } from '../config/gameplay';
import { tamagotchiPot, dailyDoubleWager, levelFor, prizeFor, jengaPot } from '../services/rules';

// The 'activate' function is for declaring the state change that should happen upon activation.
// The actual logic is handled in the GameScreen reducer based on the power play's `effectType` and ID.


// Arms a PowerPlay: stores its state under activePowerPlays[id] and shows it in Active Buffs.
const arm = (id: string, value: unknown = true) => (gameState: GameState): Partial<GameState> => {
  const powerPlay = POWER_PLAYS_LIST.find(p => p.id === id)!;
  return {
    activePowerPlays: { ...gameState.activePowerPlays, [id]: value },
    activeBuffs: [...gameState.activeBuffs.filter(b => b.id !== id), powerPlay],
  };
};

// Chubbs' Pep Talk / Turn Back Time (v7.67.7): remove a strike now, or wait for the next one
// (ADD_STRIKE erases it the moment it lands). Turn Back Time's seconds are added by GameScreen.
const strikeEraser = (id: 'chubbsPepTalk' | 'rewind', gameState: GameState): Partial<GameState> => {
  const powerPlay = POWER_PLAYS_LIST.find(p => p.id === id)!;
  if (gameState.strikes > 0) {
    const entry: EventLogEntry = { type: 'event', id: `pp-${id}-${Date.now()}`, name: powerPlay.name, description: 'One strike was removed.', scoreChange: 0, cumulativeScore: gameState.score, icon: powerPlay.icon };
    return { strikes: gameState.strikes - 1, log: [...gameState.log, entry],
      lastPowerPlayResult: { message: `${powerPlay.icon} ${powerPlay.name}: one strike erased!`, scoreChange: 0 } };
  }
  return {
    activePowerPlays: { ...gameState.activePowerPlays, [id]: true },
    activeBuffs: [...gameState.activeBuffs.filter(b => b.id !== id), { ...powerPlay, description: 'Waiting: it erases your next strike the moment you get one.' }],
    lastPowerPlayResult: { message: `${powerPlay.icon} ${powerPlay.name} is standing by: it erases your next strike.`, scoreChange: 0 },
  };
};

// Letter Upgrade / Polish: one letter gets a boost for a few words.
const letterBoost = (id: 'letterUpgrade' | 'polish', words: number) => (gameState: GameState, options?: { letter?: string }): Partial<GameState> => {
  const letter = options?.letter;
  if (!letter) return {};
  const key = id === 'letterUpgrade' ? 'letterMultipliers' : 'wordMultipliersByLetter';
  const multipliers = { ...gameState[key] };
  const previous = gameState.activePowerPlays[id];
  if (previous?.letter) delete multipliers[previous.letter]; // re-using it replaces the old letter
  multipliers[letter] = 3;
  const powerPlay = POWER_PLAYS_LIST.find(p => p.id === id)!;
  const buff = {
    ...powerPlay,
    description: id === 'letterUpgrade'
      ? `'${letter}' tiles are worth 3x for your next ${words} words.`
      : `Words with '${letter}' score x3 for your next ${words} words.`,
  };
  return {
    [key]: multipliers,
    activePowerPlays: { ...gameState.activePowerPlays, [id]: { words, letter } },
    activeBuffs: [...gameState.activeBuffs.filter(b => b.id !== id), buff],
  };
};

/** Time cards: PowerPlays whose main value is clock time or a clock rescue. A PowerPlay offer shows
 * at most one (limitTimeCards in GameScreen.tsx). Timed challenges (Pop Quiz, Smell Ya Later!)
 * aren't here: they test speed rather than hand out time. */
export const TIME_CARD_IDS = new Set([
  'timeBoost', 'timeTurner', 'saveByTheBell', 'happyPlace', 'deepFreeze', 'groundhogsDay', 'continueScreen',
  'hotTubTimeMachine', 'scroogeSwipe', 'leafOnTheWind', 'lifeFindsAWay', 'rewind', 'neosChoice',
  'multiverseOfSadness', 'jackass', 'fluncleIsProud',
]);

/** PowerPlays that fire the moment you pick them, so you also keep the one you're holding. */
export const INSTANT_POWER_PLAY_IDS = new Set([
  'thwomped', 'fluncleIsProud',
  'strikeShield', 'plotArmor', 'saveByTheBell', 'timeTurner', 'mutationProtocol',
  'deepFreeze', 'groundhogsDay', 'lifeFindsAWay', 'wildcardWake', 'continueScreen',
  // v7.67.7 (the owner's call): these waited in the pocket for no reason. Hadouken! already waits
  // for a boss (3 of 7 picks were never used); the strike removers were wasted at 0 strikes, so
  // they now wait for your next strike; Neuralyzer's offer comes with the next word anyway.
  'hadouken', 'chubbsPepTalk', 'rewind', 'neuralyzer',
  // Timed or blind challenges, and Daily Double's bet, start on the fresh hand, so a player can't
  // wait for (or build) the right word before they begin.
  'popQuizHotshot', 'smellYaLater', 'birdBox', 'dailyDouble', 'missionImpossible',
  // The Price Is Right (v7.36.5): the bid comes first, on the fresh hand. Held in the pocket, a
  // player could build a word, read its score, and only then bid.
  'priceIsRight',
  // Psychic Friends Network (v7.54.0): the call comes first, on the fresh hand, like a bid.
  'psychicFriends',
  // Are You Smarter Than a 5th Grader? (v7.65.0): class starts the moment it's picked.
  'fifthGrader',
  // Center Square (v7.79.0): its board card opens on pick (it used to arm a board above the tiles).
  'centerSquare',
]);

export const POWER_PLAYS_LIST: PowerPlay[] = [
  {
    id: 'letterUpgrade',
    name: 'Pimp My Tile',
    description: `Pick a letter: its tiles are worth x3 points for your next 5 words.`,
    flavorText: 'Yo dawg, I heard you like letters.',
    icon: '🔠',
    subtheme: 'score',
    effectType: 'selection',
    selectionType: 'letter',
    durationTag: 'LIMITED',
    activate: letterBoost('letterUpgrade', 5),
  },
  {
    id: 'polish',
    name: 'Extreme Makeover',
    description: `Pick a letter: words containing it score x3 for your next ${POWER_PLAY_VALUES.boostWords} words.`,
    flavorText: 'Move that bus!',
    icon: '💅',
    subtheme: 'score',
    effectType: 'selection',
    selectionType: 'letter',
    durationTag: 'LIMITED',
    activate: letterBoost('polish', POWER_PLAY_VALUES.boostWords),
  },
  {
    id: 'wildcardWake',
    name: "Gambit's Reshuffle",
    description: `Get 2 free shuffles.`,
    flavorText: 'The Ragin\' Cajun never plays the hand he\'s dealt. (X-Men)',
    icon: '🃏',
    subtheme: 'rack',
    effectType: 'immediate',
    durationTag: 'ONE_TIME',
    activate: (gameState) => ({ shuffleCount: (gameState.shuffleCount || 0) + 2 }),
  },
  {
    id: 'deepFreeze',
    name: 'Everybody Chill',
    description: `Works as soon as you take it: the first time your clock hits 0, you get +${TIME_BONUS.rescue} seconds.`,
    flavorText: "Alright everyone... chill!",
    icon: '🧊',
    subtheme: 'timer',
    effectType: 'passive',
    durationTag: 'ONE_TIME',
    oncePerRun: true,
    activate: arm('deepFreeze'),
  },
  {
    id: 'groundhogsDay',
    name: 'Groundhog’s Day',
    description: `Works as soon as you take it: if your clock runs out before you play a word on this hand, you get the same tiles and a fresh clock.`,
    flavorText: 'Same tiles. Same time. One more shot.',
    icon: '🔄',
    subtheme: 'timer',
    effectType: 'passive',
    oncePerRun: true,
    durationTag: 'ONE_TIME',
    activate: (gameState: GameState): Partial<GameState> => {
      const powerPlay = POWER_PLAYS_LIST.find(p => p.id === 'groundhogsDay')!;
      return {
        groundhogDayCharges: (gameState.groundhogDayCharges || 0) + 1,
        activeBuffs: [...gameState.activeBuffs.filter(b => b.id !== 'groundhogsDay'), powerPlay],
      };
    },
  },
  {
    id: 'oneTileToRuleThemAll',
    name: 'One Tile to Rule Them All',
    description: 'A random tile in your hand becomes worth 30 points for your next word.',
    flavorText: 'Frodo carried one ring. You get one tile. (The Lord of the Rings)',
    icon: '💍',
    subtheme: 'rack',
    effectType: 'immediate',
    durationTag: 'ONE_TIME',
    activate: () => ({}), // The tile is picked in the GameScreen reducer.
  },
  {
    id: 'shapeshiftersTongue',
    name: 'Shapeshifter’s Tongue',
    description: `Change one tile in your hand to any letter you like. The new tile is worth ${POWER_PLAY_VALUES.shapeshifterPoints} points.`,
    flavorText: 'Mystique can be anyone. Your tile can be any letter. (X-Men)',
    icon: '👅',
    subtheme: 'rack',
    effectType: 'selection',
    selectionType: 'tile_transform',
    durationTag: 'ONE_TIME',
    activate: () => ({}), // Handled by the tile-transform picker in the GameScreen reducer.
  },
  {
    id: 'konamiCode',
    name: 'Konami Code',
    description: 'Your next 3 words each score x2.',
    flavorText: '↑ ↑ ↓ ↓ ← → ← → B A. Thirty extra lives not included.',
    icon: '⬆️',
    subtheme: 'score',
    effectType: 'next_word',
    durationTag: 'LIMITED',
    activate: arm('konamiCode', { words: 3 }),
  },
  {
    id: 'warpZone',
    name: 'Warp Zone',
    description: `Your next valid word starts a Golden Round.`,
    flavorText: 'Welcome to Warp Zone! Pick a pipe, any pipe.',
    icon: '🍄',
    subtheme: 'utility',
    effectType: 'immediate',
    durationTag: 'ONE_TIME',
    activate: (gameState) => ({
      consecutiveValidWords: Math.max(gameState.consecutiveValidWords, gameState.goldenRoundThreshold - 1),
    }),
  },
  {
    id: 'whoYouGonnaCall',
    name: 'Who You Gonna Call?',
    description: `Clears ALL your strikes, for 15 seconds off your clock.`,
    finePrint: `It never leaves you under 5 seconds.`,
    flavorText: 'The Ghostbusters handle strikes now.',
    icon: '👻',
    subtheme: 'strike',
    effectType: 'immediate',
    oncePerRun: true,
    durationTag: 'ONE_TIME',
    activate: () => ({ strikes: 0 }),
  },
  {
    id: 'lifeFindsAWay',
    name: 'Life Finds a Way',
    description: `Works as soon as you take it: when a strike would end your run, you survive with one strike to spare and +20 seconds.`,
    flavorText: 'Life, uh, finds a way.',
    icon: '🥚',
    subtheme: 'strike',
    effectType: 'passive',
    oncePerRun: true,
    durationTag: 'ONE_TIME',
    activate: arm('lifeFindsAWay'),
  },
  {
    id: 'bigHeadMode',
    name: 'Big Head Mode',
    description: `Every tile is worth x2 points for your next 2 words.`,
    flavorText: 'GoldenEye cheat unlocked. Your letters have never looked so bobbleheaded.',
    icon: '🗿',
    subtheme: 'score',
    effectType: 'next_word',
    durationTag: 'LIMITED',
    activate: arm('bigHeadMode', { words: 2 }),
  },
  {
    id: 'ludicrousSpeed',
    name: 'Ludicrous Speed',
    description: `For ${POWER_PLAY_VALUES.ludicrousSeconds} seconds your clock freezes and every word scores x${POWER_PLAY_VALUES.ludicrousSpeedMultiplier}.`,
    flavorText: 'They’ve gone to plaid!',
    icon: '🚀',
    subtheme: 'score',
    effectType: 'immediate',
    durationTag: 'LIMITED',
    // v7.55.0: a frozen-clock sprint (it ends when the freeze runs out: TICK_FREEZE).
    activate: (gameState: GameState): Partial<GameState> => ({ ...arm('ludicrousSpeed')(gameState), freezeLeft: Math.max(gameState.freezeLeft ?? 0, POWER_PLAY_VALUES.ludicrousSeconds) }),
  },
  {
    id: 'gadgetHands',
    name: 'Go-Go-Gadget Hands',
    description: `Get 2 extra tiles now. Your hand refills to 10 tiles instead of 8 for your next 2 hands.`,
    flavorText: 'Wowsers! Extendable arms, extendable words.',
    icon: '🦾',
    subtheme: 'rack',
    effectType: 'immediate',
    durationTag: 'LIMITED',
    activate: arm('gadgetHands', { rounds: 2 }),
  },
  {
    id: 'upsideDown',
    name: 'The Upside Down',
    description: `Your next word only: common letters (E, A, S…) are worth 10 points and rare ones (Q, Z…) 1.`,
    flavorText: 'Everything’s backwards down here. Even the scoring.',
    icon: '🔦',
    subtheme: 'score',
    effectType: 'next_word',
    durationTag: 'ONE_TIME',
    activate: arm('upsideDown'),
  },
  {
    id: 'comboBreaker',
    name: 'Combo Breaker',
    description: `Your next ${POWER_PLAY_VALUES.comboBreakerWords} words: each ${POWER_PLAY_VALUES.comboBreakerMinLength}+ letter word scores x${POWER_PLAY_VALUES.comboBreakerMultiplier}. A shorter word scores 0 and breaks the combo.`,
    flavorText: 'C-C-C-COMBO BREAKER! Go big or go home.',
    icon: '🥊',
    subtheme: 'score',
    effectType: 'next_word',
    durationTag: 'LIMITED',
    activate: arm('comboBreaker', { words: POWER_PLAY_VALUES.comboBreakerWords }),
  },
  { 
    id: 'timeBoost', 
    name: 'Most Excellent Detour',
    description: `+${TIME_BONUS.timeBoost} seconds on your clock.`, 
    flavorText: 'Be excellent to each other. And party on, dudes!',
    icon: '📞',
    subtheme: 'timer',
    effectType: 'immediate',
    durationTag: 'ONE_TIME',
    activate: (gameState) => ({...gameState}) // Handled directly in reducer due to affecting screen state
  },
  { 
    id: 'biglyScore', 
    name: "Let's Get Ready to Rumble!",
    description: `Your next word scores x4.`, 
    flavorText: "Let's get ready to rumbllllle!",
    icon: '🎙️',
    subtheme: 'score',
    effectType: 'next_word',
    durationTag: 'ONE_TIME',
    activate: (gameState) => {
        const powerPlay = POWER_PLAYS_LIST.find(p => p.id === 'biglyScore')!;
        return { 
            activePowerPlays: { ...gameState.activePowerPlays, biglyScore: true },
            activeBuffs: [...gameState.activeBuffs, powerPlay]
        };
    }
  },
  { 
    id: 'strikeShield', 
    name: 'Hylian Shield',
    description: `Blocks your next strike.`, 
    flavorText: "It's dangerous to go alone. Hold this up.",
    icon: '🛡️',
    subtheme: 'strike',
    effectType: 'passive',
    durationTag: 'ONE_TIME',
    activate: (gameState) => {
      const powerPlay = POWER_PLAYS_LIST.find(p => p.id === 'strikeShield')!;
      return { activePowerPlays: { ...gameState.activePowerPlays, strikeShield: true }, activeBuffs: [...gameState.activeBuffs, powerPlay] };
    }
  },
   { 
    id: 'swapOut', 
    name: 'Trading Spaces',
    description: 'Replace 4 or 5 tiles of your choice with new random ones.',
    flavorText: 'New tiles, new room. Try not to cry at the reveal.',
    icon: '🔃',
    subtheme: 'rack',
    effectType: 'selection',
    selectionType: 'tile_swap',
    swapConfig: { min: 4, max: 5 },
    durationTag: 'ONE_TIME',
    activate: (gameState) => ({...gameState}) // Logic is handled in the reducer
  },
   { 
    id: 'wordLock', 
    name: 'Game Genie',
    description: 'Submit any word of 5 letters or fewer, real or not.',
    flavorText: 'Enter the code. Break the game.',
    icon: '🔓',
    subtheme: 'utility',
    effectType: 'next_word',
    durationTag: 'ONE_TIME',
    activate: (gameState) => {
      const powerPlay = POWER_PLAYS_LIST.find(p => p.id === 'wordLock')!;
      return { 
          activePowerPlays: { ...gameState.activePowerPlays, wordLock: true },
          activeBuffs: [...gameState.activeBuffs, powerPlay]
      };
    }
  },
  { 
    id: 'plotArmor', 
    name: 'Plot Armor', 
    description: `Your next strike doesn't count: it costs 150 points instead.`,
    flavorText: 'It’s not a fail. It’s... character development.',
    icon: '💸',
    subtheme: 'strike',
    effectType: 'passive',
    durationTag: 'ONE_TIME',
    activate: (gameState) => {
      const powerPlay = POWER_PLAYS_LIST.find(p => p.id === 'plotArmor')!;
      return { activePowerPlays: { ...gameState.activePowerPlays, plotArmor: true }, activeBuffs: [...gameState.activeBuffs, powerPlay] };
    }
  },
  { 
    id: 'multiverseOfSadness', 
    name: 'In Time',
    description: `Your next word scores half its points; the other half become seconds on your clock (up to ${TIME_BONUS.multiverseCap}).`, 
    flavorText: 'Time is money. Spend it wisely.',
    icon: '⌚',
    subtheme: 'score',
    effectType: 'next_word',
    durationTag: 'ONE_TIME',
    activate: (gameState) => {
      const powerPlay = POWER_PLAYS_LIST.find(p => p.id === 'multiverseOfSadness')!;
      return { 
          activePowerPlays: { ...gameState.activePowerPlays, multiverseOfSadness: true },
          activeBuffs: [...gameState.activeBuffs, powerPlay]
      };
    }
  },
  { 
    id: 'nuclearOption', 
    name: 'Nuclear Option', 
    description: `Replace your whole hand. Your next word scores x${POWER_PLAY_VALUES.nuclearOptionMultiplier}.`,
    flavorText: 'Shall we play a new hand? (WarGames)',
    icon: '☢️',
    subtheme: 'rack',
    effectType: 'selection',
    durationTag: 'ONE_TIME',
    activate: (gameState) => {
      const powerPlay = POWER_PLAYS_LIST.find(p => p.id === 'nuclearOption')!;
      return { 
          activePowerPlays: { ...gameState.activePowerPlays, nuclearOption: true },
          activeBuffs: [...gameState.activeBuffs, powerPlay]
      };
    }
  },
  { 
    id: 'echoesOfThePast', 
    name: 'Echoes of the Past', 
    description: `Score your best word of the run again, for its original points.`, 
    flavorText: 'Play it again, Sam. Close enough. (Casablanca)',
    icon: '🔁',
    subtheme: 'score',
    effectType: 'immediate',
    durationTag: 'ONE_TIME',
    activate: (gameState) => ({...gameState}) // Handled in GameScreen
  },
  { 
    id: 'rewind', 
    name: 'Turn Back Time',
    description: `Removes your last strike and adds +${TIME_BONUS.rescue} seconds.`,
    finePrint: `No strikes? It erases your next one instead, seconds included.`, 
    flavorText: 'Cher had the right idea.',
    icon: '⏪',
    subtheme: 'strike',
    effectType: 'immediate',
    durationTag: 'ONE_TIME',
    oncePerRun: true,
    activate: (gameState) => strikeEraser('rewind', gameState), // v7.67.7: see chubbsPepTalk
  },
  { 
    id: 'fluncleIsProud', 
    name: 'Fluncle is Proud', 
    description: `Your proud Fluncle slips you +${POWER_PLAY_VALUES.fluncleProud} points and +${POWER_PLAY_VALUES.fluncleSeconds} seconds, right now.`, 
    flavorText: 'Fluncle approves this chaos.',
    icon: '🧓',
    subtheme: 'score',
    effectType: 'immediate',
    durationTag: 'ONE_TIME',
    activate: (gameState) => ({...gameState}) // Handled in GameScreen
  },
  { 
    id: 'fortunesFavor', 
    name: "Fortune's Favor", 
    description: `Shake the Magic 8-Ball: ${Math.round((1 - POWER_PLAY_VALUES.fortuneLoseChance - POWER_PLAY_VALUES.fortuneJackpotChance) * 100)}% +${POWER_PLAY_VALUES.fortuneWin} points, ${Math.round(POWER_PLAY_VALUES.fortuneJackpotChance * 100)}% +${POWER_PLAY_VALUES.fortuneJackpot}, ${Math.round(POWER_PLAY_VALUES.fortuneLoseChance * 100)}% you lose ${POWER_PLAY_VALUES.fortuneLose}.`,
    flavorText: 'Reply hazy, try again. (Just kidding. Shake it.)',
    icon: '🎱',
    subtheme: 'score',
    effectType: 'immediate',
    durationTag: 'ONE_TIME',
    activate: (gameState) => ({...gameState}) // Handled in GameScreen
  },
  { 
    id: 'timeTurner', 
    name: 'Time Turner', 
    description: `Your next 2 words each add +${TIME_BONUS.timeTurner} extra seconds.`,
    flavorText: 'Like Hermione in third year, you\'ve got time to do it all—twice.',
    icon: '⌛',
    subtheme: 'timer',
    effectType: 'passive',
    oncePerRun: true,
    durationTag: 'LIMITED',
    activate: (gameState) => {
      const powerPlay = POWER_PLAYS_LIST.find(p => p.id === 'timeTurner')!;
      return { 
        activePowerPlays: { ...gameState.activePowerPlays, timeTurner: { rounds: 2 } }, 
        activeBuffs: [...gameState.activeBuffs, powerPlay] 
      };
    }
  },
  { 
    id: 'schruteBucks', 
    name: 'Schrute Bucks', 
    description: `Start a beet farm: for your next ${POWER_PLAY_VALUES.schruteBucksWords} words, every ${POWER_PLAY_VALUES.schruteBucksLetters.split('').join(', ').replace(/, (\w)$/, ' or $1')} you play earns +${POWER_PLAY_VALUES.schruteBucksPerLetter} points.`,
    flavorText: 'Bears. Beets. Battlestar Galactica.',
    icon: '💵',
    subtheme: 'score',
    effectType: 'immediate',
    durationTag: 'ONE_TIME',
    activate: (gameState) => ({...gameState}) // Handled in GameScreen
  },
  { 
    id: 'redWedding', 
    name: 'Red Wedding', 
    description: `You lose 2 random tiles. Your next word scores x5.`, 
    flavorText: 'The Lannisters send their regards.',
    icon: '🍷',
    subtheme: 'score',
    effectType: 'selection',
    durationTag: 'ONE_TIME',
    activate: (gameState) => {
      const powerPlay = POWER_PLAYS_LIST.find(p => p.id === 'redWedding')!;
      return { 
          activePowerPlays: { ...gameState.activePowerPlays, redWedding: true },
          activeBuffs: [...gameState.activeBuffs, powerPlay]
      };
    }
  },
    {
    id: 'mutationProtocol',
    name: 'Secret of the Ooze',
    description: 'Your next 2 hands each come with a x4 word tile.',
    flavorText: 'The Ooze made four turtles. You get two tiles.',
    icon: '🧬',
    subtheme: 'rack',
    effectType: 'passive',
    durationTag: 'LIMITED',
    activate: (gameState) => {
      const powerPlay = POWER_PLAYS_LIST.find(p => p.id === 'mutationProtocol')!;
      return { 
        activePowerPlays: { ...gameState.activePowerPlays, mutationProtocol: { rounds: 3 } }, 
        activeBuffs: [...gameState.activeBuffs, powerPlay] 
      };
    }
  },
  { 
    id: 'wakandaForever', 
    name: 'Wakanda Forever', 
    description: `For your next word, every tile is worth at least 15 points.`, 
    flavorText: 'What are those?!',
    icon: '🐾',
    subtheme: 'score',
    effectType: 'next_word',
    durationTag: 'ONE_TIME',
    activate: (gameState) => {
      const powerPlay = POWER_PLAYS_LIST.find(p => p.id === 'wakandaForever')!;
      return { 
          activePowerPlays: { ...gameState.activePowerPlays, wakandaForever: true },
          activeBuffs: [...gameState.activeBuffs, powerPlay]
      };
    }
  },
  { 
    id: 'neosChoice', 
    name: "Neo's Choice", 
    description: `Pick one: +${TIME_BONUS.rescue} seconds, or erase a strike.`, 
    flavorText: 'This is your last chance. After this, there is no turning back.',
    icon: '💊',
    subtheme: 'utility',
    effectType: 'selection',
    selectionType: 'custom',
    durationTag: 'ONE_TIME',
    activate: (gameState) => ({...gameState})
  },
  { 
    id: 'thanosGift', 
    name: 'Gift From Thanos', 
    description: `+${POWER_PLAY_VALUES.thanosGiftPoints} points now, but your next word of ${POWER_PLAY_VALUES.thanosGiftLetters}+ letters scores 0.`,
    flavorText: 'Balance restored. But not without cost.',
    icon: '🫰',
    subtheme: 'score',
    effectType: 'next_word',
    durationTag: 'ONE_TIME',
    activate: (gameState) => {
      const powerPlay = POWER_PLAYS_LIST.find(p => p.id === 'thanosGift')!;
      // v7.35: the gift is paid on the spot (it grows with the level, like other prizes).
      const level = levelFor(gameState.log.filter(e => e.type === 'word' && e.status === 'valid').length);
      const points = prizeFor(POWER_PLAY_VALUES.thanosGiftPoints, level);
      const score = gameState.score + points;
      const entry: EventLogEntry = { type: 'event', id: `pp-thanosGift-${Date.now()}`, name: powerPlay.name, icon: powerPlay.icon, description: `+${points} points now. The next ${POWER_PLAY_VALUES.thanosGiftLetters}+ letter word scores 0.`, scoreChange: points, cumulativeScore: score };
      return { 
          score,
          log: [...gameState.log, entry],
          lastPowerPlayResult: { message: `🫰 +${points} points. Your next ${POWER_PLAY_VALUES.thanosGiftLetters}+ letter word scores 0.`, scoreChange: points },
          activePowerPlays: { ...gameState.activePowerPlays, thanosGift: true },
          activeBuffs: [...gameState.activeBuffs, powerPlay]
      };
    }
  },
  { 
    id: 'heisenberg', 
    name: 'Heisenberg', 
    description: `Coin flip: your next word scores x3 or 0.`, 
    flavorText: 'I am the one who knocks.',
    icon: '⚗️',
    subtheme: 'score',
    effectType: 'next_word',
    durationTag: 'ONE_TIME',
    activate: (gameState) => {
      const powerPlay = POWER_PLAYS_LIST.find(p => p.id === 'heisenberg')!;
      return { 
          activePowerPlays: { ...gameState.activePowerPlays, heisenberg: true },
          activeBuffs: [...gameState.activeBuffs, powerPlay]
      };
    }
  },
  { 
    id: 'skywalkerBloodline', 
    name: 'Skywalker Bloodline', 
    description: `S tiles in your hand are worth 15 points for your next word.`, 
    flavorText: 'The Force is strong with this one.',
    icon: '🌌',
    subtheme: 'score',
    effectType: 'next_word',
    durationTag: 'ONE_TIME',
    activate: (gameState) => {
      const powerPlay = POWER_PLAYS_LIST.find(p => p.id === 'skywalkerBloodline')!;
      return { 
          activePowerPlays: { ...gameState.activePowerPlays, skywalkerBloodline: true },
          activeBuffs: [...gameState.activeBuffs, powerPlay]
      };
    }
  },
  { 
    id: 'hookshot', 
    name: 'Hookshot', 
    description: `Pick a letter: a twin tile joins your hand, worth x${POWER_PLAY_VALUES.hookshotMultiplier} its points.`,
    flavorText: 'You got the Hookshot!',
    icon: '🪝',
    subtheme: 'rack',
    effectType: 'selection',
    selectionType: 'custom',
    durationTag: 'ONE_TIME',
    activate: (gameState) => ({...gameState})
  },
  { 
    id: 'leafOnTheWind', 
    name: 'Leaf on the Wind', 
    description: `Your clock stops until you play your next word.`, 
    flavorText: 'I am a leaf on the wind. Watch how I soar.',
    icon: '🍃',
    subtheme: 'timer',
    effectType: 'immediate',
    durationTag: 'ONE_TIME',
    activate: (gameState) => {
      const powerPlay = POWER_PLAYS_LIST.find(p => p.id === 'leafOnTheWind')!;
      return { 
          activePowerPlays: { ...gameState.activePowerPlays, leafOnTheWind: true },
          activeBuffs: [...gameState.activeBuffs, powerPlay]
      };
    }
  },
  {
    id: 'yoshisWildRide',
    name: "Yoshi's Wild Ride",
    description: `Swap up to 3 tiles of your choice for new ones, without using a shuffle.`,
    flavorText: "Spit out your tiles and swallow new ones!",
    icon: '🍎',
    subtheme: 'rack',
    effectType: 'selection',
    selectionType: 'tile_swap',
    swapConfig: { min: 1, max: 3 },
    durationTag: 'ONE_TIME',
    activate: (gameState) => ({...gameState})
  },
  {
    id: 'bobKelso',
    name: "Bob Kelso",
    description: `+100 points and a fresh hand, free.`,
    flavorText: "What has two thumbs and doesn’t give a crap? Bob Kelso. Nice to meet you.",
    icon: '👨‍⚕️',
    subtheme: 'score',
    effectType: 'immediate',
    durationTag: 'ONE_TIME',
    activate: (gameState) => ({...gameState}) // Handled in GameScreen
  },
  {
    id: 'centerSquare',
    name: 'Center Square',
    description: `Starts right away: Hollywood Squares with fresh tiles, ${POWER_PLAY_VALUES.centerSquareTurns} words in ${POWER_PLAY_VALUES.centerSquareSeconds} seconds. Each word fills a square it fits (like ENDS IN S): +${POWER_PLAY_VALUES.centerSquarePerSquare} a square, +${POWER_PLAY_VALUES.centerSquareLineBonus} a line, +${POWER_PLAY_VALUES.centerSquareFullBonus} a full board.`,
    finePrint: `No shuffles. Your run's clock waits while you play.`,
    flavorText: 'I\'ll take Paul Lynde to block! (Hollywood Squares)',
    icon: '⭕',
    subtheme: 'score',
    effectType: 'immediate',
    durationTag: 'ONE_TIME',
    activate: () => ({}), // Handled in GameScreen (fires on pick: the board card). v7.74-7.78 armed a 10-word board above the tiles; old saves still settle it.
  },
  {
    id: 'surveySays',
    name: 'Survey Says!',
    description: `Find ${POWER_PLAY_VALUES.surveyPrizes.length} hidden words your tiles can spell in ${POWER_PLAY_VALUES.surveySeconds} seconds. They pay ${POWER_PLAY_VALUES.surveyPrizes.map(p => `+${p}`).join(', ')}, plus +${POWER_PLAY_VALUES.surveyClear} for all ${POWER_PLAY_VALUES.surveyPrizes.length}.`,
    finePrint: `The board shows each word's length, longest first. A fake word or one that fits no open slot is a miss; ${POWER_PLAY_VALUES.surveyStrikes} misses end it.`,
    flavorText: 'Good answer! Good answer! (Family Feud)',
    icon: '📊',
    subtheme: 'score',
    effectType: 'immediate',
    durationTag: 'ONE_TIME',
    activate: (gameState) => ({...gameState}) // A gamble card (SurveySays in GambleCard.tsx)
  },
  {
    id: 'gumpLuck',
    name: "Gump Luck",
    description: `Unwrap a chocolate: +${TIME_BONUS.rescue} seconds, +${POWER_PLAY_VALUES.gumpLuckPoints} points, +1 shuffle or nothing (25% each).`,
    flavorText: "Life is like a box of chocolates. You never know what you're gonna get.",
    icon: '🍫',
    subtheme: 'utility',
    effectType: 'immediate',
    durationTag: 'ONE_TIME',
    activate: (gameState) => ({...gameState}) // Handled in GameScreen
  },
  {
    id: 'happyPlace',
    name: 'Happy Place',
    description: `Fills your clock to the top.`,
    flavorText: 'Just tap it in. Give it a little tappy. Tap tap taparoo.',
    icon: '⛳',
    subtheme: 'timer',
    effectType: 'immediate',
    maxUses: 1,
    oncePerRun: true,
    durationTag: 'ONE_TIME',
    activate: (gameState) => ({...gameState}) // Handled in GameScreen
  },
  {
    id: 'chubbsPepTalk',
    name: 'Chubbs’ Pep Talk',
    description: `Removes one of your strikes.`,
    finePrint: `No strikes? It erases your next one instead.`,
    flavorText: 'Just easin’ the tension, baby.',
    icon: '💪',
    subtheme: 'strike',
    effectType: 'immediate',
    maxUses: 1,
    oncePerRun: true,
    durationTag: 'ONE_TIME',
    // v7.67.7: fires on pick. With a strike it removes one now; without, it waits for the next strike.
    activate: (gameState) => strikeEraser('chubbsPepTalk', gameState),
  },
  {
    id: 'cassiesClue',
    name: 'Cassie’s Clue',
    description: `Swap up to 3 tiles for C, A and T. The first word you play with all three (CAT, ACT, TACO, COAT) scores x3.`,
    flavorText: 'Cassie the cat left you a clue: C, A, T.',
    icon: '🐈',
    subtheme: 'rack',
    effectType: 'selection',
    selectionType: 'custom',
    swapConfig: { min: 0, max: 3 },
    durationTag: 'ONE_TIME',
    activate: (gameState) => {
      const powerPlay = POWER_PLAYS_LIST.find(p => p.id === 'cassiesClue')!;
      return { 
          activePowerPlays: { ...gameState.activePowerPlays, cassiesClue: true },
          activeBuffs: [...gameState.activeBuffs, powerPlay]
      };
    }
  },
  {
    id: 'doubleOrNothing',
    name: 'Double or Nothing',
    description: `Your next word: ${POWER_PLAY_VALUES.doubleOrNothingWinChance * 100}% it scores x2, ${100 - POWER_PLAY_VALUES.doubleOrNothingWinChance * 100}% it scores 0.`,
    flavorText: 'Never tell me the odds. (Star Wars)',
    icon: '🪙',
    subtheme: 'score',
    effectType: 'next_word',
    durationTag: 'ONE_TIME',
    activate: (gameState) => {
      const powerPlay = POWER_PLAYS_LIST.find(p => p.id === 'doubleOrNothing')!;
      return { 
          activePowerPlays: { ...gameState.activePowerPlays, doubleOrNothing: true },
          activeBuffs: [...gameState.activeBuffs, powerPlay]
      };
    }
  },
  {
    id: 'cowabunga',
    name: 'Cowabunga!',
    description: `Every consonant in your next word earns +10 points.`,
    flavorText: 'Turtle Power fuels your next word.',
    icon: '🐢',
    subtheme: 'score',
    effectType: 'next_word',
    durationTag: 'ONE_TIME',
    activate: (gameState) => {
      const powerPlay = POWER_PLAYS_LIST.find(p => p.id === 'cowabunga')!;
      return {
          activePowerPlays: { ...gameState.activePowerPlays, cowabunga: true },
          activeBuffs: [...gameState.activeBuffs, powerPlay]
      };
    }
  },
  {
    id: 'carmenSandiego',
    name: 'Where in the World is Carmen Sandiego?',
    description: `Lights up a word you can play, its first letter in red.`,
    flavorText: 'The ACME Detective Agency found a lead in your tiles.',
    icon: '🗺️',
    subtheme: 'utility',
    effectType: 'immediate',
    durationTag: 'ONE_TIME',
    activate: (gameState) => ({...gameState}) // Handled in GameScreen
  },
  {
    id: 'morphinTime',
    name: 'It’s Morphin Time!',
    description: 'Two random tiles become a x2 and a x4 word tile.',
    flavorText: 'Zordon gave your tiles an upgrade. (Power Rangers)',
    icon: '⚡️',
    subtheme: 'rack',
    effectType: 'immediate',
    durationTag: 'ONE_TIME',
    activate: (gameState) => ({...gameState}) // Handled in GameScreen
  },
  {
    id: 'sliders',
    name: 'Sliders',
    description: `Undo your last word: your score, clock and tiles go back.`,
    flavorText: 'Same tiles, one universe over. (Sliders)',
    icon: '📼',
    subtheme: 'utility',
    effectType: 'immediate',
    maxUses: 1,
    oncePerRun: true,
    durationTag: 'ONE_TIME',
    activate: (gameState) => ({...gameState}) // Handled in GameScreen
  },
  {
    id: 'treehouseOfHorror',
    name: 'Treehouse of Horror',
    description: 'For your next 3 hands, every tile is worth a random number of points.',
    flavorText: 'The Simpsons\' Halloween special, for your tiles.',
    icon: '🎃',
    subtheme: 'rack',
    effectType: 'immediate',
    durationTag: 'LIMITED',
    activate: (gameState) => {
      const powerPlay = POWER_PLAYS_LIST.find(p => p.id === 'treehouseOfHorror')!;
      return {
        activePowerPlays: { ...gameState.activePowerPlays, treehouseOfHorror: { rounds: 4 } },
        activeBuffs: [...gameState.activeBuffs, powerPlay]
      };
    }
  },
  {
    id: 'captainPlanet',
    name: 'Captain Planet',
    description: `Pick a tile: it's worth 20 points for your next word.`,
    flavorText: 'The power is yours!',
    icon: '🌎',
    subtheme: 'rack',
    effectType: 'selection',
    selectionType: 'custom',
    durationTag: 'ONE_TIME',
    activate: (gameState) => ({...gameState}) // Handled in GameScreen
  },
  {
    id: 'duckHunt',
    name: 'Duck Hunt',
    description: `${POWER_PLAY_VALUES.duckSeconds} seconds of shooting: +${POWER_PLAY_VALUES.duckPoints} a 🦆 duck, -${POWER_PLAY_VALUES.duckPenalty} for hitting a 🕊️ dove or the 🐕 dog.`,
    flavorText: 'Grab the Zapper. Don’t let the dog laugh.',
    icon: '🦆',
    subtheme: 'score',
    effectType: 'immediate',
    durationTag: 'ONE_TIME',
    activate: () => ({}), // A gamble card (v7.55.0: a shooting gallery)
  },
  {
    id: 'thwomped',
    name: 'Thwomped!',
    description: `+1 STUCK? check (it checks whether your tiles can make a word).`,
    flavorText: 'You’ve been Mario Kart’d.',
    icon: '🧱',
    subtheme: 'utility',
    effectType: 'immediate',
    durationTag: 'ONE_TIME',
    activate: (gameState) => ({...gameState}) // Handled in GameScreen
  },
  {
    id: 'pinkyAndTheBrain',
    name: 'Pinky and the Brain',
    description: "Gain half your best word's score now, and your next word scores x2.",
    flavorText: 'Same thing we do every night, Pinky. Try to take over the world!',
    icon: '🧠',
    subtheme: 'score',
    effectType: 'next_word',
    durationTag: 'ONE_TIME',
    activate: (gameState) => {
      const powerPlay = POWER_PLAYS_LIST.find(p => p.id === 'pinkyAndTheBrain')!;
      return {
        activePowerPlays: { ...gameState.activePowerPlays, pinkyAndTheBrain: true },
        activeBuffs: [...gameState.activeBuffs, powerPlay]
      };
    }
  },
  {
    id: 'warioWarp',
    name: 'Wario Warp',
    description: `Pick a money bag: ${POWER_PLAY_VALUES.warioBags.map(b => `+${b.points} points for -${b.seconds} seconds`).join(', ')}.`,
    finePrint: `The seconds come off your clock right away.`,
    flavorText: 'Classic Wario — future problems, present profits.',
    icon: '💰',
    subtheme: 'score',
    effectType: 'immediate',
    durationTag: 'ONE_TIME',
    activate: (gameState) => ({...gameState}) // Handled in GameScreen
  },
  {
    id: 'animaniacsMayhem',
    name: 'Animaniacs Mayhem',
    description: `A fresh hand with two x2 word tiles.`,
    flavorText: 'The Warner siblings got out of the water tower again.',
    icon: '🌪️',
    subtheme: 'rack',
    effectType: 'immediate',
    durationTag: 'ONE_TIME',
    activate: (gameState) => {
      // NOTE: The current implementation for this PowerPlay is hardcoded in GameScreen.tsx
      // and is flawed. It creates new tiles instead of drawing from the bag, which
      // violates bag integrity, and it creates one 4x tile instead of two 2x tiles.
      // A fix requires modifying GameScreen.tsx, which is restricted.
      return {...gameState};
    }
  },
  {
    id: 'donkeyKongSmash',
    name: 'Donkey Kong Smash',
    description: `A fresh hand, and one new tile is a x${POWER_PLAY_VALUES.donkeyKongMultiplier} word tile.`,
    flavorText: 'DK brought a barrel.',
    icon: '🐵',
    subtheme: 'rack',
    effectType: 'immediate',
    durationTag: 'ONE_TIME',
    activate: (gameState) => ({...gameState}) // Handled in GameScreen
  },
  {
    id: 'tetrisTouch',
    name: 'Tetris Touch',
    description: `If your next word alternates vowels and consonants (BANANA, TOMATO), it scores x4.`,
    flavorText: 'Fit a perfect pattern.',
    icon: '🧩',
    subtheme: 'score',
    effectType: 'next_word',
    durationTag: 'ONE_TIME',
    activate: (gameState) => {
      const powerPlay = POWER_PLAYS_LIST.find(p => p.id === 'tetrisTouch')!;
      return { 
        activePowerPlays: { ...gameState.activePowerPlays, tetrisTouch: true },
        activeBuffs: [...gameState.activeBuffs, powerPlay]
      };
    }
  },
  {
    id: 'saveByTheBell',
    name: 'Saved by the Bell',
    description: `Your next 3 words each add +${TIME_BONUS.saveByTheBell} seconds.`,
    flavorText: 'Zack Morris calls a time-out. (Saved by the Bell)',
    icon: '🪩',
    subtheme: 'timer',
    effectType: 'passive',
    durationTag: 'LIMITED',
    activate: (gameState) => {
      const powerPlay = POWER_PLAYS_LIST.find(p => p.id === 'saveByTheBell')!;
      return { 
        activePowerPlays: { ...gameState.activePowerPlays, saveByTheBell: { rounds: 3 } }, 
        activeBuffs: [...gameState.activeBuffs, powerPlay] 
      };
    }
  },
  {
    id: 'blueShellSurprise',
    name: 'Blue Shell Surprise',
    description: `Your next word: ${POWER_PLAY_VALUES.blueShellWinChance * 100}% it scores x${POWER_PLAY_VALUES.blueShellMultiplier}, ${100 - POWER_PLAY_VALUES.blueShellWinChance * 100}% it loses ${POWER_PLAY_VALUES.blueShellLoss} points.`,
    flavorText: 'Hit the leader — or yourself.',
    icon: '🔵',
    subtheme: 'score',
    effectType: 'next_word',
    durationTag: 'ONE_TIME',
    activate: (gameState) => {
      const powerPlay = POWER_PLAYS_LIST.find(p => p.id === 'blueShellSurprise')!;
      return { 
        activePowerPlays: { ...gameState.activePowerPlays, blueShellSurprise: true },
        activeBuffs: [...gameState.activeBuffs, powerPlay]
      };
    }
  },
  {
    id: 'iceIceMaybe',
    name: 'Ice Ice Maybe',
    description: `One random tile becomes a x4 word tile for this hand.`,
    flavorText: 'Vanilla Ice would freeze a tile too.',
    icon: '❄️',
    subtheme: 'rack',
    effectType: 'immediate',
    durationTag: 'ONE_TIME',
    activate: (gameState) => ({...gameState}) // Handled in GameScreen
  },
  { 
    id: 'rescueDrop', 
    name: 'Rescue Rangers',
    description: `A random tile leaves your hand and comes back next hand, worth 20 points.`,
    flavorText: 'Chip and Dale fly in to save a tile.',
    icon: '🐿️',
    subtheme: 'rack',
    effectType: 'immediate',
    durationTag: 'LIMITED',
    activate: (gameState) => ({...gameState}) // Handled in GameScreen
  },
  { 
    id: 'letsGetDangerous', 
    name: 'Let’s Get Dangerous', 
    description: `Your next word scores x1 per vowel in it (3 vowels: x3).`, 
    flavorText: 'Darkwing Duck counts the vowels before he strikes.',
    icon: '🔫',
    subtheme: 'score',
    effectType: 'next_word',
    durationTag: 'ONE_TIME',
    activate: (gameState) => {
        const powerPlay = POWER_PLAYS_LIST.find(p => p.id === 'letsGetDangerous')!;
        return { 
            activePowerPlays: { ...gameState.activePowerPlays, letsGetDangerous: true },
            activeBuffs: [...gameState.activeBuffs, powerPlay]
        };
    }
  },
  { 
    id: 'scroogeSwipe', 
    name: 'Scrooge’s Money Bin', 
    description: `${POWER_PLAY_VALUES.moneyBinSeconds} seconds of falling coins: tap them for +${POWER_PLAY_VALUES.moneyBinCoins.map(c => c.seconds).join(', +').replace(/, \+(\d+)$/, ' or +$1')} seconds each, up to +${POWER_PLAY_VALUES.moneyBinMaxSeconds}. Bombs and bolts cost ${POWER_PLAY_VALUES.moneyBinHazardSeconds} second each.`, 
    flavorText: 'Some say fortune favors the bold. Others say it favors the rich duck in a top hat.',
    icon: '🎩',
    subtheme: 'utility',
    effectType: 'immediate',
    durationTag: 'ONE_TIME',
    activate: () => ({}), // A gamble card (v7.55.1: catch coins worth seconds)
  },
  { 
    id: 'wordionaire', 
    name: 'Who Wants to Be a Wordionaire?', 
    description: `Pick a lifeline: Fast Cash (+100 points), Phone-a-Friend (shows your best word) or Double Down (next word x2).`, 
    flavorText: 'Big brains. Bigger words. Even bigger consequences.',
    icon: '💡',
    subtheme: 'utility',
    effectType: 'selection',
    selectionType: 'custom',
    durationTag: 'ONE_TIME',
    activate: (gameState) => ({...gameState})
  },
  { 
    id: 'moreThanMeets', 
    name: 'More Than Meets the Eye', 
    description: `Turn any tile into a random combo tile (TH, QU, ING…). The first word you play with it scores x${POWER_PLAY_VALUES.moreThanMeetsMultiplier}.`,
    flavorText: 'Autobots, assemble a better word.',
    icon: '🚗',
    subtheme: 'rack',
    effectType: 'selection',
    selectionType: 'custom',
    durationTag: 'ONE_TIME',
    activate: (gameState) => ({...gameState})
  },
  {
    id: 'slimShadyShuffle',
    name: 'Slim Shady Shuffle',
    description: `A fresh hand, and your next valid word earns +50 points.`,
    flavorText: 'Lose yourself… in the new letters.',
    icon: '🎤',
    subtheme: 'rack',
    effectType: 'immediate',
    durationTag: 'ONE_TIME',
    activate: (gameState) => {
        const powerPlay = POWER_PLAYS_LIST.find(p => p.id === 'slimShadyShuffle')!;
        return {
            activePowerPlays: { ...gameState.activePowerPlays, slimShadyShuffle: true },
            activeBuffs: [...gameState.activeBuffs, powerPlay]
        };
    }
  },
  {
    id: 'withGreatPower',
    name: 'With Great Power',
    description: `Take a strike on purpose for +500 points.`,
    finePrint: `Not when you're one strike from game over. The strike breaks any 💔 fragile charm.`,
    flavorText: 'With great power comes great responsibility… and great points.',
    icon: '🕷️',
    subtheme: 'strike',
    effectType: 'immediate',
    durationTag: 'ONE_TIME',
    activate: (gameState) => ({...gameState}) // Handled in GameScreen reducer
  },
  {
    id: 'spaceInvader',
    name: 'Space Invader',
    description: `Your next word: 50% it scores x${POWER_PLAY_VALUES.spaceInvaderMultiplier}, 50% it scores just ${POWER_PLAY_VALUES.spaceInvaderCap} points.`,
    flavorText: 'Destroy all words… or just barely survive.',
    icon: '👾',
    subtheme: 'score',
    effectType: 'next_word',
    durationTag: 'ONE_TIME',
    activate: (gameState) => {
        const powerPlay = POWER_PLAYS_LIST.find(p => p.id === 'spaceInvader')!;
        return {
            activePowerPlays: { ...gameState.activePowerPlays, spaceInvader: true },
            activeBuffs: [...gameState.activeBuffs, powerPlay]
        };
    }
  },
  {
    id: 'holdOntoYourButts',
    name: 'Hold Onto Your Butts',
    description: `Your next word only: ${POWER_PLAY_VALUES.rareLetters.split('').join(', ')} tiles are worth x${POWER_PLAY_VALUES.rareLetterMultiplier} points.`,
    flavorText: 'Hold onto your butts.',
    icon: '🔌',
    subtheme: 'score',
    effectType: 'next_word',
    durationTag: 'ONE_TIME',
    activate: arm('holdOntoYourButts'),
  },
  {
    id: 'buyAVowel',
    name: 'Buy a Vowel',
    description: `Pay ${POWER_PLAY_VALUES.buyAVowelCost} points and pick any vowel (A, E, I, O, U) to add to your hand.`,
    flavorText: "I'd like to buy a vowel, Pat.",
    icon: '🎡',
    subtheme: 'rack',
    effectType: 'selection',
    selectionType: 'letter',
    selectionLetters: 'AEIOU',
    durationTag: 'ONE_TIME',
    activate: () => ({}), // Handled in GameScreen (adds the tile and charges the points)
  },
  {
    id: 'shakeItLikeAPolaroid',
    name: 'Shake It Like a Polaroid',
    description: `Tap the Polaroid fast for ${POWER_PLAY_VALUES.polaroidSeconds} seconds: every ${POWER_PLAY_VALUES.polaroidShakesPerStep} shakes earn +${POWER_PLAY_VALUES.polaroidPoints} points (up to +${POWER_PLAY_VALUES.polaroidMax}).`,
    flavorText: 'OutKast says the photo\'s still developing.',
    icon: '📸',
    subtheme: 'score',
    effectType: 'immediate',
    durationTag: 'ONE_TIME',
    activate: () => ({}), // A gamble card (v7.55.0: tap to shake)
  },
  {
    id: 'continueScreen',
    name: 'Continue?',
    description: `Works as soon as you take it: the first time your clock hits 0, keep playing with ${TIME_BONUS.continueScreen} seconds for ${POWER_PLAY_VALUES.continueCost.toLocaleString()} points.`,
    flavorText: 'Continue? 9… 8… 7…',
    icon: '🕹️',
    subtheme: 'timer',
    effectType: 'passive',
    oncePerRun: true,
    durationTag: 'ONE_TIME',
    activate: arm('continueScreen'),
  },
  {
    id: 'actClear',
    name: 'Act Clear!',
    description: `Trade up to ${POWER_PLAY_VALUES.actClearMaxSeconds} seconds of clock for +${POWER_PLAY_VALUES.actClearPointsPerSecond} points each (up to +${POWER_PLAY_VALUES.actClearMaxSeconds * POWER_PLAY_VALUES.actClearPointsPerSecond}).`,
    finePrint: `Always leaves you at least ${POWER_PLAY_VALUES.actClearKeepSeconds} seconds.`,
    flavorText: 'Sonic says: rings and time, baby.',
    icon: '🦔',
    subtheme: 'score',
    effectType: 'immediate',
    durationTag: 'ONE_TIME',
    activate: () => ({}), // Handled in GameScreen (trades clock seconds for points)
  },
  {
    id: 'neuralyzer',
    name: 'Neuralyzer',
    description: `Your next valid word brings a charm offer: take, swap or upgrade a charm.`,
    flavorText: 'Look right here. *flash* You never saw that old charm.',
    icon: '🕶️',
    subtheme: 'utility',
    effectType: 'immediate',
    oncePerRun: true,
    durationTag: 'ONE_TIME',
    // v7.67.7: fires on pick (it was a pocket card; the offer comes with the next word anyway).
    activate: (gameState) => ({
      wordMilestoneProgress: { ...gameState.wordMilestoneProgress, count: gameState.wordMilestoneProgress.nextUnlock - 1 },
      neuralyzerOffer: true,
      log: [...gameState.log, { type: 'event', id: `pp-neuralyzer-${Date.now()}`, name: 'Neuralyzer', icon: '🕶️', description: 'A charm offer comes with the next valid word.', scoreChange: 0, cumulativeScore: gameState.score }],
      lastPowerPlayResult: { message: '🕶️ *flash* Your next valid word brings a charm offer.', scoreChange: 0 },
    }),
  },
  {
    id: 'letsMakeADeal',
    name: "Let's Make a Deal",
    description: `${POWER_PLAY_VALUES.doorPrizes.length + 1} doors: ${POWER_PLAY_VALUES.doorPrizes.length} prizes (+${POWER_PLAY_VALUES.doorPrizes[0]} to +${POWER_PLAY_VALUES.doorPrizes[POWER_PLAY_VALUES.doorPrizes.length - 1]}) and a Zonk that wipes your pot. Open doors and walk away any time; all ${POWER_PLAY_VALUES.doorPrizes.length} prizes pay +${POWER_PLAY_VALUES.doorSweepBonus} more.`,
    flavorText: 'Do you want what is behind Door Number 2?',
    icon: '🚪',
    subtheme: 'utility',
    effectType: 'immediate',
    durationTag: 'ONE_TIME',
    activate: () => ({}), // Handled in GameScreen (v7.25 gambles)
  },
  {
    id: 'dealOrNoDeal',
    name: 'Deal or No Deal',
    description: `You hold 1 of ${POWER_PLAY_VALUES.dealCases.length} cases (${POWER_PLAY_VALUES.dealCases[0]} to ${POWER_PLAY_VALUES.dealCases[POWER_PLAY_VALUES.dealCases.length - 1].toLocaleString()} points). Take the Banker's offer, or keep going and open your case at the end.`,
    flavorText: 'Deal... or no deal?',
    icon: '💼',
    subtheme: 'score',
    effectType: 'immediate',
    durationTag: 'ONE_TIME',
    activate: () => ({}), // Handled in GameScreen (v7.25 gambles)
  },
  {
    id: 'noWhammies',
    name: 'No Whammies!',
    description: `Hit STOP up to ${POWER_PLAY_VALUES.whammySpins} times: each spin adds +${POWER_PLAY_VALUES.whammyCash[0].points} to +${POWER_PLAY_VALUES.whammyCash[POWER_PLAY_VALUES.whammyCash.length - 1].points} to your pot, but a Whammy (${POWER_PLAY_VALUES.whammyChance * 100}% a spin) wipes it. Bank any time.`,
    flavorText: 'No whammies, no whammies... STOP!',
    icon: '🎰',
    subtheme: 'score',
    effectType: 'immediate',
    durationTag: 'ONE_TIME',
    activate: () => ({}), // Handled in GameScreen (v7.25 gambles)
  },
  {
    id: 'plinko',
    name: 'Plinko',
    description: `Drop the chip: 0, +100, +300, +700 or the +${POWER_PLAY_VALUES.plinko[POWER_PLAY_VALUES.plinko.length - 1].points.toLocaleString()} jackpot. No downside.`,
    flavorText: 'Plinko!',
    icon: '📍',
    subtheme: 'score',
    effectType: 'immediate',
    durationTag: 'ONE_TIME',
    activate: () => ({}), // Handled in GameScreen (v7.25 gambles)
  },
  {
    id: 'minesweeper',
    name: 'Minesweeper',
    description: `Open squares one at a time: each safe one grows your pot (up to +${POWER_PLAY_VALUES.minesweeperLadder.reduce((a, b) => a + b, 0).toLocaleString()}). 1 of ${POWER_PLAY_VALUES.minesweeperSquares} hides a mine that wipes it. Bank any time.`,
    flavorText: "Don't click the mine. Don't click the mine.",
    icon: '💣',
    subtheme: 'strike',
    effectType: 'immediate',
    durationTag: 'ONE_TIME',
    activate: () => ({}), // Handled in GameScreen (v7.25 gambles)
  },
  {
    id: 'hotTubTimeMachine',
    name: 'Hot Tub Time Machine',
    description: `Spin the dial: ${Math.round(POWER_PLAY_VALUES.hotTub[0].chance * 100)}% +${POWER_PLAY_VALUES.hotTub[0].seconds} seconds, ${Math.round(POWER_PLAY_VALUES.hotTub[1].chance * 100)}% +${POWER_PLAY_VALUES.hotTub[1].seconds} seconds, ${Math.round(POWER_PLAY_VALUES.hotTub[2].chance * 100)}% ${POWER_PLAY_VALUES.hotTub[2].seconds} seconds.`,
    flavorText: "It's a hot tub... time machine.",
    icon: '♨️',
    subtheme: 'timer',
    effectType: 'immediate',
    durationTag: 'ONE_TIME',
    activate: () => ({}), // Handled in GameScreen (v7.25 gambles)
  },
  {
    id: 'wildcard',
    // v7.68.0 (the owner: it didn't read as It's Always Sunny): Charlie's line, bleeped for kids.
    name: 'Wildcard, B*tches!',
    description: `Charlie goes rogue. Spin: ${Math.round(POWER_PLAY_VALUES.wildcard[0].chance * 100)}% +${POWER_PLAY_VALUES.wildcard[0].seconds} seconds, ${Math.round(POWER_PLAY_VALUES.wildcard[1].chance * 100)}% +${POWER_PLAY_VALUES.wildcard[1].points} points, ${Math.round(POWER_PLAY_VALUES.wildcard[2].chance * 100)}% a free tile of your choice, ${Math.round(POWER_PLAY_VALUES.wildcard[3].chance * 100)}% a strike.`,
    finePrint: `A shield blocks the strike. The free tile lasts this hand.`,
    flavorText: "Yee-haw! (Charlie Kelly, It's Always Sunny in Philadelphia)",
    icon: '🤠',
    subtheme: 'utility',
    effectType: 'immediate',
    durationTag: 'ONE_TIME',
    activate: () => ({}), // Handled in GameScreen (gamble card, v7.50.0)
  },
  {
    id: 'luckyCharms',
    name: 'Lucky Charms',
    description: `Equips a random charm now, even a trade-off one.`,
    finePrint: 'With full slots it replaces a random charm.',
    flavorText: "They're always after me Lucky Charms!",
    icon: '🍀',
    subtheme: 'utility',
    effectType: 'immediate',
    durationTag: 'ONE_TIME',
    activate: () => ({}), // Handled in GameScreen (v7.25 gambles)
  },
  {
    id: 'dailyDouble',
    name: 'Daily Double',
    description: `Starts right away: bet ${POWER_PLAY_VALUES.dailyDoubleBet}. If your next word has ${POWER_PLAY_VALUES.dailyDoubleLetters}+ letters, win +${POWER_PLAY_VALUES.dailyDoubleWin}; if not, lose the bet.`,
    flavorText: "Let's make it a true Daily Double.",
    icon: '❓',
    subtheme: 'score',
    effectType: 'immediate',
    durationTag: 'ONE_TIME',
    activate: (gameState: GameState): Partial<GameState> => {
      // Fires on pick (INSTANT_POWER_PLAY_IDS): the wager is set from the score right then.
      const wager = dailyDoubleWager(gameState.score);
      const armed = arm('dailyDouble', { wager })(gameState);
      const description = `Bet ${wager}: if your next word has ${POWER_PLAY_VALUES.dailyDoubleLetters}+ letters, win +${prizeFor(POWER_PLAY_VALUES.dailyDoubleWin, levelFor(gameState.log.filter(e => e.type === 'word' && e.status === 'valid').length))}. If not, lose ${wager}.`;
      return { ...armed, activeBuffs: armed.activeBuffs!.map(b => (b.id === 'dailyDouble' ? { ...b, description } : b)) };
    },
  },
  {
    id: 'popQuizHotshot',
    name: 'Pop Quiz, Hotshot',
    description: `Starts right away: play your next word within ${POWER_PLAY_VALUES.popQuizSeconds} seconds for +${POWER_PLAY_VALUES.popQuizPoints} points and +${POWER_PLAY_VALUES.popQuizBonusSeconds} seconds. Too slow: -${POWER_PLAY_VALUES.popQuizPenaltySeconds} seconds.`,
    flavorText: 'Pop quiz, hotshot. What do you do?',
    icon: '🚌',
    subtheme: 'timer',
    effectType: 'immediate',
    durationTag: 'ONE_TIME',
    activate: arm('popQuizHotshot', { startClock: 0 }), // the clock is stamped when picked (CHOOSE_POWER_PLAY)
  },
  {
    id: 'missionImpossible',
    name: 'Mission: Impossible',
    description: `Starts right away: you get a secret mission (like a word ending in ING). Pull it off within ${POWER_PLAY_VALUES.missionWords} words for +${POWER_PLAY_VALUES.missionPrize}; fail and you lose nothing.`,
    flavorText: 'Your mission, should you choose to accept it...',
    icon: '🕵️',
    subtheme: 'score',
    effectType: 'immediate',
    durationTag: 'LIMITED',
    activate: () => ({}), // Fires on pick: the mission card (v7.55.0), settled in completeSubmission
  },

  // --- v7.28: new kinds of play (betting on yourself, payouts later, rivals, blind play, boss and charm boosts) ---
  {
    id: 'tamagotchi',
    name: 'Tamagotchi',
    description: `Feed a pet your next ${POWER_PLAY_VALUES.tamagotchiWords} words: each ${POWER_PLAY_VALUES.tamagotchiLetters}+ letter word grows its pot (+${POWER_PLAY_VALUES.tamagotchiStep}, +${POWER_PLAY_VALUES.tamagotchiStep * 2}, +${POWER_PLAY_VALUES.tamagotchiStep * 3}…), +${tamagotchiPot(POWER_PLAY_VALUES.tamagotchiWords)} in all.`,
    finePrint: `A shorter word or a strike and it runs off with the pot.`,
    flavorText: 'Beep beep. It’s hungry again.',
    icon: '🥚',
    subtheme: 'score',
    effectType: 'next_word',
    durationTag: 'LIMITED',
    activate: arm('tamagotchi', { feeds: 0 }),
  },
  {
    id: 'priceIsRight',
    name: 'The Price Is Right',
    description: `Starts right away: bid what your next word will score. ${POWER_PLAY_VALUES.priceIsRightBids.map(b => `${b.bid}+ pays +${b.prize}`).join(', ')}; fall short and you lose ${POWER_PLAY_VALUES.priceIsRightBids[0].miss} to ${POWER_PLAY_VALUES.priceIsRightBids[POWER_PLAY_VALUES.priceIsRightBids.length - 1].miss}.`,
    flavorText: 'Come on down!',
    icon: '🏷️',
    subtheme: 'score',
    effectType: 'immediate',
    durationTag: 'ONE_TIME',
    activate: () => ({}), // Handled in GameScreen (a GambleCard picks the bid)
  },
  {
    id: 'timeCapsule',
    name: 'Time Capsule',
    description: `Your next word scores 0 now and pays x${POWER_PLAY_VALUES.timeCapsuleMultiplier} after ${POWER_PLAY_VALUES.timeCapsuleWords} more words.`,
    finePrint: `If the run ends first, it stays buried.`,
    flavorText: 'Doc Brown\'s letter waited 70 years. Yours waits 4 words. (Back to the Future)',
    icon: '📦',
    subtheme: 'score',
    effectType: 'next_word',
    durationTag: 'LIMITED',
    activate: arm('timeCapsule'),
  },
  {
    id: 'redrum',
    name: 'REDRUM',
    // v7.61.3: same effect, plainer words (the owner found the old line hard to parse).
    description: `Your next word scores x${POWER_PLAY_VALUES.redrumBase}. If it's also a word backward (STAR, RATS), it scores x${POWER_PLAY_VALUES.redrumMultiplier} instead.`,
    finePrint: `The backward bonus needs ${POWER_PLAY_VALUES.redrumLetters}+ letters.`,
    flavorText: 'Redrum. Redrum.',
    icon: '🪞',
    subtheme: 'score',
    effectType: 'next_word',
    durationTag: 'LIMITED',
    activate: arm('redrum', { words: POWER_PLAY_VALUES.redrumWords }),
  },
  {
    id: 'jackass',
    name: 'Jackass',
    description: `Take a strike on purpose: +${TIME_BONUS.jackass} seconds and your next word scores x${POWER_PLAY_VALUES.jackassMultiplier}.`,
    finePrint: `Shields don't stop it, and you can't use it on your last strike. The strike breaks any 💔 fragile charm.`,
    flavorText: 'Hi, I’m Johnny Knoxville, and this is Jackass.',
    icon: '🛒',
    subtheme: 'strike',
    effectType: 'immediate',
    durationTag: 'ONE_TIME',
    activate: () => ({}), // Handled in GameScreen
  },
  {
    id: 'multiplicity',
    name: 'Multiplicity',
    description: `Becomes a copy of the last PowerPlay you used.`,
    finePrint: `It can't copy once-per-run PowerPlays or ones that start right away.`,
    flavorText: 'She touched my pepe, Steve.',
    icon: '👯',
    subtheme: 'utility',
    effectType: 'immediate',
    durationTag: 'ONE_TIME',
    activate: () => ({}), // Handled in GameScreen
  },
  {
    id: 'hadouken',
    name: 'Hadouken!',
    description: `In a boss fight, your next ${POWER_PLAY_VALUES.hadoukenHits} words count as hits, even if they break the rule.`,
    finePrint: `No boss right now? It waits for the next one.`,
    flavorText: 'Hadouken!',
    icon: '💥',
    subtheme: 'utility',
    effectType: 'passive',
    durationTag: 'LIMITED',
    activate: arm('hadouken', { hits: POWER_PLAY_VALUES.hadoukenHits }),
  },
  {
    id: 'over9000',
    name: "It's Over 9000!",
    description: `For your next ${POWER_PLAY_VALUES.over9000Words} words, charm points pay x2.`,
    flavorText: 'It’s over nine thousand!',
    icon: '🐉',
    subtheme: 'score',
    effectType: 'next_word',
    durationTag: 'LIMITED',
    activate: arm('over9000', { words: POWER_PLAY_VALUES.over9000Words }),
  },
  {
    id: 'draftDay',
    name: 'Draft Day',
    description: `Pick 1 of ${POWER_PLAY_VALUES.draftDayPacks} packs of ${POWER_PLAY_VALUES.draftDayTiles} tiles. They replace your ${POWER_PLAY_VALUES.draftDayTiles} lowest-value tiles.`,
    flavorText: 'Vontae Mack!',
    icon: '🏈',
    subtheme: 'rack',
    effectType: 'immediate',
    durationTag: 'ONE_TIME',
    activate: () => ({}), // Handled in GameScreen (a GambleCard shows the packs)
  },
  {
    id: 'smellYaLater',
    name: 'Smell Ya Later!',
    description: `Starts right away: race Gary over your next ${POWER_PLAY_VALUES.rivalWords} words. He scores every second at your pace; beat him for +${POWER_PLAY_VALUES.rivalPrize}.`,
    finePrint: `He scores at least ${POWER_PLAY_VALUES.rivalPointsPerSecond} points a second.`,
    flavorText: 'Smell ya later!',
    icon: '🏃',
    subtheme: 'timer',
    effectType: 'immediate',
    durationTag: 'LIMITED',
    activate: arm('smellYaLater', { words: POWER_PLAY_VALUES.rivalWords, mine: 0, rival: 0, clock: 0 }), // clock stamped when picked
  },
  {
    id: 'birdBox',
    name: 'Bird Box',
    description: `Starts right away: your tiles flip face down after ${POWER_PLAY_VALUES.birdBoxSeconds} seconds. Spell your next word from memory for x${POWER_PLAY_VALUES.birdBoxMultiplier}.`,
    finePrint: `Tiles you place show their letters.`,
    flavorText: 'Don’t look.',
    icon: '🙈',
    subtheme: 'score',
    effectType: 'next_word',
    durationTag: 'ONE_TIME',
    activate: arm('birdBox'),
  },
  {
    id: 'chickenDinner',
    name: 'Winner Winner Chicken Dinner',
    description: `One hand of blackjack: HIT or STAND. Beat the dealer for +${POWER_PLAY_VALUES.blackjackWin}; blackjack pays +${POWER_PLAY_VALUES.blackjackNatural}.`,
    finePrint: `A tie pays +${POWER_PLAY_VALUES.blackjackPush}. The dealer stands on 17.`,
    flavorText: 'Winner winner, chicken dinner!',
    icon: '🍗',
    subtheme: 'score',
    effectType: 'immediate',
    durationTag: 'ONE_TIME',
    activate: () => ({}), // v7.67.1: a blackjack card (GambleCard); the old per-word game still settles for saved runs
  },
  {
    id: 'cardSharks',
    name: 'Card Sharks',
    description: `Call higher or lower on each card. Right calls grow your pot (${POWER_PLAY_VALUES.cardSharksLadder.join(', ')}); a wrong call wipes it. Bank any time.`,
    finePrint: `A tie is a free pass.`,
    flavorText: 'Higher or lower?',
    icon: '🃏',
    subtheme: 'score',
    effectType: 'immediate',
    durationTag: 'ONE_TIME',
    activate: () => ({}), // Handled in GameScreen (v7.25 gambles)
  },
  {
    id: 'psychicFriends',
    name: 'Psychic Friends Network',
    description: `Starts right away: call your next word's length. ${POWER_PLAY_VALUES.psychicCalls.map(c => `${c.letters}${c.orMore ? '+' : ''} letters +${c.prize.toLocaleString()}`).join(', ')}.`,
    finePrint: `A wrong call costs nothing.`,
    flavorText: 'Call now! Your psychic friend is waiting.',
    icon: '🔮',
    subtheme: 'score',
    effectType: 'immediate',
    durationTag: 'ONE_TIME',
    activate: () => ({}), // Handled in GameScreen (fires on pick: the call card, v7.54.0)
  },
  // --- v7.62.0 content drop ---
  {
    id: 'inception',
    name: 'Inception',
    description: `For your next ${POWER_PLAY_VALUES.inceptionWords} words, every real word hiding in yours pays +${POWER_PLAY_VALUES.inceptionPerWord} (CARPET hides CAR, CARP, PET: +${POWER_PLAY_VALUES.inceptionPerWord * 3}).`,
    flavorText: 'We need to go deeper.',
    icon: '🌀',
    subtheme: 'score',
    effectType: 'next_word',
    durationTag: 'LIMITED',
    activate: arm('inception', { words: POWER_PLAY_VALUES.inceptionWords }),
  },
  {
    id: 'jenga',
    name: 'Jenga!',
    description: `Stack your next words: blocks pay +${POWER_PLAY_VALUES.jengaStep}, +${POWER_PLAY_VALUES.jengaStep * 2}, +${POWER_PLAY_VALUES.jengaStep * 3}… up to ${POWER_PLAY_VALUES.jengaBlocks} (+${jengaPot(POWER_PLAY_VALUES.jengaBlocks).toLocaleString()}). Hold the 🧱 chip to cash out.`,
    finePrint: `A word under ${POWER_PLAY_VALUES.jengaMinLetters} letters, an invalid word or a strike topples it, and you get nothing.`,
    flavorText: "Don't pull the bottom one.",
    icon: '🧱',
    subtheme: 'score',
    effectType: 'next_word',
    durationTag: 'LIMITED',
    activate: arm('jenga', { blocks: 0 }),
  },
  // --- v7.65.0 ---
  {
    id: 'fifthGrader',
    name: 'Are You Smarter Than a 5th Grader?',
    description: `Starts right away: ${POWER_PLAY_VALUES.fifthGraderSeconds} seconds of times tables. Right answers climb the grades (+${POWER_PLAY_VALUES.fifthGraderLadder[0]} up to +${POWER_PLAY_VALUES.fifthGraderLadder[POWER_PLAY_VALUES.fifthGraderLadder.length - 1].toLocaleString()}), wrong ones drop one; you win where you finish.`,
    flavorText: "I'm not smarter than a 5th grader!",
    icon: '🎒',
    subtheme: 'score',
    effectType: 'immediate',
    durationTag: 'ONE_TIME',
    activate: () => ({}), // Handled in GameScreen (fires on pick: the quiz card)
  },
];

/** PowerPlays that pay a flat point prize, which grows with the run level (PRIZE_GROWTH, prizeFor).
 * A new PowerPlay with a point prize goes here and pays through prizeFor(). */
export const PRIZE_POWER_PLAY_IDS: ReadonlySet<string> = new Set([
  'schruteBucks',
  'dailyDouble', // v7.58.0: the win is a flat prize now
  'letsMakeADeal', 'dealOrNoDeal', 'noWhammies', 'minesweeper', 'cardSharks', 'plinko', 'chickenDinner',
  'fluncleIsProud', 'actClear', 'priceIsRight', 'tamagotchi', 'smellYaLater', 'popQuizHotshot',
  'withGreatPower', 'gumpLuck', 'fortunesFavor', 'surveySays', 'centerSquare', 'warioWarp', 'thanosGift', 'wildcard', 'psychicFriends',
  'shakeItLikeAPolaroid', 'duckHunt', 'missionImpossible',
  'inception', 'jenga', // v7.62.0
  'fifthGrader', // v7.65.0
]);
