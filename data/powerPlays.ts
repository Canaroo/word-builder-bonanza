
import { PowerPlay, GameState, EventLogEntry } from '../types';
import { labelize } from '../services/durationTags';
import { TIME_BONUS, POWER_PLAY_VALUES , TRIFORCE } from '../config/gameplay';
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
  'multiverseOfSadness', 'jackass',
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
]);

export const POWER_PLAYS_LIST: PowerPlay[] = [
  {
    id: 'letterUpgrade',
    name: 'Pimp My Tile',
    description: `Pick a letter: every tile of it is worth 3x its points for your next 5 words.`,
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
    name: 'Wildcard Wake',
    description: 'Instantly gain 2 free shuffles.',
    flavorText: 'A little shake-up when you need it most.',
    icon: '🃏',
    subtheme: 'rack',
    effectType: 'immediate',
    durationTag: 'ONE_TIME',
    activate: (gameState) => ({ shuffleCount: (gameState.shuffleCount || 0) + 2 }),
  },
  {
    id: 'deepFreeze',
    name: 'Everybody Chill',
    description: `Works from the moment you take it: the first time your clock hits 0, everybody chills and you get ${TIME_BONUS.rescue} more seconds.`,
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
    description: 'Once per run. Works from the moment you take it: if your clock runs out before you play a word on this hand, you get the same tiles again and a fresh clock.',
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
    flavorText: 'It bends to your will—just once.',
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
    flavorText: 'Imitation is the sincerest form of wordplay.',
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
    description: 'Skip ahead: your next valid word starts a Golden Round.',
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
    description: 'Busts ALL your strikes. It costs 15 seconds off your clock (it never leaves you under 5).',
    flavorText: 'I ain’t afraid of no strikes.',
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
    description: 'Works from the moment you take it: when a strike would end your run, you survive instead, with one strike to spare and +20 seconds.',
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
    description: 'Every tile is worth double for your next 2 words.',
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
    description: `Go to Ludicrous Speed: for ${POWER_PLAY_VALUES.ludicrousSeconds} seconds your clock freezes and every word scores x${POWER_PLAY_VALUES.ludicrousSpeedMultiplier}. Play as many as you can!`,
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
    description: 'Grab 2 extra tiles now; your hand refills to 10 tiles instead of 8 for your next 2 hands.',
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
    description: 'Next word only: tile values flip. Common letters (E, A, S…) are worth 10 and rare ones (Q, Z…) are worth 1.',
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
    description: `Add ${TIME_BONUS.timeBoost} seconds to your timer.`, 
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
    description: 'Your next word scores 4x.', 
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
    description: 'Block the next strike.', 
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
    description: 'Your next strike doesn’t count: you lose 150 points instead.',
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
    description: `Your next word pays in time: it scores half its points, and the other half become seconds on your clock (1 point = 1 second, up to ${TIME_BONUS.multiverseCap}).`, 
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
    flavorText: 'Wipe the slate. Launch the word.',
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
    description: 'Instantly replay your highest-scoring word for its original value.', 
    flavorText: 'History repeats. So does your score.',
    icon: '🔁',
    subtheme: 'score',
    effectType: 'immediate',
    durationTag: 'ONE_TIME',
    activate: (gameState) => ({...gameState}) // Handled in GameScreen
  },
  { 
    id: 'rewind', 
    name: 'Turn Back Time',
    description: `Takes away your last strike and adds ${TIME_BONUS.rescue} seconds. No strikes yet? It waits and undoes your next one, seconds included.`, 
    flavorText: 'If I could turn back time...',
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
    description: 'You gain 300 points. No explanation needed.', 
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
    description: `Shake the Magic 8-Ball ${POWER_PLAY_VALUES.fortuneShakes} times and read its answer: ${Math.round((1 - POWER_PLAY_VALUES.fortuneLoseChance - POWER_PLAY_VALUES.fortuneJackpotChance) * 100)}% it says yes (+${POWER_PLAY_VALUES.fortuneWin} points), ${Math.round(POWER_PLAY_VALUES.fortuneJackpotChance * 100)}% "without a doubt" (+${POWER_PLAY_VALUES.fortuneJackpot}), ${Math.round(POWER_PLAY_VALUES.fortuneLoseChance * 100)}% "outlook not so good" (you lose ${POWER_PLAY_VALUES.fortuneLose}).`,
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
    description: `Your next 2 words each add an extra ${TIME_BONUS.timeTurner} seconds to your clock.`,
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
    description: `Start a beet farm: for your next ${POWER_PLAY_VALUES.schruteBucksWords} words, every ${POWER_PLAY_VALUES.schruteBucksLetters.split('').join(', ').replace(/, (\w)$/, ' or $1')} you play pays ${POWER_PLAY_VALUES.schruteBucksPerLetter} points, right away.`,
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
    description: 'You lose 2 random tiles now. Your next word scores x5.', 
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
    flavorText: 'Go ninja, go ninja, go!',
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
    description: 'For one word, every tile in your hand is worth at least 15 points.', 
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
    description: `Pick one: +${TIME_BONUS.rescue}s on the clock, or erase a strike.`, 
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
    description: `Gain +${POWER_PLAY_VALUES.thanosGiftPoints} points right now. Your next word of ${POWER_PLAY_VALUES.thanosGiftLetters}+ letters scores 0 (shorter words don't count).`,
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
    description: 'Next word is triple score or zero—50% chance.', 
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
    description: 'All “S” tiles in your current hand jump to 15 points for your next word.', 
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
    description: `Duplicate one chosen letter: pull a twin into your hand, worth ${POWER_PLAY_VALUES.hookshotMultiplier}x its points.`,
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
    description: 'Your clock stops until you play your next word. Take all the time you need.', 
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
    description: "Swap up to 3 tiles of your choice for new ones. It doesn't use a shuffle.",
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
    description: 'Gain 100 points and a fresh hand, free.',
    flavorText: "What has two thumbs and doesn’t give a crap? Bob Kelso. Nice to meet you.",
    icon: '👨‍⚕️',
    subtheme: 'score',
    effectType: 'immediate',
    durationTag: 'ONE_TIME',
    activate: (gameState) => ({...gameState}) // Handled in GameScreen
  },
  {
    id: 'gumpLuck',
    name: "Gump Luck",
    description: `Open the box and unwrap a chocolate: +${TIME_BONUS.rescue} seconds, +${POWER_PLAY_VALUES.gumpLuckPoints} points, +1 shuffle or nothing at all, 25% each.`,
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
    description: 'Fills your clock all the way to the top, however low it was.',
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
    description: 'Takes away one of your strikes. No strikes yet? It waits and erases the next one you get.',
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
    description: 'Trade up to 3 tiles for a C, an A and a T. If your next word uses all three, it scores x3.',
    flavorText: 'A paw-picked trio to guide your next move.',
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
    description: `Bet your next word on a coin flip with an edge: ${POWER_PLAY_VALUES.doubleOrNothingWinChance * 100}% chance it scores double, ${100 - POWER_PLAY_VALUES.doubleOrNothingWinChance * 100}% chance it scores zero.`,
    flavorText: 'Risk it for the biscuit!',
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
    description: 'Every consonant in your next word scores +10.',
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
    description: 'Lights up a word you can play with your tiles, its first letter in red.',
    flavorText: 'You get a clue… sort of.',
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
    flavorText: 'Your hand gets a radical transformation.',
    icon: '⚡️',
    subtheme: 'rack',
    effectType: 'immediate',
    durationTag: 'ONE_TIME',
    activate: (gameState) => ({...gameState}) // Handled in GameScreen
  },
  {
    id: 'sliders',
    name: 'Sliders',
    description: 'Undo your entire previous turn — rewind score, time, and tiles.',
    flavorText: 'Slide into a better timeline.',
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
    flavorText: 'Ooh, spooky! Things get weird.',
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
    description: 'Pick a tile on your rack: it is worth 20 points for your next word.',
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
    description: `Grab the Zapper: ${POWER_PLAY_VALUES.duckSeconds} seconds of fast, zigzagging ducks. Shoot a 🦆 duck for +${POWER_PLAY_VALUES.duckPoints}, but hitting a 🕊️ dove or the 🐕 dog costs ${POWER_PLAY_VALUES.duckPenalty}.`,
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
    description: 'Get an extra Challenge right now. Apparently you like a good challenge.',
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
    description: `WAH! Pick one of Wario's money bags: ${POWER_PLAY_VALUES.warioBags.map(b => `+${b.points} points for -${b.seconds} seconds`).join(', ')}. The seconds come off your clock right away.`,
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
    description: 'A fresh hand, with 2 tiles that are x2 word tiles.',
    flavorText: "We're zany to the max!",
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
    description: `Smash your rack for a fresh hand. One new tile is a barrel: a ${POWER_PLAY_VALUES.donkeyKongMultiplier}x word tile.`,
    flavorText: 'DK! Donkey Kong!',
    icon: '🐵',
    subtheme: 'rack',
    effectType: 'immediate',
    durationTag: 'ONE_TIME',
    activate: (gameState) => ({...gameState}) // Handled in GameScreen
  },
  {
    id: 'tetrisTouch',
    name: 'Tetris Touch',
    description: 'If your next word switches between vowels and consonants every letter (like BANANA or TOMATO), it scores x4.',
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
    flavorText: 'Time’s on your side — for now.',
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
    description: `Your next word: ${POWER_PLAY_VALUES.blueShellWinChance * 100}% chance it scores x${POWER_PLAY_VALUES.blueShellMultiplier}, ${100 - POWER_PLAY_VALUES.blueShellWinChance * 100}% chance it backfires and loses ${POWER_PLAY_VALUES.blueShellLoss} points.`,
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
    description: 'One random tile becomes a x4 word tile for this hand only.',
    flavorText: 'If there was a problem, yo — you’ll solve it.',
    icon: '❄️',
    subtheme: 'rack',
    effectType: 'immediate',
    durationTag: 'ONE_TIME',
    activate: (gameState) => ({...gameState}) // Handled in GameScreen
  },
  { 
    id: 'rescueDrop', 
    name: 'Rescue Rangers',
    description: 'A random tile is removed from your hand. It comes back with your next hand, worth 20 points for that word.',
    flavorText: "Ch-ch-ch-Chip 'n Dale! When there's danger...",
    icon: '🐿️',
    subtheme: 'rack',
    effectType: 'immediate',
    durationTag: 'LIMITED',
    activate: (gameState) => ({...gameState}) // Handled in GameScreen
  },
  { 
    id: 'letsGetDangerous', 
    name: 'Let’s Get Dangerous', 
    description: 'Your next word’s score is multiplied by the number of vowels it contains.', 
    flavorText: 'Vowels beware. Masked justice is here.',
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
    description: `Dive into the Money Bin: coins rain down for ${POWER_PLAY_VALUES.moneyBinSeconds} seconds, each worth ${POWER_PLAY_VALUES.moneyBinCoins.map(c => c.seconds).join(', ').replace(/, (\d+)$/, ' or $1')} seconds of clock (the faster they fall, the more they're worth). Tap to catch them, up to +${POWER_PLAY_VALUES.moneyBinMaxSeconds} seconds.`, 
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
    description: 'Pick a lifeline: Fast Cash (+100 points now), Phone-a-Friend (shows your best word) or Double Down (your next word scores x2).', 
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
    description: `Pick any tile in your hand. It transforms into a random combo tile (TH, SH, QU, ING…), and the first word you play with it scores x${POWER_PLAY_VALUES.moreThanMeetsMultiplier}.`,
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
    description: 'Instantly replaces your rack with a fresh hand. Your very next valid word earns a +50 bonus.',
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
    description: "Take a strike for +500 points. Can't be used when you're one strike from game over. The strike breaks any 💔 fragile charm you hold.",
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
    description: `Your next word: 50% chance it scores x${POWER_PLAY_VALUES.spaceInvaderMultiplier}, 50% chance it scores only ${POWER_PLAY_VALUES.spaceInvaderCap} points.`,
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
    description: `Next word only: ${POWER_PLAY_VALUES.rareLetters.split('').join(', ')} tiles are worth ${POWER_PLAY_VALUES.rareLetterMultiplier}x.`,
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
    description: `Shake it! Tap the Polaroid as fast as you can for ${POWER_PLAY_VALUES.polaroidSeconds} seconds. Every ${POWER_PLAY_VALUES.polaroidShakesPerStep} shakes develop +${POWER_PLAY_VALUES.polaroidPoints} points (up to +${POWER_PLAY_VALUES.polaroidMax}).`,
    flavorText: 'Shake it, shake it, shake it…',
    icon: '📸',
    subtheme: 'score',
    effectType: 'immediate',
    durationTag: 'ONE_TIME',
    activate: () => ({}), // A gamble card (v7.55.0: tap to shake)
  },
  {
    id: 'continueScreen',
    name: 'Continue?',
    description: `Works from the moment you take it: the first time your clock hits 0, you keep playing with ${TIME_BONUS.continueScreen} seconds. It costs ${POWER_PLAY_VALUES.continueScoreCostPercent}% of your score (never more than ${POWER_PLAY_VALUES.continueScoreCostMax.toLocaleString()}).`,
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
    description: `Cash in up to ${POWER_PLAY_VALUES.actClearMaxSeconds} seconds from your clock for +${POWER_PLAY_VALUES.actClearPointsPerSecond} points each (up to +${POWER_PLAY_VALUES.actClearMaxSeconds * POWER_PLAY_VALUES.actClearPointsPerSecond}). Always leaves you at least ${POWER_PLAY_VALUES.actClearKeepSeconds} seconds.`,
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
    description: 'Your next valid word brings a charm offer: equip a new charm, swap one in, or upgrade one you hold. Once per run.',
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
    description: `${POWER_PLAY_VALUES.doorPrizes.length + 1} doors: ${POWER_PLAY_VALUES.doorPrizes.length} hide prizes (${POWER_PLAY_VALUES.doorPrizes.map(p => `+${p}`).join(', ')}) and 1 hides the Zonk, which wipes your pot. Open them one at a time and walk away whenever you like. Find all ${POWER_PLAY_VALUES.doorPrizes.length} prizes for +${POWER_PLAY_VALUES.doorSweepBonus} more.`,
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
    description: `You hold one of ${POWER_PLAY_VALUES.dealCases.length} cases (${POWER_PLAY_VALUES.dealCases[0]} to ${POWER_PLAY_VALUES.dealCases[POWER_PLAY_VALUES.dealCases.length - 1]} points). Each round more cases open and the Banker makes an offer: take the deal, or keep going and open your case at the end.`,
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
    description: `Big bucks, no Whammies! Hit STOP on the board up to ${POWER_PLAY_VALUES.whammySpins} times: each square adds cash to the pot (+${POWER_PLAY_VALUES.whammyCash[0].points} to +${POWER_PLAY_VALUES.whammyCash[POWER_PLAY_VALUES.whammyCash.length - 1].points}), but a Whammy (${POWER_PLAY_VALUES.whammyChance * 100}% each spin) wipes it. Bank any time.`,
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
    description: `Slide the chip, drop it and watch it bounce down the pegs: 0, +100, +300, +700, or the +${POWER_PLAY_VALUES.plinko[POWER_PLAY_VALUES.plinko.length - 1].points} jackpot in the middle. No downside.`,
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
    description: `Pick squares one at a time: each safe square grows your pot (+${POWER_PLAY_VALUES.minesweeperLadder[0]}, then more each time, up to ${POWER_PLAY_VALUES.minesweeperLadder.reduce((a, b) => a + b, 0)}). One of ${POWER_PLAY_VALUES.minesweeperSquares} hides a mine that wipes the pot. Stop and bank any time.`,
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
    description: `A time gamble: ${Math.round(POWER_PLAY_VALUES.hotTub[0].chance * 100)}% +${POWER_PLAY_VALUES.hotTub[0].seconds} seconds, ${Math.round(POWER_PLAY_VALUES.hotTub[1].chance * 100)}% +${POWER_PLAY_VALUES.hotTub[1].seconds} seconds, or ${Math.round(POWER_PLAY_VALUES.hotTub[2].chance * 100)}% ${POWER_PLAY_VALUES.hotTub[2].seconds} seconds.`,
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
    description: `Charlie goes rogue. Spin the wheel: ${Math.round(POWER_PLAY_VALUES.wildcard[0].chance * 100)}% +${POWER_PLAY_VALUES.wildcard[0].seconds} seconds, ${Math.round(POWER_PLAY_VALUES.wildcard[1].chance * 100)}% +${POWER_PLAY_VALUES.wildcard[1].points} points, ${Math.round(POWER_PLAY_VALUES.wildcard[2].chance * 100)}% a free tile of your choice for this hand, or ${Math.round(POWER_PLAY_VALUES.wildcard[3].chance * 100)}% a strike (a shield blocks it).`,
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
    description: `Equips a random charm right now (any of them, even the trade-offs). With full slots, it replaces a random charm. Sometimes (${Math.round(TRIFORCE.luckyChance * 100)}%) a Triforce shard falls out instead, and a shard needs no slot.`,
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
    description: `Starts the moment you pick it: bet ${POWER_PLAY_VALUES.dailyDoubleBet}. If your next word has ${POWER_PLAY_VALUES.dailyDoubleLetters}+ letters, win +${POWER_PLAY_VALUES.dailyDoubleWin}. If not, lose the ${POWER_PLAY_VALUES.dailyDoubleBet}.`,
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
    description: `Starts the moment you pick it: play your next word within ${POWER_PLAY_VALUES.popQuizSeconds} seconds for +${POWER_PLAY_VALUES.popQuizPoints} points and +${POWER_PLAY_VALUES.popQuizBonusSeconds} seconds. Slower, and you lose ${POWER_PLAY_VALUES.popQuizPenaltySeconds} seconds.`,
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
    description: `Starts the moment you pick it: you're handed a secret mission (like a word with a J, K, Q, X or Z, or a word ending in ING). Pull it off within your next ${POWER_PLAY_VALUES.missionWords} words for +${POWER_PLAY_VALUES.missionPrize}. Fail and nothing is lost.`,
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
    description: `Hatch a pet that feeds on your next ${POWER_PLAY_VALUES.tamagotchiWords} words. Each ${POWER_PLAY_VALUES.tamagotchiLetters}+ letter word grows its pot (+${POWER_PLAY_VALUES.tamagotchiStep}, +${POWER_PLAY_VALUES.tamagotchiStep * 2}, +${POWER_PLAY_VALUES.tamagotchiStep * 3}...), and after the last one it pays it all (+${tamagotchiPot(POWER_PLAY_VALUES.tamagotchiWords)}). A shorter word or a strike and it runs away with the pot.`,
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
    description: `Starts the moment you pick it: bid on what your next word will score before you build it. Bid higher, win more: ${POWER_PLAY_VALUES.priceIsRightBids.map(b => `${b.bid}+ pays +${b.prize}`).join(', ')}. Fall short and you lose ${POWER_PLAY_VALUES.priceIsRightBids.map(b => b.miss).slice(0, -1).join(', ')} or ${POWER_PLAY_VALUES.priceIsRightBids[POWER_PLAY_VALUES.priceIsRightBids.length - 1].miss}.`,
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
    description: `Bury your next word: it scores 0 now and pays back x${POWER_PLAY_VALUES.timeCapsuleMultiplier} after ${POWER_PLAY_VALUES.timeCapsuleWords} more words. If the run ends first, it stays buried.`,
    flavorText: 'Your future hasn’t been written yet.',
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
    description: `Your next word scores x${POWER_PLAY_VALUES.redrumBase}, guaranteed. If it's a ${POWER_PLAY_VALUES.redrumLetters}+ letter word that's also a word spelled backward, like STAR (RATS) or LIVE (EVIL), it scores x${POWER_PLAY_VALUES.redrumMultiplier} instead.`,
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
    description: `Take a strike on purpose: +${TIME_BONUS.jackass} seconds and your next word scores x${POWER_PLAY_VALUES.jackassMultiplier}. Shields don't stop it, and you can't use it when a strike would end your run. The strike breaks any 💔 fragile charm you hold.`,
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
    description: 'Tap it and it becomes a copy of the last PowerPlay you used, ready to use again. It can’t copy once-per-run PowerPlays or ones that start the moment you pick them.',
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
    description: `In a boss fight, your next ${POWER_PLAY_VALUES.hadoukenHits} words count as hits even if they break the villain's rule. No boss right now? It waits for the next one.`,
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
    description: `For your next ${POWER_PLAY_VALUES.over9000Words} words, every charm bonus worth points pays double.`,
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
    description: `Pick 1 of ${POWER_PLAY_VALUES.draftDayPacks} face-up packs of ${POWER_PLAY_VALUES.draftDayTiles} tiles. Your pick replaces the ${POWER_PLAY_VALUES.draftDayTiles} lowest-value tiles in your hand.`,
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
    description: `Starts the moment you pick it: race Gary for your next ${POWER_PLAY_VALUES.rivalWords} words. Every second you take, he scores at your pace this run (at least ${POWER_PLAY_VALUES.rivalPointsPerSecond} points a second). Beat his score with those words and win +${POWER_PLAY_VALUES.rivalPrize}.`,
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
    description: `Starts the moment you pick it: your tiles flip face down ${POWER_PLAY_VALUES.birdBoxSeconds} seconds after you see them. Spell your next word from memory for x${POWER_PLAY_VALUES.birdBoxMultiplier}. Tiles you place show their letters.`,
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
    description: `Play a hand of blackjack against the dealer: tap HIT for another card or STAND to stop. Get closer to ${POWER_PLAY_VALUES.blackjackTarget} than the dealer without going over: +${POWER_PLAY_VALUES.blackjackWin}. Blackjack (${POWER_PLAY_VALUES.blackjackTarget} with your first 2 cards) +${POWER_PLAY_VALUES.blackjackNatural}, a tie +${POWER_PLAY_VALUES.blackjackPush}.`,
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
    description: `Higher or lower: call whether the next card (2 to A) beats the last one. Each right call grows the pot (${POWER_PLAY_VALUES.cardSharksLadder.join(', ')}). A wrong call wipes it, a tie is a free pass, and you can bank any time.`,
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
    description: `Starts the moment you pick it: call your next word's length before you build it. ${POWER_PLAY_VALUES.psychicCalls.map(c => `${c.letters}${c.orMore ? '+' : ''} letters +${c.prize}`).join(', ')}. Call it right and the psychic pays; a wrong call costs nothing.`,
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
    description: `For your next ${POWER_PLAY_VALUES.inceptionWords} words, every real word hiding inside yours pays +${POWER_PLAY_VALUES.inceptionPerWord}. CARPET hides CAR, CARP and PET: +${POWER_PLAY_VALUES.inceptionPerWord * 3}. Longer words hide more.`,
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
    description: `Stack your next words into a tower: block 1 adds +${POWER_PLAY_VALUES.jengaStep}, block 2 +${POWER_PLAY_VALUES.jengaStep * 2}, block 3 +${POWER_PLAY_VALUES.jengaStep * 3}, up to ${POWER_PLAY_VALUES.jengaBlocks} blocks (+${jengaPot(POWER_PLAY_VALUES.jengaBlocks).toLocaleString()} in all). Hold the 🧱 chip to cash out any time. A word under ${POWER_PLAY_VALUES.jengaMinLetters} letters, an invalid word or a strike topples it, and you get nothing.`,
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
    description: `Starts the moment you pick it: ${POWER_PLAY_VALUES.fifthGraderSeconds} seconds of times tables, tap the right answer. Each right answer climbs a grade on the ladder (+${POWER_PLAY_VALUES.fifthGraderLadder.slice(0, 4).join(', +')}… up to +${POWER_PLAY_VALUES.fifthGraderLadder[POWER_PLAY_VALUES.fifthGraderLadder.length - 1].toLocaleString()}); a wrong one drops you back a grade. You win the rung you finish on.`,
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
  'withGreatPower', 'gumpLuck', 'fortunesFavor', 'warioWarp', 'thanosGift', 'wildcard', 'psychicFriends',
  'shakeItLikeAPolaroid', 'duckHunt', 'missionImpossible',
  'inception', 'jenga', // v7.62.0
  'fifthGrader', // v7.65.0
]);
