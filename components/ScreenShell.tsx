import React from 'react';
import BottomTabs, { type TabId } from './BottomTabs';
import { soundService } from '../services/soundService';

// Every menu screen's frame (v7.31): a compact header (◀ back, neon title, credits), the screen's
// own content scrolling in the middle, and the bottom tab bar on tab screens.
// Full class strings (not built from parts) so Tailwind keeps them.
const TONE = {
  cyan: 'neon-text-cyan',
  pink: 'neon-text-pink',
} as const;

interface ScreenShellProps {
  title: string;
  tone?: keyof typeof TONE;
  onBack: () => void;
  /** Shown as a chip on the right (opens nothing; the Shop tab is in the tab bar). */
  credits?: number;
  /** Something under the header that shouldn't scroll away (tabs, filters, a switch). */
  subheader?: React.ReactNode;
  /** The lit tab, for screens that belong to one; null hides the tab bar. */
  tab?: TabId | null;
  onTab?: (tab: TabId) => void;
  children: React.ReactNode;
}

const ScreenShell: React.FC<ScreenShellProps> = ({ title, tone = 'cyan', onBack, credits, subheader, tab = null, onTab, children }) => (
  <div className="flex flex-col h-full min-h-0 animate-fade-in">
    <header className="shrink-0 grid grid-cols-[3rem_1fr_auto] items-center gap-2 px-3 pt-3 pb-2">
      <button type="button" onClick={() => { soundService.playUIClick(); onBack(); }} aria-label="Back"
        className="w-11 h-11 rounded-full flex items-center justify-center text-xl text-slate-200 ring-1 ring-white/15 bg-crt-950/60 hover:ring-white/40">◀</button>
      <h1 className={`font-display text-2xl min-[375px]:text-3xl leading-none text-center truncate ${TONE[tone]}`}>{title}</h1>
      {credits !== undefined
        ? <span className="flex items-center gap-1 bg-crt-950/70 ring-1 ring-neon-yellow/50 pl-2 pr-2.5 py-1.5 rounded-full" aria-label={`${credits} credits`}>
            <span className="text-lg leading-none" aria-hidden="true">🪙</span>
            <span className="osd-text text-xl leading-none text-neon-yellow">{credits}</span>
          </span>
        : <span className="w-11" aria-hidden="true" />}
    </header>
    {subheader && <div className="shrink-0 px-3 pb-2">{subheader}</div>}
    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 pb-4">{children}</div>
    {tab && onTab && <BottomTabs current={tab} onTab={(t) => { soundService.playUIClick(); onTab(t); }} />}
  </div>
);

export default ScreenShell;
