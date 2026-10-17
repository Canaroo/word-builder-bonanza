// Builds public/words/wordlist.txt, the list the game validates against:
//   base list (word-list package) + data/internalWords.ts + words/custom.txt − words/blocked.txt
import fs from 'node:fs';
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
const base = fs.readFileSync(baseListPath, 'utf8').split('\n');

const words = new Set();
for (const w of [...base, ...internal, ...custom]) {
  if (w.length >= MIN_LENGTH && w.length <= MAX_LENGTH && VALID.test(w) && !blocked.has(w)) {
    words.add(w);
  }
}

const sorted = [...words].sort();
const outDir = path.join(root, 'public/words');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'wordlist.txt'), sorted.join('\n') + '\n');

console.log(
  `Word list: ${sorted.length} words ` +
  `(${internal.length} internal, ${custom.length} custom, ${blocked.size} blocked) → public/words/wordlist.txt`
);
