import React, { useState } from 'react';
import ArcadeButton from './ArcadeButton';
import { INITIAL_SHUFFLES } from '../constants';

interface ShuffleButtonProps {
  count: number;
  /** Seconds a shuffle adds to the clock. */
  seconds: number;
  disabled: boolean;
  /** The clock is low: pulse to point the player at their lifeline. */
  lowTime: boolean;
  /** Where the "+5" flies to when the button is tapped. */
  timerRef: React.RefObject<HTMLElement | null>;
  onShuffle: () => void;
}

const MAX_DOTS = 5;

/**
 * Shuffle is the time lifeline: a fresh hand plus a few seconds. The button says so on its
 * own line (a green "+5 SEC" chip), shows the shuffles left as dots, pulses when time is low,
 * and sends a "+5" flying up to the timer when tapped.
 */
const ShuffleButton: React.FC<ShuffleButtonProps> = ({ count, seconds, disabled, lowTime, timerRef, onShuffle }) => {
  const [fly, setFly] = useState<{ key: number; x: number; y: number; dx: number; dy: number } | null>(null);
  const totalDots = Math.max(INITIAL_SHUFFLES, count);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const from = e.currentTarget.getBoundingClientRect();
    const to = timerRef.current?.getBoundingClientRect();
    if (to) {
      const x = from.left + from.width / 2;
      const y = from.top + from.height / 2;
      setFly({ key: Date.now(), x, y, dx: to.left + to.width / 2 - x, dy: to.top + to.height / 2 - y });
    }
    onShuffle();
  };

  return (
    <>
      <ArcadeButton
        color="cyan"
        onClick={handleClick}
        disabled={disabled}
        className={`!flex-col !gap-1 !py-1.5 ${lowTime && !disabled ? 'lifeline-pulse' : ''}`}
        aria-label={`Shuffle: new hand and plus ${seconds} seconds. ${count} left.`}
      >
        <span className="leading-none">🔀 Shuffle</span>
        <span className="flex items-center gap-2 leading-none">
          <span className={`font-osd normal-case text-base leading-none px-1.5 py-0.5 rounded-md ${disabled ? 'bg-crt-600 text-slate-400' : 'bg-crt-900 text-neon-green'}`}>
            ⏱ +{seconds} SEC
          </span>
          <span className="flex items-center gap-0.5" aria-hidden="true">
            {totalDots <= MAX_DOTS
              ? Array.from({ length: totalDots }, (_, i) => (
                  <span key={i} className={`w-2 h-2 rounded-full ${i < count ? (disabled ? 'bg-slate-400' : 'bg-crt-900') : 'border border-current opacity-40'}`} />
                ))
              : <span className="font-osd normal-case text-base leading-none">×{count}</span>}
          </span>
        </span>
      </ArcadeButton>
      {fly && (
        <span
          key={fly.key}
          className="lifeline-fly fixed z-50 pointer-events-none font-osd text-3xl leading-none text-neon-green"
          style={{ left: fly.x, top: fly.y, ['--fly-x' as string]: `${fly.dx}px`, ['--fly-y' as string]: `${fly.dy}px` }}
          onAnimationEnd={() => setFly(null)}
          aria-hidden="true"
        >
          +{seconds}
        </span>
      )}
    </>
  );
};

export default ShuffleButton;
