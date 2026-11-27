// 📼 Run Review (v7.100.0, the owner's design and picks): a short video-store critic's write-up on the Game Over
// screen. The game writes it from the run's own numbers (no AI model, works offline): a star rating, what carried
// the score, what ended the run, one tip for next time and the best moment. Every line is one short sentence.
import type { GameState, PowerPlay } from '../types';
import { CHARMS_LIST } from '../data/charms';
import { SECRET_BONUSES } from '../data/secretBonuses';
import { GENRES, genreEarned } from '../data/videoStore';
import { earnedThisRun } from '../components/GearMenu';
import { levelFor, clockSpeedFor, timeForWord } from './rules';
import { CHARM_SLOTS, GAMEPLAY } from '../config/gameplay';

export interface ReviewLine { kind: 'carried' | 'ended' | 'tip' | 'best'; icon: string; label: string; text: string }
export interface RunReview { stars: number; verdict: string; lines: ReviewLine[] }

type ReviewState = Pick<GameState, 'log' | 'score'> & Partial<Pick<GameState, 'endReason' | 'timeLedger' | 'activeCharms' | 'availablePowerPlays' | 'shuffleCount' | 'challengeCount' | 'collectorEarned'>>;

const VERDICTS = [
  '', // stars start at 1
  'Straight to VHS. Rewind and try again.',
  'Bargain bin, but it has its moments.',
  'A solid Friday-night rental.',
  'New-release wall material.',
  'Staff pick of the week!',
];

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
const fmt = (n: number) => Math.round(n).toLocaleString();
type WordEntry = { type: 'word'; status: string; word: string; score: number; bonuses?: { name: string; description: string }[] };
type EventEntry = { type: 'event'; id?: string; name: string; scoreChange?: number };

/** Stars: a new best is always 5; otherwise by the level reached. */
export const reviewStars = (level: number, isNewBest: boolean): number =>
  isNewBest ? 5 : level >= 12 ? 5 : level >= 8 ? 4 : level >= 5 ? 3 : level >= 3 ? 2 : 1;

/** Where the score came from, by source. Words = what the tiles themselves earned (after every boost on the word). */
export const scoreSources = (gs: ReviewState) => {
  const log = (gs.log ?? []) as unknown as (WordEntry | EventEntry)[];
  const words = log.filter((e): e is WordEntry => e.type === 'word' && e.status === 'valid');
  const events = log.filter((e): e is EventEntry => e.type === 'event');
  const wordTotal = words.reduce((t, w) => t + (w.score ?? 0), 0);

  const charms = CHARMS_LIST.map(c => ({ name: `${c.icon} ${c.name}`, points: earnedThisRun(gs.log, c.name).points })).filter(c => c.points > 0).sort((a, b) => b.points - a.points);
  const charmPts = charms.reduce((t, c) => t + c.points, 0);
  const secretNames = new Set(SECRET_BONUSES.map(b => b.name));
  let secretPts = 0, secretCount = 0;
  for (const w of words) for (const b of w.bonuses ?? []) {
    if (!secretNames.has(b.name)) continue;
    const m = b.description.match(/\+([\d,]+)\s*pts/);
    if (m) { secretPts += Number(m[1].replace(/,/g, '')); secretCount++; }
  }
  const genres = GENRES.map(g => ({ name: `${g.icon} ${g.name}`, points: genreEarned(gs.log ?? [], g).points })).filter(g => g.points > 0).sort((a, b) => b.points - a.points);
  const genrePts = genres.reduce((t, g) => t + g.points, 0);
  const collectorPts = (gs.collectorEarned?.chrome?.points ?? 0) + (gs.collectorEarned?.holo?.points ?? 0);

  const byPP = new Map<string, number>();
  let ppPts = 0, extraPts = 0;
  for (const e of events) {
    const change = e.scoreChange ?? 0;
    if (change <= 0) continue;
    if (e.id?.startsWith('pp-')) { ppPts += change; byPP.set(e.name, (byPP.get(e.name) ?? 0) + change); }
    else if (!CHARMS_LIST.some(c => e.name.startsWith(c.name))) extraPts += change; // charm events are counted above
  }
  const pps = [...byPP.entries()].map(([name, points]) => ({ name, points })).sort((a, b) => b.points - a.points);
  const tilePts = Math.max(0, wordTotal - charmPts - secretPts - genrePts - collectorPts);
  return { words, wordTotal, tilePts, charms, charmPts, secretPts, secretCount, genres, genrePts, collectorPts, pps, ppPts, extraPts };
};

/** The run review shown on Game Over. `isNewBest` comes from the Game Over screen. */
export const runReview = (gs: ReviewState, isNewBest = false): RunReview => {
  const s = scoreSources(gs);
  const score = Math.max(0, gs.score ?? 0);
  const level = levelFor(s.words.length);
  const stars = reviewStars(level, isNewBest);
  const lines: ReviewLine[] = [];

  // 📈 What carried you: the biggest source, unless the tiles did most of the work.
  const sources = [
    { key: 'charms', points: s.charmPts, text: () => `Charms carried you: ${pct(s.charmPts, score)}% of your score. ${s.charms[0].name} alone paid +${fmt(s.charms[0].points)}.` },
    { key: 'pp', points: s.ppPts, text: () => `PowerPlays paid off: ${pct(s.ppPts, score)}% of your score, led by ${s.pps[0].name} (+${fmt(s.pps[0].points)}).` },
    { key: 'secrets', points: s.secretPts, text: () => `Secret words did the heavy lifting: ${pct(s.secretPts, score)}% of your score from ${s.secretCount} secret${s.secretCount === 1 ? '' : 's'}.` },
    { key: 'genres', points: s.genrePts, text: () => `Genres paid ${pct(s.genrePts, score)}% of your score. ${s.genres[0].name} led the way with +${fmt(s.genres[0].points)}.` },
    { key: 'extras', points: s.extraPts, text: () => `Bonus games, gates and bosses paid ${pct(s.extraPts, score)}% of your score.` },
  ].sort((a, b) => b.points - a.points);
  const top = sources[0];
  if (score > 0 && top.points > 0 && (top.points >= s.tilePts * 0.6 || pct(top.points, score) >= 30)) {
    lines.push({ kind: 'carried', icon: '📈', label: 'WHAT CARRIED YOU', text: top.text() });
  } else if (s.words.length) {
    const avg = Math.round(s.wordTotal / s.words.length);
    lines.push({ kind: 'carried', icon: '📈', label: 'WHAT CARRIED YOU', text: `Pure spelling: ${pct(s.tilePts, score)}% of your score came straight from your words, ${s.words.length} of them at ${fmt(avg)} points each.` });
  }

  // 💀 What ended it.
  const ledger = gs.timeLedger;
  const earned = ledger ? ledger.words + ledger.powerUps + ledger.shuffles : 0;
  const invalid = ((gs.log ?? []) as unknown as (WordEntry | EventEntry)[]).filter(e => e.type === 'word' && e.status === 'invalid');
  if (gs.endReason === 'strikes') {
    lines.push({ kind: 'ended', icon: '💀', label: 'WHAT ENDED IT', text: invalid.length
      ? `Three strikes on level ${level}, and ${Math.min(invalid.length, 3) === 3 ? 'all three' : `${invalid.length}`} came from words that weren't real.`
      : `Three strikes on level ${level}. Strikes from gambles and bosses add up fast.` });
  } else {
    const items = ledger?.powerUps ?? 0;
    const speed = clockSpeedFor(level).toFixed(1);
    lines.push({ kind: 'ended', icon: '💀', label: 'WHAT ENDED IT', text: earned > 0 && pct(items, earned) < 15
      ? `The clock caught you on level ${level}: ${pct(ledger!.words, earned)}% of your time came from words, and charms and PowerPlays added just ${items} sec.`
      : `The clock caught you on level ${level}, ticking at x${speed}. Even +${items} sec from charms and PowerPlays couldn't keep up.` });
  }

  // 💡 Try next run: the first tip that fits.
  const pocket = (gs.availablePowerPlays ?? [])[0] as PowerPlay | undefined;
  const long = s.words.filter(w => w.word.length >= 6), short = s.words.filter(w => w.word.length <= 4);
  const avg = (ws: WordEntry[]) => (ws.length ? ws.reduce((t, w) => t + w.score, 0) / ws.length : 0);
  const tips: (string | null)[] = [
    gs.endReason === 'strikes' && invalid.length >= 2 ? `Not sure it's a word? Tap STUCK? and the game checks your tiles for you${(gs.challengeCount ?? 0) > 0 ? ` (you still had ${gs.challengeCount})` : ''}.` : null,
    pocket ? `You finished with ${pocket.icon} ${pocket.name} still in your pocket. Use your PowerPlays before the credits roll!` : null,
    gs.endReason !== 'strikes' && earned > 0 && pct(ledger!.powerUps, earned) < 15
      ? (level < 7 ? `Longer words buy more seconds: a 6-letter word earns ${timeForWord(6)} sec, a 4-letter one just ${timeForWord(4)}. Stretch it out.`
        : 'Past level 7 the clock outruns your words. Grab a time charm or a time PowerPlay early.') : null,
    gs.endReason !== 'strikes' && (gs.shuffleCount ?? 0) > 0 ? `You had ${gs.shuffleCount} shuffle${gs.shuffleCount === 1 ? '' : 's'} left. Each one is +${GAMEPLAY.timeBank.shuffleTimeBonus} sec when the clock runs low.` : null,
    long.length && short.length && avg(long) >= 2 * avg(short) && long.length < s.words.length * 0.25
      ? `Your 6+ letter words averaged ${fmt(avg(long))} points, your short ones ${fmt(avg(short))}. Go long.` : null,
    (gs.activeCharms?.length ?? CHARM_SLOTS) < CHARM_SLOTS ? `You ran with ${CHARM_SLOTS - (gs.activeCharms?.length ?? 0)} empty charm slot${CHARM_SLOTS - (gs.activeCharms?.length ?? 0) === 1 ? '' : 's'}. A charm pays on every word, so fill them.` : null,
    'Try the Daily Challenge: same tiles for everyone, and a 🏆 for the top score.',
  ];
  lines.push({ kind: 'tip', icon: '💡', label: 'TRY NEXT RUN', text: tips.find(Boolean)! });

  // ⭐ Best moment: the top word, or a bigger single payout.
  const best = s.words.reduce<{ w: WordEntry; i: number } | null>((b, w, i) => (!b || w.score > b.w.score ? { w, i } : b), null);
  const bigEvent = ((gs.log ?? []) as unknown as (WordEntry | EventEntry)[]).filter((e): e is EventEntry => e.type === 'event').reduce<EventEntry | null>((b, e) => ((e.scoreChange ?? 0) > (b?.scoreChange ?? 0) ? e : b), null);
  if (bigEvent && best && (bigEvent.scoreChange ?? 0) > best.w.score * 1.5) {
    lines.push({ kind: 'best', icon: '⭐', label: 'BEST MOMENT', text: `${bigEvent.name} paid +${fmt(bigEvent.scoreChange ?? 0)} in one go.` });
  } else if (best) {
    const golden = (best.w.bonuses ?? []).some(b => b.name.includes('Golden'));
    lines.push({ kind: 'best', icon: '⭐', label: 'BEST MOMENT', text: `${best.w.word.toUpperCase()} for ${fmt(best.w.score)} points on level ${levelFor(best.i)}${golden ? ', a Golden word' : ''}.` });
  }

  return { stars, verdict: VERDICTS[stars], lines };
};
