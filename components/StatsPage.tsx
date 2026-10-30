import React, { useEffect, useMemo, useState } from 'react';
import { fetchStats, summarize, type StoredStat } from '../services/stats';
import { BOSSES } from '../data/bosses';
import { MISSION_TEMPLATES } from '../data/missions';
import { BOSS, POWER_WORD_EFFECTS } from '../config/gameplay';
import { SECRET_BONUSES } from '../data/secretBonuses';
import { CHARMS_LIST } from '../data/charms';
import { POWER_PLAYS_LIST } from '../data/powerPlays';

// Stats: anonymous usage numbers from Firebase /stats. Unlinked; open /?stats.
const RANGES = [1, 7, 30, 90];
const POWER_WORDS = SECRET_BONUSES.filter(b => b.effect).map(b => ({ effect: b.effect!, word: b.word!, icon: b.name.split(' ')[0] }));
const offers = (n: number) => `${n} ${n === 1 ? 'offer' : 'offers'}`;
const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : '–');

const Table: React.FC<{ head: string[]; rows: (string | number)[][]; empty?: string }> = ({ head, rows, empty = 'No data yet.' }) => (
  rows.length ? (
    <table className="w-full text-sm tabular-nums">
      <thead><tr className="text-left text-slate-400">{head.map((h, i) => <th key={h} className={`py-1 pr-2 font-normal ${i ? 'text-right' : ''}`}>{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => (
        <tr key={i} className="border-t border-white/10">{r.map((c, j) => <td key={j} className={`py-1 pr-2 ${j ? 'text-right text-neon-yellow whitespace-nowrap' : 'text-slate-100'}`}>{c}</td>)}</tr>
      ))}</tbody>
    </table>
  ) : <p className="text-sm text-slate-500">{empty}</p>
);

/** A sortable table (click a column header): numbers sort high-first, text A-Z. */
type Cell = string | number | null;
const SortTable: React.FC<{ head: string[]; rows: Cell[][]; fmt?: ((v: Cell) => string)[]; defaultSort?: number; empty?: string }> = ({ head, rows, fmt = [], defaultSort = 1, empty = 'No data yet.' }) => {
  const [col, setCol] = useState(defaultSort);
  const [asc, setAsc] = useState(false);
  if (!rows.length) return <p className="text-sm text-slate-500">{empty}</p>;
  const key = (v: Cell) => (v === null ? -Infinity : v);
  const sorted = [...rows].sort((a, b) => {
    const x = key(a[col]), y = key(b[col]);
    const d = typeof x === 'number' && typeof y === 'number' ? y - x : String(x).localeCompare(String(y));
    return asc ? -d : d;
  });
  const show = (v: Cell, i: number) => (fmt[i] ? fmt[i](v) : v === null ? '–' : typeof v === 'number' ? v.toLocaleString() : v);
  return (
    <table className="w-full text-sm tabular-nums">
      <thead><tr className="text-left text-slate-400">{head.map((h, i) => (
        <th key={h} className={`py-1 pr-3 font-normal ${i ? 'text-right' : ''}`}>
          <button type="button" className={`hover:text-white ${col === i ? 'text-neon-cyan' : ''}`} onClick={() => (col === i ? setAsc(!asc) : (setCol(i), setAsc(i === 0)))}>
            {h}{col === i ? (asc ? ' ▲' : ' ▼') : ''}
          </button>
        </th>
      ))}</tr></thead>
      <tbody>{sorted.map((r, i) => (
        <tr key={i} className="border-t border-white/10 hover:bg-white/5">{r.map((c, j) => <td key={j} className={`py-1 pr-3 ${j ? 'text-right text-neon-yellow whitespace-nowrap' : 'text-slate-100'}`}>{show(c, j)}</td>)}</tr>
      ))}</tbody>
    </table>
  );
};
const rate = (n: number, of: number): number | null => (of ? Math.round((n / of) * 100) : null);
const asPct = (v: Cell) => (v === null ? '–' : `${v}%`);

const Section: React.FC<{ title: string; note?: string; className?: string; children: React.ReactNode }> = ({ title, note, className = '', children }) => (
  <section className={`rounded-xl bg-crt-950/80 ring-1 ring-white/10 p-4 ${className}`}>
    <h2 className="font-display text-base text-neon-cyan">{title}</h2>
    {note && <p className="text-xs text-slate-400 mb-1.5">{note}</p>}
    {children}
  </section>
);

const StatsPage: React.FC = () => {
  const [days, setDays] = useState(7);
  const [events, setEvents] = useState<StoredStat[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setEvents(null); setError('');
    fetchStats(days).then(setEvents).catch(e => setError(String(e?.message ?? e)));
  }, [days]);

  const s = useMemo(() => (events ? summarize(events) : null), [events]);
  const [showAll, setShowAll] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl neon-text-cyan leading-none">STATS</h1>
          <p className="osd-text text-lg text-slate-400 mt-1">Anonymous totals from every player. {events ? `${events.length.toLocaleString()} events.` : ''}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="grid grid-cols-4 gap-1 w-72" role="tablist">
            {RANGES.map(d => (
              <button key={d} type="button" role="tab" aria-selected={days === d} onClick={() => setDays(d)}
                className={`osd-text text-lg leading-none py-1.5 rounded-md ring-1 ${days === d ? 'bg-neon-cyan text-crt-900 ring-neon-cyan' : 'bg-crt-900/80 text-slate-300 ring-white/10'}`}>
                {d === 1 ? '24H' : `${d}D`}
              </button>
            ))}
          </div>
          <a href="./?bonuses" className="osd-text text-lg text-neon-pink underline">BONUS VAULT</a>
          <a href="./" className="osd-text text-lg text-neon-yellow underline">▶ PLAY</a>
        </div>
      </header>

      {error && <p className="text-center text-neon-pink">Couldn't load stats ({error}). Check the /stats rules in Firebase.</p>}
      {!s && !error && <p className="text-center text-slate-400">Loading…</p>}

      {s && (
        <>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 items-start">
          <Section title="Runs">
            <Table head={['', 'Value']} rows={[
              ['Runs finished', s.runs.count],
              ['Average score', s.runs.avgScore.toLocaleString()],
              ['Median score', s.runs.medianScore.toLocaleString()],
              ['Average words', s.runs.avgWords],
            ]} />
          </Section>

          <Section title="How far runs get" note="Share of finished runs that reached each boss level.">
            <Table head={['Level', 'Runs', 'Share']} rows={
              [1, 2, 3, 4, 5].map(n => n * BOSS.everyLevels).map(level => [`Level ${level}`, s.runs.reachedLevel[level] ?? 0, pct(s.runs.reachedLevel[level] ?? 0, s.runs.count)])
            } />
          </Section>

          <Section title="Bosses" note={`Won = ${BOSS.hitsToWin} hits in ${BOSS.words} words. Close = ${BOSS.closeHits}+ hits.`}>
            <Table head={['Boss', 'Met', 'Won', 'Close', 'Avg hits']} rows={
              BOSSES.filter(b => s.bosses[b.id]).map(b => {
                const x = s.bosses[b.id];
                return [`${b.icon} ${b.name}`, x.reached, `${x.won} (${pct(x.won, x.reached)})`, x.close, x.avgHits];
              })
            } empty="No boss rounds yet." />
          </Section>

          <Section title="Boss levels" note="The 1st boss is level 3, the 2nd level 6, and so on.">
            <Table head={['Boss level', 'Reached', 'Won']} rows={
              Object.entries(s.bossNumbers).sort(([a], [b]) => Number(a) - Number(b)).map(([n, x]) => [`#${n} (level ${Number(n) * BOSS.everyLevels})`, x.reached, `${x.won} (${pct(x.won, x.reached)})`])
            } empty="No boss rounds yet." />
          </Section>

          <Section title="Missions" note="Shown = devices that had the mission that day. Done = completions.">
            <Table head={['Mission', 'Tier', 'Shown', 'Done', 'Rate']} rows={
              MISSION_TEMPLATES.filter(t => s.missions[t.id]).map(t => {
                const m = s.missions[t.id];
                return [t.text, ['', 'Easy', 'Med', 'Hard'][t.tier], m.shown, m.done, pct(m.done, m.shown)];
              })
            } empty="No missions recorded yet." />
          </Section>

          <Section title="Power words" note="Secret words with an effect. Repeats = fired again at a later level. Seconds: slot payout, freeze length, or TWIN's cloned time.">
            <Table head={['Word', 'Fired', 'Repeats', 'Detail']} rows={
              POWER_WORDS.filter(p => s.powerWords[p.effect]).map(p => {
                const x = s.powerWords[p.effect];
                const detail = p.effect === 'slot'
                  ? POWER_WORD_EFFECTS.slot.map(o => `${o.reels}${pct(x.payouts[o.seconds] ?? 0, x.fired)}`).join(' ')
                  : p.effect === 'heal' ? `${pct(x.strikes, x.fired)} healed a strike`
                  : p.effect === 'shield' ? `${pct(x.strikes, x.fired)} already shielded`
                  : ['slow', 'rewind', 'sword', 'spice', 'cake'].includes(p.effect) ? '—'
                  : `avg ${Math.round((x.seconds / x.fired) * 10) / 10}s`;
                return [`${p.icon} ${p.word}`, x.fired, x.repeats, detail];
              })
            } empty="No power words played yet." />
          </Section>

          <Section title="By day">
            <Table head={['Day', 'Runs', 'Bosses won', 'Missions']} rows={
              Object.entries(s.days).sort(([a], [b]) => b.localeCompare(a)).map(([d, x]) => [d, x.runs, x.bossesWon, x.missionsDone])
            } />
          </Section>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-300 self-start cursor-pointer">
          <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} />
          Show every charm and PowerPlay, including ones with no data in this range
        </label>
        <div className="grid gap-4 xl:grid-cols-2 items-start">
          <Section title={`Charms (${CHARMS_LIST.length})`} note={`Click a column to sort. Pick % = picked when offered. Runs = runs that ended with it equipped; Avg score = their average. ${offers(s.passes.charm)} passed.`}>
            <SortTable head={['Charm', 'Offered', 'Picked', 'Pick %', 'Runs', 'Avg score']} defaultSort={2} fmt={[, , , asPct]}
              rows={CHARMS_LIST.filter(c => showAll || s.charms[c.id]).map(c => {
                const x = s.charms[c.id] ?? { offered: 0, picked: 0, endRuns: 0, avgEndScore: 0 };
                return [`${c.icon} ${c.name}`, x.offered, x.picked, rate(x.picked, x.offered), x.endRuns, x.endRuns ? x.avgEndScore : null];
              })} empty="No charm offers yet." />
          </Section>
          <Section title={`PowerPlays (${POWER_PLAYS_LIST.length})`} note={`Click a column to sort. Pick % = picked when offered. Use % = share of picks that got used. ${offers(s.passes.powerPlay)} kept the held one.`}>
            <SortTable head={['PowerPlay', 'Offered', 'Picked', 'Pick %', 'Used', 'Use %']} defaultSort={2} fmt={[, , , asPct, , asPct]}
              rows={POWER_PLAYS_LIST.filter(p => showAll || s.powerPlays[p.id]).map(p => {
                const x = s.powerPlays[p.id] ?? { offered: 0, picked: 0, used: 0 };
                return [`${p.icon} ${p.name}`, x.offered, x.picked, rate(x.picked, x.offered), x.used, rate(x.used, x.picked)];
              })} empty="No PowerPlay offers yet." />
          </Section>
        </div>
        </>
      )}
    </div>
  );
};

export default StatsPage;
