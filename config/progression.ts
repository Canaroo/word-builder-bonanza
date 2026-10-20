// The between-runs economy: what credits (LEX coins) are worth, what earns them, what they buy.
// Change numbers here; the shop, mission cards and streak ladder all read them.
//
// Rough budget: an engaged player earns ~20-30 credits a day (missions plus score credits),
// so a cheap badge is a day of play, a top theme is about a week, and the priciest bling longer.

/** Credits earned during a run: 1 per this many points. */
export const POINTS_PER_CREDIT = 5000;

/** Daily missions pay by difficulty; finishing all three pays a sweep bonus on top. */
export const MISSION_REWARD = { 1: 4, 2: 6, 3: 10 } as const;
export const MISSION_SWEEP_BONUS = 6;
export const MISSIONS_PER_DAY = 3;

/** Theme prices (by pack id). Packs not listed are free. Owned packs stay owned. */
export const THEME_PRICES: Record<string, number> = {
  classic: 60,
  future: 60,
  golden: 90,
  'hawkins-horror': 90,
  'galactic-saga': 90,
  '90s-throwback': 120,
  'fifth-dimension': 120,
  'worlds-finest': 120,
};

/** Streak freezes: each one covers a missed day. */
export const STREAK_FREEZE = { cost: 30, maxHeld: 2 };

/** The daily Power Word pays more the longer your streak: base + per day, up to the cap. */
export const POWER_WORD_BONUS = { base: 500, perStreakDay: 50, max: 1000 };

/** Daily reset hour (local time), shared by missions, streaks and the Power Word spin. */
export const DAILY_RESET_HOUR = 8;
