import { Tile, Charm, GameState, WordData, ScoreCalculationResult, ScoreBonusInfo, PowerPlay } from '../types';
import { TILE_DISTRIBUTION, VOWELS, RACK_SIZE, BALANCE_REPLACE_COUNT, COMBO_TILES, COMBO_TILE_CHANCE, OFFER_RECENCY_WINDOW, OFFER_EXPLORATION_BOOST, OFFER_REPEAT_PENALTY, OFFER_MAX_RECENCY_PENALTY } from '../constants';
import { dictionaryService } from './dictionaryService';
import { canBeMadeFromLetters } from './rackMatch';

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

  const { newTiles, remainingBag } = drawTiles(RACK_SIZE, currentBag, isForGoldenRound);

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

        // Charm: The Valve
        if (gameState.activeCharms.some(c => c.id === 'theValve') && VOWELS.has(tile.letter)) {
            tilePoints += 10;
            bonuses.push({ name: `Vowel Lover (${tile.letter})`, description: `+10 pts`, source: 'tile' });
        }

        // Charm: One Ring
        if (gameState.activeCharms.some(c => c.id === 'oneRing') && tile.letter === 'E') {
            tilePoints += 15;
            bonuses.push({ name: `The One Ring (${tile.letter})`, description: `+15 pts`, source: 'tile' });
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
            tileMultiplier *= 3;
            bonuses.push({ name: `Finisher (${tile.letter})`, description: `x3 Tile Pts`, source: 'tile' });
        }
        
        // Charm: Italian Restaurant Ending
        if (gameState.activeCharms.some(c => c.id === 'italianRestaurantEnding') && wordUpper.endsWith('AN') && VOWELS.has(tile.letter)) {
            tileMultiplier *= 3;
            bonuses.push({ name: `Italian Restaurant (${tile.letter})`, description: `x3 Tile Pts`, source: 'tile' });
        }
        
        scoreAfterTileMods += tilePoints * tileMultiplier;
    });
    
    // --- 2. Word Multipliers & Bonuses ---
    let totalScore = scoreAfterTileMods;
    let wordMultiplier = 1;

    // Tile-based word multipliers
    tiles.forEach(tile => {
        if (tile.multiplier && tile.multiplier > 1) {
            wordMultiplier *= tile.multiplier;
            bonuses.push({ name: `Tile Multiplier (${tile.letter})`, description: `x${tile.multiplier} Word Score`, source: 'word' });
        }
        if (tile.isSuper) {
            wordMultiplier *= 4;
            bonuses.push({ name: `Super Tile (${tile.letter})`, description: 'x4 Word Score', source: 'word' });
        }
    });

    // PowerPlay: Red Wedding
    if (gameState.activePowerPlays.redWedding) {
        wordMultiplier *= 5;
        bonuses.push({ name: 'Red Wedding', description: 'x5 Word Score', source: 'word' });
    }

    // General 5+ letter bonus
    if (word.length >= 5) {
        wordMultiplier *= 2;
        bonuses.push({ name: '5+ Letter Bonus', description: 'x2 Score', source: 'word' });
    }
    
    // Charm: S-Tier Scorer (word multiplier)
    if (gameState.activeCharms.some(c => c.id === 'sTierScorer') && lettersInWord.includes('S')) {
        wordMultiplier *= 2;
        bonuses.push({ name: 'S-Tier Scorer', description: 'x2 Word Score', source: 'word' });
    }

    // Charm: Silent Killer
    if (gameState.activeCharms.some(c => c.id === 'silentKiller') && !lettersInWord.some(l => VOWELS.has(l))) {
        wordMultiplier *= 4;
        bonuses.push({ name: 'Silent Killer', description: 'x4 Score', source: 'word' });
    }

    // Charm: Star Power
    if (gameState.activeCharms.some(c => c.id === 'starPower') && ['S', 'T', 'A'].every(l => lettersInWord.includes(l))) {
        wordMultiplier *= 4;
        bonuses.push({ name: 'Star Power', description: 'x4 Score', source: 'word' });
    }
    
    // Charm: Battle of Wits
    if (gameState.activeCharms.some(c => c.id === 'battleOfWits') && word.length > 1 && wordUpper[0] === wordUpper[wordUpper.length - 1]) {
        wordMultiplier *= 4;
        bonuses.push({ name: 'Battle of Wits', description: 'x4 Score', source: 'word' });
    }
    
    // Charm: Radioactive Spider Bite
    if (gameState.activeCharms.some(c => c.id === 'radioactiveSpiderBite') && ['D', 'E', 'R'].every(l => lettersInWord.includes(l))) {
        wordMultiplier *= 2;
        bonuses.push({ name: 'Radioactive Spider Bite', description: 'x2 Score', source: 'word' });
    }

    // PowerPlay: Bigly Score
    if (gameState.activePowerPlays.biglyScore) {
        wordMultiplier *= 4;
        bonuses.push({ name: 'Bigly Score', description: 'x4 Word Score', source: 'word' });
    }
    
    // PowerPlay: Nuclear Option
    if (gameState.activePowerPlays.nuclearOption) {
        wordMultiplier *= 4;
        bonuses.push({ name: 'Nuclear Option', description: 'x4 Word Score', source: 'word' });
    }

    // PowerPlay: Polish
    Object.keys(gameState.wordMultipliersByLetter).forEach(letter => {
        if (lettersInWord.includes(letter)) {
            const multiplier = gameState.wordMultipliersByLetter[letter];
            wordMultiplier *= multiplier;
            bonuses.push({ name: 'Polish', description: `x${multiplier} for '${letter}'`, source: 'word' });
        }
    });
    
    // PowerPlay: Cassie's Clue
    if (gameState.activePowerPlays.cassiesClue && ['C', 'A', 'T'].every(l => lettersInWord.includes(l))) {
        wordMultiplier *= 3;
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
            wordMultiplier *= 4;
            bonuses.push({ name: 'Tetris Touch', description: 'x4 Score', source: 'word' });
        }
    }
    
    // PowerPlay: Wordionaire Double Down
    if (gameState.activePowerPlays.wordionaireDouble) {
        wordMultiplier *= 2;
        bonuses.push({ name: 'Wordionaire: Double Down', description: 'x2 Word Score', source: 'word' });
    }
    
    // PowerPlay: Pinky and the Brain
    if (gameState.activePowerPlays.pinkyAndTheBrain) {
        wordMultiplier *= 2;
        bonuses.push({ name: 'Pinky and the Brain', description: 'x2 Score', source: 'word' });
    }

    // PowerPlay: Let's Get Dangerous
    if (gameState.activePowerPlays.letsGetDangerous) {
        const vowelCount = lettersInWord.filter(l => VOWELS.has(l)).length;
        if (vowelCount > 0) {
            wordMultiplier *= vowelCount;
            bonuses.push({ name: "Let's Get Dangerous", description: `x${vowelCount} Score`, source: 'word' });
        }
    }

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
             flatBonus += 20;
             bonuses.push({ name: 'Bat-Signal', description: '+20 pts', source: 'game' });
        }
    }
    
    // Charm: Millennium Falcon
    if (gameState.activeCharms.some(c => c.id === 'millenniumFalcon')) {
        const consonantCount = lettersInWord.filter(l => !VOWELS.has(l)).length;
        if (consonantCount === 3) {
             flatBonus += 20;
             bonuses.push({ name: 'Millennium Falcon', description: '+20 pts', source: 'game' });
        }
    }
    
    // Charm: Triforce of Courage
    if (gameState.activeCharms.some(c => c.id === 'triforceOfCourage') && ['Z', 'X', 'Q'].some(l => lettersInWord.includes(l))) {
        flatBonus += 15;
        bonuses.push({ name: 'Triforce of Courage', description: '+15 pts', source: 'game' });
    }
    
    // Charm: Power Pellet
    if (gameState.activeCharms.some(c => c.id === 'powerPellet') && word.length === 5) {
        flatBonus += 25;
        bonuses.push({ name: 'Power Pellet', description: '+25 pts', source: 'game' });
    }
    
    // Charm: Chaos Theory
    if (gameState.activeCharms.some(c => c.id === 'chaosTheory') && word.length % 2 === 0) {
        flatBonus += 20;
        bonuses.push({ name: 'Chaos Theory', description: '+20 pts', source: 'game' });
    }
    
    // Charm: We Didn’t Start the Fire
    if (gameState.activeCharms.some(c => c.id === 'weDidntStartTheFire')) {
        const uniqueVowels = new Set(lettersInWord.filter(l => VOWELS.has(l)));
        if (uniqueVowels.size >= 3) {
             flatBonus += 25;
             bonuses.push({ name: 'We Didn’t Start the Fire', description: '+25 pts', source: 'game' });
        }
    }
    
    // Charm: Inigo’s Revenge
    if (gameState.activeCharms.some(c => c.id === 'inigosRevenge') && lettersInWord.filter(l => l === 'I').length >= 2) {
        flatBonus += 50;
        bonuses.push({ name: 'Inigo’s Revenge', description: '+50 pts', source: 'game' });
    }
    
    // Charm: True Love
    if (gameState.activeCharms.some(c => c.id === 'trueLove') && ['L', 'V'].every(l => lettersInWord.includes(l))) {
        flatBonus += 100;
        bonuses.push({ name: 'True Love', description: '+100 pts', source: 'game' });
    }
    
    // Charm: Sherlock's Syntax
    if (gameState.activeCharms.some(c => c.id === 'sherlocksSyntax') && wordUpper === wordUpper.split('').reverse().join('')) {
        flatBonus += 50;
        bonuses.push({ name: "Sherlock's Syntax", description: '+50 pts', source: 'game' });
    }
    
    // Charm: Sacred Heart
    if (gameState.activeCharms.some(c => c.id === 'sacredHeart') && lettersInWord.includes('J') && lettersInWord.includes('D')) {
        flatBonus += 100;
        bonuses.push({ name: 'Sacred Heart', description: '+100 pts', source: 'game' });
    }

    // Charm: Scooby Stack
    if (gameState.activeCharms.some(c => c.id === 'scoobyStack') && new Set(lettersInWord).size < lettersInWord.length) {
        flatBonus += 55;
        bonuses.push({ name: 'Scooby Stack', description: '+55 pts', source: 'game' });
    }
    
    // Charm: Hyrule Hustle
    if (gameState.activeCharms.some(c => c.id === 'hyruleHustle') && ['H', 'L', 'Z'].includes(wordUpper[0])) {
        flatBonus += 15;
        bonuses.push({ name: 'Hyrule Hustle', description: '+15 pts', source: 'game' });
    }

    // Charm: LUNA
    if (gameState.activeCharms.some(c => c.id === 'luna')) {
        const vowelCount = lettersInWord.filter(l => VOWELS.has(l)).length;
        const consonantCount = lettersInWord.length - vowelCount;
        if (vowelCount > consonantCount) {
             flatBonus += 50;
             bonuses.push({ name: 'LUNA', description: '+50 pts', source: 'game' });
        }
    }

    // Charm: The Dude Abides
    if (gameState.activeCharms.some(c => c.id === 'theDudeAbides') && word.length === 3) {
        flatBonus += 10;
        bonuses.push({ name: 'The Dude Abides', description: '+10 pts', source: 'game' });
    }

    // Charm: Pants on Fire
    if (gameState.activeCharms.some(c => c.id === 'pantsOnFire') && lettersInWord.includes('L') && lettersInWord.includes('I')) {
        flatBonus += 25;
        bonuses.push({ name: 'Pants on Fire', description: '+25 pts', source: 'game' });
    }

    // Charm: Strange Magic
    if (gameState.activeCharms.some(c => c.id === 'strangeMagic')) {
        if (/([AEIOU])\1/i.test(word)) {
            flatBonus += 55;
            bonuses.push({ name: 'Strange Magic', description: '+55 pts', source: 'game' });
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
            flatBonus += 55;
            bonuses.push({ name: 'Turtle Power', description: '+55 pts', source: 'game' });
        }
    }

    // Charm: Ice Age Bonus
    if (gameState.activeCharms.some(c => c.id === 'iceAgeBonus')) {
        if (wordUpper.includes('I') && wordUpper.includes('C')) {
            flatBonus += 50;
            bonuses.push({ name: 'Ice Age Bonus', description: '+50 pts', source: 'game' });
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
        flatBonus += 5;
        bonuses.push({ name: 'Power Star Residual', description: '+5 pts', source: 'game' });
    }

    totalScore += flatBonus;

    // --- 4. Final Percentage-based Bonuses (calculated on the total so far) ---

    // Lena of the Lost Lights
    if (gameState.activeCharms.some(c => c.id === 'lenaOfTheLostLights')) {
        if (['D', 'R', 'K', 'N'].some(l => lettersInWord.includes(l))) {
             const bonus = Math.round(totalScore * 0.10);
             totalScore += bonus;
             bonuses.push({ name: 'Lena of the Lost Lights', description: `+${bonus} pts (10%)`, source: 'game' });
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

    return {
        totalScore: Math.round(totalScore),
        baseScore: rawBaseScore,
        bonuses,
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