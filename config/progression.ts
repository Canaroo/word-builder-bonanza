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

/** Music tracks in the shop (v7.53.0): each costs this many Credits, about three days of missions. */
export const MUSIC_PRICE = 80;

/**
 * The start screen's "new in the shop" banner (v7.53.0). Change `id` when something new lands in
 * the shop and the banner comes back once for everyone; `tab` is the shop tab it opens.
 */
export const SHOP_NEWS = { id: 'music-2026-11', text: '🎵 NEW IN THE SHOP: 4 music tracks', tab: 'music' } as const;

/** Streak freezes: each one covers a missed day. */
export const STREAK_FREEZE = { cost: 30, maxHeld: 2 };

/** The daily Power Word pays more the longer your streak: base + per day, up to the cap. */
export const POWER_WORD_BONUS = { base: 500, perStreakDay: 50, max: 1000 };

/**
 * Phoenix Down (a charm, data/charms.ts `phoenixDown`): it shows up in at most one charm offer a
 * run, and the player has to take it and keep it. If the run then ends (clock or strikes) while
 * they hold it, a card offers to continue for `cost` Credits: strikes wiped, clock back to at
 * least `seconds`, and the charm burns up. Never offered on the scored Daily Run.
 */
export const PHOENIX_DOWN = { id: 'phoenixDown', name: 'Phoenix Down', icon: '🪶', cost: 150, seconds: 30 };

/** Daily reset hour (local time), shared by missions, streaks and the Power Word spin. */
export const DAILY_RESET_HOUR = 8;

/** The Daily Run (v7.30): one shared deal a day (services/daily.ts). */
/**
 * v7.99.0 (the owner's design): 🏆 Daily Champ. The top score on a finished Daily Challenge board wins it (ties all
 * win). Counted from `firstDay` on (the owner's call: start fresh), worked out by every client from the boards
 * (services/dailyChamps.ts), so nothing new is stored online. A win pays `credits` once, on the winner's next visit.
 */
export const DAILY_CHAMP = {
  firstDay: '2026-11-27',   // Daily #21: the first board that counts
  credits: 25,
  refreshMs: 10 * 60 * 1000,
};

export const DAILY_RUN = {
  launchDay: '2026-11-07',  // Daily Run #1 (launch day: the game day that was current when it shipped)
  finishCredits: 5,         // for finishing your scored daily run
  topRank: 10,              // a daily board finish this high or better...
  topCredits: 5,            // ...pays this much more
  shareUrl: 'wordnerd-game.netlify.app',
};
