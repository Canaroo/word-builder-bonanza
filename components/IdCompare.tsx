import React from 'react';
import type { IdCardStats } from '../types';
import { BOSSES } from '../data/bosses';

export interface ComparedPlayer {
  name: string;
  card: IdCardStats;
  bosses: number;
  streak: number;
}

interface Row { label: string; them: number; me: number; show: (v: number, card: IdCardStats) => string; sub?: (card: IdCardStats) => string }

/** The rows of a head-to-head, highest wins each. Exported for tests. */
export const compareRows = (them: ComparedPlayer, me: ComparedPlayer): (Row & { winner: 'them' | 'me' | 'tie' })[] => {
  const rows: Row[] = [
    { label: 'Best score', them: them.card.best, me: me.card.best, show: v => v.toLocaleString() },
    { label: 'Avg score', them: them.card.avg, me: me.card.avg, show: v => v.toLocaleString() },
    { label: 'Runs', them: them.card.runs, me: me.card.runs, show: v => v.toLocaleString() },
    { label: 'Top level', them: them.card.level, me: me.card.level, show: v => `LV ${v}` },
    { label: 'Best word', them: them.card.wordScore, me: me.card.wordScore, show: (v, c) => (c.word ? `${v} pts` : '—'), sub: c => c.word },
    { label: 'Longest word', them: them.card.longest.length, me: me.card.longest.length, show: (v, c) => (c.longest ? `${v} letters` : '—'), sub: c => c.longest },
    { label: 'Boss Badges', them: them.bosses, me: me.bosses, show: v => `🏅 ${v}/${BOSSES.length}` },
    { label: 'Secrets', them: them.card.secrets, me: me.card.secrets, show: v => `${v}` },
    { label: 'Day streak', them: them.streak, me: me.streak, show: v => (v ? `🔥 ${v}` : '—') },
  ];
  return rows.map(r => ({ ...r, winner: r.them > r.me ? 'them' : r.me > r.them ? 'me' : 'tie' }));
};

/** Head-to-head: another player's ID against yours, stat by stat. */
const IdCompare: React.FC<{ them: ComparedPlayer; me: ComparedPlayer }> = ({ them, me }) => {
  const rows = compareRows(them, me);
  const theirWins = rows.filter(r => r.winner === 'them').length;
  const myWins = rows.filter(r => r.winner === 'me').length;
  const verdict = myWins > theirWins ? `YOU LEAD ${myWins}–${theirWins}` : theirWins > myWins ? `${them.name.toUpperCase()} LEADS ${theirWins}–${myWins}` : `DEAD EVEN ${myWins}–${theirWins}`;
  const cell = (v: number, card: IdCardStats, r: Row, win: boolean) => (
    <>
      <span className={`block font-osd text-lg leading-tight truncate ${win ? 'text-neon-yellow' : 'text-slate-400'}`}>
        {win && <span aria-label="leads">▲ </span>}{r.show(v, card)}
      </span>
      {r.sub?.(card) && <span className="block osd-text text-xs leading-none text-slate-500 truncate">{r.sub(card)}</span>}
    </>
  );

  return (
    <div className="id-card w-full max-w-sm mx-auto rounded-2xl p-[3px]" role="group" aria-label={`${them.name} compared with ${me.name}`}>
      <div className="rounded-[14px] bg-crt-900 overflow-hidden">
        <div className="id-card-header px-3 py-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <span className="font-osd text-xl uppercase text-crt-900 truncate">{them.name}</span>
          <span className="font-display text-sm text-crt-900">VS</span>
          <span className="font-osd text-xl uppercase text-crt-900 truncate text-right">{me.name} (YOU)</span>
        </div>
        <dl>
          {rows.map(r => (
            <div key={r.label} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-1.5 border-t border-white/10">
              <dd className="min-w-0 text-left">{cell(r.them, them.card, r, r.winner === 'them')}</dd>
              <dt className="osd-text text-xs uppercase tracking-wider text-neon-pink text-center w-20">{r.label}</dt>
              <dd className="min-w-0 text-right">{cell(r.me, me.card, r, r.winner === 'me')}</dd>
            </div>
          ))}
        </dl>
        <p className="border-t border-white/10 px-3 py-2 text-center font-display text-base text-neon-cyan">{verdict}</p>
      </div>
    </div>
  );
};

export default IdCompare;
