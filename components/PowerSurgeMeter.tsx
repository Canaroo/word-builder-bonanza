
import React from 'react';

interface PowerSurgeMeterProps {
  progress: number;
}

const MAX_PROGRESS = 5;

const PowerSurgeMeter: React.FC<PowerSurgeMeterProps> = ({ progress }) => {
  const isReady = progress >= 4;
  const isComplete = progress >= MAX_PROGRESS;

  return (
    <div className="text-center w-full">
      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
        Word Combo
      </h3>
      <div 
        role="meter"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={MAX_PROGRESS}
        aria-valuetext={`Combo progress ${progress} of ${MAX_PROGRESS}`}
        className="flex justify-between items-center space-x-2 bg-slate-900/50 p-2 rounded-lg"
      >
        <div className="flex flex-1 items-center space-x-2">
          {[...Array(MAX_PROGRESS)].map((_, i) => {
            const isActive = i < progress;
            return (
              <div 
                key={i} 
                className={`flex-1 h-2 rounded-full transition-all duration-300
                  ${isActive ? (isReady ? 'bg-yellow-400' : 'bg-cyan-400') : 'bg-slate-700'}
                  ${isReady && isActive ? 'animate-pulse' : ''}
                `}
                style={{animationDelay: `${i * 100}ms`}}
              />
            );
          })}
        </div>
        <div className={`text-2xl font-bold transition-all duration-300 ${isReady ? 'text-yellow-300 animate-pulse' : 'text-cyan-400/50'}`}>
           ⚡
        </div>
      </div>
       {isReady && !isComplete && (
          <p className="text-xs font-bold text-yellow-300 mt-1 animate-pulse">
            NEXT WORD: x2 SCORE!
          </p>
        )}
    </div>
  );
};

export default PowerSurgeMeter;
