

import { PowerPlay, GameState } from '../types';

// The 'activate' function is for declaring the state change that should happen upon activation.
// The actual logic is handled in the GameScreen reducer based on the power play's `effectType` and ID.

export const POWER_PLAYS_LIST: PowerPlay[] = [
  { 
    id: 'timeBoost', 
    name: 'Time Boost', 
    description: 'Add 15 seconds to your timer.', 
    flavorText: 'Sometimes, all you need is a little more time on the clock.',
    icon: '⏳',
    effectType: 'immediate',
    activate: (gameState) => ({...gameState}) // Handled directly in reducer due to affecting screen state
  },
  { 
    id: 'letterUpgrade', 
    name: 'Letter Upgrade', 
    description: 'Pick a letter — all tiles of that letter are now worth 2x for the rest of the run.', 
    flavorText: 'Choose wisely. Your alphabet just got an MVP.',
    icon: '🔠',
    effectType: 'selection',
    selectionType: 'letter',
    activate: (gameState, options) => {
        if (options?.letter) {
            const newMultipliers = {...gameState.letterMultipliers};
            const currentMultiplier = newMultipliers[options.letter] || 1;
            newMultipliers[options.letter] = currentMultiplier * 2;
            const instanceId = `letterUpgrade_${options.letter}`;

            const buff = {
                ...POWER_PLAYS_LIST.find(p => p.id === 'letterUpgrade')!,
                instanceId,
                description: `All '${options.letter}' tiles are now worth ${newMultipliers[options.letter]}x`
            };
            
            const newActiveBuffs = gameState.activeBuffs.filter(b => b.instanceId !== instanceId);
            newActiveBuffs.push(buff);

            return { letterMultipliers: newMultipliers, activeBuffs: newActiveBuffs };
        }
        return {};
    }
  },
  { 
    id: 'polish', 
    name: 'Polish', 
    description: 'Pick a letter — words containing it now score 2x.', 
    flavorText: 'Give your favorite letter the spotlight treatment.',
    icon: '🎯',
    effectType: 'selection',
    selectionType: 'letter',
    activate: (gameState, options) => {
        if (options?.letter) {
            const newMultipliers = {...gameState.wordMultipliersByLetter};
            const currentMultiplier = newMultipliers[options.letter] || 1;
            newMultipliers[options.letter] = currentMultiplier * 2;
            const instanceId = `polish_${options.letter}`;

            const buff = {
                ...POWER_PLAYS_LIST.find(p => p.id === 'polish')!,
                instanceId,
                description: `Words with '${options.letter}' now score ${newMultipliers[options.letter]}x`
            };
            
            const newActiveBuffs = gameState.activeBuffs.filter(b => b.instanceId !== instanceId);
            newActiveBuffs.push(buff);

            return { wordMultipliersByLetter: newMultipliers, activeBuffs: newActiveBuffs };
        }
        return {};
    }
  },
  { 
    id: 'biglyScore', 
    name: 'Bigly Score', 
    description: 'Your next word scores 4x.', 
    flavorText: 'Huge. Tremendous. The biggest word play you’ve ever seen.',
    icon: '📢',
    effectType: 'next_word',
    activate: (gameState) => {
        const powerPlay = POWER_PLAYS_LIST.find(p => p.id === 'biglyScore')!;
        return { 
            activePowerPlays: { ...gameState.activePowerPlays, biglyScore: true },
            activeBuffs: [...gameState.activeBuffs, powerPlay]
        };
    }
  },
  { 
    id: 'strikeShield', 
    name: 'Strike Shield', 
    description: 'Block the next strike.', 
    flavorText: 'When danger comes, your shield holds.',
    icon: '🛡️',
    effectType: 'passive',
    activate: (gameState) => {
      const powerPlay = POWER_PLAYS_LIST.find(p => p.id === 'strikeShield')!;
      return { activePowerPlays: { ...gameState.activePowerPlays, strikeShield: true }, activeBuffs: [...gameState.activeBuffs, powerPlay] };
    }
  },
   { 
    id: 'swapOut', 
    name: 'Swap Out', 
    description: 'Replace 2 tiles of your choice with new random ones.', 
    flavorText: 'Fresh tiles, fresh hope.',
    icon: '♻️',
    effectType: 'selection',
    selectionType: 'tile_swap',
    swapConfig: { min: 2, max: 2 },
    activate: (gameState) => ({...gameState}) // Logic is handled in the reducer
  },
   { 
    id: 'wordLock', 
    name: 'Word Lock', 
    description: 'Submit any 5-letter-or-less word — real or not.', 
    flavorText: 'Break the rules... just this once.',
    icon: '🚫',
    effectType: 'next_word',
    activate: (gameState) => {
      const powerPlay = POWER_PLAYS_LIST.find(p => p.id === 'wordLock')!;
      return { 
          activePowerPlays: { ...gameState.activePowerPlays, wordLock: true },
          activeBuffs: [...gameState.activeBuffs, powerPlay]
      };
    }
  },
  { 
    id: 'philsosophy', 
    name: 'Phil’s-osophy', 
    description: 'Every word: 20% chance for +20, 10% chance for -10, 70% nothing.', 
    flavorText: 'Life’s a coin flip. Phil wouldn’t have it any other way.',
    icon: '🎲',
    effectType: 'passive',
    activate: (gameState) => {
      const powerPlay = POWER_PLAYS_LIST.find(p => p.id === 'philsosophy')!;
      return { activePowerPlays: { ...gameState.activePowerPlays, philsosophy: true }, activeBuffs: [...gameState.activeBuffs, powerPlay] };
    }
  },
  { 
    id: 'plotArmor', 
    name: 'Plot Armor', 
    description: 'With this active, instead of getting a strike, you will lose 150 points. This is a one time use power.', 
    flavorText: 'It’s not a fail. It’s... character development.',
    icon: '💸',
    effectType: 'passive',
    activate: (gameState) => {
      const powerPlay = POWER_PLAYS_LIST.find(p => p.id === 'plotArmor')!;
      return { activePowerPlays: { ...gameState.activePowerPlays, plotArmor: true }, activeBuffs: [...gameState.activeBuffs, powerPlay] };
    }
  },
  { 
    id: 'multiverseOfSadness', 
    name: 'Multiverse of Sadness', 
    description: 'Next word: half points, half becomes bonus time.', 
    flavorText: 'Every choice creates a new timeline. Some are kinder than others.',
    icon: '🌀',
    effectType: 'next_word',
    activate: (gameState) => {
      const powerPlay = POWER_PLAYS_LIST.find(p => p.id === 'multiverseOfSadness')!;
      return { 
          activePowerPlays: { ...gameState.activePowerPlays, multiverseOfSadness: true },
          activeBuffs: [...gameState.activeBuffs, powerPlay]
      };
    }
  },
  { 
    id: 'nuclearOption', 
    name: 'Nuclear Option', 
    description: 'Replace your whole hand. Next word scores 4x.', 
    flavorText: 'Wipe the slate. Launch the word.',
    icon: '☢️',
    effectType: 'selection',
    activate: (gameState) => {
      const powerPlay = POWER_PLAYS_LIST.find(p => p.id === 'nuclearOption')!;
      return { 
          activePowerPlays: { ...gameState.activePowerPlays, nuclearOption: true },
          activeBuffs: [...gameState.activeBuffs, powerPlay]
      };
    }
  },
  { 
    id: 'sonicSpeed', 
    name: 'Sonic Speed', 
    description: 'First word: 8s timer, 2x score. Next: 7s, 4x score.', 
    flavorText: 'Gotta go fast — but think faster.',
    icon: '💨',
    effectType: 'passive',
    activate: (gameState) => {
      const powerPlay = POWER_PLAYS_LIST.find(p => p.id === 'sonicSpeed')!;
      return { activePowerPlays: { ...gameState.activePowerPlays, sonicSpeed: { count: 2 } }, activeBuffs: [...gameState.activeBuffs, powerPlay] };
    }
  },
  { 
    id: 'echoesOfThePast', 
    name: 'Echoes of the Past', 
    description: 'Instantly replay your highest-scoring word for its original value.', 
    flavorText: 'History repeats. So does your score.',
    icon: '🔁',
    effectType: 'immediate',
    activate: (gameState) => {
        if (!gameState.highestScoringWord) return {};
        const bonus = gameState.highestScoringWord.score;
        return { score: gameState.score + bonus };
    }
  },
  { 
    id: 'rewind', 
    name: 'Rewind', 
    description: 'Remove your last strike and gain 10 seconds.', 
    flavorText: 'Backspace for real life.',
    icon: '⏪',
    effectType: 'immediate',
    activate: (gameState) => ({
      strikes: Math.max(0, gameState.strikes - 1),
    })
  },
  { 
    id: 'fluncleIsProud', 
    name: 'Fluncle is Proud', 
    description: 'You gain 300 points. No explanation needed.', 
    flavorText: 'Fluncle approves this chaos.',
    icon: '🧓',
    effectType: 'immediate',
    activate: (gameState) => ({ score: gameState.score + 300 })
  },
  { 
    id: 'fortunesFavor', 
    name: 'Fortune\'s Favor', 
    description: 'Shake the magic eight ball: 40% chance to lose 200 points, 50% chance to gain 250 points, or 10% chance to gain 500 points.',
    flavorText: 'A gamble for the bold.',
    icon: '🎱',
    effectType: 'immediate',
    activate: (gameState) => {
        const rand = Math.random();
        let scoreChange = 0;
        let message = '';

        if (rand < 0.40) {
            scoreChange = -200;
            message = '🎱 Fortune is not in your favor... -200 points.';
        } else if (rand < 0.90) {
            scoreChange = 250;
            message = '🎱 Signs point to yes! +250 points.';
        } else {
            scoreChange = 500;
            message = '🎱 It is certain! +500 points!';
        }
        
        const newScore = Math.max(0, gameState.score + scoreChange);
        
        return { 
            score: newScore,
            lastPowerPlayResult: { message, scoreChange }
        };
    }
  },
  { 
    id: 'timeTurner', 
    name: 'Time Turner', 
    description: 'Your next 2 rounds will have 30 seconds added to them.',
    flavorText: '“Like Hermione in third year, you\'ve got time to do it all—twice.”',
    icon: '⌛',
    effectType: 'passive',
    activate: (gameState) => {
      const powerPlay = POWER_PLAYS_LIST.find(p => p.id === 'timeTurner')!;
      return { 
        activePowerPlays: { ...gameState.activePowerPlays, timeTurner: { rounds: 2 } }, 
        activeBuffs: [...gameState.activeBuffs, powerPlay] 
      };
    }
  },
  { 
    id: 'schruteBucks', 
    name: 'Schrute Bucks', 
    description: 'Instant +250 points; your very next word is forced to score exactly 1 point.', 
    flavorText: 'Dwight showers you with 250 Schrute Bucks (1 Buck = 1 point). Enjoy the boost, then brace yourself—whatever word you play next will be capped at a single point.',
    icon: '💵',
    effectType: 'immediate',
    activate: (gameState) => {
      const powerPlay = POWER_PLAYS_LIST.find(p => p.id === 'schruteBucks')!;
      return { 
          score: gameState.score + 250,
          activePowerPlays: { ...gameState.activePowerPlays, schruteBucks: true },
          activeBuffs: [...gameState.activeBuffs, powerPlay]
      };
    }
  },
  { 
    id: 'redWedding', 
    name: 'Red Wedding', 
    description: 'With a full hand of 10 tiles, sacrifice 2 random tiles now; your very next word earns 5× its normal score.', 
    flavorText: 'When your hand is full (10 tiles), make the ultimate sacrifice. Two letters meet an untimely end—no replacements until after you play—yet vengeance is sweet: your next word scores five times its usual value.',
    icon: '🏰',
    effectType: 'selection',
    activate: (gameState) => {
      const powerPlay = POWER_PLAYS_LIST.find(p => p.id === 'redWedding')!;
      return { 
          activePowerPlays: { ...gameState.activePowerPlays, redWedding: true },
          activeBuffs: [...gameState.activeBuffs, powerPlay]
      };
    }
  },
    {
    id: 'mutationProtocol',
    name: 'Mutation Protocol',
    description: 'For the next 5 rounds, each tile you receive has a 25% chance of becoming a Super Tile worth 4× its base value.',
    flavorText: 'Your tiles are evolving. Some faster... some stronger. Embrace the anomaly.',
    icon: '🧬',
    effectType: 'passive',
    activate: (gameState) => {
      const powerPlay = POWER_PLAYS_LIST.find(p => p.id === 'mutationProtocol')!;
      return { 
        activePowerPlays: { ...gameState.activePowerPlays, mutationProtocol: { rounds: 5 } }, 
        activeBuffs: [...gameState.activeBuffs, powerPlay] 
      };
    }
  },
  { 
    id: 'wakandaForever', 
    name: 'Wakanda Forever', 
    description: 'For one word, every tile in your hand is worth at least 5 points.', 
    flavorText: 'Even the humblest vowel gains Vibranium strength. Activate, build your word, and watch each letter’s value jump to a minimum of five.',
    icon: '🐾',
    effectType: 'next_word',
    activate: (gameState) => {
      const powerPlay = POWER_PLAYS_LIST.find(p => p.id === 'wakandaForever')!;
      return { 
          activePowerPlays: { ...gameState.activePowerPlays, wakandaForever: true },
          activeBuffs: [...gameState.activeBuffs, powerPlay]
      };
    }
  },
  { 
    id: 'neosChoice', 
    name: 'Neo\'s Choice', 
    description: 'Pick one: Freeze time for 10s or erase a strike.', 
    flavorText: 'Blue pill pauses the countdown for ten seconds; red pill deletes one strike from your record. Choose wisely—only one effect may be claimed.',
    icon: '💊',
    effectType: 'selection',
    selectionType: 'custom',
    activate: (gameState) => ({...gameState})
  },
  { 
    id: 'thanosGift', 
    name: 'Gift From Thanos', 
    description: 'Snap once: Sacrifice your next word’s score for 100 points.', 
    flavorText: 'Balance restored. But not without cost.',
    icon: '🫰',
    effectType: 'next_word',
    activate: (gameState) => {
      const powerPlay = POWER_PLAYS_LIST.find(p => p.id === 'thanosGift')!;
      return { 
          score: gameState.score + 100,
          activePowerPlays: { ...gameState.activePowerPlays, thanosGift: true },
          activeBuffs: [...gameState.activeBuffs, powerPlay]
      };
    }
  },
  { 
    id: 'heisenberg', 
    name: 'Heisenberg', 
    description: 'Next word is triple score or zero—50% chance.', 
    flavorText: 'Say his name and roll the dice: your upcoming word is either tripled or wiped to zero (no strike if it lands on zero).',
    icon: '⚗️',
    effectType: 'next_word',
    activate: (gameState) => {
      const powerPlay = POWER_PLAYS_LIST.find(p => p.id === 'heisenberg')!;
      return { 
          activePowerPlays: { ...gameState.activePowerPlays, heisenberg: true },
          activeBuffs: [...gameState.activeBuffs, powerPlay]
      };
    }
  },
  { 
    id: 'skywalkerBloodline', 
    name: 'Skywalker Bloodline', 
    description: 'All “S” tiles in your current hand jump to 15 points this round.', 
    flavorText: 'Feel the Force course through every serpentine letter—those S’s pack Sith-level power for a single turn.',
    icon: '⚔️',
    effectType: 'next_word',
    activate: (gameState) => {
      const powerPlay = POWER_PLAYS_LIST.find(p => p.id === 'skywalkerBloodline')!;
      return { 
          activePowerPlays: { ...gameState.activePowerPlays, skywalkerBloodline: true },
          activeBuffs: [...gameState.activeBuffs, powerPlay]
      };
    }
  },
  { 
    id: 'hookshot', 
    name: 'Hookshot', 
    description: 'Duplicate one chosen letter—pull a twin into your hand.', 
    flavorText: 'Fire the Hookshot to snag a perfect copy of any tile you already hold. The original stays; the duplicate joins your hand for this round only, giving you an extra letter to play with.',
    icon: '🪝',
    effectType: 'selection',
    selectionType: 'custom',
    activate: (gameState) => ({...gameState})
  },
  { 
    id: 'leafOnTheWind', 
    name: 'Leaf on the Wind', 
    description: 'No timer for your next turn. Plan at your own pace.', 
    flavorText: 'You’re weightless—compose your upcoming word with zero time pressure. After submission, the normal countdown returns.',
    icon: '🍃',
    effectType: 'immediate',
    activate: (gameState) => {
      const powerPlay = POWER_PLAYS_LIST.find(p => p.id === 'leafOnTheWind')!;
      return { 
          activePowerPlays: { ...gameState.activePowerPlays, leafOnTheWind: true },
          activeBuffs: [...gameState.activeBuffs, powerPlay]
      };
    }
  },
  {
    id: 'yoshisWildRide',
    name: "Yoshi's Wild Ride",
    description: "Replace up to 3 individual tiles of your choice, no shuffle penalty.",
    flavorText: "Spit out your tiles and swallow new ones!",
    icon: '🦖',
    effectType: 'selection',
    selectionType: 'tile_swap',
    swapConfig: { min: 1, max: 3 },
    activate: (gameState) => ({...gameState})
  },
  {
    id: 'bobKelso',
    name: "Bob Kelso",
    description: "Instantly score 100 points and reshuffles your hand for free.",
    flavorText: "What has two thumbs and doesn’t give a crap? Bob Kelso. Nice to meet you.",
    icon: '👨‍⚕️',
    effectType: 'immediate',
    activate: (gameState) => ({ score: gameState.score + 100 })
  },
  {
    id: 'gumpLuck',
    name: "Gump Luck",
    description: "25% chance 10s added to timer. 25% chance +20 to score. 25% chance +1 shuffle. 25% chance you earn a strike.",
    flavorText: "Life is like a box of chocolates. You never know what you're gonna get.",
    icon: '🍫',
    effectType: 'immediate',
    activate: (gameState) => ({...gameState}) // Handled in GameScreen
  },
];