# Wiring new content

Line numbers drift, so this file points at **searchable strings**. Grep for them to find the
spot, and copy the closest existing example.

## Contents
- [Secret bonus words](#secret-bonus-words)
- [PowerPlays](#powerplays)
- [Charms](#charms)
- [Cosmetics: badges and titles](#cosmetics-badges-and-titles)
- [Streak milestones](#streak-milestones)
- [Themes](#themes)
- [Daily missions](#daily-missions)
- [Config constants](#config-constants)

---

## Secret bonus words

Data only: append an entry to `data/secretBonuses.ts`. The header comment in that file is the
field guide, and `docs/BONUSES.md` has more. Everything else is automatic: the reveal art, the
Collection, the Bonus Vault at `/?bonuses`, the collection total and the build check.

```ts
{
  id: "treatYoWaffle",                 // unique camelCase, never shown
  word: "WAFFLE",                      // uppercase; or score: { kind: 'contains'|'endsWith'|'equals', digits: '42' }
  name: "🧇 “Treat Yo' Waffle” 🧇",
  description: "When you submit the word \"WAFFLE\".",
  points: 175,                         // and/or shuffle: 1
  message: "Fallback line (required, shown only if there's no hint).",
  hint: "Leslie Knope's breakfast of champions. Whipped cream is not optional.",
  media: "vhs",                        // 'vhs' (movies/TV) | 'cartridge' (games) | 'cd' (music) | 'arcade' (default)
  source: "Parks and Recreation",      // required for vhs/cartridge/cd; printed on the label
},
```

Bonus rewards are typically +100 to +200. The creator's own TEX is +300 as a signature, so keep
regular words below that.

The build (`npm run check:bonuses`, also run in prebuild) refuses to publish if:
- the word is blocked or not in the dictionary,
- the word is used twice,
- a `hint` contains its own word,
- a vhs/cartridge/cd entry has no `source`.

---

## PowerPlays

Add an entry to `POWER_PLAYS_LIST` in `data/powerPlays.ts`:

```ts
{
  id: 'holdOntoYourButts',
  name: 'Hold Onto Your Butts',
  description: `Next word only: ... ${POWER_PLAY_VALUES.rareLetterMultiplier}x.`,   // numbers from config
  flavorText: 'Hold onto your butts.',
  icon: '🦖',
  subtheme: 'score',            // 'score' | 'timer' | 'rack' | 'strike' | 'utility'
  effectType: 'next_word',      // 'immediate' | 'passive' | 'next_word' | 'selection'
  durationTag: 'ONE_TIME',      // 'ONE_TIME' | 'LIMITED' (lasts a few words/rounds)
  activate: arm('holdOntoYourButts'),
  // optional: selectionType, selectionLetters, swapConfig, oncePerRun: true
},
```

Helpers at the top of the file:
- `arm(id, value = true)` sets `activePowerPlays[id]` and shows the buff. This covers most "next
  word" effects.
- `letterBoost` is used by the letter-picking boosts.

Pick the pattern that matches the effect:

| Effect | How | Example to copy (search for it) |
|---|---|---|
| Changes the **next word's score** | `activate: arm(id)`. Add a check in `calculateScore` (`services/gameUtils.ts`) that pushes a `bonuses` line. Add the id to the "consumed after a word" list in `GameScreen.tsx` (search `'cowabunga', 'holdOntoYourButts'`). | `holdOntoYourButts`, `bigHeadMode` |
| Lasts **N words** | `arm(id, { words: N })`, and add the id to `WORD_COUNTDOWN_POWER_PLAYS` in `GameScreen.tsx`. | `konamiCode` |
| Lasts **N rounds** | `{ rounds: N }`, counted down in the `START_NEXT_ROUND` reducer case. | `saveByTheBell`, `gadgetHands` |
| **Fires when picked** from the offer (shields, arm-on-pick) | Add the id to `INSTANT_POWER_PLAY_IDS` in `data/powerPlays.ts`. Picking it still swaps out a held PowerPlay. | `strikeShield`, `deepFreeze` |
| Changes the **hand/bag right away** | `activate: () => ({})`. Add a branch in the `ACTIVATE_POWER_PLAY` reducer case that sets `newHand` / `newBag` / `newBuildRow`, `newModalContent` + `shouldPause` for a pop-up, and appends to `newLog` with `changes = { ...changes, log: newLog }`. | `shakeItLikeAPolaroid`, `nuclearOption` |
| **Pick a letter** | `effectType: 'selection'`, `selectionType: 'letter'` (plus `selectionLetters: 'AEIOU'` to restrict it). The view's `LetterPicker` handles tap-then-confirm. Apply it in `COMPLETE_POWER_PLAY_ACTIVATION` (the generic path calls `activate(gs, { letter })`, or add a branch). | `buyAVowel`, `letterUpgrade` |
| **Pick one tile** | `selectionType: 'custom'`. Add the id to `singleTileSelectionIds` in `GameScreenView.tsx` and handle it in `COMPLETE_POWER_PLAY_ACTIVATION` with `state.tileForSelection`. | `captainPlanet`, `hookshot` |
| **Pick several tiles** | `selectionType: 'tile_swap'` + `swapConfig: { min, max }`. | `swapOut`, `yoshisWildRide` |
| **Needs hooks/async** (dictionary lookups, timers) | Handle it in the component's `handleActivatePowerPlay` (search `powerPlay.id === 'happyPlace'`) and add the id to `COMPONENT_HANDLED` in `services/screens/__tests__/effects.smoke.test.ts`. | `happyPlace`, `gumpLuck` |
| Changes **a tile's points** | Set `tempPoints` **and** `tempPointsSource: powerPlay.name` so the breakdown shows "Name (E) 1 → 20 pts". `tempPoints` clear after the next word. | `captainPlanet`, `oneTileToRuleThemAll` |
| **Adds time** | Use `TIME_BONUS.<name>` and `bonusTime(seconds, bank, level)`, never a raw `+= 30`. | `timeTurner`, `timeBoost` |
| **Run-saver** | `oncePerRun: true`. The offer filter, badge and swap rule follow automatically. | `happyPlace` |

Feedback the player should see:
- an event-log entry (`EventLogEntry`),
- a message via `lastPowerPlayResult: { message, scoreChange }` or a short `info` pop-up with `autoClose`.

Costs (points or a strike) need a guard for when the player can't afford them. Keep the
PowerPlay in the pocket and say why (search `buyAVowelCost`).

---

## Charms

Add an entry to `CHARMS_LIST` in `data/charms.ts`:

```ts
{
  id: 'rubiksCube',
  name: "Rubik's Cube",
  description: `Words of 6+ letters with no repeated letter (PLANET, FROZEN) earn +${CHARM_BONUS.rubiksCube} points.`,
  flavorText: 'Six faces. No repeats. All solved.',
  icon: '🧊',
  subtheme: 'score',
  effectType: 'triggered',      // 'passive' (always applies) | 'triggered' (on a condition)
  durationTag: 'PERSISTENT',
  activate: createPassiveBuff('rubiksCube'),
},
```

| Effect | Where | Example to copy |
|---|---|---|
| **Flat points** when a word meets a condition | `calculateScore` in `services/gameUtils.ts`, next to the other charm checks (search `// Charm: Perfectly Balanced`). Add to `flatBonus` and push a `bonuses` line. `lettersInWord`, `wordUpper` and `VOWELS` are in scope. | `rubiksCube`, `perfectlyBalanced`, `luna` |
| **Per-tile** points | The tile loop in `calculateScore` (search `// Charm: The Valve`). | `theValve`, `oneRing` |
| Compares with the **previous word** | Read the last valid word from `gameState.log` inside `calculateScore`. | `sickCombo` |
| Needs **memory across words** (streaks, chains) | Add an optional field to `GameState` in `types.ts`. Update it in `completeSubmission` after a valid word (search `// Mixtape: remember`). Reset it on a strike in the `ADD_STRIKE` reducer case (search `mixtapeChain: null`). Reset it on equip in `CHOOSE_CHARM` if needed (search `charm.id === 'goldenSnitch'`). | `mixtape`, `goldenSnitch` |
| Shows **progress in the Buffs tray** | `progressFor` in `GameScreenView.tsx` (search `buff.id === 'mixtape'`). | `mixtape`, `goldenSnitch`, `thrillerNight` |
| **Adds time** | Accumulate into `multiverseTimeBonus` so it goes through `bonusTime()` in `START_NEXT_ROUND`, using a `TIME_BONUS` value. | `cleverGirl`, `executeOrder66` |

Players have 5 charm slots, and swapping a charm in or out is handled for every charm.

---

## Cosmetics: badges and titles

Data only: add an entry to `COSMETICS` in `data/cosmetics.ts`. The shop tabs, the player plate,
the leaderboard row and the share card all read from it.

```ts
{ id: 'b_tamagotchi', kind: 'badge', icon: '🥚', name: 'Tamagotchi', cost: 70, flavor: 'Feed it words or it dies.' },
{ id: 't_kingOfKong', kind: 'title', name: 'King of Kong', cost: 120, style: 'shine', flavor: 'Barrel-proof since 1981.' },
```

- **Ids are permanent.** They are saved in players' profiles and in every leaderboard entry. Never
  rename or remove one that has shipped; to retire an item, leave it in place (a `retired` flag
  would need adding to the shop filter).
- **Id format is enforced by Firebase:** badges `b_` (shop) or `s_` (streak), titles `t_` or `s_`,
  then 1–24 letters, no digits or underscores. Anything else gets the flair dropped online.
- **Price** with `cost`, or earn it with `streakDay` (then also list it in `STREAK_MILESTONES`).
  Never both.
- **Style** (`plain` default, `shine`, `gold`, `legend`) picks the frame and glow from the
  `.bling-*` and `.bling-title-*` classes in `index.css`. A new style needs CSS there, including
  the `prefers-reduced-motion` block.
- **Badges** need an `icon` emoji that reads at 28px. Titles show in uppercase, so keep them under
  about 22 characters to fit the player plate on a phone.

## Streak milestones

`STREAK_MILESTONES` in `data/cosmetics.ts`, sorted by `day`:

```ts
{ day: 75, credits: 180, title: 's_diamondHands', badge: 's_diamondJoystick' },
```

`title` and `badge` are cosmetic ids with matching `streakDay`. `themeId` unlocks a pack with
matching `streakDay`. `recordRunFinished` in `services/progression.ts` pays credits, unlocks the
items once, and the Game Over celebration, Streak tab ladder and "N days to …" line pick it up.
Update the ladder assertion in `progression.test.ts`.

## Themes

Add a pack to `PACKS_LIST` in `data/packs.ts` (copy `midnight-arcade`) and its classes to
`index.css` (search `.theme-midnight`, `.frame-midnight`, `.tile-midnight`). A bought theme gets
its price in `THEME_PRICES` (`config/progression.ts`). A streak theme gets `cost: 0`,
`streakDay: N`, and a `themeId` on that milestone. Check the theme at phone size in the shop
preview and in a run (tile contrast, the Golden Round tile still stands out).

## Daily missions

Add a template to `MISSION_TEMPLATES` in `data/missions.ts`:

```ts
{ id: 'w_double', category: 'word', tier: 2, text: 'Play a word with a double letter (BALLOON)', target: 3, scope: 'day',
  progress: e => (isWord(e) && /(.)\1/i.test(e.word) ? 1 : 0) },
```

- `category`: `word`, `powerplay`, `charm` or `secret`. Each day picks 3 of the 4 categories,
  one easy, one medium, one hard, and avoids yesterday's missions. When a slot has nothing fresh
  at its tier, the picker takes the nearest tier instead, so thin spots (the helper prints counts
  per tier) are the best place to add.
- `scope: 'run'` resets progress each run ("…in one run"); `'day'` adds up across runs.
- `mode: 'max'` keeps the highest single value (e.g. charms equipped at once) instead of adding.
- `progress(e)` reads a `MissionEvent`. Events the game already sends (search `trackMission(` in
  `GameScreen.tsx`):

| Event | Fields | Sent when |
|---|---|---|
| `word` | `word`, `score`, `comboFilled?`, `goldenStarted?` | Every valid word, including Golden Round words |
| `powerplay` | `id`, `subtheme` | A PowerPlay is used (or an instant one is picked) |
| `powerplaySwap` | — | A held PowerPlay is swapped for a new one |
| `charm` | `equippedCount`, `swapped` | A charm is equipped |
| `secret` | `id`, `firstFind`, `media`, `isScore` | A secret bonus is found |

  A mission that needs something new (e.g. strikes, shuffles) needs a new member of the
  `MissionEvent` union and a `trackMission({...})` call at that spot in `GameScreen.tsx`.
- Write `text` as a short imperative with real numbers ("Play four 5+ letter words in one run").
  The card adds the category, difficulty and progress bar.
- Ids are permanent once shipped (they key saved progress); prefix by category (`w_`, `p_`, `c_`,
  `s_`).

---

## Config constants

All in `config/gameplay.ts`. Descriptions import these, so the text always matches the rules.

| Constant | For |
|---|---|
| `CHARM_BONUS` | Charm payouts (e.g. `rubiksCube: 100`) |
| `POWER_PLAY_VALUES` | PowerPlay costs and multipliers (e.g. `buyAVowelCost: 100`) |
| `TIME_BONUS` | Seconds from any time-giving item, used through `bonusTime()` |
| `GAMEPLAY` | Core rules: time bank, levels, Snitch targets. Not content-specific. |

The between-runs economy lives in `config/progression.ts`:

| Constant | For |
|---|---|
| `THEME_PRICES` | Theme prices by pack id |
| `MISSION_REWARD`, `MISSION_SWEEP_BONUS` | Credits per mission tier, and for finishing all three |
| `POINTS_PER_CREDIT` | Credits earned from score during a run |
| `STREAK_FREEZE`, `POWER_WORD_BONUS`, `DAILY_RESET_HOUR` | Streak freezes, streak-scaled Power Word, 8 AM reset |

`data/powerPlays.ts` imports `TIME_BONUS` and `POWER_PLAY_VALUES`. `data/charms.ts` imports
`CHARM_BONUS`, `GAMEPLAY`, `POWER_GLOVE_BANK_MAX` and `TIME_BONUS`. Add to those imports if you use
something new.
