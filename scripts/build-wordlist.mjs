// Builds the word lists the game uses:
//   public/words/wordlist.txt  every playable word:
//     base list (word-list package) + SCOWL levels 10-50 + data/internalWords.ts
//     + words/custom.txt − words/blocked.txt
//     (word-list strips anything that might offend, which also drops real Scrabble words like
//     BUM and CRAP, and it predates newer ones like VAPE and EMOJI; SCOWL puts those back.
//     The slurs that come back with them are in words/blocked.txt.)
//   public/words/common.txt    the everyday subset Challenge and hints search
//     (SCOWL levels 10-35 from wordlist-english that the game accepts)
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import baseListPath from 'word-list';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIN_LENGTH = 2;
const MAX_LENGTH = 15;
const VALID = /^[a-z]+$/;

const readWordFile = (relPath) =>
  fs.readFileSync(path.join(root, relPath), 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim().toLowerCase())
    .filter((line) => line && !line.startsWith('#'));

const checkWords = (words, source) => {
  const bad = words.filter((w) => !VALID.test(w));
  if (bad.length) {
    throw new Error(`${source}: entries must be letters only: ${bad.join(', ')}`);
  }
  return words;
};

// Keys of the internalWords Map, written as ['word', 'definition'] entries.
const internalSource = fs.readFileSync(path.join(root, 'data/internalWords.ts'), 'utf8');
const internal = checkWords([...internalSource.matchAll(/^\s*\['([^']+)',/gm)].map((m) => m[1].toLowerCase()), 'data/internalWords.ts');
const custom = checkWords(readWordFile('words/custom.txt'), 'words/custom.txt');
const blocked = new Set(checkWords(readWordFile('words/blocked.txt'), 'words/blocked.txt'));
// Valid when typed, but never offered as a hint or Challenge answer (see words/no-suggest.txt).
const noSuggest = new Set(checkWords(readWordFile('words/no-suggest.txt'), 'words/no-suggest.txt'));
const base = fs.readFileSync(baseListPath, 'utf8').split('\n');

const require = createRequire(import.meta.url);
const SCOWL_VARIANTS = ['english', 'american', 'british', 'canadian', 'australian'];
const SCOWL_LEVELS = [10, 20, 35, 40, 50]; // 55+ adds abbreviations and fragments (CS, KCAL...)
const scowl = [];
for (const variant of SCOWL_VARIANTS) {
  for (const level of SCOWL_LEVELS) {
    for (const w of require(`wordlist-english/${variant}-words-${level}.json`)) {
      if (w.length >= 3) scowl.push(w); // SCOWL's 2-letter entries are mostly abbreviations
    }
  }
}

const accept = (w) => w.length >= MIN_LENGTH && w.length <= MAX_LENGTH && VALID.test(w) && !blocked.has(w);
const words = new Set();
const curated = new Set(); // everything except the SCOWL extras, for the common list below
for (const w of [...base, ...internal, ...custom]) {
  if (accept(w)) { words.add(w); curated.add(w); }
}
let scowlAdded = 0;
for (const w of scowl) {
  if (accept(w) && !words.has(w)) { words.add(w); scowlAdded++; }
}

const sorted = [...words].sort();

// Common words: SCOWL's everyday levels, limited to the curated list (so hints and Challenge
// never suggest the vulgar words SCOWL adds back).
const COMMON_LEVELS = [10, 20, 35];
const common = new Set();
for (const variant of ['english', 'american']) {
  for (const level of COMMON_LEVELS) {
    for (const w of require(`wordlist-english/${variant}-words-${level}.json`)) {
      if (curated.has(w) && !noSuggest.has(w)) common.add(w);
    }
  }
}
const commonSorted = [...common].sort();

const outDir = path.join(root, 'public/words');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'wordlist.txt'), sorted.join('\n') + '\n');
fs.writeFileSync(path.join(outDir, 'common.txt'), commonSorted.join('\n') + '\n');

console.log(
  `Word list: ${sorted.length} words ` +
  `(${scowlAdded} from SCOWL, ${internal.length} internal, ${custom.length} custom, ${blocked.size} blocked), ` +
  `${commonSorted.length} common → public/words/`
);
