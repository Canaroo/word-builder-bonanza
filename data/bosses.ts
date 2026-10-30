// Boss rounds: every few levels a pop-culture villain sets a rule for the next few words.
// Land enough words that follow it (hits) to earn that boss's Boss Badge. Words that break the
// rule still score normally: a boss can only be beaten, never lost to.
// Timing and rewards live in config/gameplay.ts (BOSS); the round logic is in services/rules.ts.
import type { Tile } from '../types';
import { VOWELS } from '../constants';

export type BossTier = 'early' | 'mid' | 'late';

/** What a rule can look at besides the word: your last valid word, and scores. */
export interface BossContext {
  /** Your last valid word before this one, uppercase ('' if none). */
  last: string;
  /** This word's score. */
  score: number;
  /** Your last valid word's score (0 if none). */
  lastScore: number;
}

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
  check: (word: string, tiles: Tile[], ctx: BossContext) => boolean;
  /** Tiles to dim (they'd break the rule) or make glow (the rule needs them). */
  tileHint?: (tile: Tile, tiles: Tile[], ctx: BossContext) => 'dim' | 'glow' | null;
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

  // --- v7.15 roster: letter, shape, score and chain rules ---
  {
    id: 'oogieBoogie', name: 'Oogie Boogie', icon: '🎃', tier: 'early', source: 'The Nightmare Before Christmas',
    rule: 'NO O', description: 'No O in your words.',
    taunt: "Well, well, well, what have we here? Every O belongs to the Boogie Man now!",
    ...noLetters('O'),
  },
  {
    id: 'gargamel', name: 'Gargamel', icon: '🧙', tier: 'early', source: 'The Smurfs',
    rule: 'NO T OR N', description: 'No T and no N in your words.',
    taunt: "I'll get those Smurfs if it's the last thing I do... and every T and N with them!",
    ...noLetters('T', 'N'),
  },
  {
    id: 'kingHippo', name: 'King Hippo', icon: '🥊', tier: 'early', source: 'Punch-Out!!',
    rule: 'SCORE 8+', description: 'Every word must score 8 or more points.',
    taunt: "Light jabs won't do. Hit me with 8 points or more!",
    check: (word, tiles, ctx) => ctx.score >= 8,
  },
  {
    id: 'doctorDoom', name: 'Doctor Doom', icon: '🟢', tier: 'early', source: 'Fantastic Four',
    rule: 'EXACTLY 4 LETTERS', description: 'Every word must be exactly 4 letters, like DOOM.',
    taunt: 'Doom speaks in four letters. So will you.',
    check: word => word.length === 4,
  },
  {
    id: 'hades', name: 'Hades', icon: '🔥', tier: 'mid', source: 'Hercules',
    rule: 'USE A 3+ POINT TILE', description: 'Every word must use a tile worth 3 or more points.',
    taunt: "Name's Hades, Lord of the Dead. Bring me your heavy hitters, babe.",
    check: (word, tiles) => tiles.some(t => t.points >= 3 && word.includes(t.letter)),
    tileHint: tile => (tile.points >= 3 ? 'glow' : null),
  },
  {
    id: 'cruella', name: 'Cruella de Vil', icon: '🐾', tier: 'mid', source: '101 Dalmatians',
    rule: 'END IN A VOWEL', description: 'Every word must end with a vowel (A, E, I, O, U), like CRUELLA.',
    taunt: 'Darling, every word must end in a vowel. Ninety-nine puppies is simply not enough.',
    check: word => VOWELS.has(word[word.length - 1]),
  },
  {
    id: 'sephiroth', name: 'Sephiroth', icon: '🗡️', tier: 'mid', source: 'Final Fantasy VII',
    rule: 'SCORE 10+', description: 'Every word must score 10 or more points.',
    taunt: 'Ten points or nothing. Kneel before the One-Winged Angel.',
    check: (word, tiles, ctx) => ctx.score >= 10,
  },
  {
    id: 'magneto', name: 'Magneto', icon: '🧲', tier: 'mid', source: 'X-Men',
    rule: 'NO LAST-WORD LETTERS', description: 'A word can’t share any letter with your last word. Like poles repel.',
    taunt: 'Like poles repel, my friend. Share nothing with your last word.',
    check: (word, tiles, ctx) => ![...word].some(l => ctx.last.includes(l)),
    tileHint: (tile, tiles, ctx) => ([...tile.letter].some(l => ctx.last.includes(l)) ? 'dim' : null),
  },
  {
    id: 'ivanDrago', name: 'Ivan Drago', icon: '🏋️', tier: 'late', source: 'Rocky IV',
    rule: 'BEAT YOUR LAST SCORE', description: 'Every word must score more points than your last word.',
    taunt: 'I must break you. Every word must hit harder than the last.',
    check: (word, tiles, ctx) => ctx.score > ctx.lastScore,
  },
  {
    id: 'predator', name: 'The Predator', icon: '🎯', tier: 'late', source: 'Predator',
    rule: 'SCORE 12+', description: 'Every word must score 12 or more points.',
    taunt: 'It only hunts the strong. Every word needs 12 points or more.',
    check: (word, tiles, ctx) => ctx.score >= 12,
  },
  {
    id: 'gru', name: 'Gru', icon: '🍌', tier: 'late', source: 'Despicable Me',
    rule: 'EXACTLY 3 LETTERS', description: 'Shrink ray! Every word must be exactly 3 letters, like GRU.',
    taunt: 'Shrink ray, activate! Every word, exactly 3 letters. Light bulb!',
    check: word => word.length === 3,
  },
  {
    id: 'zurg', name: 'Emperor Zurg', icon: '🤖', tier: 'late', source: 'Toy Story 2',
    rule: 'ALTERNATE VOWELS', description: 'Letters must alternate vowel, consonant, vowel… (like TOMATO or LEMON).',
    taunt: 'Surrender, Space Ranger! Vowel, consonant, vowel... resistance is futile.',
    check: word => [...word].every((l, i) => i === 0 || VOWELS.has(l) !== VOWELS.has(word[i - 1])),
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
