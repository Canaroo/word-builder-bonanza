
import React from 'react';

interface TimerProps {
  time: number;
}

const Timer: React.FC<TimerProps> = ({ time }) => {
  const colorClass = time <= 10 ? 'text-red-500 animate-pulse' : 'text-cyan-400';

  return (
    <div className={`font-digital text-5xl font-bold ${colorClass}`}>
      {time}
    </div>
  );
};

export default Timer;
