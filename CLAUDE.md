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
npx vitest run         # unit tests (~500)
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
| PowerPlays / charms (75 / 100) | `data/powerPlays.ts`, `data/charms.ts` |
| Secret bonuses (78 words, 10 scores) | `data/secretBonuses.ts`; preview all at `/?bonuses` |
| Bosses (24) and Boss Badges | `data/bosses.ts` (villains, rules), `BOSS` in `config/gameplay.ts` (timing, rewards); badges in the profile (`recordBossBadge`) |
| Cosmetics, streak milestones, themes, missions | `data/cosmetics.ts`, `data/packs.ts`, `data/missions.ts` |
| Dictionary | `data/internalWords.ts` (words with definitions), `words/custom.txt`, `words/blocked.txt`, `words/no-suggest.txt` |
| Online leaderboard | `services/onlineLeaderboard.ts` (Firebase REST, no SDK); rules in `docs/LEADERBOARD.md` |
| Local players and player IDs | `services/players.ts` (who's playing, `playerKey()` for per-player saves), `services/career.ts` (ID stats), `components/IdCard.tsx`, `services/screens/ProfileScreen.tsx` |
| Usage stats (bosses, missions, power words, runs) | `services/stats.ts` → Firebase `/stats`; read at `/?stats` (`components/StatsPage.tsx`); events and rules in `docs/LEADERBOARD.md` |

Descriptions read their numbers from config in template strings, so text always matches the rules.
Keep it that way.

## Content and dictionary changes

Use the **add-game-content** skill (`.claude/skills/add-game-content/`) for new bonus words,
PowerPlays, charms, cosmetics, missions, and dictionary words. It has the house style, balance
guardrails, wiring guide, and helper scripts (`content-check.mjs`, `word-check.mjs`,
`add-words.mjs`, `playtest.mjs` for real-game checks).

## Decisions to remember

- **Minimum word length is 3.** 2-letter words are in the dictionary but can't be submitted.
- **Levels** every 18 words. Tiers: WARM-UP 1–3, HEATING UP 4–6, OVERDRIVE 7–10, MELTDOWN 11+. After
  level 6 the clock speeds up faster (to x2.0), words earn less time (to 65%), and the PowerPlay
  meter grows (25 → 60 letters).
- **Pop-ups:** big notices (level-up, milestones, secret bonuses, Golden Round, Power Word, big
  combos) wait for Continue. Only quick PowerPlay/charm results auto-close.
- **Level-ups** have their own look (`components/LevelUpCard.tsx`, data from `levelUpInfo()` in
  `services/rules.ts`): a tier-colored stage card with old → new rows, a full-screen takeover on a
  new tier (4, 7, 11) and a red "WARNING · BOSS LEVEL" takeover on boss levels (3, 6, 9...), a boss
  warning the level before, always first in the pop-up queue, then the level badge flashes.
- **Shuffle** is press-and-hold (450 ms), adds +5 s, and never pauses the clock.
- **Tiles** act on touch-down (pointerdown), not click.
- **Combo Breaker:** next 3 words, each 4+ letter word scores x3, a shorter word scores 0 and ends
  it. Strikes don't end it.
- **Boss rounds:** every 3rd level, a villain's rule covers the next 8 valid words. Land 6 hits
  (words that follow it) for the Boss Badge (points + time that skips the level shrink); 4–5 hits
  pays points only. Breaking the rule never costs anything: the word still scores. Bosses go
  early → mid → late, random within a tier. Boss Badges are permanent (one per boss) and show
  on the Top 50 as 🏅N; Firebase needs the `bosses` rule line in `docs/LEADERBOARD.md`.
- **Power words** (secret words with `effect`): SLOT (slot machine, +1/3/10s), SNOW (clock frozen
  10s), HEAL (remove a strike, else +100), SLOW (half-speed clock for 3 words), TWIN (clone your
  best word's time + a Word Combo step). They fire on submit, apply to the next round, and can
  fire again once per level; other secrets are once per run. Values in `POWER_WORD_EFFECTS`.
- **Run-savers** are once per run. Time from items goes through `bonusTime()`.
- **Slurs:** never unblock a word without the owner's confirmation. Allowed slur-adjacent words
  (COON, DINK, FAG and its verb forms) are on `words/no-suggest.txt`, so the game never offers them.
- **Every run starts from a fresh state** (`createInitialGameState()`). Copy nested state before
  changing it; shared objects once leaked charm offers between runs.
- **Firebase rules** live in the Firebase console; `docs/LEADERBOARD.md` mirrors them. Sync both.
- **Local players:** each name on a device has its own stats, Boss Badges, streak, Collection,
  personal best and equipped badge/title (saved under `key#slot`; the first player keeps the
  original keys). Credits, shop purchases, themes, missions and the saved game are shared.
  New per-player data goes through `playerKey()`. Each score posts an ID `card` snapshot that the
  Top 50 shows when a row is tapped; it needs the `card` rules in `docs/LEADERBOARD.md`.
- **Usage stats** are anonymous and silent (the owner chose no notice or opt-out). Keep them
  that way: no names, no device ids, only the fields the `/stats` rules allow. A new event type
  needs a rules update too.
- Signature bonus: **TEX** (+300) is the owner's college nickname; keep regular words below that.

## Open ideas

- If late-game PowerPlay/charm time still dominates (see the Game Over "TIME EARNED" panel), make
  time PowerPlays rarer after level 6.
- Missed-words list, more hard PowerPlay missions, medium charm missions, easy secret missions.
