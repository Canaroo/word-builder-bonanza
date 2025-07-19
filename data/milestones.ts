
import { Milestone } from '../types';

export const MILESTONES_LIST: Milestone[] = [
  {
    id: 'milestone500',
    name: 'Five Hundo Club',
    icon: '🎉',
    scoreThreshold: 500,
    reward: { points: 100 },
    configChange: { timerDuration: 45 },
    flavorText: "You're in the club. No jackets — just faster gameplay."
  },
  {
    id: 'milestone1000',
    name: 'Half-Time Hustle',
    icon: '🔥',
    scoreThreshold: 1000,
    reward: { points: 150 },
    configChange: { timerDuration: 30 },
    flavorText: "Things just got serious. No more small talk."
  },
  {
    id: 'milestone2000',
    name: 'Grand Master',
    icon: '💼',
    scoreThreshold: 2000,
    reward: { points: 200 },
    configChange: { timerDuration: 15 },
    flavorText: "Welcome to the elite tier. Your vocabulary now pays rent."
  },
  {
    id: 'milestone3500',
    name: 'Legendary',
    icon: '🌟',
    scoreThreshold: 3500,
    reward: { points: 300 },
    configChange: { timerDuration: 10 },
    flavorText: "Blink, and you’ll miss your shot."
  },
  {
    id: 'milestone5000',
    name: 'Supreme',
    icon: '👑',
    scoreThreshold: 5000,
    reward: { points: 400 },
    configChange: { timerDuration: 8 },
    flavorText: "You’ve become GODLIKE. Every word now feels like sudden death."
  },
];