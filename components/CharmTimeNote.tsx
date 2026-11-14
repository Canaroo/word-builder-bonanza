import React from 'react';
import { CHARM_TIME_SECONDS } from '../data/charms';
import { charmTimeAt } from '../services/rules';
import { GAMEPLAY } from '../config/gameplay';

/**
 * On a time charm's card (v7.40.2): what its seconds pay at this level, once the level shrink
 * has cut them, so the "+10 seconds" in the description doesn't surprise anyone. Renders
 * nothing for other charms, or while the time still pays in full.
 */
export const charmTimeText = (charmId: string, level: number): string | null => {
    const seconds = CHARM_TIME_SECONDS[charmId];
    if (!seconds) return null;
    const { paid, percent, cut } = charmTimeAt(seconds, level);
    if (!cut) return null;
    return `🍀 LEVEL ${level}: CHARM TIME ${percent}% · +${seconds} SEC PAYS +${paid}`;
};

const CharmTimeNote: React.FC<{ charmId: string; level: number; className?: string }> = ({ charmId, level, className = '' }) => {
    const text = charmTimeText(charmId, level);
    if (!text) return null;
    return (
        <span className={`text-neon-orange ${className}`}>
            {text}
            <span className="block font-sans text-xs text-slate-400 normal-case tracking-normal leading-snug">
                Charm time shrinks {Math.round(GAMEPLAY.timeBank.bonusShrinkPerLevel * 100)}% a level (to half), and halves again above {GAMEPLAY.timeBank.overflowAbove} sec.
            </span>
        </span>
    );
};

export default CharmTimeNote;
