
import React, { useState, useCallback, useEffect } from 'react';
import StartScreen from './services/screens/StartScreen';
import GameScreen from './services/screens/GameScreen';
import GameOverScreen from './services/screens/GameOverScreen';
import HowToPlayScreen from './services/screens/HowToPlayScreen';
import { GameState, WordData, EasterEgg, Charm, WordBonus, PowerPlay } from './types';
import {leaderboardService} from './services/leaderboardService';
import { soundService } from './services/soundService';


export enum Screen {
  Start,
  Game,
  GameOver,
  HowToPlay,
}

interface FinalGameState {
  score: number;
  words: WordData[];
  longestWord: string;
  foundEasterEggs: EasterEgg[];
  activeCharms: Charm[];
  unlockedWordBonusIds: string[];
  activeBuffs: (Charm | PowerPlay)[];
}


const App: React.FC = () => {
  const [screen, setScreen] = useState<Screen>(Screen.Start);
  const [playerName, setPlayerName] = useState<string>('');
  const [lastGameResult, setLastGameResult] = useState<FinalGameState | null>(null);
  const [isResuming, setIsResuming] = useState(false);
  const [isTimeLow, setIsTimeLow] = useState(false);

  useEffect(() => {
    // Ensure the low time warning is disabled when not on the game screen
    if (screen !== Screen.Game) {
      setIsTimeLow(false);
    }
  }, [screen]);

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

  const handlePlay = useCallback((name: string) => {
    localStorage.removeItem('wordBuilderBonanzaSave');
    setPlayerName(name);
    setScreen(Screen.Game);
    enterFullscreen();
  }, []);

  const handleResumeGame = useCallback((name: string) => {
    setIsResuming(true);
    setPlayerName(name);
    setScreen(Screen.Game);
    enterFullscreen();
  }, []);

  const handleSaveGame = useCallback((gameScreenState: any) => {
    const saveData = {
        playerName: playerName,
        gameScreenState: gameScreenState,
    };
    localStorage.setItem('wordBuilderBonanzaSave', JSON.stringify(saveData));
    setScreen(Screen.Start);
  }, [playerName]);


  const handleGameOver = useCallback((gameState: GameState) => {
    localStorage.removeItem('wordBuilderBonanzaSave');
    const finalState: FinalGameState = {
      score: gameState.score,
      words: gameState.words,
      longestWord: gameState.longestWord,
      foundEasterEggs: gameState.foundEasterEggs,
      activeCharms: gameState.activeCharms,
      unlockedWordBonusIds: gameState.unlockedWordBonusIds,
      activeBuffs: gameState.activeBuffs,
    };
    setLastGameResult(finalState);
    setScreen(Screen.GameOver);
  }, []);

  const handlePlayAgain = useCallback(() => {
    setLastGameResult(null);
    setScreen(Screen.Game);
  }, []);
  
  const handleSubmitScore = useCallback(async () => {
    if (lastGameResult && playerName) {
      await leaderboardService.submitScore(playerName, lastGameResult.score);
    }
    setLastGameResult(null);
    setScreen(Screen.Start);
  }, [lastGameResult, playerName]);

  const handleGoToMenu = useCallback(() => {
    setLastGameResult(null);
    setScreen(Screen.Start);
  }, []);

  const handleShowHowToPlay = useCallback(() => {
    soundService.initialize();
    soundService.playUIClick();
    setScreen(Screen.HowToPlay);
  }, []);

  useEffect(() => {
    // After the screen has transitioned to Game, we can reset the resuming flag.
    if (screen === Screen.Game && isResuming) {
        setIsResuming(false);
    }
  }, [screen, isResuming]);

  const renderScreen = () => {
    switch (screen) {
      case Screen.Start:
        return <StartScreen onPlay={handlePlay} onResumeGame={handleResumeGame} onShowHowToPlay={handleShowHowToPlay} />;
      case Screen.Game:
        return <GameScreen 
            playerName={playerName} 
            onGameOver={handleGameOver} 
            onSaveGame={handleSaveGame}
            isResuming={isResuming}
            onTimeLow={setIsTimeLow}
            />;
      case Screen.GameOver:
        return lastGameResult && (
          <GameOverScreen 
            gameState={lastGameResult} 
            onPlayAgain={handlePlayAgain}
            onSubmitScore={handleSubmitScore}
            onGoToMenu={handleGoToMenu}
          />
        );
      case Screen.HowToPlay:
        return <HowToPlayScreen onBack={handleGoToMenu} />;
      default:
        return <StartScreen onPlay={handlePlay} onResumeGame={handleResumeGame} onShowHowToPlay={handleShowHowToPlay} />;
    }
  };

  return (
    <main className="w-screen h-dvh bg-slate-900 flex items-center justify-center p-4">
      <div className={`w-full max-w-xl h-full max-h-[800px] bg-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-y-auto border-2 border-slate-700 transition-colors ${isTimeLow ? 'low-time-flash' : ''}`}>
        {renderScreen()}
      </div>
    </main>
  );
};

export default App;
