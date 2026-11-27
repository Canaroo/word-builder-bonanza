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
| PowerPlays / charms (106 / 112) | `data/powerPlays.ts`, `data/charms.ts` |
| Charm sets, Mystery Tape, Phoenix Down, power word hint (v7.41) | `data/charmSets.ts`, `CHARM_SET_BONUS` and `MYSTERY_TAPE` in `config/gameplay.ts`, `PHOENIX_DOWN` in `config/progression.ts`, `services/powerWordHint.ts` |
| Borrowed mechanics (v7.42-7.44): Last Words, Head Start, Skill Shot, Gem Tiles, Hold Slot, Grudge Match, Bones; the scratch-off ticket (v7.66, where the Fork was) | `LAST_WORDS`, `HEAD_START`, `SKILL_SHOT`, `GEM_TILES`, `SCRATCH`, `HOLD_SLOT`, `GRUDGE`, `BONES` in `config/gameplay.ts`; `services/headStart.ts`, `services/grudges.ts`, `services/bones.ts`, `services/scratch.ts`; cards in `components/` (`LastWordsCard`, `ScratchCard`, `BonesCard`) |
| Video Store, Genre Levels, Collector's Tiles (v7.96) | `data/videoStore.ts` (genres, tiles, shelf), `VIDEO_STORE`, `GENRE_VALUES`, `COLLECTOR` in `config/gameplay.ts`, `components/VideoStore.tsx`, `STORE_*` and `landCollectors` in `GameScreen.tsx`, `services/intros.ts` |
| Secret bonuses (122 words, 10 scores) | `data/secretBonuses.ts`; preview all at `/?bonuses` |
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

**Writing rule (the owner's, v7.66.3): clear AND funny.** Every player-facing line (charm and
PowerPlay descriptions, power words, cards, results) must make sense in one read and keep the
80s-2010s pop-culture voice. Say what happens to the player in plain words (no jargon like "clones",
"arms", "speed step"), one idea per sentence, and keep the reference: in the name, the flavor text,
or a short lead-in ("Heroes never die: one of your strikes disappears."). Clarity never costs the
joke, and the joke never hides the rule. Details in the add-game-content skill, section 3.

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
  that also waits for Continue. **v7.66.2 (the owner's call): nothing auto-closes any more.** Quick
  results (a Heisenberg-style outcome, "PowerPlay Result", Fluncle, Act Clear!...) used to vanish
  after 2-3 s with their Continue button still showing; every card now waits for Continue (the
  `autoClose` timer is gone and old `autoClose` fields are ignored). Don't add timed pop-ups.
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
  **Let's Make a Deal (v7.68.0, the owner's design; `Doors`, `dealDoors`, `doorPrizes`
  [150, 200, 300, 450], `doorSweepBonus` 500):** one row of 5 doors, 4 prizes and a Zonk, dealt once
  and saved. Tap a door: it swings open (`door-swing`); a prize stays open and joins the pot, then
  bank or open another; the Zonk (🐐) wipes the pot; all 4 prizes pay +500 more. When it's over every
  other door turns over (MISSED / DODGED). It used to be 3 rounds of 3 doors, and a win's message
  named where that round's Zonk was. Best play (bank after 2-3 doors) averages about 330 (old: 340).
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
  Speed** (`needForSpeed`; v7.66.0 made it a speed streak, see the Fork note): was Danger Zone x1.75 (the Fork
  card and chip); no level gate now (the level-4 gate belonged to the old Danger Zone version). **🗝️ Are You the Keymaster?** (`keymaster`): Score
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
- **Charm copy pass, batch 1 (v7.67.0, the owner approved each line):** 22 charm texts reworded
  clear AND funny (Insert Coin says you start with 3 strikes, the Snitch's catches and what scares
  it off, S Club Party's x2 is once per word, Jumanji is every 3rd *hand*, Phil's-osophy isn't a coin
  flip, Hungry Hippos needs every vowel in your hand...). Star Power's flavor no longer promises
  "untouchable" (it's only +125). **Family charms pay flat points** (the owner: percents made players
  do math): Nicole's Grace +75 (M or ends in a vowel, 25% of words), Christian's Hoodie Mode +40 (G,
  A or M within 10 s of the last word), Lena +25 (D, R, K or N, 80% of words); matched to what the
  percents paid on average (median word 110-190 in 209 runs). **CTU Safe House reworked:** once a
  level, the clock dropping under 10 s adds +15 s (charm time, shrinks by level; `ctuLevel`,
  `CTU_RESCUE`, `TIME_BONUS.ctuSafeHouse`); it used to swap in a 4-point tile after a word under 20
  points, which almost never happened past level 3. Browser-checked: 9 s left → +15.
- **PowerPlay copy pass, batch 2 (v7.67.1, the owner approved):** 28 PowerPlay texts reworded (no
  "arms right away", "round", "turn", "rack", "Super Tile" or "time bank"; odds said plainly; Smell
  Ya Later!'s rival is Gary). Groundhog's Day says "Once per run" (it's `oncePerRun`; the old text
  said "Stacks"). **Gump Luck is a card** (`GumpBox` in `GambleCard.tsx`, `gumpRoll` in
  `services/rules.ts`): a box of 6 chocolates, tap one to unwrap it; same 25% odds (+10 s, +75 a
  prize, +1 shuffle via `shuffles` on `GambleResult`/`APPLY_GAMBLE`, empty), rolled when the box
  opens and saved. **Winner Winner Chicken Dinner is a blackjack card** (`Blackjack`,
  `blackjackHands`/`blackjackTotal`/`blackjackResult`/`blackjackPrize`, `blackjackWin` 300 /
  `blackjackNatural` 500 / `blackjackPush` 100, dealer stands on 17): one hand vs. the dealer with
  HIT and STAND, the 16-card deck dealt up front and saved. It was a card per word with a chip to
  stand (picked 5 of 26 offers, used 4 times); the old per-word game and `BLACKJACK_STAND` still
  settle saved runs. Simulated: about +142 a hand on average, paying in about half of hands.
- **Fortune's Favor is a Magic 8-Ball card (v7.72.5, the owner's ask: it told you the result
  instantly)** (`FortuneBall` in `GambleCard.tsx`, `fortuneRoll`/`fortunePoints`/`FORTUNE_ANSWERS` in
  `services/rules.ts`, `fortune*` in `POWER_PLAY_VALUES`): tap the ball or SHAKE IT! 3 times (it
  wobbles, buzzes, dots fill), the window goes murky for 1.5 s ("THE ANSWER IS RISING…"), then the
  blue triangle fades up with a real 8-Ball answer ("OUTLOOK NOT SO GOOD", "IT IS CERTAIN",
  "WITHOUT A DOUBT"...) and Take/Continue pays through `APPLY_GAMBLE`. Same odds and amounts (40%
  -200, 50% +250, 10% +500), rolled when the card opens and saved. Wins now grow with the level like
  every other gamble prize (it's in `PRIZE_POWER_PLAY_IDS`): about +95 on average at level 1, +165
  at level 6; the loss stays 200.
- **Game-show drop (v7.74.0, the owner's picks from six pitches)** (`services/__tests__/gameShows.test.ts`):
  **📊 Survey Says!** (`surveySays`, a pocket gamble card, `SurveySays` in `GambleCard.tsx`,
  `surveyBoard`/`surveySlotFor`/`surveyPayout` in `services/rules.ts`, `survey*` in `POWER_PLAY_VALUES`):
  the board hides 5 words your tiles can spell, one of each length longest first (8, 7, 6, 5, 4;
  lengths repeat only when they run out), shown as letter counts. Spell them in 25 s with the tiles
  (`WordPad` and `gateTiles`, exported from `MiniGames.tsx`); a word fills the first open slot of its
  length. A fake word or one that fits no open slot is a ❌; 3 end it. Pays 200/150/100/75/50 by slot,
  +200 for all five (a prize). Thin tiles (under 5 answers or a top answer under 5 letters: 4% of
  hands) get a fresh dealt board. Needs `dictionaryService.playableWords` (a worker `all` request,
  `allPlayable` in `wordIndex.ts`). The first version used the 5 longest words (8, 7, 7, 7, 7 on a rich
  hand), which was too hard. **⭕ Center Square** (`centerSquare`, fires on pick, `CENTER_SQUARES`,
  `centerSquareDeal`/`centerSquareClaim`/`centerSquareLines`/`centerSquarePrize` in `rules.ts`, settled in
  `completeSubmission`, `CenterSquareBoard` in `PowerPlayTrackers.tsx`): Hollywood Squares for the next
  10 words. A 3x3 board of conditions (center always 6+ letters, 8 dealt from 12); **each word claims
  ONE open square** (the one that finishes a line, else the center/most-started line), so a full board
  needs 9 words and there are 10 (the owner's question). Simulated: letting a word claim every square
  it matched gave a line 97% of the time in 8 words, so one per word it is. +75 a line, +500 for the
  full board (a prize): casual ~2.9 lines (~225), full 1%; a player aiming for it ~7 lines, full 63%
  (~845). The chip opens/closes a 3x3 grid above the tiles (the clock runs).
  **v7.79.0, Center Square is its own card (the owner's redesign: the board crowded the screen and
  its squares were hard to read):** it fires on pick (`CARD_ON_PICK`) and opens `CenterSquareCard`
  in `GambleCard.tsx`: a small 3x3 board, a fresh 8-tile hand dealt from a new bag (used tiles refill
  from it; no shuffles), 9 words (`centerSquareTurns`) and 60 s (`centerSquareSeconds`) while the
  run's clock waits (a modal). Each word fills the hardest open square it fits (`centerSquareFill`,
  `CENTER_SQUARE_ORDER`: ENDS IN S 28% of hands ... EXACTLY 3 LETTERS 99%); a fake word or one that
  fits nothing uses the turn, never a run strike. Flat +60 a square (`centerSquarePerSquare`,
  `centerSquarePay`; a prize, grows with the level), no line or full-board bonus (the owner's picks).
  Simulated 9 turns, no clock: any-word play 5.6 squares (~340), aiming 7.6 (~460), full 44% (540);
  the old board paid ~225 / ~845. Deal and progress are saved (`useSaved`). Browser-checked: 7 of 9
  → +420, the run's clock 50 → 50. Boards armed in older saves still settle the old way
  (`centerSquareClaim`/`Lines`/`Prize`, `centerSquareWords/Line/Full`, the tracker chip).
  **v7.79.1 (the owner's asks):** the card's top line reads HOLLYWOOD SQUARES (`FRAME_KICKER` in
  `GambleCard.tsx`; other gamble cards keep TAKE A CHANCE). Each finished line of three (across, down
  or diagonal) pays +50 more (`centerSquareLineBonus`) and a full board +300 (`centerSquareFullBonus`),
  all in `centerSquarePay` (`centerSquareDoneLines`); finished lines glow green and a "N LINES" counter
  shows. A word now finishes a line when it can, else takes the hardest square (`centerSquareFill`;
  simulated, the rule barely changes results). Simulated: any-word play ~1.7 lines (~425), a realistic
  aimer (~7 words in 60 s) ~3.1 lines (~535), an expert using all 9 words ~5.2 lines and a full board
  34% (~820). A full board pays 9 x 60 + 8 x 50 + 300 = 1,240 at level 1 (browser-checked).
  **🎡 SPIN, Spin & Solve**
  (`spinAndSolve` secret word, mini-game `wheel`, `Wheel` in `MiniGames.tsx`, `MINI_GAME_VALUES.wheel`,
  `wheelLetterPay`/`wheelBoard`/`wheelSolved`): a hidden 8-letter word from `BIG_ONE_WORDS`, 45 s; SPIN
  (wedges 50-200 a letter, BANKRUPT wipes the pot, FREE SPIN), call a consonant, buy a vowel for 25,
  SOLVE by typing the missing letters. Only a solved puzzle pays (pot + 100); a wrong solve or the
  clock pays 0. Simulated: ~247 on average, 425+ for the best 10%. SPIN was unused (no secret, power
  word or item on it). Held back for later: Winner's Circle (a score gate; open spots 20k / 40k / 60k),
  Lingo and Final Round (the owner wants other ways to fit them).
- **The Triforce is gone (v7.95.0, the owner's call: shards were too convoluted for most players).**
  It ran v7.69-v7.94: three pieces (Power x1.5 a word, Wisdom's Ask Zelda, Courage's once-a-level block)
  built from 3 shards each, dealt into charm offers, scratch-offs and Lucky Charms, +5,000 and the Hero
  of Time badge for all three. Removed: `data/triforce.ts`, `TRIFORCE`, `TriforceEmblem`, `dealShard`,
  `collectShard`, `shardFor`, `ZELDA_PLACE`, `COURAGE_CLOCK`, the Gear box, the How to Play section, the
  Ask Zelda notice and heads-up card, and the `b_heroOfTime` badge (profiles drop unknown badge ids on
  load). Old saves: a queued `triforce` card closes itself like `fork`, saved Triforce fields are ignored,
  and a scratch ticket saved with a shard square plays it as 250 points (`withoutShards` in
  `services/scratch.ts`). **Master Sword** (id `triforceOfCourage`, Z/X/Q words, in Hyrule Heroes) stays.
  Tests in `triforceGone.test.ts`.
- **Fragile charms (v7.70.0, the owner's design after Hollow Knight's)** (`FRAGILE` in
  `config/gameplay.ts`, `breaks: true` on the charm, `shatterFragile` in the `gameReducer` wrapper):
  🥊 **Glass Joe** (every word x2, whole word), 🦵 **Major Award** (the
  leg lamp: +50 a word, +50 more for every 10 words it survives, up to +300; `majorAwardWords`) and
  🔮 **Crystal Ball** (+5 s charm time every valid word, the owner's number). The owner's rule: ANY
  invalid word or strike shatters every fragile charm held, for the rest of the run, even when a
  shield, Plot Armor, a waiting Chubbs/Turn Back Time or Happy Little
  Accidents stops the strike (so strong players can't cheese them); Jackass, With Great Power and
  WILDCARD strikes too (their cards warn). Shattered ids go to `shatteredCharms` and are never
  offered again (charm offers, Lucky Charms). 💔 FRAGILE tag on offer cards, 💔 on the slot and the
  buffs tray, a "💥 ... SHATTERED" card. Not upgradable, not in sets or the scratch list.
- **Fragile charms last 5 words (v7.87.0, the owner's call: too strong to keep all run)**
  (`FRAGILE.lifeWords`, `wearFragile` in `GameScreen.tsx`, `gameState.fragileWords` by id, set to 0 on
  `CHOOSE_CHARM`): after the 5th valid word a fragile charm breaks for the run (into `shatteredCharms`,
  never offered again), and it still shatters sooner on any invalid word or strike. It runs right after
  the word is logged, before the charm offer, so the freed slot can be filled at once. The 4th word shows
  "💔 🥊 Glass Joe: LAST WORD!" on the stage; the 5th opens a "💥 GLASS JOE BROKE" card (RESULT tone) and
  logs "Fragile charm broke". Hamm smashes himself and pays out when he wears out. Gear shows "N WORDS
  LEFT", offer cards "💔 FRAGILE · 5 WORDS". **Major Award** now grows every word (+50, +75 ... +150 =
  500 over its life; it grew every 10 words, which 5 words never reach). Over 5 words of ~180 points:
  Glass Joe about +900, Major Award +500, Crystal Ball +25 s, Hamm about +500. **v7.87.1 (the owner's
  call):** Hamm's deposit went from 30% to 50% (`piggyDeposit`): his 5-word payout was about +300. Saves from before count from 0.
  **Greatest Hits pill** (`HitsChip` in `PowerPlayTrackers.tsx`, `hits-chip`) moved out of the stage's
  strip to right above the tiles (the owner's ask), larger, with a gold ring; hidden in Golden Rounds.
- **Copy pass and flat numbers (v7.89.0, the owner's ask: succinct, clear, flat bonuses).** 151 of 218
  charm/PowerPlay descriptions rewritten to two short sentences in one style (median PowerPlay 19 → 13
  words, longest 76 → 34; over 25 words: 42 → 9); edge cases moved to a new optional `finePrint` field
  (36 items), rendered under the rules on offer cards (`fine-print`), in Gear and in the info pop-up.
  Seven percent effects went flat, each matched to what it paid in the usage stats: Golden Girls +75 on
  Golden words (`CHARM_BONUS.goldenGirls`; the last 80 Golden words averaged 139), Down to Your Boxers
  +75 (`boxers`), Keymaster +750 a gate that pays (`keymaster`; gates averaged 2,052, median 1,000),
  Turbo Button 6 fewer letters (`turboButtonLetters`), Continue? a flat 1,500 never above the score
  (`POWER_PLAY_VALUES.continueCost`; averaged 1,528), Hamm +100 a word (`FRAGILE.piggyPerWord`, no
  interest: 500 over 5 words), Hammer Time reworded ("a minute lasts about 71 seconds"). Odds stay %.
  **Flavor pass:** 20 flavor lines quoted or paraphrased song lyrics and were replaced with original
  nods (never use lyrics; see the skill), 19 weak ones now name their source, 8 got a reference.
  **Wildcard Wake is Gambit's Reshuffle** (id kept, X-Men). **Cassie's Clue** (the owner's brother-in-law's
  cat; picked 14% vs about 27% average) now waits for the first word with C, A and T instead of being lost
  on the next word (spent in `completeSubmission`), and its flavor explains the cat. The review page is the
  "Word Nerd Copy Pass" artifact. The offer header now says the PowerPlay waits in your pocket (▶ USE).
- **🐷 Hamm's Piggy Bank (v7.73.0, the owner's pick of three designs)** (`hammPiggyBank`, a fragile
  charm; `piggy*` in `FRAGILE`, `piggyAfterWord`/`smashPiggy` in `GameScreen.tsx`, `gameState.piggyBank`):
  every valid word adds 30% (50% since v7.87.1; a flat +100 since v7.89.0) of its full score (after every multiplier, before secrets, milestones and
  Greatest Hits) to the bank, which first earns 5% interest, up to 15,000. The word keeps all its
  points. Hold the 🐷 chip above the tiles (`piggyHoldMs` 700, `SMASH_PIGGY`) to smash him: he pays out
  and is gone for the run (into `shatteredCharms`). A slip shatters him and the savings are lost (the
  shatter card says how much). v7.73.1 (the owner's call): running out of time loses the savings too
  (`END_RUN` logs "Time ran out before you smashed Hamm" and the Last Words card says how much was lost, `piggyLost`), so smash him before the clock hits 0. Simulated on
  180-point words: 679 at 10 words, 1,786 at 20, 6,523 at 40, full near 58. Best-play expected value
  about 1,560 for a careless player (a slip every 25 words) and 8,500 for a careful one (every 100),
  against Major Award's 3,255 / 16,866: lower, since the player picks the moment and gets the slot
  back. The owner also chose: future fragile multipliers add their bonuses instead of multiplying
  (x2.5 + x2 = x3.5).
- **Your Gear menu (v7.71.0, the owner's idea and picks)** (`components/GearMenu.tsx`, `gear`
  modal): the buffs tray is now a slim strip of icons (🎒 GEAR n/5, timers and ⭐/💔 marks) that opens
  an old-school RPG menu when tapped anywhere (it used to be one info card per icon). The menu covers
  the board and pauses the clock (a modal: `isPaused`; browser-checked: 49 → 49 while open). Boxes:
  RUN STATUS (strikes left and what protects you, fragile warning, clock speed and word-time %,
  prize multiplier), CHARMS (each with what it earned this run: `earnedThisRun` sums its score lines
  in the log by name, points or seconds), POCKET (with ▶ USE), RUNNING NOW (timers via `progressFor`,
  shared with the tray), CHARM SETS (pays now, what the next piece adds and which charm), TRIFORCE
  SHARDS (emblem + pieces). Tap any row: a ▶ cursor and the description box at the bottom explain it.
  **v7.71.1 (the owner's call): above the tiles is for what changes your next word or needs a tap.**
  The charm set and Hadouken chips left (Gear has them; Hadouken shows ×N in the strip).
  Kept: HOLD, Jenga, power word hint, Skill Shot, Head Start, Pop Quiz, the race, bids and calls,
  Inception, the speed streak, Greatest Hits and Tamagotchi. The GEAR strip glows gold for 3.5 s when
  a new charm or an upgrade lands (`gearGlow`, not on a resume).
  **v7.72.3 (a player saw Last Action Hero show nothing in Gear):** it was paying (+15 on the last
  tile, upgrades and the long-word boost included); Gear only matched a score line's exact name, and
  many lines add detail ("Last Action Hero (E)", "Golden Ticket!", "Sands of Time! +5s next round").
  `lineIsFrom` now matches the name then a non-letter, like scoring does; it fixed Last Action Hero,
  E.T. Phone Home, Golden Ticket, Sesame Street, Freaky Friday, Vanna's Vowels, Sands of Time,
  Glitch in the Code and Execute Order 66. A test checks no charm's lines count for another.
  **v7.72.4 (every charm checked):** Gear also reads event log entries in a charm's name (Double
  Dare, CTU Safe House, the Croc's seconds and bites, Backpack), negative lines (Hammer Time -10) and
  National Treasure's share of secret bonuses; Bean Counter's duplicate event is skipped. Wile E.
  Coyote and Power Glove now log what they pay, and Keymaster's +50% is its own log entry
  ("Are You the Keymaster?"). Multiplier charms (S Club Party, Freaky Friday, I'm Ready!...) show "x2
  ON N WORDS". Charms that only change rules (Turbo Button, Little Mac...) say so instead of "Nothing
  earned"; `paysDirectly` and a test listing the rules-only ones keep new charms classified.
- **How offers are drawn (`getOffer` in `services/gameUtils.ts`; checked v7.67.2, the owner's ask).**
  Pool: everything not held or active, not shown in the last 3 words (`charmCooldowns`,
  `powerPlayCooldowns`), not a taken once-per-run PowerPlay, and not one that can't work yet
  (Keymaster under 5,000 or no gate left, Daily Double under 200, Phoenix Down once a run and never
  on the scored Daily, Mr. Glass when it would end the run, a finished Snitch or Gotta Catch). No
  level gates (the owner's call). Each item starts at weight 1, then per run: a never-shown boost,
  recency and last-3-offers penalties, a scarcity boost; one slot goes to a never-shown item; at
  most `OFFER_MAX_PER_SUBTHEME` (2) cards of one kind. Then the nudges: one time card at most
  (`limitTimeCards`, redrawn from its own `'time-swap'` stream), Mystery Tape, set pieces. The
  Daily ranks by `dailyRank` instead. **v7.67.2 fixes** (81,000 simulated offers): the seed was
  `runSeed + offer number`, and this Lehmer generator turns neighbouring seeds into nearly the same
  draws, starving a few items (5th Grader, Jenga, Extreme Makeover at a third of their share); it's
  mixed with `dailyRank` now. And "one of each kind" made the 48 score PowerPlays / 42 score charms
  show about 40% less often each. Rarest vs most common PowerPlay went from 4.6x to 1.7x (charms
  3.4x → 1.6x); what's left is the nudges, on purpose. Tests in `offerFairness.test.ts`.
- **Feature tracking (v7.61.1):** `fork` (choice incl. `bail`, level, clock, advice), `golden`
  (level, score, tile, ok), `gate` (gate, played/skip, points) events; `pp_use` extra `tape`;
  `run_end` extras from `runEndExtras()` (golden, route, bails, skill, gems, lastWords). Shown in a
  "Mid-run features" table on `/?stats`. The rules in `docs/LEADERBOARD.md` must be pasted into the
  Firebase console; until then the new events are dropped and the extras fall back.
- **WILDCARD (v7.50.0)** (`wildcard`, `Wildcard` in `GambleCard.tsx`, odds in
  `POWER_PLAY_VALUES.wildcard`): a pocket gamble card. v7.68.0 (the owner: it didn't read as It's
  Always Sunny): named **Wildcard, B*tches!** (bleeped, the owner's pick), icon 🤠, "Charlie goes
  rogue." lead-in, flavor "Yee-haw! (Charlie Kelly...)", and the offer card shows the van clip as its
  picture (`ITEM_ART` in `OfferModals.tsx`). The owner's GIF plays at the top
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
  10 s shooting gallery, +50 a duck (flight plan saved). v7.66.2 (the owner: too easy): ducks cross
  in 1.8 s (was 2.4) and zigzag 8% (was a 4% wobble), 30% of birds are 🕊️ doves and the 🐕 dog pops
  up 3 times; hitting either costs 50 (`duck*` in `POWER_PLAY_VALUES`). Modelled for a player who
  taps ahead of the duck: 100% of ducks hit before, 60-83% now. **Scrooge's Money Bin**: coins fall for 8 s;
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
  (next tiles). Chicken Dinner left this list in v7.67.1 (now a blackjack card). Jackass takes a strike on purpose (shields don't stop it, never the last strike).
- **Timed, blind and bet PowerPlays fire on pick** (`INSTANT_POWER_PLAY_IDS`): Pop Quiz, Hotshot,
  Smell Ya Later!, Bird Box, Daily Double and Mission: Impossible start on the fresh hand when chosen
  from the offer.
  **v7.67.7 (the owner's call): four more fire on pick, since waiting gave no choice:** Hadouken!
  (it already waits for a boss; 3 of 7 picks were never used), Neuralyzer (out of the Mystery Tape
  pool), and the strike erasers Chubbs' Pep Talk and Turn Back Time (`strikeEraser` in
  `data/powerPlays.ts`): a strike now is removed at once (Turn Back Time adds its 10 s); with none,
  it arms and `ADD_STRIKE` erases the next real strike (not Jackass or With Great Power, which take
  one on purpose). Before, both were wasted when used at 0 strikes.
  Held in the pocket, a player could wait for (or build) the right word, then activate and submit.
  New timed or bet ones go there too. Daily Double's wager is never more than the score (it isn't
  offered under 100 points), and a Sliders undo keeps a settled Daily Double or Price Is Right bet. It also
  doesn't re-arm a coin flip the word used (Heisenberg, Double or Nothing, Blue Shell, Space Invader)
  or Scrooge's Money Bin (its Credits are paid outside the run): `settledFlips` in `RESTORE_LAST_TURN`.
  **v7.96.6 (the owner's report: an endless Sliders loop):** the undo restored the meters and `oncePerRunTaken` from
  before the word, so replaying it re-earned the same offers and Sliders came back. `RESTORE_LAST_TURN` now keeps
  Sliders spent, both meters (`powerPlayProgress`, `wordMilestoneProgress`), the cooldowns, offer counts and any charm
  taken after the word; it still rewinds the word, score, clock and tiles. Tests in `slidersLoop.test.ts`.
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
  **v7.84.1 (the owner: too many taps):** Multiplicity's read-first card's main button is "▶ Use [copy]
  now" (`multiplicity-use`): it copies and fires the copy in one go (2 taps, was 3). The copy lands in
  the pocket first and fires once the pocket has updated (`copyThenUse` ref and an effect in
  `GameScreen.tsx`), so it acts on the new pocket. "👯 Keep the copy for later" (`multiplicity-keep`)
  still puts it in the pocket. Browser-checked: Most Excellent Detour 30 → 40 s with the pocket empty;
  Gump Luck opens its card at once.
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
- **Arcade-cabinet look for the menus (v7.90.0, the owner's ask: lighter, a 90s arcade cabinet; their
  picks: cabinet side-art, start + menu screens, all three extras).** `components/CabinetBackdrop.tsx`
  (`.cabinet-backdrop`, `.cab-*` in `index.css`) renders behind every screen except the game board and
  the tour (App.tsx; z-index -1 inside the app frame, so shop themes still own the board): a violet sky,
  two layers of drifting stars, a small striped sunset and a neon grid floor scrolling toward you, the
  horizon at 86% so the sun sits behind the Today strip. The logo (flashing WORD, NERD, tagline) sits in a
  backlit marquee with a chasing bulb border (`.cab-marquee`, `logo-marquee`). Cabinet details: a 1P tag
  on the player chip (`.cab-tag`), CREDIT on the coin chip (375 px and wider), the Play/Continue button
  breathes (`.press-start-pulse`) under the blinking PRESS START. Start-screen panels are more opaque
  so text never sits on the grid. **v7.90.1 (the owner: Missions was see-through):** the Today strip
  chips and the open Missions list are fully solid, tinted per accent (Daily `#0d1838`, Spin / Power Word
  `#2a0f35`, Missions `#0b2433`, done green `#0d2a1e`; `MissionsPanel` too); 90% black still let the grid glow through. All motion stops with
  reduced motion. Browser-checked at 390x844 and 360x640: no sideways scroll, Play on screen.
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
- **Event music (v7.77.0, the owner's ask)** (`EVENT_TRACKS` in `data/music.ts`, files in
  `public/audio/events/`, kept out of the PWA precache like the shop tracks): 🌟 **Golden Round**
  (`eventGolden`, tools/music `goldenFountain`: ethereal and floaty in the spirit of a fairy-fountain
  theme, the owner's pick of two drafts; original melody, chords and harp pattern; A major, 72 BPM,
  cascading 16th-note harp, glassy melody, pad, no drums, 53 s loop) and 👾 **Boss Fight**
  (`eventBoss`, `bossFight`: E minor, 152 BPM, octave bass, staccato square lead, stabs, tom fills,
  25 s loop; "perfect, keep it as is"). Both leveled to about -16 LUFS like the rest. `GameScreen`
  asks `musicService.setEvent()` for the Golden track during a Golden Round, the Boss track while
  `gameState.boss` is set, and nothing over Last Words, Phoenix Down or Game Over (or after leaving
  the screen); the service crossfades and then back to the player's own track (`chosenId` vs
  `currentId`, `retarget`). The Sound panel's **🌟👾 Special music** switch (on by default, saved per
  device as `wordNerdEventMusic`; `eventMusicOn`/`setEventMusicOn` in `services/music.ts`) turns it
  off: the player's track keeps playing, and event tracks aren't even downloaded. Browser-checked by
  watching requests: boss fight → `boss-fight.mp3`, Golden Round → `golden-round.mp3`, switch off → neither.
- **The 1-minute tour (v7.78.0, the owner's picks)** (`components/QuickTour.tsx`, `services/tour.ts`,
  `Screen.Tour` in `App.tsx`, tests in `tour.test.ts`): a "❓ HOW TO PLAY · 1-MIN TOUR" pill under the
  logo (everyone), and a brand-new player (a new name, or no finished runs in `getCareer()`) is
  offered it once on their first Play ("New here?", Take the tour / Skip, just play; names that saw
  it in `tourSeen`). Four hands-on screens with the real tiles and Shuffle button, no score or stats:
  1. a 👆 guides C-A-T, each tile flies up to the word row, SUBMIT: CAT +5, +2 sec;
  2. CLOSET +16 (x2 length), +7 sec, next to CAT's numbers;
  3. the clock ticks, a fake word (TOLC) earns strike 1 of 3, hold SHUFFLE for new tiles and +5 sec;
  4. flip cards for PowerPlays, Charms, Boss Fights and the Golden Round.
  5. (v7.88.0, the owner's ask) YOUR GEAR: a mini board top with a ticking clock and a pulsing 🎒 under
     STRIKES (a 👉 points at it); tapping it opens a small Gear menu (sample charms, a pocket PowerPlay,
     strikes left) and the clock freezes ("⏸ PAUSED", "THE CLOCK WAITS FOR YOU") until ✕ BACK. Next
     unlocks once Gear was opened (`GearDemo` in `QuickTour.tsx`, `tour-gear*` test ids).
  Then "YOU'RE READY!": ▶ Play now (▶ Back to my run when a run is saved and the tour came from the
  pill), 📖 Full How to Play, 🏠 Main menu; SKIP TOUR on every screen goes there. Scores come from
  `tourWordScore` (tile points x length bonus; a test checks it against `calculateScore`), so change
  the words in `services/tour.ts` and the text follows. **v7.78.1 (the owner's ask):** once a player
  finishes the tour (taps "I'm ready ▶" on the last screen; SKIP TOUR doesn't count), the pill under the logo
  is replaced by a small ❓ in the top bar next to 🔊 (`tour-icon`) that replays it. Per name on the
  device (`tourDone`, `tourFinishedBy`/`markTourFinished`), apart from `tourSeen` (offered once).
- **Play board redesign (v7.80-7.82, the owner's asks after a design review; the proposal with a
  playable prototype is the "Word Nerd Play Board" artifact).** **v7.80.0 Feel:** one signature tile
  for every theme (the owner's call: themes change only the background and frame, never the tiles,
  no glow either): a sculpted keycap from an 80s home computer (`.tile-key` and `.tile-face` in
  `index.css`, `TileComponent` ignores `packTileClass` now; `Pack.tileClass` is unused for tiles).
  A darker sloped skirt, a cream dished face, faint grain, a 5 px edge (`--tile-edge`) and a cast
  shadow; a tap sinks it 4 px. Special tiles keep their colours with a see-through dish. Empty rack
  spots are sunken sockets (`.tile-socket`); placed tiles land with a settle (`.tile-land`), new ones
  drop in one after another (`.tile-deal`, 45 ms apart). Shop theme previews show the keycap; Library
  Card and Midnight Arcade no longer promise tiles. Sounds (`soundService`): `playTilePlace(index)`
  climbs a pentatonic scale per letter, `playTileReturn` falls, `playValidWord(length)` grows with the
  word, a softer `playInvalidWord`, a rattle for Shuffle, `playShimmer`; `soundService.haptic()`
  vibrates (Android) and is off with the sound. Tiles stay tap-only (the owner: no dragging).
  **v7.81.0 The stage:** the status area (icons, meters, Gear) no longer takes the spare height; a
  stage (`data-testid="stage"`, `.stage-panel`) fills the middle. It holds the pocket PowerPlay, the
  word as big keycaps growing from the center (`word-stage`, `.stage-tile`, a dashed cursor, tap a
  tile to send it back), the live payoff under it (`stage-readout`: `potentialScore` and
  `timeForWordAtLevel` seconds) and chips for what the word will fill (`stage-effects`: PowerPlay
  letters, Golden streak, Combo, the next length bonus; a shimmer when it fills a meter,
  `StageSounds`), plus game messages. The meters show a pulsing ghost fill for the word
  (`meter-ghost`). Buttons: SHUFFLE (compact `ShuffleButton`) · SUBMIT (glows when ready) · **STUCK?**
  (the Challenge, renamed by the owner: it clashed with Daily Challenge and didn't fit): icon, word,
  "NO WORD?" / "RISK A STRIKE" (red, out of checks) and the count as a corner badge. Its first tap per
  player explains it and spends nothing (`stuckTip`). Clear is gone: ⌫ on the stage (`BackspaceButton`)
  sends back the last letter, hold 450 ms to clear. Player text says STUCK? check (How to Play, the
  scratch prize, Thwomped, Final Frontier, Double Dare, messages); ids (`challengeCount`) are unchanged.
  Under 700 px tall the stage tightens (smaller word tiles, one scrolling chip row, slimmer icons, the
  stage scrolls inside itself instead of overlapping). Browser-checked at 390x844 and 360x640.
  **v7.82.0 The notice rail:** nothing sits between the stage and the tiles any more. At the top of the
  stage (`notice-rail`), after the pocket PowerPlay: the "tap me / read me" notices are cards
  (`NoticeRail`, `Notice` in `GameScreenView.tsx`: icon, title, one plain line, a labelled button),
  one at a time with dots; a new one jumps to the front and pulses (`.notice-new`). Cards: the power
  word hint (LIGHT IT, then SPELL THE LIT TILES · MORE; `data-testid="power-hint"` kept), Skill Shot,
  Head Start. Live counters stay visible in a strip under the card
  (Hold, the speed streak, `PowerPlayTrackers`: Jenga, Hamm, races, bets, quizzes) because some need a
  hold and shouldn't hide behind dots. New "above the tiles" items from the v7.71.1 rule now go in
  the rail: a card if it explains or offers one tap, the strip if it counts down or needs a hold.
  Under 700 px tall the cards show their title only. Browser-checked at 390x844 and 360x640 with a
  pocket PowerPlay, two notices, Jenga and a word on the stage at once.
  **v7.83.0 (the owner's five fixes):** (1) **No zoom:** the viewport has `maximum-scale=1,
  user-scalable=no`, `html` uses `touch-action: pan-x pan-y`, and `index.tsx` blocks iPhone pinch
  (`gesturestart`, two-finger `touchmove`): two fingers landing on tiles zoomed the board and some
  phones kept it; no element was wider than the screen at 320-412 px. (2) **Nothing covers the word:**
  with a word in the row, stage messages sit under its chips (`stage-message`), else in the middle;
  the "Long word! Length bonus" toasts are gone (the live payoff shows it); Skill Shot and Blue Steel
  use stage messages; the global `#toast` is at the top of the screen. (3) **Scrooge's Money Bin is
  harder:** 💣 and 🔩 fall with the coins (`moneyBinHazards`, `moneyBinHazardShare` 0.35,
  `moneyBinEveryMs` 300, `moneyBinHazardSeconds` 1), same speeds, 70% dropped beside the last coin;
  each tapped one costs a second, so the total can go negative (paid through `APPLY_GAMBLE`).
  Simulated: 14.2 coins / 25 s on offer before, 13.6 / 24 s now plus 7.3 hazards. (4) **Gamble cards
  scroll** inside their frame when taller than the screen (`Frame` in `GambleCard.tsx`, safe
  centering); Hollywood Squares has a shorter rules line, a wrapping header row and shorter squares on
  short screens. (5) **Hamm's smash bar** (`PiggyBar` in `PowerPlayTrackers.tsx`, `piggy-chip` kept):
  full width, a wobbling 🐷, the savings in big type and a 🔨 HOLD TO SMASH button; holding fills it and
  shakes the pig, letting go early says KEEP HOLDING…. Browser-checked at 360x640.
  **v7.84.2 (the owner's screenshot: the button row started below the screen until a pinch):** the
  app's height is measured, not trusted to CSS. Tapping Play switches a browser tab to fullscreen, and
  Android Chrome can keep the old `100dvh` afterwards, so the board was one row too tall. `index.tsx`
  sets `--app-h` from `visualViewport.height` (skipped while zoomed) on resize, rotation, fullscreen
  changes, pageshow and returning to the tab, then again 250 and 700 ms later; `#main-container` uses
  `h-[var(--app-h,100dvh)]`. Browser-checked: fullscreen, leaving it and resizing to 810/760 px keep
  SUBMIT on screen.
  **v7.84.0 A clean top (the owner's photos: "way too many things going on up there"; their picks):**
  the top of the board shows only what matters every second: SCORE (sized to fit, `hud-score`, with the
  next-gate bar), the clock with the level badge under it, and STRIKES with a 🎒 button under them
  (`gear-button`, a charms badge `gear-count`, gold glow on `gearGlow`). The WORDS count, the trophy
  icon row (🎸🔥💾⭐👾), 📖, 🔊, 💾 and the Gear strip of charm icons are gone from the board: the Gear
  menu now has SOUND, EVENT LOG and SAVE & QUIT buttons under its title (`gear-actions`), the words
  played in RUN STATUS and a TROPHIES box (`gear-trophies`, tap for the trophy's info). The three
  meters are one slim row of bars (`meters`), still glowing with a ghost fill for the word on the
  stage. The charm-time note (🍀 CHARM 3→2 SEC · LV7 70%, `HudCharmNote`) shows in the score column for
  3 s instead of dropping over the clock and level badge. The stage grew from about 330 to 462 px at
  390x844 and from about 180 to 298 px at 360x640. Browser scripts save through 🎒 → SAVE & QUIT (the
  skill's `playtest.mjs` too).
  **v7.84.3 (the owner: the timer wasn't centred):** the HUD grid is `minmax(0,1fr) auto minmax(0,1fr)`
  again (`data-testid="hud"`); v7.84.0 had made only the left column flexible, which pushed the clock
  right. With the 🎒 under the strikes the right column is narrow anyway. Measured: the clock is 0 px
  off centre at 360/390/412 px, and the score fits up to 1,234,567.
  **v7.85.0 (the owner's screenshot: the pills under the word weren't readable, the points weren't the
  real points; their picks):** under the word: **BASE** N PTS +N sec (`base-label`): the preview is
  `calculateScore` only, and about 50 boosts land after Submit (Combo x2, upgrades, long-word boost,
  multipliers on charms, Glass Joe, Blue Steel, chains, charms that subtract...). So after
  submit the real score pops on the stage (`LandedPop`, `landed-pop`, state `landed` in `GameScreen`
  set where the old "WORD: +N" message was): the word, "+33" big, and "BASE 5 · BOOSTS +28" when they
  differ; it fades after 2.6 s, hides when a tile is placed, waits for any card the word opened to
  close, and is skipped if that took over 30 s. The routine pills are gone (the meters up top preview
  the fill); only big news shows, one line each (`stage-effects`): "⚡ FILLS YOUR POWERPLAY METER!",
  "★ STARTS A GOLDEN ROUND!", "🔗 COMBO x2 ON THIS WORD!". The open spot after a 3-7 letter word glows
  gold when one more letter pays more (`.stage-cursor-pays`, `next-slot-pays`) with a "+1 LETTER · x1.5
  · +5 sec" tag lined up under it (`next-letter-tag`). Browser-checked: LOOT BASE 5 → +33 (BOOSTS +28)
  with the Combo x2, the pop shown after the PowerPlay offer closed.
  **v7.86.0 (the owner's ask: players should see which word to replay for a record):** Gear has a
  GREATEST HITS box (`gear-hits`, `hitsBoard` in `services/greatestHits.ts`): each record with its
  leading word once it has 2 plays ("📀 TEA 2/3 · ONE MORE FOR GOLD +500"), a paid record as "GOLD ✓
  CAT · PAID", or the rule when nothing's in progress; a tap explains it. On the stage, spelling a word
  whose play would complete a record adds big news first in line: "📀 TEA GOES GOLD: +500!"
  (`hitIfPlayed`). The strip chip (`hits-chip`) is a size larger. An open record only counts words still
  short of it. Tests in `hitsBoard.test.ts`.
- **Heads-up cards (v7.91.0, the owner's ask: players never noticed the power word hint up
  at the top of the board).** The first time each appears in a level, a small `heads-up` modal says so and
  waits for OK (it pauses the clock and gets the 1 s tap guard like any auto-opened card): "⚡ POWER WORD
  IN THIS HAND!" with the word's length and prize, or "🔺 ZELDA CAN HELP THIS LEVEL!". OK flashes the
  matching notice (`noticeFlash` in `GameScreenView`, `NoticeRail`'s `flash` prop, `.notice-flash`, a gold
  pulse for about 4 s, still under reduced motion) and brings it to the front. Once a level each, kept in
  `gameState.headsUp` (`power`, `zelda` → level) so a resumed run doesn't repeat it; never in a Golden Round
  or over another card (it waits). Browser-checked at 390x844 and 360x640: clock 50 → 50 while open.
  v7.96.5 (the owner's report: the hand showed through and gave the power word away): heads-up cards sit on a fully
  dark backdrop (`bg-crt-950`), so the tiles can't be read until OK.
- **Power word tiles light correctly (v7.91.1, the owner: "sometimes it wasn't firing").** Three gaps fixed
  in `powerLitIds` (`GameScreenView.tsx`): it matched single letters only, so a word needing a combo tile
  (RINGS with an ING tile) lit just R and S; it now uses `assignTilesToWord`, the game's own speller. A boss
  rule dimming a tile won over the glow; the glow now wins (`Tile.tsx`). Letters already in the word row
  never lit; they do now. The glow is its own gold pulse (`.power-tile-glow`, it shared the boss rule's
  pink). Browser-checked: SLOT in HEALSTOR lights L, S, T, O; RINGS lights R, ING, S; an S in the word row
  stays lit. Tests in `components/__tests__/powerLit.test.tsx`.
- **📼 The Video Store, 🎬 Genre Levels and 💿 Collector's Tiles (v7.96.0, one drop, the owner's picks;
  the approved mockup is the "Word Nerd Video Store" artifact).** Tests in `services/__tests__/videoStore.test.ts`.
  **The store** (`storeModal`, queued after the level-up card on levels 2, 4, 6..., `storeOpensAt`; modal
  `video-store`, `components/VideoStore.tsx`): the clock is paused (a modal) and **seconds are the money**:
  every price comes off `state.time`, never below `keepAtLeast` (15 s). Shelf of 3 tapes (`dealShelf`,
  seeded with `dailyRank(runSeed, level*100 + deal)`, so the Daily matches): a charm (NEW RELEASE, 8 s, a
  fragile one 6 s; pool `storeCharmPool`: offer filters, never Phoenix Down or a selection charm), a pocket
  PowerPlay (RENTAL, 5 s; `storePowerPlayPool`: no instant, time or fire-on-pick cards, not Continue?, not the
  one held) or `tileChance` (40%) a Collector's Tile instead, and a genre poster (6 s). 🔄 Restock 2 s, +1 each
  time; 💵 Trade in a charm for half its price in seconds (all of it when upgraded; fragile charms can't);
  🚪 Walk out with nothing for +150 (a prize), else "✓ Done". A receipt totals it ("CLOCK 49 → 33 sec").
  Reducer: `STORE_RENT` (reuses `CHOOSE_CHARM`/`CHOOSE_POWER_PLAY`), `STORE_RESTOCK`, `STORE_TRADE_IN`,
  `STORE_LEAVE`; the card's shelf, `sold`, `lines` and `deal` live in the pop-up's data, so a save keeps them.
  Prices come from the old Fork events: the median clock at level 4 was 43 s (10% at 8 s or less). A first
  visit shows a "WELCOME TO THE VIDEO STORE" panel (once per player, `services/intros.ts`). Stats: a `store`
  event (level, rented, spent, back, restocks, walked); **paste the new rules from `docs/LEADERBOARD.md`**.
  **Genres** (`GENRES`): 🩳 Shorts (3-4 letters), 🎞️ Epics (6+), 🎬 Sequels (a double letter), 🦇 Cult Classics
  (J/K/Q/X/Z/V/W), 🎤 Musicals (3+ vowels), 🔁 Remakes (same letters as an earlier word this run, the same word
  counts). Each ★ (up to 5) pays `perStar` on every word that fits: +5, +25, +30, +25, +20, +40. Stars come
  from posters and by themselves every 10 words that fit (20 for Shorts; `countGenrePlays`, `genrePlays`).
  Simulated fit rates: casual Shorts 89%, Cult 17%, Sequels 9%, Musicals 3%, Remakes 3%; long-word players
  Shorts 45%, Epics 22%, Musicals 20%, Cult 18%, Sequels 12%. Paid in `completeSubmission` after the charm
  sets ("🎬 Sequels ★2" lines, 0 means 0 holds); the stage shows "🦇 CULT CLASSICS ★1 +25" while spelling
  (`stage-genres`); Gear has a GENRES box (`gear-genres`; v7.96.2, the owner's ask: each genre row
  shows "+50 A WORD" or NOT PAYING YET, a bar with "1/10 TO ★3", and EARNED +N this run from `genreEarned`
  (its score lines in the log); the header totals all genres; a tap explains the math, "★2 × 25", and both
  ways to earn stars); a "GENRE LEVELS!"
  heads-up card the first time any genre has a ★. **v7.96.7 (the owner's call): Shorts is exactly 3 letters** ("like CAT or
  SUN"), +15 a ★ (was +5), a ★ every 12 words (was 20): 4-letter words already have many rewards, and from level 3 a
  3-letter word earns no time, so the bonus makes it a choice. 3-letter words are 51% of a casual player's words (3-4
  letters was 89%), 13% of a long-word player's; 99.9% of hands can spell one. Average per ★: casual +4.5 → +7.7 a word.
  v7.96.5 (the owner's ask: a level-up by play was easy to miss): a
  `genre-up` card (the heads-up card's look, in `POST_WORD_MODALS` so closing it deals the next hand) waits for OK:
  "SEQUELS IS NOW ★1!", what the player did ("You played 10 words with a double letter..."), what it pays now and how
  to reach the next ★ (play N more, or its poster in the store). It replaced the "🎬 GENRE UP!" stage message.
  **Collector's Tiles** (`COLLECTOR_TILES`, `gameState.collectorTiles`, max 4 a run): 💿 Chrome (x2 word tile,
  uses the normal tile multiplier), ✨ Holo (+25 a word), 📺 Static (a "?" blank: tapping it opens the
  `static-tile` letter picker, `SET_STATIC_LETTER`, worth 0), ⏪ Rewind (+3 s, onto `pendingTimeBonus`). From
  the store (Chrome 8, Holo 6, Static 7, Rewind 7 s) and scratch-offs (`SCRATCH.weights.tile` 0.8, one a
  ticket, only with room). `landCollectors` (in `START_NEXT_ROUND`, after gems) puts each owned tile that
  isn't in play onto a plain tile: a fresh one always, then `returnChance` (50%) a hand, rolled with
  `tileRoll`. Tiles show a corner icon and, since v7.96.3 (the owner's ask: the icon alone got lost), a thick
  frame of their own around the keycap and its base (`.collector-frame`, `.collector-<kind>` in `index.css`, a span in
  `Tile.tsx`): Chrome polished silver, Holo a shifting rainbow, Static cyan TV-snow stripes, Rewind VHS orange, each
  with a soft glow. Chrome's shine sweep runs on an inner layer (`innerGlimmer`), since `glimmer-effect` clips
  everything outside the tile; `.tile-key::after` is the keycap grain, so don't use it for frames. Each kind explains itself the
  first time (heads-up card). `drawTiles` skips a stray "?" in the bag. How to Play has a "The Video Store"
  section; the tour's step 4 has Video Store and Genres flip cards.
- **Score pop after each word (v7.94.1, the owner's call; replaced v7.94.0's line-by-line tally, which took
  too long and went by too fast to read):** the stage shows the BASE while spelling; after Submit a quick
  pop (`ScoreTally` in `GameScreenView.tsx`, `score-tally`, `landed-pop`) shows the word, then the big
  number rolls from that BASE to the real total in `LANDED_ROLL_MS` (550 ms, eased, ticking notes; `rollValue`),
  slams in, holds `LANDED_HOLD_MS` (1.4 s) and fades. When boosts changed it, "BASE 35 → +85" shows under
  it (`landed-breakdown`); the full breakdown is in 🎒 Gear → Event log. The clock waits while it shows
  (`tallying` via `onTally`); v7.96.2 (the owner's call) removed the "TAP TO SKIP" cover: it's quick
  enough, and placing a tile ends it. It waits for any card the word opened and never replays (`tallyDoneKey`). v7.96.4 (the owner's
  report): placing a tile marks the pop done (`placedCount` effect); before, it only hid the pop, so sending the tile
  back replayed it and paused the clock again (browser-checked: 4 replays and the clock stuck at 58-59 before, 0 after). Reduced motion skips the roll. Browser-checked:
  GRAVITY with Epics ★2 rolled 35 → 56 → 85 and held 1.4 s with the clock at 29. Tests in
  `components/__tests__/scoreTally.test.ts`.
- **Fluncle and Find the Lady (v7.96.8, the owner's asks).** **Fluncle is Proud** was picked 12 of 73 offers (16%,
  average 27%) while the +10 sec Detour was picked 84%: it now pays +400 (`POWER_PLAY_VALUES.fluncleProud`, a prize, so
  +600 at level 6) and +8 sec (`fluncleSeconds`, PowerPlay time, full at any level), and it's a time card
  (`TIME_CARD_IDS`, at most one per offer). Detour stays the bigger time play (10 sec), Fluncle trades 2 sec for points.
  **Find the Lady (DEAL)** was too fast to follow: 5/7/9 swaps at 420/300/210 ms with no pause. Now 3/4/6 swaps at
  800/650/520 ms (`MINI_GAME_VALUES.monte.swaps`/`swapMs`); a card moves for 60% of each swap and rests the rest
  (`moveShare`), and the two cards trading places arc past each other, one lifted and bigger, one lower and smaller,
  so they never slide through each other. Shuffles take about 4-4.6 s. Browser-checked: Fluncle 30 → 38 sec, +400.
- **Hammer Time text (v7.96.9, the owner: unclear how it works once the clock speeds up).** Same effect: every tick
  is stretched, so it takes `CHARM_BONUS.hammerTimeSlowPercent` (15%) off whatever speed the level runs at, all run
  long (level 1 x1.00 → x0.85, level 10 x1.53 → x1.30, top x2.40 → x2.04); Golden Rounds keep their own clock. The
  description says so ("15% slower at every level, speed-ups included"), a `finePrint` lists those speeds from
  `clockSpeedFor`/`hammerClockFor` (`services/rules.ts`), and Gear's clock row shows the slowed speed with a 🛑 and
  explains it on tap. It used to say "a minute lasts about 71 seconds". Tests in `hammerTime.test.ts`.
- **Video Store take-backs and Gear (v7.96.10, the owner's asks).** A trade-in can be taken back until Done:
  each trade line on the receipt has "↩ TAKE BACK" (`store-take-back`, `STORE_UNDO_TRADE`), which puts the charm
  back in a slot with its ⭐ upgrade and buff (its counters were never reset) and takes the seconds back off the
  clock. The line keeps what that needs (`trade` on `StoreLine`, `data/videoStore.ts`); `takeBackBlock` says why it
  can't: slots full, already held, or the seconds were spent (the clock can't drop under `keepAtLeast`, or under the
  clock before the trade when that was lower). With every line taken back, Done turns back into Walk out (+points).
  The "YOUR CHARMS" strip is gone: a 🎒 CHECK YOUR GEAR button (`store-gear`) opens the normal Gear menu with
  `data.returnTo` set to the store card; there ✕ BACK reads ◀ STORE and returns to the store, a note says you're
  shopping, and ▶ USE, sound, log and save are hidden. Gear scrolls `#main-container` to the top when it opens (the
  store could leave it scrolled, hiding Gear's title). Browser-checked at 390x844: 29 → 33 sec on trade, 29 after
  the take-back, Gear and back. Tests in `videoStore.test.ts`.
- **Pocket dock, power word choice, CLEAR (v7.97.0, the owner's asks and picks).** **The pocket PowerPlay docks
  above the tiles** (`PocketDock` in `GameScreenView.tsx`, `pocket-dock` in a `pocket-row` at the bottom of the stage,
  so the tiles never move): icon, name, the first sentence of its description and ▶ USE (Multiplicity: ▶ COPY / WAIT),
  plus the 📼 tape bonus. It used to be a pill at the top of the stage, and players forgot it. A soft green glow breathes
  (`.pocket-breathe`, 3.2 s); after `POCKET_NUDGE_WORDS` (3) words unused it bounces once per word with a gold glow and
  says "DON'T FORGET ME! Tap to use it." (`.pocket-nudge`, `data-nudge`; counted from when the screen first saw it, so a
  resume starts again). Still under reduced motion; the description line hides under 700 px tall.
  **Power word heads-up is the choice (the owner's design):** the card shows the prize, "4 LETTERS · STARTS WITH S" and
  what it does, with 💡 Light up its tiles · −5 sec (`pw-light`) or 🔍 I'll find it myself (`pw-find`); either closes
  it and play goes on. Lighting costs a flat `POWER_WORD_EFFECTS.lightSeconds` (5, the owner's pick over a 20% prize
  cut, since most prizes are all-or-nothing), never leaves the clock under 1 sec (`canLightPowerWord` in
  `services/powerWordHint.ts`), reducer `LIGHT_POWER_WORD`, logged as "Power word hint". The lit state is saved with the
  run (`gameState.powerHint.lit`; it was screen state, free). The rail notice gives the same clue and a paid "LIGHT IT
  −5 SEC" button (none when the clock is too low); once lit it says SPELL THE LIT TILES · MORE.
  **CLEAR is back** (`clear-word`, right of the dock, above the tiles; shows while the word row has tiles) and replaces
  the stage's ⌫ (`BackspaceButton` is gone): tapping a word tile still sends back that one letter. How to Play updated.
  Browser-checked at 390x844 and 360x640: the last hand tile stays at 700 px with or without a word, the nudge starts
  after the 3rd unused word, light lit 4 tiles and logged −5 sec, find left the rail clue. Tests in
  `powerWordLight.test.ts`.
- **Clue audit (v7.97.1, the owner's ask: clues must fit their reference and never hand over the word).** All 132
  secret-bonus clues (`hint` in `data/secretBonuses.ts`, the only thing the Collection shows before a find) were read;
  23 were rewritten, the owner approved all. 11 gave the word away by subtraction or fill-in ("minus the ning", "Chop the
  Terminator down to size", "Look at this game's title", "Put on your shades and ___ with it"): TERM, PARK, NERD, WIN, RAP,
  POET, DEAL, GOT, STAR, OOPS, LEAP. 9 quoted or paraphrased song lyrics (TEEN, KISS, BYE, DOGS, ZOMBIE, SPICE, SPIN,
  SCRUBS, WORD; SPICE's also came from Wannabe). 3 had the reference wrong or loose: OFFICE (the Dundies are at
  Chili's), AIR (unreadable), HEX (no Harry Potter link). Rule for new clues: point at the reference plus a second,
  everyday meaning; no "minus/dropped/chop" letter math, no fill-in of a title that ends in the word, no lyrics.
  Left as they are, loosely tied: LANE (Kingpin), RING (Big), NOTE (Guitar Hero).
- **Checkout, not Rent (v7.97.2, the owner's ask: "rent" made players think it was temporary).** Store wording:
  "▶ Check out · −N sec", "✓ CHECKED OUT · IT'S YOURS" (detail), "✓ YOURS" (tape), "NOTHING CHECKED OUT YET" (receipt),
  the PowerPlay tape's label is POWERPLAY (was RENTAL), the welcome panel, How to Play and the tour say it's yours for
  the rest of the run, and the log says "Checked out X". Code ids keep "rent" (`STORE_RENT`, `store-rent`, the `store`
  stat's `rented`). Use "check out" in new store text.
- **Pop Quiz graded on a Golden word (v7.97.3, a player's report: it "didn't time correctly" around a Golden Round).**
  The timing itself was right (real play seconds, `quizMs`, paused with the clock), but a Golden word takes its own
  branch in `completeSubmission` and returned before the quiz was graded, so the quiz kept counting through the whole
  Golden Round and the next normal word was graded on all of it ("TOO SLOW, -10 sec"). It happens when the word that
  fills the PowerPlay meter also starts the Golden Round. Now one helper, `gradePopQuiz`, grades it on the next valid
  word, Golden or not (the Golden branch adds its log entry and outcome card). Daily Double still waits for a normal
  word (it isn't timed). Accuracy: the quiz counts whole clock ticks, so it can read up to one tick short (1 sec at
  level 1, about 0.4 sec at top speed), in the player's favor. Browser-checked: Golden word fast → +300 and +5 sec,
  7 sec late → TOO SLOW, normal word still graded, no quiz left running after either.
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
- **The clock can't be stalled (v7.90.2, a player's report):** tapping a tile in and out over and
  over stopped the clock. The tick was a `setInterval` in an effect that re-runs on every state change,
  so each tap restarted a full tick; taps faster than one a tick meant it never fired. The clock effect
  now uses a `setTimeout` chain and carries the real time already spent toward the next tick across
  restarts (`tickCarry` ref in `GameScreen.tsx`). Browser-checked with taps every 0.3 s for 10 s: old
  code 59 → 59, now 59 → 49. Browser scripts click the pulsing Play/Continue buttons with
  `{ force: true }` (Playwright waits for them to stop moving otherwise; `playtest.mjs` too).
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
  **Lord Business (v7.67.6, a player's report: every tile turned red):** USE YOUR RAREST TILE glowed
  every tile tied for the top value, so a hand of all 1-point tiles (about 1 in 20) lit up entirely.
  Now an all-tied hand lights nothing and any word counts (the description says so), and Lord
  Business and Hades read a tile at the value it shows (`tileValue`: `tempPoints` first). Tests in
  `lordBusiness.test.ts`.
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
  clicks on the number; find 3 in 20 s, +100 each, +150 cracked; v7.67.8, a player found it unclear: the
  rules name the secret numbers and the dial's middle, and the dial says ❄️ COLD / ♨️ WARM / 🔥 HOT /
  🎯 ON IT! TAP SET with "FINDING SECRET NUMBER 1 OF 3", the middle shows ON IT and SET pulses), WIRE 💣 Cut the Wire (3 bombs, 8 s
  each, a manual line that gets trickier: `wireBomb` in `services/miniGameRules.ts`; a test reads
  every line back independently; +100 a bomb, +150 all), NEST 🥚 Egg Drop (drag the nest for 10 s:
  +20 an egg, golden +100, rotten -20) and LEAP 🐸 Road Hop (hop 5 lanes of traffic in 15 s, +60 a
  lane, +150 across; a hit sends you back to the curb). Tops of about 450, like the others; values
  in `MINI_GAME_VALUES`. Words chosen as common 4-letter words that a hand can spell 1.1-2.0% of the
  time (the 1.4-3.7% words were taken). Browser-checked at 390x844: all five play and pay.
- **Arcade game instructions pass (v7.67.9, after the Safecracker report):** every intro card says
  which button to tap and when (no "tap to throw" without naming the target), and the timing games
  show a cyan hint line by the button (`data-testid="arcade-hint"`): Darts, Ring Toss, Bowling, Free
  Throws, High Striker, Road Hop; Loop the Loop's speed bar labels STALL / CLEAN / FLY OFF; Balance
  Act says "push the ball back to the middle". Rules rewritten for Pong, Claw, Darts, Penalty,
  Yahtzee-lite (what a straight is), Bowling, Mini Golf, Free Throws, Ring Toss, High Striker, Loop
  the Loop, Balance Act, Cut the Wire, Egg Drop, Road Hop. A new arcade game should do the same.
- **MATH (v7.64.0, the owner's idea):** 🧮 Mathletes ("The Limit Does Not Exist", Mean Girls), an
  arcade word. A 10-second quiz with 4 big answer buttons (`MathQuiz` in `MiniGames.tsx`,
  `mathProblem` / `mathPoints` in `services/miniGameRules.ts`, `MINI_GAME_VALUES.math`): single-digit
  sums first, two-digit after 3 right, never a negative answer; distractors are near misses (±1,
  ±2, ±10). Each right answer pays 60, +20 more for each in a row (5 in a row +500, 6 +660); a
  wrong one costs nothing but resets the streak; a prize like the other arcade games (grows with
  the level). Numbers use the tile font (Bungee's 7 reads as a ?). Browser-checked: 6 right and 1
  wrong in 10 s paid +500.
- **Are You Smarter Than a 5th Grader? (v7.65.0, the owner's ask: a PowerPlay like MATH)**
  (`fifthGrader`, `FifthGrader` in `GambleCard.tsx`, `timesProblem` in `services/miniGameRules.ts`,
  `fifthGrader*` in `POWER_PLAY_VALUES`): fires on pick (`INSTANT_POWER_PLAY_IDS`, `CARD_ON_PICK`).
  10 seconds of times tables (2-9, up to 12 after 3 right) with 4 answer buttons; each right answer
  climbs the ladder (50, 100, 150, 250, 400, 600, 800, 1,000, labeled 1st to 5th grade), a wrong one
  drops a rung, and the prize is the rung you finish on (a prize: grows with the level). Browser-
  checked: 6 right, 1 wrong → 3rd Grade +400 (+440 at level 2).
  **RINGS shield, checked (v7.65.0):** it worked (first strike blocked, second counted), but the buff
  showed the Hylian Shield PowerPlay's name, so it now reads 💍 Ring Shield, the blocked-strike
  message names the shield that took it, and any shield shows by STRIKES. `ADD_STRIKE` no longer
  edits the previous state's `activePowerPlays` in place.
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
- **🔺 Winner's Circle, the 20,000 gate (v7.76.0, the owner's pick for the open spot; 36% of runs
  reach 20k against 47% at 10k and 27% at 30k)** (`GATES.winners`, `Winners` and `dealWinners` in
  `MiniGames.tsx`, clues in `data/winnersCircle.ts`, tests in `winnersCircle.test.ts`): the $25,000
  Pyramid. Three clues, 40 s total. Each clue is one of the game's own definitions (502 everyday 4-6
  letter words whose definition doesn't contain the word, generated from `data/internalWords.ts`;
  edit the file freely, the test checks every entry); its answer is hidden in an 8-tile board (its
  letters + 4 extras, never in order). The pyramid pays +200, +400, +600 per clue and +800 for all
  three (2,000 in all, flat like every gate; Keymaster adds 50%). A wrong word costs nothing; PASS
  skips a clue and its prize. Clues and boards are dealt once and saved. Gates are now 10k, 20k,
  30k, 50k, 70k (`GATE_LIST`, `nextGateFor`; Keymaster stops being offered once all 5 are passed).
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
  **💡 Final Jeopardy (v7.75.0, the owner's design after Lingo and a fresh-tiles version were
  dropped as too much):** Last Words keeps the real final hand, face up. Before a tile can be tapped
  (after the 1.5 s guard), the card asks for a bet: 5% or 10% of the score (`FINAL_JEOPARDY`, rounded
  to 10, capped at 3,000 so one bet can't swing the Top 50), or "No bet, just play". Then a category
  flips over (`FINAL_CATEGORIES`, `finalCategoryDeal`, `finalBet` in `services/rules.ts`): 6+ letters,
  J/K/Q/X/Z/V/W, a double letter, B/C/M/P, starts with S or T, one vowel in 4+ letters, 5+ letters.
  A random final hand can meet them 48-86% of the time (about 60% overall); since v7.92.0 the
  category is always one the hand can make. You see your tiles but not the category when you bet. A last word that fits wins the bet; one that doesn't, or no
  last word, loses it (never below 0). The category is dealt in `END_RUN` and the bet saved with the
  card (`SET_GAMBLE_STATE` key `fjBet`, now allowed on `last-words`), so a quit can't reroll either.
  The card shows ✔ FITS / ✘ DOESN'T FIT as you spell; the payout is a separate "Final Jeopardy" log
  entry in `handleLastWords`. Browser-checked: 12,345, bet 1,230, BALLOONS on A DOUBLE LETTER →
  13,665 on Game Over.
  **v7.77.1 (the owner's ask):** a lost bet always shows a word that would have fit, so players see
  it was possible and learn one: the longest everyday word in the final hand that fits the category
  (`playableWords`, found once the bet is placed), under the -bet line after a miss, and on a new
  step after "No last words" (it no longer ends the run at once; "End the run" does). If no word in
  the hand fits, it says so ("a tough category: nobody could have made that one").
  **v7.92.0 (the owner's asks: the bet got lost under the board; never ask for a word the tiles can't make):**
  the bet is its own blue card shown before the board (`fj-bet-card` in `LastWordsCard.tsx`): "💡 FINAL
  JEOPARDY", three numbered steps (bet, a secret category is revealed, spell a last word that fits),
  the final hand, the bets and "No bet, just play my last word". The category is now always one the hand
  can make: when the card opens it finds every everyday word the tiles spell (`playableWords`), keeps the
  dealt category if one fits, else picks one that does (`finalCategoryFor` in `services/rules.ts`), and
  saves it (`SET_GAMBLE_STATE` key `fjCategory`, read by `handleLastWords`; 'none' means no bet). A miss
  always shows a real word that fit (`finalCategorySolution`, the longest). Simulated on 500 real final
  hands: the old random deal was impossible in 41% (204); now 287 keep the dealt category, 204 get one
  they can make, 9 (2%) can make none and skip the bet. Browser-checked: CATDOGZQ dealt A DOUBLE LETTER
  → STARTS WITH S OR T, skip shows TACO. Tests in `finalJeopardyFair.test.ts`.
  **v7.93.0 (the owner's call: a bet should still be a challenge):** a bet gives the player
  `FINAL_JEOPARDY.betSeconds` (30) to spell the last word; no bet, no clock. The bet card spells out the
  choice in two boxes ("⏱ BET: you get 30 seconds to spell it" / "🛋️ NO BET: no clock") and on the buttons
  ("⏱ Bet 620 (5%) · 30 sec", "No bet, no clock"). The clock shows in the category box (`fj-clock`: big
  seconds and a bar, red and ticking for the last 10). Its deadline is saved with the card
  (`SET_GAMBLE_STATE` key `fjDeadline`, epoch ms), so quitting doesn't restart it. Running out loses the
  bet: "⏱ TIME'S UP!" (`fj-timeout`), the -bet line and a word that would have fit. Without a bet the
  board still says the clock is stopped. Browser-checked at 390x844 and 360x640: 29 sec after the bet,
  time's up after 30 s with TACO shown; no bet showed no clock.
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
  v7.66.1 (the owner: the label covered the letter): a gem shows a small "x3" corner pill like x2
  tiles and a tiny 💎 in the other corner (it was a wider "💎x3" pill), and an x4 gem is teal like
  the others (it used the red 4X super-tile look). Checked at 390 and 360 wide.
  Two gems in one word add (x5 + x5 = x10), like all word-multiplier tiles, so banking one is a
  real but bounded tactic. It waits for any open pop-up and for the Skill Shot card on the same hand.
- **Borrowed mechanics, batch two (v7.43.0).** Values in `FORK`, `HOLD_SLOT`, `GRUDGE`.
  **Fork in the Road** (v7.43-v7.65) is gone (v7.66.0, the owner's call: players never picked a
  route that cost time). Its levels (4, 7, 11) now deal a **🎟️ scratch-off ticket** (`SCRATCH` in
  `config/gameplay.ts`, `services/scratch.ts`, `components/ScratchCard.tsx`, `scratchModal`, reducer
  `SCRATCH_RESULT`): a 3x3 card with 2 skulls; each scratch reveals a prize that REPLACES the one
  held, bank any time, a skull wipes it, the first scratch is always safe (`safeFirstScratch`).
  Prizes are dealt at random by `SCRATCH.weights`: points (a prize), time (full), shuffles, a
  Challenge, a good charm (only with an open slot, never one held; equipped via `CHOOSE_CHARM`) or a
  good pocket PowerPlay (only with an empty pocket). The deal is rolled when the card is queued and
  saved with scratched squares (`SET_GAMBLE_STATE`), so a quit can't redo it. v7.67.3 (the owner's ask): after a
  bank or a bust, every unscratched square turns over (dashed, "MISSED", skulls "DODGED") so the
  player sees what they passed up; a bank pays only on "Take" (`banked` saved in the pop-up's data). v7.67.4: a turned-over
  charm or PowerPlay square says "ⓘ READ"; tapping it shows its name, description and flavor in place
  of the rules paragraph (tap again or ✕ to close), before or after a bank, without scratching. Old saves: `route` is
  ignored and an open `fork` card closes itself. The `fork` stat event and FEATURE_REVIEW notes are
  history. **🛩️ I Feel the Need… for Speed** became a speed streak (`nextSpeedStreak`,
  `speedStreakPoints`, `CHARM_BONUS.speed*`, `gameState.speedStreak`/`speedLastMs`): 4+ letter
  words each within 4 play seconds of the last; the 2nd pays +25, then +50... up to +150; a slow 4+
  letter word restarts it, a short word or a strike ends it; a 🛩️ chip shows the streak; upgradable.
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
  **v7.96.6 (the owner: "I haven't seen bones in a while"):** it was firing (66 finds, 48 looted), but it fetched the
  newest 60, mostly the family's own runs (skipped), and needed the exact level, so a player named Dad had 0 ghosts
  at levels 2, 4 and 5. Now `BONES.fetch` is 200, `pickBone` takes a ghost that fell at or below the level reached
  (an exact-level one first), and each level-up has `BONES.chance` (50%) so it spreads over levels: Dad 4-17 ghosts a
  level, about 87% to meet one by level 4. Still one a run.
- **Power words** (10 secret words with `effect`, no points): SLOT (slot machine, +1/3/10s), SNOW
  (clock frozen 10s), HEAL (remove a strike, else +100), SLOW (half-speed clock for 3 words), TWIN
  (clone your best word's time + a Word Combo step), RINGS (a strike shield), REWIND (clock one speed
  step slower for the level), SWORD (fills the PowerPlay meter), SPICE (next word x3), CAKE (charm
  offer). They fire on submit and can fire again once per level; other secrets are once per run.
  New ones should be harder to spell than the existing ones (they can be abused). Values in
  `POWER_WORD_EFFECTS`; player-facing text in `powerWordInfo()` (`services/rules.ts`).
  **v7.66.2-3 (the owner: "talk like a human", then "but don't lose the flavor"):** every `does`
  line opens with a nod to its reference and then says plainly what happens, e.g. SWORD: "It's
  dangerous to go alone: your PowerPlay meter fills up, so you pick a PowerPlay right now."; TWIN:
  "Double trouble: you get the seconds your best word earned all over again...".
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
- **One save writer, and End run (v7.67.5, the owner's report):** a saved run came back on Continue
  after the owner had erased it, started over and saved a new one. Reproduced: two copies of the game
  open at once (the installed app and a tab, or a window left in the background) share one save
  slot, and the old copy's auto-save (every 5 s, on hide) wrote its run over the new one within 6 s.
  Now each GameScreen claims the slot when it opens (`savedGameOwner` / `savedDailyGameOwner`,
  `ownsSave()`); a copy that lost the claim stops saving and shows "📼 THIS TAPE WAS RECORDED OVER"
  with a way back to the start screen (`onLostSave`, `onLeaveRun`), and `handleGameOver` only clears
  the slot if it holds that run (`runSeed`). **End run** (`components/EndRunCard.tsx`): "🗑️ End this
  run without saving" in the 💾 card and "🗑️ End the saved run" under New Game on the Start screen;
  two steps (the second swaps the buttons and wakes after 1 s, "Game over, man. Game over!"), then
  the run is thrown away: no Game Over screen, score, personal best or stats (the owner's call), and
  the slot is marked ended so no other open copy writes it back. Browser-checked both, plus the two
  windows. The scored Daily's try stays used once it started.
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
