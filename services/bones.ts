import { isOnlineLeaderboardEnabled } from './onlineLeaderboard';
import { storage, STORAGE_KEYS } from './storage';
import { playerKey, sameName } from './players';
import { BONES } from '../config/gameplay';

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
    .filter(b => b.level === level && !sameName(b.name, ctx.player) && !looted.includes(b.id) && !(ctx.met ?? []).includes(b.id))
    .filter(b => now - b.timestamp < BONES.maxAgeDays * 86_400_000)
    .filter(b => b.charms.some(c => !ctx.heldCharmIds.includes(c)))
    .sort((a, b) => b.timestamp - a.timestamp);
  return fresh[0] ?? null;
};
