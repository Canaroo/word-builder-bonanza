
import React, { useState } from 'react';
import { EasterEgg, Charm, PowerPlay, WordData } from '../../types';
import { soundService } from '../soundService';

interface FinalGameState {
  score: number;
  words: WordData[];
  longestWord: string;
  foundEasterEggs: EasterEgg[];
  activeCharms: Charm[];
  unlockedWordBonusIds: string[];
  activeBuffs: (Charm | PowerPlay)[];
}

interface GameOverScreenProps {
  gameState: FinalGameState;
  onPlayAgain: () => void;
  onSubmitScore: () => void;
  onGoToMenu: () => void;
}

const WordLogModalContent: React.FC<{ words: WordData[] }> = ({ words }) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const WORDS_PER_PAGE = 3;
  const reversedWords = [...words].reverse();
  const totalPages = Math.ceil(reversedWords.length / WORDS_PER_PAGE);

  const wordsForPage = reversedWords.slice(
    currentPage * WORDS_PER_PAGE,
    (currentPage + 1) * WORDS_PER_PAGE
  );

  const handleNextPage = () => {
    if (currentPage < totalPages - 1) {
      soundService.playUIClick();
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 0) {
      soundService.playUIClick();
      setCurrentPage(currentPage - 1);
    }
  };

  const minSwipeDistance = 50;

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      handleNextPage();
    } else if (isRightSwipe) {
      handlePrevPage();
    }
    setTouchStart(null);
    setTouchEnd(null);
  };

  if (words.length === 0) {
    return (
      <div className="text-left my-4 h-[35vh] flex items-center justify-center bg-slate-900/50 p-3 rounded-lg">
        <p className="text-slate-400 text-center">No words found.</p>
      </div>
    );
  }

  return (
    <>
      <div 
        className="text-left space-y-2 my-4 bg-slate-900/50 p-3 rounded-lg"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {wordsForPage.length > 0 ? (
          wordsForPage.map((wd, i) => (
            <div key={i} className="text-slate-200 py-2 border-b border-slate-700/50 last:border-b-0">
              {wd.status === 'valid' ? (
                <>
                  <div className="flex justify-between items-baseline">
                    <span className="font-bold text-lg text-white flex-grow pr-4">{wd.word.toUpperCase()}</span>
                    <div className="text-right flex-shrink-0">
                      <span className="font-semibold text-xl text-cyan-400">+{wd.score}</span>
                      {wd.cumulativeScore !== undefined && (
                          <span className="block text-xs text-amber-400 font-digital">Total: {wd.cumulativeScore}</span>
                      )}
                    </div>
                  </div>
                  {wd.definition && <p className="text-sm text-slate-400 italic my-1">{wd.definition}</p>}
                  
                  {wd.bonuses && wd.bonuses.length > 0 && (
                      <div className="mt-1.5 text-xs bg-slate-800/60 p-2 rounded">
                          <h4 className="font-bold text-slate-300 mb-1">Score Breakdown:</h4>
                          <div className="space-y-0.5">
                            {wd.baseScore !== undefined && (
                                <div className="flex justify-between leading-tight">
                                    <span className="text-slate-400">Base Score</span>
                                    <span className="font-semibold text-slate-200">{wd.baseScore} pts</span>
                                </div>
                            )}
                            {wd.bonuses.map((bonus, bIndex) => (
                                <div key={bIndex} className="flex justify-between leading-tight">
                                    <span className="text-slate-400">{bonus.name}</span>
                                    <span className="font-semibold text-slate-200">{bonus.description}</span>
                                </div>
                            ))}
                          </div>
                      </div>
                  )}
                </>
              ) : (
                <div className="flex justify-between items-baseline opacity-60">
                  <span className="font-bold text-lg text-red-400 line-through">{wd.word.toUpperCase()}</span>
                  <span className="font-semibold text-red-500">Invalid</span>
                </div>
              )}
            </div>
          ))
        ) : <p className="text-slate-400 text-center m-auto h-[35vh] flex items-center justify-center">No words found.</p>}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-3">
          <button onClick={handlePrevPage} disabled={currentPage === 0} className="px-4 py-2 font-bold text-slate-100 bg-slate-600 rounded-lg shadow-lg hover:bg-slate-500 disabled:opacity-50 disabled:cursor-not-allowed">
            &larr; Prev
          </button>
          <span className="font-digital text-slate-300">
            {currentPage + 1} / {totalPages}
          </span>
          <button onClick={handleNextPage} disabled={currentPage >= totalPages - 1} className="px-4 py-2 font-bold text-slate-100 bg-slate-600 rounded-lg shadow-lg hover:bg-slate-500 disabled:opacity-50 disabled:cursor-not-allowed">
            Next &rarr;
          </button>
        </div>
      )}
    </>
  );
};

const StatRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex justify-between items-baseline py-2 border-b border-slate-600">
    <span className="font-bold text-slate-400">{label}</span>
    <span className="text-lg font-semibold text-white">{value}</span>
  </div>
);

const GameOverScreen: React.FC<GameOverScreenProps> = ({ gameState, onPlayAgain, onSubmitScore, onGoToMenu }) => {
  const [showWordLog, setShowWordLog] = useState(false);
  const [confirmPlayAgain, setConfirmPlayAgain] = useState(false);
  const [confirmMenu, setConfirmMenu] = useState(false);

  const handlePlayAgainClick = () => {
    soundService.playUIClick();
    if (confirmPlayAgain) {
      onPlayAgain();
    } else {
      setConfirmPlayAgain(true);
      setConfirmMenu(false);
    }
  };

  const handleSubmitScoreClick = () => {
    soundService.playUIClick();
    setConfirmPlayAgain(false);
    setConfirmMenu(false);
    onSubmitScore();
  };
  
  const handleShowWordLogClick = () => {
    soundService.playUIClick();
    setConfirmPlayAgain(false);
    setConfirmMenu(false);
    setShowWordLog(true);
  };
  
  const handleMenuClick = () => {
    soundService.playUIClick();
    if (confirmMenu) {
        onGoToMenu();
    } else {
        setConfirmMenu(true);
        setConfirmPlayAgain(false);
    }
  }


  return (
    <div className="flex flex-col h-full bg-slate-800 p-6 md:p-8 text-center justify-between relative">
      {showWordLog && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border-2 border-amber-400 rounded-2xl p-6 text-center shadow-2xl max-w-md w-full animate-fade-in">
            <h2 className="text-3xl font-bold text-amber-400 mb-2">Final Word Log</h2>
            <WordLogModalContent words={gameState.words} />
            <button onClick={() => { soundService.playUIClick(); setShowWordLog(false); }} className="w-full mt-4 px-6 py-3 text-xl font-bold text-slate-900 bg-amber-400 rounded-lg shadow-lg hover:bg-amber-300 transition-colors">CLOSE</button>
          </div>
        </div>
      )}

      <div>
        <h1 className="text-5xl font-bold text-red-500">GAME OVER</h1>
      </div>

      <div className="my-6 bg-slate-900 p-4 rounded-lg shadow-inner">
        <h2 className="text-2xl font-bold text-amber-400 mb-4">Final Score</h2>
        <div className={`font-digital font-bold text-white mb-6 transition-all ${gameState.score >= 10000 ? 'text-6xl' : 'text-7xl'}`}>{gameState.score}</div>

        <div className="text-left space-y-2">
          <StatRow label="Words Found" value={gameState.words.filter(w => w.status === 'valid').length} />
          <StatRow label="Longest Word" value={gameState.longestWord.toUpperCase() || 'N/A'} />
          <StatRow label="Buffs Unlocked" value={gameState.activeBuffs.length} />
          <StatRow label="Word Bonuses" value={gameState.unlockedWordBonusIds.length} />
          <StatRow label="Easter Eggs Found" value={gameState.foundEasterEggs.length} />
        </div>
      </div>

      <div className="w-full max-w-sm mx-auto space-y-3">
        <button
          onClick={handleSubmitScoreClick}
          className="w-full px-6 py-4 text-xl font-bold text-slate-900 bg-cyan-400 rounded-lg shadow-lg hover:bg-cyan-300 transition-all duration-300 transform hover:scale-105"
        >
          SUBMIT SCORE
        </button>
        <button
          onClick={handlePlayAgainClick}
          className={`w-full px-6 py-4 text-xl font-bold text-slate-900 rounded-lg shadow-lg transition-all duration-300 transform hover:scale-105 ${confirmPlayAgain ? 'bg-red-500 hover:bg-red-400' : 'bg-amber-400 hover:bg-amber-300'}`}
        >
          {confirmPlayAgain ? 'ARE YOU SURE?' : 'PLAY AGAIN'}
        </button>
        <button
          onClick={handleShowWordLogClick}
          className="w-full px-6 py-3 text-lg font-bold text-slate-100 bg-slate-600 rounded-lg shadow-lg hover:bg-slate-500 transition-all duration-300"
        >
          VIEW WORD LOG
        </button>
        <button
          onClick={handleMenuClick}
          className={`w-full px-6 py-3 text-lg font-bold text-slate-100 rounded-lg shadow-lg transition-all duration-300 ${confirmMenu ? 'bg-red-500 hover:bg-red-400' : 'bg-slate-600 hover:bg-slate-500'}`}
        >
          {confirmMenu ? 'ARE YOU SURE?' : 'MENU'}
        </button>
      </div>
    </div>
  );
};

export default GameOverScreen;
