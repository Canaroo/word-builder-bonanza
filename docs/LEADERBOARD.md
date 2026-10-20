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

`timestamp` is set by the server (`serverTimestamp()`). Names are trimmed to 20 characters.
`badge`, `title` and `streak` are optional: the player's equipped bling (ids from
`data/cosmetics.ts`) and daily streak. The board ignores unknown ids. If the database rules don't
allow these fields yet, the game posts the score without them, so nothing is lost.

## Recommended database rules

Paste these into Firebase console → Realtime Database → Rules. They allow anyone to read the board
and add a score, but not to edit or delete one, and reject malformed entries. `.indexOn` lets the
game download only the top 50 instead of the whole list.

```json
{
  "rules": {
    "leaderboard": {
      ".read": true,
      ".indexOn": ["score"],
      "$entry": {
        ".write": "!data.exists()",
        ".validate": "newData.hasChildren(['name', 'score', 'timestamp'])",
        "name": { ".validate": "newData.isString() && newData.val().length > 0 && newData.val().length <= 20" },
        "score": { ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 10000000" },
        "timestamp": { ".validate": "newData.val() === now" },
        "badge": { ".validate": "newData.isString() && newData.val().length <= 32" },
        "title": { ".validate": "newData.isString() && newData.val().length <= 32" },
        "streak": { ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 9999" },
        "$other": { ".validate": false }
      }
    }
  }
}
```

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
