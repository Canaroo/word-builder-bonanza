// Greatest Hits (v7.52.0): an N-letter word played N times in a run "goes platinum" (see
// GREATEST_HITS in config/gameplay.ts). Plays are counted from the run's log (valid words only),
// so a Sliders undo or a resumed run counts the same way.
import { GREATEST_HITS } from '../config/gameplay';
import type { GameState } from '../types';

export type HitTier = (typeof GREATEST_HITS.tiers)[number];

type LogLike = GameState['log'];

/** How many times each word (uppercase) was played as a valid word in this log. */
export const playCounts = (log: LogLike): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const e of log) {
    if (e.type !== 'word' || e.status !== 'valid') continue;
    const w = String(e.word).toUpperCase();
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  return counts;
};

export const tierFor = (letters: number): HitTier | undefined => GREATEST_HITS.tiers.find(t => t.letters === letters);

/**
 * The record this play earns, if any: `plays` counts this play too. A record pays once a run, for
 * the first word to get there.
 */
export const greatestHitFor = (word: string, plays: number, claimed: readonly number[]): HitTier | undefined => {
  const tier = tierFor(word.length);
  return tier && plays >= tier.letters && !claimed.includes(tier.letters) ? tier : undefined;
};

/** The next record still open (the shortest), for the card's "next on the charts" line. */
export const nextHit = (claimed: readonly number[]): HitTier | undefined => GREATEST_HITS.tiers.find(t => !claimed.includes(t.letters));

/**
 * The closest word to an open record, for the tracker chip: fewest plays still needed, then the
 * bigger prize. Only once it has GREATEST_HITS.chipFrom plays.
 */
export const hitInProgress = (log: LogLike, claimed: readonly number[]): { word: string; plays: number; tier: HitTier } | null => {
  let best: { word: string; plays: number; tier: HitTier } | null = null;
  for (const [word, plays] of playCounts(log)) {
    const tier = tierFor(word.length);
    if (!tier || claimed.includes(tier.letters) || plays < GREATEST_HITS.chipFrom || plays >= tier.letters) continue;
    const left = tier.letters - plays;
    if (!best || left < best.tier.letters - best.plays || (left === best.tier.letters - best.plays && tier.points > best.tier.points)) best = { word, plays, tier };
  }
  return best;
};

/** 1st, 2nd, 3rd, 4th... */
export const ordinal = (n: number): string => {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

/**
 * v7.86.0 (the owner's ask: show players which word is close to a record so they can chase it):
 * every record with its leading word. A paid record shows the word that earned it; an open one shows
 * the word with the most plays at that length once it has GREATEST_HITS.chipFrom plays.
 */
export interface HitRow { tier: HitTier; word: string | null; plays: number; done: boolean }
export const hitsBoard = (log: LogLike, claimed: readonly number[]): HitRow[] => {
  const counts = playCounts(log);
  return GREATEST_HITS.tiers.map(tier => {
    let word: string | null = null;
    let plays = 0;
    const done = claimed.includes(tier.letters);
    // A paid record shows the word that got there; an open one only counts words still short of it.
    for (const [w, p] of counts) if (w.length === tier.letters && (done || p < tier.letters) && p > plays) { word = w; plays = p; }
    if (!done && plays < GREATEST_HITS.chipFrom) return { tier, word: null, plays: 0, done };
    return { tier, word, plays: Math.min(plays, tier.letters), done };
  });
};

/** The record this word would earn if it were played now (counting this play), for the stage's big news. */
export const hitIfPlayed = (log: LogLike, claimed: readonly number[], word: string): HitTier | undefined => {
  const w = word.toUpperCase();
  return greatestHitFor(w, (playCounts(log).get(w) ?? 0) + 1, claimed);
};
