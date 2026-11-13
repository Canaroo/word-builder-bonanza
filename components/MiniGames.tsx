import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import ArcadeButton from './ArcadeButton';
import { MINI_GAME_VALUES as M } from '../config/gameplay';
import { MINI_GAMES } from '../data/miniGames';
import type { MiniGameId } from '../types';
import { soundService } from '../services/soundService';
import { dartPoints, dicePrize, bowlFirstBall, bowlSecondBall, bowlPrize, hoopShot, hoopsPrize, goalPrize, golfStroke, golfPrize, GOLF_CUP } from '../services/miniGameRules';

// Arcade mini-games (v7.38.0). Spelling an arcade word (GAME, MOLE, CLAW, DART, GOAL, DICE, BOWL,
// TEE, NET) opens this card: an intro with Play or Skip, the game, then the result, which pays
// points through APPLY_MINIGAME. Progress is saved in the pop-up's data (like the gamble cards), so
// quitting mid-game and resuming carries on instead of starting over.

export interface MiniGameResult { points: number; headline: string; detail: string }
type Finish = (r: MiniGameResult) => void;

const Save = createContext<{ saved?: Record<string, unknown>; save?: (key: string, value: unknown) => void }>({});
function useSaved<T>(key: string, init: T | (() => T)): [T, (value: T) => void] {
  const { saved, save } = useContext(Save);
  const restored = !!saved && key in saved;
  const [value, setValue] = useState<T>(() => (restored ? (saved![key] as T) : typeof init === 'function' ? (init as () => T)() : init));
  return [value, (next: T) => { setValue(next); save?.(key, next); }];
}

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
      <div className="w-full flex justify-between font-display text-xl"><span className="text-neon-yellow">+{s.score}</span><span className={s.left < 3000 ? 'text-neon-red' : 'text-neon-cyan'}>{Math.ceil(s.left / 1000)}s</span></div>
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

const GAMES: Record<MiniGameId, React.FC<{ finish: Finish }>> = { pong: Pong, mole: Mole, claw: Claw, darts: Darts, goal: Goal, dice: Dice, bowl: Bowl, golf: Golf, hoops: Hoops };

/** The arcade card: intro (Play or Skip), the game, then the result. */
const MiniGameCard: React.FC<{
  id: MiniGameId; title: string; word?: string; firstFind?: boolean;
  saved?: Record<string, unknown>; onSave?: (key: string, value: unknown) => void;
  onDone: (r: MiniGameResult | null) => void;
}> = ({ id, title, word, firstFind, saved, onSave, onDone }) => {
  const info = MINI_GAMES[id];
  const Game = GAMES[id];
  return (
    <Save.Provider value={{ saved, save: onSave }}>
      <MiniGameFrame info={info} title={title} word={word} firstFind={firstFind} Game={Game} onDone={onDone} />
    </Save.Provider>
  );
};

const MiniGameFrame: React.FC<{ info: typeof MINI_GAMES[MiniGameId]; title: string; word?: string; firstFind?: boolean; Game?: React.FC<{ finish: Finish }>; onDone: (r: MiniGameResult | null) => void }> = ({ info, title, word, firstFind, Game, onDone }) => {
  const [phase, setPhase] = useSaved<'intro' | 'play' | 'done'>('phase', 'intro');
  const [result, setResult] = useSaved<MiniGameResult | null>('result', null);
  if (!info || !Game) return null;
  return (
    <div className="absolute inset-0 bg-crt-950/85 backdrop-blur-sm flex items-center justify-center z-50 p-3 animate-fade-in" role="dialog" aria-modal="true" aria-label={info.name}>
      <div className="bg-crt-900 border-4 border-neon-cyan rounded-2xl px-4 py-5 max-w-md w-full flex flex-col items-center text-center gap-3 level-stage-in shadow-[0_0_28px_rgba(61,245,255,0.45)]">
        <p className="osd-text text-lg tracking-[0.3em] text-neon-cyan">🕹️ ARCADE BONUS</p>
        {phase === 'intro' && (
          <>
            {word && <p className="text-slate-300">You spelled <strong className="text-white tracking-widest">{word}</strong>! {firstFind && <span className="osd-text text-sm bg-neon-pink text-white px-1.5 py-0.5 rounded">NEW SECRET</span>}</p>}
            <p className="osd-text text-base text-slate-400 leading-none">{title}</p>
            <div className="text-6xl leading-none" aria-hidden="true">{info.icon}</div>
            <p className="font-display text-2xl text-white leading-tight">{info.name}</p>
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
            <Game finish={r => { setResult(r); setPhase('done'); onDone(r); }} />
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
