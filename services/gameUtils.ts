import { Tile, Charm, GameState, WordData, ScoreCalculationResult, ScoreBonusInfo } from '../types';
import { TILE_DISTRIBUTION, VOWELS, RACK_SIZE, BALANCE_REPLACE_COUNT } from '../constants';
import { internalWords } from '../data/internalWords';


const LETTER_WEIGHTS: { [key: string]: number } = {
  Q: 9, Z: 8, J: 7, X: 7, K: 6, V: 5, W: 5, F: 4, H: 4, Y: 4, B: 3, C: 3, M: 3, P: 3,
  G: 2, D: 2, L: 2, S: 2, T: 2, R: 2, N: 2,
  A: 1, E: 1, I: 1, O: 1, U: 1,
};
const WEIGHT_CAP = 30;
const THREE_LETTER_WORDS = new Set(
    [...internalWords.keys()].filter(word => word.length === 3)
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

export const createTile = (letter: string): Tile => {
  const isMultiplier = Math.random() < 0.15; // 15% chance for a 2x multiplier
  return {
    id: `${letter}-${Math.random()}`,
    letter,
    points: TILE_DISTRIBUTION[letter]?.points || 0,
    multiplier: isMultiplier ? 2 : 1,
  };
};

export const canBeMadeFromRack = (word: string, rack: Tile[]): boolean => {
  const rackLetters = rack.map(t => t.letter).join('');
  const wordLetters = word.toUpperCase();
  
  const rackCounts: { [key: string]: number } = {};
  for (const char of rackLetters) {
    rackCounts[char] = (rackCounts[char] || 0) + 1;
  }

  for (const char of wordLetters) {
    if (!rackCounts[char] || rackCounts[char] === 0) {
      return false;
    }
    rackCounts[char]--;
  }
  return true;
};

export const handleDuplicateLetters = (hand: (Tile | null)[], tileBag: string[]): { newHand: (Tile | null)[], newBag: string[], wasChanged: boolean } => {
    let wasChanged = false;
    let currentHand = [...hand];
    let currentBag = [...tileBag];
    let safetyCounter = 0;

    while (safetyCounter < RACK_SIZE) { // Safety break to avoid infinite loops
        safetyCounter++;

        const handTiles = currentHand.filter((t): t is Tile => t !== null);
        const letterCounts: { [key: string]: number } = {};
        handTiles.forEach(tile => {
            letterCounts[tile.letter] = (letterCounts[tile.letter] || 0) + 1;
        });
        
        const letterToFix = Object.keys(letterCounts).find(letter => letterCounts[letter] > 3);
        
        if (!letterToFix) {
            break; // No duplicates over the limit found, exit loop.
        }

        wasChanged = true;

        const indicesOfDuplicates = currentHand
            .map((tile, index) => ({ tile, index }))
            .filter(item => item.tile?.letter === letterToFix)
            .map(item => item.index);
        
        // Randomly pick one of the duplicates to replace
        const indexToReplace = shuffleArray(indicesOfDuplicates)[0];
        const letterToReturn = currentHand[indexToReplace]!.letter;
        
        const { newTiles, remainingBag } = drawTiles(1, [...currentBag, letterToReturn]);
        currentBag = remainingBag;
        
        currentHand[indexToReplace] = newTiles[0] || null;
    }

    return { newHand: currentHand, newBag: currentBag, wasChanged };
};

export const postProcessHand = (hand: (Tile | null)[], tileBag: string[], showMessage: (msg: string, duration?: number) => void): { newHand: (Tile | null)[], newBag: string[] } => {
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
                const { newTiles, remainingBag } = drawTiles(1, currentBag);
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
            const { newTiles, remainingBag } = drawTiles(1, currentBag);
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

            if (replaceableConsonantIndices.length > 0 && availableVowelsInBag.length > 0) {
                needsChange = true;
                const indexToReplace = shuffleArray(replaceableConsonantIndices)[0];
                const letterToReturn = currentHand[indexToReplace]!.letter;
                
                const vowelToDraw = shuffleArray(availableVowelsInBag)[0];
                currentHand[indexToReplace] = createTile(vowelToDraw);
                
                let tempBag = [...currentBag];
                const vowelIndexInBag = tempBag.indexOf(vowelToDraw);
                if (vowelIndexInBag > -1) tempBag.splice(vowelIndexInBag, 1);
                tempBag.push(letterToReturn);
                currentBag = shuffleArray(tempBag);
            }
        } else if (consonantCount < 1 && finalHandTiles.length > 1) {
            let availableConsonantsInBag = currentBag.filter(l => !VOWELS.has(l));
            
            // Also ensure the bag has consonants if we need one.
            if (availableConsonantsInBag.length === 0) {
                currentBag.push(...createTileBag());
                availableConsonantsInBag = currentBag.filter(l => !VOWELS.has(l));
            }

            const replaceableVowelIndices = currentHand
                .map((tile, index) => ({ tile, index }))
                .filter(item => item.tile && VOWELS.has(item.tile.letter))
                .map(item => item.index);
            
            if (replaceableVowelIndices.length > 0 && availableConsonantsInBag.length > 0) {
                needsChange = true;
                const indexToReplace = shuffleArray(replaceableVowelIndices)[0];
                const letterToReturn = currentHand[indexToReplace]!.letter;
                
                const consonantToDraw = shuffleArray(availableConsonantsInBag)[0];
                currentHand[indexToReplace] = createTile(consonantToDraw);
                
                let tempBag = [...currentBag];
                const consonantIndexInBag = tempBag.indexOf(consonantToDraw);
                if (consonantIndexInBag > -1) tempBag.splice(consonantIndexInBag, 1);
                tempBag.push(letterToReturn);
                currentBag = shuffleArray(tempBag);
            }
        }
        
        if (needsChange) {
            anyChanges = true;
            // Rerun duplicate check after each swap
            const postSwapDupeResult = handleDuplicateLetters(currentHand, currentBag);
            currentHand = postSwapDupeResult.newHand;
            currentBag = postSwapDupeResult.newBag;
        } else {
            break; // Rack is balanced
        }
    }

    if (anyChanges) {
        showMessage("Rack balanced for playability", 2000);
    }
    
    return { newHand: currentHand, newBag: currentBag };
};


export const calculateScore = (word: string, tiles: Tile[], gameState: GameState): ScoreCalculationResult => {
  let score = 0;
  let wordMultiplier = 1;
  const bonuses: ScoreBonusInfo[] = [];
  const wordUpper = word.toUpperCase();
  const { activeCharms, activePowerPlays } = gameState;
  
  // Base score from tiles, applying tile-specific modifiers FIRST
  let baseScore = tiles.reduce((acc, tile) => {
    let tilePoints = tile.isSuper ? (tile.points / 4) : (tile.tempPoints ?? tile.points);
    
    // S-Tier Scorer replaces base points
    if (activeCharms.some(c => c.id === 'sTierScorer') && tile.letter === 'S') {
        tilePoints = 15;
    }

    // Skywalker Bloodline overrides
    if (activePowerPlays['skywalkerBloodline'] && tile.letter === 'S') {
        tilePoints = 15;
        bonuses.push({ name: 'Skywalker Bloodline (S)', description: `Set to 15 pts` });
    }

    // Wakanda Forever provides a minimum value
    if (activePowerPlays['wakandaForever'] && tilePoints < 5) {
        tilePoints = 5;
        bonuses.push({ name: `Wakanda Forever (${tile.letter})`, description: `Set to 5 pts` });
    }

    // Letter Upgrade multiplies tile points
    const letterMultiplier = gameState.letterMultipliers[tile.letter] || 1;
    if (letterMultiplier > 1) {
        const bonus = (tilePoints * (letterMultiplier - 1));
        bonuses.push({ name: `Letter Upgrade (${tile.letter})`, description: `+${bonus} pts` });
        tilePoints *= letterMultiplier;
    }

    // Super Tile multiplication
    if (tile.isSuper) {
        const bonus = tilePoints * 3; // Add 3x to make it 4x total
        bonuses.push({ name: `Super Tile (${tile.letter})`, description: `+${bonus} pts` });
        tilePoints *= 4;
    }


    return acc + tilePoints;
  }, 0);

  score = baseScore;

  // Apply flat bonuses that add on top of tile values
  const vowelLoverBonus = tiles.filter(t => VOWELS.has(t.letter)).length * 10;
  if (activeCharms.some(c => c.id === 'theValve') && vowelLoverBonus > 0) {
      score += vowelLoverBonus;
      bonuses.push({ name: 'Vowel Lover', description: `+${vowelLoverBonus} pts` });
  }

  const oneRingBonus = tiles.filter(t => t.letter === 'E').length * 15;
  if (activeCharms.some(c => c.id === 'oneRing') && oneRingBonus > 0) {
      score += oneRingBonus;
      bonuses.push({ name: 'The One Ring', description: `+${oneRingBonus} pts` });
  }
  
  // Apply finisher charm
  if (activeCharms.some(c => c.id === 'finisher')) {
    const lastTile = tiles[tiles.length - 1];
    if(lastTile) {
        let lastTilePoints = lastTile.isSuper ? (lastTile.points / 4) : (lastTile.tempPoints ?? lastTile.points);
        if (activeCharms.some(c => c.id === 'sTierScorer') && lastTile.letter === 'S') lastTilePoints = 15;
        
        const letterMultiplier = gameState.letterMultipliers[lastTile.letter] || 1;
        lastTilePoints *= letterMultiplier;

        if (lastTile.isSuper) lastTilePoints *= 4;
        
        const finisherBonus = lastTilePoints * 2;
        score += finisherBonus;
        bonuses.push({ name: 'Finisher', description: `+${finisherBonus} pts` });
    }
  }

  // Apply 'Italian Restaurant Ending'
  if (activeCharms.some(c => c.id === 'italianRestaurantEnding') && wordUpper.endsWith('AN')) {
    const vowelScoreBonus = tiles.filter(t => VOWELS.has(t.letter)).reduce((acc, tile) => {
       let tilePoints = tile.tempPoints ?? tile.points;
       // We should not double-dip on multipliers here, just the base value of the vowel
       return acc + (tilePoints * 2); // Triple means adding 2x
    }, 0);
    if(vowelScoreBonus > 0) {
      score += vowelScoreBonus;
      bonuses.push({ name: 'Italian Restaurant', description: `+${vowelScoreBonus} pts` });
    }
  }

  // Word-based flat bonuses
  if (activeCharms.some(c => c.id === 'bulletTime') && word.length >= 6) { score += 20; bonuses.push({ name: 'Bullet Time', description: '+20 pts'}); }
  if (activeCharms.some(c => c.id === 'powerPellet') && word.length === 5) { score += 25; bonuses.push({ name: 'Power Pellet', description: '+25 pts'}); }
  if (activeCharms.some(c => c.id === 'batSignal') && (['B','A','T','M'].includes(wordUpper[0]) || ['B','A','T','M'].includes(wordUpper.slice(-1)))) { score += 20; bonuses.push({ name: 'Bat-Signal', description: '+20 pts'}); }
  if (activeCharms.some(c => c.id === 'triforceOfCourage') && /[ZXQ]/i.test(word)) { score += 15; bonuses.push({ name: 'Triforce of Courage', description: '+15 pts'}); }
  if (activeCharms.some(c => c.id === 'weDidntStartTheFire') && new Set(tiles.filter(t => VOWELS.has(t.letter)).map(t => t.letter)).size >= 3) { score += 25; bonuses.push({ name: "We Didn't Start the Fire", description: '+25 pts' }); }
  if (activeCharms.some(c => c.id === 'trueLove') && wordUpper.includes('L') && wordUpper.includes('V') && wordUpper.includes('E')) { score += 100; bonuses.push({ name: 'True Love', description: '+100 pts' }); }
  if (activeCharms.some(c => c.id === 'inigosRevenge') && (wordUpper.match(/I/g) || []).length >= 2) { score += 50; bonuses.push({ name: 'Inigo’s Revenge', description: '+50 pts' }); }
  if (activeCharms.some(c => c.id === 'chaosTheory') && word.length % 2 === 0) { score += 20; bonuses.push({ name: 'Chaos Theory', description: '+20 pts' }); }
  if (activeCharms.some(c => c.id === 'sacredHeart') && wordUpper.includes('J') && wordUpper.includes('D')) { score += 22; bonuses.push({ name: 'Sacred Heart', description: '+22 pts'}); }
  
  const consonantCount = tiles.filter(t => !VOWELS.has(t.letter)).length;
  if (activeCharms.some(c => c.id === 'millenniumFalcon') && consonantCount === 3) { score += 20; bonuses.push({ name: 'Millennium Falcon', description: '+20 pts' }); }

  const isPalindrome = word.length > 1 && wordUpper === [...wordUpper].reverse().join('');
  if (activeCharms.some(c => c.id === 'sherlocksSyntax') && isPalindrome) {
    score += 50;
    bonuses.push({ name: 'Sherlock\'s Syntax', description: '+50 pts'});
  }

  // Word Multipliers
  if (word.length >= 5) { wordMultiplier *= 2; bonuses.push({ name: 'Long Word Bonus (5+ letters)', description: 'x2 Score' }); }
  if (activeCharms.some(c => c.id === 'sTierScorer') && wordUpper.includes('S')) { wordMultiplier *= 2; bonuses.push({ name: 'S-Tier Scorer', description: 'x2 Score' }); }
  if (activeCharms.some(c => c.id === 'silentKiller') && ![...wordUpper].some(c => VOWELS.has(c))) { wordMultiplier *= 4; bonuses.push({ name: 'Silent Killer', description: 'x4 Score' }); }
  if (activeCharms.some(c => c.id === 'battleOfWits') && word.length > 1 && wordUpper[0] === wordUpper.slice(-1)) { wordMultiplier *= 4; bonuses.push({ name: 'Battle of Wits', description: 'x4 Score' }); }
  if (activeCharms.some(c => c.id === 'starPower') && wordUpper.includes('S') && wordUpper.includes('T') && wordUpper.includes('A')) { wordMultiplier *= 4; bonuses.push({ name: 'Star Power', description: 'x4 Score' }); }
  
  // PowerPlay Multipliers
  if (activePowerPlays['biglyScore']) { wordMultiplier *= 4; bonuses.push({ name: 'Bigly Score', description: 'x4 Score' }); }
  if (activePowerPlays['nuclearOption']) { wordMultiplier *= 4; bonuses.push({ name: 'Nuclear Option', description: 'x4 Score' }); }
  if (activePowerPlays['sonicSpeed']) {
      if (activePowerPlays.sonicSpeed.count === 2) { // First word
          wordMultiplier *= 2; 
          bonuses.push({ name: 'Sonic Speed', description: 'x2 Score' });
      } else { // Second word
          wordMultiplier *= 4; 
          bonuses.push({ name: 'Sonic Speed', description: 'x4 Score' });
      }
  }
  if (activePowerPlays['redWedding']) { wordMultiplier *= 5; bonuses.push({ name: 'Red Wedding', description: 'x5 Score' }); }

  // PowerPlay letter-based word multipliers
  for(const letter in gameState.wordMultipliersByLetter) {
      if(wordUpper.includes(letter)) {
          const multiplier = gameState.wordMultipliersByLetter[letter];
          wordMultiplier *= multiplier;
          bonuses.push({ name: `Polish (${letter})`, description: `x${multiplier} Score` });
      }
  }

  // Tile-based Word Multipliers from charms like Dice Roll Protocol
  tiles.forEach(tile => {
      if (tile.multiplier && tile.multiplier > 1) {
          wordMultiplier *= tile.multiplier;
          bonuses.push({ name: `x${tile.multiplier} Tile`, description: `x${tile.multiplier} Score` });
      }
  });
  
  let finalScore = score * wordMultiplier;
  
  // Heisenberg PowerPlay (Triple or Nothing)
  if (activePowerPlays['heisenberg']) {
    const rand = Math.random();
    if (rand < 0.5) {
        finalScore *= 3;
        bonuses.push({ name: 'Heisenberg (Win)', description: 'x3 Score' });
    } else {
        finalScore = 0;
        bonuses.push({ name: 'Heisenberg (Loss)', description: 'Score x0' });
    }
  }

  // Schrute Bucks PowerPlay (score becomes 1)
  if (activePowerPlays['schruteBucks']) {
    finalScore = 1;
    bonuses.splice(0, bonuses.length); // Clear other bonuses
    bonuses.push({ name: 'Schrute Bucks', description: '1 pt' });
  }
  
  // Gift From Thanos PowerPlay
  if (activePowerPlays['thanosGift']) {
      finalScore = 0;
      bonuses.splice(0, bonuses.length);
      bonuses.push({ name: 'Gift From Thanos', description: 'Score sacrificed' });
  }

  return { totalScore: Math.round(finalScore), baseScore: score, bonuses };
};

export const getRandomItems = <T,>(arr: T[], num: number): T[] => {
  return shuffleArray(arr).slice(0, num);
}

export const drawTiles = (count: number, currentBag: string[]): { newTiles: Tile[], remainingBag: string[] } => {
    let bag = [...currentBag];
    if (bag.length < count) {
      bag.push(...createTileBag());
    }
    const drawnLetters = bag.slice(0, count);
    const newTiles = drawnLetters.map(createTile);
    const remainingBag = bag.slice(count);
    return { newTiles, remainingBag };
};

export const dealNewHand = (tileBag: string[], tilesToReturn: Tile[] = []) => {
    let currentBag = shuffleArray([...tileBag, ...tilesToReturn.map(t => t.letter)]);
    if (currentBag.length < RACK_SIZE) {
      currentBag.push(...createTileBag());
    }
    
    const { newTiles, remainingBag } = drawTiles(RACK_SIZE, currentBag);

    return { hand: newTiles, tileBag: remainingBag };
};