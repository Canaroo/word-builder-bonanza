
import { PowerPlay, GameState, EventLogEntry } from '../types';
import { labelize } from '../services/durationTags';

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

/** PowerPlays that fire the moment you pick them, so you also keep the one you're holding. */
export const INSTANT_POWER_PLAY_IDS = new Set([
  'thwomped', 'fluncleIsProud',
  'strikeShield', 'plotArmor', 'saveByTheBell', 'timeTurner', 'mutationProtocol',
  'deepFreeze', 'groundhogsDay', 'lifeFindsAWay', 'wildcardWake',
]);

export const POWER_PLAYS_LIST: PowerPlay[] = [
  {
    id: 'letterUpgrade',
    name: 'Letter Upgrade',
    description: 'Pick a letter: its tiles are worth 3x for your next 5 words.',
    flavorText: 'Choose wisely. Your alphabet just got an MVP.',
    icon: '🔠',
    subtheme: 'score',
    effectType: 'selection',
    selectionType: 'letter',
    durationTag: 'LIMITED',
    activate: letterBoost('letterUpgrade', 5),
  },
  {
    id: 'polish',
    name: 'Polish',
    description: 'Pick a letter: words containing it score x3 for your next 5 words.',
    flavorText: 'Give your favorite letter the spotlight treatment.',
    icon: '💅',
    subtheme: 'score',
    effectType: 'selection',
    selectionType: 'letter',
    durationTag: 'LIMITED',
    activate: letterBoost('polish', 5),
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
    name: 'Deep Freeze',
    description: 'Arms right away: the first time your clock hits 0, time freezes and you get 10 bonus seconds.',
    flavorText: 'Like a classic Chicago winter, everything stops—but only for a moment.',
    icon: '🧊',
    subtheme: 'timer',
    effectType: 'passive',
    durationTag: 'ONE_TIME',
    activate: arm('deepFreeze'),
  },
  {
    id: 'groundhogsDay',
    name: 'Groundhog’s Day',
    description: 'Arms right away: if your clock runs out before you play a word, you replay the round with the same tiles and a fresh clock. Stacks.',
    flavorText: '“Same tiles. Same time. One more shot.”',
    icon: '🔄',
    subtheme: 'timer',
    effectType: 'passive',
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
    description: 'A random tile in your hand becomes worth 30 points for this round.',
    flavorText: '“It bends to your will—just once.”',
    icon: '💍',
    subtheme: 'rack',
    effectType: 'immediate',
    durationTag: 'ONE_TIME',
    activate: () => ({}), // The tile is picked in the GameScreen reducer.
  },
  {
    id: 'shapeshiftersTongue',
    name: 'Shapeshifter’s Tongue',
    description: 'Change one tile in your hand to any letter you like.',
    flavorText: '“Imitation is the sincerest form of wordplay.”',
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
    icon: '🎮',
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
    description: 'Bust ALL your strikes. Busting costs 15 seconds from your time bank (it never drops below 5).',
    flavorText: 'I ain’t afraid of no strikes.',
    icon: '👻',
    subtheme: 'strike',
    effectType: 'immediate',
    durationTag: 'ONE_TIME',
    activate: () => ({ strikes: 0 }),
  },
  {
    id: 'lifeFindsAWay',
    name: 'Life Finds a Way',
    description: 'Arms right away: when a strike would end your run, you survive with one strike to spare and +20 seconds.',
    flavorText: 'Clever girl. Your run evolves past extinction.',
    icon: '🦖',
    subtheme: 'strike',
    effectType: 'passive',
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
    description: 'Your next 3 words each score x3, but each one costs 8 seconds.',
    flavorText: 'They’ve gone to plaid!',
    icon: '🚀',
    subtheme: 'score',
    effectType: 'next_word',
    durationTag: 'LIMITED',
    activate: arm('ludicrousSpeed', { words: 3 }),
  },
  {
    id: 'gadgetHands',
    name: 'Go-Go-Gadget Hands',
    description: 'Grab 2 extra tiles now; your hand refills to 10 tiles instead of 8 for the next 2 rounds.',
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
    description: 'Next word only: 6+ letters scores x5. Anything shorter scores 0.',
    flavorText: 'C-C-C-COMBO BREAKER! Go big or go home.',
    icon: '🥊',
    subtheme: 'score',
    effectType: 'next_word',
    durationTag: 'ONE_TIME',
    activate: arm('comboBreaker'),
  },
  { 
    id: 'timeBoost', 
    name: 'Time Boost', 
    description: 'Add 15 seconds to your timer.', 
    flavorText: 'Sometimes, all you need is a little more time on the clock.',
    icon: '⏳',
    subtheme: 'timer',
    effectType: 'immediate',
    durationTag: 'ONE_TIME',
    activate: (gameState) => ({...gameState}) // Handled directly in reducer due to affecting screen state
  },
  { 
    id: 'biglyScore', 
    name: 'Bigly Score', 
    description: 'Your next word scores 4x.', 
    flavorText: 'Huge. Tremendous. The biggest word play you’ve ever seen.',
    icon: '📢',
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
    name: 'Strike Shield', 
    description: 'Block the next strike.', 
    flavorText: 'When danger comes, your shield holds.',
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
    name: 'Swap Out', 
    description: 'Replace 2 tiles of your choice with new random ones.', 
    flavorText: 'Fresh tiles, fresh hope.',
    icon: '♻️',
    subtheme: 'rack',
    effectType: 'selection',
    selectionType: 'tile_swap',
    swapConfig: { min: 2, max: 2 },
    durationTag: 'ONE_TIME',
    activate: (gameState) => ({...gameState}) // Logic is handled in the reducer
  },
   { 
    id: 'wordLock', 
    name: 'Word Lock', 
    description: 'Submit any 5-letter-or-less word — real or not.', 
    flavorText: 'Break the rules... just this once.',
    icon: '🚫',
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
    description: 'With this active, instead of getting a strike, you will lose 150 points. This is a one time use power.', 
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
    name: 'Multiverse of Sadness', 
    description: 'Next word: half points, half becomes bonus time.', 
    flavorText: 'Every choice creates a new timeline. Some are kinder than others.',
    icon: '🌀',
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
    description: 'Replace your whole hand. Next word scores 4x.', 
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
    name: 'Rewind', 
    description: 'Remove your last strike and gain 10 seconds.', 
    flavorText: 'Backspace for real life.',
    icon: '⏪',
    subtheme: 'strike',
    effectType: 'immediate',
    durationTag: 'ONE_TIME',
    activate: (gameState) => ({
      strikes: Math.max(0, gameState.strikes - 1),
    })
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
    description: 'Shake the magic eight ball: 40% chance to lose 200 points, 50% chance to gain 250 points, or 10% chance to gain 500 points.',
    flavorText: 'A gamble for the bold.',
    icon: '🎱',
    subtheme: 'score',
    effectType: 'immediate',
    durationTag: 'ONE_TIME',
    activate: (gameState) => ({...gameState}) // Handled in GameScreen
  },
  { 
    id: 'timeTurner', 
    name: 'Time Turner', 
    description: 'Your next 2 words each add an extra 30 seconds to your clock.',
    flavorText: '“Like Hermione in third year, you\'ve got time to do it all—twice.”',
    icon: '⌛',
    subtheme: 'timer',
    effectType: 'passive',
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
    description: 'Instant +150 points; your very next word is forced to score exactly 1 point.', 
    flavorText: 'Dwight showers you with 150 Schrute Bucks (1 Buck = 1 point). Enjoy the boost, then brace yourself—whatever word you play next will be capped at a single point.',
    icon: '💵',
    subtheme: 'score',
    effectType: 'immediate',
    durationTag: 'ONE_TIME',
    activate: (gameState) => ({...gameState}) // Handled in GameScreen
  },
  { 
    id: 'redWedding', 
    name: 'Red Wedding', 
    description: 'Sacrifice 2 random tiles now; your very next word earns 5× its normal score.', 
    flavorText: 'Make the ultimate sacrifice. Two letters meet an untimely end—no replacements until after you play—yet vengeance is sweet: your next word scores five times its usual value.',
    icon: '🏰',
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
    name: 'Mutation Protocol',
    description: 'For the next 2 rounds, you will be guaranteed 1 Super Tile worth 4× its base value.',
    flavorText: 'Your tiles are evolving. Some faster... some stronger. Embrace the anomaly.',
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
    flavorText: 'Even the humblest vowel gains Vibranium strength. Activate, build your word, and watch each letter’s value jump to a minimum of fifteen.',
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
    description: 'Pick one: Freeze time for 10s or erase a strike.', 
    flavorText: 'Blue pill pauses the countdown for ten seconds; red pill deletes one strike from your record. Choose wisely—only one effect may be claimed.',
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
    description: 'Instantly gain 100 points. The score of your very next word is sacrificed to zero.', 
    flavorText: 'Balance restored. But not without cost.',
    icon: '🫰',
    subtheme: 'score',
    effectType: 'next_word',
    durationTag: 'ONE_TIME',
    activate: (gameState) => {
      const powerPlay = POWER_PLAYS_LIST.find(p => p.id === 'thanosGift')!;
      return { 
          activePowerPlays: { ...gameState.activePowerPlays, thanosGift: true },
          activeBuffs: [...gameState.activeBuffs, powerPlay]
      };
    }
  },
  { 
    id: 'heisenberg', 
    name: 'Heisenberg', 
    description: 'Next word is triple score or zero—50% chance.', 
    flavorText: 'Say his name and roll the dice: your upcoming word is either tripled or wiped to zero (no strike if it lands on zero).',
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
    description: 'All “S” tiles in your current hand jump to 15 points this round.', 
    flavorText: 'Feel the Force course through every serpentine letter—those S’s pack Sith-level power for a single turn.',
    icon: '⚔️',
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
    description: 'Duplicate one chosen letter—pull a twin into your hand.', 
    flavorText: 'Fire the Hookshot to snag a perfect copy of any tile you already hold. The original stays; the duplicate joins your hand for this round only, giving you an extra letter to play with.',
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
    description: 'No timer for your next turn. Plan at your own pace.', 
    flavorText: 'You’re weightless—compose your upcoming word with zero time pressure. After submission, the normal countdown returns.',
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
    description: "Replace up to 3 individual tiles of your choice, no shuffle penalty.",
    flavorText: "Spit out your tiles and swallow new ones!",
    icon: '🦖',
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
    description: "Instantly score 100 points and reshuffles your hand for free.",
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
    description: "25% chance 10s added to timer. 25% chance +20 to score. 25% chance +1 shuffle. 25% chance you earn a strike.",
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
    description: 'Refill your time bank to the max (90 seconds) — even if you were down to the last gasp.',
    flavorText: '“Just tap it in. Give it a little tappy. Tap tap taparoo.”',
    icon: '⛳',
    subtheme: 'timer',
    effectType: 'immediate',
    maxUses: 1,
    durationTag: 'ONE_TIME',
    activate: (gameState) => ({...gameState}) // Handled in GameScreen
  },
  {
    id: 'chubbsPepTalk',
    name: 'Chubbs’ Pep Talk',
    description: 'When used it will remove one strike.',
    flavorText: '“Just easin’ the tension, baby.”',
    icon: '💪',
    subtheme: 'strike',
    effectType: 'immediate',
    maxUses: 1,
    durationTag: 'ONE_TIME',
    activate: (gameState) => {
      const strikeRemoved = gameState.strikes > 0;
      const newStrikes = Math.max(0, gameState.strikes - 1);

      if (strikeRemoved) {
        const logEntry: EventLogEntry = {
          type: 'event',
          id: `pp-chubbsPepTalk-${Date.now()}`,
          name: 'Chubbs’ Pep Talk',
          description: 'One strike was removed.',
          scoreChange: 0,
          cumulativeScore: gameState.score,
          icon: '💪',
        };
        return {
          strikes: newStrikes,
          log: [...gameState.log, logEntry],
        };
      }
      return { strikes: newStrikes };
    }
  },
  {
    id: 'cassiesClue',
    name: 'Cassie’s Clue',
    description: 'Discard up to 3 tiles to get C, A, and T. If your next word uses all three, it scores 3x.',
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
    description: "Wager your next word's score on a 50/50 coin flip. It's either double, or zero.",
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
    description: 'TMNT-style chaos — all consonants in your next word score +10.',
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
    description: 'Reveals a possible word that can be played with your current tiles with the starting letter highlighted in red.',
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
    description: '2 letters are randomly swapped out for a 2x and a 4x tile.',
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
    durationTag: 'ONE_TIME',
    activate: (gameState) => ({...gameState}) // Handled in GameScreen
  },
  {
    id: 'treehouseOfHorror',
    name: 'Treehouse of Horror',
    description: 'All tile values are randomized for the next 3 turns.',
    flavorText: 'Things get weird.',
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
    description: 'Select any tile on your rack and set its value to 20.',
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
    description: "Select a tile from your hand. It's returned to the bag and can't be used this round. If you use a tile with the same letter next round, gain +50 points.",
    flavorText: 'One shot, one bonus.',
    icon: '🦆',
    subtheme: 'utility',
    effectType: 'selection',
    selectionType: 'custom',
    durationTag: 'LIMITED',
    activate: (gameState) => ({...gameState}) // Handled in GameScreen
  },
  {
    id: 'thwomped',
    name: 'Thwomped!',
    description: 'Apparently you like a good challenge. Take an extra one then. Here we go!',
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
    description: "Activating this power-up gives you two boosts: first, an immediate bonus based on HALF your best word from this game, and then your next word's score will be DOUBLED!",
    flavorText: 'A brilliant plan, boosted by pure genius (and a little help from Pinky!).',
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
    description: 'Gain +100 points now; your next word costs 10 seconds from your clock.',
    flavorText: 'Classic Wario — future problems, present profits.',
    icon: '🛸',
    subtheme: 'score',
    effectType: 'immediate',
    durationTag: 'ONE_TIME',
    activate: (gameState) => ({...gameState}) // Handled in GameScreen
  },
  {
    id: 'animaniacsMayhem',
    name: 'Animaniacs Mayhem',
    description: 'Shuffle your hand, but get 2 guaranteed 2X multiplier tiles.',
    flavorText: 'Total chaos! Your whole rack reshuffles, but the 2X tiles are your friends.',
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
    description: 'Free shuffle. Discards all current tiles and draws a fresh hand.',
    flavorText: 'Smashes your whole rack and replaces all letters. No scoring effect — just catharsis.',
    icon: '🐵',
    subtheme: 'rack',
    effectType: 'immediate',
    durationTag: 'ONE_TIME',
    activate: (gameState) => ({...gameState}) // Handled in GameScreen
  },
  {
    id: 'tetrisTouch',
    name: 'Tetris Touch',
    description: 'If your next word has alternating vowels and consonants, it scores 4x.',
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
    description: 'Adds +5 seconds to your next 3 turns.',
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
    description: 'Next word: 50% chance for 4x score, 50% chance to lose 400 points.',
    flavorText: 'Hit the leader — or yourself.',
    icon: '👓',
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
    description: 'One random tile on your rack becomes a 4X Super Tile for this turn only.',
    flavorText: 'If there was a problem, yo — you’ll solve it.',
    icon: '❄️',
    subtheme: 'rack',
    effectType: 'immediate',
    durationTag: 'ONE_TIME',
    activate: (gameState) => ({...gameState}) // Handled in GameScreen
  },
  { 
    id: 'rescueDrop', 
    name: 'Rescue Drop', 
    description: 'A random tile is removed from your hand. It will be returned at the start of your next round with a temporary value of 20 points.', 
    flavorText: 'When there’s danger, they’re never too far — but sometimes they’re fashionably late.',
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
    flavorText: '“Vowels beware. Masked justice is here.”',
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
    name: 'Scrooge Swipe', 
    description: 'Gain 1 Credit (spend them in Vibez), but immediately lose 500 points.', 
    flavorText: '“Some say fortune favors the bold. Others say it favors the rich duck in a top hat.”',
    icon: '🪙',
    subtheme: 'utility',
    effectType: 'immediate',
    durationTag: 'ONE_TIME',
    activate: (gameState) => ({...gameState}) // Handled in GameScreen
  },
  { 
    id: 'wordionaire', 
    name: 'Who Wants to Be a Wordionaire?', 
    description: 'Choose one of three lifelines: Fast Cash (Instantly gain 100 points), Phone-a-Friend (reveals best word), or Double Down (next word x2 score).', 
    flavorText: '“Big brains. Bigger words. Even bigger consequences.”',
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
    description: 'Pick any tile in your hand. It will randomly transform into a combo tile (e.g., TH, SH, QU, ING).', 
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
    description: 'A risky play — give up some safety for instant reward. Sacrifice one strike to gain +500 points. Cannot be used with only 1 strike left.',
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
    description: 'A gamble from the arcade days — huge multiplier or tiny scrap. Your next valid word has a 50% chance to score ×3 or be capped at 5 points.',
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
];
