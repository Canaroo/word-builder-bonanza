// Music ownership and the chosen track (v7.53.0). Like themes, these belong to the device: every
// player on it shares what was bought and what's playing. Credits stay in App; buyTrack says what to charge.
import { storage, STORAGE_KEYS } from './storage';
import { MUSIC_TRACKS, DEFAULT_TRACK_ID, trackById } from '../data/music';

export const ownedTracks = (): string[] => {
  const saved = storage.getJSON<string[]>(STORAGE_KEYS.musicOwned, []);
  const ids = new Set([DEFAULT_TRACK_ID, ...(Array.isArray(saved) ? saved.filter(id => trackById(id)) : [])]);
  return MUSIC_TRACKS.filter(t => ids.has(t.id)).map(t => t.id);
};

export const selectedTrack = (): string => {
  const id = storage.getString(STORAGE_KEYS.musicTrack);
  return id && ownedTracks().includes(id) ? id : DEFAULT_TRACK_ID;
};

/** v7.77.0: whether Golden Round and boss fights get their own music (on unless turned off). */
export const eventMusicOn = (): boolean => storage.getString(STORAGE_KEYS.eventMusic) !== 'off';
export const setEventMusicOn = (on: boolean): void => { storage.setString(STORAGE_KEYS.eventMusic, on ? 'on' : 'off'); };

export const selectTrack = (id: string): boolean => {
  if (!ownedTracks().includes(id)) return false;
  storage.setString(STORAGE_KEYS.musicTrack, id);
  return true;
};

/** Buy a track and play it from now on. Returns the cost to charge, or 0 if it can't be bought. */
export const buyTrack = (id: string, coins: number): number => {
  const track = trackById(id);
  const owned = ownedTracks();
  if (!track || track.cost <= 0 || owned.includes(id) || coins < track.cost) return 0;
  storage.setJSON(STORAGE_KEYS.musicOwned, [...owned.filter(t => t !== DEFAULT_TRACK_ID), id]);
  selectTrack(id);
  return track.cost;
};
