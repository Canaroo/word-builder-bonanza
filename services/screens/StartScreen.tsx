import React, { useState, useEffect } from 'react';
import Leaderboard from '../../components/Leaderboard';
import { LeaderboardEntry } from '../../types';
import { leaderboardService } from '../leaderboardService';
import { soundService } from '../soundService';

interface StartScreenProps {
  onPlay: (name: string) => void;
  onResumeGame: (name: string) => void;
  onShowHowToPlay: () => void;
}

const StartScreen: React.FC<StartScreenProps> = ({ onPlay, onResumeGame, onShowHowToPlay }) => {
  const [name, setName] = useState('');
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [isMuted, setIsMuted] = useState(soundService.getMuteState());
  const [savedGame, setSavedGame] = useState<{playerName: string} | null>(null);

  useEffect(() => {
    // Fetch leaderboard data once when component mounts
    leaderboardService.getLeaderboard().then(data => {
      setLeaderboardData(data);
      setIsLoading(false);
    });

    // Check for a saved game when component mounts
    const savedGameJson = localStorage.getItem('wordBuilderBonanzaSave');
    if (savedGameJson) {
      try {
        const gameData = JSON.parse(savedGameJson);
        if (gameData && gameData.playerName && gameData.gameScreenState) {
            setSavedGame(gameData);
        }
      } catch (e) {
        console.error("Failed to parse saved game data, removing.", e);
        localStorage.removeItem('wordBuilderBonanzaSave');
      }
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      soundService.initialize(); // Initialize AudioContext on user gesture
      soundService.playUIClick();
      onPlay(name.trim());
    }
  };
  
  const handleShowLeaderboard = () => {
    soundService.initialize();
    soundService.playUIClick();
    setShowLeaderboardModal(true);
  };

  const handleMuteToggle = () => {
    soundService.initialize();
    const newMuteState = soundService.toggleMute();
    setIsMuted(newMuteState);
  };

  const handleResumeClick = () => {
    if (savedGame) {
        soundService.initialize();
        soundService.playUIClick();
        onResumeGame(savedGame.playerName);
    }
  };

  return (
    <>
      {showLeaderboardModal && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border-2 border-cyan-400 rounded-2xl p-6 shadow-2xl max-w-sm w-full animate-fade-in">
            <Leaderboard data={leaderboardData} isLoading={isLoading} />
            <button 
              onClick={() => {
                soundService.playUIClick();
                setShowLeaderboardModal(false);
              }}
              className="w-full mt-4 px-6 py-3 text-xl font-bold text-slate-900 bg-amber-400 rounded-lg shadow-lg hover:bg-amber-300 transition-colors"
            >
              CLOSE
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col h-full bg-slate-800 p-6 md:p-8 text-center justify-center gap-10 relative">
        <div className="absolute top-4 right-4">
          <button onClick={handleMuteToggle} className="text-2xl text-slate-400 hover:text-white p-2 transition-transform hover:scale-110">
            {isMuted ? '🔇' : '🔊'}
          </button>
        </div>

        <div>
          <h1 className="text-4xl md:text-5xl font-bold text-cyan-400 tracking-tighter">Word Builder</h1>
          <h2 className="text-5xl md:text-6xl font-bold text-amber-400 tracking-tight -mt-2">BONANZA</h2>
        </div>
        
        <div className="w-full max-w-sm mx-auto">
          <form onSubmit={handleSubmit}>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter Your Name"
              maxLength={12}
              className="w-full px-4 py-3 text-lg text-center bg-slate-900 border-2 border-slate-600 rounded-lg focus:outline-none focus:ring-4 focus:ring-amber-400 focus:border-amber-400 transition-all duration-300"
            />
            <button
              type="submit"
              disabled={!name.trim()}
              className="w-full mt-4 px-6 py-4 text-2xl font-bold text-slate-900 bg-amber-400 rounded-lg shadow-lg hover:bg-amber-300 disabled:bg-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105"
            >
              NEW GAME
            </button>
          </form>
          {savedGame && (
            <button
              onClick={handleResumeClick}
              className="w-full mt-4 px-6 py-3 text-xl font-bold text-slate-900 bg-green-500 rounded-lg shadow-lg hover:bg-green-400 transition-all duration-300"
            >
              RESUME: {savedGame.playerName}
            </button>
          )}
          <button
            onClick={handleShowLeaderboard}
            className="w-full mt-4 px-6 py-3 text-xl font-bold text-slate-100 bg-cyan-600 rounded-lg shadow-lg hover:bg-cyan-500 transition-all duration-300"
          >
            LEADERBOARD
          </button>
          <button
              onClick={onShowHowToPlay}
              className="w-full mt-4 px-6 py-2 text-md font-bold text-cyan-200 border-2 border-cyan-700 rounded-lg shadow-lg hover:bg-cyan-700 hover:text-white transition-all duration-300"
          >
              HOW TO PLAY
          </button>
        </div>
        <p className="absolute bottom-2 w-full left-0 text-center text-amber-400 text-xs">Version 4.3</p>
      </div>
    </>
  );
};

export default StartScreen;