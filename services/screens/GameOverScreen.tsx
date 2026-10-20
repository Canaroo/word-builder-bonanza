
import React, { useState, useEffect } from 'react';
import { FinalGameState, WordLogEntry } from '../../types';
import { soundService } from '../soundService';
import EventLogDisplay from '../../components/EventLogDisplay';
import { showToast } from '../toast';
import ArcadeButton from '../../components/ArcadeButton';
import { buildShareText, secretIcon, RunRecap } from '../runRecap';
import { splitName } from '../../components/BonusReveal';
import MissionsPanel from '../../components/MissionsPanel';
import { BadgeIcon } from '../../components/PlayerPlate';
import { cosmeticById } from '../../data/cosmetics';
import { PACKS_LIST } from '../../data/packs';
import { getProfile, nextMilestone, type StreakUpdate } from '../progression';


interface GameOverScreenProps {
  playerName: string;
  gameState: FinalGameState;
  onPlayAgain: () => void;
  onSubmitScore: (name: string) => Promise<void> | void;
  onGoToMenu: () => void;
  /** This run beat the device's previous best score. */
  isNewBest?: boolean;
  personalBest?: number;
  recap?: RunRecap | null;
  /** What this run did to the daily streak. */
  streak?: StreakUpdate | null;
}

const StatRow: React.FC<{ label: string; value: React.ReactNode; icon: string; isHighlighted?: boolean; }> = ({ label, value, icon, isHighlighted }) => {
  const valueColor = isHighlighted ? 'text-neon-yellow' : 'text-white';
  const finalIcon = isHighlighted ? '👑' : icon;

  return (
    <div className="grid grid-cols-[auto,1fr] items-center py-2 border-b border-dashed border-white/10 gap-2">
      <div className="flex items-center gap-2">
        <span className="text-xl w-6 text-center">{finalIcon}</span>
        <span className="osd-text text-lg leading-none text-neon-cyan/90 uppercase">{label}</span>
      </div>
      <span className={`font-osd text-2xl leading-none ${valueColor} text-right truncate`}>{value}</span>
    </div>
  );
};


const GameOverScreen: React.FC<GameOverScreenProps> = ({ playerName, gameState, onPlayAgain, onSubmitScore, onGoToMenu, isNewBest = false, personalBest = 0, recap = null, streak = null }) => {
  const [showMilestones, setShowMilestones] = useState(() => (streak?.milestones.length ?? 0) > 0);
  const next = streak ? nextMilestone(streak.count) : undefined;
  const [showWordLog, setShowWordLog] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submissionName, setSubmissionName] = useState(playerName);
  const [isActionLocked, setIsActionLocked] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const ACTION_COOLDOWN_MS = 1000;

  // New stat calculations
  const validWords = gameState.log.filter(e => e.type === 'word' && e.status === 'valid') as WordLogEntry[];
  const totalScoreFromWords = validWords.reduce((sum, word) => sum + word.score, 0);
  const averageWordScore = validWords.length > 0 ? Math.round(totalScoreFromWords / validWords.length) : '—';
  const topScoringWordDisplay = gameState.highestScoringWord
    ? `${gameState.highestScoringWord.word.toUpperCase()} (${gameState.highestScoringWord.score})`
    : '—';
  const wordStreakDisplay = gameState.longestStreak > 1 ? `${gameState.longestStreak} words` : '—';


  useEffect(() => {
    setSubmissionName(playerName);
  }, [playerName]);

  const handleAction = (action: () => void) => {
    if (isActionLocked) return;

    soundService.playUIClick();
    action();

    setIsActionLocked(true);
    setTimeout(() => {
      setIsActionLocked(false);
    }, ACTION_COOLDOWN_MS);
  };

  const handlePlayAgainClick = () => handleAction(onPlayAgain);
  const handleSubmitScoreClick = () => handleAction(() => setShowSubmitModal(true));
  const handleShowWordLogClick = () => handleAction(() => setShowWordLog(true));
  const handleMenuClick = () => handleAction(onGoToMenu);

  const handleShare = () => handleAction(async () => {
    if (!recap) return;
    const url = `${location.origin}${location.pathname}`;
    const p = getProfile();
    const text = buildShareText(gameState, recap, isNewBest, url, { streak: streak?.count ?? 0, title: cosmeticById(p.title)?.name, badge: cosmeticById(p.badge)?.icon });
    try {
      if (navigator.share) {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(text);
      showToast('Copied! Paste it anywhere.');
    } catch (e) {
      // Closing the share sheet counts as an error; only report real failures.
      if ((e as Error)?.name !== 'AbortError') showToast("Couldn't share from this browser.");
    }
  });

  const newSecrets = new Set(recap?.newSecretIds ?? []);
  const bestGap = recap && !isNewBest && recap.previousBest > gameState.score ? recap.previousBest - gameState.score : 0;
  
  const doSubmit = async () => {
    if (!submissionName.trim() || isSaving) return;
    soundService.playUIClick();
    setIsSaving(true);
    try {
      await onSubmitScore(submissionName.trim());
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doSubmit();
  };
  
  const handleCancelSubmit = () => {
    soundService.playUIClick();
    setShowSubmitModal(false);
  }
  
  const handleCloseWordLog = () => {
      soundService.playUIClick();
      setShowWordLog(false);
  }

  return (
    <div className="flex flex-col h-full p-4 md:p-6 text-center justify-between relative animate-fade-in">
      {showWordLog && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-crt-900 border-2 border-neon-purple shadow-glow-pink rounded-2xl p-5 text-center max-w-md w-full flex flex-col max-h-[90vh]">
                <h2 className="font-display text-2xl text-neon-yellow mb-2 flex-shrink-0">Event Log</h2>
                <div className="flex-grow overflow-y-auto pr-2">
                    <EventLogDisplay log={gameState.log} />
                </div>
                <div className="mt-4 space-y-2 flex-shrink-0">
                    <ArcadeButton color="yellow" className="w-full" onClick={handleCloseWordLog}>Close</ArcadeButton>
                </div>
            </div>
        </div>
      )}
      
      {showSubmitModal && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-crt-900 border-2 border-neon-cyan shadow-glow-cyan rounded-2xl p-6 max-w-sm w-full bonus-insert">
            <h2 className="font-display text-2xl text-neon-yellow mb-1">Enter Initials</h2>
            <form onSubmit={handleConfirmSubmit}>
              <p className="osd-text text-lg text-slate-300 mb-3">YOUR NAME FOR THE TOP 50</p>
              <input
                type="text"
                value={submissionName}
                onChange={(e) => setSubmissionName(e.target.value)}
                placeholder="Enter Your Name"
                maxLength={12}
                aria-label="Name for the leaderboard"
                className="w-full px-4 py-2 font-osd text-3xl uppercase tracking-widest text-center bg-crt-950/80 border-2 border-neon-cyan/50 rounded-lg focus:outline-none focus:border-neon-cyan focus:shadow-glow-cyan text-neon-cyan placeholder:text-neon-cyan/40 placeholder:normal-case"
              />
              <ArcadeButton type="submit" color="yellow" className="w-full mt-4" disabled={!submissionName.trim() || isActionLocked || isSaving}>
                {isSaving ? <span className="blink">Saving…</span> : 'Confirm'}
              </ArcadeButton>
            </form>
            <ArcadeButton color="red" size="sm" className="w-full mt-3" onClick={handleCancelSubmit} disabled={isActionLocked || isSaving}>
              Cancel
            </ArcadeButton>
          </div>
        </div>
      )}

      {showMilestones && streak && (
        <div className="absolute inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" role="dialog" aria-modal="true" aria-label="Streak milestone">
          <div className="bg-crt-900 border-2 border-neon-orange rounded-2xl p-5 max-w-sm w-full text-center bonus-insert shadow-[0_0_24px_rgba(255,140,40,0.5)]">
            <div className="text-6xl" aria-hidden="true">🔥</div>
            <h2 className="font-display text-3xl text-neon-orange leading-none mt-1">{streak.count}-DAY STREAK!</h2>
            <p className="osd-text text-lg text-slate-300 mt-1">MILESTONE REWARD{streak.milestones.length > 1 ? 'S' : ''} UNLOCKED</p>
            <ul className="mt-3 space-y-2 text-left">
              {streak.milestones.map(m => (
                <li key={m.day} className="rounded-lg bg-crt-950/80 ring-1 ring-neon-orange/40 p-2 space-y-1">
                  <p className="osd-text text-base leading-none text-neon-orange">DAY {m.day}</p>
                  <p className="text-sm text-white">🏷️ Title: <strong>{cosmeticById(m.title)?.name}</strong></p>
                  {m.badge && <p className="text-sm text-white flex items-center gap-2"><BadgeIcon id={m.badge} size="sm" /> Badge: <strong>{cosmeticById(m.badge)?.name}</strong></p>}
                  {m.themeId && <p className="text-sm text-white">🎨 Theme: <strong>{PACKS_LIST.find(p => p.id === m.themeId)?.name}</strong></p>}
                  <p className="text-sm text-neon-yellow">🪙 +{m.credits} credits</p>
                </li>
              ))}
            </ul>
            <p className="text-sm text-slate-400 mt-2">Wear your new bling from the Vibez Shop.</p>
            <ArcadeButton color="yellow" className="w-full mt-3" onClick={() => { soundService.playUIClick(); setShowMilestones(false); }}>Sweet!</ArcadeButton>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex-shrink-0 pt-2">
          <h1 className="font-display text-4xl min-[375px]:text-5xl whitespace-nowrap tracking-wide neon-text-pink neon-flicker">GAME OVER</h1>
          {isNewBest ? (
            <p className="osd-text text-2xl text-neon-yellow blink mt-1">★ NEW HIGH SCORE ★</p>
          ) : personalBest > 0 ? (
            <p className="osd-text text-xl text-slate-400 mt-1">BEST {personalBest.toLocaleString()}</p>
          ) : null}
          <div className={`font-osd leading-none text-neon-yellow drop-shadow-glow-yellow mt-2 tabular-nums ${gameState.score >= 100000 ? 'text-6xl' : 'text-7xl'}`}>{gameState.score.toLocaleString()}</div>
          <p className="osd-text text-lg text-neon-cyan/80">FINAL SCORE</p>
          {streak && (
            <p className={`osd-text text-lg leading-tight mt-1 ${streak.extended ? 'text-neon-orange' : 'text-slate-400'}`}>
              {streak.extended
                ? `🔥 ${streak.count}-DAY STREAK${streak.count > 1 ? ' (+1)' : ' STARTED'}${streak.freezesUsed ? ` · 🧊 FREEZE USED` : ''}`
                : `🔥 ${streak.count}-DAY STREAK · TODAY ALREADY BANKED`}
              {next && <span className="text-slate-400"> · {next.day - streak.count} TO NEXT REWARD</span>}
            </p>
          )}
      </div>

      {/* Stats Panel */}
      <div className="my-4 bg-crt-950/70 ring-1 ring-neon-cyan/30 px-4 py-2 rounded-xl flex-grow min-h-0 overflow-y-auto">
          {recap && (
            <div className="text-left pb-2 border-b border-dashed border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="osd-text text-lg leading-none text-neon-pink uppercase">📼 Secrets this run</span>
                <span className="osd-text text-lg leading-none text-slate-400">COLLECTION {recap.collection.found}/{recap.collection.total}</span>
              </div>
              {gameState.foundEasterEggs.length ? (
                <ul className="flex flex-wrap gap-1.5">
                  {gameState.foundEasterEggs.map(egg => (
                    <li key={egg.id} className={`flex items-center gap-1 rounded-md px-2 py-1 text-sm ring-1 ${newSecrets.has(egg.id) ? 'ring-neon-yellow bg-neon-yellow/10 text-neon-yellow' : 'ring-white/15 text-slate-200'}`}>
                      <span aria-hidden="true">{secretIcon(egg)}</span>
                      <span className="font-semibold">{splitName(egg.name).title}</span>
                      {newSecrets.has(egg.id) && <span className="osd-text text-base leading-none">NEW</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-400">None this time.</p>
              )}
              {recap.nextHint && (
                <p className="text-sm text-slate-300"><span className="osd-text text-lg leading-none text-neon-cyan">NEXT SECRET?</span> {recap.nextHint}</p>
              )}
              {bestGap > 0 && (
                <p className="osd-text text-lg leading-none text-neon-yellow">ONLY {bestGap.toLocaleString()} PTS FROM YOUR BEST</p>
              )}
            </div>
          )}
          <div className="py-2 border-b border-dashed border-white/10">
            <MissionsPanel compact />
          </div>
          <div className="text-left">
              <StatRow icon="📝" label="Words Found" value={validWords.length} />
              <StatRow icon="📏" label="Longest Word" value={gameState.longestWord.toUpperCase() || '—'} />
              <StatRow icon="🏆" label="Top Word" value={topScoringWordDisplay} isHighlighted />
              <StatRow icon="📊" label="Avg Word" value={averageWordScore} />
              <StatRow icon="🔥" label="Best Streak" value={wordStreakDisplay} />
          </div>
      </div>

      {/* Actions */}
      <div className="w-full max-w-sm mx-auto flex flex-col gap-3 flex-shrink-0 pb-1">
        <ArcadeButton color="cyan" size="lg" className="w-full" onClick={handleSubmitScoreClick} disabled={isActionLocked}>
          🏆 Submit Score
        </ArcadeButton>
        <ArcadeButton color="yellow" size="lg" className="w-full" onClick={handlePlayAgainClick} disabled={isActionLocked}>
          ▶ Play Again
        </ArcadeButton>
        <div className="grid grid-cols-3 gap-2">
          <ArcadeButton color="purple" size="sm" onClick={handleShowWordLogClick} disabled={isActionLocked}>📼 Log</ArcadeButton>
          <ArcadeButton color="green" size="sm" onClick={handleShare} disabled={isActionLocked || !recap}>📤 Share</ArcadeButton>
          <ArcadeButton color="slate" size="sm" onClick={handleMenuClick} disabled={isActionLocked}>Menu</ArcadeButton>
        </div>
        <p className="osd-text text-sm text-slate-500 leading-tight">RUN SAVED · PIN IT ANYTIME FROM EVENT LOGS</p>
      </div>
    </div>
  );
};

export default GameOverScreen;
