
import React, { useState, useEffect } from 'react';
import { FinalGameState, WordLogEntry } from '../../types';
import { soundService } from '../soundService';
import EventLogDisplay from '../../components/EventLogDisplay';
import { showToast } from '../toast';
import ArcadeButton from '../../components/ArcadeButton';


interface GameOverScreenProps {
  playerName: string;
  gameState: FinalGameState;
  onPlayAgain: () => void;
  onSubmitScore: (name: string) => Promise<void> | void;
  onGoToMenu: () => void;
  /** This run beat the device's previous best score. */
  isNewBest?: boolean;
  personalBest?: number;
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


const GameOverScreen: React.FC<GameOverScreenProps> = ({ playerName, gameState, onPlayAgain, onSubmitScore, onGoToMenu, isNewBest = false, personalBest = 0 }) => {
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
      </div>

      {/* Stats Panel */}
      <div className="my-4 bg-crt-950/70 ring-1 ring-neon-cyan/30 px-4 py-2 rounded-xl flex-grow min-h-0 overflow-y-auto">
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
        <div className="grid grid-cols-2 gap-3">
          <ArcadeButton color="purple" size="sm" onClick={handleShowWordLogClick} disabled={isActionLocked}>📼 Event Log</ArcadeButton>
          <ArcadeButton color="slate" size="sm" onClick={handleMenuClick} disabled={isActionLocked}>Menu</ArcadeButton>
        </div>
        <p className="osd-text text-sm text-slate-500 leading-tight">RUN SAVED · PIN IT ANYTIME FROM EVENT LOGS</p>
      </div>
    </div>
  );
};

export default GameOverScreen;
