import { storage, STORAGE_KEYS } from './storage';
import { playerKey } from './players';

/** The current player's best score. */
export const getPersonalBest = (): number => {
    const best = storage.getJSON<unknown>(playerKey(STORAGE_KEYS.personalBest), 0);
    return typeof best === 'number' && Number.isFinite(best) ? best : 0;
};

/** Records a finished run; returns true if it beat the previous best. */
export const recordRunScore = (score: number): boolean => {
    const previous = getPersonalBest();
    if (score <= previous) return false;
    storage.setJSON(playerKey(STORAGE_KEYS.personalBest), score);
    return previous > 0 || score > 0;
};
