// v7.100.0: the Game Over run review is written from the run's own numbers.
import { describe, it, expect } from 'vitest';
import { runReview, reviewStars } from '../runReview';
import { CHARMS_LIST } from '../../data/charms';

const ticket = CHARMS_LIST.find(c => c.id === 'goldenTicket') ?? CHARMS_LIST[0];
const word = (w: string, score: number, bonuses: { name: string; description: string }[] = [], status = 'valid') =>
  ({ type: 'word', word: w, status, score, baseScore: score, bonuses, definition: '', cumulativeScore: 0 });

describe('run review', () => {
  it('names the charm that carried the run, the clock that ended it and the best word', () => {
    const log = [
      ...Array.from({ length: 40 }, (_, i) => word(i === 7 ? 'GRAVITY' : 'CAT', i === 7 ? 900 : 120, [{ name: ticket.name, description: '+100 pts' }])),
    ];
    const r = runReview({ log: log as any, score: 6_000, endReason: 'time', timeLedger: { words: 180, powerUps: 10, shuffles: 10, goldenRounds: 0 },
      activeCharms: [ticket] as any, availablePowerPlays: [], shuffleCount: 0 }, false);
    const text = (k: string) => r.lines.find(l => l.kind === k)?.text ?? '';
    expect(r.stars).toBe(2);
    expect(text('carried')).toContain('Charms carried you');
    expect(text('carried')).toContain(ticket.name);
    expect(text('ended')).toContain('The clock caught you on level 3');
    expect(text('ended')).toContain('90% of your time came from words');
    expect(text('tip')).toContain('Longer words buy more seconds');
    expect(text('best')).toContain('GRAVITY for 900 points on level 1');
  });

  it('blames fake words for a strikes ending and points at STUCK?', () => {
    const log = [word('CAT', 50), word('XQZ', 0, [], 'invalid'), word('QQQ', 0, [], 'invalid'), word('ZZZ', 0, [], 'invalid')];
    const r = runReview({ log: log as any, score: 50, endReason: 'strikes', challengeCount: 2 }, false);
    expect(r.lines.find(l => l.kind === 'ended')?.text).toContain('all three came from words that weren');
    expect(r.lines.find(l => l.kind === 'tip')?.text).toContain('STUCK?');
    expect(r.lines.find(l => l.kind === 'carried')?.text).toContain('Pure spelling');
  });

  it('gives a new best 5 stars and the rest by level', () => {
    expect(reviewStars(2, true)).toBe(5);
    expect([1, 3, 5, 8, 12].map(l => reviewStars(l, false))).toEqual([1, 2, 3, 4, 5]);
  });
});
