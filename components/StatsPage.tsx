import React, { useEffect, useMemo, useState } from 'react';
import { fetchStats, summarize, type StoredStat } from '../services/stats';
import { BOSSES } from '../data/bosses';
import { MISSION_TEMPLATES } from '../data/missions';
import { BOSS } from '../config/gameplay';

// Stats: anonymous usage numbers from Firebase /stats. Unlinked; open /?stats.
const RANGES = [1, 7, 30, 90];
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

const Section: React.FC<{ title: string; note?: string; children: React.ReactNode }> = ({ title, note, children }) => (
  <section className="rounded-xl bg-crt-950/80 ring-1 ring-white/10 p-3">
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

  return (
    <div className="flex flex-col h-full min-h-0 p-4 gap-3 overflow-y-auto">
      <header className="text-center">
        <h1 className="font-display text-3xl neon-text-cyan leading-none">STATS</h1>
        <p className="osd-text text-base text-slate-400 mt-1">Anonymous totals from every player. {events ? `${events.length} events.` : ''}</p>
        <div className="mt-2 grid grid-cols-4 gap-1" role="tablist">
          {RANGES.map(d => (
            <button key={d} type="button" role="tab" aria-selected={days === d} onClick={() => setDays(d)}
              className={`osd-text text-lg leading-none py-1.5 rounded-md ring-1 ${days === d ? 'bg-neon-cyan text-crt-900 ring-neon-cyan' : 'bg-crt-900/80 text-slate-300 ring-white/10'}`}>
              {d === 1 ? '24H' : `${d}D`}
            </button>
          ))}
        </div>
      </header>

      {error && <p className="text-center text-neon-pink">Couldn't load stats ({error}). Check the /stats rules in Firebase.</p>}
      {!s && !error && <p className="text-center text-slate-400">Loading…</p>}

      {s && (
        <>
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

          <Section title="By day">
            <Table head={['Day', 'Runs', 'Bosses won', 'Missions']} rows={
              Object.entries(s.days).sort(([a], [b]) => b.localeCompare(a)).map(([d, x]) => [d, x.runs, x.bossesWon, x.missionsDone])
            } />
          </Section>
        </>
      )}
      <a href="/" className="osd-text text-center text-neon-yellow text-lg py-2">◀ BACK TO THE GAME</a>
    </div>
  );
};

export default StatsPage;
