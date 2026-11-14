// The 10,000 Gate's passwords (v7.39.0): everyday 6-letter words, so the scramble is fair. Any real
// word using all six letters also opens the gate. The Daily Run picks the same one for everyone.
export const GATE_PASSWORDS = [
  'ARCADE', 'PLANET', 'ROCKET', 'JUNGLE', 'CASTLE', 'DRAGON', 'WIZARD', 'PIRATE', 'GUITAR', 'SPIRIT',
  'LEGEND', 'MAGNET', 'PUZZLE', 'WINTER', 'SUMMER', 'FOREST', 'ISLAND', 'SILVER', 'GOLDEN', 'BRIDGE',
  'CANDLE', 'MARBLE', 'TICKET', 'VELVET', 'ZOMBIE', 'COWBOY', 'HELMET', 'JACKET', 'ORANGE', 'PEPPER',
  'RABBIT', 'SAILOR', 'TEMPLE', 'TURTLE', 'VIOLIN', 'WALRUS', 'BANANA', 'CIRCUS', 'DOCTOR', 'GALAXY',
] as const;

/** A password for this run: random, or (Daily Run) the same for everyone that day. */
export const gatePassword = (dailyKey?: string, rand: () => number = Math.random): string => {
  if (dailyKey) {
    let h = 0;
    for (const ch of dailyKey) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return GATE_PASSWORDS[h % GATE_PASSWORDS.length];
  }
  return GATE_PASSWORDS[Math.floor(rand() * GATE_PASSWORDS.length)];
};

/** Scrambled letters for a password, never in the answer's own order. */
export const scramble = (word: string, rand: () => number = Math.random): string[] => {
  const letters = word.split('');
  for (let tries = 0; tries < 20; tries++) {
    for (let i = letters.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [letters[i], letters[j]] = [letters[j], letters[i]]; }
    if (letters.join('') !== word) break;
  }
  return letters;
};
