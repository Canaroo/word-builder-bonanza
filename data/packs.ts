import { Pack } from '../types';
import { THEME_PRICES } from '../config/progression';

export const PACKS_LIST: Pack[] = [
  {
    id: 'default',
    name: 'Arcade',
    cost: 0,
    tileClass: 'tile-arcade',
    themeClass: 'theme-arcade',
    frameClass: 'frame-arcade',
    previewClass: 'theme-arcade',
    description: 'Neon, scanlines and a synthwave sunset. Insert coin to continue.'
  },
  {
    id: 'classic',
    name: 'Library Card',
    cost: THEME_PRICES['classic'],
    tileClass: 'bg-yellow-700 text-stone-100',
    themeClass: 'theme-the-library',
    frameClass: 'frame-rustic-workbench',
    previewClass: 'theme-the-library',
    description: 'Wood grain, warm lamps and tiles that smell faintly of old paperbacks. Shh… genius at work.'
  },
  {
    id: 'future',
    name: 'Mainframe',
    cost: THEME_PRICES['future'],
    tileClass: 'bg-blue-800 text-cyan-300',
    themeClass: 'theme-digital-grid',
    frameClass: 'frame-command-console',
    previewClass: 'theme-digital-grid',
    description: 'Neon grid lines straight out of TRON. Greetings, program. Your words are now online.'
  },
  {
    id: 'golden',
    name: 'Midas Touch',
    cost: THEME_PRICES['golden'],
    tileClass: 'bg-zinc-800 text-amber-400',
    themeClass: 'theme-cosmic-void',
    frameClass: 'frame-gilded',
    previewClass: 'theme-cosmic-void',
    description: 'Gold leaf in the cosmic void. Everything you spell turns to bling.'
  },
  {
    id: 'hawkins-horror',
    name: 'Hawkins Horror',
    cost: THEME_PRICES['hawkins-horror'],
    tileClass: 'tile-hawkins',
    themeClass: 'theme-hawkins-horror',
    frameClass: 'frame-hawkins-lab',
    previewClass: 'theme-hawkins-horror',
    description: 'An eerie, 80s-inspired theme with floating particles and a sinister glow. Do you copy? Over.'
  },
  {
    id: 'galactic-saga',
    name: 'Galactic Saga',
    cost: THEME_PRICES['galactic-saga'],
    tileClass: 'tile-lightsaber',
    themeClass: 'theme-galactic-saga',
    frameClass: 'frame-starship-hull',
    previewClass: 'theme-galactic-saga',
    description: 'Jump to hyperspace with a theme from a galaxy far, far away. The Force is strong with this one.'
  },
  {
    id: '90s-throwback',
    name: "'90s Throwback",
    cost: THEME_PRICES['90s-throwback'],
    tileClass: 'tile-90s-throwback',
    themeClass: 'theme-90s-throwback',
    frameClass: 'frame-90s-throwback',
    previewClass: 'theme-90s-throwback',
    description: 'All that and a bag of chips! A theme with geometric shapes and colors straight from your favorite windbreaker.'
  },
  {
    id: 'fifth-dimension',
    name: 'The Fifth Dimension',
    cost: THEME_PRICES['fifth-dimension'],
    tileClass: 'tile-monochrome',
    themeClass: 'theme-fifth-dimension',
    frameClass: 'frame-fifth-dimension',
    previewClass: 'theme-fifth-dimension',
    description: 'A journey into a wondrous land of imagination. You\'ve just crossed over into… the Word Nerd Zone.'
  },
  {
    id: 'worlds-finest',
    name: 'World\'s Finest',
    cost: THEME_PRICES['worlds-finest'],
    tileClass: 'tile-comic-book',
    themeClass: 'theme-worlds-finest',
    frameClass: 'frame-heroic-emblem',
    previewClass: 'theme-worlds-finest',
    description: 'From the dark alleys of Gotham to the bright skies of Metropolis. A theme for heroes.'
  },
  {
    id: 'midnight-arcade',
    name: 'Midnight Arcade',
    cost: 0,
    streakDay: 30,
    tileClass: 'tile-midnight',
    themeClass: 'theme-arcade theme-midnight',
    frameClass: 'frame-arcade frame-midnight',
    previewClass: 'theme-arcade theme-midnight',
    description: 'After hours, when only the regulars are left. Chrome tiles, a moonlit grid. Earned with a 30-day streak.'
  },
];