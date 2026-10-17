
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import StartScreen from './services/screens/StartScreen';
import { GameScreen } from './services/screens/GameScreen';
import GameOverScreen from './services/screens/GameOverScreen';
import HowToPlayScreen from './services/screens/HowToPlayScreen';
import VibezScreen from './services/screens/VibezScreen';
import { GameState, FinalGameState, Pack, PowerWordData } from './types';
import {leaderboardService} from './services/leaderboardService';
import { soundService } from './services/soundService';
import { musicService } from './services/musicService';
import { powerWordService } from './services/powerWordService';
import { logService } from './services/logService';
import { PACKS_LIST } from './data/packs';

// Declare the global function so TypeScript doesn't complain
declare function showToast(message: string): void;

export enum Screen {
  Start,
  Game,
  GameOver,
  HowToPlay,
  Vibez,
}

const App: React.FC = () => {
  const [screen, setScreen] = useState<Screen>(Screen.Start);
  const [playerName, setPlayerName] = useState<string>(() => localStorage.getItem("playerName") || '');
  const [lastGameResult, setLastGameResult] = useState<FinalGameState | null>(null);
  const [isResuming, setIsResuming] = useState(false);
  const [isTimeLow, setIsTimeLow] = useState(false);
  const [isGoldenRound, setIsGoldenRound] = useState(false);
  const [autoShowLeaderboard, setAutoShowLeaderboard] = useState(false);
  
  // New state for packs and currency
  const [lexCoins, setLexCoins] = useState<number>(() => parseInt(localStorage.getItem('wordBuilderLexCoins') || '0', 10));
  const [unlockedPackIds, setUnlockedPackIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('wordBuilderUnlockedPacks');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch (e) {
        console.error("Failed to parse unlocked packs from localStorage", e);
      }
    }
    return ['default']; // Default to only having the 'default' pack unlocked
  });
  const [selectedPackId, setSelectedPackId] = useState<string>(() => localStorage.getItem('wordBuilderSelectedPack') || 'default');
  
  // New state for ranking modals
  const [rankingModalData, setRankingModalData] = useState<{ rank: number; name: string; score: number } | null>(null);

  // New state for Power Word
  const [powerWordData, setPowerWordData] = useState<PowerWordData | null>(null);
  const [canSpin, setCanSpin] = useState<boolean>(true);


  useEffect(() => {
    // Load Power Word data on initial app load
    const data = powerWordService.getPowerWordData();
    const canUserSpin = powerWordService.canSpin();
    
    if (canUserSpin) {
      // Cooldown is over, don't show the old word
      setPowerWordData(null);
    } else {
      // Still in cooldown, show the current word
      setPowerWordData(data);
    }
    setCanSpin(canUserSpin);
  }, []);

  useEffect(() => {
    localStorage.setItem('wordBuilderLexCoins', String(lexCoins));
  }, [lexCoins]);

  useEffect(() => {
    localStorage.setItem('wordBuilderUnlockedPacks', JSON.stringify(unlockedPackIds));
  }, [unlockedPackIds]);

  useEffect(() => {
    localStorage.setItem('wordBuilderSelectedPack', selectedPackId);
  }, [selectedPackId]);

  const selectedPack = useMemo(() => {
    return PACKS_LIST.find(p => p.id === selectedPackId) || PACKS_LIST[0];
  }, [selectedPackId]);


  useEffect(() => {
    if (screen !== Screen.Game) {
      setIsTimeLow(false);
      setIsGoldenRound(false);
    }
  }, [screen]);

  useEffect(() => {
    if (playerName.trim()) {
        localStorage.setItem("playerName", playerName.trim());
    }
  }, [playerName]);

  const enterFullscreen = () => {
    const elem = document.documentElement as any;
    if (elem.requestFullscreen) {
      elem.requestFullscreen().catch((err: Error) => {
        console.log(`Fullscreen request failed: ${err.message}`);
      });
    } else if (elem.mozRequestFullScreen) { // Firefox
      elem.mozRequestFullScreen();
    } else if (elem.webkitRequestFullscreen) { // Chrome, Safari, Opera
      elem.webkitRequestFullscreen();
    } else if (elem.msRequestFullscreen) { // IE/Edge
      elem.msRequestFullscreen();
    }
  };
  
  const handleScoreUpdate = useCallback((oldScore: number, newScore: number) => {
    const oldMilestone = Math.floor(oldScore / 5000);
    const newMilestone = Math.floor(newScore / 5000);
    if (newMilestone > oldMilestone) {
        const coinsEarned = newMilestone - oldMilestone;
        setLexCoins(c => c + coinsEarned);
        if (typeof showToast === 'function') {
            showToast(`🪙 +${coinsEarned} LEX Coin(s)!`);
        }
        soundService.playMilestone();
    }
  }, []);

  const handleLexCoinChange = useCallback((amount: number) => {
    setLexCoins(c => c + amount);
     if (amount > 0) {
        if (typeof showToast === 'function') {
            showToast(`🪙 +${amount} LEX Coin(s)!`);
        }
        soundService.playMilestone();
    }
  }, []);

  const handleUnlockPack = useCallback((packId: string, cost: number) => {
    if (lexCoins >= cost && !unlockedPackIds.includes(packId)) {
      setLexCoins(c => c - cost);
      setUnlockedPackIds(ids => [...ids, packId]);
      if (typeof showToast === 'function') {
        showToast('Pack Unlocked!');
      }
      soundService.playMilestone();
    }
  }, [lexCoins, unlockedPackIds]);

  const handleSelectPack = useCallback((packId: string) => {
    if (unlockedPackIds.includes(packId)) {
      setSelectedPackId(packId);
    }
  }, [unlockedPackIds]);

  const handlePlay = useCallback((name: string) => {
    localStorage.removeItem('wordBuilderBonanzaSave');
    setPlayerName(name);
    setScreen(Screen.Game);
    setRankingModalData(null); // Clear any leftover ranking data
    enterFullscreen();
  }, []);

  const handleResumeGame = useCallback((name: string) => {
    setIsResuming(true);
    setPlayerName(name);
    setScreen(Screen.Game);
    setRankingModalData(null); // Clear any leftover ranking data
    enterFullscreen();
  }, []);

  const handleSaveGame = useCallback((gameScreenState: any) => {
    const saveData = {
        playerName: playerName,
        gameScreenState: gameScreenState,
    };
    localStorage.setItem('wordBuilderBonanzaSave', JSON.stringify(saveData));
    setScreen(Screen.Start);
    musicService.pause();
  }, [playerName]);


  const handleGameOver = useCallback((gameState: GameState) => {
    localStorage.removeItem('wordBuilderBonanzaSave');
    const finalState: FinalGameState = {
      score: gameState.score,
      log: gameState.log,
      longestWord: gameState.longestWord,
      foundEasterEggs: gameState.foundEasterEggs,
      activeCharms: gameState.activeCharms,
      unlockedWordBonusIds: gameState.unlockedWordBonusIds,
      activeBuffs: gameState.activeBuffs,
      highestScoringWord: gameState.highestScoringWord,
      longestStreak: gameState.longestStreak,
    };
    
    // Auto-save the log on game over
    logService.autoSaveLog(finalState);
    
    setLastGameResult(finalState);
    setScreen(Screen.GameOver);
    musicService.stop();
  }, []);

  const handlePlayAgain = useCallback(() => {
    setLastGameResult(null);
    setScreen(Screen.Game);
    musicService.play();
  }, []);
  
  const handleSubmitScore = useCallback(async (name: string) => {
    if (lastGameResult) {
      const score = lastGameResult.score;
      await leaderboardService.submitScore(name, score);
      setPlayerName(name);

      const board = await leaderboardService.getLeaderboard();
      const rank = board.findIndex(entry => entry.name === name && entry.score === score) + 1;

      if (rank > 0 && rank <= 10) {
        setRankingModalData({ rank, name, score });
        setAutoShowLeaderboard(false);
      } else {
        setRankingModalData(null);
        setAutoShowLeaderboard(true);
        if (typeof showToast === 'function') {
          showToast("Score submitted successfully!");
        }
      }
    }
    setLastGameResult(null);
    setScreen(Screen.Start);
    musicService.stop();
  }, [lastGameResult]);

  const handleGoToMenu = useCallback(() => {
    setLastGameResult(null);
    setScreen(Screen.Start);
    setRankingModalData(null); // Clear ranking data on menu navigation
    musicService.stop();
  }, []);

  const handleShowHowToPlay = useCallback(() => {
    soundService.initialize();
    soundService.playUIClick();
    setScreen(Screen.HowToPlay);
  }, []);
  
  const handleShowVibez = useCallback(() => {
    soundService.initialize();
    soundService.playUIClick();
    setScreen(Screen.Vibez);
  }, []);

  const handleSpin = useCallback(() => {
    if (!canSpin) return;
    const newData = powerWordService.spin();
    if (newData) {
      setPowerWordData(newData);
      setCanSpin(false);
      soundService.playMilestone();
      if (typeof showToast === 'function') {
        showToast(`Your Power Word is ${newData.powerWord.toUpperCase()}!`);
      }
    }
  }, [canSpin]);

  useEffect(() => {
    if (screen === Screen.Game && isResuming) {
        setIsResuming(false);
    }
  }, [screen, isResuming]);

  const renderScreen = () => {
    switch (screen) {
      case Screen.Start:
        return <StartScreen 
          onPlay={handlePlay} 
          onResumeGame={handleResumeGame} 
          onShowHowToPlay={handleShowHowToPlay} 
          onShowVibez={handleShowVibez} 
          lexCoins={lexCoins} 
          autoShowLeaderboard={autoShowLeaderboard}
          setAutoShowLeaderboard={setAutoShowLeaderboard}
          rankingModalData={rankingModalData}
          setRankingModalData={setRankingModalData}
          powerWordData={powerWordData}
          canSpin={canSpin}
          onSpin={handleSpin}
          />;
      case Screen.Game:
        return <GameScreen 
            playerName={playerName} 
            onGameOver={handleGameOver} 
            onSaveGame={handleSaveGame}
            isResuming={isResuming}
            onTimeLow={setIsTimeLow}
            onGoldenRoundChange={setIsGoldenRound}
            onScoreUpdate={handleScoreUpdate}
            onLexCoinChange={handleLexCoinChange}
            tileClass={selectedPack.tileClass}
            powerWord={powerWordData?.powerWord}
            />;
      case Screen.GameOver:
        return lastGameResult && (
          <GameOverScreen
            playerName={playerName}
            gameState={lastGameResult} 
            onPlayAgain={handlePlayAgain}
            onSubmitScore={handleSubmitScore}
            onGoToMenu={handleGoToMenu}
          />
        );
      case Screen.HowToPlay:
        return <HowToPlayScreen onBack={handleGoToMenu} />;
      case Screen.Vibez:
        return <VibezScreen 
          onBack={handleGoToMenu} 
          lexCoins={lexCoins}
          unlockedPackIds={unlockedPackIds}
          selectedPackId={selectedPackId}
          onUnlockPack={handleUnlockPack}
          onSelectPack={handleSelectPack}
          />;
      default:
        return <StartScreen onPlay={handlePlay} onResumeGame={handleResumeGame} onShowHowToPlay={handleShowHowToPlay} onShowVibez={handleShowVibez} lexCoins={lexCoins} autoShowLeaderboard={autoShowLeaderboard} setAutoShowLeaderboard={setAutoShowLeaderboard} rankingModalData={rankingModalData} setRankingModalData={setRankingModalData} powerWordData={powerWordData} canSpin={canSpin} onSpin={handleSpin}/>;
    }
  };

  return (
    <main id="main-container" className={`w-screen h-dvh flex items-center justify-center p-4 transition-all duration-500 ${selectedPack.themeClass}`}>
      <div className={`relative z-10 w-full max-w-xl h-full max-h-[800px] bg-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-y-auto transition-all duration-300 ${selectedPack.frameClass} ${isTimeLow ? 'low-time-flash' : ''} ${isGoldenRound ? 'golden-round-active' : ''}`}>
        {selectedPack.id === 'rustic-workbench' && (
          <>
            <div className="corner-bolt top-left"></div>
            <div className="corner-bolt top-right"></div>
            <div className="corner-bolt bottom-left"></div>
            <div className="corner-bolt bottom-right"></div>
          </>
        )}
        {renderScreen()}
      </div>
    </main>
  );
};

export default App;
