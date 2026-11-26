// One-time explainer cards (v7.96.0): the Video Store, Genre Levels and each Collector's Tile explain
// themselves the first time a player meets them. Per player on the device (playerKey).
import { storage, STORAGE_KEYS } from './storage';
import { playerKey } from './players';

const read = (): string[] => {
  const v = storage.getJSON<string[]>(playerKey(STORAGE_KEYS.introsSeen), []);
  return Array.isArray(v) ? v : [];
};
export const introSeen = (id: string): boolean => read().includes(id);
export const markIntro = (id: string): void => {
  const seen = read();
  if (!seen.includes(id)) storage.setJSON(playerKey(STORAGE_KEYS.introsSeen), [...seen, id]);
};
