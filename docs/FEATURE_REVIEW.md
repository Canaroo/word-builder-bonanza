# Feature Review: Golden Rounds, Gates, the Fork and friends (Nov 2026)

What the data and the code say about the mid-run features, where they leak, and what to change.
Nothing here is built yet: pick from the **Proposals** table at the end.

**Data used.** Firebase `/stats` pulled Nov 20, 2026: 7,390 events, 202 runs (Oct 30 – Nov 19),
56 of them after charm sets and the Fork shipped (v7.41/v7.43). Plus code reading and three quick
simulations (scripts described at the bottom). Median run: 8,245 points, 80 words. 57% of runs
reach level 4, 41% level 7, 31% level 11. Runs from level 7 on: 2.2 real seconds a word, about 208
points a word, 22% of their clock from charms and PowerPlays.

**Biggest blind spot:** the stats record *none* of the Golden Round, Fork, Gates, Skill Shot, Gem
Tiles, Last Words, Head Start or Grudge Match. Every verdict on those below comes from code and
simulation, not from what players did. Proposed events are in the last section.

---

## 1. Fork in the Road (Easy Street / Danger Zone)

**How it works.** At levels 4, 7 and 11 a card makes the player pick: Easy Street (clock 10% slower)
or the Danger Zone (clock 15% faster, every word x1.5). The pick is locked until the next fork; the
level-11 pick lasts the rest of the run.

**Your hunch is right, and it's rational.** Late runs are clock-limited on purpose (Overtime), so
dying early costs *every* point you'd have scored after. Simulated levels 7-10 (72 words), with the
value of surviving to level 11 counted as about 20,000 more points:

| Player pace (real s/word) | Easy: survive / run value | Danger (locked): survive / run value |
|---|---|---|
| 1.8 (fast) | 100% / 35,500 | 98% / 42,700 (**+20%**) |
| 2.0 | 100% / 35,500 | 76% / 37,600 (+6%) |
| **2.2 (the stats median)** | **99% / 35,300** | **32% / 25,900 (−27%)** |
| 2.4 | 93% / 34,000 | 6% / 17,200 (−50%) |

At the median late-game pace, Danger is a trap. Only players clearly ahead of the clock gain, and
they can't tell which side they're on from the card.

**Gaps**
- **All-or-nothing commitment.** One bad stretch in a 72-word tier ends the run, with no way out.
- **The card gives no information** about the player's own clock. It shows the same two boxes to a
  player gaining 20 seconds a level and one losing 20.
- **Level 11's pick lasts forever**, into Overtime (clock up to x2.4). Danger there is close to
  suicide for anyone who isn't top of the board.
- Danger's x1.5 is applied at the end, so it's a bigger deal than it reads, but the card can't say
  "about +100 a word for you".

**Proposals**
- **F1 · Bail out (recommended).** A 🔥 chip while in the Danger Zone; hold it to cool down to Easy
  Street for the rest of the stretch (no way back in). Simulated with a player who bails at 25 s on
  the clock:

  | Pace | Easy | Danger + bail |
  |---|---|---|
  | 1.8 | 35,500 | 42,800 (+20%), survive 100% |
  | 2.0 | 35,500 | 41,100 (+16%), 97% |
  | 2.2 | 35,300 | 36,300 (+3%), 82% |
  | 2.4 | 34,000 | 27,600 (−19%), 51% |

  Danger becomes worth trying for most players, and it stays a real call: slow players should still
  pick Easy. It also turns one decision a tier into push-your-luck all the way through, which fits
  the gamble cards.
- **F2 · Show the stakes.** Put the player's last level on the card: "Last level your clock went
  +14 sec → Danger looks good" / "−9 sec → Easy Street recommended". It's computed from the time
  ledger the game already keeps.
- **F3 · A fourth fork at 15** (or let the bail-out cover it). Without one, the level-11 pick is a
  run-long sentence.
- Optional: raise Danger to x1.75 only if the bail-out still doesn't get picked.

---

## 2. Golden Round

**How it works.** 11 valid words in a row (any strike or invalid word resets the count) opens a
Golden Round: a 30-second clock of its own (the bank waits), a fresh hand with tiles worth 2x, and a
Golden Tile that makes the word x6. One word, then back to normal. Each round raises the next
target by 5 (11, 16, 21, 26...).

**The payout doesn't scale.** `calculateScore` has a separate Golden branch: raw tile points x2,
x6 with the Golden Tile. It skips the length multiplier, charms, charm upgrades, the long-word boost
and level growth. Simulated over 1,500 random 8-tile hands with the common-word list:

| | Points |
|---|---|
| Best Golden word (Golden Tile usable in 97% of hands) | median **108**, 10th–90th percentile 72–156 |
| Average word, all runs | about 104 |
| Average word, runs from level 7 on | about **208** (higher still past level 11) |

So a Golden Round is worth about one normal word early on and **less than a normal word late**: the
streak's reward costs a late player their charm points on that word. With the target growing by 5,
a 300-word run sees about 8 of them, roughly 900 points out of 90,000 (1%). The real perk is a few
seconds of bank that don't drain while it's open.

**Gaps**
- Flat payout (above). The card promises "6x WORD SCORE", which late players will feel is a lie.
- The Golden Tile is picked with `Math.random()`, not the seeded tile stream, so on the Daily
  Challenge players get different Golden Tiles (CLAUDE.md: tile randomness must use `tileRandom()`).
- A Golden word skips the Score Gate check (it returns early in `completeSubmission`), so a gate
  crossed by a Golden word opens one word late.
- A failed Golden Round (clock out or invalid word) still raises the next target by 5.

**Proposals**
- **G1 · Score the Golden word like a normal word, then multiply (recommended).** Run it through the
  normal pipeline (length, charms, upgrades, Danger), then x2, or x4 with the Golden Tile.
  Estimated: early word about 50 → 100 / 200; level-7+ word about 208 → 416 / 830. About 8 late
  rounds then pay about 5-6k in a 90k run (6%) instead of 900: a streak worth chasing, and still
  below what PowerPlays pay. x6 with the tile (≈1,250 late) is the bolder option.
- **G2 · Small fixes:** Golden Tile from `tileRandom()`; run the gate check on Golden words; don't
  raise the target after a failed round (or cap it at 21).
- **G3 · Show the prize on the streak chip** once the streak is 8+: "🌟 3 MORE → GOLDEN ROUND".

---

## 3. Score Gates (10k / 30k / 50k / 70k)

**Reach (all 202 runs):** 10,000 in 48%, 30,000 in 21%, 50,000 in 11%, 70,000 in 6%. That's a good
funnel: each gate is rarer than the last, and the events get harder.

**Gaps**
- **Invisible until you hit one.** Nothing in the run says a gate is coming: they're only in How to
  Play. A target you can see is a goal; one you can't is a surprise.
- **No outcome data**: we don't know solve rates for the password, how far players climb the
  Ladder, or whether they bank or bust.
- Gates skip Golden words (see G2).
- 52% of runs never see a gate (the median run ends at 8,245).

**Proposals**
- **S1 · Next-gate marker (recommended).** A small "🚪 30,000" tick under the score, or a thin
  progress bar to the next gate, lit for the last 2,000 points.
- **S2 · Track outcomes** (`gate` event, below), then tune the prizes from the data.
- Optional: a 5,000 "warm-up" gate for the half of runs that never reach 10k. Hold this until
  S1 and S2 show whether the existing gates are fun.

---

## 4. Charm sets

**Data (since v7.41):** a whole set was held in **2 of 56 runs** (and in 2 of 198 runs overall).
Holding 2 of a 3-charm set happened in 2 runs. Partial sets are common (Game Show Network was half
built in 25 runs), but set members are picked **13%** of the time they're offered, against 26% for
an average charm. The 50% "missing piece" pull isn't enough to overcome that.

**Why:** +50 (pair) or +100 (trio) a word needs 2-3 slots of charms players already rate as weak.
A single good charm pays about +60 a word for one slot.

**Proposals**
- **C1 · Pay as you build (recommended).** 2 of a trio pays the pair rate (+50); the full trio pays
  +150. Players see a payoff after the second piece, not only the third.
- **C2 · Bigger, visible bonus:** pair +100, trio +200, and a set tracker on the charm bar ("☕ 1/2").
- **C3 · Let upgrades and the long-word boost cover set lines**, so sets keep pace late.

---

## 5. Mystery Tape

**Data:** shown on 24% of PowerPlay offers (target 25%). The tape was taken in **119 of 192** offers
(62%), more than any normal card. But **31% of the PowerPlays it hands out are never used**, against
4% of PowerPlays picked face up. Players take it for the +150 and sit on what's inside.

**Proposals**
- **M1 · Pay half on take, half on use** (+75 / +75), or keep +150 and add "use it within 10 words
  for +100". Either makes the hidden item matter.
- **M2 · Trim the pool** of items that sit unused after a tape (needs a `tape` flag on `pp_use`).

---

## 6. Power words and the hint

**Data:** 25 power words fired in 202 runs. HEAL (8) and CAKE (7) do most of the work; REWIND has
never fired. The hint showed 176 times. Before v7.54.2 it led to 3 plays in 88; with the first
letter, 6 in 88 (7%). Since v7.54.2 **every** power word played came from a hint, so the hint is now
the feature's front door, and it still converts poorly.

**Gaps.** The chip says "POWER WORD IN THIS HAND" but not what it would *do*, so there's no reason
to stop and hunt. Players under the clock don't tap it.

**Proposals**
- **P1 · Say the prize on the chip** ("⚡ POWER WORD: ❤️ REMOVE A STRIKE"), and on tap light the
  word's tiles (no order) instead of giving the first letter. These are 4-6 letter words, so lit tiles
  make it a 2-second play; power words are once a level anyway.
- **P2 · REWIND has never fired:** check that its hint can show (it appeared once), or swap the word.

---

## 7. Borrowed mechanics (quick read)

| Mechanic | Read | Suggestion |
|---|---|---|
| **Skill Shot** | Visible since v7.44.5; no data | Track hit or miss on each level's first word |
| **Gem Tiles** | Sound; the intro card fixed the confusion | Track gems earned and used |
| **Last Words** | Every run ends with it; no data on what it pays | Track points; if it's tiny, show "x3" bigger |
| **Head Start** | Helps the 47% of runs that end by level 3 | Fine. Show "+N sec from Head Start" on the first clock |
| **Hold That Thought** | Picked 4 of 10 offers (above average) | Fine |
| **Grudge Match** | No data | Track grudge fights and wins |
| **Bones** | 38 ghosts met, 28 looted (74%) since v7.44 | Working. Could appear more often (now 1 a run, only at level-ups) |
| **Phoenix Down** | Offered 7 times, picked 2; 3 continue offers, none taken | Price (150 Credits) may be too high for the moment, or players don't have it. Track Credits held at the offer |

---

## 8. Tracking to add (anonymous, same rules as today)

Each needs a line in the `/stats` rules in `docs/LEADERBOARD.md` and the Firebase console.

| Event | Fields | Answers |
|---|---|---|
| `fork` | `level`, `choice`, `bailed` (with F1), `diedIn` | Is Danger picked at all, and does it kill runs? |
| `golden` | `level`, `score`, `tile` (used Golden Tile), `ok` | How often rounds happen, what they pay |
| `gate` | `gate`, `result` (solved / hint / miss, rung reached, banked / bust), `points` | Are gates fun and fair? |
| `run_end` extras | `golden` (count), `route`, `skill` (hits), `gems`, `lastWords` points | Per-run totals without new events |
| `pp_use` extra | `tape: true` | Which tape items sit unused |

---

## Proposals, ranked

| # | Change | Why | Size | Version |
|---|---|---|---|---|
| 1 | **F1 + F2** Danger Zone bail-out and the stakes on the card | Turns a skipped choice into a real one: +3 to +20% for most paces | M | minor |
| 2 | **G1 + G3** Golden word scored in full, then x2 / x4 | Streak reward is worth less than a normal word late | S–M | minor |
| 3 | **Tracking** (section 8) | Five features have no data at all | S | patch |
| 4 | **C1** charm sets pay as you build | 2 of 56 runs ever completed one | S | minor |
| 5 | **S1** next-gate marker | Gates are a surprise, not a goal | S | patch |
| 6 | **P1** power word chip says the prize, lights the tiles | 7% of hints lead to a play | S | patch |
| 7 | **M1** Mystery Tape pays half on use | 31% of tape items never used | S | patch |
| 8 | **G2** Golden fixes (daily seed, gate check, failed-round target) | Bugs and fairness | S | patch |
| 9 | **F3** fourth fork at 15 | Only if F1 isn't built | S | patch |

## How this was checked

- Stats: `curl <firebase>/stats.json`, grouped with Python (pick rates, set completion, hint
  conversion before and after v7.54.2, tape items used vs picked).
- Fork: a time-bank simulation with the real `clockSpeedFor` and `wordTimeScaleFor` curves, levels
  7-10, word lengths 3-6 (weighted to 3-4), log-normal thinking time around the pace, 0.45 s of item
  time a word (the 22% the stats show), overflow tax and 90 s cap, 3,000 runs per row.
- Golden Round: 1,500 random 8-tile hands from the real tile bag, best scoring word from
  `public/words/common.txt` under the Golden rules.
- Estimates for proposals (G1's 5-6k a run, C1) are rough; each gets a proper simulation when built.
