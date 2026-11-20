// Scoring for the arcade mini-games (v7.38.0). Pure, so tests can pin the prizes; the games in
// components/MiniGames.tsx handle the drawing and timing. Values in MINI_GAME_VALUES.
import { MINI_GAME_VALUES as M } from '../config/gameplay';

/** Darts: points for a dart that lands `dist` from the center of a board of radius `radius`. */
export const dartPoints = (dist: number, radius: number): number => {
    const r = dist / radius;
    return r <= 0.12 ? M.darts.bull : r <= 0.45 ? M.darts.inner : r <= 1 ? M.darts.outer : 0;
};

/** Dice: the prize for three dice. */
export const dicePrize = (dice: number[]): { points: number; label: string } => {
    const [a, b, c] = [...dice].sort((x, y) => x - y);
    if (a === c) return { points: M.dice.triple, label: 'THREE OF A KIND' };
    if (b === a + 1 && c === b + 1) return { points: M.dice.straight, label: 'STRAIGHT' };
    if (a === b || b === c) return { points: M.dice.pair, label: 'A PAIR' };
    const sum = a + b + c;
    return { points: sum * M.dice.perPip, label: `${sum} PIPS` };
};

/** Bowling: pins down on the first ball. `offset` is how far from center the aim was (0 to 1). */
export const bowlFirstBall = (offset: number, rand: () => number = Math.random): number =>
    offset <= 0.1 ? 10 : Math.max(1, Math.min(9, Math.round(10 - offset * 11 + (rand() - 0.5) * 2)));

/** Bowling: pins down on the spare ball, out of `standing`. */
export const bowlSecondBall = (offset: number, standing: number): number =>
    offset <= 0.22 ? standing : Math.max(0, Math.min(standing - 1, Math.round(standing * (1 - offset) * 0.7)));

/** Bowling: the frame's prize. */
export const bowlPrize = (first: number, second: number): { points: number; label: string } =>
    first === 10 ? { points: M.bowl.strike, label: 'STRIKE!' }
        : first + second === 10 ? { points: M.bowl.spare, label: 'SPARE!' }
        : { points: (first + second) * M.bowl.perPin, label: `${first + second} PINS` };

/** Free throws: a shot's result from how far off center the meter was (0 to 1). */
export const hoopShot = (offset: number): 'swish' | 'bank' | 'miss' => (offset <= 0.15 ? 'swish' : offset <= 0.35 ? 'bank' : 'miss');

/** Free throws: the prize for a set of shots. */
export const hoopsPrize = (shots: ('swish' | 'bank' | 'miss')[]): number =>
    shots.reduce((sum, s) => sum + (s === 'swish' ? M.hoops.swish : s === 'bank' ? M.hoops.bank : 0), 0)
    + (shots.length === M.hoops.shots && shots.every(s => s === 'swish') ? M.hoops.perfect : 0);

/** Penalties: the prize for this many goals. */
export const goalPrize = (goals: number): number => (goals >= M.goal.kicks ? M.goal.hatTrick : goals * M.goal.perGoal);

/** Mini golf: the hole's distance is 100. A stroke of `power` from `pos` lands here; it drops if it ends within the cup. */
export const GOLF_CUP = 6;
export const golfStroke = (pos: number, power: number): { pos: number; sunk: boolean } => {
    const dir = pos <= 100 ? 1 : -1;
    const next = pos + dir * power;
    return { pos: next, sunk: Math.abs(100 - next) <= GOLF_CUP };
};
/** Mini golf: the prize for sinking it in this many strokes (0 if it never dropped). */
export const golfPrize = (strokes: number, sunk: boolean): number => (sunk ? M.golf.prizes[strokes - 1] ?? 0 : 0);

// --- v7.46.0 arcade games ---

/** Ring toss: a ring that lands `dist` from the bottle (board radius `radius`): ringer, rim or near. */
export const ringTossPoints = (dist: number, radius: number): number => {
    const r = dist / radius;
    return r <= 0.14 ? M.ringToss.ringer : r <= 0.4 ? M.ringToss.rim : r <= 0.75 ? M.ringToss.near : 0;
};

/** Riff memory: the prize for clearing this many riffs. */
export const riffPrize = (cleared: number): number =>
    cleared * M.riff.perRiff + (cleared >= M.riff.lengths.length ? M.riff.allBonus : 0);

/** High striker: a swing's result from the meter position (0 to 1; 1 is full power). */
export const strikerSwing = (power: number): 'bell' | 'close' | 'low' => (power >= 0.9 ? 'bell' : power >= 0.65 ? 'close' : 'low');
export const strikerPrize = (swings: ('bell' | 'close' | 'low')[]): number =>
    swings.reduce((sum, s) => sum + (s === 'bell' ? M.striker.bell : s === 'close' ? M.striker.close : M.striker.low), 0)
    + (swings.length === M.striker.swings && swings.every(s => s === 'bell') ? M.striker.allBells : 0);

/** Pit stop: the prize for finishing in this many seconds. */
export const pitStopPrize = (seconds: number): number =>
    M.pitStop.tiers.find(t => seconds < t.under)?.points ?? M.pitStop.slow;

/** Coaster: a ride's result from the speed at release (0 to 1). The green zone clears the loop. */
export const coasterRide = (speed: number): 'clean' | 'wobbly' | 'stall' | 'flyoff' =>
    speed > 0.92 ? 'flyoff' : speed >= 0.68 && speed <= 0.82 ? 'clean' : speed >= 0.58 ? 'wobbly' : 'stall';
export const coasterPrize = (rides: ('clean' | 'wobbly' | 'stall' | 'flyoff')[]): number =>
    rides.reduce((sum, r) => sum + (r === 'clean' ? M.coaster.clean : r === 'wobbly' ? M.coaster.wobbly : 0), 0)
    + (rides.length === M.coaster.rides && rides.every(r => r === 'clean') ? M.coaster.allClean : 0);

/** Balance act: the prize for keeping the ball up this many whole seconds. */
export const sealPrize = (seconds: number): number =>
    Math.min(seconds, M.seal.seconds) * M.seal.perSecond + (seconds >= M.seal.seconds ? M.seal.fullBonus : 0);

/** Find the Lady: the prize for this many finds. */
export const montePrize = (finds: number): number => finds * M.monte.perFind + (finds >= M.monte.rounds ? M.monte.allBonus : 0);

// --- v7.56.0 arcade games ---

/** Gone Fishin' (LURE): what a tap `ms` after the bobber dipped catches (a tap before the dip spooks it). */
export type LureCatch = 'whopper' | 'keeper' | 'minnow' | 'gone' | 'early';
export const lureCatch = (ms: number): LureCatch =>
    ms < 0 ? 'early' : ms <= M.lure.whopperMs ? 'whopper' : ms <= M.lure.keeperMs ? 'keeper' : ms <= M.lure.minnowMs ? 'minnow' : 'gone';
export const lurePoints = (c: LureCatch): number => (c === 'whopper' ? M.lure.whopper : c === 'keeper' ? M.lure.keeper : c === 'minnow' ? M.lure.minnow : 0);
export const lurePrize = (catches: LureCatch[]): number =>
    catches.reduce((sum, c) => sum + lurePoints(c), 0)
    + (catches.length === M.lure.casts && catches.every(c => c === 'whopper') ? M.lure.allWhoppers : 0);

/** Safecracker (DIAL): how far apart two numbers are on a dial of `size` (it wraps: 39 is next to 0). */
export const dialDistance = (a: number, b: number, size: number = M.dial.size): number => {
    const d = Math.abs(((a % size) + size) % size - (((b % size) + size) % size));
    return Math.min(d, size - d);
};
/** A combination of distinct numbers, each at least 6 apart so the glow never points at two at once. */
export const dialCombo = (rand: () => number = Math.random): number[] => {
    const combo: number[] = [];
    while (combo.length < M.dial.numbers) {
        const n = Math.floor(rand() * M.dial.size);
        if (combo.every(c => dialDistance(c, n) >= 6)) combo.push(n);
    }
    return combo;
};
export const dialPrize = (found: number): number => found * M.dial.perNumber + (found >= M.dial.numbers ? M.dial.cracked : 0);

/** Cut the Wire (WIRE): a bomb's four wires and the manual's one-line rule, harder each bomb. */
export const WIRE_COLORS = ['red', 'blue', 'green', 'yellow', 'white'] as const;
export type WireColor = typeof WIRE_COLORS[number];
export interface WireBomb { wires: WireColor[]; text: string; answer: number }
const NTH = ['first', 'second', 'third', 'fourth'];
const up = (c: string) => c.toUpperCase();
export const wireBomb = (round: number, rand: () => number = Math.random): WireBomb => {
    const pool = [...WIRE_COLORS];
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const wires = pool.slice(0, 4) as WireColor[];
    const missing = pool[4] as WireColor;
    const pick = <T,>(xs: T[]): T => xs[Math.floor(rand() * xs.length)];
    const kinds = round <= 0 ? ['color', 'fromLeft'] : round === 1 ? ['leftOf', 'rightOf', 'fromRight'] : ['notThese', 'ifThere', 'ifNot'];
    const kind = pick(kinds);
    if (kind === 'color') { const a = Math.floor(rand() * 4); return { wires, text: `Cut the ${up(wires[a])} wire.`, answer: a }; }
    if (kind === 'fromLeft') { const a = Math.floor(rand() * 4); return { wires, text: `Cut the ${NTH[a]} wire from the left.`, answer: a }; }
    if (kind === 'fromRight') { const a = Math.floor(rand() * 4); return { wires, text: `Cut the ${NTH[3 - a]} wire from the right.`, answer: a }; }
    if (kind === 'leftOf') { const a = Math.floor(rand() * 3); return { wires, text: `Cut the wire just left of ${up(wires[a + 1])}.`, answer: a }; }
    if (kind === 'rightOf') { const a = 1 + Math.floor(rand() * 3); return { wires, text: `Cut the wire just right of ${up(wires[a - 1])}.`, answer: a }; }
    if (kind === 'notThese') {
        const a = Math.floor(rand() * 4);
        const others = wires.filter((_, i) => i !== a).map(up);
        return { wires, text: `Don't cut ${others[0]}, ${others[1]} or ${others[2]}.`, answer: a };
    }
    // ifThere: the named color is on the bomb, so cut it. ifNot: it's the missing color, so the fallback applies.
    const last = rand() < 0.5;
    if (kind === 'ifThere') {
        const a = Math.floor(rand() * 4);
        return { wires, text: `If there's a ${up(wires[a])} wire, cut it. If not, cut the ${last ? 'last' : 'first'} wire.`, answer: a };
    }
    return { wires, text: `If there's a ${up(missing)} wire, cut it. If not, cut the ${last ? 'last' : 'first'} wire.`, answer: last ? 3 : 0 };
};
export const wirePrize = (defused: number): number => defused * M.wire.perBomb + (defused >= M.wire.bombs ? M.wire.allBonus : 0);

/** Egg Drop (NEST): what an egg is worth when it lands in the nest. */
export type EggKind = 'egg' | 'golden' | 'rotten';
export const eggPoints = (k: EggKind): number => (k === 'golden' ? M.nest.golden : k === 'rotten' ? -M.nest.rotten : M.nest.perEgg);
export const eggKind = (r: number): EggKind => (r < M.nest.goldenChance ? 'golden' : r < M.nest.goldenChance + M.nest.rottenChance ? 'rotten' : 'egg');

/** Road Hop (LEAP): the prize for the furthest lane reached, plus the bonus for making it across. */
export const leapPrize = (best: number, home: boolean): number =>
    Math.min(best, M.leap.lanes) * M.leap.perLane + (home ? M.leap.home : 0);
/** Road Hop: does a car spanning [carX, carX + carW] (percent of the road) hit the frog at the middle? */
export const LEAP_FROG = { x: 50, half: 4.5 };
export const leapHit = (carX: number, carW: number): boolean => carX < LEAP_FROG.x + LEAP_FROG.half && carX + carW > LEAP_FROG.x - LEAP_FROG.half;

/**
 * MATH (v7.64.0): one quiz problem with 4 answer choices. Easy problems use single digits (7 + 5,
 * 14 - 6); hard ones two digits (34 + 27, 63 - 18). Answers are never negative. `rand` is 0..1.
 */
export interface MathProblem { a: number; b: number; op: '+' | '-'; answer: number; choices: number[] }
export const mathProblem = (rand: () => number, hard: boolean): MathProblem => {
    const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
    const op: '+' | '-' = rand() < 0.5 ? '+' : '-';
    let a: number, b: number;
    if (!hard) {
        if (op === '+') { a = int(2, 9); b = int(2, 9); } else { a = int(6, 18); b = int(2, Math.min(9, a - 1)); }
    } else if (op === '+') { a = int(11, 49); b = int(11, 49); } else { a = int(30, 99); b = int(11, a - 11); }
    const answer = op === '+' ? a + b : a - b;
    // Near misses players actually make: off by one or two, or by ten (a carry or a borrow).
    const near = hard ? [1, -1, 10, -10, 2, -2, 11, -9] : [1, -1, 2, -2, 3, -3];
    const choices = new Set<number>([answer]);
    for (const d of [...near].sort(() => rand() - 0.5)) {
        if (choices.size >= 4) break;
        if (answer + d >= 0) choices.add(answer + d);
    }
    for (let d = 4; choices.size < 4; d++) choices.add(answer + d);
    return { a, b, op, answer, choices: [...choices].sort(() => rand() - 0.5) };
};
/** MATH: what the Nth right answer in a row pays (1 = first in a row). */
export const mathPoints = (streak: number): number => M.math.perRight + M.math.streakStep * Math.max(0, streak - 1);

/**
 * Are You Smarter Than a 5th Grader? (v7.65.0): a times-tables problem with 4 choices. Easy uses
 * the 2-9 tables, hard goes up to 12. Wrong choices are classic slips: one row off (± a or ± b) or
 * one off the answer.
 */
export interface TimesProblem { a: number; b: number; answer: number; choices: number[] }
export const timesProblem = (rand: () => number, hard: boolean): TimesProblem => {
    const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
    const a = int(2, hard ? 12 : 9), b = int(2, hard ? 12 : 9);
    const answer = a * b;
    const choices = new Set<number>([answer]);
    for (const d of [a, -a, b, -b, 1, -1, 2, -2, 10, -10].sort(() => rand() - 0.5)) {
        if (choices.size >= 4) break;
        if (answer + d > 0) choices.add(answer + d);
    }
    for (let d = 3; choices.size < 4; d++) choices.add(answer + d);
    return { a, b, answer, choices: [...choices].sort(() => rand() - 0.5) };
};
