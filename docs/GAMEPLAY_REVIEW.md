# Gameplay Loop Review

An evaluation of Word Nerd's core loop (timer, scoring, fairness, retention) against common practice
in the genre, with suggested changes. Runs stay **endless**, as decided; the suggestions are about
making an endless run tense, fair and worth replaying.

## Status

Implemented (tunable in `config/gameplay.ts`, rules in `services/rules.ts`):

| # | Change | Notes |
| --- | --- | --- |
| 1 | Challenge and hints search everyday words only | SCOWL levels 10–35, `public/words/common.txt` |
| 2 | Time bank + 30s Golden Round clock | 60s start, 90s cap, +2s to +10s per word, −5s per invalid word |
| 3 | Word multipliers add together | x2 + x4 = x6; coin-flip gambles still multiply the final score |
| 4 | Length curve + constant 8-tile hand | 4 x1.25 … 8+ x3 |
| 5 | Visible PowerPlay meter | 25 letters fills it; every-35-words fallback kept |
| 6 | ~~Strike recovery~~ | Removed in v6.8.2: strikes only come back via PowerPlays or charms |
| – | Personal best | NEW HIGH SCORE banner on game over |
| – | Bonus Collection + run recap | Found secrets saved per device; share card on game over |
| – | Charms vs PowerPlays cleanup | Charms always on (5 slots, swap when full); PowerPlays pressed, hold one with keep-or-swap; weak charm bonuses raised (`CHARM_BONUS`) |

Not yet: Daily Run, first-run tutorial. These numbers are first
guesses; playtest and adjust them in the config file.

The sections below are the original review, kept for the reasoning.

## How the loop works today

| Element | Current behaviour |
| --- | --- |
| Timer | 60 s **per word**. The clock resets after every submission. A run ends when the clock hits 0 or on 3 strikes. |
| Rack | Starts at 10 tiles. After a word you draw `max(ceil(used / 2), 5 − remaining)`, so the rack drifts down to about 5–7 tiles. The bag refills forever. |
| Base score | Scrabble tile values, summed. |
| Length | Flat ×2 for 5+ letters. Nothing extra for 6, 7 or 8. |
| Streaks | Word Combo: 5 valid words in a row → ×2. Perfect 4-Chain: +20/+40/+60, then +444. |
| Golden Round | After 11 consecutive valid words (+5 each time): **untimed**, tiles ×2, Golden Tile ×6. |
| Charms / PowerPlays | About 60 effects, many of them ×2 to ×6 word multipliers, all **multiplied together**. PowerPlay offers fire when 3 words in a row share the same tens digit of their score, or every 35 words. |
| Easter eggs | Word triggers (LINK, AIR, ...) plus score-digit triggers (score contains 21, 23 or 42, ends in 69, ...). |
| Challenge | If any playable word exists, you must play it for 0 points and lose a charge. |
| Meta | 1 LEX coin per 5,000 points, spent on cosmetic packs. Daily Power Word worth +500. |

## What's working

- **The pop-culture bonus layer is the hook.** Discovering that LINK or AIR does something is
  delightful and unique in the genre. Everything below tries to give it more room.
- Charms and PowerPlays give runs variety (a light roguelite feel, like *Balatro* for words).
- Golden Rounds and combo meters give clear short-term goals.

## Problems and recommendations

Ordered by impact. Effort: S = hours, M = a day or two, L = several days.

### 1. Challenge is almost unwinnable with the full word list (fairness, S–M)

With ~270k words, nearly every rack contains *some* obscure word (in testing it found AAS), so
Challenge almost always "loses" and forces a 0-point play.
**Change:** only count words from a common-words subset for Challenge and the Carmen Sandiego hint,
for example the 30–50k most frequent English words, built at the same time as the word list. Any
valid word still scores when the player finds it.

### 2. The per-word timer creates no pressure (timer, M)

60 s for each word is very generous, so normal play has no tension. Runs end only from strikes or
walking away, which makes long runs a test of patience more than skill, and the leaderboard
rewards grinding.
**Change: a time bank** (the standard for endless word games). Start with 60 s and stop resetting
the clock. Each valid word **adds** time and an invalid word costs time:

| Word length | Time added |
| --- | --- |
| 3 | +2 s |
| 4 | +3 s |
| 5 | +5 s |
| 6 | +7 s |
| 7+ | +10 s |

Invalid word: −5 s plus a strike. Optionally, the bank drains slightly faster every 25 words.
Runs stay endless, but good players naturally last longer, and quick, long words become the
winning strategy. Time-adding charms (+5 s, +30 s) carry over as they are.

Also give the **Golden Round a generous fixed clock** (for example 30 s) instead of none. Untimed
rounds with a ×6 tile can be stalled indefinitely, which is unfair on a leaderboard.

### 3. Multiplicative stacking makes scores explode (scoring, M)

Multipliers multiply each other: ×2 (5+) × ×2 (combo) × ×4 (charm) × ×5 (Red Wedding) × ×6
(Golden Tile) is ×480. Score variance then comes mostly from lucky stacks, the numbers stop
meaning anything, and LEX coins inflate.
**Change (pick one):**
- **Add multipliers within a word, then apply once:** ×2 and ×4 become ×6, not ×8. Big turns
  still feel big without going exponential.
- Or **cap the total multiplier per word** (for example ×20) and show it on screen ("×20 MAX!").

Easter eggs already fire once per run. Score-digit eggs (contains 21, 23, 42) remain pure luck,
which is fine for fun, but keep their point rewards small next to word-based eggs.

### 4. Length isn't rewarded smoothly, and the shrinking rack blocks long words (scoring/fairness, S)

A flat ×2 at 5 letters is a cliff: a 9-letter word scores like a 5-letter one. Meanwhile the rack
drifts down to about 5–7 tiles, so long words become impossible as a run goes on.
**Change:**
- A length curve, as Boggle and Wordscapes use: 3 ×1, 4 ×1.25, 5 ×1.5, 6 ×2, 7 ×2.5, 8+ ×3.
- Refill the rack to a **constant 8 tiles** after every word, the genre norm (7 to 8). Strategy
  then comes from which tiles to spend, not from a rack shrinking out from under you.

### 5. PowerPlay offers are invisible luck (fairness/clarity, S)

"3 words in a row with the same tens digit of score" is effectively random and nobody can see it
coming. The meter on screen shows dots, not why they fill.
**Change:** fill the PowerPlay meter from something the player controls, such as letters played
(e.g. 25 letters fills it) or long words (+1 per 6+ letter word). Keep the every-35-words fallback.

### 6. Strikes only ever go up (retention, S)

In an endless run, a strike never comes back, so every run's ending is foreshadowed early.
**Change:** win back a strike every 15 valid words in a row, or award one as a Milestone reward.
Comebacks are what make endless runs memorable.

## Retention features (beyond the core loop)

| Feature | Why it matters | Effort |
| --- | --- | --- |
| **Bonus Collection album** | A sticker-book screen of every pop-culture word bonus: found ones show their VHS/cartridge art, unfound ones show a silhouette and a hint ("A Hylian hero..."). This turns the game's unique hook into a long-term goal and pairs naturally with the visual refresh. | M |
| **Daily Run** | Same seeded racks for everyone, one attempt per day, its own online leaderboard. The genre's strongest daily habit loop (Wordle, Balatro daily). It's also fairer to compare, since everyone gets the same tiles. Endless mode stays as the main mode. | M |
| **Run summary and share card** | End screen with best word, new personal best and bonuses found, plus a copyable emoji summary for social sharing. | S |
| **Personal bests** | "New best!" moments for score, longest word and longest streak, stored on the device. | S |
| **First-run tutorial** | Replace the text wall in How to Play with a guided first round (tap tiles → submit → see a bonus fire). | M |

## Suggested order

1. **Groundwork:** move the scoring and timer rules out of `GameScreen.tsx` into small, pure,
   tested functions. That makes every change below safe to try and easy to tune.
2. Fix Challenge (1), add the length curve and constant rack (4), and make the PowerPlay meter
   visible (5): small and clearly fairer.
3. Time bank and Golden Round clock (2), then additive multipliers (3). Playtest these together,
   since they change scoring balance the most.
4. Strike recovery (6), personal bests and the share card.
5. Bonus Collection (with the visual refresh), then Daily Run with its own online board.

Put the tunable numbers (time per length, multiplier cap, rack size, strike recovery) in one config
file so they can be adjusted after playtesting without code changes.
