import React, { useMemo, useState } from 'react';
import { SECRET_BONUSES } from '../../data/secretBonuses';
import { EASTER_EGGS } from '../../data/easterEggs';
import { getBonusMedia, BonusMediaType } from '../../data/bonusMedia';
import { getCollection, hintFor } from '../collection';
import { exampleScore } from '../scoreBonus';
import { soundService } from '../soundService';
import type { EasterEgg, SecretBonus } from '../../types';
import ArcadeButton from '../../components/ArcadeButton';
import BonusReveal, { splitName } from '../../components/BonusReveal';

interface CollectionScreenProps {
  onBack: () => void;
}

type Filter = 'all' | 'found' | 'missing';

// Shelves, in the order they appear.
const SHELVES: { media: BonusMediaType; title: string; icon: string; tone: string; ring: string }[] = [
  { media: 'vhs', title: 'Movies & TV', icon: '📼', tone: 'text-neon-pink', ring: 'ring-neon-pink/60' },
  { media: 'cartridge', title: 'Video Games', icon: '🎮', tone: 'text-neon-cyan', ring: 'ring-neon-cyan/60' },
  { media: 'cd', title: 'Music', icon: '💿', tone: 'text-neon-purple', ring: 'ring-neon-purple/60' },
  { media: 'arcade', title: 'Wild Cards', icon: '🕹️', tone: 'text-neon-yellow', ring: 'ring-neon-yellow/60' },
];

const CollectionScreen: React.FC<CollectionScreenProps> = ({ onBack }) => {
  const collection = useMemo(() => getCollection(), []);
  const [filter, setFilter] = useState<Filter>('all');
  const [preview, setPreview] = useState<EasterEgg | null>(null);

  const found = Object.keys(collection).length;
  const total = SECRET_BONUSES.length;
  const percent = Math.round((found / total) * 100);

  const visible = (b: SecretBonus) =>
    filter === 'all' || (filter === 'found') === !!collection[b.id];

  const openPreview = (b: SecretBonus) => {
    soundService.playUIClick();
    setPreview(EASTER_EGGS.find(e => e.id === b.id) ?? null);
  };

  const handleBack = () => {
    soundService.playUIClick();
    onBack();
  };

  const filters: { id: Filter; label: string }[] = [
    { id: 'all', label: `ALL ${total}` },
    { id: 'found', label: `FOUND ${found}` },
    { id: 'missing', label: `MISSING ${total - found}` },
  ];

  return (
    <div className="relative flex flex-col h-full min-h-0 p-4 gap-3">
      <header className="shrink-0 text-center">
        <h1 className="font-display text-4xl neon-text-cyan leading-none">COLLECTION</h1>
        <p className="osd-text text-lg text-neon-pink leading-tight mt-1">
          {found === total ? '★ EVERY SECRET FOUND. TOTALLY RADICAL. ★' : 'SPELL SECRET WORDS TO FILL YOUR SHELVES'}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 h-3 rounded-full bg-crt-950 ring-1 ring-white/15 overflow-hidden" role="progressbar" aria-valuenow={found} aria-valuemin={0} aria-valuemax={total} aria-label="Secrets found">
            <div className="h-full bg-gradient-to-r from-neon-cyan via-neon-purple to-neon-pink transition-all" style={{ width: `${percent}%` }} />
          </div>
          <span className="osd-text text-xl leading-none text-neon-yellow tabular-nums">{found}/{total}</span>
        </div>
      </header>

      <div className="shrink-0 grid grid-cols-3 gap-1" role="tablist">
        {filters.map(f => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={`osd-text text-lg leading-none py-1.5 rounded-md ring-1 ${
              filter === f.id ? 'bg-neon-cyan text-crt-900 ring-neon-cyan' : 'bg-crt-900/80 text-slate-300 ring-white/10'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-4 pr-1">
        {SHELVES.map(shelf => {
          const all = SECRET_BONUSES.filter(b => getBonusMedia(b.id).media === shelf.media);
          const items = all.filter(visible);
          if (!items.length) return null;
          const shelfFound = all.filter(b => collection[b.id]).length;
          return (
            <section key={shelf.media}>
              <h2 className={`font-display text-base flex items-center gap-2 mb-1.5 ${shelf.tone}`}>
                <span aria-hidden="true">{shelf.icon}</span>
                <span>{shelf.title}</span>
                <span className="osd-text text-lg text-slate-400 ml-auto">{shelfFound}/{all.length}</span>
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {items.map(b => {
                  const entry = collection[b.id];
                  if (!entry) {
                    return (
                      <div key={b.id} className="rounded-xl bg-crt-950/80 ring-1 ring-white/10 p-2.5 flex flex-col gap-1.5 min-h-[7.5rem]">
                        <div className="flex-1 grid place-items-center rounded-lg bg-crt-900/80 border border-dashed border-white/15">
                          <span className="font-display text-3xl text-slate-600" aria-hidden="true">?</span>
                        </div>
                        <p className="text-xs text-slate-400 leading-snug">{hintFor(b)}</p>
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
                      <div className="flex justify-between osd-text text-base leading-none">
                        <span className={shelf.tone}>{b.word ? b.word.toUpperCase() : `${b.score!.digits}`}</span>
                        {entry.timesFound > 1 && <span className="text-slate-400">×{entry.timesFound}</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
        {filter === 'found' && found === 0 && (
          <p className="osd-text text-xl text-slate-400 text-center py-8">NOTHING ON THE SHELF YET. GO SPELL SOMETHING!</p>
        )}
      </div>

      <div className="shrink-0">
        <ArcadeButton color="yellow" size="lg" className="w-full" onClick={handleBack}>
          ◀ Back
        </ArcadeButton>
      </div>

      {preview && (
        <BonusReveal
          egg={{ ...preview, triggerScore: preview.scorePattern ? exampleScore(preview.scorePattern) : undefined }}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
};

export default CollectionScreen;
