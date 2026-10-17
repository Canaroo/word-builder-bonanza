import { Charm, GameState, EventLogEntry } from '../types';
import { labelize } from '../services/durationTags';

// The 'activate' function is for effects that happen immediately upon selection for passive buffs.
// For selection buffs, it's called after the player makes their choice.
// Ongoing or conditional effects are handled in GameScreen's reducer and game logic functions.

const createPassiveBuff = (id: string) => (gameState: GameState): Partial<GameState> => {
  const charm = CHARMS_LIST.find(c => c.id === id);
  if (!charm) return {};
  // Only add to activeBuffs if it's not a selection-based passive charm that is already handled
  if (charm.effectType !== 'selection') {
      return { activeBuffs: [...gameState.activeBuffs, charm] };
  }
  return {};
};


export const CHARMS_LIST: Charm[] = [
  { 
    id: 'sTierScorer', 
    name: 'S-Tier Scorer', 
    description: "Every S tile is now worth 15 points and doubles your word score.", 
    flavorText: 'Looks like the S finally stands for Super.',
    icon: 'S✨',
    subtheme: 'score',
    effectType: 'passive',
    durationTag: 'PERSISTENT',
    activate: createPassiveBuff('sTierScorer')
  },
  { 
    id: 'finisher', 
    name: 'Finisher', 
    description: 'The base point value of the last letter tile in any valid word is multiplied by 3.', 
    flavorText: 'Nail the ending — it’s where the drama lives.',
    icon: '🎯',
    subtheme: 'score',
    effectType: 'passive',
    durationTag: 'PERSISTENT',
    activate: createPassiveBuff('finisher')
  },
  { 
    id: 'recycler', 
    name: 'Recycler', 
    description: "50% chance to get a new tile of the same letter back after using a tile that has a letter multiplier.",
    flavorText: 'Sustainability has never been so profitable.',
    icon: '♻️',
    subtheme: 'tile',
    effectType: 'passive',
    durationTag: 'PERSISTENT',
    activate: createPassiveBuff('recycler')
  },
  { 
    id: 'theValve', 
    name: 'Vowel Lover', 
    description: 'All vowels now gain +10 points.', 
    flavorText: 'Sometimes, it is all about the little things.',
    icon: '📯',
    subtheme: 'tile',
    effectType: 'passive',
    durationTag: 'PERSISTENT',
    activate: createPassiveBuff('theValve')
  },
   {
    id: 'wildcardWake',
    name: 'Wildcard Wake',
    description: 'When you equip this Charm, you gain an immediate extra shuffle.',
    flavorText: 'A little shake-up when you need it most.',
    icon: '🃏',
    subtheme: 'game',
    effectType: 'immediate',
    durationTag: 'ONE_TIME',
    activate: (gameState) => ({ shuffleCount: (gameState.shuffleCount || 0) + 1 })
  },
  { 
    id: 'silentKiller', 
    name: 'Silent Killer', 
    description: 'If a valid submitted word contains no vowel tiles (A, E, I, O, U), its total score is multiplied by 4.', 
    flavorText: 'No vowels, no mercy.',
    icon: '🤫',
    subtheme: 'score',
    effectType: 'passive',
    durationTag: 'PERSISTENT',
    activate: createPassiveBuff('silentKiller')
  },
  {
    id: 'momentum',
    name: 'Momentum',
    description: 'Make 2 valid words in a row under 10 seconds? +20 bonus points',
    flavorText: 'Keep the rhythm going — fast fingers win runs.',
    icon: '💨',
    subtheme: 'utility',
    effectType: 'triggered',
    durationTag: 'PERSISTENT',
    activate: createPassiveBuff('momentum')
  },
  { 
    id: 'strikeBank', 
    name: 'Strike Bank', 
    description: 'Earn a 4th strike at 500 flawless points. Reach 1000 flawless points for a 5th. Strikes reset the counter.', 
    flavorText: 'Consistency is king.',
    icon: '🏦',
    subtheme: 'game',
    effectType: 'passive',
    durationTag: 'PERSISTENT',
    activate: createPassiveBuff('strikeBank')
  },
  {
    id: 'oneRing',
    name: 'The One Ring',
    description: "Each E in a word gives +15 points.",
    flavorText: 'A quiet power, hiding in plain sight.',
    icon: '💍',
    subtheme: 'tile',
    effectType: 'passive',
    durationTag: 'PERSISTENT',
    activate: createPassiveBuff('oneRing')
  },
  {
    id: 'fluxCapacitor',
    name: 'Flux Capacitor',
    description: "Every 8th word played earns +55% bonus.",
    flavorText: 'Hit 88 MPH with your words — and watch your score travel through time.',
    icon: '🕰️',
    subtheme: 'utility',
    effectType: 'triggered',
    durationTag: 'PERSISTENT',
    activate: createPassiveBuff('fluxCapacitor')
  },
  { 
    id: 'bulletTime', 
    name: 'Bullet Time', 
    description: '6+ letter words now get +200 points.', 
    flavorText: 'When your words go long, time slows. Be the One.',
    icon: '⏱️',
    subtheme: 'score',
    effectType: 'passive',
    durationTag: 'PERSISTENT',
    activate: createPassiveBuff('bulletTime')
  },
  { 
    id: 'infinityGauntlet', 
    name: 'Infinity Gauntlet', 
    description: 'If a player uses all of their available hand tiles to form a single valid word, a flat bonus of 75 points is added to the Super Hand Bonus of 50 points.', 
    flavorText: 'Balance is achieved. Snap!',
    icon: '🧤',
    subtheme: 'score',
    effectType: 'triggered',
    durationTag: 'PERSISTENT',
    activate: createPassiveBuff('infinityGauntlet')
  },
  {
    id: 'batSignal',
    name: 'Bat-Signal',
    description: "Words starting or ending in B, A, T, or M earn +20 points.",
    flavorText: "Call on the night — Gotham approves.",
    icon: '🦇',
    subtheme: 'utility',
    effectType: 'passive',
    durationTag: 'PERSISTENT',
    activate: createPassiveBuff('batSignal')
  },
  {
    id: 'millenniumFalcon',
    name: 'Millennium Falcon',
    description: 'Use exactly 3 consonants in a word to get +20 points.',
    flavorText: 'She may not look like much, but she’s got it where it counts.',
    icon: '🚀',
    subtheme: 'utility',
    effectType: 'passive',
    durationTag: 'PERSISTENT',
    activate: createPassiveBuff('millenniumFalcon')
  },
  {
    id: 'triforceOfCourage',
    name: 'Triforce of Courage',
    description: "If a submitted word contains a 'Z', 'X', or 'Q' tile, a flat bonus of 15 points is added to its score.",
    flavorText: 'Draw your sword — true heroes don’t fear the rarest letters.',
    icon: '△',
    subtheme: 'utility',
    effectType: 'passive',
    durationTag: 'PERSISTENT',
    activate: createPassiveBuff('triforceOfCourage')
  },
  {
    id: 'powerPellet',
    name: 'Power Pellet',
    description: 'All 5-letter words earn +25 points.',
    flavorText: 'Munch your way to victory — just like Pac-Man.',
    icon: '🟡',
    subtheme: 'utility',
    effectType: 'passive',
    durationTag: 'PERSISTENT',
    activate: createPassiveBuff('powerPellet')
  },
  {
    id: 'goldenTicket',
    name: 'Golden Ticket',
    description: 'For every valid word submitted, there is a 10% chance that its final score will be multiplied by 3.',
    flavorText: 'A little chaos... and a lot of chocolate.',
    icon: '🎟️',
    subtheme: 'score',
    effectType: 'passive',
    durationTag: 'PERSISTENT',
    activate: createPassiveBuff('goldenTicket')
  },
  {
    id: 'chaosTheory',
    name: 'Chaos Theory',
    description: 'Words with an even number of letters earn +20.',
    flavorText: 'Unpredictable systems... and strangely rewarding symmetry. Life, uh, finds a way.',
    icon: '🦋',
    subtheme: 'utility',
    effectType: 'passive',
    durationTag: 'PERSISTENT',
    activate: createPassiveBuff('chaosTheory')
  },
  {
    id: 'starPower',
    name: 'Star Power',
    description: "Words with S, T, and A earn 4x score.",
    flavorText: 'Doot-doot-doot-doot-doot-doot! You’re untouchable when S, T, and A align.',
    icon: '🌟',
    subtheme: 'score',
    effectType: 'passive',
    durationTag: 'PERSISTENT',
    activate: createPassiveBuff('starPower')
  },
  {
    id: 'weDidntStartTheFire',
    name: 'We Didn’t Start the Fire',
    description: "Words with 3+ unique vowels get +25 points.",
    flavorText: 'The vowels keep turning, and the score keeps burning.',
    icon: '🔥',
    subtheme: 'utility',
    effectType: 'passive',
    durationTag: 'PERSISTENT',
    activate: createPassiveBuff('weDidntStartTheFire')
  },
  {
    id: 'goldenSnitch',
    name: 'Golden Snitch',
    description: 'Get 5 valid words in a row to earn +500 points. Miss once, and it’s gone.',
    flavorText: 'Fast, rare, and game-changing — catch it if you can.',
    icon: '🕊️',
    subtheme: 'utility',
    effectType: 'triggered',
    durationTag: 'LIMITED',
    activate: createPassiveBuff('goldenSnitch')
  },
  {
    id: 'pianoManEncore',
    name: 'Piano Man Encore',
    description: "Score 45+ on a word and your next word gains +15%.",
    flavorText: 'Sing us another — you’re the word-making man.',
    icon: '🎹',
    subtheme: 'utility',
    effectType: 'passive',
    durationTag: 'PERSISTENT',
    activate: createPassiveBuff('pianoManEncore')
  },
  {
    id: 'italianRestaurantEnding',
    name: 'Italian Restaurant Ending',
    description: "If your word ends in ‘AN’, each vowel in it earns 3× points.",
    flavorText: 'A toast to Brenda and Eddie — and a perfect vowel-heavy ending.',
    icon: '🍝',
    subtheme: 'utility',
    effectType: 'passive',
    durationTag: 'PERSISTENT',
    activate: createPassiveBuff('italianRestaurantEnding')
  },
  {
    id: 'inigosRevenge',
    name: 'Inigo’s Revenge',
    description: "Use the letter 'I' twice in a word to earn +50 points.",
    flavorText: 'You keep using that tile. I do not think it means what you think it means.',
    icon: '🤺',
    subtheme: 'utility',
    effectType: 'passive',
    durationTag: 'PERSISTENT',
    activate: createPassiveBuff('inigosRevenge')
  },
  {
    id: 'battleOfWits',
    name: 'Battle of Wits',
    description: "Words that start and end with the same letter score 4x.",
    flavorText: 'Clearly, you’ve made the classic blunder — underestimating your vocabulary.',
    icon: '⚔️',
    subtheme: 'score',
    effectType: 'passive',
    durationTag: 'PERSISTENT',
    activate: createPassiveBuff('battleOfWits')
  },
  {
    id: 'trueLove',
    name: 'True Love',
    description: "Words that contain L and V earn +100 points.",
    flavorText: 'Death can’t stop it. Only slightly tricky tile combinations can.',
    icon: '❤️',
    subtheme: 'utility',
    effectType: 'passive',
    durationTag: 'PERSISTENT',
    activate: createPassiveBuff('trueLove')
  },
  {
    id: 'nicolesGrace',
    name: 'Nicole’s Grace',
    description: "If the submitted word contains at least one ‘M’ (for mom!) or ends in a vowel, it earns a 15% bonus to its total score.",
    flavorText: 'Steady, strong, and always one step ahead — just like Mom.',
    icon: '💎',
    subtheme: 'score',
    effectType: 'passive',
    durationTag: 'PERSISTENT',
    activate: createPassiveBuff('nicolesGrace')
  },
  {
    id: 'christiansHoodieMode',
    name: 'Christian’s Hoodie Mode',
    description: "If your word contains the letters G, A, or M, and is submitted within 10 seconds, it earns a 15% bonus to its total score.",
    flavorText: 'Hoodie up. Game on. Comfort meets combat.',
    icon: '🎮',
    subtheme: 'utility',
    effectType: 'triggered',
    durationTag: 'PERSISTENT',
    activate: createPassiveBuff('christiansHoodieMode')
  },
  {
    id: 'lenaOfTheLostLights',
    name: 'Lena of the Lost Lights',
    description: "If the submitted word contains at least one of the letters D, R, K, or N, a 10% bonus is added to its total score.",
    flavorText: 'Shadows don’t scare you. You dance through the dark and come back stronger.',
    icon: '🦇',
    subtheme: 'score',
    effectType: 'passive',
    durationTag: 'PERSISTENT',
    activate: createPassiveBuff('lenaOfTheLostLights')
  },
  {
    id: 'lTrainShuffle',
    name: 'L Train Shuffle',
    description: "Submit a word with both ‘L’ and ‘T’ to gain a free shuffle (max twice per game).",
    flavorText: 'Attention Players! Doors open on the left at L and T.',
    icon: '🚆',
    subtheme: 'game',
    maxUses: 2,
    effectType: 'triggered',
    durationTag: 'LIMITED',
    activate: createPassiveBuff('lTrainShuffle')
  },
  {
    id: 'deepFreeze',
    name: 'Deep Freeze',
    description: 'When the timer hits 0, the game pauses for 5 extra seconds before ending. One-time use.',
    flavorText: 'Like a classic Chicago winter, everything stops—but only for a moment.',
    icon: '🧊',
    subtheme: 'game',
    maxUses: 1,
    effectType: 'triggered',
    durationTag: 'ONE_TIME',
    activate: createPassiveBuff('deepFreeze')
  },
  {
    id: 'beanCounter',
    name: 'Bean Counter',
    description: 'Earn a 50-point bonus each time your total score crosses a multiple of 500 (e.g., passing 500, 1000, etc.).',
    flavorText: 'It’s reflective, shiny, and surprisingly generous—just like the Bean.',
    icon: '🫘',
    subtheme: 'utility',
    effectType: 'triggered',
    durationTag: 'PERSISTENT',
    activate: createPassiveBuff('beanCounter')
  },
  {
    id: 'diceRollProtocol',
    name: 'Dice Roll Protocol',
    description: 'For the next 3 rounds, one random tile in your hand is swapped for a new one with a 2x score multiplier.',
    flavorText: '“It’s a jungle out there. Expect chaos.”',
    icon: '🎲',
    subtheme: 'tile',
    maxUses: 3,
    effectType: 'triggered',
    durationTag: 'LIMITED',
    activate: createPassiveBuff('diceRollProtocol')
  },
  {
    id: 'glitchInTheCode',
    name: 'Glitch in the Code',
    description: 'After every 6th consecutive valid word, a 5-second bonus is added to the timer for the next word submission only.',
    flavorText: '“Dodge the clock. One move at a time.”',
    icon: '🤖',
    subtheme: 'game',
    effectType: 'triggered',
    durationTag: 'PERSISTENT',
    activate: createPassiveBuff('glitchInTheCode')
  },
  {
    id: 'shapeshiftersTongue',
    name: 'Shapeshifter’s Tongue',
    description: 'Once per game, change one letter in your hand to any other letter of your choice.',
    flavorText: '“Imitation is the sincerest form of wordplay.”',
    icon: '👅',
    subtheme: 'tile',
    maxUses: 1,
    effectType: 'selection',
    selectionType: 'tile_transform',
    durationTag: 'ONE_TIME',
    activate: (gameState) => ({...gameState}) // Logic is handled in the reducer
  },
  {
    id: 'oneTileToRuleThemAll',
    name: 'One Tile to Rule Them All',
    description: 'One randomly assigned tile in your hand becomes worth 25 points for one use.',
    flavorText: '“It bends to your will—just once.”',
    icon: '👑',
    subtheme: 'tile',
    effectType: 'immediate',
    durationTag: 'ONE_TIME',
    activate: (gameState: GameState): Partial<GameState> => {
      // The random selection and point assignment happens in the GameScreen reducer.
      // We add a log entry here as requested.
      const logEntry: EventLogEntry = {
        type: 'event',
        id: `charm-oneTileToRuleThemAll-${Date.now()}`,
        name: 'One Tile to Rule Them All',
        description: 'A random tile in your hand is now worth 25 points for one use.',
        scoreChange: 0,
        cumulativeScore: gameState.score,
        icon: '👑'
      };
      return { log: [...gameState.log, logEntry] };
    }
  },
  {
    id: 'groundhogsDay',
    name: 'Groundhog’s Day',
    description: 'If your timer ends without any word played, you restart the round with the same tiles and timer. Stackable, multi‑use; each award grants +1 use; automatically restarts the round on timeout until uses are exhausted.',
    flavorText: '“Same tiles. Same time. One more shot.”',
    icon: '🔄',
    subtheme: 'game',
    effectType: 'triggered',
    durationTag: 'LIMITED',
    activate: (gameState: GameState): Partial<GameState> => {
      const charm = CHARMS_LIST.find(c => c.id === 'groundhogsDay')!;
      const isBuffActive = gameState.activeBuffs.some(b => b.id === 'groundhogsDay');
      const newActiveBuffs = isBuffActive ? gameState.activeBuffs : [...gameState.activeBuffs, charm];
      return {
        groundhogDayCharges: (gameState.groundhogDayCharges || 0) + 1,
        activeBuffs: newActiveBuffs
      };
    }
  },
  {
    id: 'doctorStrangesLoop',
    name: 'Dr. Strange’s Loop',
    description: 'If you submit the same valid word twice in a single game, the second submission automatically earns a 2× score multiplier.',
    flavorText: '“We’re in the endgame, again.”',
    icon: '🌀',
    subtheme: 'score',
    effectType: 'passive',
    durationTag: 'PERSISTENT',
    activate: createPassiveBuff('doctorStrangesLoop')
  },
  {
    id: 'sherlocksSyntax',
    name: "Sherlock's Syntax",
    description: "Form a palindrome word (reads the same forwards and backwards) to add +50 points to your word score.",
    flavorText: "Elementary, my dear Watson.",
    icon: '🧠',
    subtheme: 'utility',
    effectType: 'passive',
    durationTag: 'PERSISTENT',
    activate: createPassiveBuff('sherlocksSyntax')
  },
  {
    id: 'executeOrder66',
    name: "Execute Order 66",
    description: "If your word includes a double letter (like ‘LL’), add 6 seconds to your next round.",
    flavorText: "Good soldiers follow orders.",
    icon: '🛰️',
    subtheme: 'game',
    effectType: 'triggered',
    durationTag: 'PERSISTENT',
    activate: createPassiveBuff('executeOrder66')
  },
  {
    id: 'sacredHeart',
    name: 'Sacred Heart',
    description: 'If your word uses the letters "J" and "D" you instantly add 100 points to your score.',
    flavorText: 'Eagle!!',
    icon: '🩺',
    subtheme: 'utility',
    effectType: 'passive',
    durationTag: 'PERSISTENT',
    activate: createPassiveBuff('sacredHeart')
  },
  {
    id: 'buffyBonus',
    name: 'Buffy Bonus',
    description: 'If you submit a word between 8 PM and 8 AM (real-world time), it scores 15% more.',
    flavorText: 'Words played at night hit harder.',
    icon: '🧛‍♂️',
    subtheme: 'utility',
    effectType: 'passive',
    durationTag: 'PERSISTENT',
    activate: createPassiveBuff('buffyBonus')
  },
  {
    id: 'thrillerNight',
    name: 'Thriller Night',
    description: 'Every fourth word you play gets a +30 bonus.',
    flavorText: 'Something spooky this way comes... regularly.',
    icon: '🧟',
    subtheme: 'utility',
    effectType: 'triggered',
    durationTag: 'PERSISTENT',
    activate: createPassiveBuff('thrillerNight')
  },
  {
    id: 'duckHuntCombo',
    name: 'Duck Hunt Combo',
    description: 'Use the same letter in 3 straight words? +350 points.',
    flavorText: 'Like a sharpshooter — precision gets rewarded.',
    icon: '🎯',
    subtheme: 'utility',
    effectType: 'triggered',
    durationTag: 'PERSISTENT',
    activate: createPassiveBuff('duckHuntCombo')
  },
  {
    id: 'drMariosCure',
    name: 'Dr. Mario’s Cure',
    description: 'Submit 3 words in a row without using any multiplier tiles to earn a +100 bonus.',
    flavorText: 'Clear the junk — play clean, score big.',
    icon: '💊',
    subtheme: 'utility',
    effectType: 'triggered',
    durationTag: 'PERSISTENT',
    activate: createPassiveBuff('drMariosCure')
  },
  {
    id: 'totallyClueless',
    name: 'Totally Clueless',
    description: 'If your word scores less than 10 points, you earn a +25 point bonus.',
    flavorText: 'Ugh, as if! But, surprise — you score big on weak words.',
    icon: '👛',
    subtheme: 'score',
    effectType: 'passive',
    durationTag: 'PERSISTENT',
    activate: createPassiveBuff('totallyClueless')
  },
  {
    id: 'scoobyStack',
    name: 'Scooby Stack',
    description: 'Every word that contains double letters (like “Scooby”) gets +55 bonus points.',
    flavorText: 'Ruh-roh! Stack snacks, not strikes.',
    icon: '🧟‍♀️',
    subtheme: 'utility',
    effectType: 'passive',
    durationTag: 'PERSISTENT',
    activate: createPassiveBuff('scoobyStack')
  },
  {
    id: 'powerStarResidual',
    name: 'Power Star Residual',
    description: 'After you score 150+ on a single word, all future words get +5 bonus points.',
    flavorText: 'One good hit echoes forever.',
    icon: '🪙',
    subtheme: 'score',
    effectType: 'passive',
    durationTag: 'PERSISTENT',
    activate: createPassiveBuff('powerStarResidual')
  },
  {
    id: 'radioactiveSpiderBite',
    name: 'Radioactive Spider Bite',
    description: 'Score 2x if your word contains all these letters "D" "E" and "R"',
    flavorText: 'With great vocabulary comes great scoring potential.',
    icon: '📻',
    subtheme: 'score',
    effectType: 'passive',
    durationTag: 'PERSISTENT',
    activate: createPassiveBuff('radioactiveSpiderBite')
  },
  {
    id: 'hyruleHustle',
    name: 'Hyrule Hustle',
    description: 'Words that start with H, L, or Z earn +15 points.',
    flavorText: 'Like any good hero, you start strong — especially if you\'re from Hyrule.',
    icon: '🏰',
    subtheme: 'utility',
    effectType: 'passive',
    durationTag: 'PERSISTENT',
    activate: createPassiveBuff('hyruleHustle')
  },
  {
    id: 'luna',
    name: 'LUNA',
    description: 'Words with more vowels than consonants get a +50 bonus.',
    flavorText: "Channel the moon's mystical energy — when your words are vowel-heavy, your score ascends.",
    icon: '🌕',
    subtheme: 'utility',
    effectType: 'passive',
    durationTag: 'PERSISTENT',
    activate: createPassiveBuff('luna')
  },
  { 
    id: 'pivot', 
    name: 'PIVOT!', 
    description: 'All P tiles are worth 10 points, and all T tiles are worth 2 points for the rest of the game.', 
    flavorText: '“PIVOT!! PIVOT!! …Okay, I don’t think it’s gonna pivot.”',
    icon: '🛋️',
    subtheme: 'tile',
    effectType: 'passive',
    durationTag: 'PERSISTENT',
    activate: createPassiveBuff('pivot')
  },
  { 
    id: 'cleverGirl', 
    name: 'Clever Girl', 
    description: 'Play a word that contains at least three different letters from the word “RAPTOR” (R, A, P, T, O) to earn +5 seconds on the timer.', 
    flavorText: '“They’ve figured out how to open doors… and score bonuses.”',
    icon: '🦖',
    subtheme: 'game',
    effectType: 'triggered',
    durationTag: 'PERSISTENT',
    activate: createPassiveBuff('cleverGirl')
  },
  { 
    id: 'finalFrontier', 
    name: 'The Final Frontier', 
    description: 'For every 1,000 points you score, you receive a free Challenge. This effect can trigger a maximum of 2 times.', 
    flavorText: '“To boldly go where no vocabulary has gone before.”',
    icon: '🧑‍🚀',
    subtheme: 'game',
    maxUses: 2,
    effectType: 'triggered',
    durationTag: 'LIMITED',
    activate: createPassiveBuff('finalFrontier')
  },
  { 
    id: 'theDudeAbides', 
    name: 'The Dude Abides', 
    description: 'Play 3-letter words? Gain +10 points every time. Just don’t overthink it.', 
    flavorText: '“Yeah, well, you know, that\'s just, like, your opinion, man.”',
    icon: '🥃',
    subtheme: 'utility',
    effectType: 'passive',
    durationTag: 'PERSISTENT',
    activate: createPassiveBuff('theDudeAbides')
  },
  { 
    id: 'pantsOnFire', 
    name: 'Pants on Fire', 
    description: "If your word contains the letters ‘L’ and ‘I’, earn +25 points for ‘bending the truth.’", 
    flavorText: '“The truth will set you free... but points feel better.”',
    icon: '🤥',
    subtheme: 'utility',
    effectType: 'triggered',
    durationTag: 'PERSISTENT',
    activate: createPassiveBuff('pantsOnFire')
  },
  { 
    id: 'chuckNorrisWhy', 
    name: 'Why? Because Chuck Norris.', 
    description: 'If you create a word ending in Y, a random tile in your rack transforms into a 2x word score tile.', 
    flavorText: 'Chuck Norris doesn’t ask why. Chuck Norris decides why.',
    icon: '🥋',
    subtheme: 'tile',
    effectType: 'triggered',
    durationTag: 'PERSISTENT',
    activate: createPassiveBuff('chuckNorrisWhy')
  },
  { 
    id: 'ctuSafeHouse', 
    name: 'CTU Safe House', 
    description: 'If you play a word worth fewer than 20 points, automatically gain a replacement tile worth at least 4 points.', 
    flavorText: 'Even in the worst situations, Jack has a fallback plan… and it’s heavily armed.',
    icon: '🏠',
    subtheme: 'tile',
    effectType: 'triggered',
    durationTag: 'PERSISTENT',
    activate: createPassiveBuff('ctuSafeHouse')
  },
  {
    id: 'strangeMagic',
    name: 'Strange Magic',
    description: 'Any word that contains consecutive vowels (AA, EE, II, OO, UU) gains +55 bonus points.',
    flavorText: 'Reality warps when vowels pair up. Double the letters, double the score.',
    icon: '🔮',
    subtheme: 'utility',
    effectType: 'passive',
    durationTag: 'PERSISTENT',
    activate: createPassiveBuff('strangeMagic')
  },
  {
    id: 'turtlePower',
    name: 'Turtle Power',
    description: 'Words that contain at least one double consonant pair (LL, SS, TT, etc.) earn +55 bonus points.',
    flavorText: 'Cowabunga, dude! Radical letter stacks score big.',
    icon: '🍕',
    subtheme: 'utility',
    effectType: 'passive',
    durationTag: 'PERSISTENT',
    activate: createPassiveBuff('turtlePower')
  },
  {
    id: 'iceAgeBonus',
    name: 'Ice Age Bonus',
    description: 'Any word that contains both the letters I and C earns +50 bonus points.',
    flavorText: 'Scrat approves — frozen letters mean frozen points.',
    icon: '🧊',
    subtheme: 'utility',
    effectType: 'passive',
    durationTag: 'PERSISTENT',
    activate: createPassiveBuff('iceAgeBonus')
  },
];
