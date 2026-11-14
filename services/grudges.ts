import { storage, STORAGE_KEYS } from './storage';
import { playerKey, currentPlayer } from './players';
import { getCareer } from './career';
import type { Boss } from '../data/bosses';

// Grudge Match (v7.43): bosses remember. A boss that got away from this player (no badge that
// round, or the run ended mid-fight) holds a grudge: next time it taunts them with their own
// numbers, and beating it pays double and settles the grudge. Per player, on this device.
export interface Grudge { faced: number; won: number; /** Rounds in a row this boss got away. */ streak: number; /** Grudges settled against this boss. */ settled: number }
type Book = Record<string, Grudge>;

const EMPTY: Grudge = { faced: 0, won: 0, streak: 0, settled: 0 };
const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const book = (): Book => {
  const saved = storage.getJSON<Book | null>(playerKey(STORAGE_KEYS.grudges), null);
  return saved && typeof saved === 'object' ? saved : {};
};

export const grudgeFor = (bossId: string): Grudge => {
  const g = book()[bossId];
  return g ? { faced: n(g.faced), won: n(g.won), streak: n(g.streak), settled: n(g.settled) } : { ...EMPTY };
};

/** A boss round ended (or the run ended mid-fight: 'escaped'). Returns the grudge afterward. */
export const recordBossResult = (bossId: string, outcome: 'won' | 'close' | 'escaped'): Grudge => {
  const all = book();
  const g = grudgeFor(bossId);
  const next: Grudge = outcome === 'won'
    ? { faced: g.faced + 1, won: g.won + 1, streak: 0, settled: g.settled + (g.streak > 0 ? 1 : 0) }
    : { ...g, faced: g.faced + 1, streak: g.streak + 1 };
  storage.setJSON(playerKey(STORAGE_KEYS.grudges), { ...all, [bossId]: next });
  return next;
};

/** What the run looks like so far, for a taunt (from the run's own log). */
export interface RunSnapshot { words: string[]; strikes: number; level: number }

/**
 * The boss's grudge line: its record against the player, then one jab built from the player's
 * real numbers (this run's words and strikes, or their career). Playful, never mean: family game.
 */
export const grudgeTaunt = (boss: Pick<Boss, 'id' | 'name'>, grudge: Grudge, run: RunSnapshot, player = currentPlayer().name, career = getCareer()): string => {
  const who = player.trim() || 'word nerd';
  const times = grudge.streak === 1 ? 'once' : grudge.streak === 2 ? 'twice' : `${grudge.streak} times`;
  const record = `Back again, ${who}? I've slipped past you ${times}${grudge.won > 0 ? '' : ', and you have never beaten me'}.`;
  const short = run.words.filter(w => w.length === 3).length;
  const share = run.words.length ? Math.round((short / run.words.length) * 100) : 0;
  const longest = run.words.reduce((a, w) => (w.length > a.length ? w : a), '');
  const jabs: string[] = [];
  if (run.words.length >= 6 && share >= 40) jabs.push(`${share}% of your words this run are three letters. I've seen longer words on a cereal box.`);
  if (run.strikes > 0) jabs.push(`${run.strikes} ${run.strikes === 1 ? 'strike' : 'strikes'} already? I barely have to show up.`);
  if (longest.length >= 3 && longest.length <= 5) jabs.push(`Your longest word today is ${longest.toUpperCase()}. Adorable.`);
  if (career.longestWord && career.longestWord.length >= 6) jabs.push(`${career.longestWord} is the longest word you've ever played. Bring something like that, or don't bother.`);
  if (career.highestLevel > 0 && run.level >= career.highestLevel) jabs.push(`Level ${run.level}: as far as you've ever been. The air gets thin up here.`);
  else if (career.highestLevel > run.level) jabs.push(`You've seen level ${career.highestLevel} before. Not today.`);
  if (career.runs >= 10) jabs.push(`${career.runs} runs and I'm still not in your Badge Case${grudge.won > 0 ? ' twice' : ''}.`);
  if (jabs.length === 0) jabs.push('This will be quick.');
  // The same boss on the same streak says the same thing; a new streak picks a new jab.
  let h = grudge.streak * 31 + grudge.faced * 7;
  for (const c of boss.id) h = (h * 33 + c.charCodeAt(0)) >>> 0;
  return `${record} ${jabs[h % jabs.length]}`;
};
