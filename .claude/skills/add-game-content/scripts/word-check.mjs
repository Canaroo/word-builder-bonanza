#!/usr/bin/env node
// Checks dictionary words against Word Nerd before adding them.
//
//   node .claude/skills/add-game-content/scripts/word-check.mjs FAM YEET BAE      # check words
//   node .claude/skills/add-game-content/scripts/word-check.mjs --file list.txt    # diff a word list
//
// --file takes a plain list (one word per line) or an NWL-style list (lines starting with an
// uppercase word, optionally followed by "- WORD n definition" lines). It prints only the words
// the game is missing, with the list's own definition when it has one, so you can pick the
// common ones. Add --min 3 --max 8 to limit lengths (defaults: 2 and 8, the rack size).
//
// Run from the repo root after `npm run words` (reads public/words/*.txt).
import { readFileSync } from 'node:fs';

const readSet = (p) => new Set(readFileSync(p, 'utf8').split(/\r?\n/).map(w => w.trim().toLowerCase()).filter(w => w && !w.startsWith('#')));
const words = readSet('public/words/wordlist.txt');
const common = readSet('public/words/common.txt');
const blocked = readSet('words/blocked.txt');
const noSuggest = readSet('words/no-suggest.txt');
const internal = new Map([...readFileSync('data/internalWords.ts', 'utf8').matchAll(/^\s*\['([^']+)',\s*'((?:[^'\\]|\\.)*)'\]/gm)].map(m => [m[1], m[2]]));

const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : dflt; };
const file = opt('--file', null);
const min = Number(opt('--min', 2)), max = Number(opt('--max', 8));

if (file) {
  const lines = readFileSync(file, 'utf8').replace(/\r/g, '').split('\n');
  const defs = new Map(); let cur = null;
  for (const ln of lines) {
    const head = ln.match(/^([A-Za-z]+)\b[^a-z]*$/);
    if (head && !ln.startsWith('-')) { cur = head[1].toLowerCase(); if (!defs.has(cur)) defs.set(cur, ''); continue; }
    if (ln.startsWith('- ') && cur) defs.set(cur, ln.slice(2).trim());
    else if (/^[a-z]+$/i.test(ln.trim())) { cur = ln.trim().toLowerCase(); if (!defs.has(cur)) defs.set(cur, ''); }
  }
  const all = [...defs.keys()].filter(w => w.length >= min && w.length <= max && /^[a-z]+$/.test(w));
  const missing = all.filter(w => !words.has(w));
  console.log(`${all.length} words in the list (${min}-${max} letters); ${missing.length} missing from the game:\n`);
  for (const w of missing) console.log(`${w.toUpperCase()}${blocked.has(w) ? ' [BLOCKED]' : ''}: ${defs.get(w).slice(0, 100)}`);
  process.exit(0);
}

for (const raw of args) {
  const w = raw.toLowerCase();
  const facts = [
    words.has(w) ? 'valid' : 'NOT in word list',
    blocked.has(w) && 'BLOCKED (slur list: ask before unblocking)',
    noSuggest.has(w) && 'never suggested',
    internal.has(w) ? `definition: "${internal.get(w)}"` : 'no built-in definition',
    common.has(w) && 'common (hints/Challenge can use it)',
  ].filter(Boolean);
  console.log(`${w.toUpperCase()}: ${facts.join(' · ')}`);
}
