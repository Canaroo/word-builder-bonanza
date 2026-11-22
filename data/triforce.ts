import type { Charm, GameState } from '../types';
import { TRIFORCE } from '../config/gameplay';

// Fragile charms (v7.69.0): the Triforce. Each piece is built from 3 shards picked up from charm
// offers. Shards are Charm-shaped so they can sit in an offer, but they're never equipped: taking
// one adds it to the Triforce shelf (gameState.triforce), and a finished piece works from there.

export type TriforceId = 'power' | 'wisdom' | 'courage';
export const TRIFORCE_IDS: TriforceId[] = ['power', 'wisdom', 'courage'];

export const TRIFORCE_PIECES: Record<TriforceId, { name: string; holder: string; color: string; glow: string; does: string; flavor: string }> = {
  power: {
    name: 'Triforce of Power', holder: 'Ganon', color: '#ff4d6d', glow: 'rgba(255,77,109,0.8)',
    does: `Every word scores x${TRIFORCE.powerMultiplier}, charm points included.`,
    flavor: "Ganon's piece. Raw, unstoppable scoring.",
  },
  wisdom: {
    name: 'Triforce of Wisdom', holder: 'Zelda', color: '#4dd2ff', glow: 'rgba(77,210,255,0.8)',
    does: `Each new hand, Zelda lights up the tiles of a ${TRIFORCE.wisdomMinLetters}+ letter word you can play.`,
    flavor: "Zelda's piece. She always knows the answer.",
  },
  courage: {
    name: 'Triforce of Courage', holder: 'Link', color: '#5dff8f', glow: 'rgba(93,255,143,0.8)',
    does: `Once per level, the first thing that would hurt you bounces off: a strike is blocked, or if your clock hits 0 you get +${TRIFORCE.courageSeconds} seconds.`,
    flavor: "Link's piece. Too brave to go down easy.",
  },
};

export const SHARD_ID_PREFIX = 'shard_';
export const shardCharm = (id: TriforceId): Charm => ({
  id: `${SHARD_ID_PREFIX}${id}`,
  name: `Shard: ${TRIFORCE_PIECES[id].name}`,
  description: `A fragile charm: collect all ${TRIFORCE.shards} shards to assemble the ${TRIFORCE_PIECES[id].name}. ${TRIFORCE_PIECES[id].does} A shard does nothing on its own, and the Triforce never uses a charm slot.`,
  flavorText: TRIFORCE_PIECES[id].flavor,
  icon: '🔺',
  subtheme: 'game',
  effectType: 'passive',
  durationTag: 'PERSISTENT',
  activate: () => ({}),
  fragile: id,
});
export const SHARD_CHARMS: Charm[] = TRIFORCE_IDS.map(shardCharm);

export const shardsOf = (gs: Pick<GameState, 'triforce'> | null | undefined, id: TriforceId): number => gs?.triforce?.[id] ?? 0;
export const triforceDone = (gs: Pick<GameState, 'triforce'> | null | undefined, id: TriforceId): boolean => shardsOf(gs, id) >= TRIFORCE.shards;
export const anyShards = (gs: Pick<GameState, 'triforce'> | null | undefined): boolean => TRIFORCE_IDS.some(id => shardsOf(gs, id) > 0);
