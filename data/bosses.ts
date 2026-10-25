// Boss rounds: every few levels a pop-culture villain sets a rule for the next few words.
// Land enough words that follow it (hits) to earn that boss's Boss Badge. Words that break the
// rule still score normally: a boss can only be beaten, never lost to.
// Timing and rewards live in config/gameplay.ts (BOSS); the round logic is in services/rules.ts.
import type { Tile } from '../types';
import { VOWELS } from '../constants';

export type BossTier = 'early' | 'mid' | 'late';

export interface Boss {
  /** Permanent: saved in players' Badge Cases. Never rename or remove one that has shipped. */
  id: string;
  name: string;
  icon: string;
  tier: BossTier;
  /** Where the villain is from, shown in the Badge Case. */
  source: string;
  /** Short rule for the boss banner, e.g. "NO E". */
  rule: string;
  /** The rule as a sentence, for the intro and the Badge Case. */
  description: string;
  /** The villain's line on the intro pop-up. */
  taunt: string;
  /** Does this word follow the rule? `tiles` is the whole rack, including the word's tiles. */
  check: (word: string, tiles: Tile[]) => boolean;
  /** Tiles to dim (they'd break the rule) or make glow (the rule needs them). */
  tileHint?: (tile: Tile, tiles: Tile[]) => 'dim' | 'glow' | null;
}

const vowelCount = (word: string) => [...word].filter(l => VOWELS.has(l)).length;
const noLetters = (...letters: string[]) => ({
  check: (word: string) => !letters.some(l => word.includes(l)),
  tileHint: (tile: Tile) => (letters.some(l => tile.letter.includes(l)) ? 'dim' as const : null),
});
const rarestPoints = (tiles: Tile[]) => Math.max(0, ...tiles.map(t => t.points));

export const BOSSES: Boss[] = [
  // --- Early (the first boss level) ---
  {
    id: 'mojoJojo', name: 'Mojo Jojo', icon: '🧠', tier: 'early', source: 'The Powerpuff Girls',
    rule: 'NO REPEATS', description: 'No letter can appear twice in a word.',
    taunt: 'Mojo Jojo forbids repetition! Repetition is forbidden!',
    check: word => new Set(word).size === word.length,
  },
  {
    id: 'cobraCommander', name: 'Cobra Commander', icon: '🐍', tier: 'early', source: 'G.I. Joe',
    rule: 'NO S', description: 'No S in your words.',
    taunt: 'Cobraaa! I have taken every S for myself!',
    ...noLetters('S'),
  },
  {
    id: 'kingDedede', name: 'King Dedede', icon: '🔨', tier: 'early', source: 'Kirby',
    rule: '4+ LETTERS', description: 'Every word needs at least 4 letters.',
    taunt: 'Short words? Not in MY Dream Land!',
    check: word => word.length >= 4,
  },
  {
    id: 'drWily', name: 'Dr. Wily', icon: '🤖', tier: 'early', source: 'Mega Man',
    rule: 'END ON A CONSONANT', description: 'Every word must end with a consonant.',
    taunt: 'My robots only obey words that end hard!',
    check: word => word.length > 0 && !VOWELS.has(word[word.length - 1]),
  },
  // --- Mid ---
  {
    id: 'theNoid', name: 'The Noid', icon: '🍕', tier: 'mid', source: "Domino's Pizza",
    rule: 'NO E', description: 'No E in your words.',
    taunt: 'Avoid the E!',
    ...noLetters('E'),
  },
  {
    id: 'ursula', name: 'Ursula', icon: '🐙', tier: 'mid', source: 'The Little Mermaid',
    rule: 'NO A', description: 'No A in your words.',
    taunt: 'Poor unfortunate A’s. They belong to me now.',
    ...noLetters('A'),
  },
  {
    id: 'motherBrain', name: 'Mother Brain', icon: '🧪', tier: 'mid', source: 'Metroid',
    rule: '2+ VOWELS', description: 'Every word needs at least 2 vowels (A, E, I, O, U).',
    taunt: 'Feed me vowels, bounty hunter.',
    check: word => vowelCount(word) >= 2,
  },
  {
    id: 'lordBusiness', name: 'Lord Business', icon: '👔', tier: 'mid', source: 'The LEGO Movie',
    rule: 'USE YOUR RAREST TILE', description: 'Every word must use your highest-value tile.',
    taunt: 'Everything is NOT awesome until you spend that tile.',
    check: (word, tiles) => {
      const top = rarestPoints(tiles);
      return tiles.some(t => t.points === top && word.includes(t.letter));
    },
    tileHint: (tile, tiles) => (tile.points === rarestPoints(tiles) ? 'glow' : null),
  },
  // --- Late ---
  {
    id: 'skeletor', name: 'Skeletor', icon: '💀', tier: 'late', source: 'He-Man',
    rule: 'EXACTLY 1 VOWEL', description: 'Bare-bones words: exactly 1 vowel (A, E, I, O, U).',
    taunt: 'Nyeh! Strip those words to the bone!',
    check: word => vowelCount(word) === 1,
  },
  {
    id: 'jafar', name: 'Jafar', icon: '🧞', tier: 'late', source: 'Aladdin',
    rule: 'START WITH A VOWEL', description: 'Every word must start with a vowel (A, E, I, O, U).',
    taunt: 'You will bow to the vowel!',
    check: word => VOWELS.has(word[0]),
  },
  {
    id: 'noidAndUrsula', name: 'The Noid & Ursula', icon: '🎭', tier: 'late', source: 'A villain team-up',
    rule: 'NO E OR A', description: 'No E and no A in your words.',
    taunt: 'Avoid the E! And the A’s are ours, sweetie.',
    ...noLetters('E', 'A'),
  },
  {
    id: 'bigBoss', name: 'Big Boss', icon: '🎖️', tier: 'late', source: 'Metal Gear',
    rule: '5+ LETTERS', description: 'Every word needs at least 5 letters.',
    taunt: 'Kept you waiting, huh? Go long or go home.',
    check: word => word.length >= 5,
  },
];

export const bossById = (id: string | null | undefined): Boss | undefined => BOSSES.find(b => b.id === id);

/** Which pool a boss level draws from: the first boss is early, the next two mid, then late. */
export const bossTierFor = (bossNumber: number): BossTier =>
  bossNumber <= 1 ? 'early' : bossNumber <= 3 ? 'mid' : 'late';

/** Picks a boss for the nth boss level, preferring ones not faced yet this run. */
export const pickBoss = (bossNumber: number, faced: string[] = [], rand: () => number = Math.random): Boss => {
  const pool = BOSSES.filter(b => b.tier === bossTierFor(bossNumber));
  const fresh = pool.filter(b => !faced.includes(b.id));
  const choices = fresh.length ? fresh : pool;
  return choices[Math.floor(rand() * choices.length) % choices.length];
};
