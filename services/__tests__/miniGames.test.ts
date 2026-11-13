// Arcade mini-games (v7.38.0): the words, and the prize math each game uses.
import { describe, test, expect } from 'vitest';
import { SECRET_BONUSES } from '../../data/secretBonuses';
import { MINI_GAMES } from '../../data/miniGames';
import { MINI_GAME_VALUES as M } from '../../config/gameplay';
import { dartPoints, dicePrize, bowlFirstBall, bowlSecondBall, bowlPrize, hoopShot, hoopsPrize, goalPrize, golfStroke, golfPrize } from '../miniGameRules';

describe('arcade words', () => {
  test('nine words open a mini-game, pay no flat points, and every game has a word', () => {
    const arcade = SECRET_BONUSES.filter(b => b.miniGame);
    expect(arcade.map(b => b.word).sort()).toEqual(['BOWL', 'CLAW', 'DART', 'DICE', 'GAME', 'GOAL', 'MOLE', 'NET', 'TEE']);
    for (const b of arcade) expect(b.points ?? 0).toBe(0);
    expect(new Set(arcade.map(b => b.miniGame)).size).toBe(Object.keys(MINI_GAMES).length);
  });
});

describe('prize math', () => {
  test('darts: bull, inner, outer, miss', () => {
    expect(dartPoints(5, 120)).toBe(M.darts.bull);
    expect(dartPoints(40, 120)).toBe(M.darts.inner);
    expect(dartPoints(100, 120)).toBe(M.darts.outer);
    expect(dartPoints(130, 120)).toBe(0);
  });
  test('dice: triple beats straight beats pair beats pips', () => {
    expect(dicePrize([4, 4, 4]).points).toBe(M.dice.triple);
    expect(dicePrize([3, 5, 4]).points).toBe(M.dice.straight);
    expect(dicePrize([2, 6, 2]).points).toBe(M.dice.pair);
    expect(dicePrize([1, 3, 6]).points).toBe(10 * M.dice.perPip);
  });
  test('bowling: a centered roll is a strike, a good spare ball clears the rest', () => {
    expect(bowlFirstBall(0.05)).toBe(10);
    const first = bowlFirstBall(0.5, () => 0.5);
    expect(first).toBeGreaterThan(0); expect(first).toBeLessThan(10);
    expect(bowlSecondBall(0.1, 4)).toBe(4);
    expect(bowlSecondBall(0.9, 4)).toBeLessThan(4);
    expect(bowlPrize(10, 0).points).toBe(M.bowl.strike);
    expect(bowlPrize(7, 3).points).toBe(M.bowl.spare);
    expect(bowlPrize(6, 2).points).toBe(8 * M.bowl.perPin);
  });
  test('free throws: swish, glass, miss, and the perfect bonus', () => {
    expect(hoopShot(0.05)).toBe('swish');
    expect(hoopShot(0.3)).toBe('bank');
    expect(hoopShot(0.8)).toBe('miss');
    expect(hoopsPrize(['swish', 'swish', 'swish'])).toBe(3 * M.hoops.swish + M.hoops.perfect);
    expect(hoopsPrize(['swish', 'bank', 'miss'])).toBe(M.hoops.swish + M.hoops.bank);
  });
  test('penalties: per goal, hat trick for all three', () => {
    expect(goalPrize(0)).toBe(0);
    expect(goalPrize(2)).toBe(2 * M.goal.perGoal);
    expect(goalPrize(3)).toBe(M.goal.hatTrick);
  });
  test('mini golf: a perfect putt drops; overshooting comes back', () => {
    expect(golfStroke(0, 100).sunk).toBe(true);
    const long = golfStroke(0, 120);
    expect(long.sunk).toBe(false);
    expect(golfStroke(long.pos, 20).sunk).toBe(true);
    expect(golfPrize(1, true)).toBe(M.golf.prizes[0]);
    expect(golfPrize(3, false)).toBe(0);
  });
});
