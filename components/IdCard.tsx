import React from 'react';
import type { IdCardStats } from '../types';
import { BadgeIcon, TitleText, StreakFlame } from './PlayerPlate';
import { BOSSES } from '../data/bosses';
import { SECRET_BONUSES } from '../data/secretBonuses';

/** A player's "driver's license": badge as the photo, name, title, streak, and their key stats. */
const IdCard: React.FC<{
  name: string;
  badge?: string | null;
  title?: string | null;
  streak?: number;
  bosses?: number;
  card?: IdCardStats;
  /** Footer line, e.g. "AS OF OCT 30, 2026" or "ISSUED OCT 2026". */
  stamp?: string;
}> = ({ name, badge, title, streak = 0, bosses = 0, card, stamp }) => {
  const stats: { label: string; value: string; hint: string }[] = card ? [
    { label: 'Best score', value: card.best.toLocaleString(), hint: 'Highest single run' },
    { label: 'Runs', value: card.runs.toLocaleString(), hint: 'Games finished' },
    { label: 'Avg score', value: card.avg.toLocaleString(), hint: 'Per finished run' },
    { label: 'Top level', value: `LV ${card.level}`, hint: 'Furthest level reached' },
    { label: 'Best word', value: card.word || '—', hint: card.word ? `${card.wordScore.toLocaleString()} pts in one word` : 'Highest-scoring word' },
    { label: 'Longest word', value: card.longest || '—', hint: card.longest ? `${card.longest.length} letters` : 'Most letters in one word' },
    { label: 'Boss Badges', value: `🏅 ${bosses}/${BOSSES.length}`, hint: 'Different bosses beaten' },
    { label: 'Secrets', value: `${card.secrets}/${SECRET_BONUSES.length}`, hint: 'Secret bonuses found' },
  ] : [];

  return (
    <div className="id-card relative w-full max-w-sm mx-auto rounded-2xl p-[3px]" role="group" aria-label={`${name || 'Player'}'s player ID`}>
      {/* Lanyard slot */}
      <div className="absolute left-1/2 -translate-x-1/2 top-2 w-14 h-2.5 rounded-full bg-crt-950 ring-1 ring-white/20 z-10" aria-hidden="true" />
      <div className="relative rounded-[14px] bg-crt-900 overflow-hidden">
        <div className="id-card-header px-3 pt-6 pb-1.5 flex items-center justify-between">
          <span className="font-display text-sm text-crt-900 tracking-wider">WORD NERD</span>
          <span className="osd-text text-sm leading-none text-crt-900/80">PLAYER ID 🪪</span>
        </div>

        <div className="p-3 flex gap-3 items-center">
          <div className="shrink-0 w-[4.5rem] h-[4.5rem] rounded-xl bg-crt-950 ring-2 ring-neon-cyan/50 grid place-items-center">
            {badge ? <BadgeIcon id={badge} size="lg" /> : <span className="text-4xl" aria-hidden="true">👾</span>}
          </div>
          <div className="min-w-0 flex-1">
            <div className="osd-text text-xs leading-none text-slate-500">NAME</div>
            <div className="font-osd text-3xl uppercase tracking-wider text-neon-cyan leading-none truncate">{name || 'Player'}</div>
            <div className="min-h-[1.25rem] mt-0.5">
              {title ? <TitleText id={title} className="text-base leading-tight" /> : <span className="osd-text text-sm text-slate-600">NO TITLE YET</span>}
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              {streak > 0 ? <StreakFlame count={streak} className="text-lg" /> : <span className="osd-text text-sm text-slate-600">NO STREAK</span>}
              <span className="osd-text text-sm text-slate-500">DAY STREAK</span>
            </div>
          </div>
        </div>

        {card ? (
          <dl className="grid grid-cols-2 gap-px bg-white/10 border-t border-white/10">
            {stats.map(s => (
              <div key={s.label} className="bg-crt-900 px-3 py-2 min-w-0">
                <dt className="osd-text text-xs leading-none uppercase tracking-wider text-neon-pink">{s.label}</dt>
                <dd className="font-osd text-2xl leading-tight text-neon-yellow truncate">{s.value}</dd>
                <dd className="text-[11px] leading-tight text-slate-400 truncate">{s.hint}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="border-t border-white/10 px-3 py-4 text-sm text-slate-400 text-center">
            No stats on file for this score. It was posted before player IDs existed.
          </p>
        )}

        <div className="flex items-center justify-between px-3 py-2 border-t border-white/10">
          <span className="id-card-barcode h-5 w-24" aria-hidden="true" />
          <span className="osd-text text-xs leading-none text-slate-500">{stamp}</span>
        </div>
      </div>
    </div>
  );
};

export default IdCard;
