
import { LeaderboardEntry } from '../types';

// Google Apps Script URL for the leaderboard
const LEADERBOARD_URL = 'https://script.google.com/macros/s/AKfycbxn1bFURGJpGblzPzb9a0uYWkwLVwCNM688VpjsITpRNAViidVx0RWAML_4Ib_kQ6VYmw/exec';

const getLeaderboard = async (): Promise<LeaderboardEntry[]> => {
  try {
    // The Apps Script is configured to handle GET requests for fetching scores.
    const response = await fetch(LEADERBOARD_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch leaderboard: ${response.statusText}`);
    }
    // The script is expected to return a JSON array of top scores.
    const data: LeaderboardEntry[] = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    // Return an empty array for graceful failure so the UI doesn't crash.
    return [];
  }
};

const submitScore = async (name: string, score: number): Promise<void> => {
  try {
    // The Apps Script handles POST requests to submit a score.
    // By removing the Content-Type header, we use 'text/plain' by default,
    // which avoids a CORS preflight (OPTIONS) request that can fail.
    // Google Apps Script can still parse the JSON from the request body.
    const response = await fetch(LEADERBOARD_URL, {
      method: 'POST',
      body: JSON.stringify({ name, score, date: new Date().toISOString() }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to submit score: ${response.status} ${response.statusText}. Details: ${errorText}`);
    }
    
    console.log(`Successfully submitted score for ${name}: ${score}`);
    
  } catch (error) {
    console.error('Error submitting score:', error);
    // The error is logged, but the app continues.
  }
};

export const leaderboardService = {
  getLeaderboard,
  submitScore,
};