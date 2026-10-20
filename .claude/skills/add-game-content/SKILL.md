---
name: add-game-content
description: Add new secret bonus words, PowerPlays, charms, cosmetics (badges, titles, themes, streak rewards) or daily missions to the Word Nerd game (this repo), from idea to live site. Use this whenever the user wants new or replacement game content, such as "add 3 bonus words", "make a charm about Back to the Future", "I need a new PowerPlay", "add 5 new titles to the shop", "a badge for a 200-day streak", "more mission ideas", "add the word TEX as an easter egg", or asks for pop-culture words, power-ups, buffs, bling, shop items or easter eggs, even if they don't say "skill". Covers checking for duplicates and dictionary problems, proposing names, effects, prices, flavor text and themes for review, wiring the mechanics, tests, and shipping.
---

# Add game content: bonus words, PowerPlays, charms, cosmetics, missions

Word Nerd is a retro arcade/VHS word game: 90s/2000s pop culture, neon, punny. New content
should feel like it was always there. This skill is the path from "add some X" to live on
https://wordnerd-game.netlify.app.

## 1. Look before you propose

Run the helper from the repo root. It lists every current bonus word, PowerPlay, charm, cosmetic
(with prices) and mission template, checks candidate bonus words against the dictionary, the block
list and existing bonuses, and flags cosmetic ids the live leaderboard rules would reject:

```bash
node .claude/skills/add-game-content/scripts/content-check.mjs            # list everything
node .claude/skills/add-game-content/scripts/content-check.mjs TEX SLIME  # check candidates
```

Pick ideas that aren't already taken (same word, same reference or same mechanic). Read the
lists, because duplicate *ideas* matter as much as duplicate ids. For example, Rewind already
exists as a PowerPlay, so a new "rewind" idea needs a different angle.

## 2. Propose, unless the user already decided

- **The user left details open** ("add 3 charms", "come up with two more words"): propose first
  and wait for approval. The user reviews names, effects, flavor text and numbers, and often tweaks
  one (e.g. "make Buy a Vowel cost 100").
- **The user specified everything** ("add TEX worth +300 with this clue"): build it directly.
- **Mixed** (one word given, others open): propose the open ones and include the given one in the
  table so they can see it all together.

Use one table per type. Include what a reviewer needs to judge it:

| Type | Columns |
|---|---|
| Bonus words | Word · Name (with emoji) · Theme / reveal art (vhs, cartridge, cd, arcade) · Clue · Reward |
| PowerPlays | Name (with emoji) · What it does · Flavor text · Theme |
| Charms | Name (with emoji) · What it does · Flavor text · Theme |
| Badges / titles | Name (+ emoji for badges) · Price or streak day · Style (plain, shine, gold, legend) · Flavor text · Reference |
| Themes | Name · Price or streak day · Look (tiles, background, frame) · Description |
| Missions | Text · Category · Tier (easy/medium/hard → reward) · Target · One run or all day · Which game event counts |

End the proposal with short notes on balance (see section 4) and an invitation to keep, swap or
reword anything.

## 3. House style

- **Pop culture from roughly the 80s to the 2010s**: movies, TV, games, music, toys. Name the
  source in the proposal. The fun is recognizing the reference.
- **Names** start with an emoji. Bonus names use the format `🧇 “Treat Yo' Waffle” 🧇`.
- **Flavor text** is a short quote or quip from the reference ("Hold onto your butts."). Don't
  wrap it in quote marks: the card adds them.
- **Bonus clues (`hint`)** are punny, cryptic, dad-joke riddles that never contain the word itself
  (the build rejects that). The clue appears in the Collection before the bonus is found, *and* on
  the reveal next to "YOU PLAYED B-O-O-K" once it is. Write it so it works both as a riddle and as
  the "aha" afterward. `message` is only a fallback, but it's required, so give it a one-liner too.
- **Descriptions** say exactly what happens with real numbers. They're player-facing, so read
  numbers from config in template strings rather than hard-coding them (see section 5).

## 4. Balance guardrails

These come from playtesting. Ignoring them broke the game before.

- **Time is the main tension.** Don't add time in new content unless the user asks for it. If an
  item must add time, put the seconds in `TIME_BONUS` (config/gameplay.ts) and apply them through
  `bonusTime()` in services/rules.ts. That rule shrinks bonus time by level and halves it above 60s.
  Always-on charms that add time on common words (the old Clever Girl, +5s on most words) made the
  clock meaningless.
- **Run-savers** (clear strikes, refill or rescue the clock, undo a turn) get `oncePerRun: true`.
- **Charm payouts** sit around +40 to +120 flat, or x2 to x4 for rare conditions. The rarer the
  trigger, the bigger the payout. A charm that fires on most words should pay small.
- **PowerPlays** are one-time or last a few words. Anything that costs points or a strike should
  say so up front in the description.
- **Credits are scarce on purpose.** Players earn about 20–30 a day (missions 🪙4/6/10 by tier,
  +6 for all three, plus 1 per 5,000 points). Price bling against that budget: a common badge or
  title is about a day (15–50), mid-tier a few days (60–100), top shop items a week or more
  (150–200, use `style: 'shine'`). Themes are 60–120. `gold` and `legend` styles are reserved for
  streak rewards, so bought bling never outshines earned bling.
- **Streak rewards are never sold.** A cosmetic has either `cost` or `streakDay`, never both (a
  test enforces this). New milestones should sit past the current ladder (3, 7, 14, 21, 30, 50, 60,
  100) or fill a real gap, with credits rising with the day.
- **Missions must be doable in a normal day.** Easy: one ordinary run. Medium: a focused run.
  Hard: a good run or two. No mission should depend on luck alone (a specific secret word, a
  specific charm being offered). Mission rewards come from `MISSION_REWARD` by tier; don't add
  per-mission payouts.
- **Avoid dead mechanics**: hands are 8 tiles, so "use all your tiles" almost never happens (that's
  why Infinity Gauntlet was replaced).

## 5. Where things go

Read references/wiring.md before building. It covers each content type: the data file and
fields, the helpers, where scoring and effects run, which lists a PowerPlay must join (instant,
next-word consumption, countdown), how pickers work, and where charm state and tray progress live.
The short version:

| Content | Data | Mechanics | Values |
|---|---|---|---|
| Bonus word | `data/secretBonuses.ts` | None, it's data only | Points in the entry |
| PowerPlay | `data/powerPlays.ts` | Scoring: `services/gameUtils.ts` `calculateScore`. Effects: `GameScreen.tsx` reducer | `POWER_PLAY_VALUES` / `TIME_BONUS` |
| Charm | `data/charms.ts` | Scoring: `calculateScore`. State: `types.ts` + `completeSubmission` | `CHARM_BONUS` |
| Badge / title | `data/cosmetics.ts` `COSMETICS` | None, it's data only (shop, leaderboard, share card are automatic) | `cost` in the entry |
| Streak reward | `data/cosmetics.ts` (`streakDay`) + `STREAK_MILESTONES` | Automatic: paid and unlocked in `recordRunFinished` | Credits in the milestone |
| Theme | `data/packs.ts` + CSS in `index.css` | None | `THEME_PRICES` in `config/progression.ts` |
| Mission | `data/missions.ts` `MISSION_TEMPLATES` | Uses existing game events; a new kind of event needs a `trackMission(...)` call in `GameScreen.tsx` | `MISSION_REWARD` by tier |

If a bonus word isn't in the dictionary, add it to `words/custom.txt` and run `npm run words`.
Check it with the helper again.

## 6. Test

Add focused tests to `services/screens/__tests__/powerUpRules.test.ts`, following the patterns
already there:
- PowerPlays and charms that change scoring: call `calculateScore` and check the bonus line.
- Ones that change state: run `gameReducer` with the action.
- Include a case where it should *not* fire.

Cosmetics, streak rewards and missions are tested in `services/__tests__/progression.test.ts`. It
already checks every cosmetic id against the live leaderboard rules, price vs. streak exclusivity,
that the milestone ladder lists the expected days, and that missions never repeat the day before.
Update the ladder test when you add a milestone. For a new mission, add a case that feeds
`recordMissionEvent` the event that should complete it and one that shouldn't.

Some suites cover every item automatically. `swapAll.test.ts` tests keep-or-swap and charm-slot
swaps. `effects.smoke.test.ts` checks that every PowerPlay does something visible. Bonus data is
checked by `npm run check:bonuses`.

```bash
npx tsc --noEmit -p . && npx vitest run && npm run build
```

Fix anything red before shipping. Double-check your own example words in descriptions and tests.
IDEA isn't "perfectly balanced" (3 vowels, 1 consonant); getting that kind of detail wrong has
happened before. For anything with UI (a picker, a reveal), check it at phone size with the
Playwright setup the repo uses (`/opt/pw-browsers`, `npx vite preview --port 4173`).

## 7. Ship

The user wants content live right away:
1. Bump the minor version (`npm version <x.y+1.0> --no-git-tag-version`) for a content drop.
   Adding or removing mission templates reshuffles every day's picks, today's included, so
   players' mission progress for today resets. Tell the user, and suggest shipping right after the
   8 AM reset if they care.
2. Commit with a message listing every item, then push to the working branch.
3. Open a PR and merge it. Netlify deploys `main` automatically.
4. Fast-forward the working branch to `origin/main` and push.

## 8. Report back

Keep it skimmable:
- What was added, grouped by type, with each item's numbers.
- How it was checked (tests, phone-size browser).
- Where to tweak numbers later (the config constant or data file).
- Any balance concern worth watching.
- For cosmetics: whether the Firebase leaderboard rules still accept the ids (they do if the id is
  `b_`/`t_`/`s_` + letters). If the rules ever need changing, give the user the exact text and
  update `docs/LEADERBOARD.md` to match.
