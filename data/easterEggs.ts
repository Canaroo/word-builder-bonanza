// Turns the entries in data/secretBonuses.ts (the file to edit) into the game's easter eggs.
import { EasterEgg, SecretBonus } from '../types';
import { scoreTrigger } from '../services/scoreBonus';
import { SECRET_BONUSES } from './secretBonuses';

export const toEasterEgg = (b: SecretBonus): EasterEgg => {
  const word = b.word?.toUpperCase();
  return {
    id: b.id,
    name: b.name,
    description: b.description,
    word,
    scorePattern: b.score,
    trigger: b.score ? scoreTrigger(b.score) : (submitted) => submitted.toUpperCase() === word,
    // The punny clue doubles as the reveal line once the word is shown; message is the fallback.
    reward: { points: b.points, shuffle: b.shuffle, message: b.hint ?? b.message, effect: b.effect },
  };
};

export const EASTER_EGGS: EasterEgg[] = SECRET_BONUSES.map(toEasterEgg);
