// How each easter-egg bonus is presented when it fires.
//   vhs:       movies and TV — a rental tape cover
//   cartridge: video games — a game cartridge
//   cd:        music — a spinning disc
//   arcade:    everything else (score numbers, memes) — a neon marquee
// `source` is printed on the label. Bonuses not listed here use the arcade marquee.

export type BonusMediaType = 'vhs' | 'cartridge' | 'cd' | 'arcade';

export interface BonusMedia {
  media: BonusMediaType;
  source?: string;
}

export const BONUS_MEDIA: Record<string, BonusMedia> = {
  // Video games
  dangerousAlone: { media: 'cartridge', source: 'The Legend of Zelda' },
  heroOfHyrule: { media: 'cartridge', source: 'The Legend of Zelda' },
  oneUp: { media: 'cartridge', source: 'Super Mario Bros.' },
  fixItFelix: { media: 'cartridge', source: 'Fix-It Felix Jr.' },

  // Music
  loveBonus: { media: 'cd', source: 'The Beatles' },
  slimShadySnap: { media: 'cd', source: 'Eminem' },
  sixpenceSwoon: { media: 'cd', source: 'Sixpence None the Richer' },
  pinkPonyClub: { media: 'cd', source: 'Chappell Roan' },

  // Movies and TV
  vegasBaby: { media: 'vhs', source: 'Swingers' },
  squidGame: { media: 'vhs', source: 'Squid Game' },
  sex: { media: 'vhs', source: 'Sex and the City' },
  homersDelight: { media: 'vhs', source: 'The Simpsons' },
  dundieAward: { media: 'vhs', source: 'The Office' },
  timeBonus: { media: 'vhs', source: 'Back to the Future' },
  dieBonus: { media: 'vhs', source: 'Die Hard' },
  gunBonus: { media: 'vhs', source: 'Die Hard' },
  joyBonus: { media: 'vhs', source: 'Inside Out' },
  chandlerBing: { media: 'vhs', source: 'Friends' },
  deadPoetsSociety: { media: 'vhs', source: 'Dead Poets Society' },
  terminator: { media: 'vhs', source: 'The Terminator' },
  spiderman: { media: 'vhs', source: 'Spider-Man' },
  bluePillBonus: { media: 'vhs', source: 'The Matrix' },
  spaceJamSlam: { media: 'vhs', source: 'Space Jam' },
  jamesBond: { media: 'vhs', source: 'James Bond' },
  getOffMyPlane: { media: 'vhs', source: 'Air Force One' },
  elleWoods: { media: 'vhs', source: 'Legally Blonde' },
  fullHouse: { media: 'vhs', source: 'Star Wars' },
  strangerThingsMom: { media: 'vhs', source: 'Stranger Things' },
  zedsDead: { media: 'vhs', source: 'Pulp Fiction' },
  expelliarmus: { media: 'vhs', source: 'Harry Potter' },
};

export const getBonusMedia = (eggId: string): BonusMedia => BONUS_MEDIA[eggId] ?? { media: 'arcade' };
