
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
import { todaysRun, dailyRecord, dailyShareText } from '../daily';
import { DAILY_RUN, DAILY_RESET_HOUR } from '../../config/progression';
import { showToast } from '../toast';
import MissionsPanel from '../../components/MissionsPanel';
import { getTodaysMissions } from '../missions';
import { levelFor } from '../rules';
import StreakPanel from '../../components/StreakPanel';
import { BadgeIcon, TitleText } from '../../components/PlayerPlate';
import { getProfile, currentStreak, playedToday, powerWordBonusFor } from '../progression';


interface StartScreenProps {
  onPlay: (name: string) => void;
  /** Today's Daily Run (v7.30): starts, resumes or practices it. */
  onPlayDaily: (name: string) => void;
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
  onPlayDaily,
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
  // Today's Daily Run for the current player: whether it's been played, and any unfinished save.
  const today = useMemo(() => todaysRun(), [profileVersion, playerVersion]);
  const todayRecord = useMemo(() => dailyRecord(today.key), [today]);
  const dailySave = useMemo(() => {
    const saved = storage.getJSON<any>(STORAGE_KEYS.savedDailyGame, null);
    return saved?.gameScreenState?.gameState?.daily?.key === today.key ? saved as { playerName: string } : null;
  }, [today]);
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
  const [savedGame, setSavedGame] = useState<{ playerName: string; gameScreenState?: any } | null>(null);
  // The name field only shows for a new player (first launch, or "New Player" from the switcher);
  // after that the top bar's player chip shows who's playing.
  const showNameEntry = !name.trim() || isNewName;
  // A saved regular run makes the main button CONTINUE, with a hint of where the run is.
  const continueRun = useMemo(() => {
    if (!savedGame?.gameScreenState?.gameState) return null;
    const gs = savedGame.gameScreenState.gameState;
    const words = (gs.log ?? []).filter((e: any) => e.type === 'word' && e.status === 'valid').length;
    return { label: `${savedGame.playerName} · LV ${levelFor(words)} · ${(gs.score ?? 0).toLocaleString()} PTS` };
  }, [savedGame]);
  
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);
  const [leaderboardSource, setLeaderboardSource] = useState<LeaderboardSource>('local');
  const [leaderboardOfflineReason, setLeaderboardOfflineReason] = useState<string | undefined>();
  // The Top 50 has two boards: all-time, and today's Daily Run.
  const [leaderboardTab, setLeaderboardTab] = useState<'all' | 'daily'>('all');

  const [showEventLogsModal, setShowEventLogsModal] = useState(false);
  const [eventLogs, setEventLogs] = useState<FinalGameState[]>([]);
  const [selectedRun, setSelectedRun] = useState<FinalGameState | null>(null);

  const [showMissedWordsModal, setShowMissedWordsModal] = useState(false);
  const [missedWords, setMissedWords] = useState<MissedWord[]>([]);
  
  const [showPowerWordInfo, setShowPowerWordInfo] = useState(false);
  // v7.31 layout: the Collect / Me bottom sheets and the missions row's expanded panel.
  const [sheet, setSheet] = useState<'collect' | 'me' | null>(null);
  const [showMissions, setShowMissions] = useState(false);
  const missionSummary = useMemo(() => {
    const { missions } = getTodaysMissions();
    return { done: missions.filter(m => m.done).length, total: missions.length };
  }, [playerVersion, profileVersion]);

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
    const { entries, source, offlineReason } = leaderboardTab === 'daily'
      ? await leaderboardService.getDailyLeaderboard(today.key, { retry })
      : await leaderboardService.getLeaderboard({ retry });
    setLeaderboardData(entries);
    setLeaderboardSource(source);
    setLeaderboardOfflineReason(offlineReason);
    setIsLoadingLeaderboard(false);
  }, [leaderboardTab, today.key]);

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


  // Starting over erases a saved run, so ask first when there is one.
  const [confirmNewGame, setConfirmNewGame] = useState(false);
  const handlePlayClick = () => {
    if (name.trim() && savedGame && !confirmNewGame) {
      soundService.playUIClick();
      setConfirmNewGame(true);
      return;
    }
    setConfirmNewGame(false);
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
  
  // Before the scored Daily Run starts, a pop-up explains it (one shared deal, one scored try,
  // where the score shows up). Backing out costs nothing: the try is only used once it starts.
  const [showDailyIntro, setShowDailyIntro] = useState(false);
  const startsScoredDaily = !todayRecord && !(dailySave && dailySave.playerName === name.trim());
  // What the Today's Run card shows: not played, an unfinished run to resume, done (with its score),
  // or a try that was started and never finished (replays are practice).
  const dailyState: 'new' | 'resume' | 'done' | 'started' =
    dailySave && dailySave.playerName === name.trim() && todayRecord?.score === undefined ? 'resume'
      : todayRecord?.score !== undefined ? 'done'
      : todayRecord ? 'started'
      : 'new';
  const handleDailyClick = () => {
    if (!name.trim()) return;
    if (startsScoredDaily && !showDailyIntro) {
      soundService.initialize();
      soundService.playUIClick();
      setShowDailyIntro(true);
      return;
    }
    setShowDailyIntro(false);
    soundService.initialize();
    musicService.play();
    soundService.playUIClick();
    onPlayDaily(name.trim());
  };

  const handleShareDaily = async () => {
    if (todayRecord?.score === undefined) return;
    const text = dailyShareText(today, { score: todayRecord.score, level: todayRecord.level ?? 1, bosses: todayRecord.bosses, rank: todayRecord.rank });
    try {
      if (navigator.share) { await navigator.share({ text }); return; }
      await navigator.clipboard.writeText(text);
      showToast('Copied! Paste it anywhere.');
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') showToast("Couldn't share from this browser.");
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
      {showDailyIntro && (
        <div className="absolute inset-0 z-50 bg-crt-950/85 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" role="dialog" aria-modal="true" aria-label={`Today's Run #${today.number}`}>
          <div className="bg-crt-900 border-2 border-neon-cyan shadow-glow-cyan rounded-2xl p-5 max-w-sm w-full text-center flex flex-col gap-3 bonus-insert">
            <p className="osd-text text-lg tracking-[0.3em] text-slate-300">HEADS UP, WORD NERD</p>
            <div className="text-5xl leading-none" aria-hidden="true">📅</div>
            <h2 className="font-display text-2xl text-neon-cyan leading-tight">Today's Run #{today.number}</h2>
            <p className="text-slate-200 leading-snug">
              You're about to start <strong className="text-white">Today's Run</strong>. Everyone in the world gets the
              <strong className="text-white"> same tiles, offers and bosses</strong> today, so it's a fair fight.
            </p>
            <ul className="text-left text-sm text-slate-200 space-y-1.5 rounded-lg bg-crt-950/70 ring-1 ring-white/10 p-3">
              <li>🎯 <strong className="text-white">One scored try.</strong> Once you start, this is the one that counts. Replays later are just practice.</li>
              <li>📅 Your score goes on <strong className="text-white">today's Daily board</strong>, and you can add it to the <strong className="text-white">🏆 Top 50</strong> too.</li>
              <li>🪙 Finish for <strong className="text-neon-yellow">+{DAILY_RUN.finishCredits} Credits</strong>, plus <strong className="text-neon-yellow">+{DAILY_RUN.topCredits}</strong> for a top-{DAILY_RUN.topRank} finish.</li>
            </ul>
            <p className="osd-text text-lg text-neon-yellow leading-none">READY TO STEP UP TO THE MIC?</p>
            <ArcadeButton color="cyan" size="lg" className="w-full" onClick={handleDailyClick}>▶ Start</ArcadeButton>
            <button type="button" className="osd-text text-lg text-slate-400 underline leading-tight" onClick={() => { soundService.playUIClick(); setShowDailyIntro(false); }}>
              Not yet. Save it for later
            </button>
            <p className="text-xs text-slate-500">Backing out doesn't use your try. It's here until the {DAILY_RESET_HOUR} AM reset.</p>
          </div>
        </div>
      )}
      {confirmNewGame && savedGame && (
        <div className="absolute inset-0 z-50 bg-crt-950/85 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" role="dialog" aria-modal="true" aria-label="Start a new game?">
          <div className="bg-crt-900 border-2 border-neon-yellow rounded-2xl p-6 max-w-sm w-full text-center flex flex-col gap-3">
            <h2 className="font-display text-2xl text-neon-yellow">Run in progress!</h2>
            <p className="text-slate-200">{savedGame.playerName}'s run is saved. Starting a new game will erase it.</p>
            <ArcadeButton color="green" className="w-full" onClick={() => { setConfirmNewGame(false); handleResumeClick(); }}>⏯ Resume the run</ArcadeButton>
            <ArcadeButton color="red" className="w-full" onClick={handlePlayClick}>Start over</ArcadeButton>
            <button type="button" className="osd-text text-lg text-slate-400 underline" onClick={() => setConfirmNewGame(false)}>Cancel</button>
          </div>
        </div>
      )}
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
            <div className="grid grid-cols-2 gap-2 mb-2" role="tablist" aria-label="Leaderboards">
              {(['all', 'daily'] as const).map(tab => (
                <button key={tab} type="button" role="tab" aria-selected={leaderboardTab === tab}
                  onClick={() => { soundService.playUIClick(); setLeaderboardTab(tab); }}
                  className={`osd-text text-lg leading-none rounded-lg py-2 ring-1 ${leaderboardTab === tab ? 'bg-neon-pink/25 ring-neon-pink text-white' : 'ring-white/15 text-slate-400'}`}>
                  {tab === 'all' ? '🏆 ALL-TIME' : `📅 TODAY #${today.number}`}
                </button>
              ))}
            </div>
            <Leaderboard key={leaderboardTab} data={leaderboardData} isLoading={isLoadingLeaderboard} source={leaderboardSource} offlineReason={leaderboardOfflineReason} onRetry={() => fetchLeaderboard(true)} />
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


      {/* --- START SCREEN (v7.31): top bar, logo, one Play card, Today's Run, a Today strip, bottom tabs --- */}
      <div className="flex flex-col min-h-full text-center">
        {/* Top bar: who's playing (tap to switch, add a player or see your ID), streak, credits, sound. */}
        <div className="flex items-center justify-between gap-2 shrink-0 px-4 pt-4">
          <button
            type="button"
            onClick={() => { soundService.playUIClick(); setShowSwitcher(true); }}
            className="min-w-0 flex items-center gap-1.5 bg-crt-950/70 ring-1 ring-neon-cyan/50 hover:ring-neon-cyan pl-2 pr-3 py-1.5 rounded-full"
            aria-label={name.trim() ? `Playing as ${name.trim()}. Switch player` : 'Choose a player'}
          >
            {profile.badge ? <BadgeIcon id={profile.badge} size="sm" /> : <span className="text-lg leading-none" aria-hidden="true">👤</span>}
            <span className="osd-text text-xl leading-none text-neon-cyan uppercase truncate max-w-[7rem]">{showNameEntry ? 'NEW PLAYER' : name.trim()}</span>
            <span className="text-slate-400 text-xs" aria-hidden="true">▾</span>
          </button>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => { soundService.playUIClick(); setShowStreak(true); }}
              className={`flex items-center gap-1 pl-2 pr-2.5 py-1.5 rounded-full ring-1 ${bankedToday ? 'bg-neon-orange/15 ring-neon-orange' : 'bg-crt-950/70 ring-neon-orange/50 hover:ring-neon-orange'}`}
              aria-label={`Daily streak: ${streak} days${bankedToday ? ', today banked' : ''}`}
            >
              <span className={`text-lg leading-none ${streak > 0 && !bankedToday ? 'animate-pulse' : ''}`} aria-hidden="true">🔥</span>
              <span className="osd-text text-xl leading-none text-neon-orange">{streak}</span>
            </button>
            <button onClick={onShowVibez} className="flex items-center gap-1 bg-crt-950/70 ring-1 ring-neon-yellow/50 hover:ring-neon-yellow pl-2 pr-2.5 py-1.5 rounded-full" aria-label={`${lexCoins} credits. Open the shop`}>
              <span className="text-lg leading-none" aria-hidden="true">🪙</span>
              <span className="osd-text text-xl leading-none text-neon-yellow">{lexCoins}</span>
            </button>
            <button onClick={handleMuteToggle} className="text-xl text-slate-400 hover:text-white p-1.5" aria-label={isMuted ? 'Sound off. Turn on' : 'Sound on. Turn off'}>
              {isMuted ? '🔇' : '🔊'}
            </button>
          </div>
        </div>

        <div className="flex-1 w-full max-w-sm mx-auto flex flex-col items-center gap-3 px-4 pt-3 pb-4">
          {/* Logo: the hero, centered in the space above the actions; smaller than before, same neon. */}
          <div className="flex-1 flex flex-col items-center justify-center text-center min-h-[9rem]">
            <h1 className="font-display text-4xl min-[375px]:text-5xl [@media(min-height:760px)]:text-6xl tracking-widest neon-text-cyan neon-flicker animate-slide-in-down leading-none">WORD</h1>
            <h2 className="font-display text-6xl min-[375px]:text-7xl [@media(min-height:760px)]:text-8xl tracking-normal marquee-3d animate-bounce-in-up leading-none" style={{ animationDelay: '0.1s' }}>NERD</h2>
            <p className="osd-text text-lg text-neon-pink mt-1 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>SERIOUS WORDS. RIDICULOUS FUN.</p>
          </div>

          {/* Play card: one main action. A saved run makes it CONTINUE; New Game drops to an outline button. */}
          <section className="w-full flex flex-col gap-2.5" aria-label="Play">
            {showNameEntry && (
              <div className="w-full flex flex-col gap-1">
                <input
                  id="player-name"
                  type="text"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Enter Your Name"
                  maxLength={12}
                  aria-label="Player name"
                  className="w-full px-4 py-2 font-osd text-3xl uppercase tracking-widest text-center bg-crt-950/80 border-2 border-neon-cyan/50 rounded-lg focus:outline-none focus:border-neon-cyan focus:shadow-glow-cyan text-neon-cyan placeholder:text-neon-cyan/40 placeholder:normal-case"
                />
                <p className="osd-text text-base leading-none text-slate-400">{isNewName ? '✨ NEW PLAYER · PRESS START TO MAKE YOUR ID' : 'ENTER YOUR NAME TO PLAY'}</p>
              </div>
            )}
            {continueRun ? (
              <>
                <ArcadeButton color="yellow" size="lg" className="w-full flex-col !gap-0" onClick={handleResumeClick}>
                  <span>▶ Continue</span>
                  <span className="osd-text text-base leading-none normal-case tracking-normal opacity-80">{continueRun.label}</span>
                </ArcadeButton>
                <ArcadeButton color="yellow" variant="outline" className="w-full" disabled={!name.trim()} onClick={handlePlayClick}>New Game</ArcadeButton>
              </>
            ) : (
              <>
                <ArcadeButton color="yellow" size="lg" className="w-full" disabled={!name.trim()} onClick={handlePlayClick}>▶ New Game</ArcadeButton>
                {!showNameEntry && <p className="osd-text text-lg leading-none text-neon-yellow blink -mt-1">PRESS START</p>}
              </>
            )}
          </section>

          {/* Today's Run: one shared deal a day. Its own card so it reads as a separate mode. */}
          <section className="w-full rounded-xl bg-crt-950/70 ring-1 ring-neon-cyan/50 p-3 text-left flex items-center gap-3" aria-label={`Today's Run number ${today.number}`}>
            <span className="text-3xl leading-none" aria-hidden="true">📅</span>
            <div className="flex-1 min-w-0">
              <p className="font-display text-base leading-tight text-neon-cyan">TODAY'S RUN #{today.number}</p>
              <p className="osd-text text-base leading-tight text-slate-300">
                {dailyState === 'resume' ? 'UNFINISHED · PICK UP WHERE YOU LEFT OFF'
                  : dailyState === 'done' ? `${todayRecord!.score!.toLocaleString()} PTS${todayRecord!.rank ? ` · #${todayRecord!.rank} TODAY` : ''}`
                  : dailyState === 'started' ? 'TRY USED · REPLAY AS PRACTICE'
                  : 'SAME DEAL FOR EVERYONE. ONE SCORED TRY.'}
              </p>
            </div>
            {dailyState === 'done' ? (
              <div className="flex flex-col gap-1.5 shrink-0">
                <ArcadeButton color="cyan" size="sm" onClick={handleShareDaily}>Share</ArcadeButton>
                <ArcadeButton color="cyan" variant="outline" size="sm" disabled={!name.trim()} onClick={handleDailyClick}>Practice</ArcadeButton>
              </div>
            ) : (
              <ArcadeButton color="cyan" size="sm" className="shrink-0" disabled={!name.trim()} onClick={handleDailyClick}>
                {dailyState === 'resume' ? '⏯ Resume' : dailyState === 'started' ? 'Practice' : '▶ Play'}
              </ArcadeButton>
            )}
          </section>

          {/* Today strip: the daily rituals side by side. */}
          <section className="w-full grid grid-cols-2 gap-2" aria-label="Today">
            {canSpin ? (
              <button type="button" onClick={onSpin} className="flex items-center justify-center gap-2 rounded-xl ring-1 ring-neon-pink/60 bg-neon-pink/10 hover:bg-neon-pink/20 px-2 py-2.5" aria-label="Spin for your daily Power Word">
                <span className="text-xl leading-none animate-spin" aria-hidden="true">💥</span>
                <span className="osd-text text-base min-[390px]:text-lg leading-none text-neon-pink whitespace-nowrap">SPIN POWER WORD</span>
              </button>
            ) : (
              <button type="button" onClick={handleShowPowerWordInfo} disabled={!powerWordData} className="flex items-center justify-center gap-1.5 rounded-xl ring-1 ring-neon-pink/40 bg-crt-950/70 px-2 py-2.5 min-w-0" aria-label={powerWordData ? `Power Word: ${powerWordData.powerWord}. Show info` : powerWordService.getCooldownMessage()}>
                <span className="text-lg leading-none" aria-hidden="true">💥</span>
                <span className="osd-text text-lg leading-none text-slate-300 truncate">{powerWordData ? powerWordData.powerWord.toUpperCase() : 'SPUN'}</span>
                {powerWordData && <span className="text-xs text-slate-500" aria-hidden="true">ⓘ</span>}
              </button>
            )}
            <button type="button" onClick={() => { soundService.playUIClick(); setShowMissions(v => !v); }} aria-expanded={showMissions}
              className={`flex items-center justify-center gap-1.5 rounded-xl ring-1 px-2 py-2.5 ${missionSummary.done === missionSummary.total ? 'ring-neon-green/60 bg-neon-green/10' : 'ring-neon-cyan/40 bg-crt-950/70'}`}
              aria-label={`Missions: ${missionSummary.done} of ${missionSummary.total} done. ${showMissions ? 'Hide' : 'Show'}`}>
              <span className="text-lg leading-none" aria-hidden="true">🎯</span>
              <span className="osd-text text-base min-[390px]:text-lg leading-none text-neon-cyan whitespace-nowrap">MISSIONS {missionSummary.done}/{missionSummary.total}</span>
              <span className="text-xs text-slate-400" aria-hidden="true">{showMissions ? '▴' : '▾'}</span>
            </button>
          </section>
          {showMissions && <MissionsPanel />}
        </div>

        {/* Bottom tabs: everything that isn't playing, in the thumb zone. */}
        <nav className="sticky bottom-0 z-20 shrink-0 grid grid-cols-5 border-t border-white/10 bg-crt-950/95 backdrop-blur-sm" aria-label="Menu">
          {([
            { icon: '🏠', label: 'PLAY', onClick: undefined, current: true },
            { icon: '🏆', label: 'TOP 50', onClick: handleShowLeaderboard },
            { icon: '📼', label: 'COLLECT', onClick: () => { soundService.playUIClick(); setSheet('collect'); } },
            { icon: '🛒', label: 'SHOP', onClick: onShowVibez },
            { icon: '🪪', label: 'ME', onClick: () => { soundService.playUIClick(); setSheet('me'); } },
          ] as const).map(tab => (
            <button key={tab.label} type="button" onClick={tab.onClick} aria-current={'current' in tab ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 py-2 min-h-[3.5rem] ${'current' in tab ? 'text-neon-yellow' : 'text-slate-400 hover:text-white'}`}>
              <span className="text-xl leading-none" aria-hidden="true">{tab.icon}</span>
              <span className="osd-text text-sm leading-none">{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Bottom sheets for the Collect and Me tabs. */}
      {sheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-crt-950/80 backdrop-blur-sm animate-fade-in" role="dialog" aria-modal="true" aria-label={sheet === 'collect' ? 'Collection' : 'Me'} onClick={() => setSheet(null)}>
          <div className="w-full max-w-xl rounded-t-2xl bg-crt-900 ring-1 ring-white/15 p-4 pb-6 flex flex-col gap-3 bonus-insert" onClick={e => e.stopPropagation()}>
            <div className="mx-auto h-1 w-10 rounded-full bg-white/20" aria-hidden="true" />
            {sheet === 'collect' ? (
              <>
                <h2 className="font-display text-xl text-neon-pink text-center">COLLECTION</h2>
                <button type="button" onClick={() => { setSheet(null); onShowCollection(); }} className="flex items-center gap-3 rounded-xl ring-1 ring-neon-pink/50 bg-crt-950/70 p-3 text-left hover:bg-neon-pink/10">
                  <span className="text-3xl" aria-hidden="true">📼</span>
                  <span className="flex-1"><span className="block font-display text-base text-white">Secret Bonuses</span><span className="osd-text text-base text-slate-400">HIDDEN WORDS AND SCORES YOU'VE FOUND</span></span>
                  <span className="font-osd text-2xl text-neon-pink">{collection.found}/{collection.total}</span>
                </button>
                <button type="button" onClick={() => { setSheet(null); onShowBadgeCase(); }} className="flex items-center gap-3 rounded-xl ring-1 ring-neon-red/50 bg-crt-950/70 p-3 text-left hover:bg-neon-red/10">
                  <span className="text-3xl" aria-hidden="true">🏅</span>
                  <span className="flex-1"><span className="block font-display text-base text-white">Boss Badges</span><span className="osd-text text-base text-slate-400">ONE FOR EACH BOSS YOU'VE BEATEN</span></span>
                  <span className="font-osd text-2xl text-neon-red">{profile.bossBadges.length}/{BOSSES.length}</span>
                </button>
              </>
            ) : (
              <>
                <h2 className="font-display text-xl text-neon-cyan text-center">{name.trim() ? name.trim().toUpperCase() : 'ME'}</h2>
                <ul className="flex flex-col divide-y divide-white/10 rounded-xl ring-1 ring-white/10 bg-crt-950/60 overflow-hidden">
                  {[
                    { icon: '🪪', label: 'My ID', onClick: () => { setSheet(null); onShowProfile(); } },
                    { icon: '🏷️', label: 'Badge & Title', onClick: () => { setSheet(null); onShowVibez(); } },
                    { icon: '👥', label: 'Switch Player', onClick: () => { setSheet(null); setShowSwitcher(true); } },
                    { icon: '🔥', label: 'Streak', onClick: () => { setSheet(null); setShowStreak(true); } },
                    { icon: '📘', label: 'How to Play', onClick: () => { setSheet(null); onShowHowToPlay(); } },
                    { icon: '📼', label: 'Event Logs', onClick: () => { setSheet(null); handleShowEventLogs(); } },
                    { icon: '🧠', label: 'Missed Words', onClick: () => { setSheet(null); handleShowMissedWords(); } },
                  ].map(item => (
                    <li key={item.label}>
                      <button type="button" onClick={() => { soundService.playUIClick(); item.onClick(); }} className="w-full flex items-center gap-3 px-4 min-h-[3rem] text-left hover:bg-white/5">
                        <span className="text-xl leading-none" aria-hidden="true">{item.icon}</span>
                        <span className="flex-1 font-display text-base text-slate-100">{item.label}</span>
                        <span className="text-slate-500" aria-hidden="true">›</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="osd-text text-center text-neon-cyan/60 text-base">VER {__APP_VERSION__}</p>
              </>
            )}
            <ArcadeButton color="slate" variant="text" className="mx-auto" onClick={() => setSheet(null)}>Close</ArcadeButton>
          </div>
        </div>
      )}
    </>
  );
};

export default StartScreen;
