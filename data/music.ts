import { MUSIC_PRICE } from '../config/progression';

/**
 * Background music (v7.53.0). Mindscape is the free default; the rest are sold in the shop's Music
 * tab. The four shop tracks are original compositions rendered by tools/music (songs.js holds the
 * scores). `loopSeconds` is the exact musical length, so the loop skips the MP3's padding.
 */
export interface MusicTrack {
  id: string;
  name: string;
  icon: string;
  /** One line for the shop card. */
  vibe: string;
  file: string;
  loopSeconds?: number;
  cost: number;
}

export const DEFAULT_TRACK_ID = 'mindscape';

export const MUSIC_TRACKS: MusicTrack[] = [
  { id: 'mindscape', name: 'Mindscape', icon: '🌌', vibe: 'The original. Spacey and calm.', file: 'mindscape.mp3', cost: 0 },
  { id: 'pixelHometown', name: 'Pixel Hometown', icon: '🏡', vibe: 'A cozy RPG-town waltz on piano and music box.', file: 'shop/pixel-hometown.mp3', loopSeconds: 80, cost: MUSIC_PRICE },
  { id: 'midnightRental', name: 'Midnight Rental', icon: '📼', vibe: 'Slow 80s synthwave for late-night word hunting.', file: 'shop/midnight-rental.mp3', loopSeconds: (32 * 4 * 60) / 84, cost: MUSIC_PRICE },
  { id: 'coinOpLounge', name: 'Coin-Op Lounge', icon: '🪙', vibe: 'Chiptune bossa nova. Easy, breezy, jazzy.', file: 'shop/coin-op-lounge.mp3', loopSeconds: (32 * 4 * 60) / 112, cost: MUSIC_PRICE },
  { id: 'dialUpDreams', name: 'Dial-Up Dreams', icon: '☎️', vibe: 'Late-90s chill beats with Rhodes and vibes.', file: 'shop/dial-up-dreams.mp3', loopSeconds: (32 * 4 * 60) / 88, cost: MUSIC_PRICE },
];

/**
 * Event music (v7.77.0, the owner's ask): plays during a Golden Round and a boss fight, then the
 * player's own track comes back. Not sold or listed; the Sound panel can turn it off. Rendered by
 * tools/music (goldenFountain, bossFight); kept out of the PWA precache like the shop tracks.
 */
export const EVENT_TRACKS: MusicTrack[] = [
  { id: 'eventGolden', name: 'Golden Round', icon: '🌟', vibe: 'Ethereal harp for the Golden Round.', file: 'events/golden-round.mp3', loopSeconds: (16 * 4 * 60) / 72, cost: 0 },
  { id: 'eventBoss', name: 'Boss Fight', icon: '👾', vibe: 'Driving battle music for boss fights.', file: 'events/boss-fight.mp3', loopSeconds: (16 * 4 * 60) / 152, cost: 0 },
];

export const trackById = (id: string | null | undefined): MusicTrack | undefined => MUSIC_TRACKS.find(t => t.id === id) ?? EVENT_TRACKS.find(t => t.id === id);
