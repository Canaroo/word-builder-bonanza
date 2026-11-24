
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import SoundMenu from '../../components/SoundMenu';
import { SHOP_NEWS } from '../../config/progression';
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
import EndRunCard from '../../components/EndRunCard';
import ArcadeButton from '../../components/ArcadeButton';
import { collectionProgress } from '../collection';
import { BOSSES } from '../../data/bosses';
import { listPlayers, switchToPlayer, currentPlayer, sameName, playerKey } from '../players';
import { storage, STORAGE_KEYS } from '../storage';
import { todaysRun, dailyRecord, dailyShareText } from '../daily';
import { DAILY_RUN, DAILY_RESET_HOUR } from '../../config/progression';
import { showToast } from '../toast';
import MissionsPanel from '../../components/MissionsPanel';
import BottomTabs, { type TabId } from '../../components/BottomTabs';
import ScreenShell from '../../components/ScreenShell';
import { getTodaysMissions } from '../missions';
import { levelFor } from '../rules';
import StreakPanel from '../../components/StreakPanel';
import { BadgeIcon, TitleText } from '../../components/PlayerPlate';
import { getCareer } from '../career';
import { tourSeenBy, markTourSeen } from '../tour';
import { getProfile, currentStreak, playedToday, powerWordBonusFor } from '../progression';


/** Pop-ups another screen can ask the start screen to open (the Me page's switch player, streak, logs...). */
export type StartOpen = 'switcher' | 'streak' | 'logs' | 'missed';

interface StartScreenProps {
  /** Bottom tabs: where each tab goes (App decides). */
  onTab: (tab: TabId) => void;
  /** A pop-up to open as soon as the screen shows, then onOpened clears it. */
  openOnMount?: StartOpen | null;
  onOpened?: () => void;
  onPlay: (name: string) => void;
  /** Today's Daily Run (v7.30): starts, resumes or practices it. */
  onPlayDaily: (name: string) => void;
  onResumeGame: (name: string) => void;
  onShowHowToPlay: () => void;
  /** The 1-minute tour (v7.78.0); fromPlay when it was offered on a new player's first Play. */
  onShowTour: (name: string, fromPlay: boolean) => void;
  onShowVibez: (tab?: string) => void;
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
  onTab,
  openOnMount = null,
  onOpened,
  onResumeGame, 
  onShowHowToPlay, 
  onShowTour,
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
  const [leaderboardTab, setLeaderboardTab] = useState<'all' | 'recent' | 'daily'>('all');

  const [showEventLogsModal, setShowEventLogsModal] = useState(false);
  const [eventLogs, setEventLogs] = useState<FinalGameState[]>([]);
  const [selectedRun, setSelectedRun] = useState<FinalGameState | null>(null);

  const [showMissedWordsModal, setShowMissedWordsModal] = useState(false);
  const [missedWords, setMissedWords] = useState<MissedWord[]>([]);
  
  const [showPowerWordInfo, setShowPowerWordInfo] = useState(false);
  // The missions row's expanded panel.
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
      : leaderboardTab === 'recent'
        ? await leaderboardService.getRecentLeaderboard({ retry })
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
    if (!name.trim()) return;
    // A brand-new player (a new name, or one with no finished runs) is offered the tour once.
    if (!tourSeenBy(name) && (isNewName || getCareer().runs === 0)) {
      soundService.initialize();
      soundService.playUIClick();
      setShowTourOffer(true);
      return;
    }
    playAfterTourCheck();
  };
  const [showTourOffer, setShowTourOffer] = useState(false);
  const answerTourOffer = (take: boolean) => {
    setShowTourOffer(false);
    markTourSeen(name);
    if (take) { onShowTour(name.trim(), true); return; }
    playAfterTourCheck();
  };
  const playAfterTourCheck = () => {
    // One Play button (v7.48): the first Play of the day, while the Daily Challenge is still open,
    // asks which game to start. Picking either answers it for the day; the chip in the Today strip
    // stays as the way back in.
    if (dailyState === 'new' && storage.getString(playerKey(STORAGE_KEYS.dailyChooserDay)) !== today.key) {
      soundService.initialize();
      soundService.playUIClick();
      setShowChooser(true);
      return;
    }
    startRegular();
  };
  const startRegular = () => {
    soundService.initialize(); // Initialize AudioContext on user gesture
    musicService.play();
    soundService.playUIClick();
    onPlay(name.trim());
  };
  const [showChooser, setShowChooser] = useState(false);
  const answerChooser = (choice: 'daily' | 'regular') => {
    storage.setString(playerKey(STORAGE_KEYS.dailyChooserDay), today.key);
    setShowChooser(false);
    if (choice === 'regular') { startRegular(); return; }
    // The chooser already explained the challenge, so it starts straight away.
    soundService.initialize(); musicService.play(); soundService.playUIClick();
    onPlayDaily(name.trim());
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
  // The 🔊 button opens the sound panel (v7.53.0): mute and the music track.
  const [showSound, setShowSound] = useState(false);
  // "New in the shop" banner (v7.53.0): shown until it's tapped, closed, or the shop is visited.
  const [shopNews, setShopNews] = useState(() => storage.getString(STORAGE_KEYS.shopNewsSeen) !== SHOP_NEWS.id);
  const closeShopNews = () => { storage.setString(STORAGE_KEYS.shopNewsSeen, SHOP_NEWS.id); setShopNews(false); };

  // End the saved run (v7.67.5): two confirmations, then it's gone (nothing recorded).
  const [endingSaved, setEndingSaved] = useState(false);
  const endSavedRun = () => {
    storage.remove(STORAGE_KEYS.savedGame);
    // Mark the slot ended, so a copy of that run still open in another window can't write it back.
    storage.setString(STORAGE_KEYS.savedGameOwner, `ended-${Date.now()}`);
    setSavedGame(null);
    setEndingSaved(false);
    showToast('🗑️ Run ended. Ready for a fresh one!');
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

  // Panels opened from the Me page go back there; ones opened here go back home.
  const [fromMe, setFromMe] = useState(false);
  // Another screen asked for one of these pop-ups (the Me page links here).
  useEffect(() => {
    if (!openOnMount) return;
    setFromMe(openOnMount !== 'switcher');
    if (openOnMount === 'switcher') setShowSwitcher(true);
    else if (openOnMount === 'streak') setShowStreak(true);
    else if (openOnMount === 'logs') setShowEventLogsModal(true);
    else if (openOnMount === 'missed') setShowMissedWordsModal(true);
    onOpened?.();
  }, [openOnMount, onOpened]);

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

  // Full-screen panels (v7.32.1) share the menu-screen frame instead of floating pop-ups.
  const panel: 'top50' | 'logs' | 'missed' | 'streak' | null =
    showLeaderboardModal ? 'top50' : showEventLogsModal ? 'logs' : showMissedWordsModal ? 'missed' : showStreak ? 'streak' : null;
  const closePanels = () => {
    setShowLeaderboardModal(false);
    setShowEventLogsModal(false);
    setShowMissedWordsModal(false);
    setShowStreak(false);
    setSelectedRun(null);
  };
  const panelBack = () => {
    if (panel === 'logs' && selectedRun) { setSelectedRun(null); return; }
    closePanels();
    if (fromMe) { setFromMe(false); onTab('me'); }
  };
  const panelTab = (tab: TabId) => {
    if (tab === 'top50') { closePanels(); setFromMe(false); setShowLeaderboardModal(true); return; }
    closePanels();
    setFromMe(false);
    if (tab !== 'play') onTab(tab);
  };

  const renderPanel = () => {
    if (panel === 'top50') return (
      <ScreenShell title="TOP 50" tone="pink" onBack={panelBack} credits={lexCoins} tab="top50" onTab={panelTab} subheader={
        <div className="grid grid-cols-3 gap-1" role="tablist" aria-label="Leaderboards">
          {(['all', 'recent', 'daily'] as const).map(tab => (
            <button key={tab} type="button" role="tab" aria-selected={leaderboardTab === tab}
              onClick={() => { soundService.playUIClick(); setLeaderboardTab(tab); }}
              className={`osd-text text-base min-[375px]:text-lg leading-none rounded-lg py-2 ring-1 whitespace-nowrap ${leaderboardTab === tab ? 'bg-neon-pink/25 ring-neon-pink text-white' : 'ring-white/15 text-slate-400'}`}>
              {tab === 'all' ? '🏆 TOP 50' : tab === 'recent' ? '🕒 RECENT' : `📅 TODAY #${today.number}`}
            </button>
          ))}
        </div>
      }>
        <div className="h-full flex flex-col">
          <Leaderboard key={leaderboardTab} recent={leaderboardTab === 'recent'} data={leaderboardData} isLoading={isLoadingLeaderboard} source={leaderboardSource} offlineReason={leaderboardOfflineReason} onRetry={() => fetchLeaderboard(true)} />
        </div>
      </ScreenShell>
    );
    if (panel === 'logs') return (
      <ScreenShell title={selectedRun ? 'RUN LOG' : 'EVENT LOGS'} onBack={panelBack} credits={lexCoins} tab="me" onTab={panelTab}
        subheader={selectedRun ? undefined : <p className="osd-text text-base leading-none text-slate-400 text-center">{eventLogs.length}/{logService.MAX_LOGS} SAVED · ⭐ PIN ONE TO KEEP IT</p>}>
        {selectedRun ? (
          <div className="text-left"><EventLogDisplay log={selectedRun.log} /></div>
        ) : eventLogs.length > 0 ? (
          <ul className="space-y-2">
            {eventLogs.map(run => (
              <li key={run.saveTimestamp} className="bg-crt-950/70 ring-1 ring-white/10 px-3 py-2 rounded-xl flex items-center gap-2">
                <div className="flex-1 min-w-0 text-left">
                  <p className="flex items-center gap-2">
                    <span className="font-osd text-2xl leading-none text-neon-yellow tabular-nums">{run.score.toLocaleString()}</span>
                    {!run.isViewed && <span className="osd-text text-sm leading-none bg-neon-green text-crt-900 px-1.5 py-0.5 rounded">NEW</span>}
                  </p>
                  <p className="text-xs text-slate-400 truncate">{formatDate(run.saveTimestamp)}</p>
                </div>
                <button onClick={() => handleTogglePin(run.saveTimestamp!)} aria-label={run.isPinned ? 'Unpin this run' : 'Pin this run'} className={`p-1.5 rounded-md text-xl ${run.isPinned ? '' : 'opacity-50 hover:opacity-100'}`}>
                  {run.isPinned ? '🌟' : '⭐'}
                </button>
                <ArcadeButton color="cyan" variant="outline" size="sm" onClick={() => handleViewRun(run)}>View</ArcadeButton>
                <button onClick={() => handleDeleteRun(run.saveTimestamp!)} aria-label="Delete this run" className="p-1.5 rounded-md text-lg text-slate-400 hover:text-neon-red">🗑️</button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="osd-text text-xl text-slate-400 text-center py-12 px-4">NO SAVED RUNS YET. FINISH A RUN TO SEE ITS LOG.</p>
        )}
      </ScreenShell>
    );
    if (panel === 'missed') return (
      <ScreenShell title="MISSED WORDS" tone="pink" onBack={panelBack} credits={lexCoins} tab="me" onTab={panelTab}
        subheader={<p className="osd-text text-base leading-none text-slate-400 text-center">YOUR LAST {missedWordsService.MAX_WORDS} FROM FAILED CHALLENGES</p>}>
        {missedWords.length > 0 ? (
          <ul className="space-y-2">
            {missedWords.map(word => (
              <li key={word.timestamp} className="bg-crt-950/70 ring-1 ring-white/10 px-3 py-2 rounded-xl text-left">
                <p className="font-osd text-2xl leading-none uppercase tracking-wider text-neon-pink">{word.word}</p>
                <p className="text-sm text-slate-300 italic leading-snug mt-0.5">{word.definition}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="osd-text text-xl text-slate-400 text-center py-12 px-4">NO MISSED WORDS YET. KEEP PLAYING!</p>
        )}
      </ScreenShell>
    );
    if (panel === 'streak') return (
      <ScreenShell title="DAILY STREAK" onBack={panelBack} credits={lexCoins} tab={fromMe ? 'me' : 'play'} onTab={panelTab}>
        <div className="p-1 -m-1"><StreakPanel coins={lexCoins} onBuyFreeze={onBuyFreeze} /></div>
      </ScreenShell>
    );
    return null;
  };

  return (
    <>
      {showSound && <SoundMenu isMuted={isMuted} onToggleMute={handleMuteToggle} onClose={() => setShowSound(false)} onShop={() => { setShowSound(false); onShowVibez('music'); }} />}
      {showTourOffer && (
        <div className="absolute inset-0 z-50 bg-crt-950/85 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" role="dialog" aria-modal="true" aria-label="New here?" data-testid="tour-offer">
          <div className="bg-crt-900 border-2 border-neon-cyan shadow-glow-cyan rounded-2xl p-5 max-w-sm w-full text-center flex flex-col gap-3 bonus-insert">
            <p className="osd-text text-lg tracking-[0.3em] text-slate-300">INSERT COIN... OR NOT</p>
            <div className="text-5xl leading-none" aria-hidden="true">🕹️</div>
            <h2 className="font-display text-2xl text-neon-cyan leading-tight">New here?</h2>
            <p className="text-slate-200 text-[15px] leading-snug">Take the 1-minute tour: spell a word, watch it score and learn how the clock works. No pressure, nothing counts.</p>
            <ArcadeButton color="cyan" size="lg" className="w-full" onClick={() => answerTourOffer(true)}>❓ Take the tour</ArcadeButton>
            <ArcadeButton color="yellow" variant="text" className="w-full" onClick={() => answerTourOffer(false)}>Skip, just play</ArcadeButton>
            <p className="text-xs text-slate-500 leading-snug">The tour stays under the logo if you want it later.</p>
          </div>
        </div>
      )}
      {showChooser && (
        <div className="absolute inset-0 z-50 bg-crt-950/85 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" role="dialog" aria-modal="true" aria-label="Which game?">
          <div className="bg-crt-900 border-2 border-neon-yellow shadow-glow-yellow rounded-2xl p-5 max-w-sm w-full text-center flex flex-col gap-3 bonus-insert">
            <p className="osd-text text-lg tracking-[0.3em] text-slate-300">FIRST GAME TODAY</p>
            <h2 className="font-display text-2xl text-neon-yellow leading-tight">Which game?</h2>
            <button type="button" onClick={() => answerChooser('daily')} aria-label={`Daily Challenge number ${today.number}`}
              className="w-full text-left rounded-xl p-3 ring-2 ring-neon-cyan bg-neon-cyan/10 hover:bg-neon-cyan/20 flex gap-3 items-start outline-none focus-visible:ring-white">
              <span className="text-3xl leading-none" aria-hidden="true">🏆</span>
              <span className="flex-1">
                <span className="block font-display text-lg text-neon-cyan leading-tight">Daily Challenge #{today.number}</span>
                <span className="block text-sm text-slate-200 leading-snug mt-0.5">
                  <strong className="text-white">Same tiles for everyone today.</strong> Your one shot at today's Daily board, +{DAILY_RUN.finishCredits} Credits (+{DAILY_RUN.topCredits} more for a top {DAILY_RUN.topRank}).
                </span>
              </span>
            </button>
            <button type="button" onClick={() => answerChooser('regular')} aria-label="Regular game"
              className="w-full text-left rounded-xl p-3 ring-2 ring-neon-yellow/70 bg-crt-950/70 hover:bg-neon-yellow/10 flex gap-3 items-start outline-none focus-visible:ring-white">
              <span className="text-3xl leading-none" aria-hidden="true">🎲</span>
              <span className="flex-1">
                <span className="block font-display text-lg text-neon-yellow leading-tight">Regular game</span>
                <span className="block text-sm text-slate-200 leading-snug mt-0.5">Fresh random tiles. Play as many as you like; your best still goes on the Top 50.</span>
              </span>
            </button>
            <p className="text-xs text-slate-500 leading-snug">Not feeling it today? The Daily Challenge waits under Play until the {DAILY_RESET_HOUR} AM reset.</p>
            <button type="button" className="osd-text text-lg text-slate-400 underline leading-tight" onClick={() => { soundService.playUIClick(); setShowChooser(false); }}>Back</button>
          </div>
        </div>
      )}
      {showDailyIntro && (
        <div className="absolute inset-0 z-50 bg-crt-950/85 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" role="dialog" aria-modal="true" aria-label={`Daily Challenge #${today.number}`}>
          <div className="bg-crt-900 border-2 border-neon-cyan shadow-glow-cyan rounded-2xl p-5 max-w-sm w-full text-center flex flex-col gap-3 bonus-insert">
            <p className="osd-text text-lg tracking-[0.3em] text-slate-300">HEADS UP, WORD NERD</p>
            <div className="text-5xl leading-none" aria-hidden="true">📅</div>
            <h2 className="font-display text-2xl text-neon-cyan leading-tight">Daily Challenge #{today.number}</h2>
            <p className="text-slate-200 leading-snug">
              You're about to start the <strong className="text-white">Daily Challenge</strong>. Everyone in the world gets the
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
      {endingSaved && savedGame && (
        <EndRunCard summary={continueRun?.label} onCancel={() => setEndingSaved(false)} onConfirm={endSavedRun} />
      )}
      {confirmNewGame && savedGame && (
        <div className="absolute inset-0 z-50 bg-crt-950/85 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" role="dialog" aria-modal="true" aria-label="Start a new game?">
          <div className="bg-crt-900 border-2 border-neon-yellow rounded-2xl p-6 max-w-sm w-full text-center flex flex-col gap-3">
            <h2 className="font-display text-2xl text-neon-yellow">Run in progress!</h2>
            <p className="text-slate-200">{savedGame.playerName}'s run is saved. Starting a new game will erase it.</p>
            <ArcadeButton color="green" className="w-full" onClick={() => { setConfirmNewGame(false); handleResumeClick(); }}>⏯ Resume the run</ArcadeButton>
            <ArcadeButton color="red" variant="outline" className="w-full" onClick={handlePlayClick}>Start over</ArcadeButton>
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
            <ArcadeButton color="green" variant="outline" className="w-full" onClick={() => {
              soundService.playUIClick();
              setName('');
              setShowSwitcher(false);
              setTimeout(() => document.getElementById('player-name')?.focus(), 50);
            }}>＋ New Player</ArcadeButton>
            <ArcadeButton color="slate" variant="text" className="mx-auto" onClick={() => { soundService.playUIClick(); setShowSwitcher(false); }}>Close</ArcadeButton>
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
      {panel ? renderPanel() : (
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
            <button onClick={() => onShowVibez()} className="flex items-center gap-1 bg-crt-950/70 ring-1 ring-neon-yellow/50 hover:ring-neon-yellow pl-2 pr-2.5 py-1.5 rounded-full" aria-label={`${lexCoins} credits. Open the shop`}>
              <span className="text-lg leading-none" aria-hidden="true">🪙</span>
              <span className="osd-text text-xl leading-none text-neon-yellow">{lexCoins}</span>
            </button>
            <button onClick={() => { soundService.initialize(); soundService.playUIClick(); setShowSound(true); }} className="text-xl text-slate-400 hover:text-white p-1.5" aria-label={`Sound and music (${isMuted ? 'sound off' : 'sound on'})`}>
              {isMuted ? '🔇' : '🔊'}
            </button>
          </div>
        </div>

        <div className="flex-1 w-full max-w-sm mx-auto flex flex-col items-center gap-3 px-4 pt-3 pb-4">
          {/* Logo: the hero, centered in the space above the actions; smaller than before, same neon. */}
          <div className="flex-1 flex flex-col items-center justify-center text-center min-h-[9rem]">
            {shopNews && (
              <div className="mb-3 flex items-stretch rounded-full bg-neon-yellow/15 ring-1 ring-neon-yellow shadow-[0_0_14px_rgba(255,226,122,0.4)] animate-fade-in">
                <button type="button" onClick={() => { closeShopNews(); onShowVibez(SHOP_NEWS.tab); }} className="osd-text text-base leading-none text-neon-yellow pl-3 pr-2 py-1.5 hover:text-white" aria-label={`${SHOP_NEWS.text}. Open the shop`}>
                  {SHOP_NEWS.text} ›
                </button>
                <button type="button" onClick={() => { soundService.playUIClick(); closeShopNews(); }} className="text-neon-yellow/70 hover:text-white px-2.5 border-l border-neon-yellow/40" aria-label="Dismiss">✕</button>
              </div>
            )}
            <h1 className="font-display text-4xl min-[375px]:text-5xl [@media(min-height:760px)]:text-6xl tracking-widest neon-text-cyan neon-flicker animate-slide-in-down leading-none">WORD</h1>
            <h2 className="font-display text-6xl min-[375px]:text-7xl [@media(min-height:760px)]:text-8xl tracking-normal marquee-3d animate-bounce-in-up leading-none" style={{ animationDelay: '0.1s' }}>NERD</h2>
            <p className="osd-text text-lg text-neon-pink mt-1 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>SERIOUS WORDS. RIDICULOUS FUN.</p>
            <p className="osd-text text-sm leading-none text-slate-500 mt-1">VER {__APP_VERSION__}</p>
            <button type="button" onClick={() => { soundService.playUIClick(); onShowTour(name.trim(), false); }} data-testid="tour-pill"
              className="mt-3 flex items-center gap-1.5 rounded-full ring-1 ring-neon-cyan/60 bg-crt-950/70 hover:bg-neon-cyan/10 hover:ring-neon-cyan px-3 py-1.5 animate-fade-in"
              aria-label="How to play: a 1-minute tour">
              <span className="text-base leading-none" aria-hidden="true">❓</span>
              <span className="osd-text text-lg leading-none text-neon-cyan">HOW TO PLAY · 1-MIN TOUR</span>
            </button>
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
                <button type="button" className="osd-text text-base leading-none text-slate-500 underline hover:text-neon-red -mt-0.5" onClick={() => { soundService.playUIClick(); setEndingSaved(true); }}>🗑️ End the saved run</button>
              </>
            ) : (
              <>
                <ArcadeButton color="yellow" size="lg" className="w-full" disabled={!name.trim()} onClick={handlePlayClick}>▶ Play</ArcadeButton>
                {!showNameEntry && <p className="osd-text text-lg leading-none text-neon-yellow blink -mt-1">PRESS START</p>}
              </>
            )}
          </section>

          {/* Today strip: the daily rituals side by side. */}
          <section className="w-full grid grid-cols-2 gap-2" aria-label="Today">
            {/* Daily Challenge chip (v7.48): the way back in to the daily, not a second Play button. */}
            <div className="col-span-2 flex items-center gap-2 rounded-xl ring-1 ring-neon-cyan/40 bg-crt-950/70 pl-2.5 pr-1.5 py-1.5">
              <button type="button" disabled={!name.trim()} onClick={handleDailyClick} className="flex-1 min-w-0 flex items-center gap-2 text-left disabled:opacity-40"
                aria-label={`Daily Challenge number ${today.number}: ${dailyState === 'resume' ? 'resume it' : dailyState === 'new' ? 'not played yet, try it' : 'practice'}`}>
                <span className="text-xl leading-none" aria-hidden="true">📅</span>
                <span className="flex-1 min-w-0">
                  <span className="block osd-text text-lg leading-none text-neon-cyan truncate">DAILY CHALLENGE #{today.number}</span>
                  <span className="block osd-text text-base leading-tight text-slate-400 truncate">
                    {dailyState === 'resume' ? 'UNFINISHED · TAP TO RESUME'
                      : dailyState === 'done' ? `${todayRecord!.score!.toLocaleString()} PTS${todayRecord!.rank ? ` · #${todayRecord!.rank} TODAY` : ''} · TAP TO PRACTICE`
                      : dailyState === 'started' ? 'TRY USED · TAP TO PRACTICE'
                      : 'SAME TILES FOR EVERYONE · NOT PLAYED YET'}
                  </span>
                </span>
                <span className="osd-text text-2xl leading-none text-neon-cyan" aria-hidden="true">›</span>
              </button>
              {dailyState === 'done' && <button type="button" onClick={handleShareDaily} className="osd-text text-base leading-none px-2 py-1.5 rounded-md ring-1 ring-neon-cyan text-neon-cyan shrink-0">SHARE</button>}
            </div>
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

        {/* Bottom tabs: everything that isn't playing, in the thumb zone (same bar on every menu screen). */}
        <BottomTabs current="play" onTab={(tab) => {
          soundService.playUIClick();
          if (tab === 'top50') handleShowLeaderboard();
          else if (tab !== 'play') onTab(tab);
        }} />
      </div>
      )}

    </>
  );
};

export default StartScreen;
