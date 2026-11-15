import { useEffect, useState } from 'react';

/**
 * End-of-run cards (Last Words, Phoenix Down) open while players are still tapping fast at the
 * old board, so the first taps could hit their buttons by accident: skip the parting word, or end
 * a run that could have been continued (v7.47.1). Taps are ignored until this turns true.
 */
export const END_CARD_ARM_MS = 1500;
export function useArmDelay(ms: number = END_CARD_ARM_MS): boolean {
  const [armed, setArmed] = useState(false);
  useEffect(() => { const t = setTimeout(() => setArmed(true), ms); return () => clearTimeout(t); }, [ms]);
  return armed;
}
