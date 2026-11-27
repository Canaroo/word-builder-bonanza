// v7.99.0: 🏆 Daily Champ: the top score on each finished Daily board wins it, ties all win.
import { describe, it, expect } from 'vitest';
import { championsByDay, winsByName, unseenWins, champKey } from '../dailyChamps';

const boards = {
  '2026-11-26': { a: { name: 'Nicole', score: 50000 } },                                  // before firstDay: ignored
  '2026-11-27': { a: { name: 'Julian', score: 27051 }, b: { name: 'Nicole', score: 19042 } },
  '2026-11-28': { a: { name: 'Dad', score: 9000 }, b: { name: 'nicole ', score: 9000 }, c: { name: 'Bobby', score: 10 } }, // a tie
  '2026-11-29': { a: { name: 'Julian', score: 100 }, b: { name: 'Bad', score: 'lots' }, c: { score: 999999 } },          // junk rows skipped
  '2026-11-30': { a: { name: 'Bobby', score: 70000 } },                                    // today: not finished
};

describe('Daily Champ', () => {
  const champs = championsByDay(boards as any, '2026-11-30', '2026-11-27');
  it('counts finished days from the first day on, top score wins, ties all win', () => {
    expect(champs).toEqual({ '2026-11-27': ['Julian'], '2026-11-28': ['Dad', 'nicole'], '2026-11-29': ['Julian'] });
  });
  it('totals wins by name in any case', () => {
    const wins = winsByName(champs);
    expect(wins[champKey('julian')]).toBe(2);
    expect(wins[champKey('NICOLE')]).toBe(1);
    expect(wins[champKey('Bobby')]).toBeUndefined();
  });
  it('lists the wins a player has not celebrated yet', () => {
    expect(unseenWins(champs, 'Julian', [])).toEqual(['2026-11-27', '2026-11-29']);
    expect(unseenWins(champs, 'Julian', ['2026-11-27'])).toEqual(['2026-11-29']);
    expect(unseenWins(champs, 'Nicole', [])).toEqual(['2026-11-28']);
  });
});
