// Daily missions: three a day, picked from these templates so each day mixes word-building,
// PowerPlay, charm and secret-finding goals. Progress comes from game events (services/missions.ts).

export type MissionCategory = 'word' | 'powerplay' | 'charm' | 'secret';
export type MissionTier = 1 | 2 | 3;

/** What the game reports to the mission tracker. */
export type MissionEvent =
  | { type: 'word'; word: string; score: number; goldenStarted?: boolean; comboFilled?: boolean }
  | { type: 'powerplay'; id: string; subtheme: string }
  | { type: 'powerplaySwap' }
  | { type: 'charm'; equippedCount: number; swapped: boolean }
  | { type: 'secret'; id: string; firstFind: boolean; media: string; isScore: boolean };

export interface MissionTemplate {
  id: string;
  category: MissionCategory;
  tier: MissionTier;
  text: string;
  target: number;
  /** 'run' missions must be done within a single run; 'day' missions add up across runs. */
  scope: 'day' | 'run';
  /**
   * How much an event moves this mission. For 'max' missions the value replaces progress if
   * higher (e.g. charms equipped at once); otherwise it adds.
   */
  progress: (e: MissionEvent) => number;
  mode?: 'add' | 'max';
}

const VOWELS = /[AEIOU]/g;
const isWord = (e: MissionEvent): e is Extract<MissionEvent, { type: 'word' }> => e.type === 'word';

export const MISSION_TEMPLATES: MissionTemplate[] = [
  // --- Word building ---
  { id: 'w_rare', category: 'word', tier: 1, text: 'Play a word with a J, Q, X or Z', target: 1, scope: 'day',
    progress: e => (isWord(e) && /[JQXZ]/i.test(e.word) ? 1 : 0) },
  { id: 'w_vowels', category: 'word', tier: 1, text: 'Play a word with 3+ vowels', target: 1, scope: 'day',
    progress: e => (isWord(e) && (e.word.toUpperCase().match(VOWELS)?.length ?? 0) >= 3 ? 1 : 0) },
  { id: 'w_count', category: 'word', tier: 1, text: 'Play 30 valid words', target: 30, scope: 'day',
    progress: e => (isWord(e) ? 1 : 0) },
  { id: 'w_six', category: 'word', tier: 2, text: 'Play a 6-letter word', target: 1, scope: 'day',
    progress: e => (isWord(e) && e.word.length >= 6 ? 1 : 0) },
  { id: 'w_fivesRun', category: 'word', tier: 2, text: 'Play four 5+ letter words in one run', target: 4, scope: 'run',
    progress: e => (isWord(e) && e.word.length >= 5 ? 1 : 0) },
  { id: 'w_combo', category: 'word', tier: 2, text: 'Fill the Word Combo meter (5 in a row)', target: 1, scope: 'day',
    progress: e => (isWord(e) && e.comboFilled ? 1 : 0) },
  { id: 'w_golden', category: 'word', tier: 2, text: 'Reach a Golden Round', target: 1, scope: 'day',
    progress: e => (isWord(e) && e.goldenStarted ? 1 : 0) },
  { id: 'w_seven', category: 'word', tier: 3, text: 'Play a 7+ letter word', target: 1, scope: 'day',
    progress: e => (isWord(e) && e.word.length >= 7 ? 1 : 0) },
  { id: 'w_big', category: 'word', tier: 3, text: 'Score 150+ points with one word', target: 1, scope: 'day',
    progress: e => (isWord(e) && e.score >= 150 ? 1 : 0) },

  // --- PowerPlays ---
  { id: 'p_useTwo', category: 'powerplay', tier: 1, text: 'Use 2 PowerPlays', target: 2, scope: 'day',
    progress: e => (e.type === 'powerplay' ? 1 : 0) },
  { id: 'p_score', category: 'powerplay', tier: 1, text: 'Use a scoring PowerPlay', target: 1, scope: 'day',
    progress: e => (e.type === 'powerplay' && e.subtheme === 'score' ? 1 : 0) },
  { id: 'p_swap', category: 'powerplay', tier: 2, text: 'Swap a PowerPlay for a new one', target: 1, scope: 'day',
    progress: e => (e.type === 'powerplaySwap' ? 1 : 0) },
  { id: 'p_rack', category: 'powerplay', tier: 2, text: 'Use a PowerPlay that changes your tiles', target: 1, scope: 'day',
    progress: e => (e.type === 'powerplay' && e.subtheme === 'rack' ? 1 : 0) },
  { id: 'p_timer', category: 'powerplay', tier: 2, text: 'Use a time PowerPlay', target: 1, scope: 'day',
    progress: e => (e.type === 'powerplay' && e.subtheme === 'timer' ? 1 : 0) },
  { id: 'p_threeRun', category: 'powerplay', tier: 3, text: 'Use 3 PowerPlays in one run', target: 3, scope: 'run',
    progress: e => (e.type === 'powerplay' ? 1 : 0) },

  // --- Charms ---
  { id: 'c_equip', category: 'charm', tier: 1, text: 'Equip a charm', target: 1, scope: 'day',
    progress: e => (e.type === 'charm' ? 1 : 0) },
  { id: 'c_two', category: 'charm', tier: 1, text: 'Equip 2 charms', target: 2, scope: 'day',
    progress: e => (e.type === 'charm' ? 1 : 0) },
  { id: 'c_three', category: 'charm', tier: 2, text: 'Have 3 charms equipped at once', target: 3, scope: 'run', mode: 'max',
    progress: e => (e.type === 'charm' ? e.equippedCount : 0) },
  { id: 'c_full', category: 'charm', tier: 3, text: 'Fill all 5 charm slots in one run', target: 5, scope: 'run', mode: 'max',
    progress: e => (e.type === 'charm' ? e.equippedCount : 0) },
  { id: 'c_swap', category: 'charm', tier: 3, text: 'Swap a charm out for a new one', target: 1, scope: 'day',
    progress: e => (e.type === 'charm' && e.swapped ? 1 : 0) },

  // --- Secrets ---
  { id: 's_any', category: 'secret', tier: 1, text: 'Find any secret bonus', target: 1, scope: 'day',
    progress: e => (e.type === 'secret' ? 1 : 0) },
  { id: 's_vhs', category: 'secret', tier: 2, text: 'Find a movie or TV secret 📼', target: 1, scope: 'day',
    progress: e => (e.type === 'secret' && e.media === 'vhs' ? 1 : 0) },
  { id: 's_two', category: 'secret', tier: 2, text: 'Find 2 secret bonuses', target: 2, scope: 'day',
    progress: e => (e.type === 'secret' ? 1 : 0) },
  { id: 's_new', category: 'secret', tier: 3, text: "Find a secret you've never found before", target: 1, scope: 'day',
    progress: e => (e.type === 'secret' && e.firstFind ? 1 : 0) },
  { id: 's_score', category: 'secret', tier: 3, text: 'Trigger a score-number secret (like ending on 69)', target: 1, scope: 'day',
    progress: e => (e.type === 'secret' && e.isScore ? 1 : 0) },
  { id: 's_music', category: 'secret', tier: 3, text: 'Find a music or video game secret 💿🎮', target: 1, scope: 'day',
    progress: e => (e.type === 'secret' && (e.media === 'cd' || e.media === 'cartridge') ? 1 : 0) },
];

export const CATEGORY_ICON: Record<MissionCategory, string> = { word: '🔤', powerplay: '⚡', charm: '✨', secret: '📼' };
export const CATEGORY_LABEL: Record<MissionCategory, string> = { word: 'WORD', powerplay: 'POWERPLAY', charm: 'CHARM', secret: 'SECRET' };
