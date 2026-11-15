// The 10,000 Gate's passwords (v7.39.0): everyday 6-letter words, so the scramble is fair. Any real
// word using all six letters also opens the gate. The Daily Run picks the same one for everyone.
export const GATE_PASSWORDS = [
  'ARCADE', 'PLANET', 'ROCKET', 'JUNGLE', 'CASTLE', 'DRAGON', 'WIZARD', 'PIRATE', 'GUITAR', 'SPIRIT',
  'LEGEND', 'MAGNET', 'PUZZLE', 'RECORD', 'SUMMER', 'FOREST', 'ISLAND', 'SILVER', 'GOLDEN', 'BRIDGE',
  'CANDLE', 'MARBLE', 'TICKET', 'VELVET', 'TROPHY', 'COWBOY', 'HELMET', 'JACKET', 'ORANGE', 'PEPPER',
  'RABBIT', 'SAILOR', 'TEMPLE', 'TURTLE', 'VIOLIN', 'WALRUS', 'BANANA', 'CIRCUS', 'DOCTOR', 'GALAXY',
  // v7.39.3: 40 more, so passwords come round far less often.
  'BASKET', 'BUTTER', 'CAMERA', 'CARPET', 'CHERRY', 'COFFEE', 'COOKIE', 'CRAYON', 'DESERT', 'DINNER',
  'FALCON', 'FLOWER', 'GARDEN', 'HAMMER', 'HOCKEY', 'JIGSAW', 'KITTEN', 'LADDER', 'LIZARD', 'MONKEY',
  'MUFFIN', 'NAPKIN', 'PARROT', 'PENCIL', 'PILLOW', 'POCKET', 'PUPPET', 'RIBBON', 'SADDLE', 'SALMON',
  'SCHOOL', 'SHADOW', 'SPIDER', 'STREAM', 'TENNIS', 'TOMATO', 'TUNNEL', 'VALLEY', 'YELLOW', 'WINDOW',
] as const;

/**
 * A password for this run (v7.39.3). The scored Daily Run gets the day's shared password (same for
 * everyone). Every other run, daily practice included, gets one this player hasn't seen recently:
 * it skips the ones in `recent`, so the whole list comes round before any repeats. (Before, it was
 * a plain random pick, and every daily replay reused the day's password.)
 */
export const gatePassword = (opts: { dailyKey?: string; recent?: readonly string[] } = {}, rand: () => number = Math.random): string => {
  if (opts.dailyKey) {
    let h = 0;
    for (const ch of opts.dailyKey) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return GATE_PASSWORDS[h % GATE_PASSWORDS.length];
  }
  const recent = new Set(opts.recent ?? []);
  const fresh = GATE_PASSWORDS.filter(w => !recent.has(w));
  const pool = fresh.length ? fresh : GATE_PASSWORDS;
  return pool[Math.floor(rand() * pool.length) % pool.length];
};

/** How many recent passwords a player is spared (the list cycles before one repeats). */
export const RECENT_PASSWORDS = GATE_PASSWORDS.length - 1;

/**
 * Other real words each password's letters can spell (v7.44.3). Any of them opens the gate, so the
 * scramble must never land on one: a run once dealt the tiles already spelling the answer. A test
 * rebuilds this list from the dictionary, so adding a password or a word keeps it honest.
 */
export const GATE_ANAGRAMS: Record<string, readonly string[]> = {
  PLANET: ['PLATEN'], CASTLE: ['CLEATS', 'ECLATS', 'LACETS', 'SCLATE'], PIRATE: ['PRATIE', 'PTERIA'], LEGEND: ['LENGED'],
  PUZZLE: ['PUZZEL'], RECORD: ['CORDER'], FOREST: ['FETORS', 'FORTES', 'FOSTER', 'SOFTER'],
  SILVER: ['ERVILS', 'LIVERS', 'LIVRES', 'RIVELS', 'SLIVER'], GOLDEN: ['DONGLE', 'LONGED'], BRIDGE: ['BEGIRD'], CANDLE: ['LANCED'],
  MARBLE: ['AMBLER', 'BLAMER', 'LAMBER', 'RAMBLE'], ORANGE: ['ONAGER'], TEMPLE: ['PELMET'], CARPET: ['PREACT'],
  DESERT: ['DETERS', 'RESTED'], DINNER: ['ENDRIN'], FALCON: ['FLACON'], FLOWER: ['FOWLER', 'REFLOW', 'WOLFER'],
  GARDEN: ['DANGER', 'GANDER', 'GRANDE', 'RANGED'], HOCKEY: ['CHOKEY'], LADDER: ['LARDED', 'RADDLE'], PARROT: ['RAPTOR'],
  RIBBON: ['ROBBIN'], SADDLE: ['ADDLES', 'DALEDS'], SALMON: ['MONALS'], SCHOOL: ['CHOLOS'],
  SPIDER: ['PRIDES', 'PRISED', 'REDIPS', 'RISPED', 'SPIRED'],
  STREAM: ['ARMETS', 'MASTER', 'MATERS', 'MATRES', 'RAMETS', 'TAMERS', 'TREMAS'], TENNIS: ['SENNIT', 'SINNET'],
};

/** How much a scramble gives away about a target word: letters still in place, and 3-letter runs kept. */
export const giveaway = (arrangement: string, target: string): number => {
  let score = 0;
  for (let i = 0; i < target.length; i++) if (arrangement[i] === target[i]) score += 2;
  for (let i = 0; i + 3 <= target.length; i++) if (arrangement.includes(target.slice(i, i + 3))) score += 3;
  return score;
};

/**
 * Scrambled letters for a password. Never the password or any other word that opens the gate, and
 * as far from them as the letters allow: of many shuffles, the one that leaves the fewest letters
 * in place and the fewest 3-letter runs of an answer is used (BANANA can't avoid every one).
 */
export const scramble = (word: string, rand: () => number = Math.random): string[] => {
  const answers = [word, ...(GATE_ANAGRAMS[word] ?? [])];
  let best: string[] | null = null, bestScore = Infinity;
  for (let tries = 0; tries < 200 && bestScore > 0; tries++) {
    const letters = word.split('');
    for (let i = letters.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [letters[i], letters[j]] = [letters[j], letters[i]]; }
    const arrangement = letters.join('');
    if (answers.includes(arrangement)) continue;
    // The password itself counts most; the other answers count too.
    const score = answers.reduce((sum, a, i) => sum + giveaway(arrangement, a) * (i === 0 ? 5 : 1), 0);
    if (score < bestScore) { best = letters; bestScore = score; }
  }
  // 200 shuffles of six letters can't all be answers, but never hand back the word itself.
  return best ?? [...word.slice(1), word[0]];
};

/**
 * The 70,000 gate's hidden words (v7.49): everyday 8-letter words from the common list (none a
 * secret word or on the no-suggest list; a test checks). The Big One deals one of these, scrambled,
 * plus a couple of extra tiles.
 */
export const BIG_ONE_WORDS = [
  'BIRTHDAY', 'CHAMPION', 'DINOSAUR', 'ELEPHANT', 'FOOTBALL', 'HOMEWORK', 'KEYBOARD', 'MOUNTAIN', 'NOTEBOOK', 'PAINTING',
  'SANDWICH', 'TREASURE', 'VACATION', 'UMBRELLA', 'AIRPLANE', 'MAGICIAN', 'MONSTERS', 'PRINCESS', 'SUNSHINE', 'PANCAKES',
  'BASEBALL', 'BACKPACK', 'BATHROOM', 'COMPUTER', 'DAUGHTER', 'EXERCISE', 'FAVORITE', 'FIREWORK', 'FLAMINGO', 'GOLDFISH',
  'HOSPITAL', 'INTERNET', 'KANGAROO', 'LEMONADE', 'MARATHON', 'MIDNIGHT', 'NECKLACE', 'PASSPORT', 'PEACEFUL', 'QUESTION',
  'RAINBOWS', 'REINDEER', 'SEASHELL', 'SHOULDER', 'SKELETON', 'SNOWBALL', 'SPARKLER', 'SQUIRREL', 'STARFISH', 'STRENGTH',
  'SUITCASE', 'SUNLIGHT', 'TOMORROW', 'TRIANGLE', 'VAMPIRES', 'WILDLIFE', 'ZUCCHINI', 'ALPHABET', 'ARMCHAIR', 'BLUEBIRD',
  'BOOKCASE', 'CARNIVAL', 'CUPBOARD', 'DUMBBELL', 'FIRESIDE', 'HANDBOOK', 'HEIRLOOM', 'HORRIBLE', 'KITCHENS', 'LOLLIPOP',
  'MERMAIDS', 'MUSHROOM', 'OVERCOAT', 'POSTCARD', 'PUMPKINS', 'RAINDROP', 'SCISSORS', 'SNOWFALL', 'TEASPOON', 'THOUSAND',
  'TORTOISE', 'TRAVELER', 'UNICORNS', 'UNIFORMS', 'WEEKENDS', 'WHISTLES', 'WINDMILL',
] as const;

/** Word Ladder fallbacks (v7.49): if a dealt hand can't reach a rung, one of these is dealt in. */
export const LADDER_FALLBACK: Record<number, readonly string[]> = {
  3: ['CAT', 'SUN', 'TOE'], 4: ['RAIN', 'TONE', 'LATE'], 5: ['PLANT', 'STONE', 'TRAIN'],
  6: ['GARDEN', 'CANDLE', 'ROCKET', 'PLANET'], 7: ['KITCHEN', 'TEACHER', 'MORNING', 'DIAMOND'],
  8: ['ELEPHANT', 'MOUNTAIN', 'SANDWICH', 'TREASURE'],
};
