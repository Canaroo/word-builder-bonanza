// v7.100.2 (the owner's ask: a player's 49,109 looked missing from the Top 50): a finished run posts itself to the
// Top 50 when it would make the board or is the player's new personal best. Scored Daily runs cross-post the same
// way (marked 📅). Everything else waits for the player's SUBMIT SCORE. Scores always post under the player's name.
import { TOP_N } from './onlineLeaderboard';

/** Whether a score belongs on the Top 50 now: a new personal best, room on the board, or beating its lowest score. */
export const qualifiesForTop50 = (score: number, isNewBest: boolean, board: readonly { score: number }[], size = TOP_N): boolean => {
    if (score <= 0) return false;
    if (isNewBest) return true;
    if (board.length < size) return true;
    return score > Math.min(...board.map(e => e.score));
};
