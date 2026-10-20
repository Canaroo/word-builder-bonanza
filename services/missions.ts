// Daily missions: three picked from the templates each day (same set all day, a fresh mix the
// next), with progress fed by game events. Rewards are returned for the caller to pay out.
import { storage, STORAGE_KEYS } from './storage';
import { dayKey } from './progression';
import { MISSION_TEMPLATES, type MissionCategory, type MissionEvent, type MissionTemplate, type MissionTier } from '../data/missions';
import { MISSION_REWARD, MISSION_SWEEP_BONUS, MISSIONS_PER_DAY } from '../config/progression';

interface MissionState {
  day: string;
  ids: string[];
  /** Best progress today (for run missions: the best single run). */
  progress: Record<string, number>;
  completed: string[];
  sweepClaimed: boolean;
  run: { key: string; progress: Record<string, number> };
}

export interface MissionView {
  template: MissionTemplate;
  progress: number;
  done: boolean;
  reward: number;
}

export interface MissionPayout {
  completed: { template: MissionTemplate; reward: number }[];
  sweepBonus: number;
  total: number;
}

const templateById = (id: string) => MISSION_TEMPLATES.find(t => t.id === id);

// Small deterministic RNG so a day always gets the same missions.
const hash = (s: string) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
const rng = (seed: number) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const shuffled = <T,>(items: T[], rand: () => number) => {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

const shiftDay = (day: string, by: number) => {
  const [y, m, d] = day.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + by));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
};

/** The base pick for a day, ignoring yesterday (used to avoid back-to-back repeats). */
const basePick = (day: string, avoid: Set<string>): string[] => {
  const rand = rng(hash(`word-nerd-missions:${day}`));
  // Three of the four categories, one easy, one medium, one hard.
  const categories = shuffled<MissionCategory>(['word', 'powerplay', 'charm', 'secret'], rand).slice(0, MISSIONS_PER_DAY);
  const tiers = shuffled<MissionTier>([1, 2, 3], rand);
  const picks = categories.map((category, i) => {
    const pool = MISSION_TEMPLATES.filter(t => t.category === category);
    // Closest difficulty first, skipping anything used yesterday.
    const byDistance = (t: MissionTemplate) => Math.abs(t.tier - tiers[i]);
    const fresh = pool.filter(t => !avoid.has(t.id));
    const candidates = fresh.length ? fresh : pool;
    const closest = Math.min(...candidates.map(byDistance));
    const options = candidates.filter(t => byDistance(t) === closest);
    return options[Math.floor(rand() * options.length)];
  });
  return picks.sort((a, b) => a.tier - b.tier).map(t => t.id);
};

// Days are worked out in order from a fixed start, so each day can avoid the real previous day.
const EPOCH = '2020-01-01';
const memo = new Map<string, string[]>([[EPOCH, basePick(EPOCH, new Set())]]);
let lastComputed = EPOCH;

/** A day's three missions. The same all day, and never a repeat of the day before. */
export const missionsForDay = (day: string): string[] => {
  if (day <= EPOCH) return basePick(day, new Set());
  const cached = memo.get(day);
  if (cached) return cached;
  while (lastComputed < day) {
    const next = shiftDay(lastComputed, 1);
    memo.set(next, basePick(next, new Set(memo.get(lastComputed))));
    lastComputed = next;
  }
  return memo.get(day)!;
};

const freshState = (day: string): MissionState => ({
  day, ids: missionsForDay(day), progress: {}, completed: [], sweepClaimed: false, run: { key: '', progress: {} },
});

const load = (today: string): MissionState => {
  const saved = storage.getJSON<MissionState | null>(STORAGE_KEYS.missions, null);
  if (!saved || saved.day !== today || !Array.isArray(saved.ids)) return freshState(today);
  return saved;
};

const save = (s: MissionState) => storage.setJSON(STORAGE_KEYS.missions, s);

export const getTodaysMissions = (now: Date = new Date()): { missions: MissionView[]; sweepClaimed: boolean } => {
  const s = load(dayKey(now));
  return {
    missions: s.ids.map(id => templateById(id)).filter((t): t is MissionTemplate => !!t).map(t => ({
      template: t,
      progress: Math.min(t.target, s.progress[t.id] ?? 0),
      done: s.completed.includes(t.id),
      reward: MISSION_REWARD[t.tier],
    })),
    sweepClaimed: s.sweepClaimed,
  };
};

/** Feed a game event in. Returns the missions it completed and the credits they pay. */
export const recordMissionEvent = (event: MissionEvent, runKey: string, now: Date = new Date()): MissionPayout => {
  const s = load(dayKey(now));
  if (s.run.key !== runKey) s.run = { key: runKey, progress: {} };
  const payout: MissionPayout = { completed: [], sweepBonus: 0, total: 0 };
  for (const id of s.ids) {
    const t = templateById(id);
    if (!t || s.completed.includes(id)) continue;
    const amount = t.progress(event);
    if (amount <= 0) continue;
    const bucket = t.scope === 'run' ? s.run.progress : s.progress;
    bucket[id] = t.mode === 'max' ? Math.max(bucket[id] ?? 0, amount) : (bucket[id] ?? 0) + amount;
    if (t.scope === 'run') s.progress[id] = Math.max(s.progress[id] ?? 0, bucket[id]);
    if (bucket[id] >= t.target) {
      s.completed.push(id);
      payout.completed.push({ template: t, reward: MISSION_REWARD[t.tier] });
    }
  }
  if (!s.sweepClaimed && s.completed.length >= s.ids.length && s.ids.length > 0) {
    s.sweepClaimed = true;
    payout.sweepBonus = MISSION_SWEEP_BONUS;
  }
  payout.total = payout.completed.reduce((sum, c) => sum + c.reward, 0) + payout.sweepBonus;
  save(s);
  return payout;
};
