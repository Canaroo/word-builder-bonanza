#!/usr/bin/env node
// Adds words with definitions to data/internalWords.ts, in alphabetical order.
//
//   node .claude/skills/add-game-content/scripts/add-words.mjs words.tsv
//
// words.tsv: one "word<TAB>definition" per line (lines starting with # are skipped). Words that
// already have a definition are reported and left alone. Definitions can't contain a single
// quote ('); reword them. Then run `npm run words` to rebuild the word lists.
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = 'data/internalWords.ts';
const input = process.argv[2];
if (!input) { console.error('usage: add-words.mjs words.tsv'); process.exit(1); }

let src = readFileSync(FILE, 'utf8');
const rows = readFileSync(input, 'utf8').split(/\r?\n/).filter(l => l.trim() && !l.startsWith('#')).map(l => {
  const [word, ...rest] = l.split('\t');
  return [word.trim().toLowerCase(), rest.join('\t').trim()];
});

const problems = rows.filter(([w, d]) => !/^[a-z]+$/.test(w) || !d || d.includes("'"));
if (problems.length) { console.error('Fix these rows first (letters-only word, a definition, no single quotes):', problems); process.exit(1); }

const existing = () => [...src.matchAll(/^  \['([^']+)',/gm)].map(m => ({ word: m[1], at: m.index }));
let added = 0;
for (const [word, def] of rows) {
  const entries = existing();
  if (entries.some(e => e.word === word)) { console.log(`skip ${word}: already defined`); continue; }
  const next = entries.find(e => e.word > word);
  const line = `  ['${word}', '${def}'],\n`;
  if (!next) src = src.replace(/'\]\n\]\);/, "'],\n]);"); // the last entry may lack a comma
  const at = next ? next.at : src.lastIndexOf('\n]);') + 1;
  src = src.slice(0, at) + line + src.slice(at);
  added++;
}
writeFileSync(FILE, src);
console.log(`added ${added} word(s) to ${FILE}. Now run: npm run words`);
