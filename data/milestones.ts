
import { Milestone } from '../types';

// Score milestones award one-time bonus points. They don't touch the clock (see config/gameplay.ts).
export const MILESTONES_LIST: Milestone[] = [
  {
    id: 'milestone500',
    name: 'Five Hundo Club',
    icon: '🎉',
    scoreThreshold: 500,
    reward: { points: 100 },
    flavorText: "You're in the club. No jackets — just bonus points."
  },
  {
    id: 'milestone1000',
    name: 'Half-Time Hustle',
    icon: '🔥',
    scoreThreshold: 1000,
    reward: { points: 150 },
    flavorText: "Halfway to legend. Keep the hustle going."
  },
  {
    id: 'milestone2000',
    name: 'Grand Master',
    icon: '💼',
    scoreThreshold: 2000,
    reward: { points: 200 },
    flavorText: "Welcome to the elite tier. Your vocabulary now pays rent."
  },
  {
    id: 'milestone3500',
    name: 'Legendary',
    icon: '🌟',
    scoreThreshold: 3500,
    reward: { points: 300 },
    flavorText: "Bards will sing of this vocabulary."
  },
  {
    id: 'milestone5000',
    name: 'Supreme',
    icon: '👑',
    scoreThreshold: 5000,
    reward: { points: 400 },
    flavorText: "You’ve become GODLIKE. Words bow before you."
  },
];