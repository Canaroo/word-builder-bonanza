
import React from 'react';
import { TileData, LetterValues } from '../types';

interface TileProps {
  tile: TileData;
  isSelected: boolean;
  onClick?: (tile: TileData) => void;
  letterValues: LetterValues;
  isSmall?: boolean; // For contexts where a smaller tile is needed (e.g. brainstorm choices)
}

const Tile: React.FC<TileProps> = ({ tile, isSelected, onClick, letterValues, isSmall = false }) => {
  const sizeClasses = isSmall ? "w-9 h-9 text-lg" : "w-10 h-10 sm:w-12 sm:h-12 text-xl sm:text-2xl";
  const pointsSizeClasses = isSmall ? "text-[0.6rem]" : "text-xs";
  
  return (
    <div
      id={tile.id}
      className={`
        ${sizeClasses} flex flex-col items-center justify-center font-bold cursor-pointer select-none
        shadow-md transition-all duration-200 ease-in-out relative rounded-md
        bg-amber-100 text-gray-700 border-b-4 
        ${tile.isDouble ? 'border-amber-500' : 'border-amber-400'}
        ${isSelected ? 'transform -translate-y-1 scale-110 shadow-xl !border-blue-500 ring-2 ring-blue-500 z-10' : 'hover:opacity-80'}
      `}
      onClick={() => onClick?.(tile)}
      aria-label={`Tile ${tile.letter}, points ${letterValues[tile.letter]}`}
    >
      {tile.isDouble && (
        <span className="absolute top-0 left-1 text-[0.6rem] sm:text-xs font-black text-amber-600 z-10">2X</span>
      )}
      <span className="flex-grow flex items-center justify-center">{tile.letter}</span>
      <span 
        className={`
          ${pointsSizeClasses} font-semibold absolute bottom-0.5 right-0.5 px-1 rounded-sm bg-black/10
          ${tile.isDouble ? 'text-amber-600 font-extrabold' : 'text-gray-600'}
        `}
      >
        {letterValues[tile.letter]}
      </span>
    </div>
  );
};

export default Tile;
