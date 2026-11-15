// Arcade mini-games (v7.38.0): a secret word opens a quick side game. The intro card shows the name,
// one line of rules and the prize, with Play or Skip. Rules read their numbers from MINI_GAME_VALUES.
import { MINI_GAME_VALUES as M, GATES as G } from '../config/gameplay';
import type { MiniGameId } from '../types';

export interface MiniGameInfo { name: string; icon: string; rules: string; prize: string }

export const MINI_GAMES: Record<MiniGameId, MiniGameInfo> = {
  pong: {
    name: 'Pong', icon: '🏓',
    rules: `Drag your paddle along the bottom. First to ${M.pong.toWin} points beats the CPU.`,
    prize: `Win: +${M.pong.prize}`,
  },
  mole: {
    name: 'Whac-A-Mole', icon: '🔨',
    rules: `${M.mole.seconds} seconds. Tap the moles as they pop up. Gold moles are worth more.`,
    prize: `+${M.mole.perMole} a mole · gold +${M.mole.goldMole}`,
  },
  claw: {
    name: 'Claw Machine', icon: '🕹️',
    rules: 'Slide the claw over a prize and drop it. The trophy pays big but slips more often.',
    prize: `Plush +${M.claw.plush} · trophy +${M.claw.trophy}`,
  },
  darts: {
    name: 'Darts', icon: '🎯',
    rules: `The crosshair drifts around the board. Tap to throw. ${M.darts.darts} darts.`,
    prize: `Bull +${M.darts.bull} · inner +${M.darts.inner} · outer +${M.darts.outer}`,
  },
  goal: {
    name: 'Penalty Shootout', icon: '⚽',
    rules: `${M.goal.kicks} kicks. Pick a spot in the net; the keeper dives one way.`,
    prize: `+${M.goal.perGoal} a goal · all ${M.goal.kicks}: +${M.goal.hatTrick}`,
  },
  dice: {
    name: 'Yahtzee-lite', icon: '🎲',
    rules: 'Roll 3 dice. Tap any to keep, then reroll the rest once.',
    prize: `Three of a kind +${M.dice.triple} · straight +${M.dice.straight} · pair +${M.dice.pair}`,
  },
  bowl: {
    name: 'Bowling', icon: '🎳',
    rules: 'The arrow swings. Tap to roll; the closer to center, the more pins fall. One spare ball.',
    prize: `Strike +${M.bowl.strike} · spare +${M.bowl.spare} · +${M.bowl.perPin} a pin`,
  },
  golf: {
    name: 'Mini Golf', icon: '⛳',
    rules: `Tap to stop the power meter. Sink it in ${M.golf.strokes} strokes or fewer.`,
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
    rules: `${M.hoops.shots} shots. Tap when the meter hits the middle.`,
    prize: `Swish +${M.hoops.swish} · off the glass +${M.hoops.bank} · all swishes +${M.hoops.perfect}`,
  },
  // v7.46.0
  ringToss: {
    name: 'Ring Toss', icon: '🎪',
    rules: `A ring drifts over the bottle. Tap to toss. ${M.ringToss.rings} rings.`,
    prize: `Ringer +${M.ringToss.ringer} · on the rim +${M.ringToss.rim} · close +${M.ringToss.near}`,
  },
  riff: {
    name: 'Repeat the Riff', icon: '🎸',
    rules: `Watch the pads light up, then play the riff back. Riffs grow from ${M.riff.lengths[0]} to ${M.riff.lengths[M.riff.lengths.length - 1]} notes. One wrong note ends it.`,
    prize: `+${M.riff.perRiff} a riff · all ${M.riff.lengths.length} +${M.riff.allBonus} more`,
  },
  striker: {
    name: 'High Striker', icon: '🔨',
    rules: `The power meter swings. Tap at the top to ring the bell. ${M.striker.swings} swings.`,
    prize: `Bell +${M.striker.bell} · close +${M.striker.close} · low +${M.striker.low} · ${M.striker.swings} bells +${M.striker.allBells} more`,
  },
  pitStop: {
    name: 'Pit Stop', icon: '🏎️',
    rules: `Change all ${M.pitStop.tires} tires: tap each one ${M.pitStop.taps} times. The clock starts on your first tap.`,
    prize: `Under ${M.pitStop.tiers[0].under} sec +${M.pitStop.tiers[0].points} · under ${M.pitStop.tiers[1].under} +${M.pitStop.tiers[1].points} · under ${M.pitStop.tiers[2].under} +${M.pitStop.tiers[2].points} · slower +${M.pitStop.slow}`,
  },
  coaster: {
    name: 'Loop the Loop', icon: '🎢',
    rules: `Hold to build speed, let go in the green to clear the loop. Too slow stalls, too fast flies off. ${M.coaster.rides} rides.`,
    prize: `Clean +${M.coaster.clean} · wobbly +${M.coaster.wobbly} · all clean +${M.coaster.allClean} more`,
  },
  seal: {
    name: 'Balance Act', icon: '🦭',
    rules: `Keep the ball on the seal's nose for ${M.seal.seconds} seconds. Tap ◀ and ▶ to nudge it back.`,
    prize: `+${M.seal.perSecond} a second · all ${M.seal.seconds} +${M.seal.fullBonus} more`,
  },
  monte: {
    name: 'Find the Lady', icon: '🃏',
    rules: `Watch the queen, then pick her out after the shuffle. ${M.monte.rounds} rounds, each one faster.`,
    prize: `+${M.monte.perFind} a find · all ${M.monte.rounds} +${M.monte.allBonus} more`,
  },
};
