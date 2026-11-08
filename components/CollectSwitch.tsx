import React from 'react';
import { SECRET_BONUSES } from '../data/secretBonuses';
import { BOSSES } from '../data/bosses';
import { getCollection } from '../services/collection';
import { getProfile } from '../services/progression';
import { soundService } from '../services/soundService';

// The Collect tab's two shelves (v7.31): secret bonuses and Boss Badges, one tap apart.
const CollectSwitch: React.FC<{ current: 'secrets' | 'bosses'; onSwitch: () => void }> = ({ current, onSwitch }) => {
  const secrets = Object.keys(getCollection()).length;
  const bosses = getProfile().bossBadges.length;
  const items = [
    { id: 'secrets' as const, label: `📼 SECRETS ${secrets}/${SECRET_BONUSES.length}` },
    { id: 'bosses' as const, label: `🏅 BOSSES ${bosses}/${BOSSES.length}` },
  ];
  return (
    <div className="grid grid-cols-2 gap-1 bg-crt-950/70 rounded-xl p-1" role="tablist" aria-label="Collection">
      {items.map(item => (
        <button key={item.id} type="button" role="tab" aria-selected={current === item.id}
          onClick={() => { if (current !== item.id) { soundService.playUIClick(); onSwitch(); } }}
          className={`osd-text text-lg leading-none py-2 rounded-lg transition-colors ${current === item.id ? 'bg-neon-pink text-white shadow-glow-pink' : 'text-slate-300 hover:bg-white/5'}`}>
          {item.label}
        </button>
      ))}
    </div>
  );
};

export default CollectSwitch;
