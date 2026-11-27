import { isOnlineLeaderboardEnabled } from './onlineLeaderboard';
import { storage, STORAGE_KEYS } from './storage';
import { playerKey, sameName } from './players';
import { BONES } from '../config/gameplay';
import { TILE_DISTRIBUTION } from '../constants';

// Bones (v7.44): when a run ends, the player's final hand and charms are left behind at the level
// they fell on. Another player who reaches that level may find the ghost: spell a long word from
// those tiles, against a short clock, and take one of the charms. Stored at /bones in the same
// Firebase database as the leaderboard (names are public there too); rules in docs/LEADERBOARD.md.
export interface Bone {
  id: string;
  name: string;
  level: number;
  /** The final hand's tile letters (a combo tile is one entry, like "QU"). */
  hand: string[];
  /** Charm ids the player was holding. */
  charms: string[];
  score: number;
  timestamp: number;
}

const PATH = 'bones';
const CACHE_KEY = 'wordNerdBonesCache';
const databaseURL = () => String(import.meta.env.VITE_FIREBASE_DATABASE_URL ?? '').replace(/\/+$/, '');
const online = (): boolean => {
  if (import.meta.env.DEV || !isOnlineLeaderboardEnabled()) return false;
  const host = typeof location !== 'undefined' ? location.hostname : '';
  return host !== 'localhost' && host !== '127.0.0.1';
};

const NAME = /^[A-Za-z0-9 _.'-]{1,30}$/;
const TILE = /^[A-Z]{1,3}$/;
const ID = /^[A-Za-z0-9]{1,32}$/;

/** A row from the database (or the cache) as a Bone, or null if anything about it is off. */
export const toBone = (id: string, row: any): Bone | null => {
  if (!row || typeof row !== 'object') return null;
  const hand = String(row.hand ?? '').split(',').filter(Boolean);
  // Phoenix Down can't be looted: it only ever comes from a charm offer.
  const charms = String(row.charms ?? '').split(',').filter(c => c && c !== 'phoenixDown');
  if (typeof row.name !== 'string' || !NAME.test(row.name)) return null;
  if (!Number.isInteger(row.level) || row.level < BONES.minLevel) return null;
  if (hand.length < BONES.minLetters || hand.length > 10 || !hand.every(t => TILE.test(t))) return null;
  if (charms.length < 1 || charms.length > 5 || !charms.every(c => ID.test(c))) return null;
  if (typeof row.timestamp !== 'number') return null;
  return { id, name: row.name, level: row.level, hand, charms, score: Math.max(0, Math.round(Number(row.score) || 0)), timestamp: row.timestamp };
};

/** Should this ending leave bones behind? (A level worth finding, charms to take, a full hand.) */
export const worthLeaving = (run: { level: number; hand: string[]; charms: string[] }): boolean =>
  run.level >= BONES.minLevel && run.charms.length >= 1 && run.hand.length >= BONES.minLetters;

/** Leaves this run's bones. Fire-and-forget: never waits, retries or interrupts the game. */
export const postBones = (run: { name: string; level: number; hand: string[]; charms: string[]; score: number }): void => {
  if (!online() || !worthLeaving(run) || !NAME.test(run.name)) return;
  try {
    fetch(`${databaseURL()}/${PATH}.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: run.name, level: run.level, hand: run.hand.join(','), charms: run.charms.slice(0, 5).join(','), score: Math.max(0, Math.round(run.score)), timestamp: { '.sv': 'timestamp' } }),
      keepalive: true,
    }).catch(() => {});
  } catch { /* no fetch: ignore */ }
};

const readCache = (): Bone[] => {
  try {
    const rows = JSON.parse(sessionStorage.getItem(CACHE_KEY) || '[]');
    return Array.isArray(rows) ? rows.map(r => toBone(String(r?.id ?? ''), { ...r, hand: Array.isArray(r?.hand) ? r.hand.join(',') : r?.hand, charms: Array.isArray(r?.charms) ? r.charms.join(',') : r?.charms })).filter((b): b is Bone => !!b) : [];
  } catch { return []; }
};

/** Loads the latest bones in the background (a run asks once, when it starts). Never throws. */
export const refreshBones = async (): Promise<void> => {
  if (!online()) return;
  try {
    const res = await fetch(`${databaseURL()}/${PATH}.json?orderBy=%22timestamp%22&limitToLast=${BONES.fetch}`);
    if (!res.ok) return;
    const data = (await res.json()) ?? {};
    const bones = Object.entries(data).map(([id, row]) => toBone(id, row)).filter((b): b is Bone => !!b);
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(bones));
  } catch { /* offline or rules not published yet: no ghosts this run */ }
};

const lootedIds = (): string[] => {
  const ids = storage.getJSON<string[]>(playerKey(STORAGE_KEYS.bonesLooted), []);
  return Array.isArray(ids) ? ids : [];
};
/** This player took a charm from these bones: they won't meet that ghost again. */
export const markLooted = (id: string): void => { storage.setJSON(playerKey(STORAGE_KEYS.bonesLooted), [...lootedIds().filter(x => x !== id), id].slice(-200)); };

/**
 * The ghost to meet on reaching `level`, or null: the newest bones at that level that aren't the
 * player's own, weren't looted by them before, weren't met this run, aren't stale, and still
 * carry a charm the player doesn't hold.
 */
export const pickBone = (
  level: number,
  ctx: { player: string; heldCharmIds: readonly string[]; met?: readonly string[]; now?: number },
  bones: Bone[] = readCache(),
  looted: readonly string[] = lootedIds(),
): Bone | null => {
  const now = ctx.now ?? Date.now();
  const fresh = bones
    .filter(b => b.level <= level && !sameName(b.name, ctx.player) && !looted.includes(b.id) && !(ctx.met ?? []).includes(b.id))
    .filter(b => now - b.timestamp < BONES.maxAgeDays * 86_400_000)
    .filter(b => b.charms.some(c => !ctx.heldCharmIds.includes(c)))
    // v7.96.6: a ghost from this exact level first, then the newest one that fell at a lower level.
    .sort((a, b) => Number(b.level === level) - Number(a.level === level) || b.timestamp - a.timestamp);
  return fresh[0] ?? null;
};

// --- A hand that can always be solved (v7.44.2) --------------------------------------------------
const BAG = Object.entries(TILE_DISTRIBUTION).filter(([l]) => l.length === 1).flatMap(([letter, { count }]) => Array(count).fill(letter) as string[]);
const VOWEL_BAG = BAG.filter(l => 'AEIOU'.includes(l)), CONSONANT_BAG = BAG.filter(l => !'AEIOU'.includes(l));
const draw = (vowel: boolean, rand: () => number): string => { const pool = vowel ? VOWEL_BAG : CONSONANT_BAG; return pool[Math.floor(rand() * pool.length)]; };

/** Everyday five-letter words for the last-resort hand (all in the game's dictionary; a test checks). */
export const LAST_RESORT = ['PLANT', 'STONE', 'TRAIN', 'HOUSE', 'BREAD', 'LIGHT', 'RADIO', 'OCEAN', 'SNAIL', 'TIGER'] as const;

export interface SolvedHand {
  /** The tiles to play with: the fallen player's, with some swapped if theirs couldn't spell a word. */
  hand: string[];
  /** A common word of BONES.minLetters or more these tiles can spell (shown if the player misses). */
  answer: string;
  /** How many of the original tiles were swapped for new ones. */
  swapped: number;
}

/**
 * Makes sure a ghost's hand can spell a common word of BONES.minLetters or more. If the fallen
 * player's tiles can't, tiles are swapped for fresh ones, two at a time (a vowel for a vowel, a
 * consonant for a consonant), keeping as much of their hand as possible; then the hand is
 * redealt; and if even that finds nothing, it is dealt around a known word. It always returns a
 * hand with an answer. `find` is the dictionary's word finder.
 */
export const solveHand = async (
  original: readonly string[],
  find: (letters: string[]) => Promise<string | null>,
  rand: () => number = Math.random,
): Promise<SolvedHand> => {
  const long = async (letters: string[]) => { const w = await find(letters); return w && w.length >= BONES.minLetters ? w.toUpperCase() : null; };
  let hand = [...original];
  while (hand.length < 8) hand.push(draw(hand.filter(l => 'AEIOU'.includes(l)).length < 3, rand));
  let answer = await long(hand);
  const changed = new Set<number>();
  for (let tries = 0; !answer && tries < 12; tries++) {
    for (let k = 0; k < 2; k++) {
      const i = Math.floor(rand() * hand.length);
      // Keep the hand playable: about three vowels, the rest consonants.
      const vowels = hand.filter((l, j) => j !== i && 'AEIOU'.includes(l)).length;
      hand[i] = draw(vowels < 3, rand);
      changed.add(i);
    }
    answer = await long(hand);
  }
  for (let deals = 0; !answer && deals < 20; deals++) {
    hand = Array.from({ length: 8 }, (_, i) => draw(i < 3, rand));
    hand.forEach((_, i) => changed.add(i));
    answer = await long(hand);
  }
  if (answer) return { hand, answer, swapped: Math.min(changed.size, hand.length) };
  // The guarantee: a hand built around a word we know, plus three loose tiles, mixed up.
  const word = LAST_RESORT[Math.floor(rand() * LAST_RESORT.length)];
  const dealt = [...word, draw(true, rand), draw(false, rand), draw(false, rand)];
  for (let i = dealt.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [dealt[i], dealt[j]] = [dealt[j], dealt[i]]; }
  return { hand: dealt, answer: word, swapped: dealt.length };
};
