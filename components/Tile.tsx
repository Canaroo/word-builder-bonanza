import React from 'react';
import { Tile } from '../types';

interface TileProps {
  tile: Tile;
  onClick: () => void;
  packTileClass: string;
  /** Position of this tile in a hinted word (1 = first letter), from Carmen Sandiego or Phone-a-Friend. */
  hintOrder?: number;
  isGolden?: boolean;
}

const TileComponent: React.FC<TileProps> = ({ tile, onClick, packTileClass, hintOrder, isGolden }) => {
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
        ? 'bg-red-600 text-white' 
        : (hasMultiplier
            ? 'bg-purple-600 text-white' 
            : (hasTempPoints 
                ? 'bg-amber-400 text-slate-900 animate-pulse' 
                : packTileClass)));
  
  const isSuperLook = tile.isSuper || (hasMultiplier && tile.multiplier === 4);


  return (
    <button
      onClick={handleInteraction}
      disabled={tile.isLocked}
      className={`tile-3d relative w-full h-full rounded-lg flex items-center justify-center cursor-pointer select-none ${tileStyle} ${glimmerClass} ${tile.isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
      aria-label={`Tile ${tile.letter} with ${tile.points} points${hintOrder ? `, hint letter ${hintOrder}` : ''}${isGolden ? ', Golden Tile' : ''}${tile.isLocked ? ' (locked for this turn)' : ''}`}
    >
      {/* Rings and glows are overlays: the tile's own box-shadow is its 3D edge. */}
      {isSuperLook && <span className="tile-overlay ring-4 ring-red-400 animate-pulse" aria-hidden="true" />}
      {isGolden && <span className="tile-overlay golden-special" aria-hidden="true" />}
      {hintOrder !== undefined && (
        <>
          <span className={`tile-overlay ring-4 ${hintOrder === 1 ? 'ring-neon-red' : 'ring-neon-cyan'} animate-pulse`} aria-hidden="true" />
          <span className={`absolute -top-2 -left-2 z-20 w-6 h-6 rounded-full font-osd text-lg leading-6 text-center shadow-md ${hintOrder === 1 ? 'bg-neon-red text-white' : 'bg-neon-cyan text-crt-900'}`} aria-hidden="true">
            {hintOrder}
          </span>
        </>
      )}
      <span className={`z-10 font-display leading-none ${tile.letter.length > 2 ? 'text-base' : tile.letter.length > 1 ? 'text-lg' : 'text-2xl'}`}>{tile.letter}</span>
      <span className="absolute bottom-0.5 right-1 font-osd text-sm leading-none z-10">{tile.tempPoints ?? tile.points}</span>
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