import React from 'react';

interface TimerProps {
  time: number;
  /** Golden Round clock: gold instead of cyan. */
  golden?: boolean;
  /** Level tier color for the normal clock (cyan, yellow, orange, red). */
  tone?: 'cyan' | 'yellow' | 'orange' | 'red';
}

const TIER_TONE = {
  cyan: 'ring-neon-cyan/40 text-neon-cyan drop-shadow-glow-cyan',
  yellow: 'ring-neon-yellow/60 text-neon-yellow drop-shadow-glow-yellow',
  orange: 'ring-neon-orange/70 text-neon-orange drop-shadow-[0_0_8px_#ff8a2a]',
  red: 'ring-neon-red/80 text-neon-red drop-shadow-[0_0_8px_#ff4757]',
} as const;

/** Time bank styled like an LED arcade counter, tinted by level tier; turns red and pulses in the last 10 seconds. */
const Timer: React.FC<TimerProps> = ({ time, golden = false, tone = 'cyan' }) => {
  const isLow = time <= 10;
  const style = isLow
    ? 'ring-neon-red/60 text-neon-red drop-shadow-[0_0_8px_#ff4757] animate-pulse'
    : golden
      ? 'ring-neon-yellow/60 text-neon-yellow drop-shadow-glow-yellow'
      : TIER_TONE[tone];
  return (
    <div
      className={`min-w-[4.5rem] px-2 rounded-lg bg-crt-950/80 ring-1 font-osd text-6xl leading-none text-center tabular-nums ${style}`}
      role="timer"
      aria-label={`${time} seconds left${golden ? ' in the Golden Round' : ''}`}
    >
      {time}
    </div>
  );
};

export default Timer;
