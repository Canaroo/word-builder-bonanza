import React from 'react';
import ArcadeButton, { type ArcadeButtonColor } from './ArcadeButton';
import type { LevelUpInfo } from '../services/rules';

// Level-ups get a look no other pop-up uses, in the level tier's color: a stage card for a normal
// level, and a full-screen takeover when the run enters a new tier (levels 4, 7, 11) or reaches a
// boss level (3, 6, 9...), which is always red: an arcade "WARNING" before the boss shows up.
// Full class strings (not built from parts) so Tailwind keeps them.
const TONE: Record<LevelUpInfo['tone'], { text: string; border: string; glow: string; chip: string; button: ArcadeButtonColor; wash: string }> = {
  cyan: { text: 'text-neon-cyan', border: 'border-neon-cyan', glow: 'shadow-[0_0_28px_rgba(34,228,255,0.55)]', chip: 'bg-neon-cyan text-crt-900', button: 'cyan', wash: 'from-[#06323d] via-crt-950 to-crt-950' },
  yellow: { text: 'text-neon-yellow', border: 'border-neon-yellow', glow: 'shadow-[0_0_28px_rgba(255,210,63,0.55)]', chip: 'bg-neon-yellow text-crt-900', button: 'yellow', wash: 'from-[#3d3106] via-crt-950 to-crt-950' },
  orange: { text: 'text-neon-orange', border: 'border-neon-orange', glow: 'shadow-[0_0_30px_rgba(255,138,42,0.6)]', chip: 'bg-neon-orange text-crt-900', button: 'yellow', wash: 'from-[#4a2106] via-crt-950 to-crt-950' },
  red: { text: 'text-neon-red', border: 'border-neon-red', glow: 'shadow-[0_0_32px_rgba(255,71,87,0.65)]', chip: 'bg-neon-red text-white', button: 'red', wash: 'from-[#4a0b14] via-crt-950 to-crt-950' },
};

const Changes: React.FC<{ info: LevelUpInfo; text: string; hideBossNow?: boolean }> = ({ info, text, hideBossNow = false }) => (
  <ul className="w-full space-y-1.5 my-4 text-left" aria-label="What changed">
    {info.changes.map(c => (
      <li key={c.label} className="flex items-center gap-2 rounded-lg bg-crt-950/70 ring-1 ring-white/10 px-3 py-2">
        <span aria-hidden="true">{c.icon}</span>
        <span className="flex-1 text-slate-200">{c.label}</span>
        <span className="osd-text text-lg leading-none text-slate-500 tabular-nums">{c.from}</span>
        <span className="text-slate-500" aria-label="becomes">→</span>
        <span className={`osd-text text-lg leading-none font-bold tabular-nums ${text}`}>{c.to}</span>
      </li>
    ))}
    {info.boss && !(hideBossNow && info.boss === 'now') && (
      <li className="rounded-lg bg-neon-red/15 ring-1 ring-neon-red/60 px-3 py-2 text-center font-bold text-neon-red">
        👹 {info.boss === 'now' ? 'Boss round starts now!' : 'Boss round next level!'}
      </li>
    )}
  </ul>
);

const LevelUpCard: React.FC<{ info: LevelUpInfo; onClose: () => void }> = ({ info, onClose }) => {
  const t = TONE[info.tone];

  if (info.boss === 'now') {
    const r = TONE.red;
    return (
      <div className={`absolute inset-0 z-50 flex flex-col items-center justify-center p-6 text-center bg-gradient-to-b ${r.wash} level-takeover`} role="dialog" aria-label={`Level ${info.level}: boss level`}>
        <div className="level-scanlines" aria-hidden="true" />
        <p className="osd-text text-xl tracking-[0.3em] text-neon-red animate-pulse">⚠ WARNING ⚠</p>
        <h2 className={`font-display text-5xl leading-none my-2 level-glitch ${r.text}`}>BOSS LEVEL</h2>
        <p className={`font-osd text-3xl leading-none ${t.text}`}>LEVEL {info.level} · {info.tier}</p>
        <div className="w-full max-w-sm"><Changes info={info} text={r.text} hideBossNow /></div>
        <ArcadeButton color="red" size="lg" className="w-full max-w-sm" onClick={onClose}>Face the boss</ArcadeButton>
      </div>
    );
  }

  if (info.newTier) {
    return (
      <div className={`absolute inset-0 z-50 flex flex-col items-center justify-center p-6 text-center bg-gradient-to-b ${t.wash} level-takeover`} role="dialog" aria-label={`Level ${info.level}: now entering ${info.tier}`}>
        <div className="level-scanlines" aria-hidden="true" />
        <p className="osd-text text-xl tracking-[0.3em] text-slate-300">NOW ENTERING</p>
        <h2 className={`font-display text-5xl leading-none my-2 level-glitch ${t.text}`}>{info.tier}</h2>
        <p className={`font-osd text-3xl leading-none ${t.text}`}>LEVEL {info.level}</p>
        <div className="w-full max-w-sm"><Changes info={info} text={t.text} /></div>
        <ArcadeButton color={t.button} size="lg" className="w-full max-w-sm" onClick={onClose}>Continue</ArcadeButton>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 bg-crt-950/85 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" role="dialog" aria-label={`Level ${info.level}`}>
      <div className={`bg-crt-900 border-4 rounded-2xl px-5 py-6 max-w-md w-full flex flex-col items-center text-center level-stage-in ${t.border} ${t.glow}`}>
        <p className="osd-text text-lg tracking-[0.3em] text-slate-300">LEVEL UP</p>
        <p className={`font-osd text-7xl leading-none my-1 ${t.text}`}>LV {info.level}</p>
        <span className={`osd-text text-base leading-none rounded px-2 py-1 ${t.chip}`}>{info.tier}</span>
        <Changes info={info} text={t.text} />
        <ArcadeButton color={t.button} className="w-full" onClick={onClose}>Continue</ArcadeButton>
      </div>
    </div>
  );
};

export default LevelUpCard;
