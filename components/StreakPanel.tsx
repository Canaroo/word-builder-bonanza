import React from 'react';
import { getProfile, currentStreak, playedToday, nextMilestone, powerWordBonusFor } from '../services/progression';
import { STREAK_MILESTONES, cosmeticById } from '../data/cosmetics';
import { PACKS_LIST } from '../data/packs';
import { STREAK_FREEZE } from '../config/progression';
import ArcadeButton from './ArcadeButton';
import { BadgeIcon } from './PlayerPlate';

/** The streak ladder: today's status, every milestone reward, and streak freezes. */
const StreakPanel: React.FC<{ coins: number; onBuyFreeze: () => void }> = ({ coins, onBuyFreeze }) => {
  const profile = getProfile();
  const streak = currentStreak(profile);
  const banked = playedToday(profile);
  const next = nextMilestone(streak);
  const { freezes, best } = profile.streak;
  const canBuy = freezes < STREAK_FREEZE.maxHeld && coins >= STREAK_FREEZE.cost;

  return (
    <div className="space-y-3 text-left">
      <div className="text-center">
        <div className="font-osd text-6xl leading-none text-neon-orange drop-shadow-[0_0_10px_rgba(255,140,40,0.6)]">🔥{streak}</div>
        <p className="osd-text text-lg leading-tight text-slate-300 mt-1">
          {streak === 0 ? 'FINISH A RUN TODAY TO START A STREAK' : banked ? "TODAY'S DAY IS BANKED · SEE YOU TOMORROW" : 'FINISH A RUN TODAY TO KEEP IT GOING'}
        </p>
        <p className="osd-text text-base leading-tight text-slate-500">BEST {best} · RESETS DAILY AT 8:00 AM</p>
        {next && <p className="osd-text text-lg leading-tight text-neon-yellow mt-1">{next.day - streak} MORE DAY{next.day - streak === 1 ? '' : 'S'} TO {cosmeticById(next.title)?.name.toUpperCase()}</p>}
        <p className="text-sm text-slate-300 mt-1">Your daily Power Word is worth <strong className="text-neon-yellow">+{powerWordBonusFor(streak)}</strong> at this streak.</p>
      </div>

      <ol className="space-y-1.5">
        {STREAK_MILESTONES.map(m => {
          const reached = profile.streak.milestonesClaimed.includes(m.day);
          const title = cosmeticById(m.title);
          const theme = m.themeId ? PACKS_LIST.find(p => p.id === m.themeId) : undefined;
          return (
            <li key={m.day} className={`flex items-center gap-2 rounded-lg p-2 ring-1 ${reached ? 'bg-neon-orange/10 ring-neon-orange/50' : 'bg-crt-900/80 ring-white/10'}`}>
              <span className={`font-osd text-2xl leading-none w-12 text-center shrink-0 ${reached ? 'text-neon-orange' : 'text-slate-500'}`}>{m.day}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold leading-tight ${reached ? 'text-white' : 'text-slate-300'}`}>"{title?.name}" title</p>
                <p className="osd-text text-sm leading-tight text-slate-400">
                  +{m.credits} 🪙{m.badge ? ` · ${cosmeticById(m.badge)?.name} badge` : ''}{theme ? ` · ${theme.name} theme` : ''}
                </p>
              </div>
              {m.badge && <BadgeIcon id={m.badge} size="sm" />}
              <span className="text-lg shrink-0" aria-label={reached ? 'Earned' : 'Locked'}>{reached ? '✅' : '🔒'}</span>
            </li>
          );
        })}
      </ol>

      <div className="rounded-lg p-3 bg-crt-900/80 ring-1 ring-neon-cyan/30">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="font-display text-sm text-neon-cyan leading-none">🧊 STREAK FREEZE</p>
            <p className="text-sm text-slate-300 leading-snug mt-1">Covers one missed day. Hold up to {STREAK_FREEZE.maxHeld}.</p>
          </div>
          <span className="osd-text text-2xl leading-none text-neon-cyan shrink-0">{'🧊'.repeat(freezes) || '—'}</span>
        </div>
        <ArcadeButton color="cyan" size="sm" className="w-full mt-2" disabled={!canBuy} onClick={onBuyFreeze}>
          {freezes >= STREAK_FREEZE.maxHeld ? 'Freezes full' : coins < STREAK_FREEZE.cost ? `🔒 Need ${STREAK_FREEZE.cost - coins} more` : `Buy · 🪙 ${STREAK_FREEZE.cost}`}
        </ArcadeButton>
      </div>
    </div>
  );
};

export default StreakPanel;
