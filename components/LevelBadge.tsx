import React from 'react';
import { levelFor, clockSpeedFor, levelTierFor, levelProgressFor } from '../services/rules';
import { GAMEPLAY } from '../config/gameplay';

export type LevelTone = 'cyan' | 'yellow' | 'orange' | 'red';

// Full class strings (not built from parts) so Tailwind keeps them.
const TONE: Record<LevelTone, { frame: string; text: string; bar: string; flash: string }> = {
  cyan: { frame: 'ring-neon-cyan/60 shadow-[0_0_10px_rgba(34,228,255,0.35)]', text: 'text-neon-cyan', bar: 'bg-neon-cyan', flash: '#22e4ff' },
  yellow: { frame: 'ring-neon-yellow/70 shadow-[0_0_10px_rgba(255,210,63,0.4)]', text: 'text-neon-yellow', bar: 'bg-neon-yellow', flash: '#ffd23f' },
  orange: { frame: 'ring-neon-orange/80 shadow-[0_0_12px_rgba(255,138,42,0.5)]', text: 'text-neon-orange', bar: 'bg-neon-orange', flash: '#ff8a2a' },
  red: { frame: 'ring-neon-red shadow-[0_0_14px_rgba(255,71,87,0.6)] level-meltdown', text: 'text-neon-red', bar: 'bg-neon-red', flash: '#ff4757' },
};

/** The run's level under the timer: level, tier name, clock speed and words to the next level. `flash` plays the level-up flash. */
const LevelBadge: React.FC<{ validWords: number; flash?: boolean }> = ({ validWords, flash = false }) => {
  const level = levelFor(validWords);
  const tier = levelTierFor(level);
  const tone = TONE[tier.tone];
  const speed = clockSpeedFor(level);
  const { done, needed } = levelProgressFor(validWords);
  return (
    <div
      className={`mt-1 mx-auto w-[9.5rem] rounded-md bg-crt-950/85 ring-2 px-1.5 py-1 ${tone.frame} ${flash ? 'level-flash' : ''}`}
      style={{ '--level-flash': tone.flash } as React.CSSProperties}
      aria-label={`Level ${level}, ${tier.name.toLowerCase()}, clock x${speed}, ${done} of ${needed} words to the next level`}
      title={`Every ${GAMEPLAY.levels.wordsPerLevel} words the level goes up and the clock runs faster`}
    >
      <div className={`flex items-baseline justify-center gap-1.5 leading-none ${tone.text}`}>
        <span className="font-osd text-2xl leading-none">LV {level}</span>
        <span className="osd-text text-sm leading-none truncate">{tier.name}</span>
      </div>
      <div className="mt-1 flex items-center gap-1.5">
        <span className={`osd-text text-sm leading-none tabular-nums ${speed > 1 ? tone.text : 'text-slate-400'}`}>x{speed}</span>
        <div className="flex-1 h-1.5 rounded-full bg-crt-700 overflow-hidden">
          <div className={`h-full ${tone.bar} transition-[width] duration-300`} style={{ width: `${(done / needed) * 100}%` }} />
        </div>
        <span className="osd-text text-sm leading-none tabular-nums text-slate-300">{done}/{needed}</span>
      </div>
    </div>
  );
};

export default LevelBadge;
