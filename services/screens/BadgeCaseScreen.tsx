import React, { useMemo } from 'react';
import { BOSSES, type Boss, type BossTier } from '../../data/bosses';
import { BOSS } from '../../config/gameplay';
import { getProfile } from '../progression';
import { soundService } from '../soundService';
import ArcadeButton from '../../components/ArcadeButton';

interface BadgeCaseScreenProps {
  onBack: () => void;
}

// Shelves, in the order bosses show up in a run.
const TIERS: { tier: BossTier; title: string; when: string; tone: string; ring: string }[] = [
  { tier: 'early', title: 'Rookie Bosses', when: `LEVEL ${BOSS.everyLevels}`, tone: 'text-neon-cyan', ring: 'ring-neon-cyan/60' },
  { tier: 'mid', title: 'Rival Bosses', when: `LEVELS ${BOSS.everyLevels * 2} & ${BOSS.everyLevels * 3}`, tone: 'text-neon-purple', ring: 'ring-neon-purple/60' },
  { tier: 'late', title: 'Final Bosses', when: `LEVEL ${BOSS.everyLevels * 4}+`, tone: 'text-neon-pink', ring: 'ring-neon-pink/60' },
];

const BadgeCaseScreen: React.FC<BadgeCaseScreenProps> = ({ onBack }) => {
  const earned = useMemo(() => new Set(getProfile().bossBadges), []);
  const total = BOSSES.length;
  const percent = Math.round((earned.size / total) * 100);

  const handleBack = () => {
    soundService.playUIClick();
    onBack();
  };

  const card = (boss: Boss, ring: string, tone: string) => earned.has(boss.id) ? (
    <div key={boss.id} className={`rounded-xl bg-crt-900/90 ring-2 ${ring} p-2.5 flex flex-col gap-1.5 min-h-[8.5rem]`} aria-label={`${boss.name} Boss Badge, earned. Rule: ${boss.description}`}>
      <div className="relative flex-1 grid place-items-center rounded-lg bg-gradient-to-br from-crt-700 to-crt-950">
        <span className="text-4xl" aria-hidden="true">{boss.icon}</span>
        <span className="absolute -top-1 -right-1 text-xl" aria-hidden="true">🏅</span>
      </div>
      <div className="font-display text-sm text-white leading-tight">{boss.name}</div>
      <div className="text-xs text-slate-400 leading-snug">{boss.source}</div>
      <div className={`osd-text text-base leading-none ${tone}`}>{boss.rule}</div>
    </div>
  ) : (
    <div key={boss.id} className="rounded-xl bg-crt-950/80 ring-1 ring-white/10 p-2.5 flex flex-col gap-1.5 min-h-[8.5rem]" aria-label={`Unknown boss, not beaten yet. Rule: ${boss.description}`}>
      <div className="flex-1 grid place-items-center rounded-lg bg-crt-900/80 border border-dashed border-white/15">
        <span className="font-display text-3xl text-slate-600" aria-hidden="true">?</span>
      </div>
      <div className="font-display text-sm text-slate-500 leading-tight">???</div>
      <div className="osd-text text-base leading-none text-slate-400">{boss.rule}</div>
    </div>
  );

  return (
    <div className="relative flex flex-col h-full min-h-0 p-4 gap-3">
      <header className="shrink-0 text-center">
        <h1 className="font-display text-4xl neon-text-cyan leading-none">BOSS BADGES</h1>
        <p className="osd-text text-lg text-neon-pink leading-tight mt-1">
          {earned.size === total ? '★ EVERY BOSS BEATEN. FLAWLESS VICTORY. ★' : `EVERY ${BOSS.everyLevels}RD LEVEL A BOSS APPEARS. LAND ${BOSS.hitsToWin} HITS IN ${BOSS.words} WORDS TO WIN ITS BADGE.`}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 h-3 rounded-full bg-crt-950 ring-1 ring-white/15 overflow-hidden" role="progressbar" aria-valuenow={earned.size} aria-valuemin={0} aria-valuemax={total} aria-label="Boss Badges earned">
            <div className="h-full bg-gradient-to-r from-neon-yellow via-neon-orange to-neon-pink transition-all" style={{ width: `${percent}%` }} />
          </div>
          <span className="osd-text text-xl leading-none text-neon-yellow tabular-nums">🏅 {earned.size}/{total}</span>
        </div>
      </header>

      {/* Inner padding keeps the earned-card rings from being clipped by the scroll area. */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-4 p-1 -mx-1">
        {TIERS.map(({ tier, title, when, tone, ring }) => {
          const bosses = BOSSES.filter(b => b.tier === tier);
          return (
            <section key={tier}>
              <h2 className={`font-display text-base flex items-center gap-2 mb-1.5 ${tone}`}>
                <span>{title}</span>
                <span className="osd-text text-base text-slate-500">{when}</span>
                <span className="osd-text text-lg text-slate-400 ml-auto">{bosses.filter(b => earned.has(b.id)).length}/{bosses.length}</span>
              </h2>
              <div className="grid grid-cols-2 gap-2">{bosses.map(b => card(b, ring, tone))}</div>
            </section>
          );
        })}
      </div>

      <div className="shrink-0">
        <ArcadeButton color="yellow" size="lg" className="w-full" onClick={handleBack}>
          ◀ Back
        </ArcadeButton>
      </div>
    </div>
  );
};

export default BadgeCaseScreen;
