import React, { useState } from 'react';
import { EASTER_EGGS } from '../../data/easterEggs';
import { getBonusMedia } from '../../data/bonusMedia';
import BonusReveal from '../BonusReveal';

/**
 * Dev-only preview of every bonus reveal. Open http://localhost:3000/?gallery while `npm run dev` runs.
 */
const BonusGallery: React.FC = () => {
  const initial = new URLSearchParams(location.search).get('egg');
  const [index, setIndex] = useState(() => Math.max(0, EASTER_EGGS.findIndex(e => e.id === initial)));
  const egg = EASTER_EGGS[index];
  const step = (d: number) => setIndex(i => (i + d + EASTER_EGGS.length) % EASTER_EGGS.length);

  return (
    <div className="relative flex-1 min-h-0">
      <BonusReveal egg={egg} onClose={() => step(1)} />
      <div className="absolute top-2 inset-x-2 z-[70] flex justify-between items-center osd-text text-lg text-white">
        <button onClick={() => step(-1)} className="px-2 bg-crt-950/80 rounded">◀ PREV</button>
        <span>{index + 1}/{EASTER_EGGS.length} · {egg.id} · {getBonusMedia(egg.id).media}</span>
        <button onClick={() => step(1)} className="px-2 bg-crt-950/80 rounded">NEXT ▶</button>
      </div>
    </div>
  );
};

export default BonusGallery;
