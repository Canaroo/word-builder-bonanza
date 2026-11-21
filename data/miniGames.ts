// Arcade mini-games (v7.38.0): a secret word opens a quick side game. The intro card shows the name,
// one line of rules and the prize, with Play or Skip. Rules read their numbers from MINI_GAME_VALUES.
import { MINI_GAME_VALUES as M, GATES as G } from '../config/gameplay';
import type { MiniGameId } from '../types';

export interface MiniGameInfo { name: string; icon: string; rules: string; prize: string; /** A quip on the intro card (v7.56). */ flavor?: string }

export const MINI_GAMES: Record<MiniGameId, MiniGameInfo> = {
  pong: {
    name: 'Pong', icon: '🏓',
    rules: `Drag your paddle along the bottom to hit the ball back. Get it past the CPU's paddle to score. First to ${M.pong.toWin} points wins.`,
    prize: `Win: +${M.pong.prize}`,
  },
  mole: {
    name: 'Whac-A-Mole', icon: '🔨',
    rules: `${M.mole.seconds} seconds. Tap the moles as they pop up. Gold moles are worth more.`,
    prize: `+${M.mole.perMole} a mole · gold +${M.mole.goldMole}`,
  },
  claw: {
    name: 'Claw Machine', icon: '🕹️',
    rules: 'Move the claw over a prize (drag, or tap ◀ ▶), then tap ▼ Drop the Claw. The trophy pays big but slips more often.',
    prize: `Plush +${M.claw.plush} · trophy +${M.claw.trophy}`,
  },
  darts: {
    name: 'Darts', icon: '🎯',
    rules: `The green crosshair drifts around the board. Tap 🎯 Throw when it's over the middle: the closer to the bullseye, the more points. ${M.darts.darts} darts.`,
    prize: `Bull +${M.darts.bull} · inner +${M.darts.inner} · outer +${M.darts.outer}`,
  },
  goal: {
    name: 'Penalty Shootout', icon: '⚽',
    rules: `${M.goal.kicks} kicks. Tap a spot in the net to shoot. The keeper dives to one spot: if it's not yours, it's a goal.`,
    prize: `+${M.goal.perGoal} a goal · all ${M.goal.kicks}: +${M.goal.hatTrick}`,
  },
  dice: {
    name: 'Yahtzee-lite', icon: '🎲',
    rules: 'Roll 3 dice. Tap the ones you want to keep, then reroll the rest once. Three of a kind, a straight (three in a row, like 2-3-4) or a pair pays.',
    prize: `Three of a kind +${M.dice.triple} · straight +${M.dice.straight} · pair +${M.dice.pair}`,
  },
  bowl: {
    name: 'Bowling', icon: '🎳',
    rules: 'An arrow swings back and forth. Tap 🎳 Roll when it points straight up: the closer to the middle, the more pins fall. Pins left standing get a second ball.',
    prize: `Strike +${M.bowl.strike} · spare +${M.bowl.spare} · +${M.bowl.perPin} a pin`,
  },
  golf: {
    name: 'Mini Golf', icon: '⛳',
    rules: `A power bar fills and empties. Tap ⛳ Putt when it's in the green band to sink the ball. Miss and you putt again from where it stopped: ${M.golf.strokes} strokes.`,
    prize: `Hole in one +${M.golf.prizes[0]} · 2 strokes +${M.golf.prizes[1]} · 3 +${M.golf.prizes[2]}`,
  },
  password: {
    name: 'The Password Gate', icon: '🔐',
    rules: `The gate is locked. Unscramble the 6-letter password in ${G.password.seconds} seconds. Any real word that uses all six letters opens it.`,
    prize: `Solve +${G.password.solve.toLocaleString()} · with the hint +${G.password.hint} · miss +${G.password.miss}`,
  },
  bonusStage: {
    name: 'Bonus Stage', icon: '🌟',
    rules: `Your clock is paused. ${G.bonusStage.seconds} seconds with a fresh ${G.bonusStage.handSize}-tile hand. Every word gets +${G.bonusStage.perLetter} a letter, then scores x${G.bonusStage.multiplier} (your charms count).`,
    prize: 'Every point you score is yours to keep',
  },
  hoops: {
    name: 'Free Throws', icon: '🏀',
    rules: `${M.hoops.shots} shots. A white line slides along the bar: tap 🏀 Shoot when it's in the green for a swish. The yellow banks it in off the glass.`,
    prize: `Swish +${M.hoops.swish} · off the glass +${M.hoops.bank} · all swishes +${M.hoops.perfect}`,
  },
  // v7.46.0
  ringToss: {
    name: 'Ring Toss', icon: '🎪',
    rules: `A ring drifts around the bottle. Tap 🎪 Toss when it's right over the bottle: the closer, the more it pays. ${M.ringToss.rings} rings.`,
    prize: `Ringer +${M.ringToss.ringer} · on the rim +${M.ringToss.rim} · close +${M.ringToss.near}`,
  },
  riff: {
    name: 'Repeat the Riff', icon: '🎸',
    rules: `Watch the pads light up, then play the riff back. Riffs grow from ${M.riff.lengths[0]} to ${M.riff.lengths[M.riff.lengths.length - 1]} notes. One wrong note ends it.`,
    prize: `+${M.riff.perRiff} a riff · all ${M.riff.lengths.length} +${M.riff.allBonus} more`,
  },
  striker: {
    name: 'High Striker', icon: '🔨',
    rules: `A white line climbs and drops on the thin meter. Tap 🔨 Swing when it's at the top, in the green, to ring the bell. ${M.striker.swings} swings.`,
    prize: `Bell +${M.striker.bell} · close +${M.striker.close} · low +${M.striker.low} · ${M.striker.swings} bells +${M.striker.allBells} more`,
  },
  pitStop: {
    name: 'Pit Stop', icon: '🏎️',
    rules: `Change all ${M.pitStop.tires} tires: tap each one ${M.pitStop.taps} times. The clock starts on your first tap.`,
    prize: `Under ${M.pitStop.tiers[0].under} sec +${M.pitStop.tiers[0].points} · under ${M.pitStop.tiers[1].under} +${M.pitStop.tiers[1].points} · under ${M.pitStop.tiers[2].under} +${M.pitStop.tiers[2].points} · slower +${M.pitStop.slow}`,
  },
  coaster: {
    name: 'Loop the Loop', icon: '🎢',
    rules: `Hold the button to build speed: a marker slides along the speed bar. Let go while it's in the green for a clean loop (yellow is wobbly). Let go too early and you stall; hold into the red and you fly off. ${M.coaster.rides} rides.`,
    prize: `Clean +${M.coaster.clean} · wobbly +${M.coaster.wobbly} · all clean +${M.coaster.allClean} more`,
  },
  seal: {
    name: 'Balance Act', icon: '🦭',
    rules: `Keep the ball on the seal's nose for ${M.seal.seconds} seconds. It keeps rolling off: tap ◀ or ▶ to push it back toward the middle.`,
    prize: `+${M.seal.perSecond} a second · all ${M.seal.seconds} +${M.seal.fullBonus} more`,
  },
  monte: {
    name: 'Find the Lady', icon: '🃏',
    rules: `Watch the queen, then pick her out after the shuffle. ${M.monte.rounds} rounds, each one faster.`,
    prize: `+${M.monte.perFind} a find · all ${M.monte.rounds} +${M.monte.allBonus} more`,
  },
  // v7.56.0
  lure: {
    name: "Gone Fishin'", icon: '🎣',
    rules: `${M.lure.casts} casts. Wait for the bobber to dip, then tap fast. The quicker the tap, the bigger the fish. Tap too soon and it swims off.`,
    prize: `Whopper +${M.lure.whopper} · keeper +${M.lure.keeper} · minnow +${M.lure.minnow} · ${M.lure.casts} whoppers +${M.lure.allWhoppers} more`,
    flavor: "We're gonna need a bigger boat.",
  },
  dial: {
    name: 'Safecracker', icon: '🔓',
    rules: `The safe has ${M.dial.numbers} secret numbers. Turn the dial (drag it, or tap ◀ ▶). The middle of the dial turns green as you get close, and says ON IT when you're there: tap 🔓 SET. Then hunt the next number. Find all ${M.dial.numbers} in ${M.dial.seconds} seconds.`,
    prize: `+${M.dial.perNumber} a number · cracked +${M.dial.cracked} more`,
    flavor: 'I love it when a plan comes together.',
  },
  wire: {
    name: 'Cut the Wire', icon: '💣',
    rules: `${M.wire.bombs} bombs, ${M.wire.seconds} seconds each. Read the bomb manual and tap the one wire it tells you to cut (left and right as you look at the bomb). Each bomb gets trickier.`,
    prize: `+${M.wire.perBomb} a bomb · all ${M.wire.bombs} +${M.wire.allBonus} more`,
    flavor: 'Red wire or blue wire? MacGyver would know.',
  },
  nest: {
    name: 'Egg Drop', icon: '🥚',
    rules: `Drag left and right to slide the nest and catch falling eggs for ${M.nest.seconds} seconds. Golden eggs pay more; dodge the rotten ones (🤢), they cost points.`,
    prize: `+${M.nest.perEgg} an egg · golden +${M.nest.golden} · rotten -${M.nest.rotten}`,
    flavor: 'Eggs-cellent.',
  },
  leap: {
    name: 'Road Hop', icon: '🐸',
    rules: `Tap ⬆ HOP to move the frog up one lane. Wait for a gap in the cars: get hit and you're back on the curb. Cross all ${M.leap.lanes} lanes in ${M.leap.seconds} seconds.`,
    prize: `+${M.leap.perLane} a lane · across +${M.leap.home} more`,
    flavor: "It's not easy being green.",
  },
  // v7.64.0
  math: {
    name: 'Mathletes', icon: '🧮',
    rules: `${M.math.seconds} seconds. Tap the right answer to as many problems as you can. Right answers in a row pay more; a wrong one just resets the streak.`,
    prize: `+${M.math.perRight} a right answer, +${M.math.streakStep} more for each one in a row (5 in a row: +${[1, 2, 3, 4, 5].reduce((t, k) => t + M.math.perRight + M.math.streakStep * (k - 1), 0)})`,
    flavor: 'The limit does not exist!',
  },
  ladder: {
    name: 'The Word Ladder', icon: '🪜',
    rules: `Climb rungs of ${G.ladder.rungs.join(', ')}+ letters, ${G.ladder.secondsPerRung} seconds each. Every rung doubles the pot. Bank it whenever you like; miss a rung and the pot is gone.`,
    prize: `Pot ${G.ladder.pots.map(p => p.toLocaleString()).join(' → ')}`,
  },
  bigOne: {
    name: 'The Big One', icon: '💎',
    rules: `This hand hides an 8-letter word. You have ${G.bigOne.seconds} seconds: find the longest word you can. Reaching this gate earns the 💎 70K Club badge for good.`,
    prize: `8 letters +${G.bigOne.prizes[8].toLocaleString()} · 7 +${G.bigOne.prizes[7].toLocaleString()} · 6 +${G.bigOne.prizes[6].toLocaleString()}`,
  },
};
