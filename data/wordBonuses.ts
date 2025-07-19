import { WordBonus } from '../types';

export const WORD_BONUSES: WordBonus[] = [
  {
    id: 'fiftyWords',
    title: 'Fifty Shades of Wordplay',
    description: "You’ve submitted 50 words. We’re not judging… but Grammarly might be.\n+100 bonus points for your provocative prose.",
    wordCount: 50,
    reward: { points: 100 },
  },
  {
    id: 'oneHundredWords',
    title: 'The Wordfather',
    description: "“You come to me... on the day of your 100th word…”\nYou didn’t just play the game. You made it an offer it couldn’t refuse.\n+100 bonus points for your ruthless vocabulary empire.",
    wordCount: 100,
    reward: { points: 100 },
  },
  {
    id: 'oneTwoThreeWords',
    title: '🎶 "ABC, Easy as 123!" 🎵',
    description: "“You've submitted 123 words! Looks like you've mastered the ABCs of our game.”\nYou're singing a sweet tune with your vocabulary. Don't stop till you get enough!\n+123 bonus points for your perfectly harmonious wordplay.",
    wordCount: 123,
    reward: { points: 123 },
  },
];
