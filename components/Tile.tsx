import React from 'react';
import { Tile } from '../types';

interface TileProps {
  tile: Tile;
  onClick: () => void;
}

const TileComponent: React.FC<TileProps> = ({ tile, onClick }) => {
  const hasMultiplier = tile.multiplier && tile.multiplier > 1;
  const hasTempPoints = tile.tempPoints && tile.tempPoints > 0;

  return (
    <button
      onClick={onClick}
      onTouchStart={onClick}
      className={`relative w-12 h-14 font-bold text-2xl rounded-lg shadow-md flex items-center justify-center cursor-pointer transform hover:scale-110 hover:-translate-y-1 transition-all duration-200
        ${tile.isSuper 
            ? 'bg-red-600 text-white ring-4 ring-red-400 shadow-lg shadow-red-500/50 animate-pulse' 
            : (hasMultiplier 
                ? 'bg-purple-600 text-white' 
                : (hasTempPoints 
                    ? 'bg-amber-400 text-slate-900 animate-pulse' 
                    : 'bg-amber-200 text-slate-800'))}`}
      aria-label={`Tile ${tile.letter} with ${tile.points} points`}
    >
      <span className="z-10">{tile.letter}</span>
      <span className="absolute bottom-0 right-1 text-xs font-bold z-10">{tile.tempPoints ?? tile.points}</span>
      {hasMultiplier && !tile.isSuper && (
        <span className="absolute top-0 right-1 text-xs font-extrabold z-10 text-white bg-purple-700 rounded-full px-1 py-0.5 leading-none">
          x{tile.multiplier}
        </span>
      )}
      {tile.isDuplicate && (
        <span className="absolute top-0 left-1 text-xs font-bold text-slate-900 z-10">🪝</span>
      )}
    </button>
  );
};

export default TileComponent;