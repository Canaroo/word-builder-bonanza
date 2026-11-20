import { EASTER_EGGS } from '../data/easterEggs';
import { canBeMadeFromLetters } from './rackMatch';
import { powerWordReady } from './rules';
import type { PowerWordEffect } from '../types';

// Power word hint (v7.41): power words fired 14 times in 146 runs, so most players never met one.
// When the tiles in play can spell a power word that's ready to fire, a chip above the hand says
// so (with the effect's icon and the word's length, never the word). At most one hint a level.
// v7.54.2: a tap also gives the first letter (88 hints shown led to 3 plays without it).
export interface PowerWordHint { id: string; effect: PowerWordEffect; icon: string; length: number; /** v7.54.2: shown on tap */ first: string; /** v7.61.0: lights its tiles on tap (never shown as text) */ word: string }

const POWER_WORDS = EASTER_EGGS.filter(e => e.word && e.reward.effect);

/** The first ready power word these tile letters can spell (longest first), or null. */
export const findPowerWordHint = (
  letters: readonly string[],
  firedLevels: Record<string, number> | undefined,
  level: number,
): PowerWordHint | null => {
  const egg = [...POWER_WORDS]
    .sort((a, b) => b.word!.length - a.word!.length)
    .find(e => powerWordReady(firedLevels, e.id, level) && canBeMadeFromLetters(e.word!, letters));
  return egg ? { id: egg.id, effect: egg.reward.effect!, icon: egg.name.split(' ')[0], length: egg.word!.length, first: egg.word![0].toUpperCase(), word: egg.word!.toUpperCase() } : null;
};

/** Whether a hint given earlier this level still stands: same level, still ready, still spellable. */
export const powerWordHintStands = (
  hint: { level: number; id: string } | null | undefined,
  letters: readonly string[],
  firedLevels: Record<string, number> | undefined,
  level: number,
): PowerWordHint | null => {
  if (!hint || hint.level !== level) return null;
  const egg = POWER_WORDS.find(e => e.id === hint.id);
  if (!egg || !powerWordReady(firedLevels, egg.id, level) || !canBeMadeFromLetters(egg.word!, letters)) return null;
  return { id: egg.id, effect: egg.reward.effect!, icon: egg.name.split(' ')[0], length: egg.word!.length, first: egg.word![0].toUpperCase(), word: egg.word!.toUpperCase() };
};
