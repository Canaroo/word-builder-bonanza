import React from 'react';
import { LeaderboardEntry } from '../types';

interface LeaderboardProps {
  data: LeaderboardEntry[];
  isLoading: boolean;
}

const Leaderboard: React.FC<LeaderboardProps> = ({ data, isLoading }) => {
  if (isLoading) {
    return (
        <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-amber-400"></div>
        </div>
    );
  }

  const formatDate = (isoString: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
    });
  };

  return (
    <div className="w-full bg-slate-900 p-4 rounded-lg shadow-inner">
      <h3 className="text-xl font-bold text-center text-amber-400 mb-3">TOP 10 SCORES</h3>
      <ol className="space-y-2">
        {data.map((entry, index) => {
          const rank = index + 1;
          const isFirst = rank === 1;
          return (
            <li
              key={`${rank}-${entry.name}-${entry.score}`}
              className={`flex justify-between items-center p-2 rounded-lg transition-all duration-300 ${
                isFirst
                  ? 'bg-amber-400/20 border-2 border-amber-400 shadow-lg transform scale-105'
                  : 'bg-slate-800/50'
              }`}
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
    </div>
  );
};

export default Leaderboard;