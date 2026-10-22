import React, { useEffect, useRef, useState } from 'react';
import ArcadeButton from './ArcadeButton';
import { INITIAL_SHUFFLES } from '../constants';
import { GAMEPLAY } from '../config/gameplay';

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
 * and sends a "+5" flying up to the timer when it fires.
 *
 * It's press-and-hold: a fill sweeps across the button and the shuffle fires when it's full, so a
 * stray brush on the way to a tile can't spend one. Letting go early cancels (and says "Hold it").
 * The clock keeps running throughout. Keyboard Enter/Space still shuffles right away.
 */
const ShuffleButton: React.FC<ShuffleButtonProps> = ({ count, seconds, disabled, lowTime, timerRef, onShuffle }) => {
  const [fly, setFly] = useState<{ key: number; x: number; y: number; dx: number; dy: number } | null>(null);
  const totalDots = Math.max(INITIAL_SHUFFLES, count);

  const holdMs = GAMEPLAY.timeBank.shuffleHoldMs;
  const [holding, setHolding] = useState<number | null>(null); // key of the current hold, for the fill animation
  const [nudge, setNudge] = useState(false); // "HOLD TO SHUFFLE" after an early release
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nudgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const clearHold = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setHolding(null);
  };
  useEffect(() => () => { clearHold(); if (nudgeTimer.current) clearTimeout(nudgeTimer.current); }, []);
  // A shuffle that becomes unavailable mid-hold (pop-up, Golden Round) is cancelled.
  useEffect(() => { if (disabled) clearHold(); }, [disabled]);

  const fire = () => {
    clearHold();
    const from = buttonRef.current?.getBoundingClientRect();
    const to = timerRef.current?.getBoundingClientRect();
    if (from && to) {
      const x = from.left + from.width / 2;
      const y = from.top + from.height / 2;
      setFly({ key: Date.now(), x, y, dx: to.left + to.width / 2 - x, dy: to.top + to.height / 2 - y });
    }
    onShuffle();
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled || e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setNudge(false);
    setHolding(Date.now());
    timer.current = setTimeout(fire, holdMs);
  };
  const handleRelease = () => {
    if (!timer.current) return;
    clearHold(); // let go before the fill finished: no shuffle
    setNudge(true);
    if (nudgeTimer.current) clearTimeout(nudgeTimer.current);
    nudgeTimer.current = setTimeout(() => setNudge(false), 1500);
  };
  // Pointer presses are handled above; a click with detail 0 is the keyboard (Enter/Space).
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (e.detail === 0 && !disabled) fire();
  };

  return (
    <>
      <ArcadeButton
        ref={buttonRef}
        color="cyan"
        onPointerDown={handlePointerDown}
        onPointerUp={handleRelease}
        onPointerCancel={handleRelease}
        onLostPointerCapture={handleRelease}
        onClick={handleClick}
        onContextMenu={e => e.preventDefault()}
        disabled={disabled}
        className={`relative overflow-hidden !flex-col !gap-1 !py-1.5 ${lowTime && !disabled ? 'lifeline-pulse' : ''}`}
        aria-label={`Shuffle (press and hold): new hand and plus ${seconds} seconds. ${count} left.`}
      >
        {holding !== null && (
          <span
            key={holding}
            className="shuffle-hold-fill absolute inset-y-0 left-0 bg-white/45 pointer-events-none"
            style={{ animationDuration: `${holdMs}ms` }}
            aria-hidden="true"
          />
        )}
        <span className="relative leading-none">{nudge ? '✋ Hold it' : holding !== null ? '🔀 Shuffling…' : '🔀 Shuffle'}</span>
        <span className="relative flex items-center gap-2 leading-none">
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
