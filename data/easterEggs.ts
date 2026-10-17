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
    reward: { points: b.points, shuffle: b.shuffle, message: b.message },
  };
};

export const EASTER_EGGS: EasterEgg[] = SECRET_BONUSES.map(toEasterEgg);
