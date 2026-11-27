// The 1-minute tour (v7.78.0, the owner's design): five short hands-on screens, then a finish card.
// A practice area: real tiles and buttons, no score, no stats, nothing saved but "seen it".
//   1. Build a word: a finger guides C-A-T, each tile flies up to the word row, SUBMIT scores it.
//   2. Longer words score more AND buy time: CLOSET against CAT, the seconds fly into the clock.
//   3. The clock is your bank: a fake word earns a strike; hold SHUFFLE for new tiles and +5 sec.
//   4. Power-ups and surprises: six cards to flip (PowerPlays, Charms, Bosses, Golden Round, Video Store, Genres).
//   5. Your gear (v7.88.0, the owner's ask): tap the 🎒 under STRIKES to open Gear; the clock stops.
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import TileComponent from './Tile';
import ArcadeButton from './ArcadeButton';
import ShuffleButton from './ShuffleButton';
import { Sec } from './Seconds';
import { soundService } from '../services/soundService';
import { GAMEPLAY, BOSS, CHARM_SLOTS } from '../config/gameplay';
import { MAX_STRIKES_INITIAL, TILE_DISTRIBUTION } from '../constants';
import { tourWordScore, TOUR_HAND, TOUR_FIRST_WORD, TOUR_LONG_WORD, TOUR_FAKE_WORD, TOUR_CLOCK_START } from '../services/tour';
import type { Tile } from '../types';
import { CHARMS_LIST } from '../data/charms';
import { POWER_PLAYS_LIST } from '../data/powerPlays';

interface QuickTourProps {
  tileClass: string;
  /** "Play now": true when a saved run is waiting, so the button says Continue instead. */
  hasSavedRun: boolean;
  onPlay: () => void;
  onFullGuide: () => void;
  onMenu: () => void;
  /** Called once when the player finishes all five screens (not on Skip). */
  onFinished?: () => void;
}

const STEPS = 5;
const FINISH = STEPS + 1;
const mkTile = (letter: string, i: number, round = 0): Tile => ({ id: `tour-${round}-${i}-${letter}`, letter, points: TILE_DISTRIBUTION[letter]?.points ?? 1 });
const handFor = (letters: string[], round = 0) => letters.map((l, i) => mkTile(l, i, round));
const SHUFFLED_HAND = ['N', 'I', 'D', 'E', 'A', 'R', 'T', 'S'];

const CARDS = [
  { icon: '⚡', name: 'PowerPlays', tone: 'text-neon-yellow ring-neon-yellow/60',
    back: `Every letter you play fills the PowerPlay meter. When it's full, pick 1 of 3 one-shot power-ups: extra time, big multipliers, wild game-show gambles.` },
  { icon: '🍀', name: 'Charms', tone: 'text-neon-green ring-neon-green/60',
    back: `Perks that stay on and pay out on every word that fits them. Hold up to ${CHARM_SLOTS} at once, like a 5-disc changer.` },
  { icon: '👹', name: 'Boss Fights', tone: 'text-neon-red ring-neon-red/60',
    back: `Every ${BOSS.everyLevels === 3 ? '3rd' : `${BOSS.everyLevels}th`} level a villain sets a rule for your next ${BOSS.words} words. Follow it enough times to win a Boss Badge. Breaking it costs you nothing.` },
  { icon: '🌟', name: 'Golden Round', tone: 'text-neon-yellow ring-neon-yellow/60',
    back: `Chain enough good words and you get one Golden word: it scores x${GAMEPLAY.goldenRound.multiplier}, or x${GAMEPLAY.goldenRound.tileMultiplier} with the glowing ★ tile.` },
  { icon: '📼', name: 'Video Store', tone: 'text-neon-pink ring-neon-pink/60',
    back: `Every other level you go shopping, and your seconds are the money. Check out charms, PowerPlays, genre posters and Collector's Tiles to keep, while the clock waits.` },
  { icon: '🎬', name: 'Genres', tone: 'text-neon-cyan ring-neon-cyan/60',
    back: `Short words, long words, double letters... each genre earns stars as you play it. Every ★ makes those words pay more for the rest of the run.` },
];

/** A tile that flies from a hand slot to the word row. */
interface Flight { tile: Tile; from: DOMRect; to: DOMRect; go: boolean }

const QuickTour: React.FC<QuickTourProps> = ({ tileClass, hasSavedRun, onPlay, onFullGuide, onMenu, onFinished }) => {
  const [step, setStep] = useState(1); // FINISH = the finish card
  const [hand, setHand] = useState<(Tile | null)[]>(() => handFor(TOUR_HAND));
  const [row, setRow] = useState<Tile[]>([]);
  const [scored, setScored] = useState<ReturnType<typeof tourWordScore> | null>(null);
  const [firstScore, setFirstScore] = useState<ReturnType<typeof tourWordScore> | null>(null);
  const [clock, setClock] = useState(TOUR_CLOCK_START);
  const [gain, setGain] = useState<{ key: number; text: string; good: boolean } | null>(null);
  const [strikes, setStrikes] = useState(0);
  const [shuffled, setShuffled] = useState(false);
  const [shake, setShake] = useState(false);
  const [nudge, setNudge] = useState<string | null>(null);
  const [flipped, setFlipped] = useState<boolean[]>(CARDS.map(() => false));
  const [gearSeen, setGearSeen] = useState(false);
  const [flight, setFlight] = useState<Flight | null>(null);
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const clockRef = useRef<HTMLDivElement | null>(null);

  const target = step === 1 ? TOUR_FIRST_WORD : step === 2 ? TOUR_LONG_WORD : '';
  const spelled = row.map(t => t.letter).join('');
  const nextLetter = target && !scored && spelled.length < target.length ? target[spelled.length] : null;
  const nextIndex = nextLetter ? hand.findIndex(t => t?.letter === nextLetter) : -1;
  const ready = !!target && spelled === target && !scored;

  const resetBoard = (letters: string[], round: number) => {
    setHand(handFor(letters, round));
    setRow([]);
    setScored(null);
  };

  const goTo = (n: number) => {
    soundService.playUIClick();
    setNudge(null);
    setGain(null);
    if (n === 2) resetBoard(TOUR_HAND, 2);
    if (n === 3) {
      // The fake word is already in the word row: the lesson is what SUBMIT does with it.
      const letters = TOUR_HAND.slice();
      const used: Tile[] = [];
      const h: (Tile | null)[] = handFor(letters, 3);
      for (const l of TOUR_FAKE_WORD) {
        const i = h.findIndex(t => t?.letter === l);
        used.push(h[i]!);
        h[i] = null;
      }
      setHand(h);
      setRow(used);
      setScored(null);
    }
    setStep(n);
  };

  // Screen 3: the clock really ticks (a slow 1 a second, never below 10).
  useEffect(() => {
    if (step !== 3) return;
    const id = window.setInterval(() => setClock(c => Math.max(10, c - 1)), 1000);
    return () => window.clearInterval(id);
  }, [step]);

  const addTime = (secs: number) => {
    setClock(c => c + secs);
    setGain({ key: Date.now(), text: `+${secs}`, good: true });
  };

  // A tap on the hand: only the next letter of the practice word moves; anything else nudges.
  const tapHand = (i: number) => {
    const tile = hand[i];
    if (!tile || flight || step > 2 || scored) return;
    if (i !== nextIndex) {
      setNudge(`Tap the glowing ${nextLetter ?? ''} 👆`);
      return;
    }
    const from = slotRefs.current[i]?.getBoundingClientRect();
    const to = rowRefs.current[row.length]?.getBoundingClientRect();
    soundService.playTilePlace(row.length);
    soundService.haptic(8);
    setNudge(null);
    const h = hand.slice(); h[i] = null; setHand(h);
    if (!from || !to) { setRow(r => [...r, tile]); return; }
    setFlight({ tile, from, to, go: false });
  };
  // Start the flight on the next frame so the transition runs.
  useLayoutEffect(() => {
    if (!flight || flight.go) return;
    const id = requestAnimationFrame(() => setFlight(f => (f ? { ...f, go: true } : f)));
    return () => cancelAnimationFrame(id);
  }, [flight]);
  const landed = useRef<string | null>(null);
  const land = () => {
    if (!flight || landed.current === flight.tile.id) return;
    landed.current = flight.tile.id;
    setRow(r => [...r, flight.tile]);
    setFlight(null);
  };
  // Safety net: if the transition never ends (reduced motion, a hidden tab), land anyway.
  useEffect(() => {
    if (!flight?.go) return;
    const id = window.setTimeout(land, 450);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flight?.go]);

  const submit = () => {
    if (step === 3) {
      if (strikes > 0) return;
      soundService.playInvalidWord();
      setStrikes(1);
      setShake(true);
      window.setTimeout(() => setShake(false), 450);
      setNudge(null);
      return;
    }
    if (!ready) {
      setNudge(nextLetter ? `Finish the word first: tap ${nextLetter}` : null);
      return;
    }
    const s = tourWordScore(spelled);
    soundService.playValidWord(s.word.length);
    setScored(s);
    if (step === 1) setFirstScore(s);
    addTime(s.seconds);
  };

  const doShuffle = () => {
    soundService.playShuffle();
    setHand(handFor(SHUFFLED_HAND, 4));
    setRow([]);
    setShuffled(true);
    addTime(GAMEPLAY.timeBank.shuffleTimeBonus);
  };

  const flip = (i: number) => {
    soundService.playUIClick();
    setFlipped(f => f.map((v, j) => (j === i ? !v : v)));
  };

  const canNext = step === 1 || step === 2 ? !!scored : step === 3 ? strikes > 0 && shuffled : step === 5 ? gearSeen : true;

  // ---------- finish ----------
  if (step === FINISH) {
    return (
      <div className="flex flex-col h-full min-h-0 items-center justify-center text-center gap-4 px-6 animate-fade-in" data-testid="tour-finish">
        <div className="text-6xl" aria-hidden="true">🕹️</div>
        <h1 className="font-display text-4xl text-neon-yellow leading-none">YOU'RE READY!</h1>
        <p className="text-slate-200 text-[15px] leading-snug max-w-xs">
          Spell words, keep the clock alive, grab power-ups. Everything else you'll figure out on the fly. You're a natural.
        </p>
        <div className="w-full max-w-xs flex flex-col gap-2.5 mt-2">
          <ArcadeButton color="yellow" size="lg" className="w-full" onClick={() => { soundService.playUIClick(); onPlay(); }}>
            {hasSavedRun ? '▶ Back to my run' : '▶ Play now'}
          </ArcadeButton>
          <ArcadeButton color="cyan" variant="outline" className="w-full" onClick={() => { soundService.playUIClick(); onFullGuide(); }}>📖 Full How to Play</ArcadeButton>
          <ArcadeButton color="cyan" variant="text" className="w-full" onClick={() => { soundService.playUIClick(); onMenu(); }}>🏠 Main menu</ArcadeButton>
        </div>
      </div>
    );
  }

  const title = ['BUILD A WORD', 'GO LONG', 'THE CLOCK IS YOUR BANK', 'POWER-UPS & SURPRISES', 'YOUR GEAR'][step - 1];
  const showBoard = step <= 3;

  return (
    <div className="flex flex-col h-full min-h-0 animate-fade-in" data-testid={`tour-step-${step}`}>
      {/* Header: progress dots and Skip. */}
      <header className="shrink-0 flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-1.5" aria-label={`Step ${step} of ${STEPS}`}>
          {Array.from({ length: STEPS }, (_, i) => (
            <span key={i} className={`h-2 rounded-full transition-all ${i + 1 === step ? 'w-6 bg-neon-cyan' : i + 1 < step ? 'w-2 bg-neon-cyan/60' : 'w-2 bg-white/15'}`} />
          ))}
          <span className="osd-text text-base leading-none text-slate-400 ml-2">{step}/{STEPS}</span>
        </div>
        <button type="button" onClick={() => goTo(FINISH)} className="osd-text text-lg leading-none text-slate-400 hover:text-white underline" data-testid="tour-skip">SKIP TOUR</button>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 flex flex-col gap-3">
        <div className="text-center">
          <h1 className="font-display text-2xl min-[375px]:text-3xl leading-none text-neon-cyan">{title}</h1>
          <p className="text-slate-200 text-[15px] leading-snug mt-2">
            {step === 1 && <>Tap tiles to spell a word, then hit <b className="text-neon-green">SUBMIT</b>. Let's spell <b className="text-neon-yellow">CAT</b>.</>}
            {step === 2 && <>Longer words pay twice: more points <i>and</i> more time. Spell <b className="text-neon-yellow">CLOSET</b> and compare.</>}
            {step === 3 && <>The clock never stops. Words add time; a fake word adds a <b className="text-neon-red">strike</b>, and {MAX_STRIKES_INITIAL} strikes ends your run. Go on, try one.</>}
            {step === 4 && <>Play long enough and the game starts handing you toys. Tap each card to flip it.</>}
            {step === 5 && <>Your charms, your PowerPlay and how many strikes you have left all live in your <b className="text-neon-yellow">🎒 Gear</b>, under STRIKES. Tap it.</>}
          </p>
        </div>

        {showBoard && (
          <>
            {/* Mini clock and strikes. */}
            <div className="flex items-center justify-between rounded-xl bg-crt-950/70 ring-1 ring-white/10 px-3 py-2">
              <div ref={clockRef} className="relative flex items-center gap-2" data-testid="tour-clock">
                <span className="text-xl" aria-hidden="true">⏱️</span>
                <span className={`font-digital text-3xl leading-none ${step === 3 ? 'text-neon-green' : 'text-white'}`}>{clock}</span>
                <span className="osd-text text-base leading-none text-slate-400">SEC</span>
                {gain && (
                  <span key={gain.key} className={`absolute left-full ml-2 top-0 time-gain-side osd-text text-2xl leading-none whitespace-nowrap ${gain.good ? 'text-neon-green' : 'text-neon-red'}`}>
                    {gain.text}<Sec />
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1" aria-label={`Strikes: ${strikes} of ${MAX_STRIKES_INITIAL}`} data-testid="tour-strikes">
                <span className="osd-text text-base leading-none text-slate-400 mr-1">STRIKES</span>
                {Array.from({ length: MAX_STRIKES_INITIAL }, (_, i) => (
                  <span key={i} className={`text-lg leading-none ${i < strikes ? '' : 'opacity-25 grayscale'}`}>❌</span>
                ))}
              </div>
            </div>

            {/* Word row. */}
            <div className={`grid grid-cols-8 gap-1.5 rounded-xl bg-crt-950/50 ring-1 ring-neon-cyan/30 p-2 ${shake ? 'screen-shake' : ''}`} aria-label={`Word row: ${spelled || 'empty'}`} data-testid="tour-row">
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} ref={el => { rowRefs.current[i] = el; }} className="aspect-square">
                  {row[i] ? <TileComponent tile={row[i]} onClick={() => {}} packTileClass={tileClass} /> : <div className="w-full h-full rounded-lg bg-crt-950/60 ring-1 ring-white/5" />}
                </div>
              ))}
            </div>

            {/* Score result / strike result. */}
            <div className="min-h-[4.5rem] flex items-center justify-center" aria-live="polite">
              {scored ? (
                <div className="text-center message-pop" data-testid="tour-score">
                  <div className="font-display text-3xl leading-none text-neon-green">{scored.word} +{scored.score}</div>
                  <div className="osd-text text-lg leading-tight text-slate-300 mt-1">
                    {scored.tilePoints} tile points{scored.lengthMult > 1 ? ` x${scored.lengthMult} length bonus` : ''} · +{scored.seconds}<Sec /> on the clock
                  </div>
                  {step === 2 && firstScore && (
                    <div className="osd-text text-lg leading-tight text-neon-yellow mt-0.5">
                      CAT: +{firstScore.score} and +{firstScore.seconds}<Sec /> · CLOSET: +{scored.score} and +{scored.seconds}<Sec />
                    </div>
                  )}
                </div>
              ) : step === 3 && strikes > 0 ? (
                <div className="text-center message-pop" data-testid="tour-strike">
                  <div className="font-display text-2xl leading-none text-neon-red">❌ NOT A WORD · STRIKE 1</div>
                  <div className="osd-text text-lg leading-tight text-slate-300 mt-1">
                    {shuffled ? 'Fresh tiles and more time. That\'s the lifeline.' : <>Stuck? <b className="text-neon-green">Hold SHUFFLE</b>: new tiles and +{GAMEPLAY.timeBank.shuffleTimeBonus}<Sec />.</>}
                  </div>
                </div>
              ) : nudge ? (
                <div className="osd-text text-xl leading-none text-neon-pink message-pop">{nudge}</div>
              ) : null}
            </div>

            {/* Hand. */}
            <div className="grid grid-cols-4 gap-2 px-1" data-testid="tour-hand">
              {hand.map((t, i) => (
                <div key={i} ref={el => { slotRefs.current[i] = el; }} className="relative aspect-square">
                  {t ? (
                    <>
                      <div className={`w-full h-full ${i === nextIndex ? 'rounded-lg ring-4 ring-neon-cyan shadow-[0_0_14px_rgba(0,229,255,0.7)]' : ''}`}>
                        <TileComponent tile={t} onClick={() => tapHand(i)} packTileClass={tileClass} />
                      </div>
                      {i === nextIndex && !flight && (
                        <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-3xl animate-bounce pointer-events-none z-30" aria-hidden="true">👆</span>
                      )}
                    </>
                  ) : <div className="w-full h-full rounded-lg bg-crt-950/60 ring-1 ring-white/5" />}
                </div>
              ))}
            </div>

            {/* Actions. */}
            <div className="flex gap-2 pt-2">
              {step === 3 && (
                <div className="flex-1">
                  <ShuffleButton count={shuffled ? 2 : 3} seconds={GAMEPLAY.timeBank.shuffleTimeBonus} disabled={strikes === 0 || shuffled} lowTime={strikes > 0 && !shuffled} timerRef={clockRef} onShuffle={doShuffle} />
                </div>
              )}
              <ArcadeButton color="green" className={`flex-1 ${(ready || (step === 3 && strikes === 0)) ? 'lifeline-pulse' : ''}`} disabled={(step <= 2 && !!scored) || (step === 3 && (strikes > 0 || row.length === 0))} onClick={submit} data-testid="tour-submit">
                Submit
              </ArcadeButton>
            </div>
          </>
        )}

        {step === 4 && (
          <div className="grid grid-cols-2 gap-3" data-testid="tour-cards">
            {CARDS.map((c, i) => (
              <button key={c.name} type="button" onClick={() => flip(i)} aria-pressed={flipped[i]}
                className={`min-h-[10rem] rounded-xl ring-2 bg-crt-950/70 p-3 flex flex-col items-center justify-center text-center transition-transform ${c.tone} ${flipped[i] ? '' : 'hover:scale-[1.02]'}`}>
                {flipped[i] ? (
                  <span className="text-slate-100 text-[13.5px] leading-snug message-pop">{c.back}</span>
                ) : (
                  <>
                    <span className="text-4xl" aria-hidden="true">{c.icon}</span>
                    <span className="font-display text-lg leading-tight mt-2">{c.name}</span>
                    <span className="osd-text text-base leading-none text-slate-500 mt-1">TAP TO FLIP</span>
                  </>
                )}
              </button>
            ))}
          </div>
        )}

        {step === 5 && <GearDemo onOpened={() => setGearSeen(true)} />}
      </div>

      {/* Footer: back and next. */}
      <footer className="shrink-0 flex items-center gap-2 px-4 pt-2 pb-4">
        {step > 1 && <ArcadeButton color="cyan" variant="text" onClick={() => goTo(step - 1)}>◀ Back</ArcadeButton>}
        <ArcadeButton color="yellow" className="flex-1" disabled={!canNext} onClick={() => { if (step === STEPS) onFinished?.(); goTo(step + 1); }} data-testid="tour-next">
          {step === STEPS ? "I'm ready ▶" : 'Next ▶'}
        </ArcadeButton>
      </footer>

      {/* The flying tile. */}
      {flight && (
        <div
          className="fixed z-50 pointer-events-none"
          onTransitionEnd={land}
          style={{
            left: flight.from.left, top: flight.from.top, width: flight.from.width, height: flight.from.height,
            transition: 'transform 300ms cubic-bezier(0.3, 0.7, 0.4, 1)',
            transform: flight.go
              ? `translate(${flight.to.left - flight.from.left}px, ${flight.to.top - flight.from.top}px) scale(${flight.to.width / flight.from.width})`
              : 'none',
            transformOrigin: 'top left',
          }}
        >
          <TileComponent tile={flight.tile} onClick={() => {}} packTileClass={tileClass} />
        </div>
      )}
    </div>
  );
};

/**
 * Step 5 (v7.88.0): a mini board top with the 🎒 under STRIKES. Tapping it opens a small Gear menu
 * (sample charms, a pocket PowerPlay, strikes left) and the clock stops until it's closed.
 */
const SAMPLE_CHARMS = ['stonks', 'rubiksCube'].map(id => CHARMS_LIST.find(c => c.id === id)).filter(Boolean) as typeof CHARMS_LIST;
const SAMPLE_PP = POWER_PLAYS_LIST.find(p => p.id === 'timeBoost');
const GearDemo: React.FC<{ onOpened: () => void }> = ({ onOpened }) => {
  const [clock, setClock] = useState(45);
  const [open, setOpen] = useState(false);
  const [opened, setOpened] = useState(false);
  useEffect(() => {
    if (open) return;
    const t = setInterval(() => setClock(c => (c > 10 ? c - 1 : 45)), 1000);
    return () => clearInterval(t);
  }, [open]);
  const toggle = () => {
    soundService.playUIClick();
    if (!open) { setOpened(true); onOpened(); }
    setOpen(o => !o);
  };
  return (
    <div className="flex flex-col gap-3" data-testid="tour-gear">
      {/* A mini board top: score, clock, strikes with the 🎒 under them. */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2 rounded-xl bg-crt-950/70 ring-1 ring-white/10 px-3 py-2">
        <div>
          <div className="osd-text text-base leading-none text-neon-yellow">SCORE</div>
          <div className="font-display text-2xl leading-none text-white mt-1">1,250</div>
        </div>
        <div className={`rounded-lg ring-2 px-3 py-1 text-center ${open ? 'ring-neon-cyan bg-neon-cyan/10' : 'ring-neon-cyan/60'}`} data-testid="tour-gear-clock">
          <div className="font-digital text-4xl leading-none text-neon-cyan">{clock}</div>
          <div className={`osd-text text-sm leading-none mt-0.5 ${open ? 'text-neon-yellow' : 'text-slate-400'}`}>{open ? '⏸ PAUSED' : 'SEC'}</div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="osd-text text-base leading-none text-neon-red">STRIKES</div>
          <div className="flex gap-1" aria-hidden="true">
            {Array.from({ length: MAX_STRIKES_INITIAL }, (_, i) => <span key={i} className={`text-sm ${i < 1 ? '' : 'opacity-25 grayscale'}`}>❌</span>)}
          </div>
          <button type="button" onClick={toggle} aria-label={open ? 'Close your gear' : 'Open your gear'} data-testid="tour-gear-button"
            className={`relative mt-1 w-12 h-12 rounded-xl ring-2 bg-crt-950 grid place-items-center text-2xl ${open ? 'ring-neon-yellow' : 'ring-white/30'} ${!opened ? 'lifeline-pulse' : ''}`}>
            🎒
            <span className="absolute -bottom-1.5 -right-1.5 rounded-full bg-neon-purple text-white text-[11px] font-bold px-1.5 leading-4">{SAMPLE_CHARMS.length}/{CHARM_SLOTS}</span>
            {!opened && <span className="absolute right-full mr-1 top-1/2 -translate-y-1/2 text-3xl tour-point-right pointer-events-none" aria-hidden="true">👉</span>}
          </button>
        </div>
      </div>

      {open ? (
        <div className="rounded-xl ring-2 ring-white/40 bg-crt-950 p-3 flex flex-col gap-2 message-pop" data-testid="tour-gear-menu">
          <div className="flex items-center justify-between">
            <span className="font-display text-xl text-white tracking-wider">🎒 YOUR GEAR</span>
            <button type="button" onClick={toggle} className="osd-text text-lg text-neon-cyan">✕ BACK</button>
          </div>
          <p className="osd-text text-sm leading-none text-neon-yellow">⏸ GAME PAUSED · THE CLOCK WAITS FOR YOU</p>
          <div className="rounded-lg ring-1 ring-white/15 p-2 text-[13.5px] leading-snug text-slate-100 flex flex-col gap-1">
            <div className="osd-text text-sm leading-none text-slate-400">CHARMS {SAMPLE_CHARMS.length}/{CHARM_SLOTS}</div>
            {SAMPLE_CHARMS.map(c => <div key={c.id}>{c.icon} {c.name}</div>)}
            <div className="osd-text text-sm leading-none text-slate-400 mt-1">POCKET</div>
            {SAMPLE_PP && <div>{SAMPLE_PP.icon} {SAMPLE_PP.name} <span className="text-neon-green">▶ USE</span></div>}
            <div className="osd-text text-sm leading-none text-slate-400 mt-1">RUN STATUS</div>
            <div>❌ Strikes left: 2 of {MAX_STRIKES_INITIAL}</div>
          </div>
          <p className="text-slate-300 text-[13.5px] leading-snug">Tap any line in the real menu to read what it does. Sound, the event log and Save &amp; Quit are in here too.</p>
        </div>
      ) : (
        <p className="text-center osd-text text-lg leading-tight text-slate-400">
          {opened ? 'Clock running again. Open Gear whenever you need a breather.' : 'Watch the clock, then tap 🎒.'}
        </p>
      )}
    </div>
  );
};

export default QuickTour;
