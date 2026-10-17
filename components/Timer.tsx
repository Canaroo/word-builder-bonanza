import React from 'react';

interface TimerProps {
  time: number;
  /** Golden Round clock: gold instead of cyan. */
  golden?: boolean;
}

/** Time bank styled like an LED arcade counter; turns red and pulses in the last 10 seconds. */
const Timer: React.FC<TimerProps> = ({ time, golden = false }) => {
  const isLow = time <= 10;
  const tone = isLow
    ? 'ring-neon-red/60 text-neon-red drop-shadow-[0_0_8px_#ff4757] animate-pulse'
    : golden
      ? 'ring-neon-yellow/60 text-neon-yellow drop-shadow-glow-yellow'
      : 'ring-neon-cyan/40 text-neon-cyan drop-shadow-glow-cyan';
  return (
    <div
      className={`min-w-[4.5rem] px-2 rounded-lg bg-crt-950/80 ring-1 font-osd text-6xl leading-none text-center tabular-nums ${tone}`}
      role="timer"
      aria-label={`${time} seconds left${golden ? ' in the Golden Round' : ''}`}
    >
      {time}
    </div>
  );
};

export default Timer;
