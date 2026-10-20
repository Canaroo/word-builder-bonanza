import React, { useMemo, useState } from 'react';
import { soundService } from '../soundService';
import { PACKS_LIST } from '../../data/packs';
import { Pack } from '../../types';
import ArcadeButton from '../../components/ArcadeButton';
import PlayerPlate, { BadgeIcon, TitleText } from '../../components/PlayerPlate';
import StreakPanel from '../../components/StreakPanel';
import { COSMETICS, type Cosmetic, type CosmeticKind } from '../../data/cosmetics';
import { getProfile, currentStreak } from '../progression';
import { storage, STORAGE_KEYS } from '../storage';
import { POINTS_PER_CREDIT, MISSION_REWARD } from '../../config/progression';

interface VibezScreenProps {
  onBack: () => void;
  lexCoins: number;
  unlockedPackIds: string[];
  selectedPackId: string;
  onUnlockPack: (packId: string, cost: number) => void;
  onSelectPack: (packId: string) => void;
  profileVersion?: number;
  onBuyCosmetic: (id: string) => void;
  onEquipCosmetic: (kind: CosmeticKind, id: string | null) => void;
  onBuyFreeze: () => void;
}

type Tab = 'themes' | 'badges' | 'titles' | 'streak';
const TABS: { id: Tab; label: string }[] = [
  { id: 'themes', label: '🎨 Themes' },
  { id: 'badges', label: '🎖️ Badges' },
  { id: 'titles', label: '🏷️ Titles' },
  { id: 'streak', label: '🔥 Streak' },
];

const PREVIEW_TILES: [string, number][] = [['N', 1], ['E', 1], ['R', 1], ['D', 2]];

/** The pack's background with a row of its tiles on top. */
const PackPreview: React.FC<{ pack: Pack }> = ({ pack }) => (
  <div className={`relative isolate overflow-hidden rounded-lg h-20 flex items-center justify-center gap-1.5 px-2 ${pack.previewClass}`}>
    {PREVIEW_TILES.map(([letter, points]) => (
      <div
        key={letter}
        className={`tile-3d relative z-10 w-11 h-11 rounded-lg flex items-center justify-center ${pack.tileClass}`}
        aria-hidden="true"
      >
        <span className="font-tile font-extrabold text-2xl leading-none">{letter}</span>
        <span className="absolute bottom-0.5 right-1 font-osd text-xs leading-none">{points}</span>
      </div>
    ))}
  </div>
);

/** Shop for themes, badges, titles and streak freezes. Badges and titles are worn like Rocket League bling. */
const VibezScreen: React.FC<VibezScreenProps> = ({
  onBack, lexCoins, unlockedPackIds, selectedPackId, onUnlockPack, onSelectPack,
  profileVersion = 0, onBuyCosmetic, onEquipCosmetic, onBuyFreeze,
}) => {
  const [tab, setTab] = useState<Tab>('themes');
  const profile = useMemo(() => getProfile(), [profileVersion]);
  const name = storage.getString(STORAGE_KEYS.playerName) || 'Player';
  const streak = currentStreak(profile);

  const click = (fn: () => void) => () => { soundService.playUIClick(); fn(); };

  const renderPackButton = (pack: Pack) => {
    if (selectedPackId === pack.id) {
      return <ArcadeButton color="slate" size="sm" className="w-full" disabled>✓ Playing</ArcadeButton>;
    }
    if (unlockedPackIds.includes(pack.id)) {
      return <ArcadeButton color="purple" size="sm" className="w-full" onClick={click(() => onSelectPack(pack.id))}>Select</ArcadeButton>;
    }
    if (pack.streakDay) {
      return <ArcadeButton color="slate" size="sm" className="w-full" disabled>🔥 {pack.streakDay}-day streak reward</ArcadeButton>;
    }
    const short = pack.cost - lexCoins;
    return (
      <ArcadeButton color="green" size="sm" className="w-full" onClick={click(() => onUnlockPack(pack.id, pack.cost))} disabled={short > 0}>
        {short > 0 ? `🔒 Need ${short} more` : `Unlock · 🪙 ${pack.cost}`}
      </ArcadeButton>
    );
  };

  const renderCosmetic = (item: Cosmetic) => {
    const owned = profile.owned.includes(item.id);
    const worn = profile[item.kind] === item.id;
    let action: React.ReactNode;
    if (worn) {
      action = <ArcadeButton color="slate" size="sm" onClick={click(() => onEquipCosmetic(item.kind, null))}>✓ Wearing</ArcadeButton>;
    } else if (owned) {
      action = <ArcadeButton color="purple" size="sm" onClick={click(() => onEquipCosmetic(item.kind, item.id))}>Wear</ArcadeButton>;
    } else if (item.streakDay) {
      action = <span className="osd-text text-base leading-none text-neon-orange text-right">🔥 {item.streakDay}-DAY<br />STREAK</span>;
    } else {
      const short = item.cost! - lexCoins;
      action = (
        <ArcadeButton color="green" size="sm" disabled={short > 0} onClick={click(() => onBuyCosmetic(item.id))}>
          {short > 0 ? `🔒 ${item.cost}` : `🪙 ${item.cost}`}
        </ArcadeButton>
      );
    }
    return (
      <li key={item.id} className={`flex items-center gap-3 rounded-xl p-3 ${worn ? 'bg-neon-purple/10 ring-2 ring-neon-purple' : 'bg-crt-950/70 ring-1 ring-white/10'}`}>
        {item.kind === 'badge' ? <BadgeIcon cosmetic={item} size="lg" /> : <span className="text-3xl w-14 text-center shrink-0" aria-hidden="true">🏷️</span>}
        <div className="flex-1 min-w-0">
          {item.kind === 'title'
            ? <TitleText cosmetic={item} className="text-xl leading-tight block" />
            : <p className="font-display text-base text-white leading-tight">{item.name}</p>}
          <p className="text-sm text-slate-400 italic leading-snug">{item.flavor}</p>
        </div>
        <div className="shrink-0">{action}</div>
      </li>
    );
  };

  const listFor = (kind: CosmeticKind) => {
    const items = COSMETICS.filter(c => c.kind === kind);
    // Shop items by price, then streak rewards by length.
    return [...items.filter(c => c.cost !== undefined).sort((a, b) => a.cost! - b.cost!), ...items.filter(c => c.streakDay !== undefined)];
  };

  return (
    <div className="flex flex-col h-full min-h-0 p-4 gap-3 animate-fade-in">
      <header className="shrink-0 text-center">
        <h1 className="font-display text-4xl neon-text-pink leading-none">VIBEZ SHOP</h1>
        <div className="mt-2 flex items-center justify-between gap-2 bg-crt-950/80 ring-1 ring-white/10 rounded-xl px-3 py-2">
          <PlayerPlate name={name} badge={profile.badge} title={profile.title} streak={streak} />
          <span className="osd-text text-2xl leading-none text-neon-yellow shrink-0">🪙 {lexCoins}</span>
        </div>
        <p className="osd-text text-sm leading-tight text-slate-400 mt-1">
          EARN CREDITS: DAILY MISSIONS (🪙{MISSION_REWARD[1]}–{MISSION_REWARD[3]}), STREAK MILESTONES, AND 1 PER {POINTS_PER_CREDIT.toLocaleString()} PTS IN A RUN
        </p>
      </header>

      <nav className="shrink-0 grid grid-cols-4 gap-1 bg-crt-950/70 rounded-xl p-1" role="tablist">
        {TABS.map(t => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={click(() => setTab(t.id))}
            className={`osd-text text-base leading-none py-2 rounded-lg transition-colors ${tab === t.id ? 'bg-neon-purple text-white shadow-glow-pink' : 'text-slate-300 hover:bg-white/5'}`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-1 -m-1">
        {tab === 'themes' && (
          <ul className="space-y-3">
            {PACKS_LIST.map(pack => {
              const isSelected = selectedPackId === pack.id;
              const isUnlocked = unlockedPackIds.includes(pack.id);
              return (
                <li key={pack.id} className={`rounded-xl p-3 bg-crt-950/70 space-y-2 ${isSelected ? 'ring-2 ring-neon-pink shadow-glow-pink' : 'ring-1 ring-white/10'}`}>
                  <PackPreview pack={pack} />
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 className="font-display text-lg text-white leading-tight">{pack.name}</h2>
                    {!isUnlocked && !pack.streakDay && <span className="osd-text text-lg leading-none text-neon-yellow shrink-0">🪙 {pack.cost}</span>}
                  </div>
                  <p className="text-sm text-slate-300 leading-snug">{pack.description}</p>
                  {renderPackButton(pack)}
                </li>
              );
            })}
          </ul>
        )}
        {tab === 'badges' && <ul className="space-y-2">{listFor('badge').map(renderCosmetic)}</ul>}
        {tab === 'titles' && <ul className="space-y-2">{listFor('title').map(renderCosmetic)}</ul>}
        {tab === 'streak' && <StreakPanel coins={lexCoins} onBuyFreeze={onBuyFreeze} />}
      </div>

      <div className="shrink-0">
        <ArcadeButton color="yellow" size="lg" className="w-full" onClick={click(onBack)}>
          ◀ Back
        </ArcadeButton>
      </div>
    </div>
  );
};

export default VibezScreen;
