// v7.100.2: which finished runs post themselves to the Top 50.
import { describe, it, expect } from 'vitest';
import { qualifiesForTop50 } from '../autoPost';

const board = (n: number, low = 34_253) => Array.from({ length: n }, (_, i) => ({ score: low + i * 1000 }));

describe('auto-posting to the Top 50', () => {
  it('posts a score that beats the lowest of a full board', () => {
    expect(qualifiesForTop50(49_109, false, board(50))).toBe(true);
    expect(qualifiesForTop50(34_254, false, board(50))).toBe(true);
  });
  it("doesn't post one that wouldn't make it, unless it's a new personal best", () => {
    expect(qualifiesForTop50(18_463, false, board(50))).toBe(false);
    expect(qualifiesForTop50(34_253, false, board(50))).toBe(false);
    expect(qualifiesForTop50(18_463, true, board(50))).toBe(true);
  });
  it('posts anything while the board has room, never a zero', () => {
    expect(qualifiesForTop50(120, false, board(12))).toBe(true);
    expect(qualifiesForTop50(0, true, board(12))).toBe(false);
  });
});
