
import React, { useState, useEffect } from 'react';
import { FinalGameState, WordLogEntry } from '../../types';
import { soundService } from '../soundService';
import EventLogDisplay from '../../components/EventLogDisplay';

// Declare the global function so TypeScript doesn't complain
declare function showToast(message: string): void;

interface GameOverScreenProps {
  playerName: string;
  gameState: FinalGameState;
  onPlayAgain: () => void;
  onSubmitScore: (name: string) => void;
  onGoToMenu: () => void;
}

const StatRow: React.FC<{ label: string; value: React.ReactNode; icon: string; isHighlighted?: boolean; }> = ({ label, value, icon, isHighlighted }) => {
  const valueColor = isHighlighted ? 'text-amber-400' : 'text-white';
  const finalIcon = isHighlighted ? '👑' : icon;

  return (
    <div className="grid grid-cols-[auto,1fr] items-center py-3 border-b border-slate-700/50 gap-2">
      <div className="flex items-center gap-2">
        <span className="text-xl text-slate-400 w-6 text-center">{finalIcon}</span>
        <span className="font-semibold text-slate-300">{label}</span>
      </div>
      <span className={`text-lg font-bold font-digital ${valueColor} text-right`}>{value}</span>
    </div>
  );
};


const GameOverScreen: React.FC<GameOverScreenProps> = ({ playerName, gameState, onPlayAgain, onSubmitScore, onGoToMenu }) => {
  const [showWordLog, setShowWordLog] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submissionName, setSubmissionName] = useState(playerName);
  const [isActionLocked, setIsActionLocked] = useState(false);
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
  
  const doSubmit = () => {
    if (submissionName.trim()) {
      handleAction(() => {
        onSubmitScore(submissionName.trim());
      });
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
    <div className="flex flex-col h-full bg-slate-800 p-4 md:p-6 text-center justify-between relative animate-fade-in">
      {showWordLog && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-slate-800 border-2 border-amber-400 rounded-2xl p-6 text-center shadow-2xl max-w-md w-full flex flex-col max-h-[90vh]">
                <h2 className="text-3xl font-bold text-amber-400 mb-2 flex-shrink-0">Final Event Log</h2>
                <div className="flex-grow overflow-y-auto pr-2">
                    <EventLogDisplay log={gameState.log} />
                </div>
                <div className="mt-4 space-y-2 flex-shrink-0">
                    <button onClick={handleCloseWordLog} className="w-full px-6 py-2 text-md font-bold text-slate-900 bg-amber-400 rounded-lg shadow-lg hover:bg-amber-300 transition-colors">
                      CLOSE
                    </button>
                </div>
            </div>
        </div>
      )}
      
      {showSubmitModal && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border-2 border-cyan-400 rounded-2xl p-6 shadow-2xl max-w-sm w-full animate-fade-in">
            <h2 className="text-2xl font-bold text-amber-400 mb-4">Submit Your Score</h2>
            <form onSubmit={handleConfirmSubmit}>
              <p className="text-slate-300 mb-2">Enter your name for the leaderboard:</p>
              <input
                type="text"
                value={submissionName}
                onChange={(e) => setSubmissionName(e.target.value)}
                placeholder="Enter Your Name"
                maxLength={12}
                className="w-full px-4 py-3 text-lg text-center bg-slate-900 border-2 border-slate-600 rounded-lg focus:outline-none focus:ring-4 focus:ring-amber-400 focus:border-amber-400 transition-all duration-300 text-slate-100 placeholder:text-slate-400"
              />
              <button
                type="submit"
                disabled={!submissionName.trim() || isActionLocked}
                onClick={doSubmit}
                className="w-full mt-4 px-6 py-3 text-xl font-bold text-slate-900 bg-amber-400 rounded-lg shadow-lg hover:bg-amber-300 disabled:bg-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed transition-all duration-300"
              >
                CONFIRM & SUBMIT
              </button>
            </form>
            <button 
              onClick={handleCancelSubmit}
              disabled={isActionLocked}
              className="w-full mt-2 px-6 py-2 text-md font-bold text-slate-100 bg-red-600 rounded-lg shadow-lg hover:bg-red-500 transition-colors disabled:bg-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed"
            >
              CANCEL
            </button>
          </div>
        </div>
      )}

      {/* Header Section */}
      <div className="relative flex-shrink-0">
          <h1 className="text-5xl font-extrabold text-red-500/10 blur-[3px] absolute -top-4 left-1/2 -translate-x-1/2 w-full">GAME OVER</h1>
          <div className={`font-digital font-bold text-white transition-all ${gameState.score >= 10000 ? 'text-7xl' : 'text-8xl'}`}>{gameState.score.toLocaleString()}</div>
          <p className="text-amber-400 font-semibold -mt-2">FINAL SCORE</p>
      </div>

      {/* Stats Panel */}
      <div className="my-6 bg-slate-900/50 p-4 rounded-lg shadow-inner flex-grow">
          <div className="text-left space-y-1">
              <StatRow icon="📝" label="Words Found" value={validWords.length} />
              <StatRow icon="📏" label="Longest Word" value={gameState.longestWord.toUpperCase() || '—'} />
              <StatRow icon="🏆" label="Top Scoring Word" value={topScoringWordDisplay} isHighlighted />
              <StatRow icon="📊" label="Average Word Score" value={averageWordScore} />
              <StatRow icon="🔥" label="Longest Streak" value={wordStreakDisplay} />
          </div>
      </div>

      {/* Actions Section */}
      <div className="w-full max-w-sm mx-auto space-y-3 flex-shrink-0">
        <button
          onClick={handleSubmitScoreClick}
          disabled={isActionLocked}
          className="w-full px-6 py-5 text-xl font-bold text-slate-900 bg-cyan-400 rounded-lg shadow-lg hover:bg-cyan-300 transition-all duration-300 transform hover:scale-105 disabled:bg-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed disabled:transform-none"
        >
          SUBMIT &amp; VIEW LEADERBOARD
        </button>
        <p className="text-xs text-slate-500 italic -mt-1 px-4">This run has been saved automatically. You can view or pin it anytime from Event Logs.</p>
        <button
          onClick={handlePlayAgainClick}
          disabled={isActionLocked}
          className="w-full px-6 py-5 text-xl font-bold text-slate-900 bg-amber-400 rounded-lg shadow-lg hover:bg-amber-300 transition-all duration-300 transform hover:scale-105 disabled:bg-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed disabled:transform-none"
        >
          PLAY AGAIN
        </button>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleShowWordLogClick}
            disabled={isActionLocked}
            className="w-full px-6 py-4 text-lg font-bold text-slate-300 bg-transparent border-2 border-slate-600 rounded-lg shadow-lg hover:bg-slate-700/50 transition-all duration-300 disabled:bg-slate-700/50 disabled:text-slate-500 disabled:cursor-not-allowed"
          >
            VIEW EVENT LOG
          </button>
          <button
            onClick={handleMenuClick}
            disabled={isActionLocked}
            className="w-full px-6 py-4 text-lg font-bold text-slate-100 bg-slate-600 rounded-lg shadow-lg hover:bg-slate-500 transition-all duration-300 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed"
          >
            MENU
          </button>
        </div>
      </div>
    </div>
  );
};

export default GameOverScreen;
