# Word Nerd: project memory

A fast, retro arcade/VHS word game (80s–2010s pop culture, neon, punny). Players build words from
an 8-tile rack against a time bank. Live at https://wordnerd-game.netlify.app (Netlify deploys
`main` automatically). Repo: canaroo/word-builder-bonanza.

## How the owner works

- **Ship everything live right away.** For each change, bump the version, commit, push the working
  branch, open a PR, merge it, then fast-forward the branch to `origin/main` and push. Patch version
  for fixes and small tweaks, minor version for features and content drops.
- **Ask first on open-ended work.** For anything with real choices, ask 2–4 clarifying questions
  (with AskUserQuestion), propose options with a recommendation, then build. Small, clear fixes:
  just do them.
- **Show the numbers.** When changing balance, explain the old and new values and the effect (a
  quick simulation or word-list stats beats a guess).
- **Report back plainly:** what changed, how it reads in game, how it was checked, where to tweak.
- Default file output is Markdown. Use they/them for the owner.

## Stack and commands

Vite + React + TypeScript + Tailwind, Vitest (jsdom), PWA (vite-plugin-pwa).

```bash
npm run words          # rebuild public/words/*.txt (also runs before dev, test and build)
npx tsc --noEmit -p .  # typecheck
npx vitest run         # unit tests (~470)
npm run build          # prebuild runs words + check:bonuses
```

Check UI changes at phone size (390×844) with Playwright against `npx vite preview --port 4173`
(Chromium is at /opt/pw-browsers). Start the preview with `run_in_background`; never `pkill -f`
(it kills the shell). Select tiles by `aria-label^="Tile "`, not position. Some test words trigger
secret bonuses and pop-ups; dismiss "Continue/Take/Equip" buttons in scripts. To test a mid-run
state, save a game, edit `localStorage.wordBuilderBonanzaSave` (`gameScreenState.gameState`), then
Resume.

## Where things live

| What | Where |
|---|---|
| Gameplay tuning (time bank, levels, tiers, word-time shrink, meter growth, Snitch, Golden Round) | `config/gameplay.ts` (`GAMEPLAY`, `TIME_BONUS`, `POWER_PLAY_VALUES`, `CHARM_BONUS`) |
| Economy (credits, theme prices, missions, streak freeze, Power Word bonus, 8 AM reset) | `config/progression.ts` |
| Pure rules (levels, clock speed, word time, meter, bonus time) | `services/rules.ts` |
| Scoring | `services/gameUtils.ts` `calculateScore` |
| Game state, reducer, turn logic | `services/screens/GameScreen.tsx` (large) |
| Game UI and pop-ups | `services/screens/GameScreenView.tsx` |
| PowerPlays / charms (74 / 61) | `data/powerPlays.ts`, `data/charms.ts` |
| Secret bonuses (65 words, 10 scores) | `data/secretBonuses.ts`; preview all at `/?bonuses` |
| Cosmetics, streak milestones, themes, missions | `data/cosmetics.ts`, `data/packs.ts`, `data/missions.ts` |
| Dictionary | `data/internalWords.ts` (words with definitions), `words/custom.txt`, `words/blocked.txt`, `words/no-suggest.txt` |
| Online leaderboard | `services/onlineLeaderboard.ts` (Firebase REST, no SDK); rules in `docs/LEADERBOARD.md` |

Descriptions read their numbers from config in template strings, so text always matches the rules.
Keep it that way.

## Content and dictionary changes

Use the **add-game-content** skill (`.claude/skills/add-game-content/`) for new bonus words,
PowerPlays, charms, cosmetics, missions, and dictionary words. It has the house style, balance
guardrails, wiring guide, and helper scripts (`content-check.mjs`, `word-check.mjs`,
`add-words.mjs`).

## Decisions to remember

- **Minimum word length is 3.** 2-letter words are in the dictionary but can't be submitted.
- **Levels** every 18 words. Tiers: WARM-UP 1–3, HEATING UP 4–6, OVERDRIVE 7–10, MELTDOWN 11+. After
  level 6 the clock speeds up faster (to x2.0), words earn less time (to 65%), and the PowerPlay
  meter grows (25 → 60 letters).
- **Pop-ups:** big notices (level-up, milestones, secret bonuses, Golden Round, Power Word, big
  combos) wait for Continue. Only quick PowerPlay/charm results auto-close.
- **Shuffle** is press-and-hold (450 ms), adds +5 s, and never pauses the clock.
- **Tiles** act on touch-down (pointerdown), not click.
- **Combo Breaker:** next 3 words, each 4+ letter word scores x3, a shorter word scores 0 and ends
  it. Strikes don't end it.
- **Run-savers** are once per run. Time from items goes through `bonusTime()`.
- **Slurs:** never unblock a word without the owner's confirmation. Allowed slur-adjacent words
  (COON, DINK, FAG and its verb forms) are on `words/no-suggest.txt`, so the game never offers them.
- **Every run starts from a fresh state** (`createInitialGameState()`). Copy nested state before
  changing it; shared objects once leaked charm offers between runs.
- **Firebase rules** live in the Firebase console; `docs/LEADERBOARD.md` mirrors them. Sync both.
- Signature bonus: **TEX** (+300) is the owner's college nickname; keep regular words below that.

## Open ideas

- If late-game PowerPlay/charm time still dominates (see the Game Over "TIME EARNED" panel), make
  time PowerPlays rarer after level 6.
- Missed-words list, more hard PowerPlay missions, medium charm missions, easy secret missions.
