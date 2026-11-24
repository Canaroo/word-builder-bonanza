import React, { useState } from 'react';
import ArcadeButton from './ArcadeButton';
import { soundService } from '../services/soundService';
import { musicService } from '../services/musicService';
import { MUSIC_TRACKS, trackById } from '../data/music';
import { ownedTracks, selectedTrack, selectTrack } from '../services/music';

/**
 * The 🔊 button's panel (v7.53.0): sound on or off, and which of your music tracks plays. It
 * replaced the one-tap mute, so switching tracks is one tap away on the start screen and in a run.
 * In a run the clock keeps running while it's open (it's a quick pick, not a pause).
 */
const SoundMenu: React.FC<{ isMuted: boolean; onToggleMute: () => void; onClose: () => void; onShop?: () => void; inRun?: boolean }> = ({ isMuted, onToggleMute, onClose, onShop, inRun }) => {
  const owned = ownedTracks();
  const [current, setCurrent] = useState(selectedTrack());
  const [events, setEvents] = useState(musicService.eventMusic());
  const more = MUSIC_TRACKS.length - owned.length;
  const pick = (id: string) => {
    if (!selectTrack(id)) return;
    soundService.playUIClick();
    musicService.setTrack(id);
    setCurrent(id);
  };
  return (
    <div className="absolute inset-0 z-[60] bg-crt-950/70 backdrop-blur-[2px] flex items-start justify-center p-3 pt-16 animate-fade-in" onClick={onClose} role="presentation">
      <div className="w-full max-w-sm rounded-2xl bg-crt-900 border-2 border-neon-cyan shadow-[0_0_24px_rgba(61,245,255,0.35)] p-4 flex flex-col gap-3" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Sound and music">
        <div className="flex items-center justify-between">
          <p className="font-display text-lg text-white">🎧 SOUND</p>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white text-xl px-1" aria-label="Close">✕</button>
        </div>
        <button type="button" onClick={onToggleMute} aria-pressed={!isMuted}
          className={`w-full flex items-center justify-between rounded-xl px-3 py-2.5 ring-2 ${isMuted ? 'ring-white/15 bg-crt-950/70' : 'ring-neon-green bg-neon-green/10'}`}>
          <span className="flex items-center gap-2 text-white font-semibold"><span className="text-2xl" aria-hidden="true">{isMuted ? '🔇' : '🔊'}</span>Music &amp; sound effects</span>
          <span className={`osd-text text-lg leading-none ${isMuted ? 'text-slate-400' : 'text-neon-green'}`}>{isMuted ? 'OFF' : 'ON'}</span>
        </button>
        <div>
          <p className="osd-text text-base text-neon-cyan tracking-widest mb-1.5">MUSIC</p>
          <ul className="flex flex-col gap-1.5" role="radiogroup" aria-label="Music track">
            {owned.map(id => {
              const t = trackById(id)!;
              const on = id === current;
              return (
                <li key={id}>
                  <button type="button" role="radio" aria-checked={on} onClick={() => pick(id)}
                    className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left ${on ? 'bg-neon-pink/15 ring-2 ring-neon-pink' : 'bg-crt-950/70 ring-1 ring-white/10 hover:bg-white/5'}`}>
                    <span className="text-xl" aria-hidden="true">{t.icon}</span>
                    <span className="flex-1 text-white text-sm font-semibold">{t.name}</span>
                    {on && <span className="osd-text text-sm text-neon-pink leading-none">{isMuted ? 'SELECTED' : '♪ PLAYING'}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
          {isMuted && <p className="text-xs text-slate-400 mt-1.5">Sound is off. Turn it on to hear your pick.</p>}
        </div>
        {/* v7.77.0: Golden Round and boss fights play their own music unless this is off. */}
        <button type="button" data-testid="event-music-toggle" aria-pressed={events}
          onClick={() => { soundService.playUIClick(); const on = !events; musicService.setEventMusic(on); setEvents(on); }}
          className={`w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 ring-2 text-left ${events ? 'ring-neon-yellow bg-neon-yellow/10' : 'ring-white/15 bg-crt-950/70'}`}>
          <span className="flex flex-col">
            <span className="text-white font-semibold text-sm">🌟👾 Special music</span>
            <span className="text-xs text-slate-300 leading-snug">Golden Rounds and boss fights get their own tracks. Off: your pick keeps playing.</span>
          </span>
          <span className={`osd-text text-lg leading-none ${events ? 'text-neon-yellow' : 'text-slate-400'}`}>{events ? 'ON' : 'OFF'}</span>
        </button>
        {more > 0 && (onShop
          ? <ArcadeButton color="yellow" variant="outline" size="sm" className="w-full" onClick={onShop}>🛒 {more} more {more === 1 ? 'track' : 'tracks'} in the Shop</ArcadeButton>
          : <p className="text-xs text-slate-400 text-center">🛒 {more} more {more === 1 ? 'track' : 'tracks'} in the Shop, under 🎵 Music.</p>)}
        {inRun && <p className="text-xs text-slate-500 text-center">The clock keeps running while this is open.</p>}
      </div>
    </div>
  );
};

export default SoundMenu;
