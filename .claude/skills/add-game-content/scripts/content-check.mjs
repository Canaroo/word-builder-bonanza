#!/usr/bin/env node
// Lists Word Nerd's current secret bonuses, PowerPlays and charms, and checks candidate
// bonus words before you propose them.
//
//   node .claude/skills/add-game-content/scripts/content-check.mjs            # list everything
//   node .claude/skills/add-game-content/scripts/content-check.mjs TEX SLIME  # check candidates
//
// Run from the repo root. Reads the source files directly (regex, no build needed).
import { readFileSync, existsSync } from 'node:fs';

const read = (p) => readFileSync(p, 'utf8');
const bonuses = read('data/secretBonuses.ts');
const powerPlays = read('data/powerPlays.ts');
const charms = read('data/charms.ts');

const bonusWords = [...bonuses.matchAll(/word:\s*"([A-Z]+)"/g)].map(m => m[1]);
const bonusScores = [...bonuses.matchAll(/score:\s*\{[^}]*digits:\s*"(\d+)"/g)].map(m => m[1]);
const entries = (src) => [...src.matchAll(/^\s+id:\s*'(\w+)',?\s*\n\s+name:\s*(['"`])(.+?)\2/gm)].map(m => ({ id: m[1], name: m[3] }));
const pp = entries(powerPlays);
const ch = entries(charms);

const words = new Set(read('public/words/wordlist.txt').split('\n').map(w => w.trim().toUpperCase()).filter(Boolean));
const blocked = new Set(read('words/blocked.txt').split('\n').map(w => w.trim().toUpperCase()).filter(w => w && !w.startsWith('#')));

const candidates = process.argv.slice(2).map(w => w.toUpperCase());

if (candidates.length === 0) {
  console.log(`SECRET BONUSES (${bonusWords.length + bonusScores.length}): ${bonusWords.length} words, ${bonusScores.length} score numbers`);
  console.log('  words:', bonusWords.join(' '));
  console.log('  score digits:', bonusScores.join(' '));
  console.log(`\nPOWERPLAYS (${pp.length}):`);
  console.log('  ' + pp.map(p => `${p.name} [${p.id}]`).join(' · '));
  console.log(`\nCHARMS (${ch.length}):`);
  console.log('  ' + ch.map(c => `${c.name} [${c.id}]`).join(' · '));
  if (!existsSync('public/words/wordlist.txt')) console.log('\n(no word list: run `npm run words`)');
  process.exit(0);
}

let problems = 0;
for (const w of candidates) {
  const issues = [];
  if (!/^[A-Z]+$/.test(w)) issues.push('letters only');
  if (w.length < 3) issues.push('needs 3+ letters (the game minimum)');
  if (bonusWords.includes(w)) issues.push('already a bonus word');
  if (blocked.has(w)) issues.push('in words/blocked.txt');
  if (!words.has(w)) issues.push('not in the dictionary (add it to words/custom.txt, then `npm run words`)');
  if (issues.length) problems++;
  console.log(`${issues.length ? '✗' : '✓'} ${w}${issues.length ? ': ' + issues.join('; ') : ': OK'}`);
}
process.exit(problems ? 1 : 0);
