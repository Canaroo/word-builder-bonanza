import { Charm, GameState, EventLogEntry } from '../types';
import { labelize } from '../services/durationTags';
import { CHARM_BONUS, GAMEPLAY, POWER_GLOVE_BANK_MAX, TIME_BONUS } from '../config/gameplay';

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
    id: 'philsosophy',
    name: 'Phil’s-osophy',
    description: `Every word flips a coin: 25% chance for +${CHARM_BONUS.philsosophyWin}, 10% chance for -${CHARM_BONUS.philsosophyLoss}.`,
    flavorText: 'Life’s a coin flip. Phil wouldn’t have it any other way.',
    icon: '🪙',
    subtheme: 'score',
    effectType: 'passive',
    durationTag: 'PERSISTENT',
    activate: createPassiveBuff('philsosophy')
  },
  {
    id: 'powerGlove',
    name: 'Power Glove',
    description: `Your time bank holds up to ${POWER_GLOVE_BANK_MAX} seconds instead of ${GAMEPLAY.timeBank.max}, and you get +15 seconds right now.`,
    flavorText: 'I love the Power Glove. It’s so bad.',
    icon: '🧤',
    subtheme: 'game',
    effectType: 'passive',
    durationTag: 'PERSISTENT',
    activate: createPassiveBuff('powerGlove')
  },
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
    description: `All vowels now gain +${CHARM_BONUS.theValve} points each.`, 
    flavorText: 'Sometimes, it is all about the little things.',
    icon: '📯',
    subtheme: 'tile',
    effectType: 'passive',
    durationTag: 'PERSISTENT',
    activate: createPassiveBuff('theValve')
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
    description: `Two valid words in a row, each under 10 seconds? +${CHARM_BONUS.momentum} bonus points.`,
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
    description: `Each E in a word gives +${CHARM_BONUS.oneRing} points.`,
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
    description: `Use every tile in your hand in one word and the Super Hand bonus gets an extra +${CHARM_BONUS.infinityGauntlet} points.`, 
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
    description: `Words starting or ending in B, A, T, or M earn +${CHARM_BONUS.batSignal} points.`,
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
    description: `Use exactly 3 consonants in a word to get +${CHARM_BONUS.millenniumFalcon} points.`,
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
    description: `Words with a Z, X, or Q earn +${CHARM_BONUS.triforceOfCourage} points.`,
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
    description: `All 5-letter words earn +${CHARM_BONUS.powerPellet} points.`,
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
    description: `Words with an even number of letters earn +${CHARM_BONUS.chaosTheory} points.`,
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
    description: `Words with 3+ different vowels earn +${CHARM_BONUS.weDidntStartTheFire} points.`,
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
    description: `Catch it 3 times for +${GAMEPLAY.snitchBonus} each: ${GAMEPLAY.snitchCatchTargets.join(', then ')} valid words in a row. Miss once and the count starts over. After the last catch it flies away.`,
    flavorText: 'Fast, rare, and game-changing — catch it if you can.',
    icon: '🕊️',
    subtheme: 'utility',
    effectType: 'triggered',
    durationTag: 'PERSISTENT',
    activate: createPassiveBuff('goldenSnitch')
  },
  {
    id: 'pianoManEncore',
    name: 'Piano Man Encore',
    description: `Score 45+ on a word and your next word gains +${CHARM_BONUS.pianoManPercent}%.`,
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
    description: `Use the letter I twice in a word to earn +${CHARM_BONUS.inigosRevenge} points.`,
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
    description: `Words with an M (for mom!) or ending in a vowel earn a ${CHARM_BONUS.nicolesGracePercent}% bonus.`,
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
    description: `Words with G, A, or M submitted within 10 seconds earn a ${CHARM_BONUS.christiansHoodiePercent}% bonus.`,
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
    description: `Words with a D, R, K, or N earn a ${CHARM_BONUS.lenaPercent}% bonus.`,
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
    description: `Every word with both L and T earns a free shuffle (bank up to ${CHARM_BONUS.maxBankedShuffles}).`,
    flavorText: 'Attention Players! Doors open on the left at L and T.',
    icon: '🚆',
    subtheme: 'game',
    effectType: 'triggered',
    durationTag: 'PERSISTENT',
    activate: createPassiveBuff('lTrainShuffle')
  },
  {
    id: 'beanCounter',
    name: 'Bean Counter',
    description: `Earn +${CHARM_BONUS.beanCounter} points every time your total score crosses a multiple of 500.`,
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
    description: 'Every 3rd round, one random tile in your hand becomes a 2x tile.',
    flavorText: 'It’s a jungle out there. Expect chaos.',
    icon: '🎲',
    subtheme: 'tile',
    effectType: 'triggered',
    durationTag: 'PERSISTENT',
    activate: createPassiveBuff('diceRollProtocol')
  },
  {
    id: 'glitchInTheCode',
    name: 'Glitch in the Code',
    description: `After every 6th valid word in a row, your next round gets +${TIME_BONUS.glitchInTheCode} seconds.`,
    flavorText: 'Dodge the clock. One move at a time.',
    icon: '🤖',
    subtheme: 'game',
    effectType: 'triggered',
    durationTag: 'PERSISTENT',
    activate: createPassiveBuff('glitchInTheCode')
  },
  {
    id: 'doctorStrangesLoop',
    name: 'Dr. Strange’s Loop',
    description: 'If you submit the same valid word twice in a single game, the second submission automatically earns a 2× score multiplier.',
    flavorText: 'We’re in the endgame, again.',
    icon: '🌀',
    subtheme: 'score',
    effectType: 'passive',
    durationTag: 'PERSISTENT',
    activate: createPassiveBuff('doctorStrangesLoop')
  },
  {
    id: 'sherlocksSyntax',
    name: "Sherlock's Syntax",
    description: `Play a palindrome (reads the same both ways, like LEVEL) for +${CHARM_BONUS.sherlocksSyntax} points.`,
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
    description: `If your word includes a double letter (like ‘LL’), add ${TIME_BONUS.executeOrder66} seconds to your next round.`,
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
    description: `Words played between 8 PM and 8 AM (your time) score ${CHARM_BONUS.buffyPercent}% more.`,
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
    description: `Every fourth word you play earns +${CHARM_BONUS.thrillerNight} points.`,
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
    description: `Words that score under ${CHARM_BONUS.totallyCluelessBelow} points get +${CHARM_BONUS.totallyClueless} points. As if!`,
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
    description: `Words with a repeated letter (like SCOOBY) earn +${CHARM_BONUS.scoobyStack} points.`,
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
    description: `After you score 150+ on a single word, every word after that gets +${CHARM_BONUS.powerStarResidual} points.`,
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
    description: `Words that start with H, L, or Z earn +${CHARM_BONUS.hyruleHustle} points.`,
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
    description: `Words with more vowels than consonants earn +${CHARM_BONUS.luna} points.`,
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
    flavorText: 'PIVOT!! PIVOT!! …Okay, I don’t think it’s gonna pivot.',
    icon: '🛋️',
    subtheme: 'tile',
    effectType: 'passive',
    durationTag: 'PERSISTENT',
    activate: createPassiveBuff('pivot')
  },
  { 
    id: 'cleverGirl', 
    name: 'Clever Girl', 
    description: `Play a word with at least ${TIME_BONUS.cleverGirlLetters} different letters from “RAPTOR” (R, A, P, T, O) to earn +${TIME_BONUS.cleverGirl} seconds on the timer.`, 
    flavorText: 'They’ve figured out how to open doors… and score bonuses.',
    icon: '🦖',
    subtheme: 'game',
    effectType: 'triggered',
    durationTag: 'PERSISTENT',
    activate: createPassiveBuff('cleverGirl')
  },
  { 
    id: 'finalFrontier', 
    name: 'The Final Frontier', 
    description: `Every 1,000 points earns a free Challenge (bank up to ${CHARM_BONUS.maxBankedChallenges}).`, 
    flavorText: 'To boldly go where no vocabulary has gone before.',
    icon: '🧑‍🚀',
    subtheme: 'game',
    effectType: 'triggered',
    durationTag: 'PERSISTENT',
    activate: createPassiveBuff('finalFrontier')
  },
  { 
    id: 'theDudeAbides', 
    name: 'The Dude Abides', 
    description: `Every 3-letter word earns +${CHARM_BONUS.theDudeAbides} points. Just don’t overthink it.`, 
    flavorText: 'Yeah, well, you know, that\'s just, like, your opinion, man.',
    icon: '🥃',
    subtheme: 'utility',
    effectType: 'passive',
    durationTag: 'PERSISTENT',
    activate: createPassiveBuff('theDudeAbides')
  },
  { 
    id: 'pantsOnFire', 
    name: 'Pants on Fire', 
    description: `Words with both L and I earn +${CHARM_BONUS.pantsOnFire} points for ‘bending the truth.’`, 
    flavorText: 'The truth will set you free... but points feel better.',
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
    description: `Words with a double vowel (AA, EE, OO…) earn +${CHARM_BONUS.strangeMagic} points.`,
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
    description: `Words with a double consonant (LL, SS, TT…) earn +${CHARM_BONUS.turtlePower} points.`,
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
    description: `Words with both I and C earn +${CHARM_BONUS.iceAgeBonus} points.`,
    flavorText: 'Scrat approves — frozen letters mean frozen points.',
    icon: '🧊',
    subtheme: 'utility',
    effectType: 'passive',
    durationTag: 'PERSISTENT',
    activate: createPassiveBuff('iceAgeBonus')
  },
];
