// Scratch-off ticket (v7.66.0, the owner's design): the card dealt at levels 4, 7 and 11, where the
// Fork used to be. Pure rules here; the card is components/ScratchCard.tsx. Values in SCRATCH.
import { SCRATCH, TRIFORCE } from '../config/gameplay';
import type { TriforceId } from '../data/triforce';

export type ScratchPrize =
  | { kind: 'points'; amount: number }
  | { kind: 'time'; amount: number }
  | { kind: 'shuffle'; amount: number }
  | { kind: 'challenge'; amount: number }
  | { kind: 'charm'; id: string }
  | { kind: 'powerplay'; id: string }
  | { kind: 'shard'; id: TriforceId }
  | { kind: 'skull' };

const pick = <T,>(list: readonly T[], rand: () => number): T => list[Math.floor(rand() * list.length)];

/**
 * Deals a ticket: SCRATCH.squares squares, SCRATCH.skulls of them skulls, the rest prizes drawn by
 * SCRATCH.weights. Charms only from those not held (and only with an open slot), PowerPlays only
 * when the pocket is empty, and never the same charm or PowerPlay twice on one ticket.
 */
export const dealScratch = (
  rand: () => number,
  opts: { heldCharmIds: readonly string[]; slotOpen: boolean; pocketEmpty: boolean; shard?: TriforceId | null },
): ScratchPrize[] => {
  const charms = SCRATCH.charms.filter(id => !opts.heldCharmIds.includes(id));
  const pps: string[] = [...SCRATCH.powerPlays];
  const usedCharms = new Set<string>(), usedPPs = new Set<string>();
  const kinds = (Object.keys(SCRATCH.weights) as (keyof typeof SCRATCH.weights)[]).filter(k =>
    k === 'charm' ? opts.slotOpen && charms.length > 0 : k === 'powerplay' ? opts.pocketEmpty : true);
  const prizes: ScratchPrize[] = [];
  // v7.69.1: one square at most can hold a Triforce shard (for the piece shardFor picked).
  let shardLeft = opts.shard ? 1 : 0;
  while (prizes.length < SCRATCH.squares - SCRATCH.skulls) {
    const total = kinds.reduce((t, k) => t + SCRATCH.weights[k], 0) + (shardLeft ? TRIFORCE.scratchWeight : 0);
    let r = rand() * total;
    if (shardLeft && (r -= TRIFORCE.scratchWeight) < 0) { shardLeft = 0; prizes.push({ kind: 'shard', id: opts.shard! }); continue; }
    const kind = kinds.find(k => (r -= SCRATCH.weights[k]) < 0) ?? 'points';
    if (kind === 'charm') {
      const left = charms.filter(id => !usedCharms.has(id));
      if (!left.length) continue;
      const id = pick(left, rand); usedCharms.add(id); prizes.push({ kind, id });
    } else if (kind === 'powerplay') {
      const left = pps.filter(id => !usedPPs.has(id));
      if (!left.length) continue;
      const id = pick(left, rand); usedPPs.add(id); prizes.push({ kind, id });
    } else {
      prizes.push({ kind, amount: pick(SCRATCH.prizes[kind], rand) });
    }
  }
  const squares: ScratchPrize[] = [...prizes, ...Array.from({ length: SCRATCH.skulls }, () => ({ kind: 'skull' as const }))];
  for (let i = squares.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [squares[i], squares[j]] = [squares[j], squares[i]]; }
  return squares;
};

/**
 * The first scratch is always safe: if it lands on a skull, that skull swaps places with the
 * nearest prize square (the deal stays the same otherwise).
 */
export const safeFirstScratch = (squares: readonly ScratchPrize[], index: number): ScratchPrize[] => {
  if (squares[index]?.kind !== 'skull') return [...squares];
  const swap = squares.findIndex(s => s.kind !== 'skull');
  const out = [...squares];
  [out[index], out[swap]] = [out[swap], out[index]];
  return out;
};

/** Chance the next scratch is a skull, given the squares already opened. */
export const skullOdds = (squares: readonly ScratchPrize[], opened: readonly number[]): { skulls: number; left: number } => {
  const closed = squares.map((s, i) => ({ s, i })).filter(x => !opened.includes(x.i));
  return { skulls: closed.filter(x => x.s.kind === 'skull').length, left: closed.length };
};
