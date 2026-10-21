// Score-number secret bonuses ("score contains 42", "ends in 69", "exactly 456", "over 9000").
// The pattern drives both the trigger and the explanation shown to the player, so they always agree.
import type { GameState } from '../types';

export interface ScorePattern {
    /** 'over' fires once the score passes the number (the whole score lights up). */
    kind: 'contains' | 'endsWith' | 'equals' | 'over';
    digits: string;
}

export interface ScoreMatch {
    before: string;
    match: string;
    after: string;
}

/** Splits the score around the matching digits, or returns null if it doesn't match. */
export const matchScorePattern = (score: number, { kind, digits }: ScorePattern): ScoreMatch | null => {
    if (score <= 0) return null;
    const s = String(score);
    if (kind === 'over') return score > Number(digits) ? { before: '', match: s, after: '' } : null;
    const at = kind === 'equals' ? (s === digits ? 0 : -1)
        : kind === 'endsWith' ? (s.endsWith(digits) ? s.length - digits.length : -1)
        : s.indexOf(digits);
    if (at < 0) return null;
    return { before: s.slice(0, at), match: digits, after: s.slice(at + digits.length) };
};

/** An EasterEgg trigger built from a pattern. */
export const scoreTrigger = (pattern: ScorePattern) =>
    (_word: string, score: number, _state?: GameState): boolean => matchScorePattern(score, pattern) !== null;

/** "Your score hit 742, which contains 42." */
export const explainScoreBonus = (score: number, { kind, digits }: ScorePattern): string => {
    const shown = score.toLocaleString();
    if (kind === 'equals') return `Your score hit exactly ${shown}.`;
    if (kind === 'endsWith') return `Your score hit ${shown}, which ends in ${digits}.`;
    if (kind === 'over') return `Your score hit ${shown}, over ${Number(digits).toLocaleString()}!`;
    return `Your score hit ${shown}, which contains ${digits}.`;
};

/** A sample score for previews (the Bonus Vault). */
export const exampleScore = ({ kind, digits }: ScorePattern): number =>
    kind === 'over' ? Number(digits) + 1
        : Number(kind === 'equals' ? digits : kind === 'endsWith' ? `1${digits}` : `7${digits}`);
