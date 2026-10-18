
import { Milestone } from '../types';

// Score milestones award one-time bonus points. They don't touch the clock (see config/gameplay.ts).
export const MILESTONES_LIST: Milestone[] = [
  {
    id: 'milestone500',
    name: 'Party On, Wayne!',
    icon: '🎸',
    scoreThreshold: 500,
    reward: { points: 100 },
    flavorText: "500 points? Excellent! *air guitar* We're not worthy… but you are."
  },
  {
    id: 'milestone1000',
    name: "He's Heating Up!",
    icon: '🔥',
    scoreThreshold: 1000,
    reward: { points: 150 },
    flavorText: "1,000 points and the net's on fire. Boomshakalaka!"
  },
  {
    id: 'milestone2000',
    name: 'Y2K Survivor',
    icon: '💾',
    scoreThreshold: 2000,
    reward: { points: 200 },
    flavorText: "2,000 points and the computers didn't crash. Party like it's 1999."
  },
  {
    id: 'milestone3500',
    name: 'Legen… wait for it…',
    icon: '🌟',
    scoreThreshold: 3500,
    reward: { points: 300 },
    flavorText: "…dary! 3,500 points. Suit up, the bards are already writing about you."
  },
  {
    id: 'milestone5000',
    name: 'All Your Base',
    icon: '👾',
    scoreThreshold: 5000,
    reward: { points: 400 },
    flavorText: "5,000 points. All your base are belong to you. Somebody set up us the bonus!"
  },
];