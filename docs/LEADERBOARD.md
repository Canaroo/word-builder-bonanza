# Leaderboard

Every submitted score is saved on the device (`services/localLeaderboard.ts`). When the online
board is enabled it is also written to Firebase Realtime Database (`services/onlineLeaderboard.ts`),
and **Top 50** shows the worldwide board. If Firebase can't be reached (offline, blocked, slower
than 8 seconds) the game shows this device's scores instead, says why ("timed out", "no
connection", "permission denied"), and offers a **Retry** button.

The game talks to Firebase over its plain REST API (`fetch` + JSON), not the Firebase SDK. That's
the same request a browser makes when you open the database URL, so it works on networks where the
SDK's live websocket is slow or blocked, and it adds nothing to the app's download size.

**Quick health check:** open
`https://scrabbleleaderboard-9b8d7-default-rtdb.firebaseio.com/leaderboard.json?orderBy="score"&limitToLast=3`
in a browser. A few scores means the database and read rules are fine; "Permission denied" means
the rules need fixing.

## Configuration

Settings live in `.env` (override locally in `.env.local`):

| Variable                     | Purpose                                         |
| ---------------------------- | ----------------------------------------------- |
| `VITE_LEADERBOARD`           | `online` (default) or `local` (device only)     |
| `VITE_FIREBASE_DATABASE_URL` | Realtime Database URL (the only one the game uses) |

The other `VITE_FIREBASE_*` values in `.env` are kept for reference but no longer read. None of
them are secrets: what protects the data is the database rules below.

## Data

Each score is one child of `/leaderboard`, written once and never updated:

```json
{ "name": "Ann", "score": 4210, "timestamp": 1760716800000, "badge": "b_vhs", "title": "s_arcadeRat", "streak": 9, "bosses": 4,
  "card": { "runs": 37, "best": 9120, "avg": 3400, "level": 7, "word": "JAZZ", "wordScore": 180, "longest": "PLANETS", "secrets": 12 } }
```

`timestamp` is set by the server (`{".sv": "timestamp"}`). Before submitting, names are cleaned to
what the rules accept (`sanitizeName()` in `services/leaderboardService.ts`): letters, numbers,
spaces and `_ . ' -`, accents dropped, curly apostrophes straightened, at most 20 characters, and
`Player` if nothing is left. `badge`, `title`, `streak`, `bosses` and `card` are optional: the player's equipped bling
(ids from `data/cosmetics.ts`), daily streak, Boss Badges collected (how many different bosses
they've beaten, shown as 🏅4 on the Top 50), and a snapshot of their player ID stats
(`services/career.ts`), shown when someone taps their row. The board ignores unknown ids and
malformed cards. If the database rules reject the extras, the game retries without the newest
ones (`card`, then `bosses`), then with the score alone, so nothing is lost.

## Database rules

These are the rules live in Firebase console → Realtime Database → Rules. Keep this copy in sync
when either one changes.

- **Default deny:** nothing outside `/leaderboard` can be read or written.
- **Create-only:** anyone can read the board and add a score, but not edit or delete one.
- **Strict fields:** names must match the allowed characters, timestamps must be within 5 minutes
  of server time, badge and title must look like cosmetic ids (`b_`/`s_` badges, `t_`/`s_`
  titles), streak and Boss Badge counts must be in range, and any other field is rejected.
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
        // Boss Badges collected (different bosses beaten)
        "bosses": { ".validate": "newData.isNumber() && newData.val() >= 1 && newData.val() <= 99" },

        // Player ID snapshot: the stats on their card when the score was posted
        "card": {
          ".validate": "newData.hasChildren(['runs','best','avg','level'])",
          "runs":      { ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 1000000" },
          "best":      { ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 10000000" },
          "avg":       { ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 10000000" },
          "level":     { ".validate": "newData.isNumber() && newData.val() >= 1 && newData.val() <= 9999" },
          "word":      { ".validate": "newData.isString() && newData.val().matches(/^[A-Z]{0,15}$/)" },
          "wordScore": { ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 10000000" },
          "longest":   { ".validate": "newData.isString() && newData.val().matches(/^[A-Z]{0,15}$/)" },
          "secrets":   { ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 999" },
          "$other":    { ".validate": false }
        },

        // Block any extra fields
        "$other": { ".validate": false }
      }
    },

    // Anonymous usage stats (services/stats.ts): readable by anyone, create-only, strict fields
    "stats": {
      ".read": true,
      ".indexOn": ["timestamp"],

      "$id": {
        ".write": "!data.exists()",
        ".validate": "newData.hasChildren(['type','timestamp'])",

        "type": { ".validate": "newData.isString() && newData.val().matches(/^(boss_start|boss_end|mission_shown|mission_done|run_end|power_word)$/)" },
        "timestamp": { ".validate": "newData.isNumber() && newData.val() > now - 5 * 60 * 1000 && newData.val() < now + 5 * 60 * 1000" },

        // Bosses
        "boss":    { ".validate": "newData.isString() && newData.val().matches(/^[A-Za-z]{1,24}$/)" },
        "number":  { ".validate": "newData.isNumber() && newData.val() >= 1 && newData.val() <= 99" },
        "outcome": { ".validate": "newData.isString() && newData.val().matches(/^(won|close|escaped)$/)" },
        "hits":    { ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 20" },

        // Missions
        "mission": { ".validate": "newData.isString() && newData.val().matches(/^[wpcs]_[A-Za-z]{1,24}$/)" },
        "tier":    { ".validate": "newData.isNumber() && newData.val() >= 1 && newData.val() <= 3" },

        // Power words
        "power":   { ".validate": "newData.isString() && newData.val().matches(/^(slot|freeze|heal|slow|twin)$/)" },
        "repeat":  { ".validate": "newData.isBoolean()" },
        "seconds": { ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 60" },
        "strike":  { ".validate": "newData.isBoolean()" },

        // Run summary
        "score":   { ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 10000000" },
        "words":   { ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 100000" },
        "level":   { ".validate": "newData.isNumber() && newData.val() >= 1 && newData.val() <= 9999" },
        "bosses":  { ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 99" },

        "$other": { ".validate": false }
      }
    }
  }
}
```

Firebase rules allow `//` comments, so paste the block as-is.

## Usage stats

`services/stats.ts` appends small anonymous events to `/stats` (no names, no device id):

| Event | Fields | Sent when |
| --- | --- | --- |
| `boss_start` | `boss`, `number` | A boss round starts |
| `boss_end` | `boss`, `number`, `outcome`, `hits` | A boss round ends (won, close or escaped) |
| `mission_shown` | `mission`, `tier` | The first time a device sees the day's missions (one per mission) |
| `mission_done` | `mission`, `tier` | A mission is completed |
| `run_end` | `score`, `words`, `level`, `bosses` | The Game Over summary is closed |
| `power_word` | `power`, `repeat`, `seconds`, `strike` | A power word fires (slot payout, freeze or cloned seconds; whether HEAL removed a strike) |

Sending is fire-and-forget and never interrupts play. It's off in dev, on `localhost`, and when
`VITE_LEADERBOARD=local`. The hidden page **`/?stats`** reads the last 24 hours, 7, 30 or 90 days
and shows runs, how far runs get, boss clear rates, mission completion rates and a daily table.
The `stats` rules above must be published for both sending and the page to work.

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
