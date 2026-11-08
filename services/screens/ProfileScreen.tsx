import React, { useMemo } from 'react';
import IdCard from '../../components/IdCard';
import ArcadeButton from '../../components/ArcadeButton';
import ScreenShell from '../../components/ScreenShell';
import type { TabId } from '../../components/BottomTabs';
import type { StartOpen } from './StartScreen';
import { getProfile, currentStreak } from '../progression';
import { getCareer, idCardStats } from '../career';
import { currentPlayer } from '../players';
import { soundService } from '../soundService';

interface ProfileScreenProps {
  onBack: () => void;
  onTab: (tab: TabId) => void;
  onEditBling: () => void;
  onShowHowToPlay: () => void;
  /** Switch player, streak, Event Logs and Missed Words live on the start screen. */
  onOpenOnHome: (what: StartOpen) => void;
  lexCoins: number;
}

/** The Me tab: the current player's ID card, then everything about you and the game. */
const ProfileScreen: React.FC<ProfileScreenProps> = ({ onBack, onTab, onEditBling, onShowHowToPlay, onOpenOnHome, lexCoins }) => {
  const { player, profile, card, since } = useMemo(() => ({
    player: currentPlayer(),
    profile: getProfile(),
    card: idCardStats(),
    since: getCareer().since,
  }), []);
  const stamp = since
    ? `ISSUED ${new Date(since).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }).toUpperCase()}`
    : 'FINISH A RUN TO START YOUR RECORD';
  const click = (fn: () => void) => () => { soundService.playUIClick(); fn(); };
  const links: { icon: string; label: string; onClick: () => void }[] = [
    { icon: '👥', label: 'Switch Player', onClick: () => onOpenOnHome('switcher') },
    { icon: '🔥', label: 'Streak & Freezes', onClick: () => onOpenOnHome('streak') },
    { icon: '📘', label: 'How to Play', onClick: onShowHowToPlay },
    { icon: '📼', label: 'Event Logs', onClick: () => onOpenOnHome('logs') },
    { icon: '🧠', label: 'Missed Words', onClick: () => onOpenOnHome('missed') },
  ];

  return (
    <ScreenShell title="MY ID" onBack={onBack} credits={lexCoins} tab="me" onTab={onTab}>
      <div className="flex flex-col gap-3 max-w-sm mx-auto">
        <IdCard
          name={player.name}
          badge={profile.badge}
          title={profile.title}
          streak={currentStreak(profile)}
          bosses={profile.bossBadges.length}
          card={card}
          stamp={stamp}
        />
        <p className="text-sm text-slate-400 text-center leading-snug">
          Other players see this card when they tap your name on the Top 50. Each name on this device keeps its own ID.
        </p>
        <ArcadeButton color="purple" variant="outline" className="w-full" onClick={click(onEditBling)}>🏷️ Change Badge &amp; Title</ArcadeButton>
        <ul className="flex flex-col divide-y divide-white/10 rounded-xl ring-1 ring-white/10 bg-crt-950/60 overflow-hidden">
          {links.map(item => (
            <li key={item.label}>
              <button type="button" onClick={click(item.onClick)} className="w-full flex items-center gap-3 px-4 min-h-[3rem] text-left hover:bg-white/5">
                <span className="text-xl leading-none" aria-hidden="true">{item.icon}</span>
                <span className="flex-1 font-display text-base text-slate-100">{item.label}</span>
                <span className="text-slate-500" aria-hidden="true">›</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="osd-text text-center text-neon-cyan/60 text-base">VER {__APP_VERSION__}</p>
      </div>
    </ScreenShell>
  );
};

export default ProfileScreen;
