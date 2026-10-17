import React from 'react';
import { Tile } from '../types';

interface TileProps {
  tile: Tile;
  onClick: () => void;
  packTileClass: string;
  isHintFirst?: boolean;
  isHintRest?: boolean;
  isGolden?: boolean;
}

const TileComponent: React.FC<TileProps> = ({ tile, onClick, packTileClass, isHintFirst, isHintRest, isGolden }) => {
  const hasMultiplier = tile.multiplier && tile.multiplier > 1;
  const hasTempPoints = tile.tempPoints && tile.tempPoints > 0;
  
  const isSpecialTile = tile.isCombo || tile.isSuper || hasMultiplier;
  const glimmerClass = isSpecialTile ? 'glimmer-effect' : '';

  const handleInteraction = (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (tile.isLocked) return;
    onClick();
  };
  
  const tileStyle = tile.isCombo
    ? 'bg-green-500 text-white'
    : (tile.isSuper || (hasMultiplier && tile.multiplier === 4)
        ? 'bg-red-600 text-white ring-4 ring-red-400 shadow-lg shadow-red-500/50 animate-pulse' 
        : (hasMultiplier
            ? 'bg-purple-600 text-white' 
            : (hasTempPoints 
                ? 'bg-amber-400 text-slate-900 animate-pulse' 
                : packTileClass)));
  
  const hintClass = isHintFirst 
    ? 'ring-4 ring-red-400 ring-inset' 
    : (isHintRest ? 'ring-2 ring-white ring-inset' : '');

  const goldenClass = isGolden ? 'golden-special' : '';


  return (
    <button
      onClick={handleInteraction}
      disabled={tile.isLocked}
      className={`relative w-full h-full font-bold rounded-lg shadow-md flex items-center justify-center cursor-pointer transform hover:scale-110 hover:-translate-y-1 transition-all duration-200 ${tileStyle} ${hintClass} ${goldenClass} ${glimmerClass} ${tile.isLocked ? 'opacity-50 cursor-not-allowed hover:scale-100 hover:-translate-y-0' : ''}`}
      aria-label={`Tile ${tile.letter} with ${tile.points} points ${tile.isLocked ? '(locked for this turn)' : ''}`}
    >
      <span className={`z-10 ${tile.letter.length > 2 ? 'text-lg' : 'text-2xl'}`}>{tile.letter}</span>
      <span className="absolute bottom-0 right-1 text-xs font-bold z-10">{tile.tempPoints ?? tile.points}</span>
      {(tile.isSuper || (hasMultiplier && tile.multiplier === 4)) && (
        <span className="absolute top-0 left-1 text-xs font-extrabold z-10 text-white bg-red-700/80 rounded-full px-1 py-0.5 leading-none shadow-md">
          4X
        </span>
      )}
      {hasMultiplier && !tile.isSuper && tile.multiplier !== 4 && (
        <span className="absolute top-0 right-1 text-xs font-extrabold z-10 text-white bg-purple-700 rounded-full px-1 py-0.5 leading-none">
          x{tile.multiplier}
        </span>
      )}
      {tile.isDuplicate && (
        <span className="absolute top-0 left-1 text-xs font-bold text-slate-900 z-10">🪝</span>
      )}
      {tile.isLocked && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-lg">
          <span className="text-3xl" role="img" aria-label="Locked">🔒</span>
        </div>
      )}
    </button>
  );
};

export default TileComponent;