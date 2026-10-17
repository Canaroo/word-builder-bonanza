
import React, { useState } from 'react';
import { LogEntry } from '../types';
import { soundService } from '../services/soundService';

interface EventLogDisplayProps {
  log: LogEntry[];
}

const EventLogDisplay: React.FC<EventLogDisplayProps> = ({ log }) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const ITEMS_PER_PAGE = 3;
  const reversedLog = [...log].reverse();
  const totalPages = Math.ceil(reversedLog.length / ITEMS_PER_PAGE);

  const itemsForPage = reversedLog.slice(
    currentPage * ITEMS_PER_PAGE,
    (currentPage + 1) * ITEMS_PER_PAGE
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

  const handleTouchStartEvent = (e: React.TouchEvent) => {
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

    if (isLeftSwipe) handleNextPage();
    else if (isRightSwipe) handlePrevPage();
    
    setTouchStart(null);
    setTouchEnd(null);
  };

  if (log.length === 0) {
    return (
      <div className="text-left my-4 h-[35vh] flex items-center justify-center bg-slate-900/50 p-3 rounded-lg">
        <p className="text-slate-400 text-center">No words or events yet!</p>
      </div>
    );
  }

  return (
    <>
      <div
        className="text-left space-y-2 my-4 bg-slate-900/50 p-3 rounded-lg"
        onTouchStart={handleTouchStartEvent}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {itemsForPage.length > 0 ? (
          itemsForPage.map((entry, i) => {
            const key = entry.type === 'word' ? `${entry.word}-${i}` : `${entry.id}-${i}`;
            if (entry.type === 'word') {
              const tileBonuses = entry.bonuses?.filter(b => b.source === 'tile');
              const wordBonuses = entry.bonuses?.filter(b => b.source === 'word' || b.source === 'game');
              const otherBonuses = entry.bonuses?.filter(b => !b.source); // for backward compatibility

              return (
                <div key={key} className="text-slate-200 py-2 border-b border-slate-700/50 last:border-b-0">
                  {entry.status === 'valid' ? (
                    <>
                      <div className="flex justify-between items-baseline">
                        <span className="font-bold text-lg text-white flex-grow pr-4">{entry.word.toUpperCase()}</span>
                        <div className="text-right flex-shrink-0">
                          <span className="font-semibold text-xl text-cyan-400">+{entry.score}</span>
                          {entry.cumulativeScore !== undefined && (
                            <span className="block text-xs text-amber-400 font-digital">Total: {entry.cumulativeScore}</span>
                          )}
                        </div>
                      </div>
                      {entry.definition && <p className="text-sm text-slate-400 italic my-1">{entry.definition}</p>}
                      {(entry.bonuses && entry.bonuses.length > 0) || entry.baseScore !== undefined ? (
                        <div className="mt-1.5 text-xs bg-slate-800/60 p-2 rounded">
                          <h4 className="font-bold text-slate-300 mb-1">
                            Score Calculation:
                          </h4>
                          <div className="space-y-0.5">
                            {entry.baseScore !== undefined && (
                              <div className="flex justify-between leading-tight"><span className="text-slate-400">Raw Tile Score</span><span className="font-semibold text-slate-200">{entry.baseScore} pts</span></div>
                            )}

                            {tileBonuses && tileBonuses.length > 0 && (
                                <div className="pl-2">
                                    <h5 className="font-semibold text-slate-400 italic mt-1">Tile Bonuses:</h5>
                                    {tileBonuses.map((bonus, bIndex) => (
                                        <div key={bIndex} className="flex justify-between leading-tight"><span className="text-slate-400">{bonus.name}</span><span className="font-semibold text-slate-200">{bonus.description}</span></div>
                                    ))}
                                </div>
                            )}
                            
                            {wordBonuses && wordBonuses.length > 0 && (
                                <div className="pl-2">
                                    <h5 className="font-semibold text-slate-400 italic mt-1">Word & Game Bonuses:</h5>
                                    {wordBonuses.map((bonus, bIndex) => (
                                      <div key={bIndex} className="flex justify-between leading-tight"><span className="text-slate-400">{bonus.name}</span><span className="font-semibold text-slate-200">{bonus.description}</span></div>
                                    ))}
                                </div>
                            )}
                            
                            {otherBonuses && otherBonuses.length > 0 && otherBonuses.map((bonus, bIndex) => (
                              <div key={bIndex} className="flex justify-between leading-tight"><span className="text-slate-400">{bonus.name}</span><span className="font-semibold text-slate-200">{bonus.description}</span></div>
                            ))}

                             <div className="flex justify-between leading-tight pt-1 mt-1 border-t border-slate-700"><span className="font-bold text-slate-300">Final Word Score</span><span className="font-bold text-cyan-300">{entry.score} pts</span></div>
                          </div>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div className="flex justify-between items-baseline opacity-60">
                      <span className="font-bold text-lg text-red-400 line-through">{entry.word.toUpperCase()}</span>
                      <span className="font-semibold text-red-500">{entry.word.includes('(STRIKE)') ? 'Strike' : 'Invalid'}</span>
                    </div>
                  )}
                </div>
              );
            } else if (entry.type === 'game_over') {
              const reasonText = entry.reason === 'strikes' ? 'Out of Strikes' : 'Out of Time';
              const reasonColor = entry.reason === 'strikes' ? 'text-red-500' : 'text-cyan-400';
              const icon = entry.reason === 'strikes' ? '☠️' : '⏰';
              return (
                <div key={key} className="text-slate-200 py-2 border-b border-slate-700/50 last:border-b-0 bg-slate-800/50 p-2 rounded-md">
                   <div className="flex justify-between items-baseline">
                        <span className={`font-bold text-md ${reasonColor} flex items-center gap-2`}><span className="text-xl">{icon}</span>GAME OVER</span>
                        <div className="text-right flex-shrink-0">
                          <span className="block text-xs text-amber-400 font-digital">Total: {entry.cumulativeScore}</span>
                        </div>
                   </div>
                   <div className="pl-8 mt-2 space-y-2">
                      <p className="text-sm text-slate-300">Reason: <span className="font-semibold">{reasonText}</span></p>
                      <div>
                        <p className="text-sm text-slate-300 font-semibold mb-1">Final Hand:</p>
                        <div className="flex flex-wrap gap-1">
                          {entry.finalHand.length > 0 ? entry.finalHand.map((letter, idx) => (
                            <div key={idx} className="bg-slate-700 w-8 h-8 flex items-center justify-center font-bold text-white rounded-md text-sm">{letter}</div>
                          )) : <span className="text-xs italic text-slate-500">Empty</span>}
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-slate-300 font-semibold mb-1">Active Buffs:</p>
                        <div className="flex flex-wrap gap-2">
                          {entry.activeBuffs.length > 0 ? entry.activeBuffs.map((buff, idx) => (
                            <div key={idx} className="flex items-center gap-1 bg-slate-700 px-2 py-1 rounded-full text-xs" title={buff.name}>
                              <span className="text-sm">{buff.icon}</span>
                              <span className="text-white">{buff.name}</span>
                            </div>
                          )) : <span className="text-xs italic text-slate-500">None</span>}
                        </div>
                      </div>
                   </div>
                </div>
              );
            } else { // 'event'
              return (
                <div key={key} className="text-slate-200 py-2 border-b border-slate-700/50 last:border-b-0 bg-slate-800/50 p-2 rounded-md">
                   <div className="flex justify-between items-baseline">
                        <span className="font-bold text-md text-amber-300 flex items-center gap-2"><span className="text-xl">{entry.icon}</span>{entry.name}</span>
                        <div className="text-right flex-shrink-0">
                          <span className="font-semibold text-xl text-green-400">+{entry.scoreChange}</span>
                          {entry.cumulativeScore !== undefined && (
                            <span className="block text-xs text-amber-400 font-digital">Total: {entry.cumulativeScore}</span>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-slate-300 italic my-1 pl-8">{entry.description}</p>
                </div>
              )
            }
          })
        ) : <p className="text-slate-400 text-center m-auto h-[35vh] flex items-center justify-center">No log entries here.</p>}
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

export default EventLogDisplay;