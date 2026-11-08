import React, { useMemo, useState } from 'react';
import { SECRET_BONUSES } from '../../data/secretBonuses';
import { EASTER_EGGS } from '../../data/easterEggs';
import { getBonusMedia, BonusMediaType } from '../../data/bonusMedia';
import { getCollection, hintFor } from '../collection';
import { exampleScore } from '../scoreBonus';
import { powerWordInfo } from '../rules';
import { soundService } from '../soundService';
import type { EasterEgg, SecretBonus } from '../../types';
import ScreenShell from '../../components/ScreenShell';
import CollectSwitch from '../../components/CollectSwitch';
import type { TabId } from '../../components/BottomTabs';
import BonusReveal, { splitName } from '../../components/BonusReveal';

interface CollectionScreenProps {
  onBack: () => void;
  onTab: (tab: TabId) => void;
  onShowBadgeCase: () => void;
  lexCoins: number;
}

type Filter = 'found' | 'missing';

// Shelves, in the order they appear.
const SHELVES: { media: BonusMediaType; title: string; icon: string; tone: string; ring: string }[] = [
  { media: 'vhs', title: 'Movies & TV', icon: '📼', tone: 'text-neon-pink', ring: 'ring-neon-pink/60' },
  { media: 'cartridge', title: 'Video Games', icon: '🎮', tone: 'text-neon-cyan', ring: 'ring-neon-cyan/60' },
  { media: 'cd', title: 'Music', icon: '💿', tone: 'text-neon-purple', ring: 'ring-neon-purple/60' },
  { media: 'arcade', title: 'Wild Cards', icon: '🕹️', tone: 'text-neon-yellow', ring: 'ring-neon-yellow/60' },
];

const CollectionScreen: React.FC<CollectionScreenProps> = ({ onBack, onTab, onShowBadgeCase, lexCoins }) => {
  const collection = useMemo(() => getCollection(), []);
  // Missing first (what to hunt for), unless everything's found.
  const [filter, setFilter] = useState<Filter>(() => Object.keys(collection).length === SECRET_BONUSES.length ? 'found' : 'missing');
  const [preview, setPreview] = useState<EasterEgg | null>(null);

  const found = Object.keys(collection).length;
  const total = SECRET_BONUSES.length;
  const percent = Math.round((found / total) * 100);

  const visible = (b: SecretBonus) => (filter === 'found') === !!collection[b.id];

  const openPreview = (b: SecretBonus) => {
    soundService.playUIClick();
    setPreview(EASTER_EGGS.find(e => e.id === b.id) ?? null);
  };

  const filters: { id: Filter; label: string }[] = [
    { id: 'missing', label: `MISSING ${total - found}` },
    { id: 'found', label: `FOUND ${found}` },
  ];

  const subheader = (
    <div className="flex flex-col gap-2">
      <CollectSwitch current="secrets" onSwitch={onShowBadgeCase} />
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2.5 rounded-full bg-crt-950 ring-1 ring-white/15 overflow-hidden" role="progressbar" aria-valuenow={found} aria-valuemin={0} aria-valuemax={total} aria-label="Secrets found">
          <div className="h-full bg-gradient-to-r from-neon-cyan via-neon-purple to-neon-pink transition-all" style={{ width: `${percent}%` }} />
        </div>
        <span className="osd-text text-base leading-none text-slate-400">{found === total ? '★ ALL FOUND' : 'SPELL THEM IN A RUN'}</span>
      </div>
      <div className="grid grid-cols-2 gap-1" role="tablist" aria-label="Show">
        {filters.map(f => (
          <button key={f.id} type="button" role="tab" aria-selected={filter === f.id} onClick={() => { soundService.playUIClick(); setFilter(f.id); }}
            className={`osd-text text-base leading-none py-1.5 rounded-md ring-1 ${filter === f.id ? 'bg-neon-cyan text-crt-900 ring-neon-cyan' : 'bg-crt-900/80 text-slate-300 ring-white/10'}`}>
            {f.label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <ScreenShell title="COLLECTION" tone="pink" onBack={onBack} credits={lexCoins} subheader={subheader} tab="collect" onTab={onTab}>
      {/* Inner padding keeps the found-card rings from being clipped by the scroll area. */}
      <div className="space-y-4 p-1 -mx-1">
        {SHELVES.map(shelf => {
          const all = SECRET_BONUSES.filter(b => getBonusMedia(b.id).media === shelf.media);
          const items = all.filter(visible);
          if (!items.length) return null;
          const shelfFound = all.filter(b => collection[b.id]).length;
          return (
            // Shelves fold (v7.31): the Missing view opens with every shelf closed so it fits one screen;
            // Found opens them all. key={filter} resets that when the filter changes.
            <details key={`${shelf.media}-${filter}`} open={filter === 'found'} className="group rounded-xl ring-1 ring-white/10 bg-crt-950/40">
              <summary className={`list-none cursor-pointer select-none font-display text-base flex items-center gap-2 px-3 py-3 ${shelf.tone}`} onClick={() => soundService.playUIClick()}>
                <span aria-hidden="true">{shelf.icon}</span>
                <span>{shelf.title}</span>
                <span className="osd-text text-lg text-slate-400 ml-auto">{filter === 'missing' ? `${items.length} TO FIND` : `${shelfFound}/${all.length}`}</span>
                <span className="text-slate-500 text-sm transition-transform group-open:rotate-180" aria-hidden="true">▾</span>
              </summary>
              <div className="px-2 pb-2">
              <div className={filter === 'missing' ? 'flex flex-col gap-1.5' : 'grid grid-cols-2 gap-2'}>
                {items.map(b => {
                  const entry = collection[b.id];
                  if (!entry) {
                    // Missing: one compact row with the clue (they used to be big empty cards).
                    return (
                      <div key={b.id} className="flex items-start gap-2.5 rounded-lg bg-crt-950/70 ring-1 ring-white/10 px-3 py-2 text-left">
                        <span className="font-display text-lg leading-none text-slate-600 mt-0.5" aria-hidden="true">?</span>
                        <div className="min-w-0">
                          {b.effect && <p className="osd-text text-sm leading-none text-neon-purple mb-0.5">⚡ POWER WORD · REPLAYABLE</p>}
                          <p className="text-sm text-slate-300 leading-snug">{hintFor(b)}</p>
                        </div>
                      </div>
                    );
                  }
                  const { icon, title } = splitName(b.name);
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => openPreview(b)}
                      className={`text-left rounded-xl bg-crt-900/90 ring-2 ${shelf.ring} p-2.5 flex flex-col gap-1.5 min-h-[7.5rem] hover:brightness-110 focus-visible:ring-white outline-none`}
                      aria-label={`${title}. Found ${entry.timesFound} ${entry.timesFound === 1 ? 'time' : 'times'}. Tap to replay.`}
                    >
                      <div className="flex-1 grid place-items-center rounded-lg bg-gradient-to-br from-crt-700 to-crt-950">
                        <span className="text-4xl" aria-hidden="true">{icon}</span>
                      </div>
                      <div className="font-display text-sm text-white leading-tight line-clamp-2">{title}</div>
                      {b.effect && <div className="osd-text text-sm leading-none text-neon-purple">⚡ {powerWordInfo(b.effect).label} · REPLAYABLE</div>}
                      <div className="flex justify-between osd-text text-base leading-none">
                        <span className={shelf.tone}>{b.word ? b.word.toUpperCase() : `${b.score!.digits}`}</span>
                        {entry.timesFound > 1 && <span className="text-slate-400">×{entry.timesFound}</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
              </div>
            </details>
          );
        })}
        {filter === 'found' && found === 0 && (
          <p className="osd-text text-xl text-slate-400 text-center py-8">NOTHING ON THE SHELF YET. GO SPELL SOMETHING!</p>
        )}
      </div>

      {preview && (
        <BonusReveal
          egg={{ ...preview, triggerScore: preview.scorePattern ? exampleScore(preview.scorePattern) : undefined }}
          onClose={() => setPreview(null)}
        />
      )}
    </ScreenShell>
  );
};

export default CollectionScreen;
