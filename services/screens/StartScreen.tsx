
import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import ArcadeButton from '../../components/ArcadeButton';
import { collectionProgress } from '../collection';
import { BOSSES } from '../../data/bosses';
import { listPlayers, switchToPlayer, currentPlayer, sameName } from '../players';
import { storage, STORAGE_KEYS } from '../storage';
import MissionsPanel from '../../components/MissionsPanel';
import StreakPanel from '../../components/StreakPanel';
import { BadgeIcon, TitleText } from '../../components/PlayerPlate';
import { getProfile, currentStreak, playedToday, powerWordBonusFor } from '../progression';


interface StartScreenProps {
  onPlay: (name: string) => void;
  onResumeGame: (name: string) => void;
  onShowHowToPlay: () => void;
  onShowVibez: () => void;
  onShowCollection: () => void;
  onShowBadgeCase: () => void;
  onShowProfile: () => void;
  lexCoins: number;
  autoShowLeaderboard: boolean;
  setAutoShowLeaderboard: (show: boolean) => void;
  rankingModalData: { rank: number; name: string; score: number } | null;
  setRankingModalData: (data: { rank: number; name: string; score: number } | null) => void;
  powerWordData: PowerWordData | null;
  canSpin: boolean;
  onSpin: () => void;
  /** Changes whenever badges, titles or freezes change, so the profile is re-read. */
  profileVersion?: number;
  onBuyFreeze: () => void;
}

const StartScreen: React.FC<StartScreenProps> = ({ 
  onPlay, 
  onResumeGame, 
  onShowHowToPlay, 
  onShowVibez, 
  onShowCollection,
  onShowBadgeCase,
  onShowProfile,
  lexCoins, 
  autoShowLeaderboard, 
  setAutoShowLeaderboard,
  rankingModalData,
  setRankingModalData,
  powerWordData,
  canSpin,
  onSpin,
  profileVersion = 0,
  onBuyFreeze,
}) => {
  // Bumped when a different local player takes over, so their own profile and saves are read.
  const [playerVersion, setPlayerVersion] = useState(0);
  const [showSwitcher, setShowSwitcher] = useState(false);
  const profile = useMemo(() => getProfile(), [profileVersion, playerVersion]);
  const streak = currentStreak(profile);
  const bankedToday = playedToday(profile);
  const [showStreak, setShowStreak] = useState(false);
  const [name, setName] = useState(() => storage.getString(STORAGE_KEYS.playerName) || '');
  const [isMuted, setIsMuted] = useState(soundService.getMuteState());
  const collection = useMemo(() => collectionProgress(), [playerVersion]);
  const players = useMemo(() => listPlayers(), [playerVersion, showSwitcher]);
  const isNewName = !!name.trim() && !players.some(p => sameName(p.name, name));
  const choosePlayer = (playerName: string) => {
    switchToPlayer(playerName);
    setName(playerName);
    setPlayerVersion(v => v + 1);
  };
  // Typing a name that's already on this device switches to that player right away.
  const handleNameChange = (value: string) => {
    setName(value);
    if (players.some(p => sameName(p.name, value)) && !sameName(currentPlayer().name, value)) {
      switchToPlayer(value);
      setPlayerVersion(v => v + 1);
    }
  };
  const [savedGame, setSavedGame] = useState<{playerName: string} | null>(null);
  
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);
  const [leaderboardSource, setLeaderboardSource] = useState<LeaderboardSource>('local');
  const [leaderboardOfflineReason, setLeaderboardOfflineReason] = useState<string | undefined>();

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
  
  const fetchLeaderboard = useCallback(async (retry = false) => {
    setIsLoadingLeaderboard(true);
    const { entries, source, offlineReason } = await leaderboardService.getLeaderboard({ retry });
    setLeaderboardData(entries);
    setLeaderboardSource(source);
    setLeaderboardOfflineReason(offlineReason);
    setIsLoadingLeaderboard(false);
  }, []);

  useEffect(() => {
    if (showLeaderboardModal) fetchLeaderboard();
  }, [showLeaderboardModal, fetchLeaderboard]);

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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-crt-900 border-2 border-neon-pink shadow-glow-pink rounded-2xl p-4 text-center max-w-md w-full flex flex-col modal-max-h bonus-insert">
            <Leaderboard data={leaderboardData} isLoading={isLoadingLeaderboard} source={leaderboardSource} offlineReason={leaderboardOfflineReason} onRetry={() => fetchLeaderboard(true)} />
            <ArcadeButton color="yellow" className="w-full mt-4" onClick={handleCloseLeaderboard}>Close</ArcadeButton>
          </div>
        </div>
      )}

      {showSwitcher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-crt-950/85 backdrop-blur-sm animate-fade-in" role="dialog" aria-modal="true" aria-label="Who's playing?">
          <div className="w-full max-w-sm rounded-2xl bg-crt-900 ring-2 ring-neon-cyan/60 p-4 flex flex-col gap-3">
            <h2 className="font-display text-2xl text-center neon-text-cyan">WHO'S PLAYING?</h2>
            <p className="osd-text text-base text-center text-slate-400 leading-tight">EACH PLAYER HAS THEIR OWN ID, STREAK AND BADGES. CREDITS ARE SHARED.</p>
            <ul className="flex flex-col gap-2 max-h-[45vh] overflow-y-auto">
              {players.map(p => {
                const isCurrent = sameName(p.name, name) || (!name.trim() && p.slot === currentPlayer().slot);
                return (
                  <li key={p.slot}>
                    <button
                      type="button"
                      onClick={() => { soundService.playUIClick(); choosePlayer(p.name); setShowSwitcher(false); }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg ring-1 ${isCurrent ? 'bg-neon-cyan/15 ring-neon-cyan' : 'bg-crt-950/80 ring-white/10 hover:ring-neon-cyan/50'}`}
                    >
                      <span className="font-osd text-2xl uppercase tracking-wider text-neon-cyan truncate">{p.name}</span>
                      {isCurrent && <span className="osd-text text-base text-neon-yellow">PLAYING</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
            <ArcadeButton color="green" className="w-full" onClick={() => {
              soundService.playUIClick();
              setName('');
              setShowSwitcher(false);
              setTimeout(() => document.getElementById('player-name')?.focus(), 50);
            }}>＋ New Player</ArcadeButton>
            <ArcadeButton color="yellow" className="w-full" onClick={() => { soundService.playUIClick(); setShowSwitcher(false); }}>Close</ArcadeButton>
          </div>
        </div>
      )}

      {showEventLogsModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-crt-900 border-2 border-neon-green rounded-2xl p-6 text-center shadow-2xl max-w-md w-full flex flex-col modal-max-h">
            {selectedRun ? (
               <>
                <h2 className="font-display text-2xl text-neon-green mb-2 flex-shrink-0">Viewing Event Log</h2>
                <div className="flex-grow overflow-y-auto pr-2">
                  <EventLogDisplay log={selectedRun.log} />
                </div>
               </>
            ) : (
              <>
                <h2 className="font-display text-2xl text-neon-green mb-2">Event Logs ({eventLogs.length}/{logService.MAX_LOGS})</h2>
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
                           <button onClick={() => handleViewRun(run)} className="px-3 py-1 font-display text-sm text-crt-900 bg-neon-cyan rounded-md hover:brightness-110">VIEW</button>
                           <button onClick={() => handleDeleteRun(run.saveTimestamp!)} className="px-3 py-1 font-display text-sm text-white bg-neon-red rounded-md hover:brightness-110">DELETE</button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center justify-center h-full text-slate-500 italic">No saved event logs yet.</div>
                  )}
                </div>
              </>
            )}
            <ArcadeButton color="green" className="w-full mt-4" onClick={handleCloseEventLogs}>Close</ArcadeButton>
          </div>
        </div>
      )}

      {showMissedWordsModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-crt-900 border-2 border-neon-red rounded-2xl p-6 text-center shadow-2xl max-w-md w-full flex flex-col modal-max-h">
            <h2 className="font-display text-2xl text-neon-pink mb-2">Missed Words ({missedWords.length}/{missedWordsService.MAX_WORDS})</h2>
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
            <ArcadeButton color="pink" className="w-full mt-4" onClick={handleCloseMissedWords}>Close</ArcadeButton>
          </div>
        </div>
      )}

      {showStreak && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" role="dialog" aria-modal="true" aria-label="Daily streak">
          <div className="bg-crt-900 border-2 border-neon-orange rounded-2xl p-4 shadow-2xl max-w-md w-full flex flex-col modal-max-h">
            <h2 className="font-display text-2xl text-neon-orange text-center leading-none mb-2">DAILY STREAK</h2>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-1 -m-1">
              <StreakPanel coins={lexCoins} onBuyFreeze={onBuyFreeze} />
            </div>
            <ArcadeButton color="yellow" className="w-full mt-3" onClick={() => { soundService.playUIClick(); setShowStreak(false); }}>Close</ArcadeButton>
          </div>
        </div>
      )}

      {showPowerWordInfo && powerWordData && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-crt-900 border-2 border-neon-yellow rounded-2xl p-6 text-center shadow-2xl max-w-md w-full flex flex-col">
            <h2 className="font-display text-2xl text-neon-yellow mb-2 flex-shrink-0 flex items-center justify-center gap-3">
              <span className="text-4xl">💥</span>
              <span>Power Word Info</span>
            </h2>
            <div className="flex-grow my-4">
              <p className="font-bold text-3xl text-white font-digital tracking-widest">{powerWordData.powerWord.toUpperCase()}</p>
              <p className="text-slate-300 italic mt-2 mb-4">"{powerWordData.definition}"</p>
              <p className="text-green-400 font-semibold bg-slate-900/50 p-3 rounded-lg">
                Use this word during a run for a <strong className="font-bold">{powerWordBonusFor(streak)} point bonus!</strong>
                {streak > 0 && <span className="block text-sm text-neon-orange mt-1">🔥 Boosted by your {streak}-day streak</span>}
              </p>
            </div>
            <ArcadeButton color="yellow" className="w-full mt-4" onClick={handleClosePowerWordInfo}>Got It</ArcadeButton>
          </div>
        </div>
      )}


      <div className="flex flex-col min-h-full p-4 text-center">
        <div className="flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <button onClick={onShowVibez} className="flex items-center gap-1.5 bg-crt-950/70 ring-1 ring-neon-purple/60 hover:ring-neon-purple pl-2 pr-3 py-1.5 rounded-full transition-shadow shadow-md" aria-label={`Shop. ${lexCoins} credits`}>
                <span className="text-xl" aria-hidden="true">🛒</span>
                <span className="osd-text text-xl leading-none text-neon-yellow">🪙 {lexCoins}</span>
            </button>
            <button
              onClick={() => { soundService.playUIClick(); setShowStreak(true); }}
              className={`flex items-center gap-1 pl-2 pr-3 py-1.5 rounded-full ring-1 shadow-md transition-shadow ${bankedToday ? 'bg-neon-orange/15 ring-neon-orange' : 'bg-crt-950/70 ring-neon-orange/50 hover:ring-neon-orange'}`}
              aria-label={`Daily streak: ${streak} days${bankedToday ? ', today banked' : ''}`}
            >
                <span className={`text-xl ${streak > 0 && !bankedToday ? 'animate-pulse' : ''}`} aria-hidden="true">🔥</span>
                <span className="osd-text text-xl leading-none text-neon-orange">{streak}</span>
            </button>
          </div>
          <button onClick={handleMuteToggle} className="text-2xl text-slate-400 hover:text-white p-2 transition-transform hover:scale-110">
            {isMuted ? '🔇' : '🔊'}
          </button>
        </div>

        <div className="w-full max-w-sm mx-auto flex flex-col items-center gap-4 my-auto py-4">
            <div className="text-center">
                <h1 className="font-display text-5xl min-[375px]:text-6xl md:text-7xl tracking-widest neon-text-cyan neon-flicker animate-slide-in-down">
                    WORD
                </h1>
                <h2
                    className="font-display text-7xl min-[375px]:text-8xl tracking-normal -mt-1 marquee-3d animate-bounce-in-up"
                    style={{ animationDelay: '0.1s' }}
                >
                    NERD
                </h2>
                <p className="osd-text text-xl text-neon-pink mt-3 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>SERIOUS WORDS. RIDICULOUS FUN.</p>
            </div>
            
            <div className="w-full flex gap-2">
              <input
                id="player-name"
                type="text"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Enter Your Name"
                maxLength={12}
                aria-label="Player name"
                className="min-w-0 flex-1 px-4 py-2 font-osd text-3xl uppercase tracking-widest text-center bg-crt-950/80 border-2 border-neon-cyan/50 rounded-lg focus:outline-none focus:border-neon-cyan focus:shadow-glow-cyan transition-shadow duration-200 text-neon-cyan placeholder:text-neon-cyan/40 placeholder:normal-case"
              />
              <button
                type="button"
                onClick={() => { soundService.playUIClick(); setShowSwitcher(true); }}
                className="shrink-0 w-14 rounded-lg bg-crt-950/80 border-2 border-neon-cyan/50 text-2xl hover:border-neon-cyan"
                aria-label={`Switch player. ${players.length} ${players.length === 1 ? 'player' : 'players'} on this device`}
                title="Switch player"
              >👥</button>
            </div>
            {isNewName ? (
              <p className="-mt-2 osd-text text-base leading-none text-neon-yellow min-h-[2rem] flex items-center">✨ NEW PLAYER · PRESS START TO MAKE YOUR ID</p>
            ) : (
              <div className="-mt-2 flex items-center justify-center gap-1 min-h-[2rem]">
                <button
                  onClick={onShowVibez}
                  className="flex items-center justify-center gap-2 min-h-[2rem] px-3 rounded-lg hover:bg-white/5"
                  aria-label="Customize your badge and title"
                >
                  {profile.badge || profile.title ? (
                    <>
                      <BadgeIcon id={profile.badge} size="sm" />
                      <TitleText id={profile.title} className="text-lg leading-none" />
                      <span className="osd-text text-base leading-none text-slate-500">EDIT ›</span>
                    </>
                  ) : (
                    <span className="osd-text text-base leading-none text-neon-purple">🏷️ ADD A BADGE &amp; TITLE ›</span>
                  )}
                </button>
                <button
                  onClick={onShowProfile}
                  className="flex items-center gap-1 min-h-[2rem] px-3 rounded-lg ring-1 ring-neon-cyan/40 hover:bg-white/5"
                  aria-label="See my player ID and stats"
                >
                  <span className="osd-text text-base leading-none text-neon-cyan">🪪 MY ID ›</span>
                </button>
              </div>
            )}
            
            <div className="w-full flex flex-col gap-3 mt-2">
                <ArcadeButton color="yellow" size="lg" className="w-full" disabled={!name.trim()} onClick={handlePlayClick}>
                    ▶ New Game
                </ArcadeButton>
                <p className={`osd-text text-lg leading-none ${name.trim() ? 'text-neon-yellow blink' : 'text-slate-500'}`}>
                    {name.trim() ? 'PRESS START' : 'ENTER YOUR NAME TO PLAY'}
                </p>

                {savedGame && (
                    <ArcadeButton color="green" className="w-full" onClick={handleResumeClick}>
                        ⏯ Resume: {savedGame.playerName}
                    </ArcadeButton>
                )}
            </div>

            <div className="w-full my-2 flex items-center gap-3">
              <div className="flex-1 min-w-0">
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
              <button
                  onClick={onSpin}
                  disabled={!canSpin}
                  title={!canSpin ? powerWordService.getCooldownMessage() : 'Spin for your daily Power Word!'}
                  aria-label="Spin for your daily Power Word"
                  className="arcade-btn shrink-0 w-14 h-14 bg-gradient-to-b from-[#ff86c6] to-neon-pink rounded-full flex items-center justify-center disabled:cursor-not-allowed"
                  style={{ ['--btn-edge' as string]: '#a3175f' }}
              >
                  <span className={`text-3xl ${canSpin ? 'animate-spin' : ''}`}>💥</span>
              </button>
            </div>

            <MissionsPanel />

            <div className="w-full h-px bg-gradient-to-r from-transparent via-neon-pink/60 to-transparent my-1" />
            
            <ArcadeButton color="pink" className="w-full" onClick={onShowCollection} aria-label={`Collection. ${collection.found} of ${collection.total} secrets found`}>
                📼 Collection <span className="font-osd text-2xl leading-none normal-case tracking-normal">{collection.found}/{collection.total}</span>
            </ArcadeButton>

            <ArcadeButton color="red" className="w-full" onClick={onShowBadgeCase} aria-label={`Boss Badges. ${profile.bossBadges.length} of ${BOSSES.length} bosses beaten`}>
                🏅 Boss Badges <span className="font-osd text-2xl leading-none normal-case tracking-normal">{profile.bossBadges.length}/{BOSSES.length}</span>
            </ArcadeButton>

            <div className="w-full grid grid-cols-2 gap-x-3 gap-y-4 pb-1">
                <ArcadeButton color="cyan" size="sm" onClick={handleShowLeaderboard}>🏆 Top 50</ArcadeButton>
                <ArcadeButton color="purple" size="sm" onClick={onShowHowToPlay}>📘 How to Play</ArcadeButton>
                <ArcadeButton color="green" size="sm" onClick={handleShowEventLogs}>📼 Event Logs</ArcadeButton>
                <ArcadeButton color="pink" size="sm" onClick={handleShowMissedWords}>🧠 Missed Words</ArcadeButton>
            </div>
        </div>
        
        <p className="shrink-0 osd-text text-center text-neon-cyan/60 text-base">VER {__APP_VERSION__}</p>
      </div>
    </>
  );
};

export default StartScreen;
