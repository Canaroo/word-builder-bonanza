// Arcade mini-games (v7.38.0): the words, and the prize math each game uses.
import { describe, test, expect } from 'vitest';
import { SECRET_BONUSES } from '../../data/secretBonuses';
import { MINI_GAMES } from '../../data/miniGames';
import { MINI_GAME_VALUES as M, GATES } from '../../config/gameplay';
import { GATE_PASSWORDS, GATE_ANAGRAMS, gatePassword, scramble, giveaway, BIG_ONE_WORDS, LADDER_FALLBACK } from '../../data/gates';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { dartPoints, dicePrize, bowlFirstBall, bowlSecondBall, bowlPrize, hoopShot, hoopsPrize, goalPrize, golfStroke, golfPrize, ringTossPoints, riffPrize, strikerSwing, strikerPrize, pitStopPrize, coasterRide, coasterPrize, sealPrize, montePrize,
  lureCatch, lurePrize, dialDistance, dialCombo, dialPrize, wireBomb, wirePrize, eggKind, eggPoints, leapPrize, leapHit, LEAP_FROG } from '../miniGameRules';

describe('arcade words', () => {
  test('twenty-three words open a mini-game, pay no flat points, and every game has a word', () => {
    const arcade = SECRET_BONUSES.filter(b => b.miniGame);
    expect(arcade.map(b => b.word).sort()).toEqual(['BOWL', 'CLAW', 'DART', 'DEAL', 'DIAL', 'DICE', 'GAME', 'GOAL', 'LANE', 'LEAP', 'LURE', 'MATH', 'MOLE', 'NAIL', 'NEST', 'NET', 'NOTE', 'RIDE', 'RING', 'SEAL', 'TEE', 'TIRE', 'WIRE']);
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

describe('v7.56 arcade games', () => {
  const seeded = (seed: number) => { let n = seed; return () => (n = (n * 1664525 + 1013904223) >>> 0) / 4294967296; };
  test('Gone Fishin: the quicker the tap, the bigger the fish; too soon or too late pays nothing', () => {
    expect([lureCatch(-50), lureCatch(200), lureCatch(500), lureCatch(800), lureCatch(1500)]).toEqual(['early', 'whopper', 'keeper', 'minnow', 'gone']);
    expect(lurePrize(['whopper', 'whopper', 'whopper'])).toBe(3 * M.lure.whopper + M.lure.allWhoppers);
    expect(lurePrize(['whopper', 'keeper', 'early'])).toBe(M.lure.whopper + M.lure.keeper);
  });
  test('Safecracker: the dial wraps, combos are spread out, the prize counts numbers found', () => {
    expect(dialDistance(39, 1, 40)).toBe(2);
    expect(dialDistance(10, 10, 40)).toBe(0);
    for (let i = 0; i < 200; i++) {
      const c = dialCombo(seeded(i));
      expect(c).toHaveLength(M.dial.numbers);
      for (let a = 0; a < c.length; a++) for (let b = a + 1; b < c.length; b++) expect(dialDistance(c[a], c[b])).toBeGreaterThanOrEqual(6);
    }
    expect([dialPrize(0), dialPrize(2), dialPrize(3)]).toEqual([0, 2 * M.dial.perNumber, 3 * M.dial.perNumber + M.dial.cracked]);
  });
  test('Cut the Wire: every manual line points at exactly the wire it says', () => {
    const nth = ['first', 'second', 'third', 'fourth'];
    // An independent reader of the manual: works out which wire a line means.
    const read = (wires: string[], text: string): number => {
      const W = wires.map(w => w.toUpperCase());
      let m;
      if ((m = text.match(/^Cut the (\w+) wire\.$/)) && W.includes(m[1])) return W.indexOf(m[1]);
      if ((m = text.match(/^Cut the (\w+) wire from the left\.$/))) return nth.indexOf(m[1]);
      if ((m = text.match(/^Cut the (\w+) wire from the right\.$/))) return 3 - nth.indexOf(m[1]);
      if ((m = text.match(/^Cut the wire just left of (\w+)\.$/))) return W.indexOf(m[1]) - 1;
      if ((m = text.match(/^Cut the wire just right of (\w+)\.$/))) return W.indexOf(m[1]) + 1;
      if ((m = text.match(/^Don't cut (\w+), (\w+) or (\w+)\.$/))) { const no = [m[1], m[2], m[3]]; const left = W.map((w, i) => (no.includes(w) ? -1 : i)).filter(i => i >= 0); return left.length === 1 ? left[0] : -9; }
      if ((m = text.match(/^If there's a (\w+) wire, cut it\. If not, cut the (first|last) wire\.$/))) return W.includes(m[1]) ? W.indexOf(m[1]) : m[2] === 'first' ? 0 : 3;
      return -9;
    };
    const kinds = new Set<string>();
    for (let round = 0; round < 3; round++) for (let i = 0; i < 400; i++) {
      const b = wireBomb(round, seeded(round * 1000 + i));
      expect(new Set(b.wires).size).toBe(4);
      expect(read(b.wires, b.text), `${b.wires.join(',')}: ${b.text}`).toBe(b.answer);
      kinds.add(b.text.replace(/[A-Z]{3,}|first|second|third|fourth|last/g, 'X'));
    }
    // Seven templates show up across the three bombs ("if there's a" covers both the present and the missing color).
    expect(kinds.size).toBe(7);
    expect([wirePrize(0), wirePrize(2), wirePrize(3)]).toEqual([0, 2 * M.wire.perBomb, 3 * M.wire.perBomb + M.wire.allBonus]);
  });
  test('Egg Drop: eggs, golden eggs and rotten eggs pay what the card says', () => {
    expect(eggKind(0)).toBe('golden');
    expect(eggKind(M.nest.goldenChance + 0.01)).toBe('rotten');
    expect(eggKind(0.99)).toBe('egg');
    expect([eggPoints('egg'), eggPoints('golden'), eggPoints('rotten')]).toEqual([M.nest.perEgg, M.nest.golden, -M.nest.rotten]);
  });
  test('Road Hop: lanes reached plus the across bonus; a car hits only when it overlaps the frog', () => {
    expect([leapPrize(0, false), leapPrize(3, false), leapPrize(M.leap.lanes, true)]).toEqual([0, 3 * M.leap.perLane, M.leap.lanes * M.leap.perLane + M.leap.home]);
    expect(leapHit(LEAP_FROG.x - 5, 14)).toBe(true);
    expect(leapHit(LEAP_FROG.x + LEAP_FROG.half + 1, 14)).toBe(false);
    expect(leapHit(LEAP_FROG.x - LEAP_FROG.half - 15, 14)).toBe(false);
  });
  test('the new games top out like the old ones (about 400-460)', () => {
    for (const max of [lurePrize(['whopper', 'whopper', 'whopper']), dialPrize(M.dial.numbers), wirePrize(M.wire.bombs), leapPrize(M.leap.lanes, true)]) {
      expect(max).toBeGreaterThanOrEqual(400); expect(max).toBeLessThanOrEqual(500);
    }
  });
  test('each new game has a quip on its intro card', () => {
    for (const id of ['lure', 'dial', 'wire', 'nest', 'leap'] as const) expect(MINI_GAMES[id].flavor, id).toBeTruthy();
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

import { mathProblem, mathPoints } from '../miniGameRules';
describe('MATH quiz (v7.64.0)', () => {
  const it = test;
  const seeded = (seed: number) => () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  it('deals fair problems: right answer among 4 different, non-negative choices', () => {
    for (let i = 0; i < 400; i++) {
      for (const hard of [false, true]) {
        const p = mathProblem(seeded(i + 1), hard);
        expect(p.answer).toBe(p.op === '+' ? p.a + p.b : p.a - p.b);
        expect(p.answer).toBeGreaterThanOrEqual(0);
        expect(new Set(p.choices).size).toBe(4);
        expect(p.choices).toContain(p.answer);
        expect(p.choices.every(c => c >= 0)).toBe(true);
        if (!hard) expect(p.b).toBeLessThanOrEqual(9);
        else expect(Math.max(p.a, p.b)).toBeGreaterThanOrEqual(11);
      }
    }
  });
  it('pays 60, 80, 100... for answers in a row', () => {
    expect([1, 2, 3, 6].map(mathPoints)).toEqual([60, 80, 100, 160]);
    expect([1, 2, 3, 4, 5, 6].reduce((t, k) => t + mathPoints(k), 0)).toBe(660);
  });
  it('MATH opens the quiz', () => {
    const egg = SECRET_BONUSES.find(e => e.word === 'MATH');
    expect(egg?.miniGame).toBe('math');
    expect(MINI_GAMES.math.flavor).toBeTruthy();
  });
});
