// Arcade mini-games (v7.38.0): the words, and the prize math each game uses.
import { describe, test, expect } from 'vitest';
import { SECRET_BONUSES } from '../../data/secretBonuses';
import { MINI_GAMES } from '../../data/miniGames';
import { MINI_GAME_VALUES as M, GATES } from '../../config/gameplay';
import { GATE_PASSWORDS, GATE_ANAGRAMS, gatePassword, scramble, giveaway, BIG_ONE_WORDS, LADDER_FALLBACK } from '../../data/gates';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { dartPoints, dicePrize, bowlFirstBall, bowlSecondBall, bowlPrize, hoopShot, hoopsPrize, goalPrize, golfStroke, golfPrize, ringTossPoints, riffPrize, strikerSwing, strikerPrize, pitStopPrize, coasterRide, coasterPrize, sealPrize, montePrize } from '../miniGameRules';

describe('arcade words', () => {
  test('seventeen words open a mini-game, pay no flat points, and every game has a word', () => {
    const arcade = SECRET_BONUSES.filter(b => b.miniGame);
    expect(arcade.map(b => b.word).sort()).toEqual(['BOWL', 'CLAW', 'DART', 'DEAL', 'DICE', 'GAME', 'GOAL', 'LANE', 'MOLE', 'NAIL', 'NET', 'NOTE', 'RIDE', 'RING', 'SEAL', 'TEE', 'TIRE']);
    for (const b of arcade) expect(b.points ?? 0).toBe(0);
    // Every arcade game has a word (LANE shares Bowling with BOWL); the two gate games open by score instead.
    const games = new Set(arcade.map(b => b.miniGame));
    for (const id of Object.keys(MINI_GAMES)) if (!['password', 'bonusStage', 'ladder', 'bigOne'].includes(id)) expect(games.has(id as any), id).toBe(true);
    expect(arcade.filter(b => b.miniGame === 'bowl').map(b => b.word).sort()).toEqual(['BOWL', 'LANE']);
  });

  test('v7.46 games pay what their cards say', () => {
    const V = M;
    expect(ringTossPoints(0, 100)).toBe(V.ringToss.ringer);
    expect(ringTossPoints(30, 100)).toBe(V.ringToss.rim);
    expect(ringTossPoints(60, 100)).toBe(V.ringToss.near);
    expect(ringTossPoints(90, 100)).toBe(0);
    expect(riffPrize(0)).toBe(0);
    expect(riffPrize(2)).toBe(2 * V.riff.perRiff);
    expect(riffPrize(V.riff.lengths.length)).toBe(V.riff.lengths.length * V.riff.perRiff + V.riff.allBonus);
    expect([strikerSwing(0.95), strikerSwing(0.7), strikerSwing(0.2)]).toEqual(['bell', 'close', 'low']);
    expect(strikerPrize(['bell', 'bell', 'bell'])).toBe(3 * V.striker.bell + V.striker.allBells);
    expect(strikerPrize(['bell', 'close', 'low'])).toBe(V.striker.bell + V.striker.close + V.striker.low);
    expect([pitStopPrize(3), pitStopPrize(4), pitStopPrize(6), pitStopPrize(9)]).toEqual([300, 200, 100, V.pitStop.slow]);
    expect([coasterRide(0.75), coasterRide(0.6), coasterRide(0.86), coasterRide(0.3), coasterRide(0.97)]).toEqual(['clean', 'wobbly', 'wobbly', 'stall', 'flyoff']);
    expect(coasterPrize(['clean', 'clean', 'clean'])).toBe(3 * V.coaster.clean + V.coaster.allClean);
    expect(coasterPrize(['clean', 'stall', 'flyoff'])).toBe(V.coaster.clean);
    expect([sealPrize(0), sealPrize(4), sealPrize(V.seal.seconds)]).toEqual([0, 4 * V.seal.perSecond, V.seal.seconds * V.seal.perSecond + V.seal.fullBonus]);
    expect([montePrize(0), montePrize(2), montePrize(3)]).toEqual([0, 200, 400]);
    // The new games top out around the old ones (300-600).
    for (const max of [3 * V.ringToss.ringer, riffPrize(4), strikerPrize(['bell', 'bell', 'bell']), 300, coasterPrize(['clean', 'clean', 'clean']), sealPrize(10), montePrize(3)]) {
      expect(max).toBeGreaterThanOrEqual(300); expect(max).toBeLessThanOrEqual(600);
    }
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

describe('score gates (v7.39.0)', () => {
  test('gates sit at 10,000 and 30,000 and pay what the card says', () => {
    expect(GATES.password.score).toBe(10000);
    expect(GATES.bonusStage.score).toBe(30000);
    expect(MINI_GAMES.password.prize).toContain('1,000');
  });
  test('passwords are 6 letters, and the Daily Run picks the same one for everyone', () => {
    for (const w of GATE_PASSWORDS) expect(w).toMatch(/^[A-Z]{6}$/);
    expect(gatePassword({ dailyKey: '2026-11-14' })).toBe(gatePassword({ dailyKey: '2026-11-14' }));
    expect(GATE_PASSWORDS).toContain(gatePassword({}, () => 0.5));
  });
  test('a player never gets a password they had recently: the whole list comes round first (v7.39.3)', () => {
    const recent: string[] = [];
    for (let i = 0; i < GATE_PASSWORDS.length; i++) {
      const pick = gatePassword({ recent });
      expect(recent).not.toContain(pick);
      recent.push(pick);
    }
    expect(new Set(recent).size).toBe(GATE_PASSWORDS.length);
    // Once all have been seen, it still picks one (the list starts over).
    expect(GATE_PASSWORDS).toContain(gatePassword({ recent }));
  });
  test('no password is a secret bonus word (solving it in the gate would hide the secret)', () => {
    const secretWords = new Set(SECRET_BONUSES.map(b => b.word?.toUpperCase()).filter(Boolean));
    for (const w of GATE_PASSWORDS) expect(secretWords.has(w)).toBe(false);
    expect(new Set(GATE_PASSWORDS).size).toBe(GATE_PASSWORDS.length);
  });
  test('the list of other answers matches the dictionary', () => {
    const six = readFileSync(resolve(__dirname, '../../public/words/wordlist.txt'), 'utf8').split(/\s+/).filter(w => w.length === 6);
    const byLetters = new Map<string, string[]>();
    for (const w of six) { const k = [...w].sort().join(''); byLetters.set(k, [...(byLetters.get(k) ?? []), w.toUpperCase()]); }
    const expected: Record<string, string[]> = {};
    for (const w of GATE_PASSWORDS) {
      const others = (byLetters.get([...w.toLowerCase()].sort().join('')) ?? []).filter(a => a !== w).sort();
      if (others.length) expected[w] = others;
    }
    expect(GATE_ANAGRAMS, 'update GATE_ANAGRAMS in data/gates.ts').toEqual(expected);
  });
  test('the scramble never spells the password or any other word that opens the gate, and gives little away', () => {
    let n = 7; const rand = () => (n = (n * 1664525 + 1013904223) >>> 0) / 4294967296;
    for (const w of GATE_PASSWORDS) {
      const answers = [w, ...(GATE_ANAGRAMS[w] ?? [])];
      for (let i = 0; i < 300; i++) {
        const s = scramble(w, rand).join('');
        expect([...s].sort().join('')).toBe([...w].sort().join(''));
        expect(answers, `${w} dealt as ${s}`).not.toContain(s);
        // The password itself: at most one letter left in place and no 3-letter run, unless its
        // repeated letters make that impossible (BANANA, COFFEE and friends).
        if (new Set(w).size === w.length) expect(giveaway(s, w), `${w} dealt as ${s}`).toBeLessThanOrEqual(2);
        // Never a near-spelling of any answer: at most two letters in place and one short run.
        for (const a of answers) expect(giveaway(s, a), `${w} dealt as ${s}, close to ${a}`).toBeLessThanOrEqual(7);
      }
    }
  });
  test('giveaway counts letters in place and runs kept', () => {
    expect(giveaway('PLANET', 'PLANET')).toBe(6 * 2 + 4 * 3);
    expect(giveaway('TENALP', 'PLANET')).toBe(0);
    expect(giveaway('ETPLAN', 'PLANET')).toBe(6); // PLA and LAN survive
  });

  test('the scramble uses the same letters and never shows the answer', () => {
    for (const w of GATE_PASSWORDS) {
      const s = scramble(w);
      expect([...s].sort().join('')).toBe([...w].sort().join(''));
      expect(s.join('')).not.toBe(w);
    }
  });
});

describe('the 50,000 and 70,000 gates (v7.49)', () => {
  const common = new Set(readFileSync(resolve(__dirname, '../../public/words/common.txt'), 'utf8').split(/\s+/));
  const secret = new Set(SECRET_BONUSES.map(b => b.word?.toUpperCase()).filter(Boolean));
  test('gates come in order and pay points, never time', () => {
    const scores = [GATES.password.score, GATES.bonusStage.score, GATES.ladder.score, GATES.bigOne.score];
    expect(scores).toEqual([10000, 30000, 50000, 70000]);
    expect(GATES.ladder.pots).toEqual([250, 500, 1000, 2000, 4000, 8000]);
    expect(GATES.ladder.rungs).toHaveLength(GATES.ladder.pots.length);
    for (let i = 1; i < GATES.ladder.pots.length; i++) expect(GATES.ladder.pots[i]).toBe(GATES.ladder.pots[i - 1] * 2);
    expect([GATES.bigOne.prizes[6], GATES.bigOne.prizes[7], GATES.bigOne.prizes[8]]).toEqual([1000, 2500, 5000]);
  });
  test('the Big One deals everyday 8-letter words; the ladder has a word for every rung', () => {
    expect(BIG_ONE_WORDS.length).toBeGreaterThanOrEqual(60);
    for (const w of BIG_ONE_WORDS) {
      expect(w, w).toHaveLength(8);
      expect(common.has(w.toLowerCase()), w).toBe(true);
      expect(secret.has(w), w).toBe(false);
    }
    expect(new Set(BIG_ONE_WORDS).size).toBe(BIG_ONE_WORDS.length);
    for (const n of GATES.ladder.rungs) for (const w of LADDER_FALLBACK[n]) { expect(w.length).toBe(n); expect(common.has(w.toLowerCase()), w).toBe(true); }
  });
});
