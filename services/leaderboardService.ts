import { LeaderboardEntry } from '../types';

// The firebase global object is loaded from the script tags in index.html
declare const firebase: any;

/**
 * Small helper that keeps your timestamps aligned with Firebase server time.
 * If server time isn't available yet, it falls back to Date.now() so it won't break.
 */
let serverNow = () => Date.now();
try {
  firebase.database().ref('.info/serverTimeOffset').on('value', (snap: any) => {
    const offset = snap?.val?.() || 0;
    serverNow = () => Date.now() + offset;
  });
} catch { /* ignore init timing */ }

/**
 * Submits the player's score to the Firebase Realtime Database.
 * Writes EXACTLY the fields your rules allow: { name, score, timestamp }.
 */
const submitScore = async (name: string, score: number): Promise<void> => {
  try {
    const db = firebase.database();

    const entry = {
      name,                          // string
      score,                         // number
      timestamp: serverNow()         // number (milliseconds)
    };

    // Helpful log so you can verify what's being sent
    console.log(
      'Submitting payload →',
      entry,
      'ts-length=', String(entry.timestamp).length,
      'iso=', new Date(entry.timestamp).toISOString()
    );

    // Create-only write under /leaderboard/{autoId}
    await db.ref('leaderboard').push(entry);

    // Keep your local highlight behavior
    localStorage.setItem('lastSubmittedName', name);
    localStorage.setItem('lastSubmittedScore', String(score));

    console.log(`Score submission for ${name} (${score}) sent to Firebase.`);
  } catch (error) {
    console.error('Error submitting score to Firebase:', error);
    throw error;
  }
};

/**
 * Fetches the top 50 scores, normalizing date for display.
 * Accepts both new {timestamp} rows and any legacy rows that used {date}.
 */
const getLeaderboard = async (): Promise<LeaderboardEntry[]> => {
  try {
    const db = firebase.database();
    const snapshot = await db.ref('leaderboard').once('value');
    const data = snapshot.val();
    if (!data) return [];

    const rows: any[] = Object.values(data);

    // Sort by score descending (client-side)
    rows.sort((a, b) => (b?.score ?? 0) - (a?.score ?? 0));

    // Take top 50 and normalize date -> ISO string
    const top50 = rows.slice(0, 50).map((entry: any) => {
      const ms =
        typeof entry?.timestamp === 'number'
          ? entry.timestamp
          : typeof entry?.date === 'number'
          ? entry.date
          : Date.parse(String(entry?.date ?? ''));
      const iso = isFinite(ms) ? new Date(ms).toISOString() : '';

      return {
        name: String(entry?.name ?? ''),
        score: Number(entry?.score ?? 0),
        date: iso,                    // your UI expects a 'date' field to display
      } as LeaderboardEntry;
    });

    return top50;
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return [];
  }
};

export const leaderboardService = {
  submitScore,
  getLeaderboard,
};
