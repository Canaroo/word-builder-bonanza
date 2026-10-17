import React from 'react';

interface TimerProps {
  time: number;
}

/** Round clock styled like an LED arcade counter; turns red and pulses in the last 10 seconds. */
const Timer: React.FC<TimerProps> = ({ time }) => {
  const isLow = time <= 10;
  return (
    <div
      className={`min-w-[4.5rem] px-2 rounded-lg bg-crt-950/80 ring-1 font-osd text-6xl leading-none text-center tabular-nums ${
        isLow ? 'ring-neon-red/60 text-neon-red drop-shadow-[0_0_8px_#ff4757] animate-pulse' : 'ring-neon-cyan/40 text-neon-cyan drop-shadow-glow-cyan'
      }`}
      role="timer"
      aria-label={`${time} seconds left`}
    >
      {time}
    </div>
  );
};

export default Timer;
