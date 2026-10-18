import React from 'react';
import { soundService } from '../soundService';
import { PACKS_LIST } from '../../data/packs';
import { Pack } from '../../types';
import ArcadeButton from '../../components/ArcadeButton';

interface VibezScreenProps {
  onBack: () => void;
  lexCoins: number;
  unlockedPackIds: string[];
  selectedPackId: string;
  onUnlockPack: (packId: string, cost: number) => void;
  onSelectPack: (packId: string) => void;
}

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

const VibezScreen: React.FC<VibezScreenProps> = ({
  onBack,
  lexCoins,
  unlockedPackIds,
  selectedPackId,
  onUnlockPack,
  onSelectPack,
}) => {
  const handleBackClick = () => {
    soundService.playUIClick();
    onBack();
  };

  const handleSelect = (pack: Pack) => {
    soundService.playUIClick();
    onSelectPack(pack.id);
  };

  const handleUnlock = (pack: Pack) => {
    soundService.playUIClick();
    onUnlockPack(pack.id, pack.cost);
  };

  const renderPackButton = (pack: Pack) => {
    if (selectedPackId === pack.id) {
      return <ArcadeButton color="slate" size="sm" className="w-full" disabled>✓ Playing</ArcadeButton>;
    }
    if (unlockedPackIds.includes(pack.id)) {
      return <ArcadeButton color="purple" size="sm" className="w-full" onClick={() => handleSelect(pack)}>Select</ArcadeButton>;
    }
    const short = pack.cost - lexCoins;
    return (
      <ArcadeButton color="green" size="sm" className="w-full" onClick={() => handleUnlock(pack)} disabled={short > 0}>
        {short > 0 ? `🔒 Need ${short} more` : `Unlock · 🪙 ${pack.cost}`}
      </ArcadeButton>
    );
  };

  return (
    <div className="flex flex-col h-full min-h-0 p-4 gap-3 animate-fade-in">
      <header className="shrink-0 text-center">
        <h1 className="font-display text-4xl neon-text-pink leading-none">VIBEZ</h1>
        <p className="osd-text text-lg text-neon-cyan leading-tight mt-1">NEW LOOKS FOR YOUR CABINET</p>
        <div className="mt-2 inline-flex items-center gap-2 bg-crt-950/80 ring-1 ring-neon-yellow/40 rounded-full px-4 py-1.5">
          <span className="text-xl" aria-hidden="true">🪙</span>
          <span className="osd-text text-2xl leading-none text-neon-yellow">{lexCoins} CREDITS</span>
        </div>
        <p className="osd-text text-base leading-tight text-slate-400 mt-1">EARN 1 CREDIT FOR EVERY 5,000 POINTS IN A RUN</p>
      </header>

      <ul className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-3 p-1 -m-1">
        {PACKS_LIST.map(pack => {
          const isSelected = selectedPackId === pack.id;
          const isUnlocked = unlockedPackIds.includes(pack.id);
          return (
            <li
              key={pack.id}
              className={`rounded-xl p-3 bg-crt-950/70 space-y-2 ${isSelected ? 'ring-2 ring-neon-pink shadow-glow-pink' : 'ring-1 ring-white/10'}`}
            >
              <PackPreview pack={pack} />
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="font-display text-lg text-white leading-tight">{pack.name}</h2>
                {!isUnlocked && <span className="osd-text text-lg leading-none text-neon-yellow shrink-0">🪙 {pack.cost}</span>}
              </div>
              <p className="text-sm text-slate-300 leading-snug">{pack.description}</p>
              {renderPackButton(pack)}
            </li>
          );
        })}
      </ul>

      <div className="shrink-0">
        <ArcadeButton color="yellow" size="lg" className="w-full" onClick={handleBackClick}>
          ◀ Back
        </ArcadeButton>
      </div>
    </div>
  );
};

export default VibezScreen;
