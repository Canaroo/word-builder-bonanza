import { describe, it, expect } from 'vitest';
import { tallyLines } from '../../services/screens/GameScreenView';

describe('score count-up lines (v7.94.0)', () => {
  it('reads points, multipliers and seconds, and skips labels', () => {
    const out = tallyLines([
      { name: 'Length Bonus', d: 'x1.5 (5 letters)' },
      { name: 'Rubik\'s Cube', d: '+60 pts' },
      { name: 'Hammer Time', d: '-10 pts' },
      { name: 'Sands of Time!', d: '+5s next round' },
      { name: 'Space Invader (Miss)', d: 'Capped at 50 pts' },
      { name: 'Ice', d: 'Value set to 15' },
    ]);
    expect(out.map(l => l.chip)).toEqual(['x1.5', '+60', '−10', '+5 sec']);
    expect(out.map(l => l.tone)).toEqual(['mult', 'pts', 'neg', 'sec']);
  });
  it('handles no lines', () => { expect(tallyLines()).toEqual([]); });
});
