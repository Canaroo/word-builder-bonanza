import React from 'react';
import { cosmeticById, type Cosmetic } from '../data/cosmetics';

/** A badge icon in its frame. Rarer badges shine, go gold, or cycle colors. */
export const BadgeIcon: React.FC<{ id?: string | null; cosmetic?: Cosmetic; size?: 'sm' | 'md' | 'lg' }> = ({ id, cosmetic, size = 'md' }) => {
  const badge = cosmetic ?? cosmeticById(id);
  if (!badge || badge.kind !== 'badge') return null;
  const box = size === 'lg' ? 'w-14 h-14 text-3xl' : size === 'sm' ? 'w-7 h-7 text-base' : 'w-10 h-10 text-2xl';
  return (
    <span
      className={`bling-badge bling-${badge.style ?? 'plain'} ${box} shrink-0 inline-grid place-items-center rounded-lg`}
      title={badge.name}
      aria-label={`${badge.name} badge`}
    >
      <span aria-hidden="true">{badge.icon}</span>
    </span>
  );
};

/** A title line, styled by rarity. */
export const TitleText: React.FC<{ id?: string | null; cosmetic?: Cosmetic; className?: string }> = ({ id, cosmetic, className = '' }) => {
  const title = cosmetic ?? cosmeticById(id);
  if (!title || title.kind !== 'title') return null;
  return <span className={`bling-title bling-title-${title.style ?? 'plain'} osd-text uppercase tracking-wider ${className}`}>{title.name}</span>;
};

/** 🔥 and the streak count; dim at zero. */
export const StreakFlame: React.FC<{ count: number; className?: string }> = ({ count, className = '' }) =>
  count > 0 ? (
    <span className={`osd-text leading-none text-neon-orange whitespace-nowrap ${className}`} aria-label={`${count}-day streak`}>🔥{count}</span>
  ) : null;

/** Name with badge, title and streak: the player's card. */
const PlayerPlate: React.FC<{
  name: string;
  badge?: string | null;
  title?: string | null;
  streak?: number;
  size?: 'md' | 'lg';
}> = ({ name, badge, title, streak = 0, size = 'md' }) => (
  <div className="flex items-center gap-2 min-w-0">
    <BadgeIcon id={badge} size={size === 'lg' ? 'lg' : 'md'} />
    <div className="min-w-0 text-left">
      <div className="flex items-center gap-2 min-w-0">
        <span className={`font-osd uppercase tracking-wider truncate text-neon-cyan leading-none ${size === 'lg' ? 'text-3xl' : 'text-2xl'}`}>{name || 'Player'}</span>
        <StreakFlame count={streak} className={size === 'lg' ? 'text-2xl' : 'text-xl'} />
      </div>
      <TitleText id={title} className={size === 'lg' ? 'text-lg leading-tight' : 'text-base leading-tight'} />
    </div>
  </div>
);

export default PlayerPlate;
