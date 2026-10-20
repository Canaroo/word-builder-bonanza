#!/usr/bin/env node
// Lists Word Nerd's current secret bonuses, PowerPlays, charms, cosmetics and mission templates,
// checks candidate bonus words before you propose them, and flags cosmetic ids the live
// leaderboard rules would reject.
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
const cosmeticsSrc = read('data/cosmetics.ts');
const missionsSrc = read('data/missions.ts');

const bonusWords = [...bonuses.matchAll(/word:\s*"([A-Z]+)"/g)].map(m => m[1]);
const bonusScores = [...bonuses.matchAll(/score:\s*\{[^}]*digits:\s*"(\d+)"/g)].map(m => m[1]);
const entries = (src) => [...src.matchAll(/^\s+id:\s*'(\w+)',?\s*\n\s+name:\s*(['"`])(.+?)\2/gm)].map(m => ({ id: m[1], name: m[3] }));
const pp = entries(powerPlays);
const ch = entries(charms);

const cosmetics = [...cosmeticsSrc.matchAll(/\{\s*id:\s*'(\w+)',\s*kind:\s*'(badge|title)'([^\n]*)/g)].map(m => {
  const rest = m[3];
  return {
    id: m[1], kind: m[2],
    icon: rest.match(/icon:\s*'([^']+)'/)?.[1] ?? '',
    name: rest.match(/name:\s*'((?:[^'\\]|\\.)+)'/)?.[1] ?? '?',
    cost: rest.match(/cost:\s*(\d+)/)?.[1],
    streakDay: rest.match(/streakDay:\s*(\d+)/)?.[1],
    style: rest.match(/style:\s*'(\w+)'/)?.[1],
  };
});
const missions = [...missionsSrc.matchAll(/id:\s*'(\w+)',\s*category:\s*'(\w+)',\s*tier:\s*(\d),\s*text:\s*(['"])((?:(?!\4)[^\\]|\\.)+)\4/g)]
  .map(m => ({ id: m[1], category: m[2], tier: +m[3], text: m[5] }));
// Must match the Firebase rules in docs/LEADERBOARD.md.
const ID_RULE = { badge: /^[bs]_[A-Za-z]{1,24}$/, title: /^[ts]_[A-Za-z]{1,24}$/ };

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
  const fmt = c => `${c.icon ? c.icon + ' ' : ''}${c.name} [${c.id}] ${c.cost ? '🪙' + c.cost : '🔥day ' + c.streakDay}${c.style ? ' ' + c.style : ''}`;
  for (const kind of ['badge', 'title']) {
    const list = cosmetics.filter(c => c.kind === kind).sort((a, b) => (+a.cost || 1e6 + +a.streakDay) - (+b.cost || 1e6 + +b.streakDay));
    console.log(`\n${kind.toUpperCase()}S (${list.length}):`);
    console.log('  ' + list.map(fmt).join(' · '));
  }
  console.log(`\nMISSIONS (${missions.length}):`);
  for (const cat of ['word', 'powerplay', 'charm', 'secret']) {
    const list = missions.filter(m => m.category === cat);
    const perTier = [1, 2, 3].map(t => list.filter(m => m.tier === t).length).join('/');
    console.log(`  ${cat} (easy/med/hard ${perTier}): ` + list.map(m => `[${m.tier}] ${m.text}`).join(' · '));
  }
  const badIds = cosmetics.filter(c => !ID_RULE[c.kind].test(c.id));
  const dupIds = cosmetics.filter((c, i) => cosmetics.findIndex(x => x.id === c.id) !== i);
  const both = cosmetics.filter(c => c.cost && c.streakDay);
  if (badIds.length || dupIds.length || both.length) {
    console.log('\nCOSMETIC PROBLEMS:');
    badIds.forEach(c => console.log(`  ✗ ${c.id}: the leaderboard rules reject this id (use b_/t_/s_ + letters)`));
    dupIds.forEach(c => console.log(`  ✗ ${c.id}: duplicate id`));
    both.forEach(c => console.log(`  ✗ ${c.id}: has both cost and streakDay`));
  }
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
