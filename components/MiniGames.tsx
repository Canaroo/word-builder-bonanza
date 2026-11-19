import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import ArcadeButton from './ArcadeButton';
import { MINI_GAME_VALUES as M, GATES } from '../config/gameplay';
import { MINI_GAMES } from '../data/miniGames';
import type { GameState, MiniGameId, Tile } from '../types';
import { scramble, BIG_ONE_WORDS, LADDER_FALLBACK } from '../data/gates';
import { dictionaryService } from '../services/dictionaryService';
import { calculateScore } from '../services/gameUtils';
import { TILE_DISTRIBUTION } from '../constants';
import { soundService } from '../services/soundService';
import { dartPoints, dicePrize, bowlFirstBall, bowlSecondBall, bowlPrize, hoopShot, hoopsPrize, goalPrize, golfStroke, golfPrize, GOLF_CUP, ringTossPoints, riffPrize, strikerSwing, strikerPrize, pitStopPrize, coasterRide, coasterPrize, sealPrize, montePrize,
  lureCatch, lurePrize, dialDistance, dialCombo, dialPrize, wireBomb, wirePrize, eggKind, eggPoints, leapPrize, leapHit, LEAP_FROG } from '../services/miniGameRules';
import type { LureCatch, WireBomb, WireColor, EggKind } from '../services/miniGameRules';

// Arcade mini-games (v7.38.0). Spelling an arcade word (GAME, MOLE, CLAW, DART, GOAL, DICE, BOWL,
// TEE, NET) opens this card: an intro with Play or Skip, the game, then the result, which pays
// points through APPLY_MINIGAME. Progress is saved in the pop-up's data (like the gamble cards), so
// quitting mid-game and resuming carries on instead of starting over.

export interface MiniGameResult { points: number; headline: string; detail: string }
type Finish = (r: MiniGameResult) => void;
/** What each game receives: the finish callback, the pop-up's data, and the run (the bonus stage scores with it). */
interface GameProps { finish: Finish; extra?: Record<string, any>; gameState?: GameState }

const Save = createContext<{ saved?: Record<string, unknown>; save?: (key: string, value: unknown) => void }>({});
function useSaved<T>(key: string, init: T | (() => T)): [T, (value: T) => void] {
  const { saved, save } = useContext(Save);
  const restored = !!saved && key in saved;
  const [value, setValue] = useState<T>(() => (restored ? (saved![key] as T) : typeof init === 'function' ? (init as () => T)() : init));
  // The opening deal (the riff, v7.46) is saved right away, so quitting and resuming can't redraw it.
  useEffect(() => { if (!restored) save?.(key, value); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return [value, (next: T) => { setValue(next); save?.(key, next); }];
}

/**
 * A countdown (v7.39.4): the number in the arcade font with a stopwatch, and "sec" small, lowercase
 * and in a plain font. A bare "30s" in the display font read as "305" (the S looks like a 5).
 */
const Secs: React.FC<{ ms: number; warnBelow: number; className?: string }> = ({ ms, warnBelow, className = '' }) => {
  const n = Math.ceil(ms / 1000);
  const warn = ms < warnBelow;
  return (
    <span className={`inline-flex items-baseline gap-1 ${warn ? 'text-neon-red animate-pulse' : 'text-neon-cyan'} ${className}`} role="timer" aria-label={`${n} ${n === 1 ? 'second' : 'seconds'} left`}>
      <span aria-hidden="true" className="text-base self-center">⏱</span>
      <span className="font-display tabular-nums">{n}</span>
      <span className="font-sans text-xs font-semibold lowercase tracking-wide opacity-80">sec</span>
    </span>
  );
};

/** A bar that drains as the clock runs down. */
const TimeBar: React.FC<{ ms: number; total: number; warnBelow: number }> = ({ ms, total, warnBelow }) => (
  <div className="w-full h-1.5 rounded-full bg-crt-950 ring-1 ring-white/10 overflow-hidden" aria-hidden="true">
    <div className={`h-full transition-[width] duration-100 ease-linear ${ms < warnBelow ? 'bg-neon-red' : 'bg-neon-cyan'}`} style={{ width: `${Math.max(0, Math.min(100, (ms / total) * 100))}%` }} />
  </div>
);

const buzz = (ms: number | number[]) => { try { navigator.vibrate?.(ms); } catch { /* not supported */ } };
const tick = () => soundService.playTileClick();

/** Seconds since the component started (or `running` turned on), updated every animation frame. */
function useClock(running = true): number {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    const start = performance.now() - t * 1000;
    const loop = (now: number) => { setT((now - start) / 1000); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running]); // eslint-disable-line react-hooks/exhaustive-deps
  return t;
}

// --- GAME: Pong ---------------------------------------------------------------------------------
const PONG_W = 300, PONG_H = 360, PADDLE_W = 64, PADDLE_H = 9, BALL_R = 7, PLAYER_Y = PONG_H - 22, CPU_Y = 22;
const Pong: React.FC<{ finish: Finish }> = ({ finish }) => {
  const [score, setScore] = useSaved('pong', { me: 0, cpu: 0 });
  const [, setFrame] = useState(0);
  const me = useRef(PONG_W / 2), cpu = useRef(PONG_W / 2);
  const ball = useRef({ x: PONG_W / 2, y: PONG_H / 2, vx: 1.6, vy: 4.2, wait: 900 });
  const scoreRef = useRef(score);
  const svgRef = useRef<SVGSVGElement>(null);
  const done = useRef(false);
  // The CPU aims a little off, more so the longer a rally runs, so it can be beaten (a perfect
  // tracker used to rally forever at 0-0).
  const rally = useRef(0), cpuError = useRef(0);

  useEffect(() => {
    let raf = 0, last = performance.now();
    const serve = () => { const dir = Math.random() < 0.5 ? -1 : 1; rally.current = 0; cpuError.current = 0; ball.current = { x: PONG_W / 2, y: PONG_H / 2, vx: dir * (1.4 + Math.random()), vy: 4.2, wait: 700 }; };
    const point = (mine: boolean) => {
      const s = { me: scoreRef.current.me + (mine ? 1 : 0), cpu: scoreRef.current.cpu + (mine ? 0 : 1) };
      scoreRef.current = s; setScore(s); buzz(mine ? [20, 30, 20] : 60);
      if (mine) soundService.playMilestone();
      if (s.me >= M.pong.toWin || s.cpu >= M.pong.toWin) {
        done.current = true;
        const won = s.me >= M.pong.toWin;
        setTimeout(() => finish(won
          ? { points: M.pong.prize, headline: `YOU WIN ${s.me}-${s.cpu}! +${M.pong.prize}`, detail: 'Game on, and game over for the CPU.' }
          : { points: 0, headline: `CPU WINS ${s.cpu}-${s.me}`, detail: 'The computer got there first. No prize this time.' }), 700);
        return;
      }
      serve();
    };
    const loop = (now: number) => {
      const dt = Math.min(3, (now - last) / 16.67); last = now;
      const b = ball.current;
      if (!done.current) {
        if (b.wait > 0) b.wait -= dt * 16.67;
        else {
          b.x += b.vx * dt; b.y += b.vy * dt;
          if (b.x < BALL_R) { b.x = BALL_R; b.vx = Math.abs(b.vx); }
          if (b.x > PONG_W - BALL_R) { b.x = PONG_W - BALL_R; b.vx = -Math.abs(b.vx); }
          const speed = Math.hypot(b.vx, b.vy);
          // Paddles: the bounce angle depends on where the ball hits.
          const hit = (px: number, down: boolean) => {
            let along = (b.x - px) / (PADDLE_W / 2);
            if (Math.abs(along) < 0.25) along = (along < 0 ? -1 : 1) * (0.25 + Math.random() * 0.2); // no dead-straight returns
            if (!down) { rally.current += 1; cpuError.current = (Math.random() * 2 - 1) * (14 + rally.current * 6); }
            const s = Math.min(9.5, speed * 1.1);
            b.vx = along * s * 0.75;
            b.vy = (down ? 1 : -1) * Math.sqrt(Math.max(1, s * s - b.vx * b.vx));
            tick(); buzz(6);
          };
          if (b.vy > 0 && b.y + BALL_R >= PLAYER_Y - PADDLE_H / 2 && b.y < PLAYER_Y && Math.abs(b.x - me.current) <= PADDLE_W / 2 + BALL_R) hit(me.current, false);
          if (b.vy < 0 && b.y - BALL_R <= CPU_Y + PADDLE_H / 2 && b.y > CPU_Y && Math.abs(b.x - cpu.current) <= PADDLE_W / 2 + BALL_R) hit(cpu.current, true);
          if (b.y > PONG_H + BALL_R) point(false);
          else if (b.y < -BALL_R) point(true);
        }
        // The CPU chases the ball only while it's coming its way, and not quite fast enough.
        const target = b.vy < 0 ? b.x + cpuError.current : PONG_W / 2;
        const step = 2.35 * dt;
        cpu.current += Math.max(-step, Math.min(step, target - cpu.current));
      }
      setFrame(f => f + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const aim = (clientX: number) => {
    const box = svgRef.current?.getBoundingClientRect();
    if (!box) return;
    me.current = Math.max(PADDLE_W / 2, Math.min(PONG_W - PADDLE_W / 2, ((clientX - box.left) / box.width) * PONG_W));
  };
  const b = ball.current;
  return (
    <>
      <p className="font-display text-2xl leading-none"><span className="text-neon-cyan">YOU {score.me}</span> <span className="text-slate-500">·</span> <span className="text-neon-pink">CPU {score.cpu}</span></p>
      <svg ref={svgRef} viewBox={`0 0 ${PONG_W} ${PONG_H}`} className="w-full max-w-[19rem] rounded-xl bg-crt-950 ring-1 ring-white/15 touch-none select-none"
        onPointerDown={e => { (e.target as Element).setPointerCapture?.(e.pointerId); aim(e.clientX); }} onPointerMove={e => aim(e.clientX)} role="img" aria-label={`Pong: you ${score.me}, CPU ${score.cpu}`}>
        <line x1={0} x2={PONG_W} y1={PONG_H / 2} y2={PONG_H / 2} stroke="rgba(255,255,255,0.15)" strokeDasharray="6 8" strokeWidth={2} />
        <rect x={cpu.current - PADDLE_W / 2} y={CPU_Y - PADDLE_H / 2} width={PADDLE_W} height={PADDLE_H} rx={3} fill="#ff4dc4" />
        <rect x={me.current - PADDLE_W / 2} y={PLAYER_Y - PADDLE_H / 2} width={PADDLE_W} height={PADDLE_H} rx={3} fill="#3df5ff" />
        <rect x={b.x - BALL_R} y={b.y - BALL_R} width={BALL_R * 2} height={BALL_R * 2} fill="#fff" />
      </svg>
      <p className="text-slate-400 text-sm">Drag anywhere on the court to move your paddle.</p>
    </>
  );
};

// --- MOLE: Whac-A-Mole ---------------------------------------------------------------------------
const Mole: React.FC<{ finish: Finish }> = ({ finish }) => {
  const [progress, setProgress] = useSaved('mole', { left: M.mole.seconds * 1000, score: 0, bops: 0 });
  const [holes, setHoles] = useState<(null | { gold: boolean; until: number })[]>(Array(9).fill(null));
  const state = useRef(progress);
  const ended = useRef(false);
  useEffect(() => {
    let last = performance.now(), nextSpawn = 400, saveIn = 1000;
    const timer = setInterval(() => {
      const now = performance.now(), dt = now - last; last = now;
      const s = state.current;
      s.left = Math.max(0, s.left - dt);
      nextSpawn -= dt; saveIn -= dt;
      setHoles(h => {
        const next = h.map(m => (m && m.until < now ? null : m));
        if (nextSpawn <= 0 && s.left > 0) {
          const empty = next.map((m, i) => (m ? -1 : i)).filter(i => i >= 0);
          if (empty.length) next[empty[Math.floor(Math.random() * empty.length)]] = { gold: Math.random() < M.mole.goldChance, until: now + 800 + Math.random() * 300 };
          nextSpawn = 380 + Math.random() * 380;
        }
        return next;
      });
      if (saveIn <= 0) { saveIn = 1000; setProgress({ ...s }); }
      if (s.left <= 0 && !ended.current) {
        ended.current = true; setProgress({ ...s });
        finish({ points: s.score, headline: s.score ? `${s.bops} BOPS! +${s.score}` : 'NO BOPS', detail: s.bops ? `You bopped ${s.bops} ${s.bops === 1 ? 'mole' : 'moles'} in ${M.mole.seconds} seconds.` : 'They were too quick this time.' });
      }
    }, 50);
    return () => clearInterval(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const bop = (i: number) => {
    const m = holes[i];
    if (!m || state.current.left <= 0) return;
    state.current.score += m.gold ? M.mole.goldMole : M.mole.perMole;
    state.current.bops += 1;
    setHoles(h => h.map((x, j) => (j === i ? null : x)));
    tick(); buzz(m.gold ? [15, 25, 15] : 10);
  };
  const s = state.current;
  return (
    <>
      <div className="w-full flex justify-between items-baseline text-xl"><span className="font-display text-neon-yellow">+{s.score}</span><Secs ms={s.left} warnBelow={3000} /></div>
      <TimeBar ms={s.left} total={M.mole.seconds * 1000} warnBelow={3000} />
      <div className="grid grid-cols-3 gap-2 w-full max-w-[19rem]">
        {holes.map((m, i) => (
          <button key={i} type="button" onPointerDown={e => { e.preventDefault(); bop(i); }} aria-label={m ? (m.gold ? 'Gold mole' : 'Mole') : 'Empty hole'}
            className="aspect-square rounded-full bg-gradient-to-b from-[#3b2a1a] to-[#1c120a] ring-2 ring-[#5c4126] grid place-items-center text-4xl select-none touch-none">
            {m ? <span className="animate-bounce-in-up">{m.gold ? '🌟' : '🐹'}</span> : <span className="w-2/3 h-2 rounded-full bg-black/60" />}
          </button>
        ))}
      </div>
    </>
  );
};

// --- CLAW: claw machine --------------------------------------------------------------------------
const CLAW_PRIZES = [
  { icon: '🧸', trophy: false }, { icon: '🐻', trophy: false }, { icon: '🏆', trophy: true }, { icon: '🦆', trophy: false }, { icon: '🐰', trophy: false },
];
const Claw: React.FC<{ finish: Finish }> = ({ finish }) => {
  const [pos, setPos] = useState(0);
  const [drop, setDrop] = useSaved<{ slot: number; slip: boolean } | null>('claw', null);
  const [stage, setStage] = useState<'aim' | 'down' | 'up' | 'done'>(drop ? 'done' : 'aim');
  const boxRef = useRef<HTMLDivElement>(null);
  const release = () => {
    if (drop) return;
    const slot = Math.round(pos);
    const prize = CLAW_PRIZES[slot];
    const slip = Math.random() < (prize.trophy ? M.claw.trophySlip : M.claw.plushSlip);
    setDrop({ slot, slip }); setStage('down'); soundService.playPowerUp();
    setTimeout(() => { tick(); buzz(15); setStage('up'); }, 700);
    setTimeout(() => { setStage('done'); buzz(slip ? 60 : [20, 30, 20]); if (!slip) soundService.playMilestone(); }, 1700);
  };
  useEffect(() => {
    if (stage !== 'done' || !drop) return;
    const prize = CLAW_PRIZES[drop.slot];
    const points = drop.slip ? 0 : prize.trophy ? M.claw.trophy : M.claw.plush;
    const t = setTimeout(() => finish(drop.slip
      ? { points: 0, headline: 'IT SLIPPED!', detail: `The claw had the ${prize.icon} and let go. Classic claw.` }
      : { points, headline: `GOT THE ${prize.icon}! +${points}`, detail: prize.trophy ? 'The trophy! The claw has chosen.' : 'A plush prize. The claw has chosen.' }), 900);
    return () => clearTimeout(t);
  }, [stage]); // eslint-disable-line react-hooks/exhaustive-deps
  const x = drop ? drop.slot : pos;
  const aimAt = (clientX: number) => {
    const box = boxRef.current?.getBoundingClientRect();
    if (!box || drop) return;
    setPos(Math.max(0, Math.min(4, ((clientX - box.left) / box.width) * 5 - 0.5)));
  };
  const clawY = stage === 'down' ? 150 : stage === 'up' || stage === 'done' ? (drop?.slip && stage === 'done' ? 10 : 10) : 10;
  const carrying = drop && (stage === 'up' || (stage === 'done' && !drop.slip));
  return (
    <>
      <div ref={boxRef} className="relative w-full max-w-[19rem] h-56 rounded-xl bg-gradient-to-b from-[#1b1440] to-crt-950 ring-2 ring-neon-pink/60 overflow-hidden touch-none select-none"
        onPointerDown={e => aimAt(e.clientX)} onPointerMove={e => { if (e.buttons) aimAt(e.clientX); }}>
        <div className="absolute top-2 left-0 right-0 h-1 bg-slate-500/60" />
        <div className="absolute transition-all ease-in-out" style={{ left: `${(x + 0.5) * 20}%`, top: clawY, transform: 'translateX(-50%)', transitionDuration: stage === 'aim' ? '60ms' : '700ms' }}>
          <div className="mx-auto w-0.5 bg-slate-300" style={{ height: 14 }} />
          <div className="text-3xl leading-none -mt-1" aria-hidden="true">🦾</div>
          {carrying && <div className="text-3xl leading-none text-center -mt-1">{CLAW_PRIZES[drop!.slot].icon}</div>}
        </div>
        <div className="absolute bottom-2 left-0 right-0 grid grid-cols-5 text-4xl text-center">
          {CLAW_PRIZES.map((p, i) => <span key={i} className={drop && drop.slot === i && (stage === 'up' || (stage === 'done' && !drop.slip)) ? 'opacity-0' : ''}>{p.icon}</span>)}
        </div>
      </div>
      {!drop ? (
        <div className="w-full flex items-center gap-2">
          <ArcadeButton color="slate" variant="outline" onClick={() => { tick(); setPos(p => Math.max(0, Math.round(p) - 1)); }} aria-label="Move the claw left">◀</ArcadeButton>
          <ArcadeButton color="pink" className="flex-1" onClick={release}>▼ Drop the Claw</ArcadeButton>
          <ArcadeButton color="slate" variant="outline" onClick={() => { tick(); setPos(p => Math.min(4, Math.round(p) + 1)); }} aria-label="Move the claw right">▶</ArcadeButton>
        </div>
      ) : <p className="text-slate-300">{stage === 'done' ? (drop.slip ? 'It slipped…' : 'Got it!') : 'The claw descends…'}</p>}
    </>
  );
};

// --- DART: darts --------------------------------------------------------------------------------
const BOARD_R = 120;
const Darts: React.FC<{ finish: Finish }> = ({ finish }) => {
  const [throws, setThrows] = useSaved<{ x: number; y: number; pts: number }[]>('darts', []);
  const t = useClock(throws.length < M.darts.darts);
  const cx = Math.sin(t * 1.7) * BOARD_R * 0.85, cy = Math.sin(t * 2.3 + 1) * BOARD_R * 0.75;
  const throwDart = () => {
    if (throws.length >= M.darts.darts) return;
    const x = cx + (Math.random() - 0.5) * 10, y = cy + (Math.random() - 0.5) * 10;
    const pts = dartPoints(Math.hypot(x, y), BOARD_R);
    const next = [...throws, { x, y, pts }];
    setThrows(next); tick(); buzz(pts >= M.darts.bull ? [20, 30, 20] : 12);
    if (next.length >= M.darts.darts) {
      const sum = next.reduce((s, d) => s + d.pts, 0);
      setTimeout(() => finish({ points: sum, headline: sum ? `${sum} POINTS!` : 'ALL MISSES', detail: `Your darts: ${next.map(d => d.pts || 'miss').join(', ')}.` }), 700);
    }
  };
  return (
    <>
      <p className="font-display text-xl text-neon-yellow">{throws.reduce((s, d) => s + d.pts, 0)} · {M.darts.darts - throws.length} {M.darts.darts - throws.length === 1 ? 'dart' : 'darts'} left</p>
      <svg viewBox="-140 -140 280 280" className="w-full max-w-[17rem] select-none" role="img" aria-label="Dartboard">
        <circle r={BOARD_R} fill="#1d1d2b" stroke="#ffe27a" strokeWidth={3} />
        <circle r={BOARD_R * 0.45} fill="#2a2440" stroke="#ff4dc4" strokeWidth={3} />
        <circle r={BOARD_R * 0.12} fill="#ff2d55" />
        <text y={-BOARD_R * 0.7} textAnchor="middle" fontSize={11} fill="#ffe27a" fontFamily="monospace">{M.darts.outer}</text>
        <text y={-BOARD_R * 0.27} textAnchor="middle" fontSize={11} fill="#ff4dc4" fontFamily="monospace">{M.darts.inner}</text>
        {throws.map((d, i) => <text key={i} x={d.x} y={d.y + 6} textAnchor="middle" fontSize={20}>📍</text>)}
        {throws.length < M.darts.darts && (
          <g transform={`translate(${cx} ${cy})`} stroke="#3dff8c" strokeWidth={2}>
            <circle r={9} fill="none" /><line x1={-14} x2={14} /><line y1={-14} y2={14} />
          </g>
        )}
      </svg>
      {throws.length < M.darts.darts && <ArcadeButton color="green" className="w-full" onClick={throwDart}>🎯 Throw!</ArcadeButton>}
    </>
  );
};

// --- GOAL: penalty shootout ---------------------------------------------------------------------
const ZONES = [{ id: 'TL', x: 18, y: 25 }, { id: 'TR', x: 82, y: 25 }, { id: 'C', x: 50, y: 50 }, { id: 'BL', x: 18, y: 75 }, { id: 'BR', x: 82, y: 75 }];
const Goal: React.FC<{ finish: Finish }> = ({ finish }) => {
  const [kicks, setKicks] = useSaved<{ aim: number; keeper: number }[]>('goal', []);
  const [anim, setAnim] = useState(false);
  const last = kicks[kicks.length - 1];
  const goals = kicks.filter(k => k.aim !== k.keeper).length;
  const kick = (aim: number) => {
    if (anim || kicks.length >= M.goal.kicks) return;
    const keeper = Math.floor(Math.random() * ZONES.length);
    const next = [...kicks, { aim, keeper }];
    setKicks(next); setAnim(true); tick();
    setTimeout(() => {
      setAnim(false);
      const scored = aim !== keeper;
      buzz(scored ? [20, 30, 20] : 60);
      if (scored) soundService.playMilestone();
      if (next.length >= M.goal.kicks) {
        const g = next.filter(k => k.aim !== k.keeper).length;
        const pts = goalPrize(g);
        setTimeout(() => finish({ points: pts, headline: g === M.goal.kicks ? `HAT TRICK! +${pts}` : g ? `${g} ${g === 1 ? 'GOAL' : 'GOALS'}! +${pts}` : 'ALL SAVED', detail: `You scored ${g} of ${M.goal.kicks}.` }), 600);
      }
    }, 650);
  };
  return (
    <>
      <p className="font-display text-xl text-neon-yellow">{goals} {goals === 1 ? 'goal' : 'goals'} · kick {Math.min(kicks.length + 1, M.goal.kicks)} of {M.goal.kicks}</p>
      <div className="relative w-full max-w-[19rem] aspect-[16/10] rounded-t-xl border-4 border-b-0 border-white bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.08)_0_6px,transparent_6px_12px)] bg-crt-950">
        {ZONES.map((z, i) => (
          <button key={z.id} type="button" onClick={() => kick(i)} disabled={anim || kicks.length >= M.goal.kicks} aria-label={`Kick to ${z.id}`}
            className="absolute w-14 h-12 -translate-x-1/2 -translate-y-1/2 rounded-lg ring-2 ring-neon-green/50 hover:bg-neon-green/20 disabled:opacity-60" style={{ left: `${z.x}%`, top: `${z.y}%` }} />
        ))}
        {last && <span className="absolute text-4xl -translate-x-1/2 -translate-y-1/2 transition-all duration-500" style={{ left: `${ZONES[last.keeper].x}%`, top: `${ZONES[last.keeper].y}%` }} aria-hidden="true">🧤</span>}
        {!last && <span className="absolute text-4xl -translate-x-1/2 -translate-y-1/2" style={{ left: '50%', top: '55%' }} aria-hidden="true">🧤</span>}
        {last && <span className="absolute text-3xl -translate-x-1/2 -translate-y-1/2 transition-all duration-500" style={{ left: `${ZONES[last.aim].x}%`, top: `${anim ? 110 : ZONES[last.aim].y}%` }} aria-hidden="true">⚽</span>}
      </div>
      <p className="text-slate-300 min-h-[1.5rem]">{!last ? 'Tap a spot in the net.' : anim ? 'Shoots…' : last.aim !== last.keeper ? 'GOAL!' : 'Saved!'}</p>
    </>
  );
};

// --- DICE: roll, hold, reroll once ----------------------------------------------------------------
const FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
const Dice: React.FC<{ finish: Finish }> = ({ finish }) => {
  const [dice, setDice] = useSaved<number[] | null>('dice', null);
  const [rerolled, setRerolled] = useSaved('rerolled', false);
  const [held, setHeld] = useState([false, false, false]);
  const [rolling, setRolling] = useState(false);
  const [shown, setShown] = useState<number[]>(dice ?? [1, 1, 1]);
  const roll = (keep: boolean[]) => {
    const base = dice ?? [1, 1, 1];
    const result = base.map((d, i) => (keep[i] ? d : 1 + Math.floor(Math.random() * 6)));
    setRolling(true); soundService.playPowerUp();
    let n = 0;
    const spin = setInterval(() => { setShown(base.map((d, i) => (keep[i] ? d : 1 + Math.floor(Math.random() * 6)))); tick(); if (++n >= 8) { clearInterval(spin); setShown(result); setRolling(false); buzz(15); } }, 75);
    return result;
  };
  const first = () => { const r = roll([false, false, false]); setDice(r); };
  const settle = (final: number[]) => {
    const p = dicePrize(final);
    setTimeout(() => finish({ points: p.points, headline: `${p.label}! +${p.points}`, detail: `You rolled ${final.map(d => FACES[d - 1]).join(' ')}.` }), 800);
  };
  const second = () => { const r = roll(held); setDice(r); setRerolled(true); setTimeout(() => settle(r), 700); };
  const keepAll = () => { setRerolled(true); settle(dice!); };
  return (
    <>
      <div className="flex gap-3">
        {shown.map((d, i) => (
          <button key={i} type="button" disabled={!dice || rerolled || rolling} onClick={() => { tick(); setHeld(h => h.map((x, j) => (j === i ? !x : x))); }}
            className={`w-20 h-20 rounded-xl text-6xl leading-none grid place-items-center bg-white text-crt-900 ring-4 ${held[i] ? 'ring-neon-yellow -translate-y-1' : 'ring-transparent'} ${rolling && !held[i] ? 'cereal-shake' : ''}`}
            aria-label={`Die ${i + 1}: ${d}${held[i] ? ', kept' : ''}`}>{FACES[d - 1]}</button>
        ))}
      </div>
      {dice && !rerolled && !rolling && <p className="text-slate-300 text-sm">Tap dice to keep them (gold ring), then reroll the rest.</p>}
      {!dice ? <ArcadeButton color="green" className="w-full" onClick={first}>🎲 Roll!</ArcadeButton>
        : !rerolled && !rolling ? (
          <div className="w-full flex flex-col gap-2">
            <ArcadeButton color="green" className="w-full" onClick={second} disabled={held.every(Boolean)}>🎲 Reroll the rest</ArcadeButton>
            <ArcadeButton color="slate" variant="outline" className="w-full" onClick={keepAll}>Keep these</ArcadeButton>
          </div>
        ) : null}
    </>
  );
};

// --- BOWL: one frame ------------------------------------------------------------------------------
const PIN_SPOTS = [[0, 0], [-1, 1], [1, 1], [-2, 2], [0, 2], [2, 2], [-3, 3], [-1, 3], [1, 3], [3, 3]];
const Bowl: React.FC<{ finish: Finish }> = ({ finish }) => {
  const [balls, setBalls] = useSaved<{ aim: number; down: number[] }[]>('bowl', []);
  const [rolling, setRolling] = useState<number | null>(null);
  const over = balls.length === 2 || (balls.length === 1 && balls[0].down.length === 10);
  const t = useClock(!over && rolling === null);
  const aim = Math.sin(t * 2.4);
  const downSet = new Set(balls.flatMap(b => b.down));
  const roll = () => {
    if (over || rolling !== null) return;
    const offset = Math.abs(aim);
    const standing = PIN_SPOTS.map((_, i) => i).filter(i => !downSet.has(i));
    const count = balls.length === 0 ? bowlFirstBall(offset) : bowlSecondBall(offset, standing.length);
    // Which pins: the ones nearest the line the ball took.
    const down = [...standing].sort((a, b) => Math.abs(PIN_SPOTS[a][0] - aim * 3) - Math.abs(PIN_SPOTS[b][0] - aim * 3)).slice(0, count);
    setRolling(aim); soundService.playPowerUp();
    setTimeout(() => {
      const next = [...balls, { aim, down }];
      setBalls(next); setRolling(null); tick(); buzz(count >= 8 ? [20, 30, 20] : 15);
      const first = next[0].down.length, second = next[1]?.down.length ?? 0;
      if (first === 10 || next.length === 2) {
        const p = bowlPrize(first, second);
        if (first === 10 || first + second === 10) soundService.playMilestone();
        setTimeout(() => finish({ points: p.points, headline: `${p.label} +${p.points}`, detail: first === 10 ? 'All ten on the first ball.' : `First ball ${first}, second ball ${second}.` }), 800);
      }
    }, 900);
  };
  const laneX = (a: number) => 50 + a * 38;
  return (
    <>
      <p className="font-display text-xl text-neon-yellow">{balls.length === 0 ? 'First ball' : over ? 'Frame over' : `Spare ball: ${10 - downSet.size} standing`}</p>
      <div className="relative w-40 h-64 rounded-t-[2rem] bg-gradient-to-b from-[#c9955b] to-[#a8743d] ring-4 ring-[#5c3a1c] overflow-hidden">
        {PIN_SPOTS.map(([x, y], i) => (
          <span key={i} className={`absolute w-3 h-5 rounded-full bg-white shadow -translate-x-1/2 transition-all duration-300 ${downSet.has(i) ? 'opacity-0 rotate-90' : ''}`} style={{ left: `${50 + x * 11}%`, top: `${8 + y * 9}%` }} aria-hidden="true">
            <span className="absolute left-0 right-0 top-1.5 h-0.5 bg-neon-red" />
          </span>
        ))}
        <span className="absolute text-2xl leading-none -translate-x-1/2 transition-all ease-in" style={{ left: `${laneX(rolling ?? aim)}%`, top: rolling !== null ? '5%' : '86%', transitionDuration: rolling !== null ? '850ms' : '0ms' }} aria-hidden="true">⚫</span>
        {rolling === null && !over && <div className="absolute bottom-10 h-16 w-0.5 bg-neon-yellow origin-bottom" style={{ left: '50%', transform: `rotate(${aim * 28}deg)` }} />}
      </div>
      {!over && <ArcadeButton color="green" className="w-full" onClick={roll} disabled={rolling !== null}>🎳 Roll!</ArcadeButton>}
    </>
  );
};

// --- TEE: mini golf -----------------------------------------------------------------------------
const Golf: React.FC<{ finish: Finish }> = ({ finish }) => {
  const [shots, setShots] = useSaved<{ power: number; pos: number; sunk: boolean }[]>('golf', []);
  const pos = shots.length ? shots[shots.length - 1].pos : 0;
  const sunk = shots.some(s => s.sunk);
  const over = sunk || shots.length >= M.golf.strokes;
  const remaining = Math.abs(100 - pos);
  const maxPower = Math.max(30, Math.min(130, remaining * 1.6));
  const t = useClock(!over);
  const power = ((1 - Math.cos(t * 2.4)) / 2) * maxPower;
  const swing = () => {
    if (over) return;
    const r = golfStroke(pos, power);
    const next = [...shots, { power, pos: r.pos, sunk: r.sunk }];
    setShots(next); tick(); buzz(r.sunk ? [20, 30, 20] : 10);
    if (r.sunk || next.length >= M.golf.strokes) {
      const prize = golfPrize(next.length, r.sunk);
      if (r.sunk) soundService.playMilestone();
      setTimeout(() => finish({ points: prize, headline: r.sunk ? (next.length === 1 ? `HOLE IN ONE! +${prize}` : `IN IN ${next.length}! +${prize}`) : 'NO PUTT FOR YOU', detail: r.sunk ? `Sunk in ${next.length} ${next.length === 1 ? 'stroke' : 'strokes'}.` : `Still ${Math.round(Math.abs(100 - r.pos))} away after ${M.golf.strokes} strokes.` }), 900);
    }
  };
  const x = (p: number) => 8 + Math.max(-5, Math.min(130, p)) * 0.72;
  return (
    <>
      <p className="font-display text-xl text-neon-yellow">{over ? (sunk ? 'In the cup!' : 'Out of strokes') : `Stroke ${shots.length + 1} of ${M.golf.strokes}`}</p>
      <div className="relative w-full max-w-[19rem] h-24 rounded-full bg-gradient-to-r from-[#1e7a3a] to-[#2fa04f] ring-4 ring-[#14532d] overflow-hidden">
        <span className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-black/80" style={{ left: `calc(${x(100)}% - 8px)` }} />
        <span className="absolute text-2xl leading-none" style={{ left: `calc(${x(100)}% - 4px)`, top: '8%' }} aria-hidden="true">⛳</span>
        <span className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white shadow transition-all duration-700 ease-out" style={{ left: `calc(${x(sunk ? 100 : pos)}% - 7px)` }} />
      </div>
      {!over && (
        <>
          <div className="w-full max-w-[19rem]">
            <div className="h-5 rounded-full bg-crt-950 ring-1 ring-white/20 overflow-hidden relative">
              <div className="h-full bg-gradient-to-r from-neon-cyan/70 to-neon-pink/70" style={{ width: `${(power / maxPower) * 100}%` }} />
              {/* The target band sits on top of the fill so it's always visible. */}
              <div className="absolute inset-y-0 bg-neon-green/60 ring-2 ring-neon-green" style={{ left: `${((remaining - GOLF_CUP) / maxPower) * 100}%`, width: `${((GOLF_CUP * 2) / maxPower) * 100}%` }} />
            </div>
            <p className="text-xs text-slate-400 mt-1">Stop the bar in the green band to sink it.</p>
          </div>
          <ArcadeButton color="green" className="w-full" onClick={swing}>⛳ Putt!</ArcadeButton>
        </>
      )}
    </>
  );
};

// --- NET: free throws ---------------------------------------------------------------------------
const Hoops: React.FC<{ finish: Finish }> = ({ finish }) => {
  const [shots, setShots] = useSaved<('swish' | 'bank' | 'miss')[]>('hoops', []);
  const [flying, setFlying] = useState<null | 'swish' | 'bank' | 'miss'>(null);
  const over = shots.length >= M.hoops.shots;
  const t = useClock(!over && !flying);
  const needle = Math.sin(t * 3.1);
  const shoot = () => {
    if (over || flying) return;
    const r = hoopShot(Math.abs(needle));
    setFlying(r); tick();
    setTimeout(() => {
      const next = [...shots, r];
      setShots(next); setFlying(null); buzz(r === 'miss' ? 60 : [15, 25, 15]);
      if (r === 'swish') soundService.playMilestone();
      if (next.length >= M.hoops.shots) {
        const pts = hoopsPrize(next);
        const swishes = next.filter(s => s === 'swish').length;
        setTimeout(() => finish({ points: pts, headline: swishes === M.hoops.shots ? `NOTHING BUT NET! +${pts}` : pts ? `${pts} POINTS!` : 'BRICK CITY', detail: `Your shots: ${next.map(s => (s === 'swish' ? 'swish' : s === 'bank' ? 'off the glass' : 'miss')).join(', ')}.` }), 600);
      }
    }, 750);
  };
  const last = flying ?? shots[shots.length - 1];
  return (
    <>
      <p className="font-display text-xl text-neon-yellow">{hoopsPrize(shots)} · shot {Math.min(shots.length + 1, M.hoops.shots)} of {M.hoops.shots}</p>
      <div className="relative w-full max-w-[19rem] h-40 rounded-xl bg-gradient-to-b from-crt-800 to-crt-950 ring-1 ring-white/15 overflow-hidden">
        <div className="absolute left-1/2 -translate-x-1/2 top-3 w-24 h-14 border-2 border-white/70 rounded-sm" />
        <div className="absolute left-1/2 -translate-x-1/2 top-[3.6rem] w-14 h-1.5 bg-neon-orange rounded-full" />
        <span className="absolute text-3xl leading-none -translate-x-1/2 transition-all ease-out" style={{ left: flying ? (flying === 'miss' ? '72%' : '50%') : '50%', top: flying ? (flying === 'miss' ? '45%' : '28%') : '78%', transitionDuration: flying ? '650ms' : '0ms' }} aria-hidden="true">🏀</span>
        {!flying && last && <span className="absolute right-2 bottom-2 osd-text text-lg text-slate-300">{last === 'swish' ? 'SWISH!' : last === 'bank' ? 'OFF THE GLASS' : 'MISS'}</span>}
      </div>
      {!over && (
        <>
          <div className="relative w-full max-w-[19rem] h-5 rounded-full bg-crt-950 ring-1 ring-white/20 overflow-hidden">
            <div className="absolute inset-y-0 left-[32.5%] w-[35%] bg-neon-yellow/25" />
            <div className="absolute inset-y-0 left-[42.5%] w-[15%] bg-neon-green/50" />
            <div className="absolute inset-y-0 w-1 bg-white" style={{ left: `${50 + needle * 49}%` }} />
          </div>
          <ArcadeButton color="green" className="w-full" onClick={shoot} disabled={!!flying}>🏀 Shoot!</ArcadeButton>
        </>
      )}
    </>
  );
};


// --- v7.46.0 arcade games ---------------------------------------------------------------------

// RING: ring toss (the darts board as a carnival bottle).
const RingToss: React.FC<{ finish: Finish }> = ({ finish }) => {
  const R = M.ringToss;
  const [tosses, setTosses] = useSaved<{ x: number; y: number; pts: number }[]>('rings', []);
  const t = useClock(tosses.length < R.rings);
  const cx = Math.sin(t * 1.5 + 0.4) * BOARD_R * 0.8, cy = Math.sin(t * 2.1) * BOARD_R * 0.7;
  const toss = () => {
    if (tosses.length >= R.rings) return;
    const x = cx + (Math.random() - 0.5) * 12, y = cy + (Math.random() - 0.5) * 12;
    const pts = ringTossPoints(Math.hypot(x, y), BOARD_R);
    const next = [...tosses, { x, y, pts }];
    setTosses(next); tick(); buzz(pts >= R.ringer ? [20, 30, 20] : 12);
    if (pts >= R.ringer) soundService.playMilestone();
    if (next.length >= R.rings) {
      const sum = next.reduce((a, d) => a + d.pts, 0);
      const label = (p: number) => (p >= R.ringer ? 'ringer' : p >= R.rim ? 'rim' : p > 0 ? 'close' : 'miss');
      setTimeout(() => finish({ points: sum, headline: sum ? `${sum} POINTS!` : 'NO PRIZE', detail: `Your rings: ${next.map(d => label(d.pts)).join(', ')}.` }), 700);
    }
  };
  return (
    <>
      <p className="font-display text-xl text-neon-yellow">{tosses.reduce((a, d) => a + d.pts, 0)} · {R.rings - tosses.length} {R.rings - tosses.length === 1 ? 'ring' : 'rings'} left</p>
      <svg viewBox="-140 -140 280 280" className="w-full max-w-[17rem] select-none" role="img" aria-label="Ring toss: a bottle in the middle">
        <rect x={-BOARD_R} y={-BOARD_R} width={BOARD_R * 2} height={BOARD_R * 2} rx={18} fill="#2a1630" stroke="#ff4dc4" strokeWidth={3} />
        <circle r={BOARD_R * 0.75} fill="none" stroke="#ffe27a" strokeWidth={1.5} strokeDasharray="4 6" />
        <circle r={BOARD_R * 0.4} fill="none" stroke="#3dff8c" strokeWidth={1.5} strokeDasharray="4 6" />
        <text y={10} textAnchor="middle" fontSize={34}>🍾</text>
        {tosses.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={13} fill="none" stroke={d.pts >= M.ringToss.ringer ? '#3dff8c' : '#ffe27a'} strokeWidth={4} />)}
        {tosses.length < R.rings && <circle cx={cx} cy={cy} r={13} fill="none" stroke="#ff4dc4" strokeWidth={4} strokeDasharray="6 3" />}
      </svg>
      {tosses.length < R.rings && <ArcadeButton color="pink" className="w-full" onClick={toss}>🎪 Toss!</ArcadeButton>}
    </>
  );
};

// NOTE: repeat the riff.
const RIFF_PADS = [
  { label: 'Green', on: 'bg-neon-green', off: 'bg-neon-green/25' },
  { label: 'Red', on: 'bg-neon-red', off: 'bg-neon-red/25' },
  { label: 'Yellow', on: 'bg-neon-yellow', off: 'bg-neon-yellow/25' },
  { label: 'Blue', on: 'bg-neon-cyan', off: 'bg-neon-cyan/25' },
];
const Riff: React.FC<{ finish: Finish }> = ({ finish }) => {
  const R = M.riff;
  const maxLen = R.lengths[R.lengths.length - 1];
  const [seq] = useSaved<number[]>('riffSeq', () => Array.from({ length: maxLen }, () => Math.floor(Math.random() * 4)));
  const [state, setState] = useSaved('riff', { round: 0, cleared: 0 });
  const [phase, setPhase] = useState<'watch' | 'play' | 'done'>('watch');
  const [lit, setLit] = useState<number | null>(null);
  const [pos, setPos] = useState(0);
  const ended = useRef(false);
  const len = R.lengths[Math.min(state.round, R.lengths.length - 1)];
  const end = (cleared: number) => {
    if (ended.current) return; ended.current = true; setPhase('done');
    const pts = riffPrize(cleared);
    setTimeout(() => finish({ points: pts, headline: cleared >= R.lengths.length ? `ROCK GOD! +${pts}` : pts ? `${cleared} ${cleared === 1 ? 'RIFF' : 'RIFFS'}: +${pts}` : 'OFF KEY', detail: `You played back ${cleared} of ${R.lengths.length} riffs.` }), 700);
  };
  // Show the riff, one pad at a time.
  useEffect(() => {
    if (phase !== 'watch' || ended.current) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < len; i++) {
      timers.push(setTimeout(() => { setLit(seq[i]); tick(); }, 500 + i * R.stepMs));
      timers.push(setTimeout(() => setLit(null), 500 + i * R.stepMs + R.stepMs * 0.6));
    }
    timers.push(setTimeout(() => { setPos(0); setPhase('play'); }, 500 + len * R.stepMs));
    return () => timers.forEach(clearTimeout);
  }, [phase, state.round]); // eslint-disable-line react-hooks/exhaustive-deps
  const press = (pad: number) => {
    if (phase !== 'play' || ended.current) return;
    setLit(pad); setTimeout(() => setLit(l => (l === pad ? null : l)), 180);
    if (pad !== seq[pos]) { buzz(80); soundService.playInvalidWord(); end(state.cleared); return; }
    tick(); buzz(8);
    if (pos + 1 < len) { setPos(pos + 1); return; }
    const cleared = state.cleared + 1;
    soundService.playMilestone();
    if (cleared >= R.lengths.length) { setState({ round: cleared, cleared }); end(cleared); return; }
    setState({ round: cleared, cleared });
    setPhase('watch');
  };
  return (
    <>
      <p className="font-display text-xl text-neon-yellow">Riff {Math.min(state.round + 1, R.lengths.length)} of {R.lengths.length} · {len} notes</p>
      <p className="osd-text text-lg text-slate-300 min-h-[1.5rem]" aria-live="polite">{phase === 'watch' ? 'WATCH…' : phase === 'play' ? `YOUR TURN · ${pos}/${len}` : ''}</p>
      <div className="grid grid-cols-2 gap-3 w-full max-w-[16rem]">
        {RIFF_PADS.map((p, i) => (
          <button key={i} type="button" aria-label={`${p.label} pad`} onPointerDown={e => { e.preventDefault(); press(i); }}
            className={`h-24 rounded-2xl ring-2 ring-white/20 transition-colors duration-75 select-none touch-none ${lit === i ? `${p.on} shadow-[0_0_24px_currentColor]` : p.off}`} />
        ))}
      </div>
    </>
  );
};

// NAIL: high striker.
const Striker: React.FC<{ finish: Finish }> = ({ finish }) => {
  const S = M.striker;
  const [swings, setSwings] = useSaved<('bell' | 'close' | 'low')[]>('striker', []);
  const [flying, setFlying] = useState<number | null>(null);
  const over = swings.length >= S.swings;
  const t = useClock(!over && flying === null);
  const power = (Math.sin(t * 3.4 - Math.PI / 2) + 1) / 2; // 0..1
  const swing = () => {
    if (over || flying !== null) return;
    const p = power, r = strikerSwing(p);
    setFlying(p); soundService.playPowerUp();
    setTimeout(() => {
      const next = [...swings, r];
      setSwings(next); setFlying(null); buzz(r === 'bell' ? [20, 40, 20] : 15);
      if (r === 'bell') soundService.playMilestone(); else tick();
      if (next.length >= S.swings) {
        const pts = strikerPrize(next);
        setTimeout(() => finish({ points: pts, headline: next.every(x => x === 'bell') ? `DING DING DING! +${pts}` : `${pts} POINTS!`, detail: `Your swings: ${next.map(x => (x === 'bell' ? 'bell' : x === 'close' ? 'so close' : 'low')).join(', ')}.` }), 600);
      }
    }, 800);
  };
  const height = flying ?? 0;
  return (
    <>
      <p className="font-display text-xl text-neon-yellow">{strikerPrize(swings)} · swing {Math.min(swings.length + 1, S.swings)} of {S.swings}</p>
      <div className="flex items-end gap-4">
        <div className="relative w-10 h-56 rounded-full bg-crt-950 ring-2 ring-white/20 overflow-hidden" aria-hidden="true">
          <span className="absolute left-1/2 -translate-x-1/2 top-1 text-2xl leading-none">🔔</span>
          <div className="absolute inset-x-0 top-[10%] h-[15%] bg-neon-green/30" />
          <span className="absolute left-1/2 -translate-x-1/2 w-6 h-4 rounded bg-neon-pink transition-all ease-out" style={{ bottom: `${4 + height * 84}%`, transitionDuration: flying !== null ? '650ms' : '0ms' }} />
        </div>
        {!over && (
          <div className="relative w-5 h-56 rounded-full bg-crt-950 ring-1 ring-white/20 overflow-hidden" aria-hidden="true">
            <div className="absolute inset-x-0 top-0 h-[10%] bg-neon-green/50" />
            <div className="absolute inset-x-0 top-[10%] h-[25%] bg-neon-yellow/25" />
            <div className="absolute inset-x-0 h-1 bg-white" style={{ bottom: `${power * 100}%` }} />
          </div>
        )}
      </div>
      {!over && <ArcadeButton color="pink" className="w-full" onClick={swing} disabled={flying !== null}>🔨 Swing!</ArcadeButton>}
    </>
  );
};

// TIRE: pit stop.
const PitStop: React.FC<{ finish: Finish }> = ({ finish }) => {
  const P = M.pitStop;
  const [left, setLeft] = useState<number[]>(() => Array(P.tires).fill(P.taps));
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [doneIn, setDoneIn] = useState<number | null>(null);
  const now = useClock(startedAt !== null && doneIn === null);
  const tap = (i: number) => {
    if (doneIn !== null || left[i] <= 0) return;
    const start = startedAt ?? performance.now();
    if (startedAt === null) setStartedAt(start);
    const next = left.map((n, j) => (j === i ? n - 1 : n));
    setLeft(next); tick(); buzz(6);
    if (next.every(n => n === 0)) {
      const secs = Math.round((performance.now() - start) / 100) / 10;
      setDoneIn(secs);
      const pts = pitStopPrize(secs);
      if (secs < P.tiers[0].under) soundService.playMilestone();
      setTimeout(() => finish({ points: pts, headline: `${secs.toFixed(1)} SECONDS: +${pts}`, detail: secs < P.tiers[0].under ? 'Ka-chow! Back on track before the field went by.' : 'All four on. Back out there!' }), 700);
    }
  };
  const shown = doneIn ?? (startedAt === null ? 0 : now);
  return (
    <>
      <p className="font-display text-3xl text-neon-yellow tabular-nums" role="timer" aria-label={`${shown.toFixed(1)} seconds`}>{shown.toFixed(1)}<span className="font-sans text-sm font-semibold lowercase ml-1">sec</span></p>
      <p className="osd-text text-lg text-slate-300">{startedAt === null ? 'TAP A TIRE TO START' : doneIn !== null ? 'GO GO GO!' : `${left.reduce((a, b) => a + b, 0)} TAPS TO GO`}</p>
      <div className="relative w-56 h-64 rounded-[2.5rem] bg-gradient-to-b from-neon-red/40 to-neon-red/10 ring-2 ring-neon-red/60" aria-hidden={false}>
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-5xl" aria-hidden="true">🏎️</span>
        {left.map((n, i) => (
          <button key={i} type="button" aria-label={`Tire ${i + 1}: ${n} taps left`} onPointerDown={e => { e.preventDefault(); tap(i); }}
            className={`absolute w-16 h-20 rounded-xl grid place-items-center font-display text-2xl select-none touch-none ring-4 ${n === 0 ? 'bg-neon-green text-crt-900 ring-neon-green' : 'bg-crt-950 text-white ring-slate-500 active:scale-95'}`}
            style={{ left: i % 2 ? 'auto' : '-1.25rem', right: i % 2 ? '-1.25rem' : 'auto', top: i < 2 ? '0.75rem' : 'auto', bottom: i < 2 ? 'auto' : '0.75rem' }}>
            {n === 0 ? '✓' : n}
          </button>
        ))}
      </div>
    </>
  );
};

// RIDE: loop the loop.
const Coaster: React.FC<{ finish: Finish }> = ({ finish }) => {
  const C = M.coaster;
  const [rides, setRides] = useSaved<('clean' | 'wobbly' | 'stall' | 'flyoff')[]>('coaster', []);
  const [holding, setHolding] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const over = rides.length >= C.rides;
  useClock(holding); // redraws while held
  const holdStart = useRef(0);
  // Each ride starts from zero (the shared clock would carry on from the last ride).
  const speed = holding ? Math.min(1, (performance.now() - holdStart.current) / 1700) : 0;
  const lastSpeed = useRef(0);
  if (holding) lastSpeed.current = speed;
  const start = () => { if (over || result) return; holdStart.current = performance.now(); setHolding(true); soundService.playPowerUp(); };
  const release = () => {
    if (!holding) return;
    setHolding(false);
    const r = coasterRide(lastSpeed.current);
    setResult(r === 'clean' ? 'CLEAN LOOP!' : r === 'wobbly' ? 'MADE IT (WOBBLY)' : r === 'stall' ? 'STALLED' : 'FLEW OFF!');
    buzz(r === 'clean' ? [20, 40, 20] : r === 'wobbly' ? 20 : 70);
    if (r === 'clean') soundService.playMilestone(); else tick();
    setTimeout(() => {
      const next = [...rides, r];
      setRides(next); setResult(null);
      if (next.length >= C.rides) {
        const pts = coasterPrize(next);
        setTimeout(() => finish({ points: pts, headline: next.every(x => x === 'clean') ? `PERFECT RIDES! +${pts}` : pts ? `${pts} POINTS!` : 'RIDE CLOSED', detail: `Your rides: ${next.map(x => (x === 'clean' ? 'clean' : x === 'wobbly' ? 'wobbly' : x === 'stall' ? 'stalled' : 'flew off')).join(', ')}.` }), 400);
      }
    }, 1100);
  };
  return (
    <>
      <p className="font-display text-xl text-neon-yellow">{coasterPrize(rides)} · ride {Math.min(rides.length + 1, C.rides)} of {C.rides}</p>
      <div className="relative w-full max-w-[19rem] h-36 rounded-xl bg-gradient-to-b from-crt-800 to-crt-950 ring-1 ring-white/15 grid place-items-center" aria-live="polite">
        <span className="text-6xl" aria-hidden="true">🎢</span>
        {result && <span className="absolute bottom-2 font-display text-xl text-white">{result}</span>}
      </div>
      {!over && (
        <>
          <div className="relative w-full max-w-[19rem] h-5 rounded-full bg-crt-950 ring-1 ring-white/20 overflow-hidden" aria-label="Speed">
            <div className="absolute inset-y-0 left-[58%] w-[10%] bg-neon-yellow/30" />
            <div className="absolute inset-y-0 left-[68%] w-[14%] bg-neon-green/50" />
            <div className="absolute inset-y-0 left-[82%] w-[10%] bg-neon-yellow/30" />
            <div className="absolute inset-y-0 left-[92%] right-0 bg-neon-red/40" />
            <div className="absolute inset-y-0 left-0 bg-white/20" style={{ width: `${(holding ? speed : 0) * 100}%` }} />
            <div className="absolute inset-y-0 w-1 bg-white" style={{ left: `${(holding ? speed : 0) * 100}%` }} />
          </div>
          <button type="button" aria-label="Hold to build speed, let go to launch"
            onPointerDown={e => { e.preventDefault(); start(); }} onPointerUp={release} onPointerLeave={release} onPointerCancel={release}
            className={`w-full rounded-xl py-4 font-display text-xl select-none touch-none ${holding ? 'bg-neon-yellow text-crt-900' : 'bg-neon-pink text-white'}`}>
            {holding ? 'LET GO IN THE GREEN!' : '🎢 HOLD TO GO'}
          </button>
        </>
      )}
    </>
  );
};

// SEAL: balance act.
const Seal: React.FC<{ finish: Finish }> = ({ finish }) => {
  const S = M.seal;
  const ball = useRef({ x: 0, v: 0 });
  const [, setFrame] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [started, setStarted] = useState(false);
  const done = useRef(false);
  useEffect(() => {
    if (!started) return;
    let raf = 0, last = performance.now(), total = 0, wobble = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (done.current) return;
      total += dt; wobble += dt;
      const b = ball.current;
      // The ball keeps rolling the way it leans, plus a random push now and then.
      b.v += b.x * 1.3 * dt + (Math.random() - 0.5) * 1.8 * dt;
      if (wobble > 0.9) { wobble = 0; b.v += (Math.random() - 0.5) * 0.5; }
      b.x += b.v * dt;
      setFrame(f => f + 1); setElapsed(total);
      if (Math.abs(b.x) > 1 || total >= S.seconds) {
        done.current = true;
        const secs = Math.floor(Math.min(total, S.seconds));
        const pts = sealPrize(total >= S.seconds ? S.seconds : secs);
        if (total >= S.seconds) soundService.playMilestone(); else { soundService.playInvalidWord(); buzz(70); }
        setTimeout(() => finish({ points: pts, headline: total >= S.seconds ? `TAKE A BOW! +${pts}` : `${secs} ${secs === 1 ? 'SECOND' : 'SECONDS'}: +${pts}`, detail: total >= S.seconds ? 'The ball never touched the water. Arf arf!' : 'The ball rolled off into the pool.' }), 600);
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [started]); // eslint-disable-line react-hooks/exhaustive-deps
  const nudge = (dir: number) => { if (!started) setStarted(true); ball.current.v += dir * 0.55; tick(); buzz(5); };
  const x = ball.current.x;
  return (
    <>
      <p className="font-display text-2xl text-neon-yellow tabular-nums">{Math.min(S.seconds, elapsed).toFixed(1)}<span className="font-sans text-sm font-semibold lowercase ml-1">sec</span> / {S.seconds}</p>
      <div className="relative w-full max-w-[19rem] h-44 rounded-xl bg-gradient-to-b from-[#0b2a44] to-[#05182b] ring-1 ring-white/15 overflow-hidden" aria-label={`Ball ${Math.abs(x) < 0.3 ? 'steady' : x < 0 ? 'leaning left' : 'leaning right'}`}>
        <span className="absolute text-3xl leading-none -translate-x-1/2 transition-none" style={{ left: `${50 + x * 40}%`, top: '18%' }} aria-hidden="true">⚽</span>
        <span className="absolute left-1/2 -translate-x-1/2 bottom-2 text-6xl leading-none" aria-hidden="true">🦭</span>
        <div className="absolute inset-x-0 bottom-0 h-2 bg-neon-cyan/30" />
      </div>
      <p className="osd-text text-lg text-slate-300">{started ? 'KEEP IT UP!' : 'TAP ◀ OR ▶ TO START'}</p>
      <div className="w-full grid grid-cols-2 gap-2">
        <button type="button" aria-label="Nudge left" onPointerDown={e => { e.preventDefault(); nudge(-1); }} className="rounded-xl py-4 bg-crt-800 ring-2 ring-neon-cyan text-neon-cyan font-display text-2xl select-none touch-none active:scale-95">◀</button>
        <button type="button" aria-label="Nudge right" onPointerDown={e => { e.preventDefault(); nudge(1); }} className="rounded-xl py-4 bg-crt-800 ring-2 ring-neon-cyan text-neon-cyan font-display text-2xl select-none touch-none active:scale-95">▶</button>
      </div>
    </>
  );
};

// DEAL: find the lady.
const Monte: React.FC<{ finish: Finish }> = ({ finish }) => {
  const D = M.monte;
  const [state, setState] = useSaved('monte', { round: 0, finds: 0 });
  // slots[i] = which card (0 is the queen) sits in position i.
  const [slots, setSlots] = useState([0, 1, 2]);
  const [phase, setPhase] = useState<'show' | 'shuffle' | 'pick' | 'reveal'>('show');
  const [picked, setPicked] = useState<number | null>(null);
  const ended = useRef(false);
  const swapMs = [420, 300, 210][Math.min(state.round, 2)];
  const swaps = [5, 7, 9][Math.min(state.round, 2)];
  useEffect(() => {
    if (ended.current) return;
    setPicked(null); setPhase('show');
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setPhase('shuffle'), 1300));
    let order = [0, 1, 2];
    for (let k = 0; k < swaps; k++) {
      timers.push(setTimeout(() => {
        const a = Math.floor(Math.random() * 3); let b = Math.floor(Math.random() * 2); if (b >= a) b++;
        order = [...order]; [order[a], order[b]] = [order[b], order[a]];
        setSlots(order); tick();
      }, 1500 + k * swapMs));
    }
    timers.push(setTimeout(() => setPhase('pick'), 1500 + swaps * swapMs + 150));
    return () => timers.forEach(clearTimeout);
  }, [state.round]); // eslint-disable-line react-hooks/exhaustive-deps
  const pick = (card: number) => {
    if (phase !== 'pick' || ended.current) return;
    setPicked(card); setPhase('reveal');
    const found = card === 0;
    if (found) { soundService.playMilestone(); buzz([20, 40, 20]); } else { soundService.playInvalidWord(); buzz(70); }
    const finds = state.finds + (found ? 1 : 0), round = state.round + 1;
    setTimeout(() => {
      if (round >= D.rounds) {
        ended.current = true; setState({ round, finds });
        const pts = montePrize(finds);
        finish({ points: pts, headline: finds >= D.rounds ? `SHARP EYES! +${pts}` : pts ? `${finds} OF ${D.rounds}: +${pts}` : 'THE HOUSE WINS', detail: `You found the queen ${finds} ${finds === 1 ? 'time' : 'times'} in ${D.rounds} rounds.` });
        return;
      }
      setState({ round, finds });
    }, 1200);
  };
  const faceUp = (card: number) => phase === 'show' || (phase === 'reveal' && (card === 0 || card === picked));
  return (
    <>
      <p className="font-display text-xl text-neon-yellow">Round {Math.min(state.round + 1, D.rounds)} of {D.rounds} · {state.finds} found</p>
      <p className="osd-text text-lg text-slate-300 min-h-[1.5rem]" aria-live="polite">{phase === 'show' ? 'WATCH THE QUEEN…' : phase === 'shuffle' ? 'SHUFFLING…' : phase === 'pick' ? 'WHERE IS SHE?' : picked === 0 ? 'FOUND HER!' : 'NOT THIS TIME'}</p>
      <div className="relative w-full max-w-[18rem] h-36">
        {[0, 1, 2].map(card => {
          const at = slots.indexOf(card);
          return (
            <button key={card} type="button" disabled={phase !== 'pick'} onClick={() => pick(card)} aria-label={phase === 'pick' ? `Card ${at + 1}` : faceUp(card) ? (card === 0 ? 'The queen' : 'A plain card') : 'A face-down card'}
              className={`absolute top-0 w-[30%] h-full rounded-xl ring-2 grid place-items-center text-4xl font-display transition-[left] ease-in-out ${faceUp(card) ? 'bg-white text-crt-900 ring-white' : 'bg-gradient-to-br from-neon-purple to-neon-pink ring-white/40'} ${phase === 'pick' ? 'hover:-translate-y-1' : ''}`}
              style={{ left: `${at * 35}%`, transitionDuration: `${swapMs * 0.8}ms` }}>
              {faceUp(card) ? (card === 0 ? '👸' : '🂠') : ''}
            </button>
          );
        })}
      </div>
    </>
  );
};

// --- 10,000 GATE: the password ------------------------------------------------------------------
const Password: React.FC<GameProps> = ({ finish, extra }) => {
  const answer = String(extra?.password ?? 'ARCADE').toUpperCase();
  const P = GATES.password;
  const [letters] = useSaved('letters', () => scramble(answer));
  const [progress, setProgress] = useSaved('pw', { left: P.seconds * 1000, hint: false });
  const [picked, setPicked] = useState<number[]>(() => (progress.hint ? [letters.indexOf(answer[0])] : []));
  const [checking, setChecking] = useState(false);
  const [wrong, setWrong] = useState(false);
  const left = useRef(progress.left);
  const hinted = useRef(progress.hint); // the timer saves from refs, so a hint taken mid-game isn't lost
  const [, setTick] = useState(0);
  const ended = useRef(false);
  const end = (r: MiniGameResult) => { if (ended.current) return; ended.current = true; finish(r); };

  useEffect(() => {
    let last = performance.now(), saveIn = 1000;
    const timer = setInterval(() => {
      const now = performance.now(); left.current = Math.max(0, left.current - (now - last)); saveIn -= now - last; last = now;
      setTick(t => t + 1);
      if (saveIn <= 0) { saveIn = 1000; setProgress({ left: left.current, hint: hinted.current }); }
      if (left.current <= 0) end({ points: P.miss, headline: `TIME! +${P.miss}`, detail: `The password was ${answer}. The gate creaks open anyway.` });
    }, 100);
    return () => clearInterval(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const guess = picked.map(i => letters[i]).join('');
  useEffect(() => {
    if (guess.length !== answer.length || checking || ended.current) return;
    const solved = (prize: number) => { soundService.playMilestone(); buzz([20, 30, 20]); end({ points: prize, headline: `ACCESS GRANTED! +${prize.toLocaleString()}`, detail: `${guess} opened the gate${progress.hint ? ' (with the hint)' : ''}.` }); };
    const prize = progress.hint ? P.hint : P.solve;
    if (guess === answer) { solved(prize); return; }
    setChecking(true);
    dictionaryService.isValidWord(guess.toLowerCase()).then(ok => {
      setChecking(false);
      if (ok) { solved(prize); return; }
      setWrong(true); buzz(60);
      setTimeout(() => { setWrong(false); setPicked(progress.hint ? [picked[0]] : []); }, 500);
    });
  }, [guess]); // eslint-disable-line react-hooks/exhaustive-deps

  const tap = (i: number) => { if (picked.includes(i) || picked.length >= answer.length || ended.current) return; tick(); setPicked([...picked, i]); };
  const untap = (slot: number) => { if (progress.hint && slot === 0) return; tick(); setPicked(picked.filter((_, j) => j !== slot)); };
  const hint = () => {
    if (progress.hint || ended.current) return;
    soundService.playUIClick();
    const i = letters.indexOf(answer[0]);
    hinted.current = true;
    setProgress({ left: left.current, hint: true });
    setPicked([i, ...picked.filter(x => x !== i)].slice(0, 1));
  };
  return (
    <>
      <Secs ms={left.current} warnBelow={5001} className="text-2xl leading-none" />
      <TimeBar ms={left.current} total={P.seconds * 1000} warnBelow={5001} />
      {/* The answer slots: tap a letter to take it back. */}
      <div className={`flex gap-1.5 ${wrong ? 'cereal-shake' : ''}`}>
        {Array.from({ length: answer.length }, (_, slot) => {
          const i = picked[slot];
          return (
            <button key={slot} type="button" onClick={() => untap(slot)} aria-label={i !== undefined ? `Slot ${slot + 1}: ${letters[i]}` : `Slot ${slot + 1}: empty`}
              className={`w-11 h-12 rounded-lg grid place-items-center font-tile font-extrabold text-2xl ring-2 ${i !== undefined ? (progress.hint && slot === 0 ? 'bg-neon-yellow text-crt-900 ring-neon-yellow' : 'bg-crt-800 text-white ring-neon-cyan') : 'bg-crt-950 ring-white/20 text-transparent'} ${wrong ? 'ring-neon-red' : ''}`}>
              {i !== undefined ? letters[i] : '·'}
            </button>
          );
        })}
      </div>
      {/* The scrambled letters */}
      <div className="flex gap-1.5">
        {letters.map((l, i) => (
          <button key={i} type="button" onPointerDown={e => { e.preventDefault(); tap(i); }} disabled={picked.includes(i)} aria-label={`Letter ${l}`}
            className="w-11 h-12 rounded-lg grid place-items-center font-tile font-extrabold text-2xl bg-[#f6e7c1] text-crt-900 tile-3d disabled:opacity-20 select-none touch-none">
            {l}
          </button>
        ))}
      </div>
      <p className="text-slate-400 text-sm min-h-[1.25rem]">{checking ? 'Checking…' : wrong ? 'Not the password. Try again!' : 'Tap the letters in order.'}</p>
      {!progress.hint && <ArcadeButton color="yellow" variant="outline" size="sm" className="w-full" onClick={hint}>💡 Hint · prize drops to +{P.hint}</ArcadeButton>}
    </>
  );
};

// --- 30,000 GATE: the bonus stage ---------------------------------------------------------------
const BAG = Object.entries(TILE_DISTRIBUTION).flatMap(([letter, { count }]) => Array(count).fill(letter) as string[]);
const VOWELS = BAG.filter(l => 'AEIOU'.includes(l)), CONSONANTS = BAG.filter(l => !'AEIOU'.includes(l));
// Plain Math.random (not the tile stream), so the Daily Run's shared deal isn't disturbed. A vowel
// is replaced by a vowel and a consonant by a consonant, so the hand stays playable.
const stageTile = (vowel: boolean): Tile => {
  const pool = vowel ? VOWELS : CONSONANTS;
  const letter = pool[Math.floor(Math.random() * pool.length)];
  return { id: `bs-${Math.random().toString(36).slice(2)}`, letter, points: TILE_DISTRIBUTION[letter].points };
};
const isVowel = (t: Tile) => 'AEIOU'.includes(t.letter);
/** A fresh stage hand: 4 vowels and the rest consonants, mixed. */
const stageHand = (size: number): Tile[] => Array.from({ length: size }, (_, i) => stageTile(i < 4)).sort(() => Math.random() - 0.5);
const BonusStage: React.FC<GameProps> = ({ finish, gameState }) => {
  const B = GATES.bonusStage;
  const [progress, setProgress] = useSaved('stage', { left: B.seconds * 1000, total: 0, words: [] as { word: string; points: number }[] });
  const [hand, setHand] = useState<Tile[]>(() => stageHand(B.handSize));
  const [picked, setPicked] = useState<number[]>([]);
  const [flash, setFlash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const state = useRef(progress);
  const ended = useRef(false);
  const [, setTick] = useState(0);
  useEffect(() => {
    let last = performance.now(), saveIn = 1000;
    const timer = setInterval(() => {
      const now = performance.now(), s = state.current;
      s.left = Math.max(0, s.left - (now - last)); saveIn -= now - last; last = now;
      setTick(t => t + 1);
      if (saveIn <= 0) { saveIn = 1000; setProgress({ ...s }); }
      if (s.left <= 0 && !ended.current) {
        ended.current = true; setProgress({ ...s });
        finish({ points: s.total, headline: s.total ? `BONUS STAGE: +${s.total.toLocaleString()}` : 'TIME UP', detail: s.words.length ? `${s.words.length} ${s.words.length === 1 ? 'word' : 'words'} at x${B.multiplier}: ${s.words.map(w => `${w.word} ${w.points}`).join(', ')}.` : 'No words this time.' });
      }
    }, 100);
    return () => clearInterval(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const word = picked.map(i => hand[i].letter).join('');
  const submit = async () => {
    if (busy || ended.current || word.length < 3) return;
    const lower = word.toLowerCase();
    if (state.current.words.some(w => w.word === word)) { setFlash('Already played'); buzz(40); setPicked([]); return; }
    setBusy(true);
    const ok = await dictionaryService.isValidWord(lower);
    setBusy(false);
    if (ended.current) return;
    if (!ok) { setFlash(`${word}? Not a word`); buzz(60); setPicked([]); return; }
    const tiles = picked.map(i => hand[i]);
    const base = gameState ? calculateScore(lower, tiles, gameState).totalScore : tiles.reduce((s, t) => s + t.points, 0);
    // The stage bonus keeps a word worth playing even with few point charms (a bare 3-letter word was worth 9).
    const points = Math.max(0, Math.round((base + word.length * B.perLetter) * B.multiplier));
    state.current.total += points;
    state.current.words = [...state.current.words, { word, points }];
    setProgress({ ...state.current });
    setFlash(`${word} +${points}`); tick(); buzz(15);
    setHand(h => h.map((t, i) => (picked.includes(i) ? stageTile(isVowel(t)) : t)));
    setPicked([]);
  };
  const s = state.current;
  return (
    <>
      <div className="w-full flex justify-between items-baseline text-xl"><span className="font-display text-neon-yellow">+{s.total.toLocaleString()}</span><Secs ms={s.left} warnBelow={8000} /></div>
      <TimeBar ms={s.left} total={B.seconds * 1000} warnBelow={8000} />
      <p className="osd-text text-lg text-neon-green min-h-[1.5rem]" aria-live="polite">{flash ?? `+${B.perLetter} A LETTER · EVERY WORD x${B.multiplier}`}</p>
      <div className="w-full min-h-[3rem] rounded-lg bg-crt-950 ring-1 ring-white/15 flex items-center justify-center gap-1 px-2 font-tile font-extrabold text-2xl tracking-widest text-white">{word || <span className="text-slate-600 text-base font-sans font-normal">Tap tiles to build a word</span>}</div>
      <div className="grid grid-cols-5 gap-1.5 w-full">
        {hand.map((t, i) => (
          <button key={t.id} type="button" onPointerDown={e => { e.preventDefault(); if (!ended.current) { tick(); setFlash(null); setPicked(p => (p.includes(i) ? p.filter(x => x !== i) : [...p, i])); } }}
            aria-label={`Tile ${t.letter} with ${t.points} points`}
            className={`relative aspect-square rounded-lg grid place-items-center font-tile font-extrabold text-2xl tile-3d select-none touch-none ${picked.includes(i) ? 'bg-neon-yellow text-crt-900 -translate-y-1' : 'bg-[#f6e7c1] text-crt-900'}`}>
            {t.letter}<span className="absolute bottom-0.5 right-1 font-osd text-xs">{t.points}</span>
          </button>
        ))}
      </div>
      <div className="w-full grid grid-cols-3 gap-2">
        <ArcadeButton color="slate" variant="outline" onClick={() => { tick(); setPicked([]); setFlash(null); }}>Clear</ArcadeButton>
        <ArcadeButton color="slate" variant="outline" onClick={() => { tick(); setPicked([]); setHand(h => [...h].sort(() => Math.random() - 0.5)); }}>Mix</ArcadeButton>
        <ArcadeButton color="green" onClick={submit} disabled={word.length < 3 || busy}>Submit</ArcadeButton>
      </div>
    </>
  );
};


// --- 50,000 and 70,000 gates (v7.49) -------------------------------------------------------------

/** Tiles for a gate hand, from letters. */
const gateTiles = (letters: string[]): Tile[] =>
  letters.map(l => ({ id: `g-${Math.random().toString(36).slice(2)}`, letter: l, points: TILE_DISTRIBUTION[l]?.points ?? 1 }));
const shuffled = <T,>(xs: T[]): T[] => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/** A hand of `size` tiles that can spell a common word of `min`+ letters (dealt in if luck won't). */
const dealLadderHand = async (min: number, size: number): Promise<string[]> => {
  for (let tries = 0; tries < 12; tries++) {
    const hand = stageHand(size).map(t => t.letter);
    const w = await dictionaryService.findPlayableWord(hand, { minLength: min, longest: true });
    if (w && w.length >= min) return hand;
  }
  const pool = LADDER_FALLBACK[Math.min(8, Math.max(3, min))];
  const word = pool[Math.floor(Math.random() * pool.length)];
  const fill = Array.from({ length: Math.max(0, size - word.length) }, (_, i) => stageTile(i % 3 === 0).letter);
  return shuffled([...word, ...fill]);
};

/** Shared word builder for the gate games: tap tiles, Clear, Submit. */
const WordPad: React.FC<{ tiles: Tile[]; disabled?: boolean; onSubmit: (word: string) => void; busy?: boolean; flash?: string | null }> = ({ tiles, disabled, onSubmit, busy, flash }) => {
  const [picked, setPicked] = useState<number[]>([]);
  useEffect(() => setPicked([]), [tiles]);
  const word = picked.map(i => tiles[i].letter).join('');
  return (
    <>
      <div className="w-full min-h-[3rem] rounded-lg bg-crt-950 ring-1 ring-white/15 flex items-center justify-center px-2 font-tile font-extrabold text-2xl tracking-widest text-white">{word || <span className="text-slate-600 text-base font-sans font-normal">Tap tiles to build a word</span>}</div>
      <p className="osd-text text-lg text-neon-yellow min-h-[1.5rem]" aria-live="polite">{busy ? 'Checking…' : flash ?? ''}</p>
      <div className="grid grid-cols-5 gap-1.5 w-full">
        {tiles.map((t, i) => (
          <button key={t.id} type="button" disabled={disabled} onPointerDown={e => { e.preventDefault(); if (disabled) return; tick(); setPicked(p => (p.includes(i) ? p.filter(x => x !== i) : [...p, i])); }}
            aria-label={`Tile ${t.letter} with ${t.points} points`}
            className={`relative aspect-square rounded-lg grid place-items-center font-tile font-extrabold text-2xl tile-3d select-none touch-none ${picked.includes(i) ? 'bg-neon-yellow text-crt-900 -translate-y-1' : 'bg-[#f6e7c1] text-crt-900'}`}>
            {t.letter}<span className="absolute bottom-0.5 right-1 font-osd text-xs">{t.points}</span>
          </button>
        ))}
      </div>
      <div className="w-full grid grid-cols-2 gap-2">
        <ArcadeButton color="slate" variant="outline" onClick={() => setPicked([])} disabled={disabled}>Clear</ArcadeButton>
        <ArcadeButton color="green" onClick={() => { if (word.length >= 3) { onSubmit(word); setPicked([]); } }} disabled={disabled || busy || word.length < 3}>Submit</ArcadeButton>
      </div>
    </>
  );
};

// 50,000: the Word Ladder.
const Ladder: React.FC<GameProps> = ({ finish }) => {
  const L = GATES.ladder;
  const [state, setState] = useSaved('ladder', { rung: 0, pot: 0 });
  const [tiles, setTiles] = useState<Tile[] | null>(null);
  // Resuming mid-ladder goes back to the bank-or-climb choice, never into a half-run rung.
  const [phase, setPhase] = useState<'deal' | 'climb' | 'choice' | 'done'>(() => (state.rung > 0 ? 'choice' : 'deal'));
  const [left, setLeft] = useState(L.secondsPerRung * 1000);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const ended = useRef(false);
  const need = L.rungs[Math.min(state.rung, L.rungs.length - 1)];
  const end = (points: number, headline: string, detail: string) => { if (ended.current) return; ended.current = true; setPhase('done'); finish({ points, headline, detail }); };
  // Deal a hand for the rung, then start its clock.
  useEffect(() => {
    if (phase !== 'deal' || ended.current) return;
    let alive = true;
    dealLadderHand(need, L.handSize).then(h => { if (!alive) return; setTiles(gateTiles(h)); setLeft(L.secondsPerRung * 1000); setFlash(null); setPhase('climb'); });
    return () => { alive = false; };
  }, [phase, state.rung]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (phase !== 'climb') return;
    let last = performance.now();
    const t = setInterval(() => {
      const now = performance.now();
      setLeft(l => {
        const n = Math.max(0, l - (now - last)); last = now;
        if (n <= 0 && !ended.current) { soundService.playInvalidWord(); buzz(80); end(0, 'YOU SLIPPED!', state.pot ? `Time ran out on the ${need}-letter rung. The ${state.pot.toLocaleString()} pot is gone.` : `Time ran out on the ${need}-letter rung.`); }
        return n;
      });
    }, 100);
    return () => clearInterval(t);
  }, [phase, state.rung]); // eslint-disable-line react-hooks/exhaustive-deps
  const submit = async (word: string) => {
    if (phase !== 'climb' || ended.current) return;
    if (word.length < need) { setFlash(`Needs ${need}+ letters`); buzz(40); return; }
    setBusy(true);
    const ok = await dictionaryService.isValidWord(word.toLowerCase());
    setBusy(false);
    if (ended.current) return;
    if (!ok) { setFlash(`${word}? Not a word`); buzz(60); return; }
    const pot = L.pots[state.rung];
    soundService.playMilestone(); buzz([20, 30, 20]);
    const rung = state.rung + 1;
    setState({ rung, pot });
    if (rung >= L.rungs.length) { end(pot, `TOP OF THE LADDER! +${pot.toLocaleString()}`, `${word} cleared the ${need}-letter rung. You climbed all ${L.rungs.length}.`); return; }
    setFlash(`${word}! Pot: ${pot.toLocaleString()}`);
    setPhase('choice');
  };
  const nextNeed = L.rungs[Math.min(state.rung, L.rungs.length - 1)];
  return (
    <>
      <div className="w-full flex items-end justify-center gap-1" aria-label={`Rung ${Math.min(state.rung + 1, L.rungs.length)} of ${L.rungs.length}`}>
        {L.rungs.map((r, i) => (
          <div key={r} className={`flex-1 rounded-md text-center osd-text text-sm leading-tight py-1 ${i < state.rung ? 'bg-neon-green text-crt-900' : i === state.rung ? 'bg-neon-yellow text-crt-900' : 'bg-crt-950 text-slate-500 ring-1 ring-white/10'}`}>
            {r}+<br />{L.pots[i] >= 1000 ? `${L.pots[i] / 1000}K` : L.pots[i]}
          </div>
        ))}
      </div>
      <p className="font-display text-xl text-neon-yellow">POT {state.pot.toLocaleString()}</p>
      {phase === 'choice' ? (
        <>
          <p className="text-slate-200 leading-snug">Next rung: a word of <strong className="text-white">{nextNeed}+ letters</strong> for <strong className="text-neon-yellow">{L.pots[state.rung].toLocaleString()}</strong>. Miss it and you lose the {state.pot.toLocaleString()}.</p>
          <ArcadeButton color="green" className="w-full" onClick={() => end(state.pot, `BANKED +${state.pot.toLocaleString()}`, `You stopped after ${state.rung} ${state.rung === 1 ? 'rung' : 'rungs'}. The next one needed ${nextNeed} letters.`)}>💰 Bank {state.pot.toLocaleString()}</ArcadeButton>
          <ArcadeButton color="pink" variant="outline" className="w-full" onClick={() => { soundService.playPowerUp(); setPhase('deal'); }}>🪜 Climb: {nextNeed}+ letters for {L.pots[state.rung].toLocaleString()}</ArcadeButton>
        </>
      ) : (
        <>
          <div className="w-full flex justify-between items-baseline"><span className="osd-text text-lg text-white">RUNG: {need}+ LETTERS</span><Secs ms={left} warnBelow={5000} /></div>
          <TimeBar ms={left} total={L.secondsPerRung * 1000} warnBelow={5000} />
          {tiles ? <WordPad tiles={tiles} disabled={phase !== 'climb'} busy={busy} flash={flash} onSubmit={submit} /> : <p className="osd-text text-lg text-slate-400">DEALING…</p>}
        </>
      )}
    </>
  );
};

// 70,000: the Big One.
const BigOne: React.FC<GameProps> = ({ finish, extra }) => {
  const B = GATES.bigOne;
  const [deal] = useSaved('bigOne', () => {
    const word = BIG_ONE_WORDS[Math.floor(Math.random() * BIG_ONE_WORDS.length)];
    const extras = Array.from({ length: B.extraTiles }, (_, i) => stageTile(i === 0).letter);
    let letters = shuffled([...word, ...extras]);
    for (let k = 0; k < 20 && letters.join('').includes(word.slice(0, 4)); k++) letters = shuffled(letters);
    return { word, letters };
  });
  const tiles = React.useMemo(() => gateTiles(deal.letters), [deal]);
  const [best, setBest] = useSaved('bigBest', '');
  const [left, setLeft] = useState(B.seconds * 1000);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const ended = useRef(false);
  const bestRef = useRef(best);
  const prizeFor = (len: number) => (len >= 8 ? B.prizes[8] : B.prizes[len] ?? 0);
  const end = (w: string) => {
    if (ended.current) return; ended.current = true;
    const pts = prizeFor(w.length);
    finish({ points: pts, headline: w.length >= 8 ? `FOUND IT! +${pts.toLocaleString()}` : pts ? `${w}: +${pts.toLocaleString()}` : 'TIME!', detail: `The hidden word was ${deal.word}.${w ? ` Your longest: ${w} (${w.length} letters).` : ''}${extra?.badgeNew ? ' 💎 70K Club badge earned: it\'s in your Collection for good.' : ''}` });
  };
  useEffect(() => {
    let last = performance.now();
    const t = setInterval(() => {
      const now = performance.now();
      setLeft(l => { const n = Math.max(0, l - (now - last)); last = now; if (n <= 0) end(bestRef.current); return n; });
    }, 100);
    return () => clearInterval(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const submit = async (word: string) => {
    if (ended.current) return;
    if (word.length <= bestRef.current.length) { setFlash(`Beat ${bestRef.current.length} letters`); return; }
    setBusy(true);
    const ok = await dictionaryService.isValidWord(word.toLowerCase());
    setBusy(false);
    if (ended.current) return;
    if (!ok) { setFlash(`${word}? Not a word`); buzz(60); return; }
    bestRef.current = word; setBest(word); tick(); buzz(15);
    if (word.length >= 8) { soundService.playMilestone(); end(word); return; }
    setFlash(`${word}: ${prizeFor(word.length) ? `+${prizeFor(word.length).toLocaleString()} so far` : 'keep going'}`);
  };
  return (
    <>
      {extra?.badgeNew && <p className="osd-text text-lg text-neon-cyan leading-tight">💎 70K CLUB BADGE EARNED!</p>}
      <div className="w-full flex justify-between items-baseline"><span className="osd-text text-lg text-white">BEST: {best || '—'}</span><Secs ms={left} warnBelow={10000} /></div>
      <TimeBar ms={left} total={B.seconds * 1000} warnBelow={10000} />
      <WordPad tiles={tiles} busy={busy} flash={flash} onSubmit={submit} />
    </>
  );
};

// --- v7.56.0 arcade games ------------------------------------------------------------------------

// LURE: Gone Fishin'. Cast, wait for the dip, tap fast.
const CATCH_ART: Record<LureCatch, { icon: string; label: string }> = {
  whopper: { icon: '🦈', label: 'WHOPPER!' }, keeper: { icon: '🐟', label: 'A KEEPER' }, minnow: { icon: '🦐', label: 'A MINNOW' },
  gone: { icon: '💨', label: 'IT GOT AWAY' }, early: { icon: '🫧', label: 'TOO SOON!' },
};
const CATCH_NAME: Record<LureCatch, string> = { whopper: 'whopper', keeper: 'keeper', minnow: 'minnow', gone: 'got away', early: 'too soon' };
const Lure: React.FC<{ finish: Finish }> = ({ finish }) => {
  const L = M.lure;
  const [state, setState] = useSaved<{ catches: LureCatch[] }>('lure', { catches: [] });
  const [phase, setPhase] = useState<'ready' | 'wait' | 'bite' | 'result'>('ready');
  const [last, setLast] = useState<LureCatch | null>(null);
  const dipAt = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const ended = useRef(false);
  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  useEffect(() => clear, []);
  const land = (c: LureCatch) => {
    clear();
    setLast(c); setPhase('result');
    if (c === 'whopper' || c === 'keeper') { soundService.playMilestone(); buzz([20, 30, 20]); } else if (c === 'minnow') { tick(); buzz(15); } else { soundService.playInvalidWord(); buzz(60); }
    const catches = [...state.catches, c];
    setState({ catches });
    timers.current.push(setTimeout(() => {
      if (catches.length >= L.casts) {
        ended.current = true;
        const pts = lurePrize(catches);
        const fish = catches.filter(x => x === 'whopper' || x === 'keeper' || x === 'minnow').length;
        finish({ points: pts, headline: catches.every(x => x === 'whopper') ? `BIGGER BOAT! +${pts}` : pts ? `${fish} FISH: +${pts}` : 'NOT A BITE', detail: catches.map(x => `${CATCH_ART[x].icon} ${CATCH_NAME[x]}`).join(' · ') });
      } else setPhase('ready');
    }, 1300));
  };
  const cast = () => {
    if (phase !== 'ready' || ended.current) return;
    tick(); setPhase('wait'); setLast(null);
    const wait = L.waitMs[0] + Math.random() * (L.waitMs[1] - L.waitMs[0]);
    timers.current.push(setTimeout(() => {
      dipAt.current = performance.now(); setPhase('bite'); buzz(25);
      timers.current.push(setTimeout(() => land('gone'), L.minnowMs + 40));
    }, wait));
  };
  const reel = () => {
    if (phase === 'wait') land('early');
    else if (phase === 'bite') land(lureCatch(performance.now() - dipAt.current));
  };
  const cast_n = Math.min(state.catches.length + (phase === 'result' ? 0 : 1), L.casts);
  return (
    <>
      <p className="font-display text-xl text-neon-yellow">Cast {cast_n} of {L.casts} · +{lurePrize(state.catches)}</p>
      <button type="button" onPointerDown={e => { e.preventDefault(); if (phase === 'ready') cast(); else reel(); }} disabled={phase === 'result'}
        aria-label={phase === 'ready' ? 'Cast your line' : phase === 'bite' ? 'Reel it in now' : 'Wait for the bite'}
        className="relative w-full max-w-[19rem] h-48 rounded-xl overflow-hidden ring-1 ring-white/15 bg-gradient-to-b from-[#123b5c] via-[#0b2a44] to-[#05182b] select-none touch-none">
        <div className="absolute inset-x-0 top-[42%] h-0.5 bg-neon-cyan/40" aria-hidden="true" />
        {(phase === 'wait' || phase === 'bite') && (
          <>
            <div className="absolute left-1/2 top-0 w-px bg-white/50 transition-[height] duration-150" style={{ height: phase === 'bite' ? '58%' : '42%' }} aria-hidden="true" />
            <span className={`absolute left-1/2 -translate-x-1/2 -translate-y-1/2 text-3xl leading-none transition-[top] duration-100 ${phase === 'wait' ? 'animate-pulse' : ''}`} style={{ top: phase === 'bite' ? '58%' : '42%' }} aria-hidden="true">🔴</span>
            {phase === 'bite' && <span className="absolute left-1/2 top-[44%] -translate-x-1/2 text-2xl animate-bounce-in-up" aria-hidden="true">💦</span>}
          </>
        )}
        {phase === 'result' && last && (
          <span className="absolute inset-0 grid place-items-center animate-bounce-in-up" aria-hidden="true"><span className="text-6xl">{CATCH_ART[last].icon}</span></span>
        )}
        {phase === 'ready' && <span className="absolute inset-0 grid place-items-center text-5xl" aria-hidden="true">🎣</span>}
      </button>
      <p className={`osd-text text-xl min-h-[1.75rem] ${phase === 'bite' ? 'text-neon-green animate-pulse' : 'text-slate-300'}`} aria-live="polite">
        {phase === 'ready' ? 'TAP TO CAST' : phase === 'wait' ? 'WAIT FOR IT…' : phase === 'bite' ? 'TAP NOW!' : last ? CATCH_ART[last].label : ''}
      </p>
    </>
  );
};

// DIAL: Safecracker. Turn the dial; the light glows near a number and clicks on it.
const Dial: React.FC<{ finish: Finish }> = ({ finish }) => {
  const D = M.dial;
  const [state, setState] = useSaved('dial', () => ({ combo: dialCombo(), found: 0, left: D.seconds * 1000 }));
  const [num, setNum] = useState(0);
  const [flash, setFlash] = useState<'hit' | 'miss' | null>(null);
  const [, setFrame] = useState(0);
  const rot = useRef(0); // degrees
  const drag = useRef<{ angle: number } | null>(null);
  const live = useRef(state);
  const lock = useRef(0);
  const ended = useRef(false);
  const lastNum = useRef(0);
  const step = 360 / D.size;
  const end = (s: typeof state) => {
    if (ended.current) return;
    ended.current = true;
    const pts = dialPrize(s.found);
    finish({ points: pts, headline: s.found >= D.numbers ? `SAFE CRACKED! +${pts}` : s.found ? `${s.found} OF ${D.numbers}: +${pts}` : 'STILL LOCKED', detail: s.found >= D.numbers ? `The combination was ${s.combo.join('-')}.` : `The combination was ${s.combo.join('-')}. You found ${s.found}.` });
  };
  useEffect(() => {
    let last = performance.now(), saveIn = 1000;
    const timer = setInterval(() => {
      const now = performance.now(), dt = now - last; last = now;
      const s = live.current;
      if (ended.current) return;
      s.left = Math.max(0, s.left - dt); saveIn -= dt;
      if (saveIn <= 0) { saveIn = 1000; setState({ ...s }); }
      setFrame(f => f + 1); // redraw the countdown
      if (s.left <= 0) { setState({ ...s }); end(s); }
    }, 100);
    return () => clearInterval(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const target = live.current.combo[Math.min(live.current.found, D.numbers - 1)];
  const setRotation = (deg: number) => {
    rot.current = deg;
    const n = ((Math.round(deg / step) % D.size) + D.size) % D.size;
    if (n !== lastNum.current) {
      lastNum.current = n; setNum(n);
      if (dialDistance(n, target) === 0) { soundService.playMilestone(); buzz([12, 20, 12]); } else tick();
    }
  };
  const angleOf = (e: React.PointerEvent) => {
    const r = (e.currentTarget as Element).getBoundingClientRect();
    return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI;
  };
  const onDown = (e: React.PointerEvent) => { e.preventDefault(); (e.currentTarget as Element).setPointerCapture?.(e.pointerId); drag.current = { angle: angleOf(e) }; };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current || ended.current) return;
    const a = angleOf(e);
    let d = a - drag.current.angle; if (d > 180) d -= 360; if (d < -180) d += 360;
    drag.current.angle = a;
    setRotation(rot.current - d); // the dial follows your finger
  };
  const nudge = (dir: number) => { if (!ended.current) setRotation(Math.round(rot.current / step) * step + dir * step); };
  const set = () => {
    if (ended.current || performance.now() < lock.current) return;
    const s = live.current;
    if (dialDistance(num, target) === 0) {
      s.found += 1; setState({ ...s }); setFlash('hit'); soundService.playPowerUp(); buzz([20, 40, 20]);
      setTimeout(() => setFlash(null), 500);
      if (s.found >= D.numbers) end(s);
    } else {
      lock.current = performance.now() + 600; setFlash('miss'); soundService.playInvalidWord(); buzz(50);
      setTimeout(() => setFlash(null), 500);
    }
  };
  const dist = dialDistance(num, target);
  const glow = dist <= D.glow ? (D.glow + 1 - dist) / (D.glow + 1) : 0;
  const s = live.current;
  return (
    <>
      <div className="w-full flex justify-between items-baseline text-xl"><span className="font-display text-neon-yellow">{s.found} / {D.numbers} found</span><Secs ms={s.left} warnBelow={5000} /></div>
      <TimeBar ms={s.left} total={D.seconds * 1000} warnBelow={5000} />
      <div className="flex items-center gap-3">
        {Array.from({ length: D.numbers }, (_, i) => (
          <span key={i} className={`font-display text-2xl w-12 text-center rounded-md py-1 ring-1 ${i < s.found ? 'text-neon-green ring-neon-green bg-neon-green/10' : 'text-slate-500 ring-white/15'}`}>{i < s.found ? s.combo[i] : '??'}</span>
        ))}
      </div>
      <div className="relative" aria-hidden="true">
        <span className="absolute left-1/2 -top-1 -translate-x-1/2 text-neon-yellow text-xl leading-none">▼</span>
      </div>
      <div className="relative w-52 h-52 select-none touch-none" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
        role="slider" aria-label="Safe dial" aria-valuemin={0} aria-valuemax={D.size - 1} aria-valuenow={num}>
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-slate-500 to-slate-800 ring-4 ring-slate-900 shadow-inner" style={{ transform: `rotate(${-rot.current}deg)` }}>
          {Array.from({ length: D.size }, (_, i) => (
            <span key={i} className="absolute left-1/2 top-0 h-1/2 origin-bottom" style={{ transform: `translateX(-50%) rotate(${i * step}deg)` }}>
              <span className={`block mx-auto ${i % 5 === 0 ? 'w-0.5 h-3 bg-white' : 'w-px h-2 bg-white/60'}`} />
              {i % 10 === 0 && <span className="block text-[0.6rem] text-white font-display mt-0.5 -translate-x-[1px]">{i}</span>}
            </span>
          ))}
        </div>
        <div className="absolute inset-[30%] rounded-full grid place-items-center ring-2 ring-slate-900 transition-[background-color,box-shadow] duration-100"
          style={{ backgroundColor: flash === 'miss' ? '#7f1d1d' : `rgba(61, 255, 122, ${0.12 + glow * 0.75})`, boxShadow: glow ? `0 0 ${8 + glow * 24}px rgba(61,255,122,${glow})` : 'none' }}>
          <span className="font-display text-2xl text-white tabular-nums">{num}</span>
        </div>
      </div>
      <p className="osd-text text-lg text-slate-300 min-h-[1.5rem]" aria-live="polite">{flash === 'hit' ? 'CLICK! GOT ONE' : flash === 'miss' ? 'NOT THERE' : dist === 0 ? '* CLICK *' : glow ? 'GETTING WARM…' : 'DRAG TO TURN THE DIAL'}</p>
      <div className="w-full grid grid-cols-[1fr_2fr_1fr] gap-2">
        <button type="button" aria-label="Turn down one" onPointerDown={e => { e.preventDefault(); nudge(-1); }} className="rounded-xl py-3 bg-crt-800 ring-2 ring-neon-cyan text-neon-cyan font-display text-2xl select-none touch-none active:scale-95">◀</button>
        <ArcadeButton color="green" onClick={set}>🔓 SET</ArcadeButton>
        <button type="button" aria-label="Turn up one" onPointerDown={e => { e.preventDefault(); nudge(1); }} className="rounded-xl py-3 bg-crt-800 ring-2 ring-neon-cyan text-neon-cyan font-display text-2xl select-none touch-none active:scale-95">▶</button>
      </div>
    </>
  );
};

// WIRE: Cut the Wire. Read the manual, cut the one it means.
const WIRE_HEX: Record<WireColor, string> = { red: '#ff4d4d', blue: '#3d8bff', green: '#3dff7a', yellow: '#ffe27a', white: '#f1f5f9' };
const Wire: React.FC<{ finish: Finish }> = ({ finish }) => {
  const W = M.wire;
  const [state, setState] = useSaved<{ round: number; defused: number; bomb: WireBomb }>('wire', () => ({ round: 0, defused: 0, bomb: wireBomb(0) }));
  const [left, setLeft] = useState(W.seconds * 1000);
  const [cut, setCut] = useState<number | null>(null);
  const [outcome, setOutcome] = useState<'defused' | 'boom' | null>(null);
  const ended = useRef(false);
  const resolved = useRef(false);
  const resolve = (i: number | null) => {
    if (resolved.current || ended.current) return;
    resolved.current = true;
    const ok = i === state.bomb.answer;
    setCut(i); setOutcome(ok ? 'defused' : 'boom');
    if (ok) { soundService.playMilestone(); buzz([20, 40, 20]); } else { soundService.playInvalidWord(); buzz([80, 40, 120]); }
    const defused = state.defused + (ok ? 1 : 0), round = state.round + 1;
    setTimeout(() => {
      if (round >= W.bombs) {
        ended.current = true;
        setState({ round, defused, bomb: state.bomb });
        const pts = wirePrize(defused);
        finish({ points: pts, headline: defused >= W.bombs ? `ALL CLEAR! +${pts}` : pts ? `${defused} OF ${W.bombs} DEFUSED: +${pts}` : 'KA-BOOM', detail: defused >= W.bombs ? 'Three bombs, three clean snips. Cool under pressure.' : `You defused ${defused} of ${W.bombs} bombs.` });
        return;
      }
      setState({ round, defused, bomb: wireBomb(round) });
    }, 1300);
  };
  useEffect(() => {
    if (ended.current) return;
    resolved.current = false; setCut(null); setOutcome(null); setLeft(W.seconds * 1000);
    const start = performance.now();
    const t = setInterval(() => {
      const l = Math.max(0, W.seconds * 1000 - (performance.now() - start));
      setLeft(l);
      if (l <= 0) { clearInterval(t); resolve(null); }
    }, 100);
    return () => clearInterval(t);
  }, [state.round]); // eslint-disable-line react-hooks/exhaustive-deps
  const b = state.bomb;
  return (
    <>
      <div className="w-full flex justify-between items-baseline text-xl"><span className="font-display text-neon-yellow">Bomb {Math.min(state.round + 1, W.bombs)} of {W.bombs} · {state.defused} defused</span><Secs ms={outcome ? 0 : left} warnBelow={3000} /></div>
      <div className="w-full rounded-lg bg-[#f5ecd2] text-crt-900 px-3 py-2 text-left shadow ring-1 ring-black/20">
        <p className="text-[0.65rem] font-bold tracking-widest opacity-60">📖 BOMB MANUAL, PAGE {state.round + 1}</p>
        <p className="font-semibold text-lg leading-snug">{b.text}</p>
      </div>
      <div className={`relative w-full max-w-[19rem] rounded-xl bg-crt-950 ring-2 px-3 pt-3 pb-2 ${outcome === 'boom' ? 'ring-neon-red animate-pulse' : outcome === 'defused' ? 'ring-neon-green' : 'ring-white/15'}`}>
        <div className="flex justify-center mb-2"><span className="font-digital text-3xl text-neon-red tabular-nums bg-black px-2 rounded">{outcome === 'defused' ? '-- --' : `0:0${Math.ceil(left / 1000)}`}</span></div>
        <div className="grid grid-cols-4 gap-2">
          {b.wires.map((c, i) => (
            <button key={i} type="button" disabled={!!outcome} onPointerDown={e => { e.preventDefault(); if (!outcome) { tick(); resolve(i); } }} aria-label={`Cut the ${c} wire (wire ${i + 1})`}
              className="flex flex-col items-center gap-1 select-none touch-none">
              <span className="relative w-3 h-28 rounded-full" style={{ backgroundColor: WIRE_HEX[c], boxShadow: `0 0 8px ${WIRE_HEX[c]}66` }}>
                {cut === i && <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-4 bg-crt-950" />}
              </span>
              <span className="text-[0.65rem] font-bold tracking-wide text-slate-300 uppercase">{c}</span>
            </button>
          ))}
        </div>
        {outcome === 'boom' && <span className="absolute inset-0 grid place-items-center text-7xl animate-bounce-in-up" aria-hidden="true">💥</span>}
      </div>
      <p className="osd-text text-lg min-h-[1.5rem] text-slate-300" aria-live="polite">{outcome === 'defused' ? '✂️ DEFUSED!' : outcome === 'boom' ? (cut === null ? 'OUT OF TIME. BOOM!' : `WRONG WIRE. It was ${b.wires[b.answer].toUpperCase()}.`) : 'TAP A WIRE TO CUT IT'}</p>
    </>
  );
};

// NEST: Egg Drop. Slide the nest under the falling eggs.
const EGG_ICON: Record<EggKind, string> = { egg: '🥚', golden: '🥚', rotten: '🤢' };
const Nest: React.FC<{ finish: Finish }> = ({ finish }) => {
  const N = M.nest;
  const [progress, setProgress] = useSaved('nest', { left: N.seconds * 1000, score: 0, eggs: 0, golden: 0, rotten: 0 });
  const live = useRef(progress);
  const nestX = useRef(50);
  const eggs = useRef<{ id: number; x: number; y: number; vy: number; kind: EggKind }[]>([]);
  const pops = useRef<{ id: number; x: number; text: string; until: number }[]>([]);
  const fieldRef = useRef<HTMLDivElement>(null);
  const [, setFrame] = useState(0);
  const ended = useRef(false);
  useEffect(() => {
    let raf = 0, last = performance.now(), nextSpawn = 300, saveIn = 1000, nextId = 1;
    const loop = (now: number) => {
      const dt = Math.min(50, now - last); last = now;
      const s = live.current;
      if (ended.current) return;
      s.left = Math.max(0, s.left - dt); nextSpawn -= dt; saveIn -= dt;
      const pace = 1 + (1 - s.left / (N.seconds * 1000)) * 0.6; // eggs fall faster as the clock runs down
      if (nextSpawn <= 0 && s.left > 600) {
        eggs.current.push({ id: nextId++, x: 8 + Math.random() * 84, y: -6, vy: (38 + Math.random() * 18) * pace, kind: eggKind(Math.random()) });
        nextSpawn = N.spawnMs[0] + Math.random() * (N.spawnMs[1] - N.spawnMs[0]);
      }
      const keep: typeof eggs.current = [];
      for (const e of eggs.current) {
        e.y += e.vy * dt / 1000;
        if (e.y >= 84 && e.y <= 94 && Math.abs(e.x - nestX.current) <= 12) {
          const pts = eggPoints(e.kind);
          s.score = Math.max(0, s.score + pts);
          if (e.kind === 'golden') s.golden += 1; else if (e.kind === 'rotten') s.rotten += 1; else s.eggs += 1;
          pops.current.push({ id: e.id, x: e.x, text: pts > 0 ? `+${pts}` : `${pts}`, until: now + 600 });
          if (e.kind === 'rotten') { soundService.playInvalidWord(); buzz(50); } else if (e.kind === 'golden') { soundService.playMilestone(); buzz([15, 25, 15]); } else { tick(); buzz(8); }
          continue;
        }
        if (e.y < 104) keep.push(e);
      }
      eggs.current = keep;
      pops.current = pops.current.filter(p => p.until > now);
      if (saveIn <= 0) { saveIn = 1000; setProgress({ ...s }); }
      setFrame(f => f + 1);
      if (s.left <= 0) {
        ended.current = true; setProgress({ ...s });
        const n = s.eggs + s.golden;
        finish({ points: s.score, headline: s.score ? `${n} ${n === 1 ? 'EGG' : 'EGGS'}: +${s.score}` : 'SCRAMBLED', detail: `${s.eggs} ${s.eggs === 1 ? 'egg' : 'eggs'}${s.golden ? `, ${s.golden} golden` : ''}${s.rotten ? `, ${s.rotten} rotten` : ''} in ${N.seconds} seconds.` });
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const steer = (e: React.PointerEvent) => {
    const r = fieldRef.current?.getBoundingClientRect();
    if (!r) return;
    nestX.current = Math.max(10, Math.min(90, ((e.clientX - r.left) / r.width) * 100));
  };
  const s = live.current;
  return (
    <>
      <div className="w-full flex justify-between items-baseline text-xl"><span className="font-display text-neon-yellow">+{s.score}</span><Secs ms={s.left} warnBelow={3000} /></div>
      <TimeBar ms={s.left} total={N.seconds * 1000} warnBelow={3000} />
      <div ref={fieldRef} className="relative w-full max-w-[19rem] h-64 rounded-xl overflow-hidden ring-1 ring-white/15 bg-gradient-to-b from-[#1a2b55] to-[#0b1630] select-none touch-none"
        onPointerDown={e => { e.preventDefault(); (e.currentTarget as Element).setPointerCapture?.(e.pointerId); steer(e); }} onPointerMove={steer}
        role="application" aria-label="Egg Drop: drag left and right to move the nest">
        {eggs.current.map(e => (
          <span key={e.id} className="absolute text-2xl leading-none -translate-x-1/2" aria-hidden="true"
            style={{ left: `${e.x}%`, top: `${e.y}%`, filter: e.kind === 'golden' ? 'sepia(1) saturate(5) hue-rotate(5deg) drop-shadow(0 0 6px #ffd84d)' : undefined }}>{EGG_ICON[e.kind]}</span>
        ))}
        {pops.current.map(p => (
          <span key={`p${p.id}`} className={`absolute -translate-x-1/2 font-display text-lg ${p.text.startsWith('-') ? 'text-neon-red' : 'text-neon-yellow'}`} style={{ left: `${p.x}%`, top: `${60 + (p.id % 3) * 6}%` }} aria-hidden="true">{p.text}</span>
        ))}
        <div className="absolute bottom-2 -translate-x-1/2 w-[24%] h-6 rounded-b-full bg-gradient-to-b from-[#a0703c] to-[#5c3a1a] ring-2 ring-[#3b2410] shadow-[0_-3px_0_#c08a4a_inset]" style={{ left: `${nestX.current}%` }} aria-hidden="true" />
      </div>
      <p className="osd-text text-lg text-slate-300">DRAG TO MOVE THE NEST</p>
    </>
  );
};

// LEAP: Road Hop. Hop across five lanes of traffic.
const LEAP_CARS = ['🚗', '🚕', '🚙', '🚌', '🚚'];
const leapLanes = () => Array.from({ length: M.leap.lanes }, (_, i) => {
  const dir = i % 2 === 0 ? -1 : 1;
  const speed = 20 + i * 4 + Math.random() * 6; // percent of the road per second
  const w = i === 3 ? 20 : 14;
  const offset = Math.random() * 50;
  return { dir, speed, w, icon: LEAP_CARS[i], cars: [offset, offset + 50] };
});
const Leap: React.FC<{ finish: Finish }> = ({ finish }) => {
  const P = M.leap;
  const [progress, setProgress] = useSaved('leap', { left: P.seconds * 1000, best: 0, splats: 0 });
  const live = useRef(progress);
  const lanes = useRef(leapLanes());
  const frog = useRef(0); // 0 is the curb, 1-5 the lanes, lanes + 1 the far side
  const splatUntil = useRef(0);
  const [, setFrame] = useState(0);
  const ended = useRef(false);
  const end = (home: boolean) => {
    if (ended.current) return;
    ended.current = true;
    const s = live.current;
    setProgress({ ...s });
    const pts = leapPrize(s.best, home);
    finish({ points: pts, headline: home ? `MADE IT ACROSS! +${pts}` : pts ? `${s.best} ${s.best === 1 ? 'LANE' : 'LANES'}: +${pts}` : 'STUCK ON THE CURB', detail: home ? `All ${P.lanes} lanes${s.splats ? ` after ${s.splats} ${s.splats === 1 ? 'splat' : 'splats'}` : ' without a scratch'}. Ribbit!` : `Your best was lane ${s.best} of ${P.lanes}.` });
  };
  useEffect(() => {
    let raf = 0, last = performance.now(), saveIn = 1000;
    const loop = (now: number) => {
      const dt = Math.min(50, now - last) / 1000; last = now;
      if (ended.current) return;
      const s = live.current;
      s.left = Math.max(0, s.left - dt * 1000); saveIn -= dt * 1000;
      for (const l of lanes.current) l.cars = l.cars.map(x => { let n = x + l.dir * l.speed * dt; if (n > 100) n -= 100 + l.w; if (n < -l.w) n += 100 + l.w; return n; });
      const f = frog.current;
      if (f >= 1 && f <= P.lanes && now > splatUntil.current) {
        const l = lanes.current[f - 1];
        if (l.cars.some(x => leapHit(x, l.w))) {
          frog.current = 0; splatUntil.current = now + 500; s.splats += 1;
          soundService.playInvalidWord(); buzz([60, 30, 60]);
        }
      }
      if (saveIn <= 0) { saveIn = 1000; setProgress({ ...s }); }
      setFrame(x => x + 1);
      if (s.left <= 0) { end(false); return; }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const hop = () => {
    if (ended.current || performance.now() < splatUntil.current) return;
    frog.current += 1; tick(); buzz(6);
    const s = live.current;
    if (frog.current <= P.lanes && frog.current > s.best) s.best = frog.current;
    if (frog.current > P.lanes) { s.best = P.lanes; soundService.playMilestone(); buzz([20, 40, 20]); end(true); }
  };
  const s = live.current;
  const splat = performance.now() < splatUntil.current;
  const rows = Array.from({ length: P.lanes + 2 }, (_, i) => P.lanes + 1 - i); // top (far side) to bottom (curb)
  return (
    <>
      <div className="w-full flex justify-between items-baseline text-xl"><span className="font-display text-neon-yellow">Lane {s.best}/{P.lanes} · +{leapPrize(s.best, false)}</span><Secs ms={s.left} warnBelow={4000} /></div>
      <TimeBar ms={s.left} total={P.seconds * 1000} warnBelow={4000} />
      <div className="relative w-full max-w-[19rem] rounded-xl overflow-hidden ring-1 ring-white/15" aria-label={`Road Hop: you are ${frog.current === 0 ? 'on the curb' : `in lane ${frog.current} of ${P.lanes}`}`}>
        {rows.map(r => {
          const lane = r >= 1 && r <= P.lanes ? lanes.current[r - 1] : null;
          return (
            <div key={r} className={`relative h-9 overflow-hidden ${r === P.lanes + 1 ? 'bg-[#1f5130]' : r === 0 ? 'bg-[#4b4f5c]' : 'bg-[#22252d]'} ${lane && r < P.lanes ? 'border-t border-dashed border-white/20' : ''}`}>
              {r === P.lanes + 1 && <span className="absolute inset-0 grid place-items-center osd-text text-sm text-neon-green/80">🏁 THE OTHER SIDE</span>}
              {lane?.cars.map((x, k) => (
                <span key={k} className="absolute top-1/2 -translate-y-1/2 text-2xl leading-none text-center" style={{ left: `${x}%`, width: `${lane.w}%`, transform: `translateY(-50%) ${lane.dir > 0 ? 'scaleX(-1)' : ''}` }} aria-hidden="true">{lane.icon}</span>
              ))}
              {frog.current === r && (
                <span className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 text-2xl leading-none z-10" style={{ left: `${LEAP_FROG.x}%` }} aria-hidden="true">{splat ? '💥' : '🐸'}</span>
              )}
            </div>
          );
        })}
      </div>
      <button type="button" onPointerDown={e => { e.preventDefault(); hop(); }} aria-label="Hop forward"
        className="w-full rounded-xl py-4 bg-neon-green/15 ring-2 ring-neon-green text-neon-green font-display text-2xl select-none touch-none active:scale-95">⬆ HOP</button>
    </>
  );
};

const GAMES: Record<MiniGameId, React.FC<GameProps>> = { pong: Pong, mole: Mole, claw: Claw, darts: Darts, goal: Goal, dice: Dice, bowl: Bowl, golf: Golf, hoops: Hoops, password: Password, bonusStage: BonusStage,
  ringToss: RingToss, riff: Riff, striker: Striker, pitStop: PitStop, coaster: Coaster, seal: Seal, monte: Monte,
  lure: Lure, dial: Dial, wire: Wire, nest: Nest, leap: Leap,
  ladder: Ladder, bigOne: BigOne };

/** The arcade card: intro (Play or Skip), the game, then the result. */
const MiniGameCard: React.FC<{
  id: MiniGameId; title: string; word?: string; firstFind?: boolean;
  /** The pop-up's data (a gate's score, the password). */
  extra?: Record<string, any>; gameState?: GameState;
  saved?: Record<string, unknown>; onSave?: (key: string, value: unknown) => void;
  onDone: (r: MiniGameResult | null) => void;
}> = ({ id, title, word, firstFind, extra, gameState, saved, onSave, onDone }) => {
  const info = MINI_GAMES[id];
  const Game = GAMES[id];
  return (
    <Save.Provider value={{ saved, save: onSave }}>
      <MiniGameFrame info={info} title={title} word={word} firstFind={firstFind} extra={extra} gameState={gameState} Game={Game} onDone={onDone} />
    </Save.Provider>
  );
};

const MiniGameFrame: React.FC<{ info: typeof MINI_GAMES[MiniGameId]; title: string; word?: string; firstFind?: boolean; extra?: Record<string, any>; gameState?: GameState; Game?: React.FC<GameProps>; onDone: (r: MiniGameResult | null) => void }> = ({ info, title, word, firstFind, extra, gameState, Game, onDone }) => {
  const gate = typeof extra?.gate === 'number' ? extra.gate as number : null;
  const [phase, setPhase] = useSaved<'intro' | 'play' | 'done'>('phase', 'intro');
  const [result, setResult] = useSaved<MiniGameResult | null>('result', null);
  if (!info || !Game) return null;
  return (
    <div className="absolute inset-0 bg-crt-950/85 backdrop-blur-sm flex items-center justify-center z-50 p-3 animate-fade-in" role="dialog" aria-modal="true" aria-label={info.name}>
      <div className={`bg-crt-900 border-4 ${gate ? 'border-neon-yellow' : 'border-neon-cyan'} rounded-2xl px-4 py-5 max-w-md w-full flex flex-col items-center text-center gap-3 level-stage-in ${gate ? 'shadow-[0_0_28px_rgba(255,226,122,0.5)]' : 'shadow-[0_0_28px_rgba(61,245,255,0.45)]'}`}>
        <p className={`osd-text text-lg tracking-[0.3em] ${gate ? 'text-neon-yellow' : 'text-neon-cyan'}`}>{gate ? `🚪 THE ${gate.toLocaleString()} GATE` : '🕹️ ARCADE BONUS'}</p>
        {phase === 'intro' && (
          <>
            {gate && <p className="text-slate-300">You crossed <strong className="text-neon-yellow">{gate.toLocaleString()}</strong> points!</p>}
            {word && <p className="text-slate-300">You spelled <strong className="text-white tracking-widest">{word}</strong>! {firstFind && <span className="osd-text text-sm bg-neon-pink text-white px-1.5 py-0.5 rounded">NEW SECRET</span>}</p>}
            {!gate && <p className="osd-text text-base text-slate-400 leading-none">{title}</p>}
            <div className="text-6xl leading-none" aria-hidden="true">{info.icon}</div>
            <p className="font-display text-2xl text-white leading-tight">{info.name}</p>
            {info.flavor && <p className="text-slate-400 italic leading-snug">“{info.flavor}”</p>}
            <p className="text-slate-200 leading-snug">{info.rules}</p>
            <p className="osd-text text-lg text-neon-yellow leading-tight">{info.prize}</p>
            <ArcadeButton color="cyan" size="lg" className="w-full" onClick={() => { soundService.playPowerUp(); setPhase('play'); }}>▶ Play</ArcadeButton>
            <ArcadeButton color="slate" variant="text" className="mx-auto" onClick={() => { soundService.playUIClick(); onDone(null); }}>Skip</ArcadeButton>
          </>
        )}
        {phase === 'play' && (
          <>
            <p className="font-display text-lg text-white leading-none">{info.icon} {info.name}</p>
            {/* The usual result card shows the payout, so the game hands its result straight on. */}
            <Game finish={r => { setResult(r); setPhase('done'); onDone(r); }} extra={extra} gameState={gameState} />
          </>
        )}
        {phase === 'done' && result && (
          <>
            <div className="text-6xl leading-none" aria-hidden="true">{info.icon}</div>
            <p className={`font-display text-3xl leading-tight ${result.points ? 'text-neon-green' : 'text-slate-400'}`} aria-live="polite">{result.headline}</p>
            <p className="text-slate-200">{result.detail}</p>
            <ArcadeButton color={result.points ? 'green' : 'slate'} className="w-full" onClick={() => onDone(result)}>{result.points ? `Take the ${result.points}` : 'Continue'}</ArcadeButton>
          </>
        )}
      </div>
    </div>
  );
};

export default MiniGameCard;
