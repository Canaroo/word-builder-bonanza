import { describe, it, expect } from 'vitest';
import { dealScratch, withoutShards, type ScratchPrize } from '../scratch';
import { COSMETICS } from '../../data/cosmetics';
import { CHARMS_LIST } from '../../data/charms';

describe('the Triforce is gone (v7.95.0)', () => {
  it('a ticket saved with a shard square plays it as points', () => {
    const old = [{ kind: 'shard', id: 'power' }, { kind: 'skull' }] as unknown as ScratchPrize[];
    const fixed = withoutShards(old);
    expect(fixed[0].kind).toBe('points');
    expect(fixed[1].kind).toBe('skull');
  });
  it('new tickets never deal a shard', () => {
    for (let i = 0; i < 200; i++) {
      const sq = dealScratch(Math.random, { heldCharmIds: [], slotOpen: true, pocketEmpty: true });
      expect(sq.some(s => (s as { kind: string }).kind === 'shard')).toBe(false);
    }
  });
  it('the Hero of Time badge is retired, the Master Sword stays', () => {
    expect(COSMETICS.some(c => c.id === 'b_heroOfTime')).toBe(false);
    expect(CHARMS_LIST.find(c => c.id === 'triforceOfCourage')?.name).toBe('Master Sword');
  });
});
