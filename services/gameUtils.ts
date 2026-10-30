import { Tile, Charm, GameState, WordData, ScoreCalculationResult, ScoreBonusInfo, PowerPlay } from '../types';
import { CHARM_BONUS, CHARM_SLOTS, POWER_PLAY_VALUES } from '../config/gameplay';
import { TILE_DISTRIBUTION, VOWELS, RACK_SIZE, HAND_SIZE, BALANCE_REPLACE_COUNT, COMBO_TILES, COMBO_TILE_CHANCE, OFFER_RECENCY_WINDOW, OFFER_EXPLORATION_BOOST, OFFER_REPEAT_PENALTY, OFFER_MAX_RECENCY_PENALTY } from '../constants';
import { dictionaryService } from './dictionaryService';
import { canBeMadeFromLetters } from './rackMatch';
import { combineMultipliers, lengthMultiplier, UPSIDE_DOWN_POINTS } from './rules';

// A simple seeded pseudo-random number generator for reproducible results.
class SeededRNG {
    private seed: number;
    constructor(seed: number) {
        this.seed = seed % 2147483647;
        if (this.seed <= 0) {
            this.seed += 2147483646;
        }
    }
    next() {
        this.seed = (this.seed * 16807) % 2147483647;
        return this.seed;
    }
    nextFloat() {
        return (this.next() - 1) / 2147483646;
    }
}

const LETTER_WEIGHTS: { [key: string]: number } = {
  Q: 9, Z: 8, J: 7, X: 7, K: 6, V: 5, W: 5, F: 4, H: 4, Y: 4, B: 3, C: 3, M: 3, P: 3,
  G: 2, D: 2, L: 2, S: 2, T: 2, R: 2, N: 2,
  A: 1, E: 1, I: 1, O: 1, U: 1,
  // Combo tile weights
  QU: 10, CH: 5, SH: 3, TH: 3, ING: 4,
};
const WEIGHT_CAP = 30;
const THREE_LETTER_WORDS = new Set(
    [...dictionaryService.getDictionaryWords()].filter(word => word.length === 3)
);


// Fisher-Yates shuffle
export const shuffleArray = <T,>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

/** Mixtape charm payout for this link number (1 = first chained word). */
export const mixtapeBonus = (link: number): number =>
    Math.min(CHARM_BONUS.mixtapeMax, CHARM_BONUS.mixtapeBase + CHARM_BONUS.mixtapeStep * (link - 1));

export const createTileBag = (): string[] => {
  const bag: string[] = [];
  for (const letter in TILE_DISTRIBUTION) {
    for (let i = 0; i < TILE_DISTRIBUTION[letter].count; i++) {
      bag.push(letter);
    }
  }
  return shuffleArray(bag);
};

export const createTile = (letter: string, isForGoldenRound = false): Tile => {
  const isMultiplier = !isForGoldenRound && Math.random() < 0.15; // 15% chance for a 2x multiplier
  const comboData = COMBO_TILES.find(ct => ct.letter === letter);

  if (comboData) {
    return {
      id: `${letter}-${Math.random()}`,
      letter: comboData.letter,
      points: comboData.points,
      isCombo: true,
    };
  }

  return {
    id: `${letter}-${Math.random()}`,
    letter,
    points: TILE_DISTRIBUTION[letter]?.points || 0,
    multiplier: isMultiplier ? 2 : 1,
  };
};

export const drawTiles = (count: number, tileBag: string[], isForGoldenRound = false): { newTiles: Tile[], remainingBag: string[] } => {
  let currentBag = [...tileBag];
  const drawnLetters: string[] = [];

  for (let i = 0; i < count; i++) {
    // If the bag runs out, replenish it. This ensures the game can continue indefinitely.
    if (currentBag.length === 0) {
        currentBag.push(...createTileBag());
        currentBag = shuffleArray(currentBag);
    }

    // Small chance to draw a special combo tile instead of one from the bag
    if (Math.random() < COMBO_TILE_CHANCE) {
      const comboTile = COMBO_TILES[Math.floor(Math.random() * COMBO_TILES.length)];
      drawnLetters.push(comboTile.letter);
    } else {
      // This should not fail as the bag is replenished if empty.
      const letter = currentBag.pop();
      if (letter) {
        drawnLetters.push(letter);
      }
    }
  }

  const newTiles = drawnLetters.map(l => createTile(l, isForGoldenRound));
  return { newTiles, remainingBag: currentBag };
};

export const dealNewHand = (tileBag: string[], tilesToReturn: Tile[] = [], isForGoldenRound = false): { hand: Tile[], tileBag: string[] } => {
  // Discard old tiles by not adding them back to the bag.
  const currentBag = shuffleArray([...tileBag]);

  const { newTiles, remainingBag } = drawTiles(HAND_SIZE, currentBag, isForGoldenRound);

  return { hand: newTiles, tileBag: remainingBag };
};

export const canBeMadeFromRack = (word: string, rack: Tile[]): boolean =>
    canBeMadeFromLetters(word, rack.map(tile => tile.letter));

export const handleDuplicateLetters = (hand: (Tile | null)[], tileBag: string[]): { newHand: (Tile | null)[], newBag: string[], wasChanged: boolean } => {
    let wasChanged = false;
    let currentHand = [...hand];
    let currentBag = [...tileBag];
    let safetyCounter = 0;

    while (true) {
        safetyCounter++;
        if (safetyCounter > 50) { // Robust safety break for extreme edge cases
            console.error("handleDuplicateLetters exceeded safety limit.");
            break;
        }

        const handTiles = currentHand.filter((t): t is Tile => t !== null);
        const letterCounts: { [key: string]: number } = {};
        handTiles.forEach(tile => {
            letterCounts[tile.letter] = (letterCounts[tile.letter] || 0) + 1;
        });
        
        const letterToFix = Object.keys(letterCounts).find(letter => letterCounts[letter] > 3);
        
        if (!letterToFix) {
            break; // The hand is valid, exit the loop.
        }

        wasChanged = true;

        const indicesOfDuplicates = currentHand
            .map((tile, index) => ({ tile, index }))
            .filter(item => item.tile?.letter === letterToFix)
            .map(item => item.index);
        
        // Randomly pick one of the duplicates to replace
        const indexToReplace = shuffleArray(indicesOfDuplicates)[0];
        const tileToReturn = currentHand[indexToReplace]!;
        const letterToReturnString = tileToReturn.letter;
        
        // Draw from the current bag.
        const { newTiles, remainingBag } = drawTiles(1, currentBag);

        // The new bag for the next iteration is the one we got back, plus the letter we're putting back.
        currentBag = shuffleArray([...remainingBag, letterToReturnString]);
        
        currentHand[indexToReplace] = newTiles[0] || null;
    }

    return { newHand: currentHand, newBag: currentBag, wasChanged };
};

export const postProcessHand = (hand: (Tile | null)[], tileBag: string[], isForGoldenRound = false): { newHand: (Tile | null)[], newBag: string[], balancingMessage?: string } => {
    let anyChanges = false;
    let currentHand = [...hand];
    let currentBag = [...tileBag];

    // --- FAIRNESS SWEEP ---
    
    // Stage 1: Playability Solver
    let handTiles = currentHand.filter(t => t !== null) as Tile[];
    let isPlayable = false;
    for (const word of THREE_LETTER_WORDS) {
        if (canBeMadeFromRack(word, handTiles)) {
            isPlayable = true;
            break;
        }
    }

    if (!isPlayable) {
        let replacements = 0;
        while (!isPlayable && replacements < BALANCE_REPLACE_COUNT && currentBag.length > 0) {
            anyChanges = true;
            replacements++;

            const handIndices = currentHand.map((t, i) => t !== null ? i : -1).filter(i => i !== -1);
            if (handIndices.length === 0) break;
            const indexToReplace = handIndices[Math.floor(Math.random() * handIndices.length)];
            const tileToReturn = currentHand[indexToReplace];
            
            if (tileToReturn) {
                currentBag = shuffleArray([...currentBag, tileToReturn.letter]);
                const { newTiles, remainingBag } = drawTiles(1, currentBag, isForGoldenRound);
                currentBag = remainingBag;
                currentHand[indexToReplace] = newTiles[0] || null;
            }
            
            handTiles = currentHand.filter(t => t !== null) as Tile[];
            for (const word of THREE_LETTER_WORDS) {
                if (canBeMadeFromRack(word, handTiles)) {
                    isPlayable = true;
                    break;
                }
            }
        }
    }

    // Stage 2: Letter-Weight Guardrail
    let weightIterations = 0;
    while (weightIterations < RACK_SIZE) {
        weightIterations++;
        handTiles = currentHand.filter(t => t !== null) as Tile[];
        const currentWeight = handTiles.reduce((sum, tile) => sum + (LETTER_WEIGHTS[tile.letter] || 2), 0);

        if (currentWeight <= WEIGHT_CAP) break;
        
        anyChanges = true;
        let maxWeight = 0;
        handTiles.forEach(tile => {
            const weight = LETTER_WEIGHTS[tile.letter] || 2;
            if (weight > maxWeight) maxWeight = weight;
        });

        const heaviestTilesIndices = currentHand
            .map((t, i) => ({ tile: t, index: i }))
            .filter(item => item.tile && (LETTER_WEIGHTS[item.tile.letter] || 2) === maxWeight)
            .map(item => item.index);
        
        if (heaviestTilesIndices.length === 0) break;

        const indexToReplace = heaviestTilesIndices[Math.floor(Math.random() * heaviestTilesIndices.length)];
        const tileToReturn = currentHand[indexToReplace];

        if(tileToReturn) {
            currentBag = shuffleArray([...currentBag, tileToReturn.letter]);
            const { newTiles, remainingBag } = drawTiles(1, currentBag, isForGoldenRound);
            currentBag = remainingBag;
            currentHand[indexToReplace] = newTiles[0] || null;
        }
    }

    // Stage 3: Duplicate letter cleanup (as requested, after solver and weight guard)
    const dupeResult = handleDuplicateLetters(currentHand, currentBag);
    if (dupeResult.wasChanged) {
        anyChanges = true;
        currentHand = dupeResult.newHand;
        currentBag = dupeResult.newBag;
    }
    
    // Stage 4: Vowel-Consonant Balance (iterative logic)
    let balanceIterations = 0;
    while(balanceIterations < RACK_SIZE * 2) { // Safety break
        balanceIterations++;

        const finalHandTiles = currentHand.filter((t): t is Tile => t !== null);
        if (finalHandTiles.length === 0) break;
        
        const vowelCount = finalHandTiles.filter(t => VOWELS.has(t.letter)).length;
        const consonantCount = finalHandTiles.length - vowelCount;
        
        let needsChange = false;
        
        if (vowelCount < 1) {
            let availableVowelsInBag = currentBag.filter(l => VOWELS.has(l));
            
            // If the current bag is out of vowels, replenish it to ensure a swap is possible.
            if (availableVowelsInBag.length === 0) {
                currentBag.push(...createTileBag());
                availableVowelsInBag = currentBag.filter(l => VOWELS.has(l));
            }

            const replaceableConsonantIndices = currentHand
                    .map((tile, index) => ({ tile, index }))
                    .filter(item => item.tile && !VOWELS.has(item.tile.letter))
                    .map(item => item.index);
                
                if (replaceableConsonantIndices.length > 0) {
                    anyChanges = true;
                    needsChange = true;
                    const indexToReplace = replaceableConsonantIndices[Math.floor(Math.random() * replaceableConsonantIndices.length)];
                    const tileToReturn = currentHand[indexToReplace];
                    if (tileToReturn) {
                        currentBag = shuffleArray([...currentBag, tileToReturn.letter]);
                        
                        const vowelToDraw = availableVowelsInBag[Math.floor(Math.random() * availableVowelsInBag.length)];
                        
                        // Remove the drawn vowel from bag and add a new tile to hand
                        const newBagWithoutVowel = [...currentBag];
                        const vowelIndex = newBagWithoutVowel.indexOf(vowelToDraw);
                        if(vowelIndex > -1) {
                            newBagWithoutVowel.splice(vowelIndex, 1);
                        }
                        const newVowelTile = createTile(vowelToDraw, isForGoldenRound);
                        currentHand[indexToReplace] = newVowelTile;
                        currentBag = newBagWithoutVowel;
                    }
                }
            } else if (consonantCount < 1) {
                 let availableConsonantsInBag = currentBag.filter(l => !VOWELS.has(l));
                
                if (availableConsonantsInBag.length === 0) {
                    currentBag.push(...createTileBag());
                    availableConsonantsInBag = currentBag.filter(l => !VOWELS.has(l));
                }

                const replaceableVowelIndices = currentHand
                    .map((tile, index) => ({ tile, index }))
                    .filter(item => item.tile && VOWELS.has(item.tile.letter))
                    .map(item => item.index);
                
                if (replaceableVowelIndices.length > 0) {
                    anyChanges = true;
                    needsChange = true;
                    const indexToReplace = replaceableVowelIndices[Math.floor(Math.random() * replaceableVowelIndices.length)];
                    const tileToReturn = currentHand[indexToReplace];
                    if(tileToReturn) {
                        currentBag = shuffleArray([...currentBag, tileToReturn.letter]);
                        
                        const consonantToDraw = availableConsonantsInBag[Math.floor(Math.random() * availableConsonantsInBag.length)];

                        const newBagWithoutConsonant = [...currentBag];
                        const consonantIndex = newBagWithoutConsonant.indexOf(consonantToDraw);
                        if(consonantIndex > -1) {
                            newBagWithoutConsonant.splice(consonantIndex, 1);
                        }
                        const newConsonantTile = createTile(consonantToDraw, isForGoldenRound);
                        currentHand[indexToReplace] = newConsonantTile;
                        currentBag = newBagWithoutConsonant;
                    }
                }
            }

            if (!needsChange) break;
    }
    
    let balancingMessage: string | undefined;
    if (anyChanges && !isForGoldenRound) {
        balancingMessage = "Hand balanced for fairness!";
    }

    return { newHand: currentHand, newBag: currentBag, balancingMessage };
};

export const calculateScore = (word: string, tiles: Tile[], gameState: GameState): ScoreCalculationResult => {
    const bonuses: ScoreBonusInfo[] = [];
    const wordUpper = word.toUpperCase();
    const lettersInWord = wordUpper.split('');
    const isGoldenRound = gameState.roundType === 'golden';

    // --- GOLDEN ROUND SPECIAL LOGIC ---
    if (isGoldenRound) {
        let goldenBaseScore = 0;
        let wordMultiplier = 1;
        
        tiles.forEach(tile => {
            goldenBaseScore += (tile.points * 2);
        });
        bonuses.push({ name: 'Golden Round', description: 'All tiles 2x points', source: 'tile' });

        const isGoldenTileUsed = tiles.some(tile => tile.id === gameState.goldenTileId);
        if (isGoldenTileUsed) {
            wordMultiplier *= 6;
            bonuses.push({ name: '🌟 Golden Tile!', description: 'x6 Word Score', source: 'word' });
        }
        
        const totalScore = goldenBaseScore * wordMultiplier;
        const rawBaseScore = tiles.reduce((sum, tile) => sum + tile.points, 0);

        return {
            totalScore: Math.round(totalScore),
            baseScore: rawBaseScore,
            bonuses,
        };
    }

    // --- 1. Raw Base Score & Tile-level Calculations ---
    const rawBaseScore = tiles.reduce((sum, tile) => sum + tile.points, 0);
    let scoreAfterTileMods = 0;
    
    tiles.forEach((tile, index) => {
        let tilePoints = tile.tempPoints ?? tile.points;
        let tileMultiplier = 1;
        if (tile.tempPoints !== undefined && tile.tempPoints !== tile.points && tile.tempPointsSource) {
            bonuses.push({ name: `${tile.tempPointsSource} (${tile.letter})`, description: `${tile.points} → ${tile.tempPoints} pts`, source: 'tile' });
        }

        // PowerPlay: The Upside Down (common letters worth more, rare ones less)
        if (gameState.activePowerPlays.upsideDown && tile.tempPoints === undefined) {
            const flipped = UPSIDE_DOWN_POINTS[tile.points] ?? tile.points;
            if (flipped !== tilePoints) bonuses.push({ name: `Upside Down (${tile.letter})`, description: `${tilePoints} → ${flipped} pts`, source: 'tile' });
            tilePoints = flipped;
        }

        // PowerPlay: Big Head Mode
        if (gameState.activePowerPlays.bigHeadMode) {
            tileMultiplier *= 2;
        }

        // PowerPlay: Hold Onto Your Butts (rare letters score extra on the next word)
        if (gameState.activePowerPlays.holdOntoYourButts && POWER_PLAY_VALUES.rareLetters.includes(tile.letter)) {
            tileMultiplier *= POWER_PLAY_VALUES.rareLetterMultiplier;
            bonuses.push({ name: `Hold Onto Your Butts (${tile.letter})`, description: `x${POWER_PLAY_VALUES.rareLetterMultiplier} tile`, source: 'tile' });
        }

        // Charm: The Valve
        if (gameState.activeCharms.some(c => c.id === 'theValve') && VOWELS.has(tile.letter)) {
            tilePoints += CHARM_BONUS.theValve;
            bonuses.push({ name: `Vowel Lover (${tile.letter})`, description: `+${CHARM_BONUS.theValve} pts`, source: 'tile' });
        }

        // Charm: E.T. Phone Home (oneRing)
        if (gameState.activeCharms.some(c => c.id === 'oneRing') && tile.letter === 'E') {
            tilePoints += CHARM_BONUS.oneRing;
            bonuses.push({ name: `E.T. Phone Home (${tile.letter})`, description: `+${CHARM_BONUS.oneRing} pts`, source: 'tile' });
        }
        
        // Charm: S-Tier Scorer (tile points)
        if (gameState.activeCharms.some(c => c.id === 'sTierScorer') && tile.letter === 'S') {
            const pointChange = 15 - tile.points;
            tilePoints = 15;
            bonuses.push({ name: `S-Tier Scorer (${tile.letter})`, description: `Value set to 15`, source: 'tile' });
        }
        
        // Charm: Pivot
        if (gameState.activeCharms.some(c => c.id === 'pivot')) {
            if (tile.letter === 'P') {
                tilePoints = 10;
                bonuses.push({ name: `PIVOT! (${tile.letter})`, description: `Value set to 10`, source: 'tile' });
            }
            if (tile.letter === 'T') {
                tilePoints = 2;
                bonuses.push({ name: `PIVOT! (${tile.letter})`, description: `Value set to 2`, source: 'tile' });
            }
        }
        
        // PowerPlay: Skywalker Bloodline
        if (gameState.activePowerPlays.skywalkerBloodline && tile.letter === 'S') {
            tilePoints = 15;
            bonuses.push({ name: `Skywalker Bloodline (${tile.letter})`, description: `Value set to 15`, source: 'tile' });
        }

        // PowerPlay: Wakanda Forever
        if (gameState.activePowerPlays.wakandaForever) {
            if (tilePoints < 15) {
                tilePoints = 15;
                bonuses.push({ name: `Wakanda Forever (${tile.letter})`, description: `Value set to 15`, source: 'tile' });
            }
        }

        // PowerPlay: Letter Upgrade
        if (gameState.letterMultipliers[tile.letter]) {
            tileMultiplier *= gameState.letterMultipliers[tile.letter];
            bonuses.push({ name: `Letter Upgrade (${tile.letter})`, description: `x${gameState.letterMultipliers[tile.letter]} Tile Pts`, source: 'tile' });
        }
        
        // Charm: Finisher
        if (gameState.activeCharms.some(c => c.id === 'finisher') && index === tiles.length - 1) {
            tilePoints += CHARM_BONUS.finisher;
            bonuses.push({ name: `Finisher (${tile.letter})`, description: `+${CHARM_BONUS.finisher} pts`, source: 'tile' });
        }
        
        scoreAfterTileMods += tilePoints * tileMultiplier;
    });
    
    // --- 2. Word Multipliers & Bonuses ---
    let totalScore = scoreAfterTileMods;
    // Word multipliers are collected and added together (x2 + x4 = x6), see services/rules.ts.
    const wordMultipliers: number[] = [];

    // Tile-based word multipliers
    tiles.forEach(tile => {
        if (tile.multiplier && tile.multiplier > 1) {
            wordMultipliers.push(tile.multiplier);
            bonuses.push({ name: `Tile Multiplier (${tile.letter})`, description: `x${tile.multiplier} Word Score`, source: 'word' });
        }
        if (tile.isSuper) {
            wordMultipliers.push(4);
            bonuses.push({ name: `Super Tile (${tile.letter})`, description: 'x4 Word Score', source: 'word' });
        }
    });

    // PowerPlay: Red Wedding
    if (gameState.activePowerPlays.redWedding) {
        wordMultipliers.push(5);
        bonuses.push({ name: 'Red Wedding', description: 'x5 Word Score', source: 'word' });
    }

    // Length bonus: a smooth curve by word length (config/gameplay.ts)
    const lengthMult = lengthMultiplier(word.length);
    if (lengthMult > 1) {
        wordMultipliers.push(lengthMult);
        bonuses.push({ name: 'Length Bonus', description: `x${lengthMult} (${word.length} letters)`, source: 'word' });
    }
    
    // Charm: S-Tier Scorer (word multiplier)
    if (gameState.activeCharms.some(c => c.id === 'sTierScorer') && lettersInWord.includes('S')) {
        wordMultipliers.push(2);
        bonuses.push({ name: 'S-Tier Scorer', description: 'x2 Word Score', source: 'word' });
    }

    // Charm: Battle of Wits
    if (gameState.activeCharms.some(c => c.id === 'battleOfWits') && word.length > 1 && wordUpper[0] === wordUpper[wordUpper.length - 1]) {
        wordMultipliers.push(4);
        bonuses.push({ name: 'Battle of Wits', description: 'x4 Score', source: 'word' });
    }
    

    // Charm: We Were on a Break! (first word after a shuffle)
    if (gameState.breakReady && gameState.activeCharms.some(c => c.id === 'weWereOnABreak')) {
        wordMultipliers.push(CHARM_BONUS.weWereOnABreakMultiplier);
        bonuses.push({ name: 'We Were on a Break!', description: `x${CHARM_BONUS.weWereOnABreakMultiplier} Score`, source: 'word' });
    }

    // PowerPlay: Big Head Mode (listed once per word, applied per tile above)
    if (gameState.activePowerPlays.bigHeadMode) {
        bonuses.push({ name: 'Big Head Mode', description: 'x2 Tile Pts', source: 'tile' });
    }

    // PowerPlay: Konami Code
    if (gameState.activePowerPlays.konamiCode) {
        wordMultipliers.push(2);
        bonuses.push({ name: 'Konami Code', description: 'x2 Word Score', source: 'word' });
    }

    // PowerPlay: Ludicrous Speed
    if (gameState.activePowerPlays.ludicrousSpeed) {
        wordMultipliers.push(3);
        bonuses.push({ name: 'Ludicrous Speed', description: 'x3 Word Score', source: 'word' });
    }

    // PowerPlay: Combo Breaker (a short word scores 0; handled after scoring)
    if (gameState.activePowerPlays.comboBreaker && word.length >= POWER_PLAY_VALUES.comboBreakerMinLength) {
        wordMultipliers.push(POWER_PLAY_VALUES.comboBreakerMultiplier);
        bonuses.push({ name: 'Combo Breaker', description: `x${POWER_PLAY_VALUES.comboBreakerMultiplier} Word Score`, source: 'word' });
    }

    // PowerPlay: Let's Get Ready to Rumble! (biglyScore)
    if (gameState.activePowerPlays.biglyScore) {
        wordMultipliers.push(4);
        bonuses.push({ name: "Let's Get Ready to Rumble!", description: 'x4 Word Score', source: 'word' });
    }
    
    // PowerPlay: Nuclear Option
    if (gameState.activePowerPlays.nuclearOption) {
        wordMultipliers.push(POWER_PLAY_VALUES.nuclearOptionMultiplier);
        bonuses.push({ name: 'Nuclear Option', description: `x${POWER_PLAY_VALUES.nuclearOptionMultiplier} Word Score`, source: 'word' });
    }

    // PowerPlay: Polish
    Object.keys(gameState.wordMultipliersByLetter).forEach(letter => {
        if (lettersInWord.includes(letter)) {
            const multiplier = gameState.wordMultipliersByLetter[letter];
            wordMultipliers.push(multiplier);
            bonuses.push({ name: 'Polish', description: `x${multiplier} for '${letter}'`, source: 'word' });
        }
    });
    
    // PowerPlay: Cassie's Clue
    if (gameState.activePowerPlays.cassiesClue && ['C', 'A', 'T'].every(l => lettersInWord.includes(l))) {
        wordMultipliers.push(3);
        bonuses.push({ name: "Cassie's Clue", description: 'x3 Score', source: 'word' });
    }
    
    // PowerPlay: Tetris Touch
    if (gameState.activePowerPlays.tetrisTouch) {
        let alternates = true;
        for (let i = 1; i < lettersInWord.length; i++) {
            if (VOWELS.has(lettersInWord[i]) === VOWELS.has(lettersInWord[i-1])) {
                alternates = false;
                break;
            }
        }
        if (alternates) {
            wordMultipliers.push(4);
            bonuses.push({ name: 'Tetris Touch', description: 'x4 Score', source: 'word' });
        }
    }
    
    // PowerPlay: Wordionaire Double Down
    if (gameState.activePowerPlays.wordionaireDouble) {
        wordMultipliers.push(2);
        bonuses.push({ name: 'Wordionaire: Double Down', description: 'x2 Word Score', source: 'word' });
    }
    
    // PowerPlay: Pinky and the Brain
    if (gameState.activePowerPlays.pinkyAndTheBrain) {
        wordMultipliers.push(2);
        bonuses.push({ name: 'Pinky and the Brain', description: 'x2 Score', source: 'word' });
    }

    // PowerPlay: Let's Get Dangerous
    if (gameState.activePowerPlays.letsGetDangerous) {
        const vowelCount = lettersInWord.filter(l => VOWELS.has(l)).length;
        if (vowelCount > 0) {
            wordMultipliers.push(vowelCount);
            bonuses.push({ name: "Let's Get Dangerous", description: `x${vowelCount} Score`, source: 'word' });
        }
    }

    const scoreBeforeMultiplier = totalScore;
    const wordMultiplier = combineMultipliers(wordMultipliers);
    totalScore *= wordMultiplier;
    
    // --- 3. Flat Bonuses ---
    let flatBonus = 0;

    // PowerPlay: Slim Shady Shuffle Bonus
    if (gameState.activePowerPlays.slimShadyShuffle) {
        flatBonus += 50;
        bonuses.push({ name: 'Slim Shady Shuffle', description: '+50 pts', source: 'game' });
    }

    // Charm: Bullet Time
    if (gameState.activeCharms.some(c => c.id === 'bulletTime') && word.length >= 6) {
        flatBonus += 200;
        bonuses.push({ name: 'Bullet Time', description: '+200 pts', source: 'game' });
    }
    
    // Charm: Bat-Signal
    if (gameState.activeCharms.some(c => c.id === 'batSignal')) {
        const firstLetter = wordUpper[0];
        const lastLetter = wordUpper[wordUpper.length-1];
        if (['B', 'A', 'T', 'M'].includes(firstLetter) || ['B', 'A', 'T', 'M'].includes(lastLetter)) {
             flatBonus += CHARM_BONUS.batSignal;
             bonuses.push({ name: 'Bat-Signal', description: `+${CHARM_BONUS.batSignal} pts`, source: 'game' });
        }
    }
    
    // Charm: Millennium Falcon
    if (gameState.activeCharms.some(c => c.id === 'millenniumFalcon')) {
        const consonantCount = lettersInWord.filter(l => !VOWELS.has(l)).length;
        if (consonantCount === 3) {
             flatBonus += CHARM_BONUS.millenniumFalcon;
             bonuses.push({ name: 'Millennium Falcon', description: `+${CHARM_BONUS.millenniumFalcon} pts`, source: 'game' });
        }
    }
    
    // Charm: Triforce of Courage
    if (gameState.activeCharms.some(c => c.id === 'triforceOfCourage') && ['Z', 'X', 'Q'].some(l => lettersInWord.includes(l))) {
        flatBonus += CHARM_BONUS.triforceOfCourage;
        bonuses.push({ name: 'Triforce of Courage', description: `+${CHARM_BONUS.triforceOfCourage} pts`, source: 'game' });
    }
    
    // Charm: Power Pellet
    if (gameState.activeCharms.some(c => c.id === 'powerPellet') && word.length === 5) {
        flatBonus += CHARM_BONUS.powerPellet;
        bonuses.push({ name: 'Power Pellet', description: `+${CHARM_BONUS.powerPellet} pts`, source: 'game' });
    }
    
    // Charm: Chaos Theory
    if (gameState.activeCharms.some(c => c.id === 'chaosTheory') && word.length % 2 === 0) {
        flatBonus += CHARM_BONUS.chaosTheory;
        bonuses.push({ name: 'Chaos Theory', description: `+${CHARM_BONUS.chaosTheory} pts`, source: 'game' });
    }
    
    // Charm: We Didn’t Start the Fire
    if (gameState.activeCharms.some(c => c.id === 'weDidntStartTheFire')) {
        const uniqueVowels = new Set(lettersInWord.filter(l => VOWELS.has(l)));
        if (uniqueVowels.size >= 3) {
             flatBonus += CHARM_BONUS.weDidntStartTheFire;
             bonuses.push({ name: 'We Didn’t Start the Fire', description: `+${CHARM_BONUS.weDidntStartTheFire} pts`, source: 'game' });
        }
    }
    
    // Charm: Inigo’s Revenge
    if (gameState.activeCharms.some(c => c.id === 'inigosRevenge') && lettersInWord.filter(l => l === 'I').length >= 2) {
        flatBonus += CHARM_BONUS.inigosRevenge;
        bonuses.push({ name: 'Inigo’s Revenge', description: `+${CHARM_BONUS.inigosRevenge} pts`, source: 'game' });
    }
    
    // Charm: True Love (an L or a V, more for both)
    if (gameState.activeCharms.some(c => c.id === 'trueLove')) {
        const loveLetters = ['L', 'V'].filter(l => lettersInWord.includes(l)).length;
        const pts = loveLetters === 2 ? CHARM_BONUS.trueLoveBoth : loveLetters === 1 ? CHARM_BONUS.trueLove : 0;
        if (pts) {
            flatBonus += pts;
            bonuses.push({ name: 'True Love', description: `+${pts} pts`, source: 'game' });
        }
    }
    
    // Charm: Sherlock's Syntax
    if (gameState.activeCharms.some(c => c.id === 'sherlocksSyntax') && wordUpper === wordUpper.split('').reverse().join('')) {
        flatBonus += CHARM_BONUS.sherlocksSyntax;
        bonuses.push({ name: "Sherlock's Syntax", description: `+${CHARM_BONUS.sherlocksSyntax} pts`, source: 'game' });
    }
    
    // Charm: Sacred Heart
    if (gameState.activeCharms.some(c => c.id === 'sacredHeart') && (lettersInWord.includes('J') || lettersInWord.includes('D'))) {
        flatBonus += CHARM_BONUS.sacredHeart;
        bonuses.push({ name: 'Sacred Heart', description: `+${CHARM_BONUS.sacredHeart} pts`, source: 'game' });
    }

    // Charm: Scooby Stack
    if (gameState.activeCharms.some(c => c.id === 'scoobyStack') && new Set(lettersInWord).size < lettersInWord.length) {
        flatBonus += CHARM_BONUS.scoobyStack;
        bonuses.push({ name: 'Scooby Stack', description: `+${CHARM_BONUS.scoobyStack} pts`, source: 'game' });
    }
    
    // Charm: Hyrule Hustle
    if (gameState.activeCharms.some(c => c.id === 'hyruleHustle') && ['H', 'L', 'Z'].includes(wordUpper[0])) {
        flatBonus += CHARM_BONUS.hyruleHustle;
        bonuses.push({ name: 'Hyrule Hustle', description: `+${CHARM_BONUS.hyruleHustle} pts`, source: 'game' });
    }

    // Charm: LUNA
    if (gameState.activeCharms.some(c => c.id === 'luna')) {
        const vowelCount = lettersInWord.filter(l => VOWELS.has(l)).length;
        const consonantCount = lettersInWord.length - vowelCount;
        if (vowelCount > consonantCount && lettersInWord.length >= CHARM_BONUS.chaseMinLetters) {
             flatBonus += CHARM_BONUS.luna;
             bonuses.push({ name: 'LUNA', description: `+${CHARM_BONUS.luna} pts`, source: 'game' });
        }
    }

    // Charm: Mixtape (each word starts with the last letter of the one before)
    const chain = gameState.mixtapeChain;
    if (gameState.activeCharms.some(c => c.id === 'mixtape') && chain?.next && wordUpper.startsWith(chain.next)) {
        const bonus = mixtapeBonus(chain.links + 1);
        flatBonus += bonus;
        bonuses.push({ name: `Mixtape (link ${chain.links + 1})`, description: `+${bonus} pts`, source: 'game' });
    }

    // Charm: Rubik's Cube (6+ letters, no repeated letter)
    if (gameState.activeCharms.some(c => c.id === 'rubiksCube') && lettersInWord.length >= 6 && new Set(lettersInWord).size === lettersInWord.length) {
        flatBonus += CHARM_BONUS.rubiksCube;
        bonuses.push({ name: "Rubik's Cube", description: `+${CHARM_BONUS.rubiksCube} pts`, source: 'game' });
    }

    // Charm: Sick Combo (longer than your last valid word)
    if (gameState.activeCharms.some(c => c.id === 'sickCombo')) {
        const last = [...(gameState.log ?? [])].reverse().find(e => e.type === 'word' && e.status === 'valid') as { word: string } | undefined;
        if (last && wordUpper.length > last.word.length) {
            flatBonus += CHARM_BONUS.sickCombo;
            bonuses.push({ name: 'Sick Combo', description: `+${CHARM_BONUS.sickCombo} pts`, source: 'game' });
        }
    }

    // Charm: The Opposite (no letters in common with your last valid word) and Eagle! (right after a long word)
    const hasOpposite = gameState.activeCharms.some(c => c.id === 'theOpposite');
    const hasEagle = gameState.activeCharms.some(c => c.id === 'eagle');
    if (hasOpposite || hasEagle) {
        const last = [...(gameState.log ?? [])].reverse().find(e => e.type === 'word' && e.status === 'valid') as { word: string } | undefined;
        if (last && hasOpposite && !lettersInWord.some(l => last.word.toUpperCase().includes(l))) {
            flatBonus += CHARM_BONUS.theOpposite;
            bonuses.push({ name: 'The Opposite', description: `+${CHARM_BONUS.theOpposite} pts`, source: 'game' });
        }
        if (last && hasEagle && last.word.length >= CHARM_BONUS.eagleLetters) {
            flatBonus += CHARM_BONUS.eagle;
            bonuses.push({ name: 'Eagle!', description: `+${CHARM_BONUS.eagle} pts`, source: 'game' });
        }
    }

    // Flat-bonus charms: A-Team (starts with A), Conjunction Junction (alphabetical order), Vote for
    // Pedro (only 1-point tiles), Form Voltron (a combo tile), Silent Killer (no vowels), Star Power
    // (S and T), Italian Restaurant Ending (ends in AN), Clever Girl (RAPTOR letters), Radioactive
    // Spider Bite (D, E, R), Titans, Go! (per charm equipped).
    const hasCharm = (id: string) => gameState.activeCharms.some(c => c.id === id);
    const flat = (name: string, pts: number) => { flatBonus += pts; bonuses.push({ name, description: `+${pts} pts`, source: 'game' }); };
    if (hasCharm('aTeam') && wordUpper.startsWith('A')) flat('A-Team', CHARM_BONUS.aTeam);
    const longEnough = lettersInWord.length >= CHARM_BONUS.chaseMinLetters;
    if (hasCharm('conjunctionJunction') && longEnough && lettersInWord.every((l, i) => i === 0 || l >= lettersInWord[i - 1])) flat('Conjunction Junction', CHARM_BONUS.conjunctionJunction);
    if (hasCharm('voteForPedro') && longEnough && tiles.every(t => t.points === 1 && !t.isCombo)) flat('Vote for Pedro', CHARM_BONUS.voteForPedro);
    if (hasCharm('formVoltron') && tiles.some(t => t.isCombo)) flat('Form Voltron', CHARM_BONUS.formVoltron);
    if (hasCharm('silentKiller') && !lettersInWord.some(l => VOWELS.has(l))) flat('Silent Killer', CHARM_BONUS.silentKiller);
    if (hasCharm('starPower') && lettersInWord.includes('S') && lettersInWord.includes('T')) flat('Star Power', CHARM_BONUS.starPower);
    if (hasCharm('italianRestaurantEnding') && wordUpper.endsWith('AN')) flat('Italian Restaurant Ending', CHARM_BONUS.italianRestaurant);
    if (hasCharm('cleverGirl') && new Set(lettersInWord.filter(l => 'RAPTO'.includes(l))).size >= CHARM_BONUS.cleverGirlLetters) flat('Clever Girl', CHARM_BONUS.cleverGirl);
    if (hasCharm('radioactiveSpiderBite')) {
        const spider = ['D', 'E', 'R'].filter(l => lettersInWord.includes(l)).length;
        if (spider >= 2) flat('Radioactive Spider Bite', spider === 3 ? CHARM_BONUS.radioactiveAll : CHARM_BONUS.radioactive);
    }
    if (hasCharm('titansGo')) flat('Titans, Go!', CHARM_BONUS.titansPerCharm * Math.min(CHARM_SLOTS, gameState.activeCharms.length));

    // Charm: Perfectly Balanced (as many vowels as consonants)
    if (gameState.activeCharms.some(c => c.id === 'perfectlyBalanced')) {
        const vowelCount = lettersInWord.filter(l => VOWELS.has(l)).length;
        if (vowelCount * 2 === lettersInWord.length) {
            flatBonus += CHARM_BONUS.perfectlyBalanced;
            bonuses.push({ name: 'Perfectly Balanced', description: `+${CHARM_BONUS.perfectlyBalanced} pts`, source: 'game' });
        }
    }

    // Charm: The Dude Abides
    if (gameState.activeCharms.some(c => c.id === 'theDudeAbides') && word.length === 3) {
        flatBonus += CHARM_BONUS.theDudeAbides;
        bonuses.push({ name: 'The Dude Abides', description: `+${CHARM_BONUS.theDudeAbides} pts`, source: 'game' });
    }

    // Charm: Pants on Fire
    if (gameState.activeCharms.some(c => c.id === 'pantsOnFire') && lettersInWord.includes('L') && lettersInWord.includes('I')) {
        flatBonus += CHARM_BONUS.pantsOnFire;
        bonuses.push({ name: 'Pants on Fire', description: `+${CHARM_BONUS.pantsOnFire} pts`, source: 'game' });
    }

    // Charm: Strange Magic
    if (gameState.activeCharms.some(c => c.id === 'strangeMagic')) {
        if (/([AEIOU])\1/i.test(word)) {
            flatBonus += CHARM_BONUS.strangeMagic;
            bonuses.push({ name: 'Strange Magic', description: `+${CHARM_BONUS.strangeMagic} pts`, source: 'game' });
        }
    }

    // Charm: Turtle Power
    if (gameState.activeCharms.some(c => c.id === 'turtlePower')) {
        const letters = word.toUpperCase().split('');
        let hasDoubleConsonant = false;
        for (let i = 0; i < letters.length - 1; i++) {
            if (letters[i] === letters[i+1] && !VOWELS.has(letters[i])) {
                hasDoubleConsonant = true;
                break;
            }
        }
        if (hasDoubleConsonant) {
            flatBonus += CHARM_BONUS.turtlePower;
            bonuses.push({ name: 'Turtle Power', description: `+${CHARM_BONUS.turtlePower} pts`, source: 'game' });
        }
    }

    // Charm: Ice Age Bonus
    if (gameState.activeCharms.some(c => c.id === 'iceAgeBonus')) {
        if (wordUpper.includes('I') && wordUpper.includes('C')) {
            flatBonus += CHARM_BONUS.iceAgeBonus;
            bonuses.push({ name: 'Ice Age Bonus', description: `+${CHARM_BONUS.iceAgeBonus} pts`, source: 'game' });
        }
    }

    // PowerPlay: Cowabunga!
    if (gameState.activePowerPlays.cowabunga) {
        const consonantTiles = tiles.filter(t => !VOWELS.has(t.letter));
        const bonus = consonantTiles.length * 10;
        if (bonus > 0) {
            flatBonus += bonus;
            bonuses.push({ name: "Cowabunga!", description: `+${bonus} pts`, source: 'game' });
        }
    }

    // Power Star Residual
    if (gameState.powerStarResidualActive) {
        flatBonus += CHARM_BONUS.powerStarResidual;
        bonuses.push({ name: 'Power Star Residual', description: `+${CHARM_BONUS.powerStarResidual} pts`, source: 'game' });
    }

    totalScore += flatBonus;

    // --- 4. Final Percentage-based Bonuses (calculated on the total so far) ---

    // Lena of the Lost Lights
    if (gameState.activeCharms.some(c => c.id === 'lenaOfTheLostLights')) {
        if (['D', 'R', 'K', 'N'].some(l => lettersInWord.includes(l))) {
             const bonus = Math.round(totalScore * CHARM_BONUS.lenaPercent / 100);
             totalScore += bonus;
             bonuses.push({ name: 'Lena of the Lost Lights', description: `+${bonus} pts (${CHARM_BONUS.lenaPercent}%)`, source: 'game' });
        }
    }

    // --- 5. Final Rounding & Caps ---

    // Schrute Bucks cap
    if (gameState.activePowerPlays.schruteBucks) {
        totalScore = 1;
        bonuses.push({ name: 'Schrute Bucks', description: 'Score capped at 1', source: 'game' });
    }
    
    // Wordionaire cap
    if (gameState.activePowerPlays.wordionaireCap) {
        totalScore = Math.min(totalScore, gameState.activePowerPlays.wordionaireCap);
        bonuses.push({ name: 'Wordionaire: Fast Cash', description: 'Score capped at 20', source: 'game' });
    }

    // Thanos Gift
    if (gameState.activePowerPlays.thanosGift) {
        totalScore = 0;
        bonuses.push({ name: 'Gift From Thanos', description: 'Score sacrificed to 0', source: 'game' });
    }

    const capped = !!(gameState.activePowerPlays.schruteBucks || gameState.activePowerPlays.wordionaireCap || gameState.activePowerPlays.thanosGift);

    return {
        totalScore: Math.round(totalScore),
        baseScore: rawBaseScore,
        bonuses,
        scoreBeforeMultiplier,
        wordMultiplier,
        capped,
    };
};

/**
 * Replaces getRandomItems. Provides a weighted, stratified, and fresh selection of items.
 * @param allItems The full list of items to select from (e.g., all charms).
 * @param count The number of items to return.
 * @param gameState The current game state for weighting calculations.
 * @returns An array of selected items and their calculated scores.
 */
export function getOffer(
    allItems: (Charm | PowerPlay)[],
    count: number,
    gameState: GameState
): { offeredItems: (Charm | PowerPlay)[], offerDetails: { id: string, score: number }[] } {
    
    const rng = new SeededRNG(gameState.runSeed + gameState.totalOffersMade);
    const currentTurn = (gameState.log.filter(e => e.type === 'word' && e.status === 'valid').length) + 1;

    // 1. Filter out ineligible items
    let eligibleItems = allItems.filter(item => 
        !gameState.activeBuffs.some(active => active.id === item.id) &&
        !gameState.charmCooldowns[item.id] &&
        !gameState.powerPlayCooldowns[item.id]
    );

    // 2. Score each eligible item
    const lastThreeOffers = gameState.offerHistory.slice(-3).flat().map(o => o.id);
    const scoredItems = eligibleItems.map(item => {
        const stats = gameState.itemStats[item.id] || { offered: 0, lastOfferedTurn: -Infinity };
        const baseWeight = 1;

        // Exploration Boost for never-offered items
        const explorationBoost = stats.offered === 0 ? OFFER_EXPLORATION_BOOST : 1;

        // Recency Penalty
        const turnsSinceOffered = currentTurn - stats.lastOfferedTurn;
        const recencyPenaltyRatio = Math.max(0, (OFFER_RECENCY_WINDOW - turnsSinceOffered) / OFFER_RECENCY_WINDOW);
        const recencyPenalty = Math.min(recencyPenaltyRatio, OFFER_MAX_RECENCY_PENALTY);

        // Repeat Penalty
        const repeatPenalty = lastThreeOffers.includes(item.id) ? OFFER_REPEAT_PENALTY : 0;

        // Scarcity Boost
        const sessionCount = gameState.sessionOfferCounts[item.id] || 0;
        const globalOfferRate = gameState.totalOffersMade > 0 ? sessionCount / gameState.totalOffersMade : 0;
        const scarcityBoost = 1 + (1 - globalOfferRate);
        
        const score = baseWeight * explorationBoost * (1 - recencyPenalty) * (1 - repeatPenalty) * scarcityBoost;
        
        return { item, score };
    });

    // 3. Stratified & Weighted Sampling
    let finalSelection: { item: Charm | PowerPlay, score: number }[] = [];

    const drawWeighted = (pool: typeof scoredItems, numToDraw: number) => {
        let tempPool = [...pool];
        const drawn = [];
        for (let i = 0; i < numToDraw && tempPool.length > 0; i++) {
            const totalWeight = tempPool.reduce((sum, current) => sum + current.score, 0);
            let random = rng.nextFloat() * totalWeight;
            let chosenIndex = -1;
            for (let j = 0; j < tempPool.length; j++) {
                random -= tempPool[j].score;
                if (random < 0) {
                    chosenIndex = j;
                    break;
                }
            }
            if (chosenIndex !== -1) {
                drawn.push(tempPool[chosenIndex]);
                tempPool.splice(chosenIndex, 1);
            }
        }
        return drawn;
    }

    // Safety Valve: If not enough items for complex logic, fall back to simple weighted sampling.
    if (scoredItems.length < count) {
        finalSelection = drawWeighted(scoredItems, scoredItems.length);
    } else {
        // Attempt to apply diversity constraints
        const neverOffered = scoredItems.filter(si => (gameState.itemStats[si.item.id]?.offered || 0) === 0);
        let selectionPool = [...scoredItems];
        
        // Constraint 1: Guarantee one new item if available
        if (neverOffered.length > 0) {
            const [newItem] = drawWeighted(neverOffered, 1);
            finalSelection.push(newItem);
            selectionPool = selectionPool.filter(si => si.item.id !== newItem.item.id);
        }

        // Fill remaining slots
        while (finalSelection.length < count && selectionPool.length > 0) {
            // Constraint 2: Avoid subtheme collision
            const currentSubthemes = new Set(finalSelection.map(si => si.item.subtheme));
            let diversePool = selectionPool.filter(si => !currentSubthemes.has(si.item.subtheme));
            
            // Relaxation: If no diverse options, use the whole pool
            if (diversePool.length === 0) {
                diversePool = selectionPool;
            }

            const [nextItem] = drawWeighted(diversePool, 1);
            finalSelection.push(nextItem);
            selectionPool = selectionPool.filter(si => si.item.id !== nextItem.item.id);
        }
    }
    
    // Ensure we have 'count' items if possible by relaxing all constraints if needed
    if (finalSelection.length < count && scoredItems.length >= count) {
        const currentIds = new Set(finalSelection.map(si => si.item.id));
        const remainingPool = scoredItems.filter(si => !currentIds.has(si.item.id));
        const needed = count - finalSelection.length;
        finalSelection.push(...drawWeighted(remainingPool, needed));
    }
    
    return {
        offeredItems: finalSelection.map(s => s.item),
        offerDetails: finalSelection.map(s => ({ id: s.item.id, score: parseFloat(s.score.toFixed(2)) }))
    };
}