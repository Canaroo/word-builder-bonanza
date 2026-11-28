// 📼 The Video Store, 🎬 Genre Levels and 💿 Collector's Tiles (v7.96.0, the owner's design and picks).
// Pure rules here; the store card is components/VideoStore.tsx and the reducer cases live in
// services/screens/GameScreen.tsx (STORE_RENT, STORE_RESTOCK, STORE_TRADE_IN, STORE_LEAVE).
// Values in VIDEO_STORE, GENRE_VALUES and COLLECTOR (config/gameplay.ts).
import { VIDEO_STORE, GENRE_VALUES, COLLECTOR, CHARM_SLOTS } from '../config/gameplay';
import type { Charm, PowerPlay, GameState } from '../types';

// ---------- Genres ----------

export type GenreId = 'shorts' | 'epics' | 'sequels' | 'cult' | 'musicals' | 'remakes';

export interface Genre {
  id: GenreId;
  name: string;
  icon: string;
  /** Plain rule, finishes "Words with ...". */
  rule: string;
  flavor: string;
  fits: (word: string, earlier: ReadonlySet<string>) => boolean;
}

const VOWELS = new Set(['A', 'E', 'I', 'O', 'U']);
/** A word's letters in order, so anagrams (and the same word) match. */
export const letterKey = (word: string) => [...word.toUpperCase()].sort().join('');

export const GENRES: Genre[] = [
  // v7.96.7 (the owner's call): exactly 3 letters. 4-letter words already have plenty of rewards, and from level 3
  // a 3-letter word earns no time, so a Shorts bonus makes it a real choice.
  { id: 'shorts', name: 'Shorts', icon: '🩳', rule: 'exactly 3 letters, like CAT or SUN', flavor: 'Under ten minutes, all killer.', fits: w => w.length === 3 },
  { id: 'epics', name: 'Epics', icon: '🎞️', rule: '6 or more letters', flavor: 'Three hours, one intermission.', fits: w => w.length >= 6 },
  { id: 'sequels', name: 'Sequels', icon: '🎬', rule: 'a double letter, like BALL or MOON', flavor: 'Same story, twice the letters.', fits: w => /(.)\1/i.test(w) },
  { id: 'cult', name: 'Cult Classics', icon: '🦇', rule: 'a J, K, Q, X, Z, V or W', flavor: 'Midnight showings only.', fits: w => /[JKQXZVW]/i.test(w) },
  { id: 'musicals', name: 'Musicals', icon: '🎤', rule: '3 or more vowels, like AUDIO or OCEAN', flavor: 'Everybody sing the vowels.', fits: w => [...w.toUpperCase()].filter(c => VOWELS.has(c)).length >= 3 },
  { id: 'remakes', name: 'Remakes', icon: '🔁', rule: 'the same letters as a word you played earlier this run (the same word counts)', flavor: 'Same script, new cast.', fits: (w, earlier) => earlier.has(letterKey(w)) },
];
export const genreById = (id: string) => GENRES.find(g => g.id === id);

export const starsOf = (gs: Pick<GameState, 'genreStars'> | null | undefined, id: GenreId) => Math.min(GENRE_VALUES.maxStars, gs?.genreStars?.[id] ?? 0);
export const perStar = (id: GenreId) => GENRE_VALUES.perStar[id] ?? 0;
export const playsPerStar = (id: GenreId) => GENRE_VALUES.playsPerStar[id] ?? 10;

/** Letter keys of the valid words already played this run (for Remakes). */
export const earlierKeys = (log: GameState['log']): Set<string> =>
  new Set(log.filter(e => e.type === 'word' && e.status === 'valid').map(e => letterKey((e as { word: string }).word)));

/** The genres a word fits. */
export const genresFor = (word: string, earlier: ReadonlySet<string>): Genre[] => GENRES.filter(g => g.fits(word.toUpperCase(), earlier));

/** What each fitting genre pays this word (only genres with at least one ★). */
export const genrePay = (gs: Pick<GameState, 'genreStars'>, word: string, earlier: ReadonlySet<string>) =>
  genresFor(word, earlier).map(g => ({ genre: g, stars: starsOf(gs, g.id), points: starsOf(gs, g.id) * perStar(g.id) })).filter(p => p.points > 0);

/**
 * Counts a valid word toward every genre it fits; a genre that reaches its plays earns a ★ (up to the cap).
 * Returns the new counters and the genres that went up.
 */
export const countGenrePlays = (gs: Pick<GameState, 'genreStars' | 'genrePlays'>, word: string, earlier: ReadonlySet<string>) => {
  const stars = { ...(gs.genreStars ?? {}) };
  const plays = { ...(gs.genrePlays ?? {}) };
  const up: Genre[] = [];
  for (const g of genresFor(word, earlier)) {
    if ((stars[g.id] ?? 0) >= GENRE_VALUES.maxStars) continue;
    plays[g.id] = (plays[g.id] ?? 0) + 1;
    if (plays[g.id] >= playsPerStar(g.id)) { plays[g.id] = 0; stars[g.id] = (stars[g.id] ?? 0) + 1; up.push(g); }
  }
  return { genreStars: stars, genrePlays: plays, up };
};

// ---------- Collector's Tiles ----------

export type CollectorKind = 'chrome' | 'holo' | 'static' | 'rewind';
/** `short` fits a Gear row; `look` says how to spot its frame in the hand (v7.98.0, the owner's ask). */
export interface CollectorInfo { kind: CollectorKind; name: string; icon: string; text: string; short: string; look: string; flavor: string }
export const COLLECTOR_TILES: CollectorInfo[] = [
  { kind: 'chrome', name: 'Chrome Tile', icon: '💿', text: `A word that uses it scores x${COLLECTOR.chromeMultiplier}.`, short: `Word scores x${COLLECTOR.chromeMultiplier}`, look: 'a polished silver frame with a shine that sweeps across it', flavor: 'Shiny side up.' },
  { kind: 'holo', name: 'Holo Tile', icon: '✨', text: `A word that uses it earns +${COLLECTOR.holoPoints} points.`, short: `+${COLLECTOR.holoPoints} points a word`, look: 'a rainbow frame that shifts colors', flavor: 'Tilt it in the light.' },
  { kind: 'static', name: 'Static Tile', icon: '📺', text: 'A blank: tap it and pick any letter. It scores 0 points itself.', short: 'Pick any letter', look: 'a cyan frame of TV-snow stripes, and a ? until you pick its letter', flavor: 'Snow on channel 3.' },
  { kind: 'rewind', name: 'Rewind Tile', icon: '⏪', text: `A word that uses it earns +${COLLECTOR.rewindSeconds} seconds.`, short: `+${COLLECTOR.rewindSeconds} seconds a word`, look: 'an orange frame, like a VHS tape label', flavor: 'Back to the start of the tape.' },
];
export const collectorInfo = (kind: string) => COLLECTOR_TILES.find(c => c.kind === kind);
/** How Collector's Tiles are explained everywhere (store, How to Play, the first-time card). */
export const COLLECTOR_RULE = "It's yours for the rest of the run: it shows up on a tile in your next hand, and after you play it, it comes back on a later hand.";

// ---------- The store ----------

export type TapeKind = 'charm' | 'powerPlay' | 'poster' | 'tile';
export interface Tape { kind: TapeKind; id: string; price: number }

export const storeOpensAt = (level: number) => level >= VIDEO_STORE.firstLevel && (level - VIDEO_STORE.firstLevel) % VIDEO_STORE.every === 0;
export const restockCost = (restocks: number) => VIDEO_STORE.restockBase + VIDEO_STORE.restockStep * restocks;
export const charmPrice = (c: Pick<Charm, 'breaks'>) => (c.breaks ? VIDEO_STORE.prices.fragile : VIDEO_STORE.prices.charm);
export const tradeInValue = (c: Pick<Charm, 'breaks'>, upgraded: boolean) => (upgraded ? charmPrice(c) : Math.max(1, Math.round(charmPrice(c) * VIDEO_STORE.tradeBack)));
/** A purchase never takes the clock under keepAtLeast. */
export const canAfford = (clock: number, price: number) => clock - price >= VIDEO_STORE.keepAtLeast;

/** A receipt line. A trade-in also carries what taking it back needs (v7.96.10). */
export interface StoreLine {
  t: string; d: number;
  trade?: { id: string; up: boolean; buff: boolean; at: number };
  /** v7.100.4: a checkout, with what returning it needs (until Done): the tape, its shelf spot and what it replaced. */
  rent?: { kind: Tape['kind']; id: string; idx: number; deal: number; prevPocket?: string | null; prevTape?: string | null; prevOnce?: string[]; prevCd?: number | null; prevStars?: number; colId?: string };
}

/**
 * v7.100.4 (the owner's ask: anything picked in the store can go back until Done): why a checkout can't be returned
 * right now, or null when it can. Only when the item was used up in the same visit (traded in, swapped out of the
 * pocket by a later checkout).
 */
export const returnBlock = (line: StoreLine, gs: Pick<GameState, 'activeCharms' | 'availablePowerPlays' | 'genreStars' | 'collectorTiles'>): string | null => {
  const r = line.rent;
  if (!r) return 'Only a checkout can be returned.';
  if (r.kind === 'charm' && !gs.activeCharms.some(c => c.id === r.id)) return 'You traded it in, so it can\'t go back.';
  if (r.kind === 'powerPlay' && gs.availablePowerPlays[0]?.id !== r.id) return 'It left your pocket when you checked out another PowerPlay.';
  if (r.kind === 'poster' && (gs.genreStars?.[r.id as GenreId] ?? 0) <= (r.prevStars ?? 0)) return 'That star is already gone.';
  if (r.kind === 'tile' && !(gs.collectorTiles ?? []).some(t => t.id === r.colId)) return 'That tile is already gone.';
  return null;
};

/**
 * v7.96.10 (the owner's ask): why a trade-in can't be taken back right now, or null when it can. The seconds
 * it paid come back off the clock, which never drops under keepAtLeast (or under the clock before the trade,
 * when that was already lower), and the charm needs a free slot.
 */
export const takeBackBlock = (line: StoreLine, clock: number, charms: Pick<Charm, 'id'>[]): string | null => {
  if (!line.trade) return 'Only a trade-in can be taken back.';
  if (charms.some(c => c.id === line.trade!.id)) return 'You already have it.';
  if (charms.length >= CHARM_SLOTS) return 'Your charm slots are full.';
  if (clock - line.d < Math.min(VIDEO_STORE.keepAtLeast, line.trade.at)) return `You spent those seconds. You need ${line.d} to buy it back.`;
  return null;
};
export const canTakeBack = (line: StoreLine, clock: number, charms: Pick<Charm, 'id'>[]) => takeBackBlock(line, clock, charms) === null;

/**
 * Deals a shelf of three tapes: a charm (New Release), a PowerPlay or sometimes a Collector's
 * Tile, and a genre poster. `rank(tag)` is a seeded number in [0, 1) (dailyRank), so a Daily matches and
 * a quit can't reroll; each restock passes a new `deal` number.
 */
export const dealShelf = (opts: {
  rank: (tag: string) => number;
  charms: Charm[];
  powerPlays: PowerPlay[];
  genreStars: GameState['genreStars'];
  collectorOwned: number;
}): Tape[] => {
  const best = <T,>(list: T[], key: (t: T) => string, tag: string) =>
    [...list].sort((a, b) => opts.rank(`${tag}-${key(a)}`) - opts.rank(`${tag}-${key(b)}`))[0];
  const shelf: Tape[] = [];
  const charm = best(opts.charms, c => c.id, 'charm');
  if (charm) shelf.push({ kind: 'charm', id: charm.id, price: charmPrice(charm) });
  const tile = opts.collectorOwned < COLLECTOR.max && opts.rank('tile-slot') < VIDEO_STORE.tileChance
    ? best(COLLECTOR_TILES, c => c.kind, 'tile') : undefined;
  const pp = best(opts.powerPlays, p => p.id, 'pp');
  if (tile) shelf.push({ kind: 'tile', id: tile.kind, price: COLLECTOR.prices[tile.kind] });
  else if (pp) shelf.push({ kind: 'powerPlay', id: pp.id, price: VIDEO_STORE.prices.powerPlay });
  const genres = GENRES.filter(g => (opts.genreStars?.[g.id] ?? 0) < GENRE_VALUES.maxStars);
  const poster = best(genres, g => g.id, 'poster');
  if (poster) shelf.push({ kind: 'poster', id: poster.id, price: VIDEO_STORE.prices.poster });
  return shelf;
};

/**
 * v7.96.2 (the owner's ask): what a genre has paid this run, for the Gear menu. Reads the genre's score
 * lines ("🎬 Sequels ★2", "+60 pts ...") on valid words in the log.
 */
export const genreEarned = (log: GameState['log'], g: Pick<Genre, 'icon' | 'name'>): { points: number; words: number } => {
  let points = 0, words = 0;
  const prefix = `${g.icon} ${g.name} ★`;
  for (const e of log) {
    if (e.type !== 'word' || e.status !== 'valid') continue;
    for (const b of (e as { bonuses?: { name: string; description: string }[] }).bonuses ?? []) {
      if (!String(b.name).startsWith(prefix)) continue;
      const m = String(b.description).match(/\+([\d,]+)\s*pts/);
      if (m) { points += Number(m[1].replace(/,/g, '')); words++; }
    }
  }
  return { points, words };
};
