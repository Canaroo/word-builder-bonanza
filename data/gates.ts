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

/** Scrambled letters for a password, never in the answer's own order. */
export const scramble = (word: string, rand: () => number = Math.random): string[] => {
  const letters = word.split('');
  for (let tries = 0; tries < 20; tries++) {
    for (let i = letters.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [letters[i], letters[j]] = [letters[j], letters[i]]; }
    if (letters.join('') !== word) break;
  }
  return letters;
};
