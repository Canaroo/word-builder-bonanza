# Word Nerd

A fast-paced, Scrabble-inspired word game packed with 90s and 2000s pop culture bonuses.
Build high-scoring words from your rack against a 60-second clock, powered up by Charms,
PowerPlays, Milestones and easter eggs.

It's an installable web app (PWA): it runs in any modern browser, can be added to a phone's
home screen, and works offline after the first visit.

## Run it

Requires [Node.js](https://nodejs.org/) 20 or newer.

```sh
npm install
npm run dev        # http://localhost:3000 (also reachable from a phone on the same Wi-Fi)
```

| Command             | What it does                                                     |
| ------------------- | ---------------------------------------------------------------- |
| `npm run dev`       | Start the dev server with hot reload                             |
| `npm run build`     | Typecheck and build the production app into `dist/`              |
| `npm run preview`   | Serve the production build locally (test offline/install here)   |
| `npm test`          | Run the test suite                                               |
| `npm run typecheck` | Typecheck only                                                   |
| `npm run words`     | Rebuild the word list (runs automatically before dev/build/test) |

### Play on your phone

1. Run `npm run build && npm run preview -- --host`, or deploy `dist/` to any static host.
   Netlify is set up in `netlify.toml` (every PR gets a deploy preview). Installing as an app
   requires HTTPS, except on `localhost`.
2. Open the URL on your phone.
3. **iPhone:** Share → *Add to Home Screen*. **Android:** menu → *Install app*.

The installed app opens full-screen and keeps working without a connection.
New versions are picked up automatically the next time it's opened online.

## Word validation

Words are checked against a bundled list, entirely on the device:

```
word-list package (~270k Scrabble-style words)
  + data/internalWords.ts   (curated words with fun definitions)
  + words/custom.txt        (your extra allowed words)
  − words/blocked.txt       (words you never want accepted)
  = public/words/wordlist.txt
```

- **To allow a word**, add it to `words/custom.txt` (or to `data/internalWords.ts` with a definition).
- **To reject a word**, add it to `words/blocked.txt`.
- Restart `npm run dev` (or run `npm run words`) after editing.

The list loads once in a background worker (`services/dictionary.worker.ts`), so lookups are
instant and work offline. Definitions come from `internalWords.ts` first, then a small on-device
cache, then [dictionaryapi.dev](https://dictionaryapi.dev/) when online. The online dictionary is
only used for definitions, never to decide whether a word is valid.

The official NWL/TWL and Collins lists are licensed, so they aren't bundled. The base list here
([`word-list`](https://github.com/sindresorhus/word-list), MIT) is very close to them, and the
custom file covers anything missing.

## Tuning the game

Gameplay numbers live in [`config/gameplay.ts`](config/gameplay.ts): time bank (start, cap, seconds
per word length, invalid-word penalty), Golden Round clock, length multipliers, hand size, PowerPlay
meter size and strike recovery. The rules that use them are small tested functions in
`services/rules.ts`, and How to Play reads the same numbers, so changing the config updates the
game and its instructions together. `docs/GAMEPLAY_REVIEW.md` explains the reasoning.

## Pop-culture bonuses

All secret bonuses (words and score numbers) live in one list, `data/secretBonuses.ts`, including
the reveal art for each one (`vhs`, `cartridge`, `cd` or `arcade`). Word-count milestones are in
`data/wordBonuses.ts`. See [docs/BONUSES.md](docs/BONUSES.md) for how to add or change them.

- **Bonus Vault:** open `/?bonuses` on any build (e.g. the live site) to see every bonus, charm and
  PowerPlay, check that each bonus word is playable, and preview its reveal. It isn't linked
  from the menus.
- **Build check:** `npm run build` runs `npm run check:bonuses` first and stops if a bonus word is
  blocked, missing from the dictionary or used twice, so a bad edit never goes live.

## Leaderboard

**Top 50** is the worldwide board on Firebase Realtime Database, with every score also saved on the
device. When Firebase can't be reached, the game shows this device's scores instead. Set
`VITE_LEADERBOARD=local` in `.env` for device-only scores. Setup, database rules and known limits
are in [docs/LEADERBOARD.md](docs/LEADERBOARD.md).

## Saved data

Everything else is stored on the device in `localStorage` through `services/storage.ts`: player
name, credits (LEX coins, spent in Vibez), unlocked packs, saved game, event logs (last 25 runs plus pinned ones), missed
words and Power Word. To change the shape of saved data, bump `STORAGE_VERSION` and add a
migration step in that file.

## Design notes

- [docs/GAMEPLAY_REVIEW.md](docs/GAMEPLAY_REVIEW.md): evaluation of the core loop (timer, scoring,
  fairness, retention) with recommended changes.

## Project layout

```
App.tsx, index.tsx       App shell and startup
components/, ui/         Reusable UI pieces
services/screens/        Screens (GameScreen = game logic, GameScreenView = its layout)
services/                Game logic, word validation, sound, storage, leaderboard
data/                    Charms, PowerPlays, easter eggs, packs, curated words
config/                  gameplay.ts: all tunable gameplay numbers
words/                   custom.txt and blocked.txt word overrides, word-list licences
scripts/                 Build-time scripts (word list)
public/                  Static files: music, icons, favicon
```
