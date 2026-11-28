import React, { useState } from 'react';
import Leaderboard from './Leaderboard';
import ArcadeButton from './ArcadeButton';
import { useDailyChamps, type ArchiveDay } from '../services/dailyChamps';
import { DAILY_CHAMP } from '../config/progression';
import { dailyNumber } from '../services/daily';
import { soundService } from '../services/soundService';

const fmtDay = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toUpperCase();

/**
 * v7.100.3 (the owner's ask): 🏆 CHAMPS, the archive of past Daily Challenge winners on the Top 50 screen. Newest day
 * first, from DAILY_CHAMP.firstDay (the first day that counts toward 🏆). Tap a day to see its whole board.
 */
const ChampsArchive: React.FC = () => {
  const { archive, ready } = useDailyChamps();
  const [open, setOpen] = useState<ArchiveDay | null>(null);

  if (open) return (
    <div className="h-full flex flex-col gap-2" data-testid="champs-day">
      <div className="flex items-center justify-between gap-2 shrink-0">
        <ArcadeButton color="slate" variant="outline" size="sm" onClick={() => { soundService.playUIClick(); setOpen(null); }}>◀ All champs</ArcadeButton>
        <span className="osd-text text-lg leading-none text-neon-yellow">DAILY #{open.number} · {fmtDay(open.day)}</span>
      </div>
      <div className="flex-1 min-h-0 flex flex-col">
        <Leaderboard data={open.entries} isLoading={false} source="online" />
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col gap-2 min-h-0" data-testid="champs-archive">
      <p className="osd-text text-sm text-center text-slate-400 shrink-0">
        EVERY PAST DAILY'S WINNER · FROM DAILY #{dailyNumber(DAILY_CHAMP.firstDay)} · TAP ONE FOR ITS BOARD
      </p>
      {!ready ? (
        <p className="osd-text text-xl text-center text-slate-400 blink mt-6">LOADING THE TAPES…</p>
      ) : archive.length === 0 ? (
        <div className="flex flex-col items-center gap-2 mt-6 text-center">
          <span className="text-4xl" aria-hidden="true">🏆</span>
          <p className="osd-text text-xl text-slate-300">NO CHAMPS YET</p>
          <p className="text-sm text-slate-400">The first winner is crowned when today's Daily Challenge ends.</p>
        </div>
      ) : (
        <ol className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-2 p-1 -mx-1">
          {archive.map(d => (
            <li key={d.day}>
              <button type="button" data-testid="champs-row" onClick={() => { soundService.playUIClick(); setOpen(d); }}
                className="w-full text-left flex items-center gap-3 rounded-lg bg-crt-800/60 px-3 py-2 hover:brightness-125 focus-visible:ring-2 focus-visible:ring-white outline-none"
                aria-label={`Daily ${d.number}, ${fmtDay(d.day)}: won by ${d.winners.join(' and ')} with ${d.score.toLocaleString()}. ${d.played} played. Open the board.`}>
                <span className="shrink-0 w-14 text-center">
                  <span className="block osd-text text-lg leading-none text-neon-cyan">#{d.number}</span>
                  <span className="block osd-text text-sm leading-none text-slate-400 mt-0.5">{fmtDay(d.day)}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-osd text-2xl leading-none uppercase tracking-wider text-neon-yellow truncate">🏆 {d.winners.join(' & ')}</span>
                  <span className="block osd-text text-sm leading-none text-slate-400 mt-1">{d.played} PLAYED{d.winners.length > 1 ? ' · A TIE' : ''}</span>
                </span>
                <span className="shrink-0 font-osd text-2xl leading-none tabular-nums text-neon-cyan">{d.score.toLocaleString()}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};

export default ChampsArchive;
