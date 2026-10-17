// How each easter-egg bonus is presented when it fires.
//   vhs:       movies and TV — a rental tape cover
//   cartridge: video games — a game cartridge
//   cd:        music — a spinning disc
//   arcade:    everything else (score numbers, memes) — a neon marquee
// `source` is printed on the label. Bonuses without media use the arcade marquee.
import { SECRET_BONUSES } from './secretBonuses';

export type BonusMediaType = 'vhs' | 'cartridge' | 'cd' | 'arcade';

export interface BonusMedia {
  media: BonusMediaType;
  source?: string;
}

// Set per bonus in data/secretBonuses.ts (media/source fields).
export const BONUS_MEDIA: Record<string, BonusMedia> = Object.fromEntries(
  SECRET_BONUSES.filter(b => b.media && b.media !== 'arcade').map(b => [b.id, { media: b.media!, source: b.source }])
);

export const getBonusMedia = (eggId: string): BonusMedia => BONUS_MEDIA[eggId] ?? { media: 'arcade' };
