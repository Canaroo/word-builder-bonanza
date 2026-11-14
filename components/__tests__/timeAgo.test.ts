// The Recent board's "how long ago" labels (v7.39.6).
import { describe, test, expect } from 'vitest';
import { timeAgo } from '../Leaderboard';

const now = Date.parse('2026-11-14T12:00:00Z');
const ago = (ms: number) => new Date(now - ms).toISOString();

describe('timeAgo', () => {
  test('minutes, hours, yesterday, days, then a date', () => {
    expect(timeAgo(ago(20 * 1000), now)).toBe('just now');
    expect(timeAgo(ago(5 * 60000), now)).toBe('5m ago');
    expect(timeAgo(ago(3 * 3600000), now)).toBe('3h ago');
    expect(timeAgo(ago(30 * 3600000), now)).toBe('yesterday');
    expect(timeAgo(ago(4 * 86400000), now)).toBe('4d ago');
    expect(timeAgo(ago(10 * 86400000), now)).not.toMatch(/ago/);
    expect(timeAgo('', now)).toBe('');
  });
});
