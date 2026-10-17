
import React, { useState, useEffect } from 'react';
import { soundService } from '../soundService';
import { musicService } from '../musicService';
import Leaderboard from '../../components/Leaderboard';
import { leaderboardService, LeaderboardSource } from '../leaderboardService';
import { LeaderboardEntry, FinalGameState, MissedWord, PowerWordData } from '../../types';
import { logService } from '../logService';
import { missedWordsService } from '../missedWordsService';
import { powerWordService } from '../powerWordService';
import EventLogDisplay from '../../components/EventLogDisplay';
import RankingModal from '../../components/RankingModal';
import { storage, STORAGE_KEYS } from '../storage';


interface StartScreenProps {
  onPlay: (name: string) => void;
  onResumeGame: (name: string) => void;
  onShowHowToPlay: () => void;
  onShowVibez: () => void;
  lexCoins: number;
  autoShowLeaderboard: boolean;
  setAutoShowLeaderboard: (show: boolean) => void;
  rankingModalData: { rank: number; name: string; score: number } | null;
  setRankingModalData: (data: { rank: number; name: string; score: number } | null) => void;
  powerWordData: PowerWordData | null;
  canSpin: boolean;
  onSpin: () => void;
}

const StartScreen: React.FC<StartScreenProps> = ({ 
  onPlay, 
  onResumeGame, 
  onShowHowToPlay, 
  onShowVibez, 
  lexCoins, 
  autoShowLeaderboard, 
  setAutoShowLeaderboard,
  rankingModalData,
  setRankingModalData,
  powerWordData,
  canSpin,
  onSpin
}) => {
  const [name, setName] = useState(() => storage.getString(STORAGE_KEYS.playerName) || '');
  const [isMuted, setIsMuted] = useState(soundService.getMuteState());
  const [savedGame, setSavedGame] = useState<{playerName: string} | null>(null);
  
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);
  const [leaderboardSource, setLeaderboardSource] = useState<LeaderboardSource>('local');

  const [showEventLogsModal, setShowEventLogsModal] = useState(false);
  const [eventLogs, setEventLogs] = useState<FinalGameState[]>([]);
  const [selectedRun, setSelectedRun] = useState<FinalGameState | null>(null);

  const [showMissedWordsModal, setShowMissedWordsModal] = useState(false);
  const [missedWords, setMissedWords] = useState<MissedWord[]>([]);
  
  const [showPowerWordInfo, setShowPowerWordInfo] = useState(false);

  useEffect(() => {
    if (rankingModalData) {
        soundService.initialize();
        const mainContainer = document.getElementById('main-container');
        switch (true) {
            case rankingModalData.rank === 1:
                soundService.playNESFanfare();
                if (mainContainer) {
                  mainContainer.classList.add('screen-shake');
                  setTimeout(() => mainContainer.classList.remove('screen-shake'), 500);
                }
                break;
            case rankingModalData.rank <= 5:
                soundService.playHeroicChord();
                break;
            case rankingModalData.rank <= 10:
                soundService.playBroadwayRiff();
                break;
        }
    }
  }, [rankingModalData]);

  useEffect(() => {
    if (autoShowLeaderboard) {
      handleShowLeaderboard();
      setAutoShowLeaderboard(false); // Reset the trigger
    }
  }, [autoShowLeaderboard, setAutoShowLeaderboard]);

  useEffect(() => {
    // Check for a saved game when component mounts
    const gameData = storage.getJSON<any>(STORAGE_KEYS.savedGame, null);
    if (gameData && gameData.playerName && gameData.gameScreenState) {
        setSavedGame(gameData);
        // Pre-fill name from saved game if no general player name is set
        if (!name) {
          setName(gameData.playerName);
        }
    }
  }, [name]);
  
  useEffect(() => {
    if (showLeaderboardModal) {
      const fetchLeaderboard = async () => {
        setIsLoadingLeaderboard(true);
        const { entries, source } = await leaderboardService.getLeaderboard();
        setLeaderboardData(entries);
        setLeaderboardSource(source);
        setIsLoadingLeaderboard(false);
      };
      fetchLeaderboard();
    }
  }, [showLeaderboardModal]);

  useEffect(() => {
    if (showEventLogsModal) {
      setEventLogs(logService.getSavedLogs());
    }
  }, [showEventLogsModal]);

  useEffect(() => {
    if (showMissedWordsModal) {
      setMissedWords(missedWordsService.getMissedWords());
    }
  }, [showMissedWordsModal]);


  const handlePlayClick = () => {
    if (name.trim()) {
      soundService.initialize(); // Initialize AudioContext on user gesture
      musicService.play();
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
        musicService.play();
        soundService.playUIClick();
        onResumeGame(savedGame.playerName);
    }
  };
  
  const handleCloseLeaderboard = () => {
    soundService.playUIClick();
    setShowLeaderboardModal(false);
  }

  const handleShowEventLogs = () => {
    soundService.playUIClick();
    setShowEventLogsModal(true);
  };

  const handleCloseEventLogs = () => {
      soundService.playUIClick();
      setShowEventLogsModal(false);
      setSelectedRun(null); // Reset selection on close
  };

  const handleShowMissedWords = () => {
    soundService.playUIClick();
    setShowMissedWordsModal(true);
  };

  const handleCloseMissedWords = () => {
    soundService.playUIClick();
    setShowMissedWordsModal(false);
  };

  const handleDeleteRun = (timestamp: string) => {
      if (window.confirm("Are you sure you want to delete this event log? This cannot be undone.")) {
        logService.deleteLog(timestamp);
        setEventLogs(logService.getSavedLogs()); // Refresh list
        soundService.playClear();
      }
  }
  
  const handleTogglePin = (timestamp: string) => {
    logService.togglePinLog(timestamp);
    setEventLogs(logService.getSavedLogs());
    soundService.playUIClick();
  };

  const handleViewRun = (run: FinalGameState) => {
      if (!run.isViewed) {
          logService.markLogAsViewed(run.saveTimestamp!);
          // Update the state immediately for UI responsiveness
          setEventLogs(prevLogs => prevLogs.map(log => 
              log.saveTimestamp === run.saveTimestamp ? { ...log, isViewed: true } : log
          ));
      }
      setSelectedRun(run);
      soundService.playUIClick();
  }

  const handleShowPowerWordInfo = () => {
    soundService.playUIClick();
    setShowPowerWordInfo(true);
  };
  const handleClosePowerWordInfo = () => {
    soundService.playUIClick();
    setShowPowerWordInfo(false);
  };

  const formatDate = (isoString?: string | number) => {
    if (!isoString) return 'Unknown Date';
    return new Date(isoString).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short"
    });
  };

  return (
    <>
      {rankingModalData && (
          <RankingModal
              data={rankingModalData}
              onClose={() => setRankingModalData(null)}
              onShowLeaderboard={() => {
                  setRankingModalData(null);
                  handleShowLeaderboard();
              }}
          />
      )}
      
      {showLeaderboardModal && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-slate-800 border-2 border-amber-400 rounded-2xl p-6 text-center shadow-2xl max-w-md w-full flex flex-col max-h-[90vh]">
            <Leaderboard data={leaderboardData} isLoading={isLoadingLeaderboard} source={leaderboardSource} />
            <button
              onClick={handleCloseLeaderboard}
              className="w-full mt-4 px-6 py-3 text-xl font-bold text-slate-900 bg-amber-400 rounded-lg shadow-lg hover:bg-amber-300 transition-colors"
            >
              CLOSE
            </button>
          </div>
        </div>
      )}

      {showEventLogsModal && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-slate-800 border-2 border-green-400 rounded-2xl p-6 text-center shadow-2xl max-w-md w-full flex flex-col max-h-[90vh]">
            {selectedRun ? (
               <>
                <h2 className="text-2xl font-bold text-green-400 mb-2 flex-shrink-0">Viewing Event Log</h2>
                <div className="flex-grow overflow-y-auto pr-2">
                  <EventLogDisplay log={selectedRun.log} />
                </div>
               </>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-green-400 mb-2">Event Logs ({eventLogs.length}/{logService.MAX_LOGS})</h2>
                <div className="flex-grow overflow-y-auto pr-2 space-y-3 min-h-[350px]">
                  {eventLogs.length > 0 ? (
                    eventLogs.map(run => (
                      <div key={run.saveTimestamp} className="bg-slate-900/50 p-3 rounded-lg text-left flex items-center justify-between">
                        <div>
                          <p className="font-bold text-white flex items-center gap-2">
                            Score: <span className="text-amber-400 font-digital">{run.score}</span>
                            {!run.isViewed && <span className="text-xs bg-green-500 text-white font-semibold px-2 py-0.5 rounded-full">NEW</span>}
                          </p>
                          <p className="text-xs text-slate-400">{formatDate(run.saveTimestamp)}</p>
                        </div>
                        <div className="flex items-center gap-1">
                           <button onClick={() => handleTogglePin(run.saveTimestamp!)} title={run.isPinned ? "Unpin this run" : "Pin this run"} className={`p-2 rounded-md hover:bg-slate-700 transition-colors text-xl ${run.isPinned ? '' : 'opacity-50 hover:opacity-100'}`}>
                             {run.isPinned ? '🌟' : '⭐'}
                           </button>
                           <button onClick={() => handleViewRun(run)} className="px-3 py-1 text-sm font-bold text-slate-900 bg-cyan-400 rounded-md hover:bg-cyan-300">VIEW</button>
                           <button onClick={() => handleDeleteRun(run.saveTimestamp!)} className="px-3 py-1 text-sm font-bold text-white bg-red-600 rounded-md hover:bg-red-500">DELETE</button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center justify-center h-full text-slate-500 italic">No saved event logs yet.</div>
                  )}
                </div>
              </>
            )}
            <button
              onClick={handleCloseEventLogs}
              className="w-full mt-4 px-6 py-3 text-xl font-bold text-slate-900 bg-green-500 rounded-lg shadow-lg hover:bg-green-400 transition-colors"
            >
              CLOSE
            </button>
          </div>
        </div>
      )}

      {showMissedWordsModal && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-slate-800 border-2 border-red-400 rounded-2xl p-6 text-center shadow-2xl max-w-md w-full flex flex-col max-h-[90vh]">
            <h2 className="text-2xl font-bold text-red-400 mb-2">Missed Words ({missedWords.length}/{missedWordsService.MAX_WORDS})</h2>
            <p className="text-sm text-slate-400 mb-4">Your 10 most recent words from failed challenges.</p>
            <div className="flex-grow overflow-y-auto pr-2 space-y-3 min-h-[350px]">
              {missedWords.length > 0 ? (
                missedWords.map(word => (
                  <div key={word.timestamp} className="bg-slate-900/50 p-3 rounded-lg text-left">
                    <p className="font-bold text-white text-lg">{word.word}</p>
                    <p className="text-sm text-slate-300 italic">{word.definition}</p>
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-center h-full text-slate-500 italic">
                  You haven't missed any words during challenges yet. Keep playing!
                </div>
              )}
            </div>
            <button
              onClick={handleCloseMissedWords}
              className="w-full mt-4 px-6 py-3 text-xl font-bold text-slate-900 bg-red-500 rounded-lg shadow-lg hover:bg-red-400 transition-colors"
            >
              CLOSE
            </button>
          </div>
        </div>
      )}

      {showPowerWordInfo && powerWordData && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-slate-800 border-2 border-yellow-400 rounded-2xl p-6 text-center shadow-2xl max-w-md w-full flex flex-col">
            <h2 className="text-3xl font-bold text-yellow-400 mb-2 flex-shrink-0 flex items-center justify-center gap-3">
              <span className="text-4xl">💥</span>
              <span>Power Word Info</span>
            </h2>
            <div className="flex-grow my-4">
              <p className="font-bold text-3xl text-white font-digital tracking-widest">{powerWordData.powerWord.toUpperCase()}</p>
              <p className="text-slate-300 italic mt-2 mb-4">"{powerWordData.definition}"</p>
              <p className="text-green-400 font-semibold bg-slate-900/50 p-3 rounded-lg">
                Use this word during a run for a <strong className="font-bold">500 point bonus!</strong>
              </p>
            </div>
            <button
              onClick={handleClosePowerWordInfo}
              className="w-full mt-4 px-6 py-3 text-xl font-bold text-slate-900 bg-yellow-500 rounded-lg shadow-lg hover:bg-yellow-400 transition-colors"
            >
              GOT IT
            </button>
          </div>
        </div>
      )}


      <div className="flex flex-col h-full bg-slate-800 p-4 text-center justify-center relative">
        <button onClick={onShowVibez} className="absolute top-4 left-4 flex items-center gap-2 bg-purple-900/70 hover:bg-purple-800/80 text-purple-200 pl-2 pr-3 py-2 rounded-full transition-colors shadow-md">
            <span className="text-xl">🎨</span>
            <span className="flex items-center gap-1 font-digital text-lg">
                <span className="text-yellow-300">🪙</span>
                {lexCoins}
            </span>
        </button>
        <button onClick={handleMuteToggle} className="absolute top-4 right-4 text-2xl text-slate-400 hover:text-white p-2 transition-transform hover:scale-110">
          {isMuted ? '🔇' : '🔊'}
        </button>

        <div className="w-full max-w-sm mx-auto flex flex-col items-center gap-4">
            <div className="text-center">
                <h1 
                    className="text-6xl md:text-7xl font-bold text-cyan-400 animate-slide-in-down" 
                    style={{ textShadow: '2px 2px 3px rgba(0,0,0,0.3)' }}
                >
                    WORD
                </h1>
                <h2 
                    className="text-7xl md:text-8xl font-extrabold text-amber-400 tracking-normal -mt-6 pb-2 border-b-4 border-amber-500 inline-block animate-bounce-in-up" 
                    style={{ fontFamily: "'Bungee', cursive", textShadow: '2px 2px 3px rgba(0,0,0,0.3)', animationDelay: '0.1s' }}
                >
                    NERD
                </h2>
                <p className="text-slate-400 italic mt-2 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>Serious words. Ridiculous fun.</p>
            </div>
            
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter Your Name"
              maxLength={12}
              className="w-full px-4 py-3 text-lg text-center bg-slate-900 border-2 border-slate-600 rounded-lg focus:outline-none focus:ring-4 focus:ring-amber-400 focus:border-amber-400 transition-all duration-300 text-slate-100 placeholder:text-slate-400"
            />
            
            <div className="w-full flex flex-col gap-3 mt-2">
                <button
                    type="button"
                    disabled={!name.trim()}
                    onClick={handlePlayClick}
                    className="w-full px-6 py-4 text-2xl font-bold text-slate-900 bg-amber-400 rounded-lg shadow-lg hover:bg-amber-300 disabled:bg-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 flex items-center justify-center gap-2"
                >
                    🎮 NEW GAME
                </button>

                {savedGame && (
                    <button
                        onClick={handleResumeClick}
                        className="w-full px-6 py-3 text-xl font-bold text-slate-900 bg-green-500 rounded-lg shadow-lg hover:bg-green-400 transition-all duration-300 flex items-center justify-center gap-2"
                    >
                        ▶️ RESUME: {savedGame.playerName}
                    </button>
                )}
            </div>

            <div className="w-full my-2">
                {powerWordData && !canSpin ? (
                    <div className="bg-slate-900/50 p-3 rounded-lg text-center w-full animate-fade-in">
                        <div className="flex justify-center items-center gap-2">
                            <h3 className="text-md font-bold text-yellow-300">Power Word:</h3>
                            <p className="font-bold text-2xl text-white font-digital tracking-widest">{powerWordData.powerWord.toUpperCase()}</p>
                            <button 
                                onClick={handleShowPowerWordInfo}
                                aria-label="Show Power Word information"
                                className="text-slate-400 hover:text-white text-xl"
                            >
                                ℹ️
                            </button>
                        </div>
                    </div>
                ) : (
                    <p className="text-sm text-slate-400 italic">Spin for your daily Power Word!</p>
                )}
            </div>

            <hr className="w-full border-slate-700/50 my-2" />
            
            <div className="w-full grid grid-cols-2 gap-3">
                <button onClick={handleShowLeaderboard} className="w-full px-4 py-3 text-md font-bold text-cyan-200 border-2 border-cyan-700 rounded-lg shadow-lg hover:bg-cyan-700 hover:text-white transition-all duration-300 flex items-center justify-center gap-2">🏆 Top 50</button>
                <button onClick={onShowHowToPlay} className="w-full px-4 py-3 text-md font-bold text-cyan-200 border-2 border-cyan-700 rounded-lg shadow-lg hover:bg-cyan-700 hover:text-white transition-all duration-300 flex items-center justify-center gap-2">📘 How to Play</button>
                <button onClick={handleShowEventLogs} className="w-full px-4 py-3 text-md font-bold text-green-200 border-2 border-green-700 rounded-lg shadow-lg hover:bg-green-700 hover:text-white transition-all duration-300 flex items-center justify-center gap-2">📜 Event Logs</button>
                <button onClick={handleShowMissedWords} className="w-full px-4 py-3 text-md font-bold text-red-200 border-2 border-red-700 rounded-lg shadow-lg hover:bg-red-700 hover:text-white transition-all duration-300 flex items-center justify-center gap-2">🧠 Missed Words</button>
            </div>
        </div>
        
        <button 
            onClick={onSpin}
            disabled={!canSpin}
            title={!canSpin ? powerWordService.getCooldownMessage() : 'Spin for your daily Power Word!'}
            className="absolute bottom-6 right-6 w-16 h-16 bg-yellow-400 text-slate-900 rounded-full shadow-lg flex items-center justify-center transform hover:scale-110 transition-transform disabled:bg-slate-600 disabled:cursor-not-allowed disabled:transform-none"
        >
            <span className={`text-3xl ${canSpin ? 'animate-spin' : ''}`}>💥</span>
        </button>
        
        <p className="absolute bottom-2 w-full left-0 text-center text-amber-400 text-xs">Version 6.5</p>
      </div>
    </>
  );
};

export default StartScreen;
