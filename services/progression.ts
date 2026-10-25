// Between-runs progress kept on this device: the daily streak, streak freezes, and the badges
// and titles the player owns and wears. Credits themselves stay in App (STORAGE_KEYS.lexCoins);
// functions here say what to charge or pay, and the caller moves the coins.
import { storage, STORAGE_KEYS } from './storage';
import { DAILY_RESET_HOUR, STREAK_FREEZE, POWER_WORD_BONUS } from '../config/progression';
import { COSMETICS, STREAK_MILESTONES, cosmeticById, type CosmeticKind, type StreakMilestone } from '../data/cosmetics';
import { bossById } from '../data/bosses';

export interface StreakState {
  count: number;
  best: number;
  /** Day key (see dayKey) of the last day a run was finished. */
  lastDay: string | null;
  freezes: number;
  /** Milestone days already rewarded (rewards are paid once, ever). */
  milestonesClaimed: number[];
}

export interface Profile {
  owned: string[];
  badge: string | null;
  title: string | null;
  streak: StreakState;
  /** Boss Badges: ids of the bosses beaten (6 hits) at least once, in the order earned. */
  bossBadges: string[];
}

const EMPTY_PROFILE: Profile = {
  owned: [],
  badge: null,
  title: null,
  streak: { count: 0, best: 0, lastDay: null, freezes: 0, milestonesClaimed: [] },
  bossBadges: [],
};

const pad = (n: number) => String(n).padStart(2, '0');

/** The game's "day": it rolls over at the daily reset hour (8 AM), not midnight. */
export const dayKey = (date: Date = new Date()): string => {
  const d = new Date(date.getTime() - DAILY_RESET_HOUR * 3_600_000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Whole days from one day key to another (b - a). */
export const daysBetween = (a: string, b: string): number => {
  const toUtc = (k: string) => { const [y, m, d] = k.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000);
};

/** When the next daily reset happens. */
export const nextResetAt = (now: Date = new Date()): Date => {
  const next = new Date(now);
  next.setHours(DAILY_RESET_HOUR, 0, 0, 0);
  if (now.getHours() >= DAILY_RESET_HOUR) next.setDate(next.getDate() + 1);
  return next;
};

export const getProfile = (): Profile => {
  const saved = storage.getJSON<Partial<Profile> | null>(STORAGE_KEYS.profile, null);
  if (!saved || typeof saved !== 'object') return structuredClone(EMPTY_PROFILE);
  return {
    owned: Array.isArray(saved.owned) ? saved.owned.filter(id => cosmeticById(id)) : [],
    badge: cosmeticById(saved.badge)?.kind === 'badge' ? saved.badge! : null,
    title: cosmeticById(saved.title)?.kind === 'title' ? saved.title! : null,
    streak: { ...EMPTY_PROFILE.streak, ...(saved.streak ?? {}) },
    bossBadges: Array.isArray(saved.bossBadges) ? [...new Set(saved.bossBadges.filter(id => bossById(id)))] : [],
  };
};

const saveProfile = (p: Profile) => storage.setJSON(STORAGE_KEYS.profile, p);

/**
 * The streak as it stands today: still alive if the last run was today or yesterday, or if
 * the missed days can be covered by freezes (they're spent on the next finished run).
 */
export const currentStreak = (p: Profile = getProfile(), today: string = dayKey()): number => {
  const { count, lastDay, freezes } = p.streak;
  if (!lastDay) return 0;
  const gap = daysBetween(lastDay, today);
  if (gap <= 1) return count;
  return gap - 1 <= freezes ? count : 0;
};

/** True when today's streak day is already banked (a run was finished today). */
export const playedToday = (p: Profile = getProfile(), today: string = dayKey()): boolean => p.streak.lastDay === today;

export interface StreakUpdate {
  count: number;
  extended: boolean;
  freezesUsed: number;
  /** The old streak was lost (too many missed days for the freezes held). */
  reset: boolean;
  milestones: StreakMilestone[];
}

/** Call once per finished run. Extends the streak at most once a day and pays new milestones. */
export const recordRunFinished = (today: string = dayKey()): StreakUpdate => {
  const p = getProfile();
  const s = p.streak;
  let freezesUsed = 0;
  let reset = false;
  let extended = false;
  if (s.lastDay !== today) {
    const gap = s.lastDay ? daysBetween(s.lastDay, today) : 1;
    if (s.count === 0 || gap === 1) {
      s.count += 1;
    } else if (gap > 1 && gap - 1 <= s.freezes) {
      freezesUsed = gap - 1;
      s.freezes -= freezesUsed;
      s.count += 1;
    } else {
      reset = s.count > 0;
      s.count = 1;
    }
    s.lastDay = today;
    s.best = Math.max(s.best, s.count);
    extended = true;
  }
  const milestones = STREAK_MILESTONES.filter(m => m.day <= s.count && !s.milestonesClaimed.includes(m.day));
  for (const m of milestones) {
    s.milestonesClaimed.push(m.day);
    for (const id of [m.title, m.badge]) if (id && !p.owned.includes(id)) p.owned.push(id);
  }
  saveProfile(p);
  return { count: s.count, extended, freezesUsed, reset, milestones };
};

export const nextMilestone = (count: number): StreakMilestone | undefined => STREAK_MILESTONES.find(m => m.day > count);

/** Buy a streak freeze. Returns the cost to charge, or 0 if it can't be bought. */
export const buyFreeze = (coins: number): number => {
  const p = getProfile();
  if (p.streak.freezes >= STREAK_FREEZE.maxHeld || coins < STREAK_FREEZE.cost) return 0;
  p.streak.freezes += 1;
  saveProfile(p);
  return STREAK_FREEZE.cost;
};

/** Buy a shop cosmetic and wear it. Returns the cost to charge, or 0 if it can't be bought. */
export const buyCosmetic = (id: string, coins: number): number => {
  const item = cosmeticById(id);
  const p = getProfile();
  if (!item || item.cost === undefined || p.owned.includes(id) || coins < item.cost) return 0;
  p.owned.push(id);
  p[item.kind] = id;
  saveProfile(p);
  return item.cost;
};

/** Wear an owned badge or title (null takes it off). */
export const equipCosmetic = (kind: CosmeticKind, id: string | null): Profile => {
  const p = getProfile();
  if (id === null || (p.owned.includes(id) && cosmeticById(id)?.kind === kind)) {
    p[kind] = id;
    saveProfile(p);
  }
  return p;
};

/** The daily Power Word's bonus at this streak length. */
export const powerWordBonusFor = (streak: number): number =>
  Math.min(POWER_WORD_BONUS.max, POWER_WORD_BONUS.base + POWER_WORD_BONUS.perStreakDay * Math.max(0, streak));

/** What other players see: equipped bling, streak and Boss Badges, for the leaderboard and share card. */
export const publicFlair = (p: Profile = getProfile()) => ({
  badge: p.badge,
  title: p.title,
  streak: currentStreak(p),
  bosses: p.bossBadges.length,
});

/** Beating a boss: adds its Boss Badge the first time. Returns whether it's new and the total. */
export const recordBossBadge = (id: string): { isNew: boolean; total: number } => {
  const p = getProfile();
  if (!bossById(id)) return { isNew: false, total: p.bossBadges.length };
  const isNew = !p.bossBadges.includes(id);
  if (isNew) {
    p.bossBadges = [...p.bossBadges, id];
    saveProfile(p);
  }
  return { isNew, total: p.bossBadges.length };
};

export const ALL_COSMETIC_IDS = COSMETICS.map(c => c.id);
