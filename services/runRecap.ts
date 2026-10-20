// End-of-run recap: what to show on the game-over screen and the shareable summary.
import { SECRET_BONUSES } from '../data/secretBonuses';
import { getBonusMedia, BonusMediaType } from '../data/bonusMedia';
import { hintFor } from './collection';
import type { EasterEgg, FinalGameState } from '../types';

export const MEDIA_ICON: Record<BonusMediaType, string> = { vhs: '📼', cartridge: '🎮', cd: '💿', arcade: '🕹️' };

export interface RunRecap {
    /** Secret bonuses found for the first time ever during this run. */
    newSecretIds: string[];
    collection: { found: number; total: number };
    /** Best score before this run (0 if none). */
    previousBest: number;
    /** A clue for a bonus not yet collected, or null when the collection is complete. */
    nextHint: string | null;
}

/** Picks a clue for one uncollected bonus; `pick` chooses the index (random by default). */
export const pickNextHint = (collectedIds: ReadonlySet<string>, pick = (n: number) => Math.floor(Math.random() * n)): string | null => {
    const missing = SECRET_BONUSES.filter(b => !collectedIds.has(b.id));
    return missing.length ? hintFor(missing[pick(missing.length)]) : null;
};

export const secretIcon = (egg: Pick<EasterEgg, 'id'>) => MEDIA_ICON[getBonusMedia(egg.id).media];

/** The short text players can share, ending with the game's link. */
export const buildShareText = (
    game: Pick<FinalGameState, 'score' | 'highestScoringWord' | 'foundEasterEggs'>, recap: RunRecap, isNewBest: boolean, url: string,
    flair: { streak?: number; title?: string; badge?: string } = {},
): string => {
    const lines = [`WORD NERD 🕹️ ${game.score.toLocaleString('en-US')} pts`];
    const who = [flair.badge, flair.title].filter(Boolean).join(' ');
    if (who || flair.streak) lines.push([who, flair.streak ? `🔥 ${flair.streak}-day streak` : ''].filter(Boolean).join(' · '));
    if (isNewBest) lines.push('★ New personal best!');
    if (game.highestScoringWord) {
        lines.push(`🏆 Top word: ${game.highestScoringWord.word.toUpperCase()} (${game.highestScoringWord.score.toLocaleString('en-US')})`);
    }
    const secrets = game.foundEasterEggs.length;
    const icons = game.foundEasterEggs.slice(0, 8).map(secretIcon).join('');
    lines.push(`${secrets ? `${icons} ${secrets} secret${secrets === 1 ? '' : 's'}` : '🔒 No secrets this time'} · ${recap.collection.found}/${recap.collection.total} collected`);
    lines.push(url);
    return lines.join('\n');
};
