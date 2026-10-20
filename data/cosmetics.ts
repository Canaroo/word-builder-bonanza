// Player bling: badges (an icon next to your name) and titles (a line under it), like
// Rocket League. Shop items cost credits; streak items are earned only by keeping a streak.
// Equip one badge and one title; they show on the start screen, the share card and the Top 50.

export type CosmeticKind = 'badge' | 'title';
/** Extra styling for rarer items. */
export type CosmeticStyle = 'plain' | 'shine' | 'gold' | 'legend';

export interface Cosmetic {
  id: string;
  kind: CosmeticKind;
  name: string;
  /** Badges: the emoji shown next to the name. */
  icon?: string;
  flavor: string;
  style?: CosmeticStyle;
  /** Shop price in credits. Absent for streak rewards. */
  cost?: number;
  /** Earned at this streak length instead of bought. */
  streakDay?: number;
}

export const COSMETICS: Cosmetic[] = [
  // --- Shop badges ---
  { id: 'b_joystick', kind: 'badge', icon: '🕹️', name: 'Joystick', cost: 20, flavor: 'Every legend starts by grabbing the stick.' },
  { id: 'b_floppy', kind: 'badge', icon: '💾', name: 'Floppy Disk', cost: 30, flavor: '1.44 MB of pure attitude.' },
  { id: 'b_vhs', kind: 'badge', icon: '📼', name: 'VHS Tape', cost: 40, flavor: 'Be kind, rewind.' },
  { id: 'b_pager', kind: 'badge', icon: '📟', name: 'Pager', cost: 50, flavor: 'Beep me if you can spell it.' },
  { id: 'b_invader', kind: 'badge', icon: '👾', name: 'Space Invader', cost: 60, flavor: 'They came for your high score.' },
  { id: 'b_boombox', kind: 'badge', icon: '📻', name: 'Boombox', cost: 80, flavor: 'Held over your head, outside her window.' },
  { id: 'b_mothership', kind: 'badge', icon: '🛸', name: 'Mothership', cost: 100, style: 'shine', flavor: 'The truth is out there. So is your name.' },
  { id: 'b_diamond', kind: 'badge', icon: '💎', name: 'Diamond Cartridge', cost: 200, style: 'shine', flavor: 'Blow on it for luck. It never needs it.' },

  // --- Shop titles ---
  { id: 't_rookie', kind: 'title', name: 'Rookie Speller', cost: 15, flavor: 'Insert coin to continue.' },
  { id: 't_slinger', kind: 'title', name: 'Tile Slinger', cost: 25, flavor: 'Fastest rack in the arcade.' },
  { id: 't_vowel', kind: 'title', name: 'Vowel Movement', cost: 40, flavor: 'Regular as clockwork.' },
  { id: 't_radical', kind: 'title', name: 'Totally Radical', cost: 50, flavor: 'Gnarly spelling, dude.' },
  { id: 't_bodacious', kind: 'title', name: 'Bodacious Wordsmith', cost: 75, flavor: 'Party on, wordsmith.' },
  { id: 't_beeslayer', kind: 'title', name: 'Spelling Bee Slayer', cost: 90, flavor: 'The bee never stood a chance.' },
  { id: 't_dictionary', kind: 'title', name: 'The Walking Dictionary', cost: 150, style: 'shine', flavor: 'Look it up. Actually, just ask them.' },

  // --- Streak rewards (earned, never sold) ---
  { id: 's_regular', kind: 'title', name: 'Regular', streakDay: 3, flavor: 'The arcade knows your name.' },
  { id: 's_arcadeRat', kind: 'title', name: 'Arcade Rat', streakDay: 7, flavor: 'Lives on quarters and nachos.' },
  { id: 's_hotStreak', kind: 'badge', icon: '🔥', name: 'Hot Streak', streakDay: 7, flavor: 'A full week without missing a day.' },
  { id: 's_tokenHoarder', kind: 'title', name: 'Token Hoarder', streakDay: 14, flavor: 'Two weeks of tokens in the pocket.' },
  { id: 's_cartridgeBlower', kind: 'title', name: 'Cartridge Blower', streakDay: 21, flavor: 'Three weeks, zero glitches.' },
  { id: 's_goldenDisc', kind: 'badge', icon: '📀', name: 'Golden Disc', streakDay: 21, style: 'gold', flavor: 'Went gold in 21 days.' },
  { id: 's_highScoreHero', kind: 'title', name: 'High Score Hero', streakDay: 30, style: 'gold', flavor: 'A month at the top of the board.' },
  { id: 's_finalBoss', kind: 'title', name: 'Final Boss', streakDay: 50, style: 'gold', flavor: 'Fifty days. Nobody gets past you.' },
  { id: 's_goldFlame', kind: 'badge', icon: '🔥', name: 'Golden Flame', streakDay: 50, style: 'gold', flavor: 'This flame burns gold.' },
  { id: 's_killScreen', kind: 'title', name: 'Kill Screen', streakDay: 60, style: 'gold', flavor: 'You played until the game broke.' },
  { id: 's_crown', kind: 'badge', icon: '👑', name: 'Arcade Crown', streakDay: 60, style: 'gold', flavor: 'Sixty days on the throne.' },
  { id: 's_legend', kind: 'title', name: 'Legend of the Arcade', streakDay: 100, style: 'legend', flavor: 'They tell stories about you.' },
  { id: 's_legendBadge', kind: 'badge', icon: '🏆', name: 'Legend', streakDay: 100, style: 'legend', flavor: '100 days. Hall of fame.' },
];

export const cosmeticById = (id: string | null | undefined): Cosmetic | undefined =>
  id ? COSMETICS.find(c => c.id === id) : undefined;

export const SHOP_BADGES = COSMETICS.filter(c => c.kind === 'badge' && c.cost !== undefined);
export const SHOP_TITLES = COSMETICS.filter(c => c.kind === 'title' && c.cost !== undefined);

/** Streak milestones: credits, the title (and any badge/theme) earned on reaching each length. */
export interface StreakMilestone {
  day: number;
  credits: number;
  title: string;          // cosmetic id
  badge?: string;         // cosmetic id
  themeId?: string;       // pack id
}

export const STREAK_MILESTONES: StreakMilestone[] = [
  { day: 3, credits: 10, title: 's_regular' },
  { day: 7, credits: 25, title: 's_arcadeRat', badge: 's_hotStreak' },
  { day: 14, credits: 40, title: 's_tokenHoarder' },
  { day: 21, credits: 60, title: 's_cartridgeBlower', badge: 's_goldenDisc' },
  { day: 30, credits: 80, title: 's_highScoreHero', themeId: 'midnight-arcade' },
  { day: 50, credits: 120, title: 's_finalBoss', badge: 's_goldFlame' },
  { day: 60, credits: 150, title: 's_killScreen', badge: 's_crown' },
  { day: 100, credits: 250, title: 's_legend', badge: 's_legendBadge' },
];
