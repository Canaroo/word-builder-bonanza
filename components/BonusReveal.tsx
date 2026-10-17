import React from 'react';
import { EasterEgg } from '../types';
import { getBonusMedia, BonusMedia } from '../data/bonusMedia';
import ArcadeButton from './ArcadeButton';

interface BonusRevealProps {
  egg: EasterEgg;
  onClose: () => void;
}

// Bonus names carry decorative emoji and curly quotes, e.g. 🗡️ “Hero of Hyrule” 🛡️.
const splitName = (name: string) => {
  const icon = name.match(/^\p{Extended_Pictographic}️?/u)?.[0] ?? '⭐';
  const title = name
    .replace(/\p{Extended_Pictographic}️?/gu, '')
    .replace(/[“”"]/g, '')
    .trim();
  return { icon, title };
};

const VhsCover: React.FC<{ icon: string; title: string; source?: string }> = ({ icon, title, source }) => (
  <div className="relative mx-auto w-48 h-64 rounded-md bg-crt-950 p-2 shadow-[0_12px_30px_rgba(0,0,0,0.6)] border border-black">
    {/* Printed sleeve */}
    <div className="relative h-full rounded-sm overflow-hidden bg-gradient-to-br from-neon-pink via-neon-purple to-crt-800 flex flex-col">
      <div className="flex justify-between items-center px-2 pt-1.5 osd-text text-white text-lg leading-none">
        <span>▶ PLAY</span>
        <span className="text-neon-yellow">VHS</span>
      </div>
      <div className="flex-1 flex items-center justify-center text-7xl drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]">{icon}</div>
      <div className="bg-crt-950/80 px-2 py-2 text-center">
        <div className="font-display text-neon-yellow text-sm leading-tight break-words">{title}</div>
        {source && <div className="osd-text text-neon-cyan text-base leading-none mt-1">{source}</div>}
      </div>
      <div className="absolute top-9 -right-7 rotate-45 bg-neon-yellow text-crt-900 text-[9px] font-bold px-8 py-0.5 tracking-widest">BE KIND REWIND</div>
      <div className="vhs-tracking" />
    </div>
  </div>
);

const Cartridge: React.FC<{ icon: string; title: string; source?: string }> = ({ icon, title, source }) => (
  <div className="relative mx-auto w-52 h-56 rounded-t-xl rounded-b-md bg-gradient-to-b from-slate-400 to-slate-500 p-3 pt-6 shadow-[0_12px_30px_rgba(0,0,0,0.6)] border-b-8 border-slate-600">
    {/* Grip ridges */}
    <div className="absolute top-1.5 left-1/2 -translate-x-1/2 flex gap-1">
      {Array.from({ length: 9 }).map((_, i) => <span key={i} className="w-1.5 h-3 rounded-sm bg-slate-600/70" />)}
    </div>
    {/* Label */}
    <div className="relative h-full rounded-md overflow-hidden border-4 border-slate-700 bg-gradient-to-br from-neon-cyan via-[#3a7bff] to-neon-purple flex flex-col">
      <div className="flex-1 flex items-center justify-center text-6xl">{icon}</div>
      <div className="bg-crt-950/85 px-2 py-1.5 text-center">
        <div className="font-display text-white text-sm leading-tight break-words">{title}</div>
        {source && <div className="osd-text text-neon-yellow text-base leading-none mt-0.5">{source}</div>}
      </div>
    </div>
  </div>
);

const Disc: React.FC<{ icon: string; title: string; source?: string }> = ({ icon, title, source }) => (
  <div className="mx-auto w-56 flex flex-col items-center gap-3">
    <div
      className="cd-spin relative w-44 h-44 rounded-full shadow-[0_12px_30px_rgba(0,0,0,0.6)] flex items-center justify-center"
      style={{ background: 'conic-gradient(from 0deg, #d9d9e8, #ff3ea5, #ffd23f, #3dff8c, #22e4ff, #b45cff, #d9d9e8)' }}
    >
      <div className="absolute inset-3 rounded-full bg-[radial-gradient(circle,transparent_55%,rgba(255,255,255,0.35)_56%,transparent_70%)]" />
      <div className="w-16 h-16 rounded-full bg-crt-900 border-4 border-slate-300/70 flex items-center justify-center text-3xl">{icon}</div>
    </div>
    <div className="text-center">
      <div className="font-display text-neon-yellow text-base leading-tight">{title}</div>
      {source && <div className="osd-text text-neon-cyan text-lg leading-none mt-1">♪ {source}</div>}
    </div>
  </div>
);

const Marquee: React.FC<{ icon: string; title: string }> = ({ icon, title }) => (
  <div className="mx-auto w-full max-w-xs rounded-xl border-4 border-neon-pink shadow-glow-pink bg-crt-950 px-4 py-5 text-center">
    <div className="osd-text text-neon-yellow text-xl blink">★ BONUS ★</div>
    <div className="text-6xl my-2">{icon}</div>
    <div className="font-display neon-text-cyan text-lg leading-tight">{title}</div>
  </div>
);

const MEDIA_LABEL: Record<BonusMedia['media'], string> = {
  vhs: 'NOW PLAYING',
  cartridge: 'POWER ON',
  cd: 'TRACK 01',
  arcade: 'SECRET FOUND',
};

/** Full-screen reveal for a pop-culture word bonus. */
const BonusReveal: React.FC<BonusRevealProps> = ({ egg, onClose }) => {
  const { media, source } = getBonusMedia(egg.id);
  const { icon, title } = splitName(egg.name);
  const props = { icon, title, source };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-crt-950/85 backdrop-blur-sm animate-fade-in" role="dialog" aria-modal="true" aria-label={`Bonus: ${title}`}>
      <div className="bonus-insert w-full max-w-sm flex flex-col items-center gap-4 text-center">
        <div className="osd-text text-neon-green text-2xl">{MEDIA_LABEL[media]}</div>
        {media === 'vhs' && <VhsCover {...props} />}
        {media === 'cartridge' && <Cartridge {...props} />}
        {media === 'cd' && <Disc {...props} />}
        {media === 'arcade' && <Marquee icon={icon} title={title} />}
        <p className="text-slate-200 text-base leading-snug px-2">{egg.reward.message}</p>
        {egg.reward.points ? (
          <div className="font-display text-4xl text-neon-yellow drop-shadow-glow-yellow">+{egg.reward.points}</div>
        ) : null}
        {egg.reward.shuffle ? (
          <div className="font-display text-xl text-neon-cyan">+{egg.reward.shuffle} SHUFFLE</div>
        ) : null}
        <ArcadeButton color="pink" size="md" className="w-full" onClick={onClose} autoFocus>
          ▶ Continue
        </ArcadeButton>
      </div>
    </div>
  );
};

export default BonusReveal;
