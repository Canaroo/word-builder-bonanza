# Bonuses: see, check, add and change them

## See them all

Open the **Bonus Vault**: https://wordnerd-game.netlify.app/?bonuses

It isn't linked from the game's menus, so players won't find it unless they have the link.

| Tab | What it shows |
| --- | --- |
| Words | Secret word bonuses (LINK, AIR, DONUT...) |
| Scores | Score-number bonuses (contains 42, ends in 69...) |
| Word count | Milestones for 50, 100 and 123 words |
| Charms | What each charm does (read-only) |
| PowerPlays | What each PowerPlay does (read-only) |

- **✅ OK** means the bonus can fire. **⚠️ FIX** says what's wrong, such as a blocked word, a word
  that isn't in the dictionary, a word used twice, or a missing reward.
- Tap a secret bonus to watch its reveal exactly as players see it. Score bonuses use a sample score.
- The search box filters by word, name, message or source.
- Pull request previews have a vault too: add `?bonuses` to the preview link.

## Change or add a secret bonus

Every secret bonus is one entry in
[`data/secretBonuses.ts`](https://github.com/Canaroo/word-builder-bonanza/blob/main/data/secretBonuses.ts).

1. Open the file on GitHub and click the ✏️ pencil icon.
2. Edit an entry, or copy one and change it. Keep the `{ }`, the quotes and the comma after each line.
3. Click **Commit changes…**. Then:
   - **Commit directly to `main`** to publish in about 2–3 minutes, or
   - **Create a new branch** and open a pull request to get a preview link first.

### A word bonus

```ts
  {
    id: "heroOfHyrule",
    word: "LINK",
    name: "🗡️ “Hero of Hyrule” 🛡️",
    description: "When you submit the word LINK",
    points: 189,
    message: "It’s dangerous to go alone—so take these bonus points!",
    media: "cartridge",
    source: "The Legend of Zelda",
  },
```

### A score-number bonus

```ts
  {
    id: "theAnswer",
    score: { kind: "contains", digits: "42" },
    name: "🧠 The Answer",
    description: "Score includes 42 → +300 bonus.",
    points: 300,
    message: "Your total score contains 42! All meaning, no towel required.",
  },
```

`kind` is `"contains"`, `"endsWith"` or `"equals"`. The game explains the bonus to the player
("Your score hit 742, which contains 42").

### The fields

| Field | Required | Notes |
| --- | --- | --- |
| `id` | yes | Unique, letters and digits, e.g. `heroOfHyrule`. Players never see it. |
| `word` or `score` | one of them | What triggers the bonus. Words can be any case. |
| `name` | yes | Title on the reveal. Start it with an emoji. |
| `description` | yes | A short summary of the bonus. |
| `points` / `shuffle` | at least one | Bonus points (added on top of the word's normal score), free shuffles, or both. |
| `message` | yes | What the player reads when it fires. |
| `media` | no | Reveal art: `"vhs"` (movies, TV), `"cartridge"` (games), `"cd"` (music), `"arcade"` (anything else; the default). |
| `source` | with vhs / cartridge / cd | Printed on the label, e.g. `"Back to the Future"`. |

Each bonus pays out once per run.

## Word-count milestones

These are in
[`data/wordBonuses.ts`](https://github.com/Canaroo/word-builder-bonanza/blob/main/data/wordBonuses.ts).
Each needs a unique `id`, a `wordCount`, and `reward: { points: N }`. A `\n` in the description starts
a new line.

## The safety check

Every build checks both files before publishing. If something's wrong, Netlify stops the deploy and
the live game stays on the last good version. The check rejects:

- a bonus word that's in `words/blocked.txt`;
- a word that isn't in the dictionary (add it to `words/custom.txt` if it should count);
- a word, score trigger, word count or id used twice;
- a missing name, message or reward, or a `vhs`/`cartridge`/`cd` without a `source`.

**If a deploy fails:** open app.netlify.com → **wordnerd-game** → **Deploys** → the failed deploy.
The log lists each problem, for example:

```
Fix these bonus entries before publishing:
  - kermitWisdom: word "DAGO" is in words/blocked.txt, so it can never be played
```

Fix it on GitHub the same way, and the next commit deploys normally.

**On a computer:** `npm run check:bonuses` runs the same check, and `npm run dev` then
`http://localhost:3000/?bonuses` opens the vault.
