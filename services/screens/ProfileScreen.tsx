import React, { useMemo } from 'react';
import IdCard from '../../components/IdCard';
import ArcadeButton from '../../components/ArcadeButton';
import { getProfile, currentStreak } from '../progression';
import { getCareer, idCardStats } from '../career';
import { currentPlayer } from '../players';
import { soundService } from '../soundService';

interface ProfileScreenProps {
  onBack: () => void;
  onEditBling: () => void;
}

/** The current player's ID card, with what each number means right on the card. */
const ProfileScreen: React.FC<ProfileScreenProps> = ({ onBack, onEditBling }) => {
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

  return (
    <div className="relative flex flex-col h-full min-h-0 p-4 gap-4 overflow-y-auto">
      <header className="shrink-0 text-center">
        <h1 className="font-display text-4xl neon-text-cyan leading-none">MY ID</h1>
        <p className="osd-text text-lg text-neon-pink leading-tight mt-1">YOUR STATS ON THIS DEVICE. POSTED WITH EVERY SCORE.</p>
      </header>

      <IdCard
        name={player.name}
        badge={profile.badge}
        title={profile.title}
        streak={currentStreak(profile)}
        bosses={profile.bossBadges.length}
        card={card}
        stamp={stamp}
      />

      <p className="text-sm text-slate-400 text-center leading-snug max-w-sm mx-auto">
        Other players see this card when they tap your name on the Top 50. Sharing this device? Each
        name keeps its own ID: switch players on the home screen.
      </p>

      <div className="mt-auto shrink-0 grid gap-3">
        <ArcadeButton color="purple" className="w-full" onClick={click(onEditBling)}>🏷️ Change Badge &amp; Title</ArcadeButton>
        <ArcadeButton color="yellow" size="lg" className="w-full" onClick={click(onBack)}>◀ Back</ArcadeButton>
      </div>
    </div>
  );
};

export default ProfileScreen;
