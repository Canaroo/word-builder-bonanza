
import React from 'react';

interface StrikeIndicatorProps {
  currentStrikes: number;
  maxStrikes: number;
}

const StrikeIndicator: React.FC<StrikeIndicatorProps> = ({ currentStrikes, maxStrikes }) => {
  return (
    <div className="flex justify-center items-center gap-1.5 sm:gap-2 h-[36px]">
      {Array.from({ length: maxStrikes }).map((_, index) => (
        <div
          key={index}
          className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full transition-all duration-300
            ${index < currentStrikes ? 'bg-red-500 transform scale-110 shadow-md' : 'bg-gray-300 shadow-inner'}`}
          aria-label={index < currentStrikes ? "Strike used" : "Strike available"}
        ></div>
      ))}
    </div>
  );
};

export default StrikeIndicator;
