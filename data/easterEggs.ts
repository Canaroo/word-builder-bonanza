import { EasterEgg } from '../types';

export const EASTER_EGGS: EasterEgg[] = [
  {
    id: 'niceNumber',
    name: '😏 The Nice Number',
    description: "Your score ends in 69? Whoa, that's our number! Be excellent to yourself with this free shuffle.",
    trigger: (word, score) => score > 0 && score % 100 === 69,
    reward: { shuffle: 1, message: "Your total score ended in 69! Whoa! Be excellent to yourself with this free shuffle." },
  },
  {
    id: 'theGoat',
    name: '🐐 The GOAT',
    description: 'Score includes 23 → +100 bonus.',
    trigger: (word, score) => String(score).includes('23'),
    reward: { points: 100, message: 'Your total score contains 23! The GOAT would be proud.'}
  },
  {
    id: 'theAnswer',
    name: '🧠 The Answer',
    description: 'Score includes 42 → +300 bonus.',
    trigger: (word, score) => String(score).includes('42'),
    reward: { points: 300, message: 'Your total score contains 42! All meaning, no towel required.'}
  },
  {
    id: 'squidGame',
    name: '🦑 Squid Game',
    description: 'Score = 456 → +1,000 bonus.',
    trigger: (word, score) => score === 456,
    reward: { points: 1000, message: 'Your total score is exactly 456! No red light. Just green points.'}
  },
  {
    id: 'announcersFavorite',
    name: '🎙️ Announcer’s Favorite',
    description: 'Score = 2763 → +1,000 bonus.',
    trigger: (word, score) => score === 2763,
    reward: { points: 1000, message: 'Your total score is exactly 2763! It’s everywhere in BFDI — and now it’s here too.' },
  },
  {
    id: 'sex',
    name: '👠 “And Just Like That...”',
    description: 'Submit the word “SEX”',
    trigger: (word, score) => word.toUpperCase() === 'SEX',
    reward: { points: 69, message: 'You typed ‘sex.’ Carrie would’ve written a column about it.' },
  },
  {
    id: 'poop',
    name: '💩 “Toilet Humor Unlocked”',
    description: 'Submit the word “POOP”',
    trigger: (word, score) => word.toUpperCase() === 'POOP',
    reward: { points: 33, message: 'Poop. Classic. Never gets old.' },
  },
  {
    id: 'kermitWisdom',
    name: "🐸 “Kermit's Wisdom”",
    description: 'When you submit the word "TEA".',
    trigger: (word) => word.toUpperCase() === 'TEA',
    reward: { points: 50, message: "But that's none of my business." },
  },
  {
    id: 'homersDelight',
    name: '🍩 “Homer\'s Delight”',
    description: 'When you submit the word "DONUT".',
    trigger: (word) => word.toUpperCase() === 'DONUT',
    reward: { points: 74, message: "Mmm, donuts. You just can't resist, can you?" },
  },
  {
    id: 'dundieAward',
    name: '🏢 “The Dundie Award” 🏆',
    description: 'When you submit the word "OFFICE".',
    trigger: (word) => word.toUpperCase() === 'OFFICE',
    reward: { points: 95, message: "Congratulations! You just won a Dundie for best word submitted." },
  },
  {
    id: 'dangerousAlone',
    name: '⚔️ “It\'s Dangerous to Go Alone!” 🛡️',
    description: 'When you submit the word "SWORD".',
    trigger: (word) => word.toUpperCase() === 'SWORD',
    reward: { points: 86, message: "Here, take this! You've found a legendary bonus." },
  },
  {
    id: 'totallyBuggin',
    name: "💅 “Totally Buggin'!” 💖",
    description: 'When you submit the word "FETCH".',
    trigger: (word) => word.toUpperCase() === 'FETCH',
    reward: { points: 90, message: "Stop trying to make 'fetch' happen! It's not going to happen... unless you get these bonus points!" },
  },
  {
    id: 'loveBonus',
    name: '❤️ “All You Need Is Bonus” 🎶',
    description: 'When you submit the word "LOVE".',
    trigger: (word) => word.toUpperCase() === 'LOVE',
    reward: { points: 88, message: 'All you need is LOVE… and a handful of extra points!' },
  },
  {
    id: 'timeBonus',
    name: '⌛ “Great Scott!” ⚡',
    description: 'When you submit the word "TIME".',
    trigger: (word) => word.toUpperCase() === 'TIME',
    reward: { points: 121, message: 'Roads? Where we’re going, we don’t need roads.' },
  },
  {
    id: 'dieBonus',
    name: '🎄 “Yippee-Ki-Yay!” 💥',
    description: 'When you submit the word "DIE".',
    trigger: (word) => word.toUpperCase() === 'DIE',
    reward: { points: 94, message: 'Welcome to the party, pal!' },
  },
  {
    id: 'joyBonus',
    name: '🌈 “Headquarters High-Five” 😀',
    description: 'When you submit the word "JOY".',
    trigger: (word) => word.toUpperCase() === 'JOY',
    reward: { points: 77, message: 'Joy’s at the console—time to crank happiness up to eleven!' },
  },
  {
    id: 'chandlerBing',
    name: '🤔 Could I BE any more excited?',
    description: 'When you submit the word "BING".',
    trigger: (word) => word.toUpperCase() === 'BING',
    reward: { points: 97, message: "Could you BE any more clever? You just earned some bonus points!" },
  },
  {
    id: 'deadPoetsSociety',
    name: '🍎 “Oh Captain! My Captain!” 📚',
    description: 'When you submit the word "POET".',
    trigger: (word) => word.toUpperCase() === 'POET',
    reward: { points: 89, message: "Carpe Diem! Seize the day... and these bonus points!" },
  },
  {
    id: 'terminator',
    name: '🕶️ “I’ll be back.”',
    description: 'When you submit the word "TERM"',
    trigger: (word) => word.toUpperCase() === 'TERM',
    reward: { points: 89, message: 'You just triggered a Terminator-class bonus. Hasta la vista, score gap.' },
  },
  {
    id: 'spiderman',
    name: '🕷 “With great power comes great responsibility.”',
    description: 'When you submit the word "PARK"',
    trigger: (word) => word.toUpperCase() === 'PARK',
    reward: { points: 90, message: 'Peter would be proud. You just web-slinged your way to bonus points!' },
  },
];
