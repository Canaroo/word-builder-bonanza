import React, { useState } from 'react';
import { LeaderboardEntry } from '../types';
import { soundService } from '../services/soundService';
import { leaderboardService, LeaderboardSource } from '../services/leaderboardService';
import ArcadeButton from './ArcadeButton';
import { BadgeIcon, TitleText, StreakFlame, BossBadgeCount } from './PlayerPlate';
import IdCard from './IdCard';
import IdCompare from './IdCompare';
import { idCardStats } from '../services/career';
import { getProfile, currentStreak } from '../services/progression';
import { currentPlayer } from '../services/players';

interface LeaderboardProps {
  data: LeaderboardEntry[];
  isLoading: boolean;
  source?: LeaderboardSource;
  /** Why the worldwide board couldn't load, shown with a Retry button. */
  offlineReason?: string;
  onRetry?: () => void;
}

const Leaderboard: React.FC<LeaderboardProps> = ({ data, isLoading, source = 'local', offlineReason, onRetry }) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [viewing, setViewing] = useState<LeaderboardEntry | null>(null);
  const [comparing, setComparing] = useState(false);
  const openId = (entry: LeaderboardEntry | null) => { setViewing(entry); setComparing(false); };
  const me = () => {
    const profile = getProfile();
    return { name: currentPlayer().name, card: idCardStats(), bosses: profile.bossBadges.length, streak: currentStreak(profile) };
  };
  const SCORES_PER_PAGE = 10;

  const lastSubmitted = leaderboardService.getLastSubmitted();

  if (isLoading) {
    return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="osd-text text-2xl text-neon-cyan blink">LOADING…</div>
        </div>
    );
  }

  // Short, so it fits under the score and leaves the name room: "Oct 22 12:51 AM", with a short
  // year only when it isn't this one ("Mar 4 '25 3:20 PM").
  const formatDate = (isoString: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return '';
    const sameYear = date.getFullYear() === new Date().getFullYear();
    const day = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const year = sameYear ? '' : ` '${String(date.getFullYear()).slice(-2)}`;
    const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    return `${day}${year} ${time}`;
  };

  const totalPages = Math.ceil(data.length / SCORES_PER_PAGE);
  const scoresForPage = data.slice(
    currentPage * SCORES_PER_PAGE,
    (currentPage + 1) * SCORES_PER_PAGE
  );

  const handleNextPage = () => {
    if (currentPage < totalPages - 1) {
      soundService.initialize();
      soundService.playUIClick();
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 0) {
      soundService.initialize();
      soundService.playUIClick();
      setCurrentPage(currentPage - 1);
    }
  };

  return (
    <div className="w-full bg-crt-950/80 ring-1 ring-neon-cyan/30 p-4 rounded-xl flex-1 min-h-0 flex flex-col">
      <h3 className="font-display text-2xl text-center neon-text-pink mb-1 shrink-0">HIGH SCORES</h3>
      {source === 'online' || !leaderboardService.isOnline() ? (
        <p className="osd-text text-base text-center text-neon-cyan/80 mb-3 shrink-0">
          {source === 'online' ? '🌐 Worldwide' : '📱 This device'}
        </p>
      ) : (
        <div className="flex items-center justify-center gap-2 mb-3 shrink-0">
          <p className="osd-text text-base leading-tight text-center text-neon-orange">
            📱 THIS DEVICE · WORLDWIDE BOARD {(offlineReason ?? 'unavailable').toUpperCase()}
          </p>
          {onRetry && (
            <ArcadeButton color="cyan" size="sm" onClick={() => { soundService.initialize(); soundService.playUIClick(); onRetry(); }}>
              ↻ Retry
            </ArcadeButton>
          )}
        </div>
      )}
      {data.length > 0 ? (
        <>
          <p className="osd-text text-sm text-center text-slate-400 -mt-2 mb-1 shrink-0">TAP A PLAYER TO SEE THEIR ID 🪪</p>
          {/* The list scrolls inside the pop-up, so the page buttons and Close always stay on screen. */}
          <ol className="space-y-2 flex-1 min-h-[8rem] overflow-y-auto overscroll-contain p-2 -mx-2">
            {scoresForPage.map((entry, index) => {
              const rank = (currentPage * SCORES_PER_PAGE) + index + 1;
              const isFirst = rank === 1;
              const isOwnScore = leaderboardService.isLastSubmitted(entry, lastSubmitted);

              return (
                <li key={entry.id ?? `${rank}-${entry.name}-${entry.score}`}>
                <button
                  type="button"
                  onClick={() => { soundService.initialize(); soundService.playUIClick(); openId(entry); }}
                  aria-label={`${entry.name}, ${entry.score.toLocaleString()} points. View their player ID`}
                  className={`w-full text-left flex justify-between items-center px-2 py-1.5 rounded-lg hover:brightness-125 focus-visible:ring-2 focus-visible:ring-white outline-none ${
                    isFirst
                      ? 'bg-neon-yellow/10 ring-2 ring-neon-yellow shadow-[0_0_8px_rgba(255,210,63,0.55)]'
                      : 'bg-crt-800/60'
                  } ${isOwnScore ? 'highlight-own-score' : ''}`}
                  >
                  {/* Left: rank, badge, name, and streak / Boss Badges / title under the name. */}
                  <div className="flex items-center min-w-0 flex-1">
                    <span className={`font-osd w-7 min-[375px]:w-10 shrink-0 text-center mr-1 min-[375px]:mr-2 text-2xl leading-none ${rank === 1 ? 'text-neon-yellow' : rank === 2 ? 'text-slate-200' : rank === 3 ? 'text-neon-orange' : 'text-slate-500'}`}>
                      {isFirst ? '👑' : rank}
                    </span>
                    <BadgeIcon id={entry.badge} size="sm" />
                    <div className="text-left min-w-0 ml-1.5">
                      <span className={`block font-osd text-2xl leading-none uppercase tracking-wider truncate ${isFirst ? 'text-neon-yellow' : 'text-slate-100'}`}>
                        {entry.name}
                      </span>
                      {/* Streak, Boss Badges and title share the second line, so the name always fits. */}
                      {(entry.streak || entry.bosses || entry.title) ? (
                        <span className="flex items-center gap-1.5 min-w-0 mt-0.5">
                          <StreakFlame count={entry.streak ?? 0} className="text-sm shrink-0" />
                          <BossBadgeCount count={entry.bosses ?? 0} className="text-sm shrink-0" />
                          {entry.title && <TitleText id={entry.title} className="text-sm leading-none truncate" />}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {/* Right: the score, with the date and time under it. */}
                  <div className="shrink-0 text-right pl-2">
                    <span className={`block font-osd text-2xl min-[375px]:text-3xl leading-none tabular-nums ${isFirst ? 'text-neon-yellow' : 'text-neon-cyan'}`}>
                      {entry.score.toLocaleString()}
                    </span>
                    <span className="block osd-text text-xs min-[375px]:text-sm leading-none text-slate-500 mt-0.5 whitespace-nowrap"><span aria-hidden="true">🪪 </span>{formatDate(entry.date)}</span>
                  </div>
                </button>
                </li>
              );
            })}
          </ol>
          {totalPages > 1 && (
            <div className="flex justify-between items-center mt-3 shrink-0">
              <ArcadeButton color="slate" size="sm" onClick={handlePrevPage} disabled={currentPage === 0}>◀ Prev</ArcadeButton>
              <span className="osd-text text-xl text-slate-300">
                {currentPage + 1} / {totalPages}
              </span>
              <ArcadeButton color="slate" size="sm" onClick={handleNextPage} disabled={currentPage >= totalPages - 1}>Next ▶</ArcadeButton>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center flex-1 min-h-[10rem] gap-2">
          <span className="osd-text text-2xl text-slate-400">NO SCORES YET</span>
          <span className="osd-text text-xl text-neon-yellow blink">INSERT COIN</span>
        </div>
      )}
      {viewing && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 p-4 bg-crt-950/90 backdrop-blur-sm animate-fade-in" role="dialog" aria-modal="true" aria-label={`${viewing.name}'s player ID`} onClick={() => openId(null)}>
          <div className="w-full max-w-sm" onClick={e => e.stopPropagation()}>
            {comparing && viewing.card ? (
              <IdCompare them={{ name: viewing.name, card: viewing.card, bosses: viewing.bosses ?? 0, streak: viewing.streak ?? 0 }} me={me()} />
            ) : (
            <IdCard
              name={viewing.name}
              badge={viewing.badge}
              title={viewing.title}
              streak={viewing.streak ?? 0}
              bosses={viewing.bosses ?? 0}
              card={viewing.card}
              stamp={`THIS SCORE ${viewing.score.toLocaleString()}${viewing.date ? ` · ${formatDate(viewing.date).toUpperCase()}` : ''}`}
            />
            )}
          </div>
          {viewing.card && (
            <ArcadeButton color="purple" className="w-full max-w-sm" onClick={e => { e.stopPropagation(); soundService.playUIClick(); setComparing(c => !c); }}>
              {comparing ? '🪪 Back to their ID' : '⚖️ Compare with my ID'}
            </ArcadeButton>
          )}
          <ArcadeButton color="yellow" className="w-full max-w-sm" onClick={() => { soundService.playUIClick(); openId(null); }}>Close</ArcadeButton>
        </div>
      )}
    </div>
  );
};

export default Leaderboard;