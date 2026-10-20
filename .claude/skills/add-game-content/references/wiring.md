# Wiring new content

Line numbers drift, so this file points at **searchable strings**. Grep for them to find the
spot, and copy the closest existing example.

## Contents
- [Secret bonus words](#secret-bonus-words)
- [PowerPlays](#powerplays)
- [Charms](#charms)
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

## Config constants

All in `config/gameplay.ts`. Descriptions import these, so the text always matches the rules.

| Constant | For |
|---|---|
| `CHARM_BONUS` | Charm payouts (e.g. `rubiksCube: 100`) |
| `POWER_PLAY_VALUES` | PowerPlay costs and multipliers (e.g. `buyAVowelCost: 100`) |
| `TIME_BONUS` | Seconds from any time-giving item, used through `bonusTime()` |
| `GAMEPLAY` | Core rules: time bank, levels, Snitch targets. Not content-specific. |

`data/powerPlays.ts` imports `TIME_BONUS` and `POWER_PLAY_VALUES`. `data/charms.ts` imports
`CHARM_BONUS`, `GAMEPLAY`, `POWER_GLOVE_BANK_MAX` and `TIME_BONUS`. Add to those imports if you use
something new.
