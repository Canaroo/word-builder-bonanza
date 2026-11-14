import { withSec } from './Seconds';
import React, { useEffect } from 'react';
import ArcadeButton, { type ArcadeButtonColor } from './ArcadeButton';
import { soundService } from '../services/soundService';

// The result of a chance PowerPlay (a roll, a coin flip, a random tile), shown in the middle of
// the screen until the player taps Continue, so the outcome can't slip past unread.
export interface OutcomeData { icon: string; headline: string; tone: 'win' | 'lose' | 'neutral' }

// Full class strings (not built from parts) so Tailwind keeps them.
const TONE: Record<OutcomeData['tone'], { label: string; text: string; border: string; glow: string; button: ArcadeButtonColor }> = {
  win: { label: 'YOU GOT', text: 'text-neon-green', border: 'border-neon-green', glow: 'shadow-[0_0_28px_rgba(57,255,140,0.5)]', button: 'green' },
  lose: { label: 'TOUGH LUCK', text: 'text-neon-red', border: 'border-neon-red', glow: 'shadow-[0_0_28px_rgba(255,71,87,0.55)]', button: 'red' },
  neutral: { label: 'RESULT', text: 'text-neon-yellow', border: 'border-neon-yellow', glow: 'shadow-[0_0_28px_rgba(255,210,63,0.5)]', button: 'yellow' },
};

const OutcomeCard: React.FC<{ name: string; detail?: string; data: OutcomeData; onClose: () => void }> = ({ name, detail, data, onClose }) => {
  const t = TONE[data.tone] ?? TONE.neutral;
  useEffect(() => {
    if (data.tone === 'win') soundService.playMilestone();
    else if (data.tone === 'lose') soundService.playInvalidWord();
    else soundService.playPowerUp();
  }, [data.tone]);

  return (
    <div className="absolute inset-0 bg-crt-950/85 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" role="dialog" aria-modal="true" aria-label={`${name}: ${data.headline}`}>
      <div className={`bg-crt-900 border-4 rounded-2xl px-5 py-6 max-w-md w-full flex flex-col items-center text-center gap-2 level-stage-in ${t.border} ${t.glow}`}>
        <p className="osd-text text-lg tracking-[0.3em] text-slate-300">{t.label}</p>
        <div className="text-6xl leading-none" aria-hidden="true">{data.icon}</div>
        <p className="font-display text-lg text-white leading-tight">{name}</p>
        <p className={`font-display text-3xl leading-tight ${t.text}`}>{withSec(data.headline)}</p>
        {detail && <p className="text-slate-200 leading-snug whitespace-pre-line">{detail}</p>}
        <ArcadeButton color={t.button} className="w-full mt-2" onClick={onClose} autoFocus>Continue</ArcadeButton>
      </div>
    </div>
  );
};

export default OutcomeCard;
