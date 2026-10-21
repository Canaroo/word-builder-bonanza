// Sanity checks for the editable bonus lists (data/secretBonuses.ts, data/wordBonuses.ts).
// Run by the build (npm run check:bonuses) so a bad edit never goes live, and by the
// bonus gallery (/?bonuses) to badge each entry.
import type { SecretBonus, WordBonus } from '../types';

export interface BonusProblem {
    id: string;
    problem: string;
}

export interface WordLists {
    /** Every valid word, lowercase. */
    words: ReadonlySet<string>;
    /** Blocked words, lowercase. */
    blocked: ReadonlySet<string>;
}

const MEDIA = ['vhs', 'cartridge', 'cd', 'arcade'];
const SCORE_KINDS = ['contains', 'endsWith', 'equals', 'over'];
const MIN_WORD_LENGTH = 3;

/** Problems with a bonus word alone (letters, dictionary, blocked list). */
export const checkBonusWord = (word: string, lists?: WordLists): string[] => {
    const lower = word.toLowerCase();
    if (!/^[a-z]+$/.test(lower)) return [`word "${word}" must be letters only`];
    if (lower.length < MIN_WORD_LENGTH) return [`word "${word}" is shorter than ${MIN_WORD_LENGTH} letters, so it can't be played`];
    if (!lists) return [];
    if (lists.blocked.has(lower)) return [`word "${word}" is in words/blocked.txt, so it can never be played`];
    if (!lists.words.has(lower)) return [`word "${word}" isn't in the dictionary; add it to words/custom.txt if it should count`];
    return [];
};

/**
 * Finds mistakes in the bonus lists. Pass the word lists to also check each bonus word
 * against the dictionary and words/blocked.txt.
 */
export const checkBonuses = (
    secret: readonly SecretBonus[],
    wordCount: readonly WordBonus[],
    lists?: WordLists,
): BonusProblem[] => {
    const problems: BonusProblem[] = [];
    const add = (id: string, problem: string) => problems.push({ id: id || '(missing id)', problem });
    const ids = new Set<string>();
    const words = new Map<string, string>();
    const scores = new Map<string, string>();

    const checkId = (id: string) => {
        if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(id ?? '')) add(id, 'id must be letters and digits, like heroOfHyrule');
        if (ids.has(id)) add(id, 'id is used more than once');
        ids.add(id);
    };

    for (const b of secret) {
        checkId(b.id);
        if (!b.name?.trim()) add(b.id, 'name is empty');
        if (!b.message?.trim()) add(b.id, 'message is empty');
        if (b.hint !== undefined && !b.hint.trim()) add(b.id, 'hint is empty; remove it to use the automatic hint');
        if (b.hint && b.word && /^[a-z]+$/i.test(b.word) && new RegExp(`\\b${b.word}\\b`, 'i').test(b.hint)) add(b.id, `hint gives away the word "${b.word}"`);
        if (b.hint && b.score?.digits && b.hint.includes(b.score.digits)) add(b.id, `hint gives away the score ${b.score.digits}`);
        if (!b.points && !b.shuffle) add(b.id, 'needs a reward: points, shuffle, or both');
        if (b.points !== undefined && !(Number.isInteger(b.points) && b.points >= 0)) add(b.id, 'points must be a whole number');
        if (b.shuffle !== undefined && !(Number.isInteger(b.shuffle) && b.shuffle >= 0)) add(b.id, 'shuffle must be a whole number');
        if (b.media !== undefined && !MEDIA.includes(b.media)) add(b.id, `media must be one of ${MEDIA.join(', ')}`);
        if (b.media && b.media !== 'arcade' && !b.source?.trim()) add(b.id, `media "${b.media}" needs a source to print on the label`);

        if (!!b.word === !!b.score) {
            add(b.id, 'needs exactly one trigger: word or score');
            continue;
        }
        if (b.word) {
            checkBonusWord(b.word, lists).forEach(p => add(b.id, p));
            const key = b.word.toLowerCase();
            if (words.has(key)) add(b.id, `word "${b.word}" is already used by ${words.get(key)}`);
            else words.set(key, b.id);
        } else if (b.score) {
            if (!SCORE_KINDS.includes(b.score.kind)) add(b.id, `score kind must be one of ${SCORE_KINDS.join(', ')}`);
            if (!/^[1-9][0-9]*$/.test(b.score.digits ?? '')) add(b.id, 'score digits must be a number like "42" (no leading zero)');
            const key = `${b.score.kind}:${b.score.digits}`;
            if (scores.has(key)) add(b.id, `same score trigger as ${scores.get(key)}`);
            else scores.set(key, b.id);
        }
    }

    const counts = new Map<number, string>();
    for (const w of wordCount) {
        checkId(w.id);
        if (!w.title?.trim()) add(w.id, 'title is empty');
        if (!w.description?.trim()) add(w.id, 'description is empty');
        if (!(Number.isInteger(w.wordCount) && w.wordCount > 0)) add(w.id, 'wordCount must be a whole number above 0');
        if (!(Number.isInteger(w.reward?.points) && w.reward.points > 0)) add(w.id, 'reward points must be a whole number above 0');
        if (counts.has(w.wordCount)) add(w.id, `wordCount ${w.wordCount} is already used by ${counts.get(w.wordCount)}`);
        else counts.set(w.wordCount, w.id);
    }

    return problems;
};

export const formatProblems = (problems: readonly BonusProblem[]): string =>
    problems.map(p => `  - ${p.id}: ${p.problem}`).join('\n');
