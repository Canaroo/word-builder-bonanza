import React from 'react';

// The bottom tab bar (v7.31): the same five destinations on every menu screen, in the thumb zone.
export type TabId = 'play' | 'top50' | 'collect' | 'shop' | 'me';

const TABS: { id: TabId; icon: string; label: string }[] = [
  { id: 'play', icon: '🏠', label: 'PLAY' },
  { id: 'top50', icon: '🏆', label: 'TOP 50' },
  { id: 'collect', icon: '📼', label: 'COLLECT' },
  { id: 'shop', icon: '🛒', label: 'SHOP' },
  { id: 'me', icon: '🪪', label: 'ME' },
];

const BottomTabs: React.FC<{ current: TabId | null; onTab: (tab: TabId) => void }> = ({ current, onTab }) => (
  <nav className="sticky bottom-0 z-20 shrink-0 grid grid-cols-5 border-t border-white/10 bg-crt-950/95 backdrop-blur-sm" aria-label="Menu">
    {TABS.map(tab => (
      <button key={tab.id} type="button" onClick={() => onTab(tab.id)} aria-current={current === tab.id ? 'page' : undefined}
        className={`flex flex-col items-center justify-center gap-0.5 py-2 min-h-[3.5rem] ${current === tab.id ? 'text-neon-yellow' : 'text-slate-400 hover:text-white'}`}>
        <span className="text-xl leading-none" aria-hidden="true">{tab.icon}</span>
        <span className="osd-text text-sm leading-none">{tab.label}</span>
      </button>
    ))}
  </nav>
);

export default BottomTabs;
