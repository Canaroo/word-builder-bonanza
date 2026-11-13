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
