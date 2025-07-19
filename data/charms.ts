import { Charm, GameState } from '../types';

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
    effectType: 'passive',
    activate: createPassiveBuff('sTierScorer')
  },
  { 
    id: 'finisher', 
    name: 'Finisher', 
    description: 'The base point value of the last letter tile in any valid word is multiplied by 3.', 
    flavorText: 'Nail the ending — it’s where the drama lives.',
    icon: '🎯',
    effectType: 'passive',
    activate: createPassiveBuff('finisher')
  },
  { 
    id: 'recycler', 
    name: 'Recycler', 
    description: "50% chance to get a new tile of the same letter back after using a tile that has a letter multiplier.",
    flavorText: 'Sustainability has never been so profitable.',
    icon: '♻️',
    effectType: 'passive',
    activate: createPassiveBuff('recycler')
  },
  { 
    id: 'theValve', 
    name: 'Vowel Lover', 
    description: 'All vowels now gain +10 points.', 
    flavorText: 'Sometimes, it is all about the little things.',
    icon: '📯',
    effectType: 'passive',
    activate: createPassiveBuff('theValve')
  },
   {
    id: 'wildcardWake',
    name: 'Wildcard Wake',
    description: 'When you equip this Charm, you gain an immediate extra shuffle.',
    flavorText: 'A little shake-up when you need it most.',
    icon: '🃏',
    effectType: 'immediate',
    activate: (gameState) => ({ shuffleCount: (gameState.shuffleCount || 0) + 1 })
  },
  { 
    id: 'silentKiller', 
    name: 'Silent Killer', 
    description: 'If a valid submitted word contains no vowel tiles (A, E, I, O, U), its total score is multiplied by 4.', 
    flavorText: 'No vowels, no mercy.',
    icon: '🤫',
    effectType: 'passive',
    activate: createPassiveBuff('silentKiller')
  },
  {
    id: 'momentum',
    name: 'Momentum',
    description: 'Make 2 valid words in a row under 10 seconds? +20 bonus points',
    flavorText: 'Keep the rhythm going — fast fingers win runs.',
    icon: '💨',
    effectType: 'triggered',
    activate: createPassiveBuff('momentum')
  },
  { 
    id: 'strikeBank', 
    name: 'Strike Bank', 
    description: 'Earn a 4th strike at 500 flawless points. Reach 1000 flawless points for a 5th. Strikes reset the counter.', 
    flavorText: 'Consistency is king.',
    icon: '🏦',
    effectType: 'passive',
    activate: createPassiveBuff('strikeBank')
  },
  {
    id: 'oneRing',
    name: 'The One Ring',
    description: "Each E in a word gives +15 points.",
    flavorText: 'A quiet power, hiding in plain sight.',
    icon: '💍',
    effectType: 'passive',
    activate: createPassiveBuff('oneRing')
  },
  {
    id: 'fluxCapacitor',
    name: 'Flux Capacitor',
    description: "Every 8th word played earns +55% bonus.",
    flavorText: 'Hit 88 MPH with your words — and watch your score travel through time.',
    icon: '🕰️',
    effectType: 'triggered',
    activate: createPassiveBuff('fluxCapacitor')
  },
  { 
    id: 'bulletTime', 
    name: 'Bullet Time', 
    description: 'If a submitted word is 6 letters long or longer, a flat bonus of 20 points is added to its score.', 
    flavorText: 'When your words go long, time slows. Be the One.',
    icon: '⏱️',
    effectType: 'passive',
    activate: createPassiveBuff('bulletTime')
  },
  { 
    id: 'infinityGauntlet', 
    name: 'Infinity Gauntlet', 
    description: 'If a player uses all of their available hand tiles to form a single valid word, a flat bonus of 75 points is added to the Super Hand Bonus of 50 points.', 
    flavorText: 'Balance is achieved. Snap!',
    icon: '🧤',
    effectType: 'triggered',
    activate: createPassiveBuff('infinityGauntlet')
  },
  {
    id: 'batSignal',
    name: 'Bat-Signal',
    description: "Words starting or ending in B, A, T, or M earn +20 points.",
    flavorText: "Call on the night — Gotham approves.",
    icon: '🦇',
    effectType: 'passive',
    activate: createPassiveBuff('batSignal')
  },
  {
    id: 'millenniumFalcon',
    name: 'Millennium Falcon',
    description: 'Use exactly 3 consonants in a word to get +20 points.',
    flavorText: 'She may not look like much, but she’s got it where it counts.',
    icon: '🚀',
    effectType: 'passive',
    activate: createPassiveBuff('millenniumFalcon')
  },
  {
    id: 'triforceOfCourage',
    name: 'Triforce of Courage',
    description: "If a submitted word contains a 'Z', 'X', or 'Q' tile, a flat bonus of 15 points is added to its score.",
    flavorText: 'Draw your sword — true heroes don’t fear the rarest letters.',
    icon: '△',
    effectType: 'passive',
    activate: createPassiveBuff('triforceOfCourage')
  },
  {
    id: 'powerPellet',
    name: 'Power Pellet',
    description: 'All 5-letter words earn +25 points.',
    flavorText: 'Munch your way to victory — just like Pac-Man.',
    icon: '💊',
    effectType: 'passive',
    activate: createPassiveBuff('powerPellet')
  },
  {
    id: 'goldenTicket',
    name: 'Golden Ticket',
    description: 'For every valid word submitted, there is a 10% chance that its final score will be multiplied by 3.',
    flavorText: 'A little chaos... and a lot of chocolate.',
    icon: '🎟️',
    effectType: 'passive',
    activate: createPassiveBuff('goldenTicket')
  },
  {
    id: 'chaosTheory',
    name: 'Chaos Theory',
    description: 'Words with an even number of letters earn +20.',
    flavorText: 'Unpredictable systems... and strangely rewarding symmetry. Life, uh, finds a way.',
    icon: '🦋',
    effectType: 'passive',
    activate: createPassiveBuff('chaosTheory')
  },
  {
    id: 'starPower',
    name: 'Star Power',
    description: "Words with S, T, and A earn 4x score.",
    flavorText: 'Doot-doot-doot-doot-doot-doot! You’re untouchable when S, T, and A align.',
    icon: '🌟',
    effectType: 'passive',
    activate: createPassiveBuff('starPower')
  },
  {
    id: 'weDidntStartTheFire',
    name: 'We Didn’t Start the Fire',
    description: "Words with 3+ unique vowels get +25 points.",
    flavorText: 'The vowels keep turning, and the score keeps burning.',
    icon: '🔥',
    effectType: 'passive',
    activate: createPassiveBuff('weDidntStartTheFire')
  },
  {
    id: 'goldenSnitch',
    name: 'Golden Snitch',
    description: 'Get 5 valid words in a row to earn +500 points. Miss once, and it’s gone.',
    flavorText: 'Fast, rare, and game-changing — catch it if you can.',
    icon: '🕊️',
    effectType: 'triggered',
    activate: createPassiveBuff('goldenSnitch')
  },
  {
    id: 'pianoManEncore',
    name: 'Piano Man Encore',
    description: "Score 45+ on a word and your next word gains +15%.",
    flavorText: 'Sing us another — you’re the word-making man.',
    icon: '🎹',
    effectType: 'passive',
    activate: createPassiveBuff('pianoManEncore')
  },
  {
    id: 'italianRestaurantEnding',
    name: 'Italian Restaurant Ending',
    description: "If your word ends in ‘AN’, each vowel in it earns 3× points.",
    flavorText: 'A toast to Brenda and Eddie — and a perfect vowel-heavy ending.',
    icon: '🍝',
    effectType: 'passive',
    activate: createPassiveBuff('italianRestaurantEnding')
  },
  {
    id: 'inigosRevenge',
    name: 'Inigo’s Revenge',
    description: "Use the letter 'I' twice in a word to earn +50 points.",
    flavorText: 'You keep using that tile. I do not think it means what you think it means.',
    icon: '🤺',
    effectType: 'passive',
    activate: createPassiveBuff('inigosRevenge')
  },
  {
    id: 'battleOfWits',
    name: 'Battle of Wits',
    description: "Words that start and end with the same letter score 4x.",
    flavorText: 'Clearly, you’ve made the classic blunder — underestimating your vocabulary.',
    icon: '⚔️',
    effectType: 'passive',
    activate: createPassiveBuff('battleOfWits')
  },
  {
    id: 'trueLove',
    name: 'True Love',
    description: "Words that contain L, V, and E earn +100 points.",
    flavorText: 'Death can’t stop it. Only slightly tricky tile combinations can.',
    icon: '❤️',
    effectType: 'passive',
    activate: createPassiveBuff('trueLove')
  },
  {
    id: 'nicolesGrace',
    name: 'Nicole’s Grace',
    description: "If the submitted word contains at least one ‘M’ (for mom!) or ends in a vowel, it earns a 15% bonus to its total score.",
    flavorText: 'Steady, strong, and always one step ahead — just like Mom.',
    icon: '💎',
    effectType: 'passive',
    activate: createPassiveBuff('nicolesGrace')
  },
  {
    id: 'christiansHoodieMode',
    name: 'Christian’s Hoodie Mode',
    description: "If your word contains the letters G, A, or M, and is submitted within 10 seconds, it earns a 15% bonus to its total score.",
    flavorText: 'Hoodie up. Game on. Comfort meets combat.',
    icon: '🎮',
    effectType: 'triggered',
    activate: createPassiveBuff('christiansHoodieMode')
  },
  {
    id: 'lenaOfTheLostLights',
    name: 'Lena of the Lost Lights',
    description: "If the submitted word contains at least one of the letters D, R, K, or N, a 10% bonus is added to its total score.",
    flavorText: 'Shadows don’t scare you. You dance through the dark and come back stronger.',
    icon: '🦇',
    effectType: 'passive',
    activate: createPassiveBuff('lenaOfTheLostLights')
  },
  {
    id: 'lTrainShuffle',
    name: 'L Train Shuffle',
    description: "Submit a word with both ‘L’ and ‘T’ to gain a free shuffle (max twice per game).",
    flavorText: 'Attention Players! Doors open on the left at L and T.',
    icon: '🚆',
    maxUses: 2,
    effectType: 'triggered',
    activate: createPassiveBuff('lTrainShuffle')
  },
  {
    id: 'deepFreeze',
    name: 'Deep Freeze',
    description: 'When the timer hits 0, the game pauses for 2 extra seconds before ending. One-time use.',
    flavorText: 'Like a classic Chicago winter, everything stops—but only for a moment.',
    icon: '🧊',
    maxUses: 1,
    effectType: 'triggered',
    activate: createPassiveBuff('deepFreeze')
  },
  {
    id: 'beanCounter',
    name: 'Bean Counter',
    description: 'Grants a flat bonus of 50 points when your total score hits a multiple of 500.',
    flavorText: 'It’s reflective, shiny, and surprisingly generous—just like the Bean.',
    icon: '🫘',
    effectType: 'triggered',
    activate: createPassiveBuff('beanCounter')
  },
  {
    id: 'diceRollProtocol',
    name: 'Dice Roll Protocol',
    description: 'For the next 3 turns, one tile gets swapped and gains 2× points.',
    flavorText: '“It’s a jungle out there. Expect chaos.”',
    icon: '🎲',
    maxUses: 3,
    effectType: 'triggered',
    activate: createPassiveBuff('diceRollProtocol')
  },
  {
    id: 'glitchInTheCode',
    name: 'Glitch in the Code',
    description: 'After every 6th consecutive valid word, a 5-second bonus is added to the timer for the next word submission only.',
    flavorText: '“Dodge the clock. One move at a time.”',
    icon: '🤖',
    effectType: 'triggered',
    activate: createPassiveBuff('glitchInTheCode')
  },
  {
    id: 'shapeshiftersTongue',
    name: 'Shapeshifter’s Tongue',
    description: 'Once per game, change one letter in your hand to any other letter of your choice.',
    flavorText: '“Imitation is the sincerest form of wordplay.”',
    icon: '👅',
    maxUses: 1,
    effectType: 'selection',
    selectionType: 'tile_transform',
    activate: (gameState) => ({...gameState}) // Logic is handled in the reducer
  },
  {
    id: 'oneTileToRuleThemAll',
    name: 'One Tile to Rule Them All',
    description: 'One randomly assigned tile in your hand becomes worth 25 points for one use.',
    flavorText: '“It bends to your will—just once.”',
    icon: '👑',
    effectType: 'immediate', // Changed to immediate to be handled by reducer
    activate: createPassiveBuff('oneTileToRuleThemAll')
  },
  {
    id: 'groundhogsDay',
    name: 'Groundhog’s Day',
    description: 'If your timer ends without any word played, you restart the round with the same tiles and timer. One-time use.',
    flavorText: '“Same tiles. Same time. One more shot.”',
    icon: '🔄',
    maxUses: 1,
    effectType: 'triggered',
    activate: createPassiveBuff('groundhogsDay')
  },
  {
    id: 'doctorStrangesLoop',
    name: 'Dr. Strange’s Loop',
    description: 'If you submit the same valid word twice in a single game, the second submission automatically earns a 2× score multiplier.',
    flavorText: '“We’re in the endgame, again.”',
    icon: '🌀',
    effectType: 'passive',
    activate: createPassiveBuff('doctorStrangesLoop')
  },
  {
    id: 'sherlocksSyntax',
    name: "Sherlock's Syntax",
    description: "Form a palindrome word (reads the same forwards and backwards) to add +50 points to your word score.",
    flavorText: "Elementary, my dear Watson.",
    icon: '🧠',
    effectType: 'passive',
    activate: createPassiveBuff('sherlocksSyntax')
  },
  {
    id: 'executeOrder66',
    name: "Execute Order 66",
    description: "If your word includes a double letter (like ‘LL’), add 6 seconds to your next round.",
    flavorText: "Good soldiers follow orders.",
    icon: '🛰️',
    effectType: 'triggered',
    activate: createPassiveBuff('executeOrder66')
  },
  {
    id: 'sacredHeart',
    name: 'Sacred Heart',
    description: 'If your word uses the letters "J" and "D" you instantly add 22 points to your score.',
    flavorText: 'Eagle!!',
    icon: '🩺',
    effectType: 'passive',
    activate: createPassiveBuff('sacredHeart')
  },
];