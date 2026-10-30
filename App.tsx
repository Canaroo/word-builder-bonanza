
import React, { useState, useCallback, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import StartScreen from './services/screens/StartScreen';
import ErrorBoundary from './components/ErrorBoundary';

// The start screen loads first; the rest are fetched on demand.
const loadGameScreen = () => import('./services/screens/GameScreen');
const GameScreen = lazy(() => loadGameScreen().then(m => ({ default: m.GameScreen })));
const GameOverScreen = lazy(() => import('./services/screens/GameOverScreen'));
const HowToPlayScreen = lazy(() => import('./services/screens/HowToPlayScreen'));
const VibezScreen = lazy(() => import('./services/screens/VibezScreen'));
const CollectionScreen = lazy(() => import('./services/screens/CollectionScreen'));
const BadgeCaseScreen = lazy(() => import('./services/screens/BadgeCaseScreen'));
const ProfileScreen = lazy(() => import('./services/screens/ProfileScreen'));

// Bonus Vault: every bonus with a validity check and reveal previews. Unlinked; open /?bonuses.
const BonusCatalog = lazy(() => import('./components/BonusCatalog'));
const urlParams = new URLSearchParams(location.search);
const showBonusCatalog = urlParams.has('bonuses') || urlParams.has('gallery');
// Stats: anonymous usage totals (bosses, missions, runs). Unlinked; open /?stats.
const StatsPage = lazy(() => import('./components/StatsPage'));
const showStats = urlParams.has('stats');

const ScreenFallback = () => (
  <div className="flex-grow flex items-center justify-center">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-400"></div>
  </div>
);
import { GameState, FinalGameState, Pack, PowerWordData } from './types';
import {leaderboardService} from './services/leaderboardService';
import { sendStat } from './services/stats';
import { levelFor } from './services/rules';
import { switchToPlayer } from './services/players';
import { recordCareerRun } from './services/career';
import { soundService } from './services/soundService';
import { musicService } from './services/musicService';
import { powerWordService } from './services/powerWordService';
import { logService } from './services/logService';
import { PACKS_LIST } from './data/packs';
import { SECRET_BONUSES } from './data/secretBonuses';
import { storage, STORAGE_KEYS } from './services/storage';
import { showToast } from './services/toast';
import { recordRunScore, getPersonalBest } from './services/personalBest';
import { getCollection, recordFound } from './services/collection';
import { pickNextHint, RunRecap } from './services/runRecap';
import { recordRunFinished, buyCosmetic, equipCosmetic, buyFreeze, publicFlair, type StreakUpdate } from './services/progression';
import { cosmeticById, type CosmeticKind } from './data/cosmetics';

export enum Screen {
  Start,
  Game,
  GameOver,
  HowToPlay,
  Vibez,
  Collection,
  BadgeCase,
  Profile,
}

const App: React.FC = () => {
  const [screen, setScreen] = useState<Screen>(Screen.Start);
  const [lastRunRecap, setLastRunRecap] = useState<RunRecap | null>(null);
  // When the current run (or resumed run) started, to tell which secrets it found first.
  const runStartedAt = useRef(Date.now());
  const [playerName, setPlayerName] = useState<string>(() => storage.getString(STORAGE_KEYS.playerName) || '');
  const [lastGameResult, setLastGameResult] = useState<FinalGameState | null>(null);
  const [lastRunIsNewBest, setLastRunIsNewBest] = useState(false);
  // Streak change from the run that just ended (shown on the game-over screen).
  const [lastStreakUpdate, setLastStreakUpdate] = useState<StreakUpdate | null>(null);
  // Bumped whenever badges, titles or freezes change, so screens re-read the profile.
  const [profileVersion, setProfileVersion] = useState(0);
  const [isResuming, setIsResuming] = useState(false);
  const [isTimeLow, setIsTimeLow] = useState(false);
  const [isGoldenRound, setIsGoldenRound] = useState(false);
  const [isBossRound, setIsBossRound] = useState(false);
  const [autoShowLeaderboard, setAutoShowLeaderboard] = useState(false);
  
  // New state for packs and currency
  const [lexCoins, setLexCoins] = useState<number>(() => parseInt(storage.getString(STORAGE_KEYS.lexCoins) || '0', 10) || 0);
  const [unlockedPackIds, setUnlockedPackIds] = useState<string[]>(() => {
    const saved = storage.getJSON<unknown>(STORAGE_KEYS.unlockedPacks, null);
    if (Array.isArray(saved)) {
      return saved;
    }
    return ['default']; // Default to only having the 'default' pack unlocked
  });
  const [selectedPackId, setSelectedPackId] = useState<string>(() => storage.getString(STORAGE_KEYS.selectedPack) || 'default');
  
  // New state for ranking modals
  const [rankingModalData, setRankingModalData] = useState<{ rank: number; name: string; score: number } | null>(null);

  // New state for Power Word
  const [powerWordData, setPowerWordData] = useState<PowerWordData | null>(null);
  const [canSpin, setCanSpin] = useState<boolean>(true);


  useEffect(() => {
    // Fetch the game screen in the background so New Game starts instantly.
    const idle = window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 1500));
    idle(() => { loadGameScreen(); });
  }, []);

  useEffect(() => {
    // Check the Power Word on load, and again whenever the app comes back to the foreground or a
    // minute passes, so the 8 AM reset shows up even if the app was left open overnight.
    const refresh = () => {
      const canUserSpin = powerWordService.canSpin();
      // Once the reset has passed, hide yesterday's word.
      setPowerWordData(canUserSpin ? null : powerWordService.getPowerWordData());
      setCanSpin(canUserSpin);
    };
    refresh();
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', refresh);
    const timer = setInterval(refresh, 60_000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', refresh);
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    storage.setString(STORAGE_KEYS.lexCoins, String(lexCoins));
  }, [lexCoins]);

  useEffect(() => {
    storage.setJSON(STORAGE_KEYS.unlockedPacks, unlockedPackIds);
  }, [unlockedPackIds]);

  useEffect(() => {
    storage.setString(STORAGE_KEYS.selectedPack, selectedPackId);
  }, [selectedPackId]);

  const selectedPack = useMemo(() => {
    return PACKS_LIST.find(p => p.id === selectedPackId) || PACKS_LIST[0];
  }, [selectedPackId]);


  useEffect(() => {
    if (screen !== Screen.Game) {
      setIsTimeLow(false);
      setIsGoldenRound(false);
      setIsBossRound(false);
    }
  }, [screen]);

  useEffect(() => {
    if (playerName.trim()) {
        storage.setString(STORAGE_KEYS.playerName, playerName.trim());
    }
  }, [playerName]);

  // Chrome shows its "To exit full screen, drag from the top" banner every time a page asks for
  // full screen, and pages can't turn it off. So only ask when the game isn't already full screen,
  // and never when it's installed to the home screen (that version opens full screen by itself).
  const enterFullscreen = () => {
    const doc = document as any;
    if (doc.fullscreenElement || doc.webkitFullscreenElement) return;
    const installed = window.matchMedia?.('(display-mode: fullscreen), (display-mode: standalone)').matches || (navigator as any).standalone;
    if (installed) return;
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
        showToast(`🪙 +${coinsEarned} ${coinsEarned === 1 ? 'Credit' : 'Credits'}!`);
        soundService.playMilestone();
    }
  }, []);

  const handleLexCoinChange = useCallback((amount: number, label?: string) => {
    setLexCoins(c => c + amount);
     if (amount > 0) {
        showToast(label ?? `🪙 +${amount} ${amount === 1 ? 'Credit' : 'Credits'}!`, label ? 3200 : 2000);
        soundService.playMilestone();
    }
  }, []);

  // Shop: badges, titles and streak freezes. The service checks ownership and price.
  const handleBuyCosmetic = useCallback((id: string) => {
    const cost = buyCosmetic(id, lexCoins);
    if (!cost) return;
    setLexCoins(c => c - cost);
    setProfileVersion(v => v + 1);
    showToast(`${cosmeticById(id)?.icon ?? '🏷️'} ${cosmeticById(id)?.name} unlocked and equipped!`);
    soundService.playMilestone();
  }, [lexCoins]);

  const handleEquipCosmetic = useCallback((kind: CosmeticKind, id: string | null) => {
    equipCosmetic(kind, id);
    setProfileVersion(v => v + 1);
    soundService.playUIClick();
  }, []);

  const handleBuyFreeze = useCallback(() => {
    const cost = buyFreeze(lexCoins);
    if (!cost) return;
    setLexCoins(c => c - cost);
    setProfileVersion(v => v + 1);
    showToast('🧊 Streak Freeze ready. A missed day won\'t break your streak.');
    soundService.playMilestone();
  }, [lexCoins]);

  const handleUnlockPack = useCallback((packId: string, cost: number) => {
    if (lexCoins >= cost && !unlockedPackIds.includes(packId)) {
      setLexCoins(c => c - cost);
      setUnlockedPackIds(ids => [...ids, packId]);
      showToast('Pack Unlocked!');
      soundService.playMilestone();
    }
  }, [lexCoins, unlockedPackIds]);

  const handleSelectPack = useCallback((packId: string) => {
    if (unlockedPackIds.includes(packId)) {
      setSelectedPackId(packId);
    }
  }, [unlockedPackIds]);

  const handlePlay = useCallback((name: string) => {
    runStartedAt.current = Date.now();
    switchToPlayer(name);
    setProfileVersion(v => v + 1);
    storage.remove(STORAGE_KEYS.savedGame);
    setIsResuming(false);
    setPlayerName(name);
    setScreen(Screen.Game);
    setRankingModalData(null); // Clear any leftover ranking data
    enterFullscreen();
  }, []);

  const handleResumeGame = useCallback((name: string) => {
    runStartedAt.current = Date.now();
    switchToPlayer(name);
    setProfileVersion(v => v + 1);
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
    storage.setJSON(STORAGE_KEYS.savedGame, saveData);
    setScreen(Screen.Start);
    musicService.pause();
  }, [playerName]);


  const handleGameOver = useCallback((gameState: GameState) => {
    storage.remove(STORAGE_KEYS.savedGame);
    const validWords = gameState.log.filter(e => e.type === 'word' && e.status === 'valid').length;
    sendStat({ type: 'run_end', score: gameState.score, words: validWords, level: levelFor(validWords), bosses: gameState.bossesBeaten ?? 0 });
    recordCareerRun({ score: gameState.score, level: levelFor(validWords), bestWord: gameState.highestScoringWord, longestWord: gameState.longestWord });
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
      timeLedger: gameState.timeLedger,
    };
    
    // Auto-save the log on game over
    logService.autoSaveLog(finalState);

    // Daily streak: a finished run banks today. New milestones pay credits and unlock rewards.
    const streak = recordRunFinished();
    const milestoneCredits = streak.milestones.reduce((sum, m) => sum + m.credits, 0);
    if (milestoneCredits) setLexCoins(c => c + milestoneCredits);
    const themeRewards = streak.milestones.map(m => m.themeId).filter((id): id is string => !!id);
    if (themeRewards.length) setUnlockedPackIds(ids => [...new Set([...ids, ...themeRewards])]);
    setLastStreakUpdate(streak);
    setProfileVersion(v => v + 1);
    const previousBest = getPersonalBest();
    setLastRunIsNewBest(recordRunScore(finalState.score));

    // Secrets are saved to the collection as they're found; this catches any that weren't.
    finalState.foundEasterEggs.forEach(egg => { if (!getCollection()[egg.id]) recordFound(egg.id); });
    const collection = getCollection();
    const ids = new Set(Object.keys(collection));
    setLastRunRecap({
      newSecretIds: finalState.foundEasterEggs.map(e => e.id).filter(id => (collection[id]?.firstFoundAt ?? 0) >= runStartedAt.current),
      collection: { found: ids.size, total: SECRET_BONUSES.length },
      previousBest,
      nextHint: pickNextHint(ids),
    });
    
    setLastGameResult(finalState);
    setScreen(Screen.GameOver);
    musicService.stop();
  }, []);

  const handlePlayAgain = useCallback(() => {
    runStartedAt.current = Date.now();
    setIsResuming(false);
    setLastGameResult(null);
    setScreen(Screen.Game);
    musicService.play();
  }, []);
  
  const handleSubmitScore = useCallback(async (name: string) => {
    if (lastGameResult) {
      const score = lastGameResult.score;
      const { rank } = await leaderboardService.submitScore(name, score, publicFlair());
      setPlayerName(name);

      if (rank > 0 && rank <= 10) {
        setRankingModalData({ rank, name, score });
        setAutoShowLeaderboard(false);
      } else {
        setRankingModalData(null);
        setAutoShowLeaderboard(true);
        showToast("Score saved!");
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

  // After a crash: back to the menu with music stopped and no half-finished modals.
  const handleRecoverFromCrash = useCallback(() => {
    setIsGoldenRound(false);
    setIsBossRound(false);
    setIsTimeLow(false);
    setLastGameResult(null);
    setRankingModalData(null);
    setScreen(Screen.Start);
    musicService.stop();
  }, []);

  const handleShowHowToPlay = useCallback(() => {
    soundService.initialize();
    soundService.playUIClick();
    setScreen(Screen.HowToPlay);
  }, []);
  
  const handleShowCollection = useCallback(() => {
    soundService.initialize();
    soundService.playUIClick();
    setScreen(Screen.Collection);
  }, []);

  const handleShowProfile = useCallback(() => {
    soundService.initialize();
    soundService.playUIClick();
    setScreen(Screen.Profile);
  }, []);

  const handleShowBadgeCase = useCallback(() => {
    soundService.initialize();
    soundService.playUIClick();
    setScreen(Screen.BadgeCase);
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
      showToast(`Your Power Word is ${newData.powerWord.toUpperCase()}!`);
    }
  }, [canSpin]);


  const renderScreen = () => {
    switch (screen) {
      case Screen.Start:
        return <StartScreen 
          onPlay={handlePlay} 
          onResumeGame={handleResumeGame} 
          onShowHowToPlay={handleShowHowToPlay} 
          onShowVibez={handleShowVibez} 
          onShowCollection={handleShowCollection}
          onShowBadgeCase={handleShowBadgeCase}
          onShowProfile={handleShowProfile}
          lexCoins={lexCoins} 
          autoShowLeaderboard={autoShowLeaderboard}
          setAutoShowLeaderboard={setAutoShowLeaderboard}
          rankingModalData={rankingModalData}
          setRankingModalData={setRankingModalData}
          powerWordData={powerWordData}
          canSpin={canSpin}
          onSpin={handleSpin}
          profileVersion={profileVersion}
          onBuyFreeze={handleBuyFreeze}
          />;
      case Screen.Game:
        return <GameScreen 
            playerName={playerName} 
            onGameOver={handleGameOver} 
            onSaveGame={handleSaveGame}
            isResuming={isResuming}
            onTimeLow={setIsTimeLow}
            onGoldenRoundChange={setIsGoldenRound}
            onBossRoundChange={setIsBossRound}
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
            isNewBest={lastRunIsNewBest}
            personalBest={getPersonalBest()}
            recap={lastRunRecap}
            streak={lastStreakUpdate}
            onPlayAgain={handlePlayAgain}
            onSubmitScore={handleSubmitScore}
            onGoToMenu={handleGoToMenu}
          />
        );
      case Screen.HowToPlay:
        return <HowToPlayScreen onBack={handleGoToMenu} />;
      case Screen.Collection:
        return <CollectionScreen onBack={handleGoToMenu} />;
      case Screen.BadgeCase:
        return <BadgeCaseScreen onBack={handleGoToMenu} />;
      case Screen.Profile:
        return <ProfileScreen onBack={handleGoToMenu} onEditBling={handleShowVibez} />;
      case Screen.Vibez:
        return <VibezScreen 
          onBack={handleGoToMenu} 
          lexCoins={lexCoins}
          unlockedPackIds={unlockedPackIds}
          selectedPackId={selectedPackId}
          onUnlockPack={handleUnlockPack}
          onSelectPack={handleSelectPack}
          profileVersion={profileVersion}
          onBuyCosmetic={handleBuyCosmetic}
          onEquipCosmetic={handleEquipCosmetic}
          onBuyFreeze={handleBuyFreeze}
          />;
      default:
        return <StartScreen onPlay={handlePlay} onResumeGame={handleResumeGame} onShowHowToPlay={handleShowHowToPlay} onShowVibez={handleShowVibez} onShowCollection={handleShowCollection} onShowBadgeCase={handleShowBadgeCase} onShowProfile={handleShowProfile} lexCoins={lexCoins} autoShowLeaderboard={autoShowLeaderboard} setAutoShowLeaderboard={setAutoShowLeaderboard} rankingModalData={rankingModalData} setRankingModalData={setRankingModalData} powerWordData={powerWordData} canSpin={canSpin} onSpin={handleSpin} profileVersion={profileVersion} onBuyFreeze={handleBuyFreeze}/>;
    }
  };

  return (
    <main id="main-container" className={`safe-area w-screen h-dvh flex items-center justify-center transition-all duration-500 ${selectedPack.themeClass}`}>
      <div className={`relative z-10 w-full max-w-xl h-full sm:max-h-[800px] bg-crt-900 sm:rounded-2xl shadow-2xl flex flex-col overflow-y-auto overscroll-contain transition-all duration-300 ${selectedPack.frameClass} ${isTimeLow ? 'low-time-flash' : ''} ${isGoldenRound ? 'golden-round-active' : ''}`}>
        {selectedPack.id === 'rustic-workbench' && (
          <>
            <div className="corner-bolt top-left"></div>
            <div className="corner-bolt top-right"></div>
            <div className="corner-bolt bottom-left"></div>
            <div className="corner-bolt bottom-right"></div>
          </>
        )}
        <ErrorBoundary key={screen} onRecover={handleRecoverFromCrash}>
          <Suspense fallback={<ScreenFallback />}>{showStats ? <StatsPage /> : showBonusCatalog ? <BonusCatalog /> : renderScreen()}</Suspense>
        </ErrorBoundary>
        {selectedPack.id === 'default' && <div className="crt-overlay" aria-hidden="true" />}
        {/* Unmissable gold frame while a Golden Round runs (any theme). */}
        {isGoldenRound && screen === Screen.Game && <div className="golden-frame" aria-hidden="true" />}
        {isBossRound && !isGoldenRound && screen === Screen.Game && <div className="boss-frame" aria-hidden="true" />}
      </div>
    </main>
  );
};

export default App;
