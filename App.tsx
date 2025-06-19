
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { GameState, TileData, WordSlot, GameScreenState, MessageType, Charm, BrainstormAction, LetterValues, DictionaryEntry, Milestone, GameConfig } from './types';
import { INITIAL_LETTER_VALUES, LETTER_FREQUENCIES, VOWELS, DEFAULT_GAME_CONFIG, AVAILABLE_CHARMS, AVAILABLE_BRAINSTORM_ACTIONS, SPECIAL_SLOT_INDEX, MILESTONES_LIST } from './constants';
import { validateWordWithApi, getKidFriendlyDefinition, getAIHint } from './services';
import Tile from './components/Tile';
import Button from './components/Button';
import Modal from './components/Modal';
import StrikeIndicator from './components/StrikeIndicator';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(() => getInitialGameState());
  const [currentScreen, setCurrentScreen] = useState<GameScreenState>(GameScreenState.START);
  const [playerNameInput, setPlayerNameInput] = useState<string>("");

  const [isCharmModalOpen, setIsCharmModalOpen] = useState<boolean>(false);
  const [availableCharmsForSelection, setAvailableCharmsForSelection] = useState<Charm[]>([]);
  
  const [isBrainstormChoiceModalOpen, setIsBrainstormChoiceModalOpen] = useState<boolean>(false);
  const [availableBrainstormsForSelection, setAvailableBrainstormsForSelection] = useState<BrainstormAction[]>([]);
  const [isBrainstormActivationModalOpen, setIsBrainstormActivationModalOpen] = useState<boolean>(false);

  const [isEndGameModalOpen, setIsEndGameModalOpen] = useState<boolean>(false);
  const [endGameReason, setEndGameReason] = useState<string>("");
  
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareImage, setShareImage] = useState<string | null>(null);
  const [shareFallbackTextVisible, setShareFallbackTextVisible] = useState(false);

  const roundTimerRef = useRef<number | null>(null);
  const gameStateRef = useRef(gameState);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  function getInitialGameState(playerName: string = "Player"): GameState {
    const config = { ...DEFAULT_GAME_CONFIG };
    return {
      score: 0,
      shufflesLeft: config.INITIAL_SHUFFLES,
      strikes: 0,
      hintsLeft: config.INITIAL_HINTS,
      playerHand: [],
      wordSlots: Array(config.WORD_SLOTS_COUNT).fill(null),
      playerName: playerName,
      bestWord: '',
      selectedTileId: null,
      timeLeft: config.ROUND_TIME_SECONDS,
      wordsSubmitted: 0,
      activeCharms: [],
      hasBrainstormCharge: false,
      heldBrainstorm: null,
      milestonesAchieved: [],
      letterValues: { ...INITIAL_LETTER_VALUES },
      gameConfig: config,
      isTimerActive: false,
      currentMessage: null,
      polishedLetters: [],
      anticipatedScore: 0,
      wordsSubmittedSinceLastCharm: 0,
      nextCharmOfferThreshold: config.WORDS_FOR_CHARM,
    };
  }
   
  const showMessage = useCallback((text: string, type: MessageType, definition?: string, duration: number = 3000) => {
    setGameState(prev => ({ ...prev, currentMessage: { text, type, definition } }));
    if (duration > 0) {
        setTimeout(() => {
            setGameState(prev => {
                // Only clear the message if it's the same one that was set
                if (prev.currentMessage && prev.currentMessage.text === text && prev.currentMessage.type === type) {
                    return { ...prev, currentMessage: null };
                }
                return prev;
            });
        }, duration);
    }
  }, []);

  const createRandomTile = useCallback((currentLetterValues: LetterValues, config: GameConfig): TileData => {
    const letter = LETTER_FREQUENCIES[Math.floor(Math.random() * LETTER_FREQUENCIES.length)];
    return {
      id: `tile-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      letter,
      value: currentLetterValues[letter] || 1,
      isDouble: Math.random() < config.DOUBLE_SCORE_CHANCE,
    };
  }, []);

  const createRandomVowelTile = useCallback((currentLetterValues: LetterValues, config: GameConfig): TileData => {
    const letter = VOWELS[Math.floor(Math.random() * VOWELS.length)];
     return {
      id: `tile-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      letter,
      value: currentLetterValues[letter] || 1,
      isDouble: Math.random() < config.DOUBLE_SCORE_CHANCE,
    };
  }, []);

  const ensureVowelsInHand = useCallback((hand: TileData[], currentLetterValues: LetterValues, config: GameConfig) => {
    const vowelCount = hand.filter(tile => VOWELS.includes(tile.letter)).length;
    // Ensure at least 2 vowels if hand is half full or more, or if TILE_COUNT is small
    if (vowelCount < 2 && hand.length >= Math.min(2, Math.floor(config.TILE_COUNT / 2))) { 
        let replaced = 0;
        const targetVowels = Math.max(1, Math.min(2, Math.floor(config.TILE_COUNT / 4))); // Aim for 1 or 2 vowels depending on hand size
        for (let i = 0; i < hand.length && replaced < (targetVowels - vowelCount); i++) {
            if (!VOWELS.includes(hand[i].letter)) {
                hand[i] = createRandomVowelTile(currentLetterValues, config);
                replaced++;
            }
        }
    } else if (vowelCount === 0 && hand.length > 0) { // Ensure at least one vowel if hand is not empty
        // Try to replace a consonant if possible, otherwise the first tile
        let replaced = false;
        for(let i=0; i < hand.length; i++) {
            if(!VOWELS.includes(hand[i].letter)) {
                hand[i] = createRandomVowelTile(currentLetterValues, config);
                replaced = true;
                break;
            }
        }
        if(!replaced) hand[0] = createRandomVowelTile(currentLetterValues, config); 
    }
  }, [createRandomVowelTile]);

  const stopRoundTimer = useCallback(() => {
    if (roundTimerRef.current) {
      clearInterval(roundTimerRef.current);
      roundTimerRef.current = null;
    }
     setGameState(prev => ({ ...prev, isTimerActive: false }));
  }, []);
  
  const startRoundTimer = useCallback(() => {
    stopRoundTimer(); 
    setGameState(prev => ({ ...prev, isTimerActive: true, timeLeft: prev.timeLeft > 0 ? prev.timeLeft : prev.gameConfig.ROUND_TIME_SECONDS })); 
    roundTimerRef.current = setInterval(() => {
      setGameState(prev => {
        if (!prev.isTimerActive) { 
          // If timer was externally stopped (e.g. modal opening)
          if (roundTimerRef.current) clearInterval(roundTimerRef.current);
          return prev;
        }
        if (prev.timeLeft <= 1) {
          if (roundTimerRef.current) clearInterval(roundTimerRef.current);
          // Actual time up handling is in useEffect to avoid race conditions with modals
          return { ...prev, timeLeft: 0, isTimerActive: false };
        }
        return { ...prev, timeLeft: prev.timeLeft - 1 };
      });
    }, 1000) as unknown as number; 
  }, [stopRoundTimer]);

  const handleEndGame = useCallback((reason: string = "Game ended by player.") => {
    stopRoundTimer();
    setGameState(prev => ({...prev, isTimerActive: false})); 
    setEndGameReason(reason);
    setIsEndGameModalOpen(true);
    setCurrentScreen(GameScreenState.GAME_OVER);
  }, [stopRoundTimer]);
  
  const offerCharms = useCallback(() => {
    stopRoundTimer(); 
    const currentActiveCharmIds = gameStateRef.current.activeCharms.map(c => c.id);
    const charmsToOffer = AVAILABLE_CHARMS
      .filter(charm => !currentActiveCharmIds.includes(charm.id)) 
      .sort(() => 0.5 - Math.random()) 
      .slice(0, 3); 
    
    if (charmsToOffer.length > 0) {
      setAvailableCharmsForSelection(charmsToOffer);
      setIsCharmModalOpen(true);
    } else {
       // If no charms to offer, reset sequence and start timer
       setGameState(prev => ({
           ...prev,
           wordsSubmittedSinceLastCharm: 0,
           nextCharmOfferThreshold: prev.nextCharmOfferThreshold + prev.gameConfig.WORDS_FOR_CHARM,
           timeLeft: prev.gameConfig.ROUND_TIME_SECONDS
       }));
       startRoundTimer(); 
    }
  }, [stopRoundTimer, startRoundTimer]);


  const resolveCharmOfferWithoutSelection = useCallback(() => {
    setIsCharmModalOpen(false);
    setGameState(prev => ({
        ...prev,
        wordsSubmittedSinceLastCharm: 0,
        nextCharmOfferThreshold: prev.nextCharmOfferThreshold + prev.gameConfig.WORDS_FOR_CHARM,
        timeLeft: prev.gameConfig.ROUND_TIME_SECONDS,
    }));
    startRoundTimer();
  }, [startRoundTimer]);

  const handleSelectCharm = (charm: Charm) => {
    setGameState(prev => {
      let newState = { ...prev, activeCharms: [...prev.activeCharms, charm] };
      if (charm.apply) { 
          newState = charm.apply(newState); // Apply can modify letterValues or other game state
      }
      showMessage(`${charm.name} charm activated!`, MessageType.SUCCESS);
      return { 
          ...newState, 
          timeLeft: prev.gameConfig.ROUND_TIME_SECONDS, // Reset timer after charm selection
          wordsSubmittedSinceLastCharm: 0, 
          nextCharmOfferThreshold: prev.nextCharmOfferThreshold + prev.gameConfig.WORDS_FOR_CHARM,
      };
    });
    setIsCharmModalOpen(false);
    startRoundTimer();
  };

  const startGame = () => {
    if (playerNameInput.trim() === "") return;
    const newGameState = getInitialGameState(playerNameInput.trim());
    const initialHand = Array.from({ length: newGameState.gameConfig.TILE_COUNT }, () => createRandomTile(newGameState.letterValues, newGameState.gameConfig));
    ensureVowelsInHand(initialHand, newGameState.letterValues, newGameState.gameConfig);
    
    setGameState({
      ...newGameState,
      playerHand: initialHand,
    });
    setCurrentScreen(GameScreenState.PLAYING);
    startRoundTimer();
  };
  
  const playAgain = () => {
    setIsEndGameModalOpen(false);
    setPlayerNameInput(gameStateRef.current.playerName); 
    setCurrentScreen(GameScreenState.START);
    // GameState will be reset by `startGame` or if they change name and click start
  };

  const checkAndApplyMilestones = useCallback((currentScore: number, currentState: GameState): { newState: GameState, milestoneMessage: string | null } => {
    let milestoneMessageAccumulator = "";
    let stateChangedByMilestone = false;
    let tempNewState = { ...currentState }; // Work on a copy of the passed current state

    MILESTONES_LIST.forEach(milestone => {
      if (currentScore >= milestone.scoreThreshold && !tempNewState.milestonesAchieved.includes(milestone.id)) {
        tempNewState = milestone.apply(tempNewState); 
        tempNewState.milestonesAchieved = [...tempNewState.milestonesAchieved, milestone.id];
        milestoneMessageAccumulator += `${milestone.name} ${milestone.description} `;
        stateChangedByMilestone = true;
      }
    });

    return { 
        newState: tempNewState, 
        milestoneMessage: stateChangedByMilestone ? milestoneMessageAccumulator.trim() : null 
    };
  }, []);


  const calculateAnticipatedScore = useCallback((
    currentWordSlots: WordSlot[],
    currentLetterValues: LetterValues,
    currentActiveCharms: Charm[],
    currentPolishedLetters: string[]
  ): number => {
      const placedTiles = currentWordSlots.filter(Boolean) as TileData[];
      if (placedTiles.length === 0) return 0;

      let baseScore = 0;
      let wordMultiplier = 1;
      const sIsWildActive = currentActiveCharms.some(c => c.id === 's-tier');
      const finisherActive = currentActiveCharms.some(c => c.id === 'finisher');
      // Recycler charm doesn't affect anticipated score, only post-submission.

      currentPolishedLetters.forEach(polishedLetter => {
          if (placedTiles.some(tile => tile.letter === polishedLetter)) {
              wordMultiplier *= 2;
          }
      });

      placedTiles.forEach((tile, index) => {
          let tileValue = currentLetterValues[tile.letter] || 1;
          const originalSlotIndex = currentWordSlots.findIndex(slot => slot?.id === tile.id);
          
          if (originalSlotIndex === SPECIAL_SLOT_INDEX) tileValue *= 2;
          if (finisherActive && index === placedTiles.length - 1) tileValue *= 3;
          // Vowel Lover charm is reflected in currentLetterValues directly.
          if (sIsWildActive && tile.letter === 'S') tileValue = 10; // S-Tier specific value
          
          baseScore += tileValue;
          
          if (tile.isDouble) {
              wordMultiplier *= 2; 
          }
          if (sIsWildActive && tile.letter === 'S') wordMultiplier *= 2; // S-Tier multiplier part
      });
      
      let lengthBonus = 0;
      if (placedTiles.length >= 2) { // Minimum word length for bonus
        // Original: [0,0,0,5,10,15,25,40] for length 3,4,5,6,7,8 tiles
        // Adjusting for 0-indexed: index 2 (length 3) = 5 points
        const bonuses = [0, 0, 5, 10, 15, 25, 40, 50]; // Length 1, 2, 3, 4, 5, 6, 7, 8
        lengthBonus = bonuses[placedTiles.length-1] || (placedTiles.length >=8 ? 50 : 0) ;
      }
      
      const finalScore = (baseScore * wordMultiplier) + lengthBonus;
      return finalScore;
  }, []);

  useEffect(() => {
    setGameState(prev => {
        const newAnticipatedScore = calculateAnticipatedScore(
            prev.wordSlots,
            prev.letterValues,
            prev.activeCharms,
            prev.polishedLetters
        );
        if (newAnticipatedScore !== prev.anticipatedScore) {
            return { ...prev, anticipatedScore: newAnticipatedScore };
        }
        return prev; // No change if score is the same
    });
  }, [gameState.wordSlots, gameState.letterValues, gameState.activeCharms, gameState.polishedLetters, calculateAnticipatedScore]);


  const handleTileClick = (tile: TileData) => {
    setGameState(prev => {
      // Prevent interaction if brainstorm activation modal is open and needs tile selection
      if (isBrainstormActivationModalOpen && prev.heldBrainstorm?.needsInteraction) return prev; 

      const slotIndex = prev.wordSlots.findIndex(s => s?.id === tile.id);
      if (slotIndex !== -1) { // Tile is in a word slot, return it to hand
        const newWordSlots = [...prev.wordSlots];
        newWordSlots[slotIndex] = null;
        return { ...prev, wordSlots: newWordSlots, playerHand: [...prev.playerHand, tile], selectedTileId: null };
      }
      
      // Tile is in hand
      if (prev.selectedTileId === tile.id) { // Deselect if already selected
        return { ...prev, selectedTileId: null };
      }
      return { ...prev, selectedTileId: tile.id }; // Select the tile
    });
  };

  const handleWordSlotClick = (index: number) => {
     if (isBrainstormActivationModalOpen) return; // Prevent interaction if brainstorm activation modal is open
    setGameState(prev => {
      if (!prev.selectedTileId) return prev; // No tile selected to move
      const tileToMove = prev.playerHand.find(t => t.id === prev.selectedTileId);
      if (!tileToMove) return prev; // Selected tile not found in hand (should not happen)
      if (prev.wordSlots[index]) return prev; // Slot is already occupied

      const newPlayerHand = prev.playerHand.filter(t => t.id !== prev.selectedTileId);
      const newWordSlots = [...prev.wordSlots];
      newWordSlots[index] = tileToMove;

      return { ...prev, playerHand: newPlayerHand, wordSlots: newWordSlots, selectedTileId: null };
    });
  };

  const handleClearWord = useCallback(() => {
    setGameState(prev => {
      const tilesFromSlots = prev.wordSlots.filter(Boolean) as TileData[];
      return {
        ...prev,
        playerHand: [...prev.playerHand, ...tilesFromSlots],
        wordSlots: Array(prev.gameConfig.WORD_SLOTS_COUNT).fill(null),
        selectedTileId: null,
        // Preserve loading message if one is active, otherwise clear
        currentMessage: prev.currentMessage?.type === MessageType.LOADING ? prev.currentMessage : null,
      };
    });
  }, []);
  
  const handleSubmitWord = useCallback(async () => {
    stopRoundTimer(); 
    
    const initialSubmitState = { ...gameStateRef.current }; // Capture state at the beginning of submit
    const placedTiles = initialSubmitState.wordSlots.filter(Boolean) as TileData[];

    if (placedTiles.length < 2) {
      showMessage('Word must be 2+ letters.', MessageType.ERROR);
      startRoundTimer();
      return;
    }
    const word = placedTiles.map(t => t.letter).join('');
    showMessage(`Checking '${word}'...`, MessageType.LOADING, undefined, 0); // Indefinite loading message

    try {
      const apiData = await validateWordWithApi(word);
      // Recalculate score based on initialSubmitState for charms, letterValues etc.
      let baseScore = 0;
      let wordMultiplier = 1; 
      const sIsWildActive = initialSubmitState.activeCharms.some(c => c.id === 's-tier');
      const finisherActive = initialSubmitState.activeCharms.some(c => c.id === 'finisher');
      const recyclerActive = initialSubmitState.activeCharms.some(c => c.id === 'recycler');

      initialSubmitState.polishedLetters.forEach(polishedLetter => {
          if (placedTiles.some(tile => tile.letter === polishedLetter)) {
              wordMultiplier *= 2;
          }
      });

      const processedTiles = placedTiles.map((tile, index) => {
        let tileValue = initialSubmitState.letterValues[tile.letter] || 1; 
        const originalSlotIndex = initialSubmitState.wordSlots.findIndex(slot => slot?.id === tile.id);
        if (originalSlotIndex === SPECIAL_SLOT_INDEX) tileValue *= 2; 

        if (finisherActive && index === placedTiles.length - 1) tileValue *= 3;
        if (sIsWildActive && tile.letter === 'S') tileValue = 10; 
        
        baseScore += tileValue;
        
        let isRecycled = false;
        if (tile.isDouble) { 
          if (recyclerActive && Math.random() < 0.5) isRecycled = true;
          else wordMultiplier *= 2;
        }
        if (sIsWildActive && tile.letter === 'S') wordMultiplier *= 2; 
        return {...tile, isRecycled};
      });

      const bonuses = [0, 0, 5, 10, 15, 25, 40, 50]; 
      const lengthBonus = bonuses[placedTiles.length-1] || (placedTiles.length >=8 ? 50 : 0) ;
      const finalScore = (baseScore * wordMultiplier) + lengthBonus;
      
      const newScore = initialSubmitState.score + finalScore;
      const newBestWord = apiData[0].word.length > initialSubmitState.bestWord.length ? apiData[0].word : initialSubmitState.bestWord;
      
      const kidDefinition = await getKidFriendlyDefinition(apiData[0].word, apiData[0].meanings[0]?.definitions[0]?.definition || 'A very good word!');
      showMessage(`+${finalScore} points for ${word.toUpperCase()}!`, MessageType.SUCCESS, kidDefinition, 5000);

      // Apply milestones based on the newScore and the state *before* this word's direct consequences
      const { newState: stateAfterMilestones, milestoneMessage } = checkAndApplyMilestones(newScore, initialSubmitState);
      if (milestoneMessage) {
        setTimeout(() => showMessage(milestoneMessage, MessageType.SUCCESS, undefined, 6000), 100); 
      }
      
      const allTilesUsedBonusActivated = initialSubmitState.playerHand.length === 0 && placedTiles.length > 0;

      const configAfterMilestones = stateAfterMilestones.gameConfig;
      const letterValuesForNewTiles = stateAfterMilestones.letterValues;
      
      let newHand;
      const recycledTilesFromSlots = processedTiles.filter(t => t.isRecycled);
      
      if (allTilesUsedBonusActivated) {
        newHand = Array.from({ length: configAfterMilestones.TILE_COUNT }, () => createRandomTile(letterValuesForNewTiles, configAfterMilestones));
      } else {
        // initialSubmitState.playerHand are tiles *not* used in the current wordSlots
        newHand = [...initialSubmitState.playerHand, ...recycledTilesFromSlots]; 
        
        let tilesToReplenish = Math.ceil((placedTiles.length - recycledTilesFromSlots.length) / configAfterMilestones.REPLENISH_DIVISOR);
        const neededToReachMin = Math.max(0, 4 - newHand.length); 
        if (tilesToReplenish < neededToReachMin) {
            tilesToReplenish = neededToReachMin;
        }

        for (let i = 0; i < tilesToReplenish; i++) {
          if (newHand.length < configAfterMilestones.TILE_COUNT) { 
            newHand.push(createRandomTile(letterValuesForNewTiles, configAfterMilestones));
          }
        }
      }
      ensureVowelsInHand(newHand, letterValuesForNewTiles, configAfterMilestones);
      
      let newHasBrainstormCharge = stateAfterMilestones.hasBrainstormCharge;
      if (!newHasBrainstormCharge && !stateAfterMilestones.heldBrainstorm && finalScore >= configAfterMilestones.POINTS_FOR_BRAINSTORM) {
          newHasBrainstormCharge = true;
          setTimeout(() => showMessage(`⚡ Brainstorm Charge Earned! Click the Brainstorm button to choose one.`, MessageType.INFO, undefined, 4000) , 1000);
      }

      setGameState(currentGlobalState => ({
        ...stateAfterMilestones, // Base: includes updated gameConfig, letterValues, milestonesAchieved etc. from milestone processing
        score: newScore, 
        bestWord: newBestWord,
        wordSlots: Array(configAfterMilestones.WORD_SLOTS_COUNT).fill(null),
        playerHand: newHand.slice(0, configAfterMilestones.TILE_COUNT), 
        wordsSubmitted: initialSubmitState.wordsSubmitted + 1, 
        wordsSubmittedSinceLastCharm: initialSubmitState.wordsSubmittedSinceLastCharm + 1,
        timeLeft: configAfterMilestones.ROUND_TIME_SECONDS, 
        hasBrainstormCharge: newHasBrainstormCharge,
        // currentMessage is managed by showMessage calls and should not be directly reset here unless intended
        currentMessage: currentGlobalState.currentMessage, // Preserve message from showMessage calls if any
      }));
      
      if (allTilesUsedBonusActivated) {
        setTimeout(() => showMessage("All Tiles Used! Hand Refresh Bonus!", MessageType.SUCCESS, undefined, 4000), 100);
      }

      setTimeout(() => {
        const latestState = gameStateRef.current; 
        let shouldStartTimer = true;
        let charmOfferedThisTurn = false;

        if (latestState.wordsSubmittedSinceLastCharm >= latestState.nextCharmOfferThreshold) {
          offerCharms(); 
          shouldStartTimer = false; 
          charmOfferedThisTurn = true;
        }
  
        if (!charmOfferedThisTurn) { 
            if (latestState.playerHand.length < 4 && latestState.shufflesLeft === 0) {
               handleEndGame("You've run out of tiles and shuffles!");
               shouldStartTimer = false;
            }
            if (shouldStartTimer) {
                startRoundTimer();
            }
        }
      }, 150); 


    } catch (error: any) {
      showMessage(error.message || `'${word}' is not a valid word. Try again.`, MessageType.ERROR);
      setGameState(prev => {
        const newStrikes = prev.strikes + 1;
        const tilesFromSlotsToReturn = initialSubmitState.wordSlots.filter(Boolean) as TileData[]; 
        const updatedHand = [...initialSubmitState.playerHand, ...tilesFromSlotsToReturn].slice(0, prev.gameConfig.TILE_COUNT); 

        if (newStrikes >= prev.gameConfig.MAX_STRIKES) {
          return { ...prev, strikes: newStrikes, playerHand: updatedHand, wordSlots:Array(prev.gameConfig.WORD_SLOTS_COUNT).fill(null), selectedTileId: null, isTimerActive: false };
        }
        
        return {
          ...prev,
          strikes: newStrikes,
          wordSlots: Array(prev.gameConfig.WORD_SLOTS_COUNT).fill(null),
          playerHand: updatedHand,
          selectedTileId: null,
          timeLeft: prev.gameConfig.ROUND_TIME_SECONDS, 
        };
      });
      if(gameStateRef.current.strikes < gameStateRef.current.gameConfig.MAX_STRIKES) {
        startRoundTimer(); 
      }
    }
  }, [showMessage, createRandomTile, ensureVowelsInHand, offerCharms, startRoundTimer, handleEndGame, stopRoundTimer, checkAndApplyMilestones, validateWordWithApi, getKidFriendlyDefinition]);

  const handleShuffleTiles = useCallback((isAutomatic = false) => {
    stopRoundTimer();
    setGameState(prev => {
      if (!isAutomatic) {
        if (prev.shufflesLeft <= 0) { startRoundTimer(); return prev; } 
      }
      
      const newHand = Array.from({ length: prev.gameConfig.TILE_COUNT }, () => createRandomTile(prev.letterValues, prev.gameConfig));
      ensureVowelsInHand(newHand, prev.letterValues, prev.gameConfig);

      return {
        ...prev,
        shufflesLeft: isAutomatic ? prev.shufflesLeft : prev.shufflesLeft - 1,
        playerHand: newHand,
        wordSlots: Array(prev.gameConfig.WORD_SLOTS_COUNT).fill(null), 
        selectedTileId: null,
        timeLeft: prev.gameConfig.ROUND_TIME_SECONDS, 
      };
    });
    startRoundTimer();
  }, [createRandomTile, ensureVowelsInHand, startRoundTimer, stopRoundTimer]);

  const handleHint = useCallback(async () => {
    if (gameStateRef.current.hintsLeft <= 0 || gameStateRef.current.currentMessage?.type === MessageType.LOADING) return;
    stopRoundTimer();
    setGameState(prev => ({ ...prev, hintsLeft: prev.hintsLeft - 1 }));
    showMessage("✨ Asking AI for a hint...", MessageType.LOADING, undefined, 0); 

    const lettersInHand = gameStateRef.current.playerHand.map(t => t.letter).join("");
    try {
      const hintedWord = await getAIHint(lettersInHand);
      if (hintedWord) {
        showMessage(`Hint: Try spelling "${hintedWord.toUpperCase()}"`, MessageType.SUCCESS, undefined, 5000);
      } else {
        throw new Error("AI could not find a suitable word."); 
      }
    } catch (error) {
      showMessage("Could not get a hint. Try again!", MessageType.ERROR);
      setGameState(prev => ({ ...prev, hintsLeft: prev.hintsLeft + 1 })); 
    } finally {
      startRoundTimer();
    }
  }, [showMessage, startRoundTimer, stopRoundTimer, getAIHint]);


  // Effect for game over conditions (time up, max strikes)
  useEffect(() => {
    const currentGs = gameStateRef.current;
    if (currentScreen === GameScreenState.PLAYING) {
        if (!currentGs.isTimerActive && currentGs.timeLeft <= 0 && !isEndGameModalOpen && !isCharmModalOpen && !isBrainstormChoiceModalOpen && !isBrainstormActivationModalOpen) {
            handleEndGame("Time's up!");
        } else if (currentGs.strikes >= currentGs.gameConfig.MAX_STRIKES && !isEndGameModalOpen) {
            handleEndGame("You ran out of strikes!");
        }
    }
  }, [gameState.isTimerActive, gameState.timeLeft, gameState.strikes, gameState.gameConfig.MAX_STRIKES, currentScreen, handleEndGame, isEndGameModalOpen, isCharmModalOpen, isBrainstormChoiceModalOpen, isBrainstormActivationModalOpen]);
  
  const openBrainstormChoiceModal = () => {
    stopRoundTimer();
    const uniqueBrainstorms = [...AVAILABLE_BRAINSTORM_ACTIONS]; 
    const selection = [];
    // Ensure we don't try to pick more than available
    const numToOffer = Math.min(3, uniqueBrainstorms.length); 
    for (let i = 0; i < numToOffer; i++) {
        const randomIndex = Math.floor(Math.random() * uniqueBrainstorms.length);
        selection.push(uniqueBrainstorms.splice(randomIndex, 1)[0]);
    }
    setAvailableBrainstormsForSelection(selection);
    setIsBrainstormChoiceModalOpen(true);
  };

  const handleBrainstormSelectedFromChoice = (selectedAction: BrainstormAction) => {
    setGameState(prev => ({
        ...prev,
        heldBrainstorm: selectedAction,
        hasBrainstormCharge: false,
    }));
    setIsBrainstormChoiceModalOpen(false);
    showMessage(`${selectedAction.name} selected! Click the Brainstorm button to activate it.`, MessageType.INFO, undefined, 4000);
    startRoundTimer();
  };

  const handleCancelBrainstormChoice = () => {
    setIsBrainstormChoiceModalOpen(false);
    startRoundTimer(); 
  };
  
  const openBrainstormActivationModal = () => {
    if (!gameStateRef.current.heldBrainstorm || gameStateRef.current.currentMessage?.type === MessageType.LOADING) return;
    stopRoundTimer();
    setIsBrainstormActivationModalOpen(true);
  };

  const handleConfirmBrainstormActivation = (tileForInteraction?: TileData) => {
    const currentHeldBrainstorm = gameStateRef.current.heldBrainstorm; 
    if (!currentHeldBrainstorm) return;
    
    setGameState(prev => {
        let newState = {...prev};
        if (currentHeldBrainstorm.id === 'upgrade' && tileForInteraction) {
            const newLetterValues = { ...prev.letterValues };
            newLetterValues[tileForInteraction.letter] = (INITIAL_LETTER_VALUES[tileForInteraction.letter] || 1) * 3;
            newState = {...newState, letterValues: newLetterValues};
            showMessage(`Letter Upgrade! All ${tileForInteraction.letter}'s are now worth triple points!`, MessageType.SUCCESS);
        } else if (currentHeldBrainstorm.id === 'polish' && tileForInteraction) {
            const newPolishedLetters = Array.from(new Set([...prev.polishedLetters, tileForInteraction.letter]));
            newState = {...newState, polishedLetters: newPolishedLetters};
            showMessage(`Polished! Tiles with letter ${tileForInteraction.letter} now grant a 2x Word Score multiplier!`, MessageType.SUCCESS);
        } else if (currentHeldBrainstorm.id === 'vowel-infusion') {
            const consonants = prev.playerHand.filter(t => !VOWELS.includes(t.letter));
            const vowelsInHand = prev.playerHand.filter(t => VOWELS.includes(t.letter));
            const consonantsToKeep = consonants.sort(() => 0.5 - Math.random()).slice(0, 2); // Keep up to 2 random consonants
            
            let newHandComposition = [...vowelsInHand, ...consonantsToKeep];
            const neededVowels = prev.gameConfig.TILE_COUNT - newHandComposition.length;

            for(let i=0; i < neededVowels; i++) {
                newHandComposition.push(createRandomVowelTile(prev.letterValues, prev.gameConfig));
            }
            
            newState = {...newState, playerHand: newHandComposition.slice(0, prev.gameConfig.TILE_COUNT) }; // Ensure correct length
            ensureVowelsInHand(newState.playerHand, newState.letterValues, newState.gameConfig); 
            showMessage("Vowel Infusion activated! Hand refreshed with vowels.", MessageType.SUCCESS);
        } else if (currentHeldBrainstorm.id === 'time-pause') { 
            newState = {...newState, timeLeft: prev.timeLeft + 15};
            showMessage("Time Boost! +15 seconds added.", MessageType.SUCCESS);
        }
        return {...newState, heldBrainstorm: null }; // Consume brainstorm
    });

    setIsBrainstormActivationModalOpen(false);
    startRoundTimer();
  };

  const handleCancelBrainstormActivation = () => {
    setIsBrainstormActivationModalOpen(false);
    startRoundTimer(); 
  };
  
  const handleMasterBrainstormClick = () => {
    if (gameStateRef.current.hasBrainstormCharge && !gameStateRef.current.heldBrainstorm) {
        openBrainstormChoiceModal();
    } else if (gameStateRef.current.heldBrainstorm) {
        openBrainstormActivationModal();
    }
  };

  const brainstormButtonText = useMemo(() => {
    if (gameState.hasBrainstormCharge && !gameState.heldBrainstorm) return "⚡ Choose Brainstorm";
    if (gameState.heldBrainstorm) return `⚡ ${gameState.heldBrainstorm.name}`;
    return "⚡ Brainstorm";
  }, [gameState.hasBrainstormCharge, gameState.heldBrainstorm]);

  const generateShareImage = async () => {
    setShareImage(null); 
    setShareFallbackTextVisible(false);
    const canvas = document.createElement('canvas');
    canvas.width = 350;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');

    if (ctx) {
        const gs = gameStateRef.current; 
        // Background Gradient
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, '#7dd3fc'); // light sky blue
        gradient.addColorStop(1, '#0ea5e9'); // darker sky blue
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Border
        ctx.strokeStyle = '#f0f9ff'; // very light blue, almost white
        ctx.lineWidth = 8;
        ctx.strokeRect(0, 0, canvas.width, canvas.height);

        // Title
        ctx.font = 'bold 28px Nunito, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText('Word Builder Bonanza!', canvas.width / 2, 45);

        // Player Name
        ctx.font = 'bold 20px Nunito, sans-serif';
        ctx.fillStyle = '#f0f9ff'; // Slightly off-white for contrast
        ctx.fillText(gs.playerName, canvas.width / 2, 80);

        // Score Label
        ctx.font = '18px Nunito, sans-serif';
        ctx.fillStyle = '#f0f9ff';
        ctx.fillText('Final Score:', canvas.width / 2, 115);

        // Score Value
        ctx.font = 'bold 48px Nunito, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(String(gs.score), canvas.width / 2, 165);
        
        // Footer credit
        ctx.font = '10px Nunito, sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fillText('Played on Gemini Apps', canvas.width / 2, canvas.height - 10);

        const dataUrl = canvas.toDataURL('image/png');
        setShareImage(dataUrl);

        if (navigator.share) {
            try {
                // Convert data URL to blob for sharing
                const blob = await (await fetch(dataUrl)).blob();
                const file = new File([blob], "score-card.png", { type: "image/png" });
                await navigator.share({
                    title: 'My Word Builder Score!',
                    text: `I scored ${gs.score} in Word Builder Bonanza! Player: ${gs.playerName}`,
                    files: [file],
                });
            } catch (error) {
                console.error('Error sharing:', error);
                setShareFallbackTextVisible(true); // Show fallback if sharing fails
            }
        } else {
           setShareFallbackTextVisible(true); // Show fallback if Web Share API not supported
        }
    }
    setIsShareModalOpen(true);
  };

  const MemoizedTile = React.memo(Tile);

  const renderPlayerHand = () => (
    <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5 sm:gap-2 justify-center min-h-[50px] p-2 bg-sky-200/50 rounded-lg">
      {gameState.playerHand.map(tile => (
        <MemoizedTile
          key={tile.id}
          tile={tile}
          isSelected={gameState.selectedTileId === tile.id && !(isBrainstormActivationModalOpen && gameState.heldBrainstorm?.needsInteraction)}
          onClick={!(isBrainstormActivationModalOpen && gameState.heldBrainstorm?.needsInteraction) ? handleTileClick : undefined}
          letterValues={gameState.letterValues}
        />
      ))}
      {gameState.playerHand.length < gameState.gameConfig.TILE_COUNT && Array.from({ length: gameState.gameConfig.TILE_COUNT - gameState.playerHand.length }).map((_, i) => (
          <div key={`empty-${i}`} className="w-10 h-10 sm:w-12 sm:h-12 rounded-md bg-black/5 shadow-inner"></div>
      ))}
    </div>
  );

  const renderWordSlots = () => (
    <div className={`grid grid-cols-${Math.max(6,gameState.gameConfig.WORD_SLOTS_COUNT)} gap-1 sm:gap-1.5 justify-center p-2 sm:p-2 bg-gray-200/50 rounded-lg`}>
      {gameState.wordSlots.map((slotItem, index) => (
        <div
          key={index}
          className={`
            word-slot w-10 h-10 sm:w-12 sm:h-12 flex justify-center items-center rounded-md border-2 relative
            ${index === SPECIAL_SLOT_INDEX ? 'border-purple-500 bg-purple-100/70' : 'border-gray-400'}
            ${slotItem ? 'border-solid p-0' : 'border-dashed hover:bg-gray-300/50 cursor-pointer'}
          `}
          onClick={() => handleWordSlotClick(index)}
          aria-label={slotItem ? `Slot ${index+1} with tile ${slotItem.letter}` : `Empty slot ${index+1}${index === SPECIAL_SLOT_INDEX ? ', 2x letter score' : ''}`}
        >
          {index === SPECIAL_SLOT_INDEX && !slotItem && (
            <span className="absolute top-0.5 right-0.5 text-[0.6rem] font-bold text-purple-600 bg-purple-200 px-1 rounded-sm">2x</span>
          )}
          {slotItem && (
            <MemoizedTile 
                tile={slotItem} 
                isSelected={false} // Tiles in slots are never "selected" in the same way as hand tiles
                onClick={() => handleTileClick(slotItem)} // Clicking a tile in slot returns it to hand
                letterValues={gameState.letterValues} />
          )}
        </div>
      ))}
    </div>
  );

  const messageBoxStyles = useMemo(() => {
    if (!gameState.currentMessage) return "opacity-0 -translate-y-5 pointer-events-none";
    let bgColor = "bg-sky-100 border-sky-400";
    let textColor = "text-sky-700";
    if (gameState.currentMessage.type === MessageType.SUCCESS) {
      bgColor = "bg-green-100 border-green-400";
      textColor = "text-green-700";
    } else if (gameState.currentMessage.type === MessageType.ERROR) {
      bgColor = "bg-red-100 border-red-400";
      textColor = "text-red-700";
    } else if (gameState.currentMessage.type === MessageType.LOADING) {
      bgColor = "bg-amber-100 border-amber-400";
      textColor = "text-amber-700";
    }
    return `opacity-100 translate-y-0 pointer-events-auto ${bgColor} ${textColor}`;
  }, [gameState.currentMessage]);

  const StartScreen = (
    <div className="w-full max-w-md mx-auto p-6 sm:p-8 bg-white/90 rounded-2xl shadow-xl text-center">
      <h1 className="text-4xl sm:text-5xl font-black text-sky-600 mb-4">Word Builder</h1>
      <p className="text-gray-600 mb-6 text-lg">Enter your name to start the challenge!</p>
      <input
        type="text"
        value={playerNameInput}
        onChange={(e) => setPlayerNameInput(e.target.value)}
        placeholder="Your Name"
        maxLength={15}
        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-center text-lg focus:border-sky-500 focus:ring-1 focus:ring-sky-500 mb-4 bg-white text-gray-900"
      />
      <Button onClick={startGame} disabled={playerNameInput.trim() === ""} fullWidth size="lg">
        Start Game
      </Button>
    </div>
  );

  const GameScreen = (
    <div className="w-full max-w-lg mx-auto p-3 sm:p-4 bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl flex flex-col gap-3">
      <header className="grid grid-cols-2 sm:grid-cols-4 items-center text-center gap-2">
        <div> <span className="text-xs sm:text-sm text-gray-500">SCORE</span> <p className="text-2xl sm:text-3xl font-black text-sky-600">{gameState.score}</p> </div>
        <div> <span className="text-xs sm:text-sm text-gray-500">HINTS ✨</span> <p className="text-2xl sm:text-3xl font-black text-purple-500">{gameState.hintsLeft}</p> </div>
        <div className="hidden sm:block"> <span className="text-xs sm:text-sm text-gray-500">SHUFFLES</span> <p className="text-2xl sm:text-3xl font-black text-amber-500">{gameState.shufflesLeft}</p> </div>
        <div> <span className="text-xs sm:text-sm text-gray-500">STRIKES</span> <StrikeIndicator currentStrikes={gameState.strikes} maxStrikes={gameState.gameConfig.MAX_STRIKES} /></div>
      </header>

      <div className="min-h-[48px] bg-gray-900/10 rounded-lg p-2 flex items-center justify-center gap-2 flex-wrap text-center">
        {gameState.activeCharms.length === 0 ? (
          <p className="text-xs text-gray-500">Submit {gameState.nextCharmOfferThreshold - gameState.wordsSubmittedSinceLastCharm} more word(s) to earn a Word Charm!</p>
        ) : (
          gameState.activeCharms.map(charm => (
            <div key={charm.id} title={charm.description} className="px-2.5 py-1 bg-sky-200 text-sky-800 text-xs font-bold rounded-full cursor-default shadow-sm">{charm.name}</div>
          ))
        )}
         {gameState.activeCharms.length > 0 && <p className="text-xs text-gray-500 w-full mt-1">Next charm in {gameState.nextCharmOfferThreshold - gameState.wordsSubmittedSinceLastCharm} word(s).</p>}
      </div>

      {/* Persistent Milestones Display */}
      <div className="min-h-[36px] bg-green-700/10 rounded-lg p-2 flex items-center justify-start gap-2 flex-wrap text-left">
        {gameState.milestonesAchieved.length === 0 ? (
          <p className="text-xs text-green-700 w-full text-center">Reach score milestones to unlock permanent perks!</p>
        ) : (
          <>
            <span className="text-xs font-semibold text-green-800 mr-1">Perks Unlocked:</span>
            {gameState.milestonesAchieved.map(milestoneId => {
              const milestone = MILESTONES_LIST.find(m => m.id === milestoneId);
              return milestone ? (
                <div 
                  key={milestone.id} 
                  title={milestone.description} 
                  className="px-2 py-0.5 bg-green-200 text-green-800 text-xs font-bold rounded-full cursor-default shadow-sm"
                >
                  {milestone.name.replace('!', '')}
                </div>
              ) : null;
            })}
          </>
        )}
      </div>


      <div className="relative w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
        <div 
          className="h-full bg-amber-500 transition-all duration-1000 linear" 
          style={{ width: `${(gameState.timeLeft / gameState.gameConfig.ROUND_TIME_SECONDS) * 100}%` }}
          role="progressbar"
          aria-valuenow={gameState.timeLeft}
          aria-valuemin={0}
          aria-valuemax={gameState.gameConfig.ROUND_TIME_SECONDS}
          aria-label={`Time left: ${gameState.timeLeft} seconds`}
        ></div>
      </div>

      <div className={`min-h-[60px] text-center p-2 mb-1 rounded-lg border-2 transition-all duration-300 ease-in-out ${messageBoxStyles}`}>
        <p className="font-semibold">{gameState.currentMessage?.text}</p>
        {gameState.currentMessage?.definition && <p className="text-sm text-gray-600 mt-1" dangerouslySetInnerHTML={{__html: gameState.currentMessage.definition}}></p>}
      </div>
      
      <div>
        <p className="text-xs text-center text-gray-500 mb-1">CREATE A WORD (Slot {SPECIAL_SLOT_INDEX + 1} = 2x letter score)</p>
        {renderWordSlots()}
        <p className="text-center text-md font-semibold text-green-600 mt-1.5">
            Potential Score: <span className="text-lg font-bold">{gameState.anticipatedScore > 0 ? gameState.anticipatedScore : '--'}</span>
        </p>
      </div>
      
      <div>
         <p className="text-xs text-center text-gray-500 mb-1">YOUR TILES ({gameState.playerHand.length}/{gameState.gameConfig.TILE_COUNT})</p>
        {renderPlayerHand()}
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Button onClick={handleSubmitWord} disabled={gameState.wordSlots.every(s => s === null) || gameState.wordSlots.filter(Boolean).length < 2 || !!gameState.currentMessage && gameState.currentMessage.type === MessageType.LOADING} variant="primary" size="md">Submit</Button>
        <Button 
            onClick={handleMasterBrainstormClick} 
            disabled={(!gameState.hasBrainstormCharge && !gameState.heldBrainstorm) || (!!gameState.currentMessage && gameState.currentMessage.type === MessageType.LOADING)} 
            variant="special" 
            size="md" 
            className={(gameState.hasBrainstormCharge || gameState.heldBrainstorm) ? "animate-pulse-lg" : ""}>
            {brainstormButtonText}
        </Button>
        <Button onClick={handleHint} disabled={gameState.hintsLeft <= 0 || !!gameState.currentMessage && gameState.currentMessage.type === MessageType.LOADING} variant="info" size="md">Hint ✨</Button>
        <Button onClick={() => handleShuffleTiles(false)} disabled={gameState.shufflesLeft <= 0 || !!gameState.currentMessage && gameState.currentMessage.type === MessageType.LOADING} variant="secondary" size="md" className="hidden sm:block">Shuffle</Button>
      </div>
      <div className="sm:hidden grid grid-cols-1 gap-2">
         <Button onClick={() => handleShuffleTiles(false)} disabled={gameState.shufflesLeft <= 0 || !!gameState.currentMessage && gameState.currentMessage.type === MessageType.LOADING} variant="secondary" size="md" fullWidth>Shuffle Tiles ({gameState.shufflesLeft})</Button>
      </div>

      <div className="mt-2 text-center">
        <button onClick={handleClearWord} className="text-sm text-sky-600 hover:text-sky-800 px-2">Clear Board</button>
        <span className="text-gray-400">|</span>
        <button onClick={() => handleEndGame()} className="text-sm text-red-500 hover:text-red-700 px-2">End Game</button>
      </div>
    </div>
  );

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-2 sm:p-4 bg-gradient-to-br from-sky-400 to-blue-600">
      {currentScreen === GameScreenState.START && StartScreen}
      {currentScreen === GameScreenState.PLAYING && GameScreen}
      
      <Modal isOpen={isCharmModalOpen} title="Choose a Word Charm!" onClose={resolveCharmOfferWithoutSelection}>
          <p className="text-center text-gray-600 mb-4">This is a permanent upgrade for this game.</p>
          <div className="grid grid-cols-1 gap-3 max-h-[60vh] overflow-y-auto charm-options-scrollbar">
              {availableCharmsForSelection.map(charm => (
                  <div key={charm.id} 
                       className="p-4 border rounded-lg hover:shadow-lg hover:border-sky-400 transition-all cursor-pointer bg-sky-50"
                       onClick={() => handleSelectCharm(charm)}>
                      <h3 className="font-bold text-sky-700 text-lg">{charm.name}</h3>
                      <p className="text-sm text-gray-600">{charm.description}</p>
                  </div>
              ))}
          </div>
           <Button onClick={resolveCharmOfferWithoutSelection} variant="secondary" size="sm" className="mt-4 mx-auto block">Skip Charm</Button>
      </Modal>

      <Modal isOpen={isBrainstormChoiceModalOpen} title="Choose Your Brainstorm!" onClose={handleCancelBrainstormChoice}>
          <p className="text-center text-gray-600 mb-4">Select one of these powerful one-time abilities.</p>
          <div className="grid grid-cols-1 gap-3 max-h-[60vh] overflow-y-auto charm-options-scrollbar">
              {availableBrainstormsForSelection.map(bsAction => (
                  <div key={bsAction.id} 
                       className="p-4 border rounded-lg hover:shadow-lg hover:border-indigo-400 transition-all cursor-pointer bg-indigo-50"
                       onClick={() => handleBrainstormSelectedFromChoice(bsAction)}>
                      <h3 className="font-bold text-indigo-700 text-lg">{bsAction.name}</h3>
                      <p className="text-sm text-gray-600">{bsAction.description}</p>
                  </div>
              ))}
          </div>
          <Button onClick={handleCancelBrainstormChoice} variant="secondary" size="sm" className="mt-4 mx-auto block">Decide Later</Button>
      </Modal>

      <Modal 
        isOpen={isBrainstormActivationModalOpen && !!gameState.heldBrainstorm} 
        title={gameState.heldBrainstorm?.name || "Activate Brainstorm"} 
        onClose={handleCancelBrainstormActivation}
        >
          <p className="text-gray-600 mb-2 text-center">{gameState.heldBrainstorm?.description}</p>
          <p className="text-xs text-gray-500 mb-4 text-center font-semibold uppercase">This is a one-time use ability.</p>
          
          {gameState.heldBrainstorm?.needsInteraction && (gameState.heldBrainstorm.id === 'upgrade' || gameState.heldBrainstorm.id === 'polish') && (
              <>
                <p className="text-center text-sm text-indigo-700 mb-2">Select a tile from your hand to apply this effect:</p>
                <div className="flex flex-wrap justify-center gap-2 mb-4 p-2 bg-indigo-100/50 rounded-md max-h-48 overflow-y-auto">
                    {gameState.playerHand.map(tile => (
                        <MemoizedTile 
                          key={tile.id} 
                          tile={tile} 
                          isSelected={false} // No selection state in this context
                          onClick={() => handleConfirmBrainstormActivation(tile)} 
                          letterValues={gameState.letterValues}
                          isSmall={true}
                        />
                    ))}
                    {gameState.playerHand.length === 0 && <p className="text-xs text-gray-500">No tiles in hand to select.</p>}
                </div>
              </>
          )}

          {!gameState.heldBrainstorm?.needsInteraction && (
            <Button onClick={() => handleConfirmBrainstormActivation()} variant="special" fullWidth className="my-2">
                Activate {gameState.heldBrainstorm?.name} Now
            </Button>
          )}
          <Button onClick={handleCancelBrainstormActivation} variant="secondary" size="sm" className="mx-auto block">
            {gameState.heldBrainstorm?.needsInteraction ? 'Cancel' : 'Save for Later'}
          </Button>
      </Modal>
      
      <Modal isOpen={isEndGameModalOpen} title="Game Over!" size="sm" onClose={playAgain}>
          <p className="text-base text-gray-700 mb-4 h-12 flex items-center justify-center text-center">{endGameReason}</p>
          <p className="text-2xl font-bold text-gray-700">{gameState.playerName}</p>
          <p className="text-lg">Final Score:</p>
          <p className="text-6xl font-black text-gray-800 mb-6">{gameState.score}</p>
          <div className="flex flex-col sm:flex-row gap-2">
              <Button onClick={generateShareImage} variant="special" fullWidth>Share Score</Button>
              <Button onClick={playAgain} variant="primary" fullWidth>Play Again</Button>
          </div>
      </Modal>

      <Modal isOpen={isShareModalOpen} title="Your Score Card!" onClose={() => setIsShareModalOpen(false)} size="sm">
          {shareImage && <img id="score-card-image" src={shareImage} className="rounded-lg shadow-lg mx-auto mb-4" alt="Score Card"/>}
          {shareFallbackTextVisible && <p id="share-fallback-text" className="text-gray-600 mb-4 text-sm">Press and hold image to share, or take a screenshot!</p>}
          <Button onClick={() => setIsShareModalOpen(false)} variant="secondary" fullWidth>Close</Button>
      </Modal>

    </main>
  );
};

export default App;
