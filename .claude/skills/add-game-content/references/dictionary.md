# Dictionary words

How Word Nerd decides a word is valid, where definitions come from, and what each file does.

## Files

| File | What it does |
|---|---|
| `data/internalWords.ts` | Words with built-in definitions. Every word here is valid (unless blocked) and part of the curated pool. |
| `words/custom.txt` | Extra valid words that don't need a custom definition. Prefer `internalWords.ts` so there's always a definition. |
| `words/blocked.txt` | Always rejected, even if a source list has them. Mostly slurs. |
| `words/no-suggest.txt` | Valid when a player types them, but the game never offers them: not as the daily Power Word, a hint (Carmen Sandiego, Phone-a-Friend), a Challenge answer, or a balancing word. |
| `scripts/build-wordlist.mjs` | `npm run words` (also runs in `prebuild`). Builds `public/words/wordlist.txt` (every valid word) and `common.txt` (everyday words that hints and Challenge search). |
| `services/curatedWords.ts` | `curatedWords` (internal minus blocked, used for validity and definitions) and `suggestableWords` (minus no-suggest, used for Power Words and hint fallbacks). |
| `services/dictionaryService.ts` | Validity from the word list; definitions from `internalWords.ts`, then a device cache, then dictionaryapi.dev. |

`public/words/` is generated and git-ignored: never edit it by hand.

## Where the word list comes from

The base list (`word-list` package) strips anything that might offend, which also drops real
Scrabble words; SCOWL levels 10-50 add many back. Neither has the newest NWL additions (BAE,
YEET, VAX), which is why they get added to `internalWords.ts` with definitions.

## Rules of thumb

- **Definitions:** short and plain, matching the part of speech ("To throw with great force." /
  "Threw with great force."). One per form. No single quotes (the file uses '...' strings).
- **Forms:** add the plural or verb forms players will try (-S, -ED, -ING, -ER/-EST). Check each
  with `word-check.mjs`: some are already valid and only need a definition.
- **Slurs:** unblock only on explicit confirmation, only the forms asked for, and always add them
  to `no-suggest.txt`. Keep different words blocked even if they look related (FAGGOT stays
  blocked when FAG is allowed).
- **Common vs. obscure:** "would a casual player try this?" Slang, food, tech and pop culture:
  yes. Taxonomy, anatomy, chemistry, archaic or minor-currency words: no, unless asked.
- **Bonus words:** if a new word is also a secret bonus word, nothing changes; `check:bonuses`
  in the build still validates bonus entries against the rebuilt list.

## Tests

`services/__tests__/noSuggest.test.ts` holds the dictionary checks: each batch of added words is
valid, unblocked and defined; no-suggest words never appear in `suggestableWords` or
`common.txt`; specific slur decisions (COON, DINK, FAG and its forms) stay as decided.
