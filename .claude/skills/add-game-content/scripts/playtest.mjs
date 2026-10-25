#!/usr/bin/env node
// Plays scripted mid-run moments in the real game (phone size, 390x844) and reports what
// happened: the word's score breakdown, every pop-up, and the run state afterward. Use it to
// check new PowerPlays and charms whose logic unit tests can't reach (anything in the turn hook,
// the clock or the pocket button).
//
//   npm run build && npx vite preview --port 4173        # start the preview first (in the background)
//   node .claude/skills/add-game-content/scripts/playtest.mjs scenarios.json [--url http://localhost:4173] [--out dir]
//
// scenarios.json is one scenario or a list of them (see playtest.example.json):
//   name          label for the output and the screenshot file
//   time          seconds on the clock (default 40)
//   hand          the 8 tiles, e.g. "TOURSAEP" (points come from the letter)
//   word          a word to play from the hand, tile by tile, then SUBMIT (optional)
//   charms        charm ids to equip, e.g. ["imReady", "hesOnFire"]
//   powerPlay     PowerPlay id to hold in the pocket, e.g. "actClear"
//   usePowerPlay  true to press the pocket button (and confirm) before the word
//   armed         activePowerPlays to start with, e.g. { "continueScreen": true } (also shown as buffs)
//   wordsPlayed   valid words already played this run (CAT each; 18 puts the next word in level 2)
//   lastWords     words played just before, newest last, e.g. ["PLANT"]
//   state         any other GameState fields, e.g. { "score": 1000, "pokedexVowels": "AEI" }
//   tap           aria-label of something to tap and screenshot, e.g. "Charm: The Opposite"
//   waitMs        how long to wait after the word (or after resuming, with no word); default 2500
//
// Check test words with content-check.mjs first: secret bonus words open extra pop-ups. The script
// dismisses any pop-up (and lists it), but a bonus changes the score. Score-number secrets (a score
// containing 23, 42...) can still fire by chance; they show up under "popups".
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const flag = (name, fallback) => { const i = args.indexOf(name); return i === -1 ? fallback : args.splice(i, 2)[1]; };
const url = flag('--url', 'http://localhost:4173/');
const outDir = flag('--out', join(tmpdir(), 'word-nerd-playtest'));
if (!args[0]) { console.error('Usage: playtest.mjs scenarios.json [--url URL] [--out DIR]'); process.exit(1); }
const loaded = JSON.parse(readFileSync(args[0], 'utf8'));
const scenarios = Array.isArray(loaded) ? loaded : [loaded];
mkdirSync(outDir, { recursive: true });

const SAVE_KEY = 'wordBuilderBonanzaSave';
const POINTS = { A: 1, E: 1, I: 1, O: 1, U: 1, N: 1, R: 1, S: 1, T: 1, L: 1, D: 2, G: 2, B: 3, C: 3, M: 3, P: 3, F: 4, H: 4, V: 4, W: 4, Y: 4, K: 5, J: 8, X: 8, Q: 10, Z: 10 };
const text = (s) => s.replace(/\s+/g, ' ').trim();
const played = (words) => words.map((word, i) => ({ type: 'word', word, status: 'valid', score: 5, baseScore: 5, bonuses: [], definition: '', cumulativeScore: 5 * (i + 1) }));

const newPage = async (browser) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(url);
  await page.waitForTimeout(1500);
  return page;
};

/** Saves the current run through the 💾 button and returns the parsed save. */
const saveRun = async (page) => {
  await page.locator('button:visible', { hasText: '💾' }).first().click();
  await page.waitForTimeout(600);
  await page.locator('button:visible', { hasText: /save/i }).last().click();
  await page.waitForTimeout(1200);
  return JSON.parse(await page.evaluate((k) => localStorage.getItem(k), SAVE_KEY) || 'null');
};

/** Clicks through every open pop-up and returns their text. */
const dismissPopups = async (page) => {
  const seen = [];
  for (let i = 0; i < 8; i++) {
    let button = page.locator('button:visible', { hasText: /^\s*(continue|take|equip|keep)/i }).first();
    if (!(await button.count())) button = page.locator('[role="dialog"] button:visible').last();
    if (!(await button.count())) break;
    const box = button.locator('xpath=ancestor::div[contains(@class,"inset-0")][1]');
    seen.push(text(await ((await box.count()) ? box : button).innerText()).slice(0, 240));
    await button.click();
    await page.waitForTimeout(700);
  }
  return seen;
};

/** Starts a real run and saves it, to get a save in the current format to edit. */
const baseSave = async (browser) => {
  const page = await newPage(browser);
  await page.getByPlaceholder('Enter Your Name').fill('PLAYTEST');
  await page.locator('button', { hasText: 'NEW GAME' }).click();
  await page.waitForTimeout(2000);
  await dismissPopups(page);
  const save = await saveRun(page);
  await page.close();
  if (!save) throw new Error('Could not save a run to start from.');
  return save;
};

const applyScenario = (base, sc) => {
  const save = structuredClone(base);
  const st = save.gameScreenState;
  const gs = st.gameState;
  const charms = (sc.charms ?? []).map(id => ({ id }));
  const armed = sc.armed ?? {};
  Object.assign(gs, {
    roundType: 'normal', consecutiveValidWords: 0, consecutiveSuccesses: 0,
    log: played([...Array(sc.wordsPlayed ?? 0).fill('CAT'), ...(sc.lastWords ?? [])]),
    activeCharms: charms,
    activeBuffs: [...charms, ...Object.keys(armed).map(id => ({ id }))],
    activePowerPlays: armed,
    availablePowerPlays: sc.powerPlay ? [{ id: sc.powerPlay }] : [],
    ...sc.state,
  });
  const hand = Array(st.hand.length).fill(null);
  [...(sc.hand ?? 'QZXJKVWY')].forEach((letter, i) => { hand[i] = { id: `${letter}-pt${i}`, letter, points: POINTS[letter] ?? 1 }; });
  Object.assign(st, { time: sc.time ?? 40, hand, buildRow: Array(st.buildRow.length).fill(null), modalContent: null, modalQueue: [], isPaused: false });
  return save;
};

const runScenario = async (browser, base, sc, index) => {
  const name = sc.name ?? `scenario-${index + 1}`;
  const out = { name, popups: [] };
  const page = await newPage(browser);
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [SAVE_KEY, JSON.stringify(applyScenario(base, sc))]);
  await page.reload();
  await page.waitForTimeout(1500);
  await page.locator('button', { hasText: 'RESUME' }).click();
  await page.waitForTimeout(1500);

  if (sc.usePowerPlay) {
    const pocket = page.locator('button:visible', { hasText: /▶\s*USE/i }).first();
    if (!(await pocket.count())) out.error = 'No PowerPlay pocket button found';
    else {
      await pocket.click();
      await page.waitForTimeout(800);
      const confirm = page.locator('button:visible', { hasText: /^\s*(use|activate)/i }).first();
      if (await confirm.count()) await confirm.click();
      await page.waitForTimeout(800);
      out.popups.push(...await dismissPopups(page));
    }
  }
  if (sc.tap) {
    await page.locator(`[aria-label="${sc.tap}"]`).first().click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: join(outDir, `${name}-tap.png`) });
    out.popups.push(...await dismissPopups(page));
    const close = page.locator('button:visible', { hasText: /^\s*close/i }).first();
    if (await close.count()) await close.click();
  }
  if (sc.word) {
    for (const letter of sc.word.toUpperCase()) {
      const tile = page.locator(`[aria-label^="Tile ${letter} "]`).first();
      if (!(await tile.count())) { out.error = `No ${letter} tile left for ${sc.word}`; break; }
      await tile.dispatchEvent('pointerdown');
      await page.waitForTimeout(120);
    }
    if (!out.error) await page.locator('button', { hasText: 'SUBMIT' }).click();
  }
  await page.waitForTimeout(sc.waitMs ?? 2500);
  await page.screenshot({ path: join(outDir, `${name}.png`) });
  out.popups.push(...await dismissPopups(page));
  await page.waitForTimeout(400);

  const save = (await page.locator('button:visible', { hasText: '💾' }).count()) ? await saveRun(page) : null;
  if (!save) {
    out.result = 'No run to save (game over?)';
  } else {
    const gs = save.gameScreenState.gameState;
    const word = [...gs.log].reverse().find(e => e.type === 'word' && e.status === 'valid');
    Object.assign(out, {
      time: save.gameScreenState.time,
      score: gs.score,
      lastWord: word && sc.word ? { word: word.word, score: word.score, bonuses: word.bonuses.map(b => `${b.name}: ${b.description}`) } : undefined,
      charms: gs.activeCharms.map(c => c.id),
      pocket: gs.availablePowerPlays.map(p => p.id),
      armed: Object.keys(gs.activePowerPlays),
      events: gs.log.filter(e => e.type === 'event').map(e => `${e.icon ?? ''} ${e.name}: ${e.scoreChange >= 0 ? '+' : ''}${e.scoreChange}`.trim()),
    });
  }
  out.screenshot = join(outDir, `${name}.png`);
  await page.close();
  return out;
};

const browser = await chromium.launch();
try {
  const base = await baseSave(browser);
  for (const [i, sc] of scenarios.entries()) console.log(JSON.stringify(await runScenario(browser, base, sc, i), null, 2));
} finally {
  await browser.close();
}
