import { CHARM_SET_BONUS } from '../config/gameplay';

// Charm sets (v7.41): hold every charm in a themed set and each valid word earns a set bonus, on
// its own score line. Sets are built mostly from charms the usage stats show nobody picks, so
// they have a job. Members are charm ids (ids never change; names can).
export interface CharmSet {
  id: string;
  name: string;
  icon: string;
  members: string[];
  flavorText: string;
}

export const CHARM_SETS: CharmSet[] = [
  { id: 'hyruleHeroes', name: 'Hyrule Heroes', icon: '🗡️', members: ['triforceOfCourage', 'hyruleHustle'], flavorText: "It's dangerous to go alone. Take both." },
  { id: 'centralPerk', name: 'Central Perk', icon: '☕', members: ['pivot', 'weWereOnABreak'], flavorText: "They'll be there for you." },
  { id: 'dinoDna', name: 'Dino DNA', icon: '🦖', members: ['cleverGirl', 'iceAgeBonus'], flavorText: 'Bingo! Dino DNA.' },
  { id: 'asYouWish', name: 'As You Wish', icon: '👑', members: ['inigosRevenge', 'battleOfWits', 'trueLove'], flavorText: 'Inconceivable! All three.' },
  { id: 'fightNight', name: 'Fight Night', icon: '🥊', members: ['littleMac', 'finishHim', 'doubleDragon'], flavorText: 'Round one. Fight!' },
  { id: 'saturdayMorning', name: 'Saturday Morning', icon: '📺', members: ['turtlePower', 'titansGo', 'scoobyStack'], flavorText: 'Cereal, pajamas, cartoons till noon.' },
  { id: 'greatestHits', name: 'Greatest Hits', icon: '🎹', members: ['pianoManEncore', 'italianRestaurantEnding', 'weDidntStartTheFire'], flavorText: 'Sing us a song, you’re the piano man.' },
  { id: 'gameShowNetwork', name: 'Game Show Network', icon: '🎤', members: ['doubleDare', 'supermarketSweep', 'theValve'], flavorText: 'Survey says: all three!' },
  { id: 'familyPhoto', name: 'Family Photo', icon: '🏠', members: ['nicolesGrace', 'christiansHoodieMode', 'lenaOfTheLostLights'], flavorText: 'Everybody squeeze in. Say cheese!' },
];

/** Points a completed set pays on every valid word (by how many charms it takes). */
export const setBonusFor = (set: CharmSet): number =>
  set.members.length >= 3 ? CHARM_SET_BONUS.trio : CHARM_SET_BONUS.pair;

/** The sets a charm belongs to (usually one). */
export const setsWith = (charmId: string): CharmSet[] => CHARM_SETS.filter(s => s.members.includes(charmId));

/** Sets fully held with these charms. */
export const completedSets = (charmIds: readonly string[]): CharmSet[] =>
  CHARM_SETS.filter(s => s.members.every(m => charmIds.includes(m)));

/** How a set stands with these charms held: which members are in and which are missing. */
export const setProgress = (set: CharmSet, charmIds: readonly string[]) => {
  const held = set.members.filter(m => charmIds.includes(m));
  return { held, missing: set.members.filter(m => !charmIds.includes(m)), complete: held.length === set.members.length };
};

/**
 * Charms that would move a started set along: members still missing from a set the player holds
 * part of. Charm offers lean toward these (CHARM_SET_BONUS.pullChance), since two named charms
 * out of 100 would rarely meet by luck.
 */
export const setPullCandidates = (charmIds: readonly string[]): string[] => {
  const out: string[] = [];
  for (const set of CHARM_SETS) {
    const p = setProgress(set, charmIds);
    if (p.held.length > 0 && !p.complete) p.missing.forEach(m => { if (!out.includes(m)) out.push(m); });
  }
  return out;
};
