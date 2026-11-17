import React, { useEffect, useMemo, useState } from 'react';
import { musicService } from '../musicService';
import { MUSIC_TRACKS } from '../../data/music';
import { ownedTracks, selectedTrack } from '../music';
import { SHOP_NEWS } from '../../config/progression';
import { soundService } from '../soundService';
import { PACKS_LIST } from '../../data/packs';
import { Pack } from '../../types';
import ArcadeButton from '../../components/ArcadeButton';
import ScreenShell from '../../components/ScreenShell';
import type { TabId } from '../../components/BottomTabs';
import PlayerPlate, { BadgeIcon, TitleText } from '../../components/PlayerPlate';
import StreakPanel from '../../components/StreakPanel';
import { COSMETICS, type Cosmetic, type CosmeticKind } from '../../data/cosmetics';
import { getProfile, currentStreak } from '../progression';
import { storage, STORAGE_KEYS } from '../storage';
import { POINTS_PER_CREDIT, MISSION_REWARD } from '../../config/progression';

interface VibezScreenProps {
  onBack: () => void;
  onTab: (tab: TabId) => void;
  lexCoins: number;
  unlockedPackIds: string[];
  selectedPackId: string;
  onUnlockPack: (packId: string, cost: number) => void;
  onSelectPack: (packId: string) => void;
  profileVersion?: number;
  onBuyCosmetic: (id: string) => void;
  onEquipCosmetic: (kind: CosmeticKind, id: string | null) => void;
  onBuyFreeze: () => void;
  /** Open on this tab (the music banner and the sound panel open 'music'). */
  initialTab?: string;
  onBuyTrack?: (id: string) => void;
  onSelectTrack?: (id: string) => void;
}

type Tab = 'themes' | 'music' | 'badges' | 'titles' | 'streak';
const TABS: { id: Tab; label: string }[] = [
  { id: 'themes', label: '🎨 Themes' },
  { id: 'music', label: '🎵 Music' },
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
  onBack, onTab, lexCoins, unlockedPackIds, selectedPackId, onUnlockPack, onSelectPack,
  profileVersion = 0, onBuyCosmetic, onEquipCosmetic, onBuyFreeze, initialTab, onBuyTrack, onSelectTrack,
}) => {
  const [tab, setTab] = useState<Tab>(() => (TABS.some(t => t.id === initialTab) ? initialTab as Tab : 'themes'));
  // Visiting the shop counts as seeing the "new in the shop" banner (v7.53.0).
  useEffect(() => { storage.setString(STORAGE_KEYS.shopNewsSeen, SHOP_NEWS.id); }, []);
  // Music previews: re-render when one starts or ends, and stop it when leaving the shop.
  const [, setPreviewTick] = useState(0);
  useEffect(() => { const off = musicService.subscribe(() => setPreviewTick(n => n + 1)); return () => { off(); musicService.stopPreview(); }; }, []);
  const ownedMusic = useMemo(() => ownedTracks(), [profileVersion]);
  const playingMusic = useMemo(() => selectedTrack(), [profileVersion]);
  const previewing = musicService.previewing();
  const togglePreview = (id: string) => {
    soundService.initialize();
    if (previewing === id) musicService.stopPreview(); else musicService.preview(id);
  };
  const profile = useMemo(() => getProfile(), [profileVersion]);
  const name = storage.getString(STORAGE_KEYS.playerName) || 'Player';
  const streak = currentStreak(profile);

  const click = (fn: () => void) => () => { soundService.playUIClick(); fn(); };

  const renderPackButton = (pack: Pack) => {
    if (selectedPackId === pack.id) {
      return <ArcadeButton color="slate" size="sm" className="w-full" disabled>✓ Playing</ArcadeButton>;
    }
    if (unlockedPackIds.includes(pack.id)) {
      return <ArcadeButton color="purple" variant="outline" size="sm" className="w-full" onClick={click(() => onSelectPack(pack.id))}>Select</ArcadeButton>;
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
      action = <ArcadeButton color="purple" variant="outline" size="sm" onClick={click(() => onEquipCosmetic(item.kind, item.id))}>Wear</ArcadeButton>;
    } else if (item.earnedBy === 'quack') {
      action = <span className="osd-text text-base leading-none text-neon-yellow text-right">🦆 PLAY QUA<br />4x IN A RUN</span>;
    } else if (item.earnedBy === '70k') {
      action = <span className="osd-text text-base leading-none text-neon-cyan text-right">💎 REACH<br />70,000</span>;
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
    return [...items.filter(c => c.cost !== undefined).sort((a, b) => a.cost! - b.cost!), ...items.filter(c => c.streakDay !== undefined), ...items.filter(c => c.earnedBy !== undefined)];
  };

  return (
    <ScreenShell title="VIBEZ SHOP" tone="pink" onBack={onBack} credits={lexCoins} tab="shop" onTab={onTab} subheader={
      <div className="flex flex-col gap-1.5">
        <nav className="grid grid-cols-5 gap-1 bg-crt-950/70 rounded-xl p-1" role="tablist">
          {TABS.map(t => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={click(() => setTab(t.id))}
              className={`osd-text text-sm leading-none py-2 px-0.5 rounded-lg transition-colors whitespace-nowrap ${tab === t.id ? 'bg-neon-purple text-white shadow-glow-pink' : 'text-slate-300 hover:bg-white/5'}`}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <p className="osd-text text-sm leading-tight text-slate-500 text-center">
          EARN 🪙 FROM MISSIONS ({MISSION_REWARD[1]}–{MISSION_REWARD[3]}), STREAKS AND 1 PER {POINTS_PER_CREDIT.toLocaleString()} PTS
        </p>
      </div>
    }>
      {/* Badges and titles: a live preview of how you look on the Top 50. */}
      {(tab === 'badges' || tab === 'titles') && (
        <div className="mb-2 flex items-center justify-center bg-crt-950/80 ring-1 ring-white/10 rounded-xl px-3 py-2">
          <PlayerPlate name={name} badge={profile.badge} title={profile.title} streak={streak} />
        </div>
      )}
      <div className="p-1 -m-1">
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
        {tab === 'music' && (
          <ul className="space-y-3">
            <li className="text-sm text-slate-300 leading-snug px-1">Pick the soundtrack for your runs. Tap ▶ to hear a bit first. Switch any time from the 🔊 button.</li>
            {MUSIC_TRACKS.map(track => {
              const owned = ownedMusic.includes(track.id);
              const playing = playingMusic === track.id;
              const short = track.cost - lexCoins;
              const hearing = previewing === track.id;
              return (
                <li key={track.id} className={`rounded-xl p-3 bg-crt-950/70 ${playing ? 'ring-2 ring-neon-pink shadow-glow-pink' : 'ring-1 ring-white/10'}`}>
                  <div className="flex items-center gap-3">
                    {/* A cassette with the track's icon on its label */}
                    <div className="relative shrink-0 w-16 h-11 rounded-md bg-gradient-to-b from-slate-700 to-slate-900 ring-1 ring-white/20 flex items-center justify-center" aria-hidden="true">
                      <span className="text-2xl leading-none">{track.icon}</span>
                      <span className={`absolute bottom-1 left-2 w-2.5 h-2.5 rounded-full ring-1 ring-white/40 ${hearing ? 'animate-spin border-t-2 border-white' : ''}`} />
                      <span className={`absolute bottom-1 right-2 w-2.5 h-2.5 rounded-full ring-1 ring-white/40 ${hearing ? 'animate-spin border-t-2 border-white' : ''}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <h2 className="font-display text-base text-white leading-tight">{track.name}</h2>
                        {!owned && <span className="osd-text text-lg leading-none text-neon-yellow shrink-0">🪙 {track.cost}</span>}
                      </div>
                      <p className="text-sm text-slate-300 leading-snug">{track.vibe}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <ArcadeButton color="cyan" variant="outline" size="sm" onClick={() => togglePreview(track.id)} aria-label={hearing ? `Stop the ${track.name} preview` : `Hear a bit of ${track.name}`}>
                      {hearing ? '■ Stop' : '▶ Preview'}
                    </ArcadeButton>
                    {playing ? <ArcadeButton color="slate" size="sm" disabled>✓ Playing</ArcadeButton>
                      : owned ? <ArcadeButton color="purple" variant="outline" size="sm" onClick={click(() => onSelectTrack?.(track.id))}>Play this</ArcadeButton>
                      : <ArcadeButton color="green" size="sm" disabled={short > 0} onClick={click(() => onBuyTrack?.(track.id))}>{short > 0 ? `🔒 Need ${short} more` : `Buy · 🪙 ${track.cost}`}</ArcadeButton>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {tab === 'badges' && <ul className="space-y-2">{listFor('badge').map(renderCosmetic)}</ul>}
        {tab === 'titles' && <ul className="space-y-2">{listFor('title').map(renderCosmetic)}</ul>}
        {tab === 'streak' && <StreakPanel coins={lexCoins} onBuyFreeze={onBuyFreeze} />}
      </div>

    </ScreenShell>
  );
};

export default VibezScreen;
