import { storage, STORAGE_KEYS } from './storage';
import { playerKey } from './players';
import { HEAD_START } from '../config/gameplay';

// Head Start (v7.42, the "mercy rule"): 47% of runs ended by level 3, and most occasional players
// never came back for a second day. Each run that ends before level `untilLevel` adds `perRun`
// seconds to that player's next starting clock (up to `max`); reaching the level clears it.
// Per player, shown on a chip when the run starts, never on the scored Daily Run.

const read = (): number => {
  const n = Number(storage.getJSON<number>(playerKey(STORAGE_KEYS.headStart), 0));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

/** Seconds added to this player's next starting clock. */
export const headStartSeconds = (): number => Math.min(HEAD_START.max, read() * HEAD_START.perRun);

/** Seconds a count of early endings in a row is worth (for tests and text). */
export const headStartFor = (earlyRuns: number): number => Math.min(HEAD_START.max, Math.max(0, earlyRuns) * HEAD_START.perRun);

/** A run ended at this level: an early ending adds to the next head start, a good run clears it. */
export const recordRunForHeadStart = (level: number): number => {
  const next = level < HEAD_START.untilLevel ? Math.min(Math.ceil(HEAD_START.max / HEAD_START.perRun), read() + 1) : 0;
  storage.setJSON(playerKey(STORAGE_KEYS.headStart), next);
  return headStartFor(next);
};
