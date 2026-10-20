# Leaderboard

Every submitted score is saved on the device (`services/localLeaderboard.ts`). When the online
board is enabled it is also written to Firebase Realtime Database (`services/onlineLeaderboard.ts`),
and **Top 50** shows the worldwide board. If Firebase can't be reached (offline, blocked, slow for
more than 6 seconds) the game shows this device's scores instead, labelled as such.

The Firebase SDK is loaded only when the leaderboard is opened or a score is submitted.

## Configuration

Settings live in `.env` (override locally in `.env.local`):

| Variable                     | Purpose                                         |
| ---------------------------- | ----------------------------------------------- |
| `VITE_LEADERBOARD`           | `online` (default) or `local` (device only)     |
| `VITE_FIREBASE_API_KEY`      | Firebase web config                             |
| `VITE_FIREBASE_AUTH_DOMAIN`  | Firebase web config                             |
| `VITE_FIREBASE_DATABASE_URL` | Realtime Database URL                           |
| `VITE_FIREBASE_PROJECT_ID`   | Firebase web config                             |
| `VITE_FIREBASE_APP_ID`       | Firebase web config                             |

Firebase web config values are public identifiers, not secrets. What protects the data is the
database rules below.

## Data

Each score is one child of `/leaderboard`, written once and never updated:

```json
{ "name": "Ann", "score": 4210, "timestamp": 1760716800000, "badge": "b_vhs", "title": "s_arcadeRat", "streak": 9 }
```

`timestamp` is set by the server (`serverTimestamp()`). Before submitting, names are cleaned to
what the rules accept (`sanitizeName()` in `services/leaderboardService.ts`): letters, numbers,
spaces and `_ . ' -`, accents dropped, curly apostrophes straightened, at most 20 characters, and
`Player` if nothing is left. `badge`, `title` and `streak` are optional: the player's equipped bling
(ids from `data/cosmetics.ts`) and daily streak. The board ignores unknown ids. If the database
rules don't allow these fields, the game posts the score without them, so nothing is lost.

## Database rules

These are the rules live in Firebase console → Realtime Database → Rules. Keep this copy in sync
when either one changes.

- **Default deny:** nothing outside `/leaderboard` can be read or written.
- **Create-only:** anyone can read the board and add a score, but not edit or delete one.
- **Strict fields:** names must match the allowed characters, timestamps must be within 5 minutes
  of server time, badge and title must look like cosmetic ids (`b_`/`s_` badges, `t_`/`s_`
  titles), and any other field is rejected.
- **`.indexOn`** lets the game download only the top 50 instead of the whole list.

Adding a cosmetic needs no rules change as long as its id follows the existing pattern: a `b_`,
`t_` or `s_` prefix followed by up to 24 letters.

```json
{
  "rules": {
    // Default: nobody can read or write anything
    ".read": false,
    ".write": false,

    // Public leaderboard: readable by anyone, writes only for new valid entries
    "leaderboard": {
      ".read": true,
      ".indexOn": ["score"],

      "$id": {
        // Create-only: cannot modify existing records
        ".write": "!data.exists()",

        // Must have exactly these fields
        ".validate": "newData.hasChildren(['name','score','timestamp'])",

        "name": {
          // Allow letters, numbers, space, underscore, period, apostrophe, hyphen; 1-30 chars
          ".validate": "newData.isString() && newData.val().matches(/^[A-Za-z0-9 _.'-]{1,30}$/)"
        },
        "score": {
          ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 10000000"
        },
        "timestamp": {
          // Milliseconds; must be "fresh" within ±5 minutes of server time
          ".validate": "newData.isNumber() && newData.val() > now - 5 * 60 * 1000 && newData.val() < now + 5 * 60 * 1000"
        },

        // Optional player flair: badge id, title id, streak days
        "badge":  { ".validate": "newData.isString() && newData.val().matches(/^[bs]_[A-Za-z]{1,24}$/)" },
        "title":  { ".validate": "newData.isString() && newData.val().matches(/^[ts]_[A-Za-z]{1,24}$/)" },
        "streak": { ".validate": "newData.isNumber() && newData.val() >= 1 && newData.val() <= 9999" },

        // Block any extra fields
        "$other": { ".validate": false }
      }
    }
  }
}
```

Firebase rules allow `//` comments, so paste the block as-is.

## Known limits

- **Cheating:** any client-only leaderboard can be fed fake scores by someone who reads the code.
  The rules above stop malformed and edited entries, not invented ones. Next steps, in order of
  effort: turn on [Firebase App Check](https://firebase.google.com/docs/app-check) (blocks requests
  that don't come from the real app), then move submission into a Cloud Function that checks the
  run's word log before writing the score.
- **Moderation:** names aren't filtered. Run them through `words/blocked.txt`, or review entries in
  the console.
- **Verification:** the online path couldn't be tested from the build sandbox, which blocks
  Firebase. Check it once in a real browser: submit a score and confirm it appears in the console.
