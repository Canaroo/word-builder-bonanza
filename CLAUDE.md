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
tap ▶ Continue (wait out the 3-2-1 countdown before tapping tiles).

## Where things live

| What | Where |
|---|---|
| Gameplay tuning (time bank, levels, tiers, word-time shrink, meter growth, Snitch, Golden Round) | `config/gameplay.ts` (`GAMEPLAY`, `TIME_BONUS`, `POWER_PLAY_VALUES`, `CHARM_BONUS`) |
| Economy (credits, theme prices, missions, streak freeze, Power Word bonus, 8 AM reset) | `config/progression.ts` |
| Pure rules (levels, clock speed, word time, meter, bonus time) | `services/rules.ts` |
| Scoring | `services/gameUtils.ts` `calculateScore` |
| Game state, reducer, turn logic | `services/screens/GameScreen.tsx` (large) |
| Game UI and pop-ups | `services/screens/GameScreenView.tsx` |
| PowerPlays / charms (103 / 108) | `data/powerPlays.ts`, `data/charms.ts` |
| Charm sets, Mystery Tape, Phoenix Down, power word hint (v7.41) | `data/charmSets.ts`, `CHARM_SET_BONUS` and `MYSTERY_TAPE` in `config/gameplay.ts`, `PHOENIX_DOWN` in `config/progression.ts`, `services/powerWordHint.ts` |
| Borrowed mechanics (v7.42-7.44): Last Words, Head Start, Skill Shot, Gem Tiles, Fork, Hold Slot, Grudge Match, Bones | `LAST_WORDS`, `HEAD_START`, `SKILL_SHOT`, `GEM_TILES`, `FORK`, `HOLD_SLOT`, `GRUDGE`, `BONES` in `config/gameplay.ts`; `services/headStart.ts`, `services/grudges.ts`, `services/bones.ts`; cards in `components/` (`LastWordsCard`, `ForkCard`, `BonesCard`) |
| Secret bonuses (120 words, 10 scores) | `data/secretBonuses.ts`; preview all at `/?bonuses` |
| Hidden desktop pages | `/?stats` and `/?bonuses` (tabs: `&tab=words`, `scores`, `counts`, `charms`, `powerPlays`) render full-width outside the phone frame (`showToolPage` in `App.tsx`) |
| Bosses (24) and Boss Badges | `data/bosses.ts` (villains, rules), `BOSS` in `config/gameplay.ts` (timing, rewards); badges in the profile (`recordBossBadge`) |
| Cosmetics, streak milestones, themes, missions | `data/cosmetics.ts`, `data/packs.ts`, `data/missions.ts` |
| Dictionary | `data/internalWords.ts` (words with definitions), `words/custom.txt`, `words/blocked.txt`, `words/no-suggest.txt` |
| Online leaderboard | `services/onlineLeaderboard.ts` (Firebase REST, no SDK); rules in `docs/LEADERBOARD.md` |
| Local players and player IDs | `services/players.ts` (who's playing, `playerKey()` for per-player saves), `services/career.ts` (ID stats), `components/IdCard.tsx`, `services/screens/ProfileScreen.tsx` |
| Daily Run (one shared deal a day) | `services/daily.ts` (seed, one scored try, share text), `DAILY_RUN` in `config/progression.ts`, board at `daily/<day>` in Firebase |
| Usage stats (bosses, missions, power words, runs, charm and PowerPlay offers, picks and uses) | `services/stats.ts` → Firebase `/stats`; read at `/?stats` (`components/StatsPage.tsx`); events and rules in `docs/LEADERBOARD.md` |

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
  meter grows (25 → 60 letters). **Overtime** (v7.47.0, `GAMEPLAY.overtime`): those ramps leveled
  off at 15-17, so top players coasted to level 18-24 and 60-80k (the 80k run got 43% of its time
  from charms and PowerPlays). From level 12 the clock adds 4% a level (to x2.4) and word time
  loses 2% a level (to 55%); the level-12 card shows an OVERTIME banner. Simulated: top player's
  median level 21 → 17 (best 10%: 24 → 18), strong 15 → 14, typical runs untouched.
- **Tap guard (v7.59.0, the owner's priority: players must not close an explainer by accident):**
  every pop-up that opens on its own swallows taps for `MODAL_ARM_MS` (1 s) behind a clear layer
  with a filling "READ ME" bar (`components/ModalTapGuard.tsx`, rendered by `GameScreenView` keyed
  on the card's type/title/id/level). Cards the player opened (info, logs, activations) are listed
  in `GUARDLESS_MODALS`; Last Words and Phoenix Down keep their own 1.5 s guard. Browser scripts
  wait about 1.1 s before tapping a card's button.
- **Pop-ups:** big notices (level-up, milestones, secret bonuses, Golden Round, Power Word, big
  combos) wait for Continue. Chance PowerPlays (rolls, coin flips, random tiles) show their
  result on a centered outcome card (`outcome()` in `GameScreen.tsx`, `components/OutcomeCard.tsx`)
  that also waits for Continue. Only other quick PowerPlay/charm results auto-close.
- **Decision gambles are push-your-luck** (`components/GambleCard.tsx`): Minesweeper, Let's Make a
  Deal, No Whammies! and Deal or No Deal keep going round after round until the player banks (or
  takes the deal) or busts; a bust wipes the pot, nothing more. One-roll gambles (Plinko, Hot Tub,
  Lucky Charms) stay single-shot. Plinko (v7.36.3) is a gamble card with a board (`Plinko` in
  `GambleCard.tsx`): slide the chip, drop it, it bounces down 9 peg rows (click + buzz per peg) into
  a slot. The prize is rolled from `POWER_PLAY_VALUES.plinko` on drop (odds unchanged) and saved;
  `PLINKO_SLOTS`, `plinkoSlotFor` and `plinkoPath` in `services/rules.ts` draw where it lands.
  No Whammies! (v7.39.1) is a Press Your Luck board: a light races around 12 squares
  (`WHAMMY_BOARD`), STOP rolls the result (`whammySpin`: Whammy at `whammyChance`, else cash from
  `whammyCash`, which averages the old +150) and the light slows onto a matching square. Luck, not
  timing; the roll is saved before the light lands, so a quit can't reroll it.
  (v7.44.4: the roll is made once, `hotTubIndex`. It used to be rolled again for each outcome it
  was compared with, so 29% of spins matched nothing and froze the card, and the odds were off.)
  Hot Tub Time Machine (v7.36.4, `HotTub`): hold to crank a year dial, let go, it spins down onto
  +25 s (1986), +10 s (2006) or -8 s (2036); rolled on release from `POWER_PLAY_VALUES.hotTub`.
  Lucky Charms (`LuckyCharms`): shake the cereal box, a charm tumbles out and flips, and a bumped
  charm wobbles. The game picks the charm on use and passes it in the pop-up's data (`charmId`,
  `replaceId`, read as `extra`); the card returns it as `charm` and `handleResolveGamble` equips it. Ladders, rounds and offers in `POWER_PLAY_VALUES`.
  After a bank, each shows what would have come next, then pays on "Take the N": Minesweeper the
  mine (and the odds the next pick had), Card Sharks the next card, Let's Make a Deal the doors you
  passed on, No Whammies! the next spin, Deal or No Deal your case (when you take the deal).
  An open gamble card keeps its board in the pop-up (`useSaved` in `GambleCard.tsx`, action
  `SET_GAMBLE_STATE`), so quitting and resuming restores it instead of redealing. New card games
  use `useSaved` for any state, especially the opening deal.
- **Golden Round reworked (v7.60.0, `GAMEPLAY.goldenRound`):** the Golden word used to be raw tile
  points x2 (x6 with the Golden Tile), skipping length, charms and upgrades: a median 108 points,
  about half a normal word from level 7 on. Now it scores like a normal word (tiles incl. x2 tiles,
  length, charms from `calculateScore` with `roundType: 'normal'` and no PowerPlays, upgrades,
  long-word boost), then x2 as a "🌟 Golden Round" line, x4 with the Golden Tile ("🌟 Golden Tile").
  Browser-checked: PATRONS with Rubik's Cube 572 with the tile (old rules: 132), 286 without. The
  Golden Tile comes from the tile stream (`tileRoll()` in `gameUtils.ts`, same on the Daily), Golden
  words open Score Gates (`openGates`), and a missed round no longer raises the next target. The ★
  GOLDEN box has a bar and turns into "★ N MORE!" with a glow from `chipFrom` words away.
- **Clarity batch (v7.61.0, from `docs/FEATURE_REVIEW.md`):**
  **Charm sets pay as you build** (`setPayFor`, `payingSets`, `leadingSet` in `data/charmSets.ts`;
  `CHARM_SET_BONUS`): a full set was held in 2 of 56 runs. 2 of a trio now pays +50, the full trio
  +150 (was 100), a pair +50 when whole. A 🧩 chip above the hand shows the best started set
  ("📺 2/3 · +50 A WORD · +150 AT 3/3"); offer notes say what a pick starts paying or a drop loses.
  **Next-gate marker** (`nextGateFor`, `previousGateFor` in `services/rules.ts`): "🚪 10K GATE" with a
  bar under the score, pink and pulsing within `GATES.markerGlowWithin` points.
  **Power word hint** says the prize (`prize` in `powerWordInfo`, e.g. "POWER WORD: REMOVE A STRIKE ·
  TAP"); a tap lights the word's tiles in no order (`powerLit` on `TileComponent`, `word` on the
  hint, never shown as text); a second tap opens the old info card. It led to 6 plays in 88 hints.
  **Mystery Tape** pays `points` (75) on take and `usePoints` (100) when the PowerPlay inside is used
  (`tapeBonusId`, paid by `payTapeUse` in the reducer wrapper; a swap drops it); the pocket button
  shows "📼+100". 31% of tape PowerPlays were never used against 4% of face-up picks.
- **Set notes reworded (v7.61.2, the owner found them confusing):** offer cards explain sets in
  plain sentences in the body font, in a small box (`SetNote` in `OfferModals.tsx`): "Part of the
  🧩 ☕ Central Perk set (this makes 1 of 2). Also hold 🛋️ PIVOT! and every word earns +50." The
  Billy Joel trio is now named **Billy Joel Night** (id `greatestHits` kept), so it no longer
  shares a name with the Greatest Hits replay feature. Italian Restaurant Ending's text names the
  song: "Billy Joel's Scenes from an Italian Restaurant: any word that ends in A, I or O...".
- **REDRUM text (v7.61.3, the owner's ask; same effect):** "Your next word scores x2, guaranteed. If
  it's a 4+ letter word that's also a word spelled backward, like STAR (RATS) or LIVE (EVIL), it
  scores x5 instead."
- **Content drop v7.62.0 (5 charms, 2 PowerPlays; the owner picked all from a proposal):**
  **📈 Stonks** (`stonks`): 4+ letter words earn +8 x the run level (`stonksPoints`), aimed at the
  52-62% of late charm offers that were passed; upgradable. **💍 Shine Bright Like a Diamond**
  (`shineBright`): gems one step bigger plus a x2 gem from 5 letters (`SHINE_BRIGHT_GEMS`,
  `gemMultiplierFor(length, shineBright)`; the gem card lists them). **🛩️ I Feel the Need… for
  Speed** (`needForSpeed`): Danger Zone x1.75 instead of x1.5 (`dangerPointsFor`, also on the Fork
  card and chip); offered from level 4 only. **🗝️ Are You the Keymaster?** (`keymaster`): Score
  Gates pay +50% (`APPLY_MINIGAME` with `flat`; the outcome card shows "🗝️ Keymaster +50%: 1,000 →
  1,500"); offered from 5,000 points and while a gate is left. **🔀 Freaky Friday**
  (`freakyFriday`): a 4+ letter anagram of an earlier word this run scores x3
  (`freakyFridayMatch`); simulated: a player hunting it lands about 1.4 in 60 words, 9.5 in 180
  (casual 0.1-0.5). **🌀 Inception** (`inception`, prize): 3 words, each everyday word hiding inside
  pays +50 (`dictionaryService.hiddenWords`, a `hidden` worker request, `hiddenWordsIn` in
  `services/wordIndex.ts`); 79% of 5-letter words hide one. **🧱 Jenga!** (`jenga`, prize): blocks
  pay 50, 100, 150... up to 6 (+1,050, `jengaPot`); hold the 🧱 chip `jengaHoldMs` to cash out
  (`JENGA_CASH`); a word under 4 letters (`completeSubmission`), an invalid word or a strike
  (`ADD_STRIKE`) topples it. Browser-checked with playtest.mjs (updated for the Play chooser, the
  tap guard and autosave; it now blocks Firebase).
- **Feature tracking (v7.61.1):** `fork` (choice incl. `bail`, level, clock, advice), `golden`
  (level, score, tile, ok), `gate` (gate, played/skip, points) events; `pp_use` extra `tape`;
  `run_end` extras from `runEndExtras()` (golden, route, bails, skill, gems, lastWords). Shown in a
  "Mid-run features" table on `/?stats`. The rules in `docs/LEADERBOARD.md` must be pasted into the
  Firebase console; until then the new events are dropped and the extras fall back.
- **WILDCARD (v7.50.0)** (`wildcard`, `Wildcard` in `GambleCard.tsx`, odds in
  `POWER_PLAY_VALUES.wildcard`): a pocket gamble card. The owner's GIF plays at the top
  (`public/powerplays/wildcard.webp`, v7.50.1: the van "YEEEHAAAAA!" clip from the owner's imgur
  link, an animated WebP at 360 px, 75 KB instead of the 1 MB GIF; a spinning 🎡 shows if it fails), then SPIN runs a light
  around four outcomes and slows onto the roll (rolled once, saved): +5 s 30%, +500 30% (a prize,
  grows with the level), a free tile of the player's choice 30% (any letter, `ADD_FREE_TILE`: an
  empty slot no word-row tile returns to, else an extra slot; the next hand is dealt fresh, so it
  lasts this hand), a strike 10% (the owner's call: a real strike through `ADD_STRIKE`, so a shield
  blocks it and it can end the run; the card says when a shield is up). Keep animated images small:
  convert GIFs to animated WebP with ffmpeg (`-c:v libwebp -loop 0 -q:v 60`, about 360 px wide)
  before committing (`gif` and `webp` are in the PWA precache list).
- **Tick-Tock Croc (v7.51.0)** (`tickTockCroc` charm, `components/CrocCard.tsx`, values
  `tickTockCroc`, `crocEvery`, `crocWinChance`, `crocLoss` in `TIME_BONUS`): a chance-for-time
  charm, the owner's design. Every 25 valid words while it's equipped (`gameState.crocWords`, reset
  when it's equipped; `crocModal` queues the `croc` pop-up after the word), the croc surfaces and
  the player picks 1 of 3 clocks: 60% +10 s (charm time through `bonusTime()`, so never more than
  10, and the card shows this level's amount), 40% -300 points (fixed, never below 0). The result is
  rolled when the croc surfaces and saved in the pop-up, so a quit can't reroll it. Expected per 100
  words held: about +24 s and -480 points. The longer it's held, the more rolls.
- **Greatest Hits (v7.52.0)** (`GREATEST_HITS` in `config/gameplay.ts`, `services/greatestHits.ts`,
  `components/GreatestHitCard.tsx`, the owner's idea): replaying a word "goes platinum". The first
  3-letter word played 3 times in a run goes 📀 GOLD (+500); a 4-letter word 4 times 💿 PLATINUM
  (+1,000); 5 letters 5 times 💎 DIAMOND (+1,500); then 6-8 (+2,000 to +3,000, about never). Each
  record pays once a run, in any order, as a separate reward after the Danger Zone multiplier
  (not multiplied or level-boosted). Plays are counted from the log (valid words, any case), so
  undo and resume stay consistent; `gameState.hitsClaimed` holds the lengths already paid. The
  owner first wanted +500, +1,000, +1,500 for 3, 4, 5... plays of any word, but that could be
  farmed (TEA 30 times in a long run would pay 200,000+), so letters must match plays.
  Simulated (best word per length, 8-tile hands): 3x3 in 98% of 59-word runs; 4x4 in 23% of
  59-word and 94% of 180-word runs; 5x5 in 6% of 180-word and 26% of 292-word runs. Players see a
  record card (spinning disc, "TEA WENT GOLD", "That's the 3rd time...", NEXT ON THE CHARTS), a
  chip above the tiles once a word has 2 plays ("TEA 2/3 · ONE MORE FOR GOLD +500", the closest
  word only), a score line, an event log entry and a How to Play section. Not the WALL-E charm
  (which used to be named Recycler: reusing letters from the last word).
- **Psychic Friends Network, reworked (v7.54.0)** (id `psychicFriends` kept; `PsychicCall` in
  `GambleCard.tsx`, `psychicCalls` in `POWER_PLAY_VALUES`): the old tile peek was picked 16% of the
  time and used 3 times ever. Now it fires on pick like The Price Is Right (`INSTANT_POWER_PLAY_IDS`,
  `CARD_ON_PICK`, a prize card, out of the Mystery Tape pool): call your next word's length, 3 +50,
  4 +100, 5 +250, 6 +500, 7+ +1,500 (prizes grow with the level; a wrong call costs nothing).
  Prizes follow how often an 8-tile hand can spell each length (99 / 94 / 72 / 41 / 10%), so each
  call is worth about 50-200 on average. Settled on the next word in `completeSubmission`, paid
  outside the word; a chip shows the call; a Sliders undo keeps a settled call (`settledBets`).
- **Quack Attack (v7.54.0)** (`QUACK_ATTACK` in `config/gameplay.ts`, the owner's idea): playing QUA a
  fourth time in a run (`gameState.quackDone`, counted from the log) arms `quackAttack` for the next
  4 words: x4 each (a "🦆 Quack Attack" line, in `ITEM_MULTIPLIER_LINES` so it covers charm points;
  counted down in `WORD_COUNTDOWN_POWER_PLAYS`; armed after that word's own countdown), and earns the
  🦆 Quack Pack badge for good (`b_quackPack`, `earnedBy: 'quack'`). The Mighty Ducks flavor:
  "QUA · QUA · QUA · QUACK!", "Ducks fly together!". One Q per 100-tile bag, so it's a long-run
  jackpot: simulated about 0% of 59-word runs, 4% of 180 and 18% of 292 by chance, 86-87% of 180+
  word runs for a player hunting it. QUA x3 on the way earns Greatest Hits GOLD.
  Once a run (v7.54.1, the owner's call): `quackDone` starts false in `createInitialGameState()` and is
  never cleared in a run; a 5th or later QUA never re-arms or resets the x4 (browser-checked).
- **Blue Steel (v7.57.0)** (`BLUE_STEEL` in `config/gameplay.ts`, the owner's idea, Zoolander): playing
  ZOO a fourth time in a run (`gameState.blueSteelDone`, counted from the log, once a run) arms
  `blueSteel` (`{ words: 1 }`, in `WORD_COUNTDOWN_POWER_PLAYS`, armed after that word's countdown):
  the next valid word scores x5 on everything it earned (tiles, charms, bonus lines, the Danger
  Zone), paid in `completeSubmission` right after the Danger Zone as a "💙 Blue Steel" line. 0 means
  0 holds; secrets, milestones and Greatest Hits come after and aren't multiplied. Card
  `blue-steel` ("ZOO · ZOO · ZOO · ZOO", "Really, really ridiculously good-looking.", Strike the
  pose), a buffs-tray chip until it's used, and the 💙 Ridiculously Good-Looking badge for good
  (`b_blueSteel`, `earnedBy: 'zoo'`). Like Quack Attack it needs the bag's one Z, so it's a
  long-run jackpot; ZOO x3 on the way earns Greatest Hits GOLD. Browser-checked: TERN with a charm
  went 50 → 250, a 5th ZOO arms nothing.
- **Six low-pick PowerPlays reworked (v7.55.0, the owner's call; ids kept)**: each was picked about 1
  time in 25 (Polaroid 2%, Ludicrous Speed, Mission: Impossible, Duck Hunt, Money Bin 4%, Wario 8%).
  Values in `POWER_PLAY_VALUES`; cards in `GambleCard.tsx` (useSaved keeps the deal, so a quit can't
  reroll). **Shake It Like a Polaroid**: tap for 5 s, +25 per 5 shakes (max +300). **Duck Hunt**: a
  10 s shooting gallery, +50 a duck (flight plan saved). **Scrooge's Money Bin**: coins fall for 8 s;
  v7.55.1 (the owner's call: 6 Credits didn't move anyone) made them clock time: 1 / 2 / 3 seconds
  each (the faster a coin falls, the more it's worth; 50 / 30 / 20% of coins), about 22 s on offer,
  capped at +15 s (`moneyBinCoins`, `moneyBinMaxSeconds`); a time card now (`TIME_CARD_IDS`).
  **Wario Warp**: three bags, +300/-5 s, +600/-10 s, +900/-15 s, the seconds taken at once; bags that
  cost the whole clock are greyed out (`clock` in the card's data). **Mission: Impossible**: fires on
  pick; a dossier card deals one of `MISSIONS` (`services/rules.ts`: a J/K/Q/X/Z word, 6+ letters,
  ends in ING, same first and last letter, 3+ vowels, a double letter); Accept arms it for 3 words,
  +400 if pulled off (paid outside the word), nothing lost if not; no longer a time card.
  **Ludicrous Speed**: a 15 s sprint, the clock frozen (`freezeLeft`, like SNOW) and every word x2;
  it ends in `TICK_FREEZE`; a chip shows "🚀 LUDICROUS SPEED · x2 · 14sec". Point prizes grow with
  the level. Old armed states from saves settle the old way or just end.
- **Nine underused, overcomplicated items simplified (v7.58.0, the owner's call; ids kept).** From the
  200-run stats (Oct 29 - Nov 18): an average card is picked about 26% of the times it's offered;
  these were 0-12%, with long or fiddly rules. Names were checked against the new rules: only Vote
  for Pedro changed. **Mixtape** (0 of 20): start a word with the last letter of your previous word,
  a flat +75 (was a chain, +40 rising to +120, reset by a break). **Italian Restaurant Ending**
  (Billy Joel set): words ending in A, I or O, +50 (was ending in AN, +100: 0.4% of words).
  **Why? Because Chuck Norris.**: Y words score x2 (`chuckNorrisMultiplier`; was a random tile
  turned 2x). **Clever Girl** (Dino DNA set): words starting with a RAPTOR letter (R, A, P, T, O),
  +30 (was 3 of those letters anywhere, +60). **Cross the Road**: every 3rd word of 5+ letters
  pays +150, in a row or not; short words and strikes no longer reset it. **Average Joe's** (was
  Vote for Pedro; Dodgeball, 🤾, "If you can dodge a wrench..."): 4+ letters, every tile worth 1
  point, +75 (was +50). **REDRUM**: the next word x2, x5 if it's also a word backward (was x4 on
  reversible words only, over 3 words; used 0 times). **Daily Double**: bet a flat 200
  (`dailyDoubleBet`, never more than the score); a 5+ letter next word wins +400 (`dailyDoubleWin`,
  a prize now, grows with the level), else lose the 200 (was 10% of the score, 100-500, "win twice
  the wager"). **Schrute Bucks**: each B, E or T in the next 5 words pays 25 right away, as a score
  line on that word (a prize; was banked until the last word). Browser-checked at 390x844.
- **Multi-word PowerPlays (v7.28)** settle in `completeSubmission` and pay outside the word, with
  a progress chip above the hand (`components/PowerPlayTrackers.tsx`): Tamagotchi (pot), Time
  Capsule (buried word), Smell Ya Later! (rival race), Winner Winner Chicken Dinner (each valid word
  deals a random card, tap the chip to stand), Hadouken! (boss hits), The Price Is Right (bid), Psychic Friends Network
  (next tiles). Jackass takes a strike on purpose (shields don't stop it, never the last strike).
- **Timed, blind and bet PowerPlays fire on pick** (`INSTANT_POWER_PLAY_IDS`): Pop Quiz, Hotshot,
  Smell Ya Later!, Bird Box, Daily Double and Mission: Impossible start on the fresh hand when chosen
  from the offer.
  Held in the pocket, a player could wait for (or build) the right word, then activate and submit.
  New timed or bet ones go there too. Daily Double's wager is never more than the score (it isn't
  offered under 100 points), and a Sliders undo keeps a settled Daily Double or Price Is Right bet. It also
  doesn't re-arm a coin flip the word used (Heisenberg, Double or Nothing, Blue Shell, Space Invader)
  or Scrooge's Money Bin (its Credits are paid outside the run): `settledFlips` in `RESTORE_LAST_TURN`.
  Random-tile PowerPlays (`RANDOM_TILE_POWER_PLAYS`: One Tile to Rule Them All, Ice Ice Maybe,
  Morphin Time, Red Wedding, Rescue Rangers) put the word-building row back in the hand first, so
  parking tiles there can't steer the pick. Add new random-tile ones to that set.
  Pop Quiz times itself in real seconds (`quizMs` on the screen state: play time plus frozen
  seconds; `startMs` on the quiz), not by the bank clock, which runs up to x2 and jumps on Shuffle.
  A chip above the hand counts down (`quizLeft`). Smell Ya Later!'s rival scores per real second the same way
  (`startMs` on the race, reset each word), and its chip shows the rival's score climbing (`raceRival`).
  Since v7.47.1 the rival races at the player's own pace (`rivalRateFor`: score per second of play
  this run x `rivalPace`, floor 15/s, stamped as `rate` on the race at pick time); at a flat 3/s he
  scored about 37 to the player's 380 (median pace in the stats: 31 points a second). Multiplicity shows what it would copy on the offer
  card, the pocket button ("▶ COPY 🍫 Gump Luck", or NOTHING TO COPY) and its info pop-up.
  The Price Is Right fires on pick too (v7.36.5): its bid card opens in the offer's place, so a
  player can't build a word, read its score and then bid. Fire-on-pick PowerPlays with a card
  (`CARD_ON_PICK`: Price Is Right, Mission: Impossible, Fluncle, Thwomped) set `modalContent`
  directly and skip closing the offer: a card queued behind the offer was wiped when closing the
  offer started the next round (v7.39.2). Multiplicity opens a read-first card with
  the copy target's full description (`handleActivatePowerPlay(pp, confirmed)`). The charm swap
  screen lists every equipped charm compactly and marks upgraded ones (⭐ UPGRADED, lost if dropped).
  Bird Box peeks only when tiles it hasn't shown yet arrive (a tap or a returned tile never re-peeks,
  and resuming a blind run doesn't either): `seenIds` in `GameScreenView.tsx`.
- **Balance from usage stats (v7.29.0, 50 runs):** a PowerPlay offer shows at most one time card
  (`TIME_CARD_IDS`, `limitTimeCards`): time cards were picked 59% of the time against 10-20% for
  the rest. Vowel Lover (now Vanna's Vowels) keeps +20 a vowel but every word costs 1 s (`theValveSeconds`; it was +61 a
  word for free). E.T. Phone Home +30 → +15 per E. Power Star Residual turns on at 60 (was 150).
  Pull the stats with `curl .../stats.json` (the session's environment allows the Firebase host).
  v7.29.1 reworked three never-picked PowerPlays (ids kept for stats): Scrooge's Money Bin (fires
  on pick; a 40+ next word earns 3 Credits, no cost), Duck Hunt (Zapper: shoot a tile, a random
  replacement is worth 3x), Wario Warp (+300 now for 10 s). v7.52.1 says Wario's cost plainly (the
  owner found "starts 10 seconds lower" unclear): "you lose 10 seconds off your clock when your next
  hand is dealt" on the card and in the message, a buffs-tray reminder until it's paid, and "💰 Wario's
  bill: you lost 10 seconds off your clock" when it comes off (`warioTimeDebt` in `START_NEXT_ROUND`).
- **Daily Run (v7.30):** one deal a day from a date seed (8 AM reset, `dayKey`; #1 = 2026-11-07).
  Seeded: the tile bag and tile luck (`setTileStream` in `gameUtils.ts`; its position is saved as
  `gameState.daily.rng`), offers (`getOffer` ranks items by `dailyRank`, ignoring pick history), and
  bosses. Gamble rolls stay random. A player's first daily run of the day is scored (posted to
  `daily/<day>`, +5 Credits, +5 more for a top-10 finish, can go on the Top 50 with a 📅); later
  ones are practice (no posting or Credits). The daily run has its own save slot (`savedDailyGame`).
  Before the scored run starts, a pop-up explains it (same deal for everyone, one scored try, the
  Daily board and Top 50, Credits) with Start or "Not yet"; backing out doesn't use the try.
  New tile randomness in `gameUtils.ts` must use `tileRandom()`, not `Math.random()`, or the daily
  deal stops matching. Browser checks: block `firebaseio.com` so test scores don't post.
- **Start screen (v7.31):** top bar (player chip → switcher, 🔥 streak, 🪙 credits → shop, sound),
  the logo, then the actions anchored above a bottom tab bar (🏠 Play · 🏆 Top 50 · 📼 Collect sheet ·
  🛒 Shop · 🪪 Me sheet). One main button: ▶ CONTINUE when a run is saved (New Game becomes an
  outline button), else ▶ PLAY; then a Today strip (Daily Challenge chip, Power Word spin, Missions
  row that expands). **One Play button (v7.48.0):** the separate Today's Run card confused players
  (two ways to start a game, difference not shown; 13 of 134 November runs were dailies). Now the
  first Play of the day, while the daily is unplayed, opens a chooser: 🏆 Daily Challenge (same
  tiles for everyone, one scored try) or 🎲 Regular game. Either answer sticks for the day
  (per-player `dailyChooserDay`); the 📅 Daily Challenge chip in the Today strip is the way back in
  (resume, practice, share). "Today's Run" is now "Daily Challenge" everywhere players see it. The name field shows only for a new player. The version (`VER x.y.z`) shows under the tagline so the owner can check what's live. It fits one phone screen.
  Buttons use three tiers (`ArcadeButton` `variant`): solid for the one main action, `outline` for
  the rest, `text` for Cancel/Close links. Keep a screen to one solid button where possible.
  Every other menu screen uses `components/ScreenShell.tsx` (◀ back, neon title, 🪙 chip, optional
  sticky subheader) and, on tab screens, `components/BottomTabs.tsx` with its tab lit: Shop (shop),
  Collection and Boss Badges (collect, with a Secrets | Bosses switch, `CollectSwitch`), My ID (me,
  with Switch Player, Streak, How to Play, Event Logs, Missed Words; the home-screen pop-ups open via
  `openOnMount`). How to Play has the header only and folds into sections; Collection's Missing
  view folds by shelf. New menu screens should use ScreenShell rather than their own title/Back.
  The Top 50 screen has three tabs (v7.40.0): 🏆 TOP 50 by score, 🕒 RECENT (the last 50 scores
  submitted, newest first, each showing how long ago: `listRecent`, `getRecentLeaderboard`, `timeAgo`;
  it needs `timestamp` in the leaderboard's `.indexOn`, and reads the whole board until then) and
  📅 TODAY.
  Top 50, Event Logs, Missed Words and Streak are full-screen panels in that frame too (`renderPanel`
  in `StartScreen.tsx`); opened from Me, their ◀ goes back to Me. Small choices stay pop-ups.
  In a run, Golden Round, PowerPlay meter and Word Combo share one compact row (`GameScreenView`),
  and the buffs tray labels itself inline ("BUFFS 2/5").
- **Music shop (v7.53.0)** (`data/music.ts`, `services/music.ts`, `services/musicService.ts`,
  `components/SoundMenu.tsx`, `MUSIC_PRICE` and `SHOP_NEWS` in `config/progression.ts`): the shop's
  🎵 Music tab sells four original tracks at 80 Credits each: 🏡 Pixel Hometown (a cozy 3/4 waltz
  leaning on Toby Fox's soundfont-piano and music-box style, the owner's ask), 📼 Midnight Rental
  (slow synthwave), 🪙 Coin-Op Lounge (chiptune bossa) and ☎️ Dial-Up Dreams (late-90s chill beats).
  Mindscape stays free and the default. Scores and the renderer live in `tools/music` (see its
  README); files in `public/audio/shop/`, kept out of the PWA precache (`globIgnores`) and cached
  on first play, so only tracks someone hears are downloaded. Owned tracks and the pick belong to
  the device, like themes. Each card has ▶ Preview (15 s, plays even when muted, the game's music
  ducks) and Buy / Play this / ✓ Playing. The 🔊 button (start screen and in a run) opens a Sound
  panel instead of muting: sound on/off plus the owned tracks (switching crossfades); in a run the
  clock keeps running while it's open. A "🎵 NEW IN THE SHOP" banner sits above the logo until it's
  tapped (opens the Music tab), closed, or the shop is visited (`shopNewsSeen`); change
  `SHOP_NEWS.id` and text to announce the next shop drop.
- **Level-ups** have their own look (`components/LevelUpCard.tsx`, data from `levelUpInfo()` in
  `services/rules.ts`): a tier-colored stage card with old → new rows, a full-screen takeover on a
  new tier (4, 7, 11) and a red "WARNING · BOSS LEVEL" takeover on boss levels (3, 6, 9...), a boss
  warning the level before, always first in the pop-up queue, then the level badge flashes.
- **Seconds are never a bare "s" in the arcade fonts** (v7.44.4). Bungee has no lowercase, so
  "+25s" drew as "+25S" and read as "+255"; VT323 is nearly as bad. Use `<Sec />` after a number or
  `withSec()` on a string (`components/Seconds.tsx`): a small lowercase "sec" in the plain font.
  `ArcadeButton`, the message bar, plain card titles, outcome headlines and level-up rows run their
  text through it already; decade names ("'90s Throwback") are left alone. Plain body text is fine.
- **Long names on buttons** (v7.55.1): `ArcadeButton` never wraps, so "Keep 🗺️ Where in the World is
  Carmen Sandiego?" ran off the card. Buttons now clip (`max-w-full overflow-hidden`), and labels with
  an item name use `NamedLabel` (`components/ArcadeButton.tsx`): the action word stays, the name ends
  in "…". Use it for any button that shows a PowerPlay, charm or track name.
- **Shuffle** is press-and-hold (450 ms), adds +5 s, and never pauses the clock.
- **Tiles** act on touch-down (pointerdown), not click.
- **Combo Breaker:** next 3 words, each 4+ letter word scores x3, a shorter word scores 0 and ends
  it. Strikes don't end it.
- **Boss rounds:** every 3rd level, a villain's rule covers the next 8 valid words. Land 6 hits
  (words that follow it) for the Boss Badge (points + time that skips the level shrink); 4–5 hits
  pays points only. The four hardest rules (Ivan Drago, Big Boss, Cruella, Jafar) need 4 hits
  (`hitsToWin` on the boss; "so close" is always 2 below, `bossCloseHits`). Breaking the rule never costs anything: the word still scores. Bosses go
  early → mid → late, random within a tier. The event log records each fight (v7.44.7): a "Boss
  fight: X" entry with the rule when it starts, a HIT or MISS line (word N of 8, hits so far) in
  each word's breakdown, then Beat X / X got away (so close) / X escaped, or "X was still standing"
  if the run ended mid-fight. **Two-part rules say why a word missed** (v7.51.1, `missReason` on
  the boss): Magneto, Ursula and The Noid also need 4+ letters, but the dimmed tiles only show the
  letter part, so players avoided every dimmed tile with a 3-letter word, got a MISS that just
  repeated the rule, and thought Magneto was broken (its mechanics were right). Misses now read
  "too short: 3 letters, needs 4+", "shared T with CAT" or "used E", in the toast and the log.
  A new rule with more than one part should get a `missReason`.
  **Ivan Drago (v7.54.2):** BEAT YOUR LAST: SCORE OR LENGTH (a word scores more than the last one,
  or has more letters), 5 hits (was score only, 4 hits, won 1 of 12). The owner kept the four 100%
  early bosses (Cobra Commander, Mojo Jojo, Oogie Boogie, King Hippo) as warm-ups on purpose.
  **Magneto fairness check (v7.53.3):** the rule and the dimmed tiles agree in every path: both read
  the last *valid* word from the log (invalid words don't change it; a Golden Round word counts as
  the last word but isn't a fight word; a Game Genie word is checked like any other), and leftover
  tiles that share its letters are dimmed too. Simulated fights (8-tile hands with leftovers kept, a
  player who knows the common-word list): playing the longest hit each time wins the badge 17% of
  the time, choosing short words with uncommon letters 42% (Ursula 43-46%, The Noid 35-36%). Real
  fights: Magneto won 68% (19), Ursula 71% (14), The Noid 57% (21). Its description now carries that
  tip. Boss Badges are permanent (one per boss) and show
  on the Top 50 as 🏅N; Firebase needs the `bosses` rule line in `docs/LEADERBOARD.md`.
- **Balance from usage stats (v7.33.0, 90 runs):** bosses were either free or impossible, so
  Ursula, The Noid and Magneto also need 4+ letters (they were beaten 34 of 35 times), the four
  hardest need 4 hits (Drago was 1 win in 8), and Doctor Doom (36% as a first boss) swapped tiers
  with Hades. Keep 8 bosses per tier. **Charm upgrades:** with all 5 slots full, a charm offer also
  lets the player upgrade one equipped charm (once each, lost if it's swapped out): its "+N pts"
  lines pay `CHARM_UPGRADE.percent` (50%) more, as a "⭐ Charm upgrades" line (`charmUpgradePoints`
  in `services/rules.ts`, state `gameState.charmUpgrades`). Only charms in `UPGRADABLE_CHARM_IDS`
  (`data/charms.ts`: they pay points under their own name) qualify; add new point charms there.
  Time, multiplier and utility charms can't be upgraded, on purpose (late-game time).
  **Upgrade UI (v7.36):** the offer shows the upgrade as a gold card first in the list (not a button
  under the cards, where it read like "no thanks"); slots that qualify carry a ▲. The first 3
  showings per player add a NEW! callout (`charmUpgradeTips`; an upgrade ends it). The picker shows
  each charm's own numbers, +40 → +60 (`charmUpgradePreview` in `services/rules.ts`); percentage
  charms show their percentage growing by half, +50% → +75% A WORD (`charmUpgradePercentPreview`,
  v7.51.2: Down to Your Boxers used to say only "+50% on its points").
  `run_end` now carries `cause`, `secs`, `tWords`/`tItems`/`tShuffles` and `upgrades`, and
  `charm_offer` carries `upgraded`. These go as `extras` in `sendStat`, which resends the plain
  event if the Firebase rules reject them; new optional stat fields should go the same way.
- **Balance, second batch (v7.34.0):** charm points were flat, so a 4-letter word with a typical
  charm set averaged 148 points against 138 for a 7-letter one. **Long-word boost:** charm points on
  a word pay +25% on 5 letters, +50% on 6, +100% on 7, +150% on 8+ (`CHARM_LENGTH_BOOST`,
  `charmLengthPoints`), as a "📏 Long word" line; one-off payouts are skipped
  (`NO_LENGTH_BOOST_CHARM_IDS`), and 0 means 0 still holds. Simulated: 3-5 letter play +2%,
  5-letter play +17%, longest-word play +35%. **Prize growth:** PowerPlay point prizes grow 10% a
  level, capped at x2.5 (`PRIZE_GROWTH`, `prizeFor()`; a 300 prize is 450 at level 6): time cards
  were still taken 63% of the time they were offered. Gamble cards scale centrally in
  `APPLY_GAMBLE` (the outcome card says "prize boost: 300 → 450"); other prizes call `prizeFor()`
  where they pay. Losses, costs and wagers stay fixed. Prize cards (`PRIZE_POWER_PLAY_IDS`) show
  "⬆ LEVEL N: PRIZES xS" on the offer, and the level-up card lists the new multiplier. New point
  prizes go in that set and pay through `prizeFor()`.
- **Third batch (v7.35.0): reworks, multipliers, renames.** Ids never change (stats and saves
  key on them); only names, text and effects did.
  **Multipliers cover charm points:** a word multiplier from a PowerPlay, a multiplier tile or
  SPICE also multiplies that word's charm points (`ITEM_MULTIPLIER_LINES`, `charmMultiplierPoints`
  in `services/rules.ts`), as a "✖️ Multiplier on charms" line: charm points x (multiplier - 1).
  Before, "x3 next word" touched only the tile points (about +30); now about +220 with a typical
  charm set. Left out: the length bonus, charm multipliers, the Word Combo, and the coin flips that
  already multiply the whole score. A new PowerPlay multiplier's line name goes in that list.
  **Score lines must use the item's current name:** upgrades, the long-word boost, Over 9000 and
  this rule find charm points by matching the line name to the charm's name, so renaming a charm
  means renaming its `bonuses.push` names too (a test checks the old names are gone).
  **Reworked (0 picks before):** More Than Meets the Eye (first word with the combo tile x3), Shake
  It Like a Polaroid (one new tile is a 2x word tile), Shapeshifter's Tongue (tile worth 10),
  Hookshot (twin worth 3x), Ludicrous Speed (4 s a word, was 8), Gift From Thanos (+400 on the
  spot, a prize; it used to promise 100 and pay nothing), Act Clear! (15 s at 40 points),
  Neuralyzer (keeps your charms; the next valid word brings a charm offer). Charms: WALL-E (was
  Recycler: +40 for reusing 2+ letters of the last word), Double Dare (+250 and +1 Challenge),
  Happy Little Accidents (first invalid word a level is free), Rubik's Cube (5+ letters, +60),
  Sherlock's Syntax (+60 repeated letter, +400 palindrome), Silent Killer (4+ letters, one vowel
  or none, +75), Survivor (+30 a word per strike carried). Values in `CHARM_BONUS` and
  `POWER_PLAY_VALUES`.
  **Renamed:** Time Boost → Most Excellent Detour, Strike Shield → Hylian Shield, Deep Freeze →
  Everybody Chill, Letter Upgrade → Pimp My Tile, Polish → Extreme Makeover (3 words, was 5), Swap
  Out → Trading Spaces, Rescue Drop → Rescue Rangers, Rewind → Turn Back Time, Mutation Protocol →
  Secret of the Ooze, S-Tier Scorer → S Club Party, Finisher → Last Action Hero, Vowel Lover →
  Vanna's Vowels, Momentum → Quarter Mile at a Time, Strike Bank → Insert Coin, Dice Roll Protocol
  → Jumanji. Taken already (secret bonuses): Be Kind Rewind, Wax On Wax Off, 1-Up.
- **Thanos and Schrute Bucks (v7.37.0):** Gift From Thanos is +500 now (a prize) and your next word
  of 4+ letters scores 0; 3-letter words don't spend it (`thanosGiftLetters`). Schrute Bucks is no
  longer a smaller Thanos: it's a beet farm, a multi-word PowerPlay with a chip. Each B, E or T in
  the next 5 valid words earns 25 bucks, and the pot pays out as points (a prize) after the last
  one. Word-list stats: about 1.07 B/E/T a word (+135 casual), about 2.2 leaning in (+280).
  Values `schruteBucksWords`, `schruteBucksPerLetter`, `schruteBucksLetters` in `POWER_PLAY_VALUES`.
- **Arcade mini-games (v7.38.0):** nine secret words open a quick side game instead of paying points:
  GAME Pong, MOLE Whac-A-Mole, CLAW claw machine, DART darts, GOAL penalties, DICE Yahtzee-lite,
  BOWL bowling, TEE mini golf, NET free throws (`miniGame` on the secret bonus, `data/miniGames.ts`,
  `components/MiniGames.tsx`, scoring in `services/miniGameRules.ts`, values in `MINI_GAME_VALUES`).
  An intro card (Play or Skip) opens after the word scores; the result pays points only, as a prize
  (`APPLY_MINIGAME`, grows with the level). Once per run like any secret; progress is saved in the
  pop-up's data (`SET_GAMBLE_STATE` works for `minigame` too), so quitting doesn't restart a game.
  TEE and NET were picked as the common ones (spellable from about 9% of hands; the rest 0.2-1.5%).
  v7.46.0 added eight more, chosen as common 4-letter words a hand can spell 1.4-3.7% of the time:
  LANE Bowling (reused), RING Ring Toss (darts re-skin), NOTE Repeat the Riff (memory), NAIL High
  Striker, TIRE Pit Stop (16 taps against the clock), RIDE Loop the Loop (hold, release in the
  green), SEAL Balance Act (10 s), DEAL Find the Lady (3 rounds). Top prizes 300-460; values in
  `MINI_GAME_VALUES`, scoring in `services/miniGameRules.ts`. DEAL isn't high-or-low on purpose:
  the Card Sharks PowerPlay already is.
- **Five more arcade words (v7.56.0)**, each a new kind of play rather than another timing meter
  (the owner's ask; quips on the intro card via `flavor` in `data/miniGames.ts`): LURE 🎣 Gone
  Fishin' (tap when the bobber dips: under 0.4 s a whopper +120, 0.65 s a keeper +70, 1 s a minnow
  +30, too soon spooks it; 3 whoppers +100), DIAL 🔓 Safecracker (a 40-number dial glows within 3 and
  clicks on the number; find 3 in 20 s, +100 each, +150 cracked), WIRE 💣 Cut the Wire (3 bombs, 8 s
  each, a manual line that gets trickier: `wireBomb` in `services/miniGameRules.ts`; a test reads
  every line back independently; +100 a bomb, +150 all), NEST 🥚 Egg Drop (drag the nest for 10 s:
  +20 an egg, golden +100, rotten -20) and LEAP 🐸 Road Hop (hop 5 lanes of traffic in 15 s, +60 a
  lane, +150 across; a hit sends you back to the curb). Tops of about 450, like the others; values
  in `MINI_GAME_VALUES`. Words chosen as common 4-letter words that a hand can spell 1.1-2.0% of the
  time (the 1.4-3.7% words were taken). Browser-checked at 390x844: all five play and pay.
- **Score gates (v7.39.0):** the first word at or past a gate opens a one-time event (`GATES` in
  `config/gameplay.ts`, `gatesPassed` on the run). 10,000: the Password Gate, unscramble a 6-letter
  password (`data/gates.ts`, 80 words, none a secret bonus word) in 20 s; the scored Daily Run
  shares the day's password, and every other run gets one the player hasn't had recently (per-player
  `gatePasswordsSeen`, so the whole list cycles before a repeat; daily practice too), and any real
  word using all six letters counts: +1,000, +500 with the first-letter hint, +250 on a miss.
  The scramble (`scramble`, `giveaway`, `GATE_ANAGRAMS` in `data/gates.ts`, v7.44.3) never deals
  the password or any other word that opens the gate (30 passwords have such anagrams, STREAM has
  seven), and picks the shuffle that leaves the fewest letters in place and 3-letter chunks intact.
  A test rebuilds `GATE_ANAGRAMS` from the dictionary.
  30,000: the Bonus Stage, 30 s on its own clock with a balanced 10-tile hand (4 vowels); each word
  pays (its normal score + 25 a letter) x3, charms included, and doesn't touch the run's tile
  stream. Both reuse the arcade card (`minigame` modal with `gate` in its data) and pay flat (no
  level boost). Stats: 44% of runs reached 10,000 and 11% reached 30,000.
  **50,000 and 70,000 (v7.49.0):** 9% of runs passed 50k and 2% passed 70k (Nov 12-15), so the
  top end got two harder events. 50,000: **The Word Ladder** (`GATES.ladder`, `Ladder` in
  `MiniGames.tsx`): a 10-tile hand, rungs of 3-8+ letters, 15 s each, pot 250 → 8,000 doubling;
  bank between rungs, a miss or the timer wipes the pot. The hand is checked to spell an 8-letter
  word (`dealLadderHand`, `LADDER_FALLBACK` in `data/gates.ts`). 70,000: **The Big One**
  (`GATES.bigOne`, `BigOne`): a hidden 8-letter word from `BIG_ONE_WORDS` (87 everyday words, none
  a secret) plus 2 tiles, 45 s, +5,000 / 2,500 / 1,000 for 8 / 7 / 6 letters. Reaching it earns the
  **💎 70K Club** badge (`b_seventyKClub`) for good: `earnedBy` on a cosmetic marks a run reward
  (not sold, shown as "💎 REACH 70,000" in the shop), granted by `earnCosmetic()` in
  `services/progression.ts`. Gates pay points, never time.
- **Four features from the 146-run stats review (v7.41.0).** The stats showed 15 names ever, three
  regulars, 47% of runs ending by level 3 (17 of 40 on strikes), 52% of charm offers passed after
  level 6, 25 PowerPlays picked under 12%, and power words firing 14 times in 146 runs.
  **Phoenix Down** (`phoenixDown` in `data/charms.ts`, values in `PHOENIX_DOWN` in
  `config/progression.ts`, card in `components/ContinueCard.tsx`): a real charm (v7.44.1; v7.41
  wrongly showed the card to everyone at every run end, and the owner corrected it). It appears
  in at most one charm offer a run (`phoenixOffered`) and never on the scored Daily Run; the
  player has to take it and keep it in a slot. If the run then ends (strikes or clock) while they
  hold it, the card offers to continue for 150 Credits (the owner's price): strikes wiped, clock
  back to at least 30 s, and the charm burns up. Greyed out when the player can't pay.
  `handleContinueOffer` answers only the open card, once. The older Continue? PowerPlay and the
  free rescues still go first. Lucky Charms never deals it.
  **Charm sets** (`data/charmSets.ts`, `CHARM_SET_BONUS`): 9 themed sets of 2-3 charms, mostly
  never-picked ones. Holding a whole set pays +50 (pair) or +100 (trio) on every valid word, as a
  "🧩 <name> set" line (0 means 0 holds; not boosted by upgrades or long words). With part of a set
  held, a charm offer's last card becomes a missing piece half the time (`pullSetPiece`, seeded).
  Offer cards say what a charm does for a set, and the swap screen warns when a drop breaks one
  (`SetNote` in `OfferModals.tsx`). A charm belongs to one set at most (a test checks).
  **Mystery Tape** (`MYSTERY_TAPE`, `dealMysteryTape`): 1 PowerPlay offer in 4 has a face-down last
  card hiding a low-pick pocket PowerPlay; taking it pays +150 (a prize, `prizeFor`) and a reveal
  card takes the offer's place. The pool has no instant, bet or time cards; refresh it from stats.
  **Swap confirmation (v7.53.2, the owner's ask):** holding a PowerPlay, tapping any other offer
  card (the Mystery Tape too) opens a "SWAP IT OUT?" step inside the offer (`confirming` in
  `PowerPlayOffer`, `OfferModals.tsx`): what you hold, what replaces it (instant ones say they fire
  now; the tape shows its points), ✋ Keep mine (back to the offer) or 🔄 Swap. With nothing held, a
  tap still takes the card at once. The owner reported the Keep button missing on offers with a
  Mystery Tape; it couldn't be reproduced (it shows at 360x640, 390x844 and 412x760, and 11 of 103
  real tape offers ended in a keep), so the confirmation also guards that case.
  **Power word hint** (`services/powerWordHint.ts`): when the tiles in play can spell a ready power
  word, a chip above the hand says so (icon and length on tap, never the word), once per level
  (`gameState.powerHint`), not in Golden Rounds. v7.54.2: the tap also gives the word's first letter
  (`first` on the hint): 88 hints had led to 3 plays.
  Stats: new events `continue_offer` and `pw_hint`, extras `mystery` (pp_offer) and `hinted`
  (power_word). They need the rules in `docs/LEADERBOARD.md` pasted into the Firebase console.
- **Mechanics borrowed from other games, batch one (v7.42.0).** Values in `LAST_WORDS`,
  `HEAD_START`, `SKILL_SHOT`, `GEM_TILES` (`config/gameplay.ts`).
  **Last Words** (`components/LastWordsCard.tsx`): every ending goes through `END_RUN`, which opens
  one untimed word from the final hand at x3 (once, `lastWordsDone`), then `GAME_OVER_INITIATED`. It
  pays as an event, not a word: no level, offers or time. Order at the end of a run: free rescues,
  Phoenix Down, Last Words, Game Over. Both end-of-run cards ignore taps for 1.5 s while a bar
  fills (`useArmDelay`, v7.47.1): players still tapping the board skipped them by accident.
  **Head Start** (`services/headStart.ts`, per player): a run ending before level 4 adds 3 s to the
  next starting clock (max 15), reaching level 4 clears it; a chip shows it until the first word.
  Never applied on the scored Daily Run.
  **Skill Shot** (`gameState.skillShot`): on the first word of each level reached in the run, from
  level 2 (v7.44.6: a new run's opening hand never has one; the owner's call), one tile is lit (seeded pick);
  using it pays +50, +25 more per level in a row, max 200, as a "🎯 Skill Shot" line.
  Made obvious in v7.44.5 (players didn't notice it): the lit tile wears its prize ("🎯+50"), the
  chip is an instruction ("USE THE +50 TILE IN YOUR NEXT WORD"), a toast says SKILL SHOT! or why
  it missed, and the first two times a player meets a lit tile a card explains it
  (`skill-intro` pop-up, per-player `skillShotTips`). Browser checks on a fresh profile: tap
  "Got it" before anything else.
  **Gem Tiles** (`pendingGem`, `Tile.isGem`): a 6 / 7 / 8+ letter word turns one plain tile of the
  next hand into a x3 / x4 / x5 word tile (`START_NEXT_ROUND`). It scores as a "Tile Multiplier"
  line, so it covers charm points like other tile multipliers.
  The first two times a player gets a gem (per player, `gemTips`, `GEM_INTRO_SHOWS`), a `gem-intro`
  card explains it (v7.53.1): what it multiplies, and the x3/x4/x5 lengths. An unused gem stays in
  the hand (leftover tiles are kept and topped up to 8; nothing clears a gem) until it's played, and
  a shuffle trades it away; v7.53.1's card wrongly said it only lasts one hand (fixed in v7.53.3).
  Two gems in one word add (x5 + x5 = x10), like all word-multiplier tiles, so banking one is a
  real but bounded tactic. It waits for any open pop-up and for the Skill Shot card on the same hand.
- **Borrowed mechanics, batch two (v7.43.0).** Values in `FORK`, `HOLD_SLOT`, `GRUDGE`.
  **Fork in the Road** (`components/ForkCard.tsx`, `gameState.route`): at levels 4, 7 and 11 a
  card after the level-up makes the player pick Easy Street (clock 10% slower) or the Danger Zone
  (clock 15% faster, every word x1.5 as a "🔥 Danger Zone" line), until the next fork. `fork` is
  in `POST_WORD_MODALS`. Simulated at the pace real runs show (2.2-3.4 s a word): Danger is +50%
  for a player ahead of the clock and cuts survival from 79% to 10% for one on the edge at levels
  7-10; Easy Street lifts that player to 99%.
  **v7.59.0 (from `docs/FEATURE_REVIEW.md`):** locked Danger was a trap at the median late pace
  (2.2 s a word: survived levels 7-10 32% of the time, -27% run value against Easy). Now the card
  shows the player's clock and how it moved over the last level (`gameState.levelClock`, set on each
  level-up by `noteLevelClock`) and marks the route that suits it (`forkAdvice` in `services/rules.ts`,
  `FORK.advice`). In the Danger Zone the chip above the hand is a button (`components/DangerChip.tsx`):
  hold it `FORK.bailHoldMs` to cool off to Easy Street until the next fork (`route.bailed`, no way
  back in); it pulses "LOW CLOCK? HOLD TO COOL OFF" at `FORK.lowClockNudge` seconds or less.
  Simulated with a bail at 25 s: Danger +3% to +20% for most paces, still a loss for slow players.
  **v7.61.4 (the owner's ask):** the card says how long a pick lasts in words ("It lasts 54 words
  (until the level 7 fork), then you pick again"), that Easy Street is locked in until then and
  that cooling off from Danger has no way back in. The route chip counts down
  (`forkWordsLeft` in `services/rules.ts`): "🔥 DANGER x1.5 · 31 WORDS LEFT / HOLD TO COOL OFF (NO WAY
  BACK)", "🌴 EASY STREET · 31 WORDS LEFT", or "REST OF RUN" after the last fork.
  **Hold Slot** (`gameState.holdTile`, `HOLD_STASH` / `HOLD_RETURN`): a charm since v7.45.0 (the
  owner's call; it used to open for everyone at level 4): while **Hold That Thought**
  (`holdThatThought`, `HOLD_SLOT.charmId`) is equipped, a HOLD button sits above the hand; tap it,
  then a tile, to park it. The tile survives new hands and shuffles and joins the final hand for
  Last Words. Swapping the charm out hands the parked tile back (to the bag if the hand is full).
  **Grudge Match** (`services/grudges.ts`, per player): a boss that got away (no badge, or the run
  ended mid-fight) opens next time as a GRUDGE MATCH with a taunt built from the player's own
  numbers (`grudgeTaunt`; keep the jabs playful, kids play this), and beating it pays the badge
  points x2. The double is left off the scored Daily Run.
- **Bones (v7.44.0)** (`services/bones.ts`, `components/BonesCard.tsx`, `BONES`): a run that ends
  on level 2+ holding a charm posts its final hand (5+ tiles), its charm ids, the score and the player's name to `/bones` (`App.tsx`
  `handleGameOver`). A run loads the newest 60 when it starts (`refreshBones`, cached in
  sessionStorage). On a level-up, `bonesModal` may open the newest ghost for that level: never the
  player's own (by name), one they looted before, a stale one (30 days), or one whose charms they
  all hold; one ghost a run; never on the scored Daily Run. A 5+ letter word from the tiles in 30 s
  opens a normal charm offer made of the fallen player's charms (swap and upgrade work as usual).
  **Always winnable (v7.44.2):** when the card opens, `solveHand` checks the tiles with the
  dictionary's common-word finder; if they can't spell a 5+ letter word it swaps tiles two at a
  time (keeping about three vowels) until they can, and the card says how many were swapped. A
  miss or "Give up" shows a word that would have worked, with its tiles lit in order.
  Bones carry names like the leaderboard does; usage stats stay anonymous (`bones` event: `taken`,
  `level`). Needs the `bones` rules block in `docs/LEADERBOARD.md`; until it is published nothing
  posts or loads and the game plays as before. Browser checks seed `wordNerdBonesCache`.
- **Power words** (10 secret words with `effect`, no points): SLOT (slot machine, +1/3/10s), SNOW
  (clock frozen 10s), HEAL (remove a strike, else +100), SLOW (half-speed clock for 3 words), TWIN
  (clone your best word's time + a Word Combo step), RINGS (a strike shield), REWIND (clock one speed
  step slower for the level), SWORD (fills the PowerPlay meter), SPICE (next word x3), CAKE (charm
  offer). They fire on submit and can fire again once per level; other secrets are once per run.
  New ones should be harder to spell than the existing ones (they can be abused). Values in
  `POWER_WORD_EFFECTS`; player-facing text in `powerWordInfo()` (`services/rules.ts`).
- **App updates (v7.63.0, `services/appUpdate.ts`):** an installed Android app resumes instead of
  relaunching, and the browser only checked for a new service worker on a fresh launch, so the
  owner had to open and close the app several times. The service worker is now `registerType:
  'prompt'` (it waits instead of taking over and reloading, which could land mid-run). The game
  checks for a new version (`registration.update()`, one small no-cache request for `sw.js`) when
  it comes back to the foreground (at most once a minute), when the network returns and every 30
  minutes; the new version downloads in the background, and `App.tsx` switches to it only on the
  Start screen (`applyUpdate`), then shows "✨ UPDATED TO VER x" (`takeUpdatedNote`). Never mid-run:
  an update found in a run waits until the player is back on the Start screen. `index.tsx` passes
  `registerSW` in, so the module has no virtual import. Checked end to end with two builds served
  locally: downloaded mid-run without a reload, switched on the Start screen, saved run kept. The
  first update after v7.63.0 ships still needs one full close, since older installs run the old code.
- **Auto-save:** the run saves itself (same slot as 💾) after every word, when pop-ups open or
  close, every 5 s, and when the game leaves the screen; it's cleared at game over. Resume shows
  a 3-2-1 with the board hidden. The back gesture opens the save prompt instead of leaving, and
  New Game asks first when a saved run exists. `savableScreenState()` in `GameScreen.tsx`.
- **0 means 0:** a word wiped or capped by a gamble (Heisenberg, Double or Nothing, Space Invader,
  Gift From Thanos, Fast Cash) stays at that score: later flat bonuses (chain,
  charms, Super Hand, Nice Rack, Flux, Thriller) don't count (`wordCeiling` in `completeSubmission`).
  Separate rewards (secrets, boss badges, milestones, streak charms) still pay.
- **Run-savers** are once per run. Charm time goes through `bonusTime()` (shrinks 5% a level to half,
  halved above 60 s). PowerPlay time pays the full amount on the card at any level (`powerPlaySeconds`,
  v7.40.1, the owner's call after a level-9 Most Excellent Detour paid 3 of its 10); only the 90 s cap applies.
  v7.40.2 moved the last shrinking PowerPlay time (Time Turner, Save by the Bell, In Time, Pop Quiz:
  `ppTimeBonus`) to full pay; power word time (`powerWordTimeBonus`) still shrinks. Players see charm
  time cuts in four places: a chip under the clock (`timeGain.charm`), a "🍀 Charm time" score line,
  time charm cards at the current level (`CHARM_TIME_SECONDS` in `data/charms.ts`,
  `components/CharmTimeNote.tsx`; add new time charms there) and a "Charm time" row on level-ups.
- **Slurs:** never unblock a word without the owner's confirmation. Allowed slur-adjacent words
  (COON, DINK, FAG, POOF, NIGGARD, RETARD, CHINK, DYKE, FAGOT, SPASTIC, GYP and their forms) and
  allowed profanity (SLUT, WHORE, DILDO, SKANK, TWAT, WANK, BOLLOCKS, CUM) are on `words/no-suggest.txt`,
  so the game never offers them. Still blocked: true slurs, the F- and C-word families, COCKSUCKER,
  MILF, SLUMDOG. HOMO was left out on purpose.
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
- Re-check the never-picked charms (Little Mac, I'm Ready!, Sick Combo, Eagle!, Golden Girls,
  Phil's-osophy, Battle of Wits, Supermarket Sweep, Lena, Turtle Power, Titans Go!, Star Power,
  Mixtape, Inigo's Revenge) once more runs come in after the v7.29 Vowel Lover change.
- See whether the v7.29.1 reworks (Scrooge's Money Bin, Duck Hunt's Zapper, Wario Warp +300) get picked now.
