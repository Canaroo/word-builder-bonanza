import React, { useEffect, useState } from 'react';
import { getTodaysMissions } from '../services/missions';
import { nextResetAt } from '../services/progression';
import { CATEGORY_ICON, CATEGORY_LABEL } from '../data/missions';
import { MISSION_SWEEP_BONUS } from '../config/progression';

const TIER_LABEL = { 1: 'EASY', 2: 'MEDIUM', 3: 'HARD' } as const;
const TIER_COLOR = { 1: 'text-neon-green', 2: 'text-neon-yellow', 3: 'text-neon-pink' } as const;

const countdown = (to: Date, now: Date) => {
  const mins = Math.max(0, Math.round((to.getTime() - now.getTime()) / 60000));
  const h = Math.floor(mins / 60);
  return h > 0 ? `${h}H ${mins % 60}M` : `${mins}M`;
};

/** Today's three missions with progress bars, rewards and the time left until they reset. */
const MissionsPanel: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const { missions, sweepClaimed } = getTodaysMissions(now);
  const doneCount = missions.filter(m => m.done).length;

  return (
    <section className="w-full rounded-xl bg-crt-950/70 ring-1 ring-neon-cyan/30 p-3 text-left" aria-label="Today's missions">
      <header className="flex items-baseline justify-between gap-2 mb-2">
        <h3 className="font-display text-base text-neon-cyan leading-none whitespace-nowrap">TODAY'S MISSIONS</h3>
        <span className="osd-text text-base leading-none text-slate-400 whitespace-nowrap">
          {doneCount}/{missions.length} · {compact ? '' : 'NEW IN '}{countdown(nextResetAt(now), now)}
        </span>
      </header>
      <ul className="space-y-2">
        {missions.map(({ template: t, progress, done, reward }) => (
          <li key={t.id} className={`rounded-lg p-2 ring-1 ${done ? 'bg-neon-green/10 ring-neon-green/50' : 'bg-crt-900/80 ring-white/10'}`}>
            <div className="flex items-start gap-2">
              <span className="text-xl leading-none mt-0.5" aria-hidden="true">{done ? '✅' : CATEGORY_ICON[t.category]}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm leading-snug ${done ? 'text-slate-400 line-through' : 'text-slate-100'}`}>{t.text}</p>
                {!compact && (
                  <p className="osd-text text-sm leading-none mt-0.5">
                    <span className="text-slate-500">{CATEGORY_LABEL[t.category]} · </span>
                    <span className={TIER_COLOR[t.tier]}>{TIER_LABEL[t.tier]}</span>
                    {t.scope === 'run' && <span className="text-slate-500"> · ONE RUN</span>}
                  </p>
                )}
                {t.target > 1 && !done && (
                  <div className="mt-1 flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-crt-700 overflow-hidden">
                      <div className="h-full bg-neon-cyan" style={{ width: `${Math.round((progress / t.target) * 100)}%` }} />
                    </div>
                    <span className="osd-text text-sm leading-none text-slate-400">{progress}/{t.target}</span>
                  </div>
                )}
              </div>
              <span className={`osd-text text-lg leading-none shrink-0 ${done ? 'text-neon-green' : 'text-neon-yellow'}`}>
                {done ? 'DONE' : `🪙${reward}`}
              </span>
            </div>
          </li>
        ))}
      </ul>
      <p className={`osd-text text-sm leading-none mt-2 text-center ${sweepClaimed ? 'text-neon-green' : 'text-slate-400'}`}>
        {sweepClaimed ? `🧹 DAILY SWEEP COLLECTED (+${MISSION_SWEEP_BONUS})` : `FINISH ALL 3 FOR A 🧹 +${MISSION_SWEEP_BONUS} BONUS`}
      </p>
    </section>
  );
};

export default MissionsPanel;
