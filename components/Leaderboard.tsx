import React, { useState } from 'react';
import { LeaderboardEntry } from '../types';
import { soundService } from '../services/soundService';
import { leaderboardService } from '../services/leaderboardService';

interface LeaderboardProps {
  data: LeaderboardEntry[];
  isLoading: boolean;
}

const Leaderboard: React.FC<LeaderboardProps> = ({ data, isLoading }) => {
  const [currentPage, setCurrentPage] = useState(0);
  const SCORES_PER_PAGE = 10;

  const lastSubmitted = leaderboardService.getLastSubmitted();

  if (isLoading) {
    return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-amber-400"></div>
        </div>
    );
  }

  const formatDate = (isoString: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short"
    });
  };

  const totalPages = Math.ceil(data.length / SCORES_PER_PAGE);
  const scoresForPage = data.slice(
    currentPage * SCORES_PER_PAGE,
    (currentPage + 1) * SCORES_PER_PAGE
  );

  const handleNextPage = () => {
    if (currentPage < totalPages - 1) {
      soundService.initialize();
      soundService.playUIClick();
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 0) {
      soundService.initialize();
      soundService.playUIClick();
      setCurrentPage(currentPage - 1);
    }
  };

  return (
    <div className="w-full bg-slate-900 p-4 rounded-lg shadow-inner flex-grow flex flex-col">
      <h3 className="text-xl font-bold text-center text-amber-400 mb-3 shrink-0">TOP 50 SCORES</h3>
      {data.length > 0 ? (
        <>
          <ol className="space-y-2 flex-grow overflow-y-auto pr-2 min-h-[350px]">
            {scoresForPage.map((entry, index) => {
              const rank = (currentPage * SCORES_PER_PAGE) + index + 1;
              const isFirst = rank === 1;
              const isOwnScore = lastSubmitted !== null && entry.date === lastSubmitted.date && entry.score === lastSubmitted.score;

              return (
                <li
                  key={`${rank}-${entry.name}-${entry.score}`}
                  className={`flex justify-between items-center p-2 rounded-lg transition-all duration-300 ${
                    isFirst
                      ? 'bg-amber-400/20 border-2 border-amber-400 shadow-lg'
                      : 'bg-slate-800/50'
                  } ${isOwnScore ? 'highlight-own-score' : ''}`}
                >
                  <div className="flex items-center">
                    <span className={`font-bold w-10 text-center mr-2 ${isFirst ? 'text-amber-300 text-2xl' : 'text-slate-500 text-lg'}`}>
                      {isFirst ? '👑' : `${rank}.`}
                    </span>
                    <div>
                      <span className={`font-semibold ${isFirst ? 'text-amber-200 text-xl' : 'text-slate-300 text-lg'}`}>
                        {entry.name}
                      </span>
                      <p className="text-xs text-slate-400">{formatDate(entry.date)}</p>
                    </div>
                  </div>
                  <span className={`font-digital font-bold ${isFirst ? 'text-amber-300 text-2xl' : 'text-cyan-400 text-xl'}`}>
                    {entry.score}
                  </span>
                </li>
              );
            })}
          </ol>
          {totalPages > 1 && (
            <div className="flex justify-between items-center mt-3 shrink-0">
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
      ) : (
        <div className="flex items-center justify-center text-slate-500 italic min-h-[350px]">
          No scores yet. Be the first!
        </div>
      )}
    </div>
  );
};

export default Leaderboard;