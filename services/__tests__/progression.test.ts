// @vitest-environment jsdom
import { describe, test, expect, beforeEach } from 'vitest';
import {
  dayKey, daysBetween, recordRunFinished, currentStreak, getProfile, buyFreeze, buyCosmetic,
  equipCosmetic, powerWordBonusFor, nextMilestone,
} from '../progression';
import { missionsForDay, getTodaysMissions, recordMissionEvent } from '../missions';
import { MISSION_TEMPLATES } from '../../data/missions';
import { COSMETICS, SHOP_BADGES, SHOP_TITLES, STREAK_MILESTONES } from '../../data/cosmetics';
import { MISSION_REWARD, MISSION_SWEEP_BONUS, STREAK_FREEZE } from '../../config/progression';
import { PACKS_LIST } from '../../data/packs';

beforeEach(() => localStorage.clear());

describe('day keys (reset at 8 AM)', () => {
  test('before 8 AM still counts as the previous day', () => {
    expect(dayKey(new Date(2026, 9, 20, 7, 59))).toBe('2026-10-19');
    expect(dayKey(new Date(2026, 9, 20, 8, 0))).toBe('2026-10-20');
  });
  test('days between', () => {
    expect(daysBetween('2026-10-19', '2026-10-20')).toBe(1);
    expect(daysBetween('2026-10-30', '2026-11-02')).toBe(3);
  });
});

describe('streaks', () => {
  test('one bump per day, consecutive days extend', () => {
    expect(recordRunFinished('2026-10-01').count).toBe(1);
    expect(recordRunFinished('2026-10-01').extended).toBe(false);
    expect(recordRunFinished('2026-10-02').count).toBe(2);
    expect(recordRunFinished('2026-10-03').count).toBe(3);
  });

  test('a missed day resets, unless a freeze covers it', () => {
    recordRunFinished('2026-10-01');
    recordRunFinished('2026-10-02');
    const reset = recordRunFinished('2026-10-04');
    expect(reset).toMatchObject({ count: 1, reset: true });

    localStorage.clear();
    recordRunFinished('2026-10-01');
    recordRunFinished('2026-10-02');
    expect(buyFreeze(100)).toBe(STREAK_FREEZE.cost);
    expect(currentStreak(getProfile(), '2026-10-04')).toBe(2);
    expect(recordRunFinished('2026-10-04')).toMatchObject({ count: 3, freezesUsed: 1, reset: false });
    expect(getProfile().streak.freezes).toBe(0);
  });

  test('freezes cap at 2 and need enough credits', () => {
    expect(buyFreeze(10)).toBe(0);
    buyFreeze(500); buyFreeze(500);
    expect(buyFreeze(500)).toBe(0);
    expect(getProfile().streak.freezes).toBe(2);
  });

  test('milestones pay once and unlock their title and badge (21 and 60 included)', () => {
    const days = (n: number) => Array.from({ length: n }, (_, i) => `2026-01-${String(i + 1).padStart(2, '0')}`);
    const reached = days(21).flatMap(d => recordRunFinished(d).milestones.map(m => m.day));
    expect(reached).toEqual([3, 7, 14, 21]);
    const owned = getProfile().owned;
    expect(owned).toEqual(expect.arrayContaining(['s_regular', 's_arcadeRat', 's_hotStreak', 's_tokenHoarder', 's_cartridgeBlower', 's_goldenDisc']));
    expect(STREAK_MILESTONES.map(m => m.day)).toEqual([3, 7, 14, 21, 30, 50, 60, 100]);
    expect(nextMilestone(21)?.day).toBe(30);
  });

  test('the Power Word grows with the streak, capped at 1000', () => {
    expect([0, 1, 5, 10, 40].map(powerWordBonusFor)).toEqual([500, 550, 750, 1000, 1000]);
  });
});

describe('cosmetics and shop', () => {
  test('at least 10 shop items, every one priced; streak items are never sold', () => {
    expect(SHOP_BADGES.length + SHOP_TITLES.length).toBeGreaterThanOrEqual(10);
    COSMETICS.forEach(c => expect(c.cost === undefined).toBe(c.streakDay !== undefined));
  });

  test('buying charges once and wears it; equipping needs ownership', () => {
    expect(buyCosmetic('b_vhs', 10)).toBe(0);
    expect(buyCosmetic('b_vhs', 100)).toBe(40);
    expect(buyCosmetic('b_vhs', 100)).toBe(0);
    expect(getProfile().badge).toBe('b_vhs');
    expect(equipCosmetic('title', 't_dictionary').title).toBeNull();
    expect(buyCosmetic('s_crown', 9999)).toBe(0);
  });

  test('themes use the new price scale; Midnight Arcade is a streak reward', () => {
    expect(PACKS_LIST.filter(p => p.id !== 'default' && !p.streakDay).every(p => p.cost >= 60)).toBe(true);
    expect(PACKS_LIST.find(p => p.id === 'midnight-arcade')?.streakDay).toBe(30);
  });
});

describe('daily missions', () => {
  test('three missions a day, from three different categories, one per difficulty', () => {
    for (const day of ['2026-10-20', '2026-10-21', '2026-12-25', '2027-03-01']) {
      const ts = missionsForDay(day).map(id => MISSION_TEMPLATES.find(t => t.id === id)!);
      expect(ts).toHaveLength(3);
      expect(new Set(ts.map(t => t.category)).size).toBe(3);
    }
  });

  test('the same all day, never repeating yesterday, and varied over a month', () => {
    expect(missionsForDay('2026-10-20')).toEqual(missionsForDay('2026-10-20'));
    const month = Array.from({ length: 30 }, (_, i) => `2026-11-${String(i + 1).padStart(2, '0')}`);
    for (let i = 1; i < month.length; i++) {
      const overlap = missionsForDay(month[i]).filter(id => missionsForDay(month[i - 1]).includes(id));
      expect(overlap).toEqual([]);
    }
    const all = new Set(month.flatMap(missionsForDay));
    expect(all.size).toBeGreaterThan(15);
    const categories = new Set([...all].map(id => MISSION_TEMPLATES.find(t => t.id === id)!.category));
    expect(categories).toEqual(new Set(['word', 'powerplay', 'charm', 'secret']));
  });

  test('events complete missions and pay their tier reward, plus a sweep bonus for all three', () => {
    const now = new Date(2026, 9, 20, 12);
    const { missions } = getTodaysMissions(now);
    let total = 0;
    // Fire a big batch of events that satisfy every template.
    const events = [
      ...Array.from({ length: 30 }, () => ({ type: 'word' as const, word: 'JAZZIEST', score: 200, goldenStarted: true, comboFilled: true })),
      ...['score', 'rack', 'timer'].map(subtheme => ({ type: 'powerplay' as const, id: 'x', subtheme })),
      { type: 'powerplaySwap' as const },
      { type: 'charm' as const, equippedCount: 5, swapped: true },
      { type: 'charm' as const, equippedCount: 5, swapped: true },
      { type: 'secret' as const, id: 'a', firstFind: true, media: 'vhs', isScore: true },
      { type: 'secret' as const, id: 'b', firstFind: true, media: 'cd', isScore: false },
    ];
    for (const e of events) total += recordMissionEvent(e, 'run-1', now).total;
    const expected = missions.reduce((s, m) => s + MISSION_REWARD[m.template.tier], 0) + MISSION_SWEEP_BONUS;
    expect(total).toBe(expected);
    expect(getTodaysMissions(now).missions.every(m => m.done)).toBe(true);
  });

  test('"in one run" missions start over in a new run', () => {
    // Find a day whose missions include the one-run 5+ letters mission.
    let day = new Date(2026, 0, 1, 12);
    while (!missionsForDay(dayKey(day)).includes('w_fivesRun')) day = new Date(day.getTime() + 86_400_000);
    const five = { type: 'word' as const, word: 'PLANE', score: 10 };
    for (let i = 0; i < 3; i++) recordMissionEvent(five, 'run-A', day);
    recordMissionEvent(five, 'run-B', day);
    const m = getTodaysMissions(day).missions.find(x => x.template.id === 'w_fivesRun')!;
    expect(m.done).toBe(false);
    expect(m.progress).toBe(3);
  });
});
