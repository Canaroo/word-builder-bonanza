import React, { useState } from 'react';
import ArcadeButton from './ArcadeButton';
import { Sec } from './Seconds';
import { CHARMS_LIST } from '../data/charms';
import { POWER_PLAYS_LIST } from '../data/powerPlays';
import { CHARM_SLOTS, VIDEO_STORE, GENRE_VALUES, COLLECTOR } from '../config/gameplay';
import { genreById, collectorInfo, restockCost, canAfford, tradeInValue, perStar, playsPerStar, starsOf, takeBackBlock, COLLECTOR_RULE, type Tape, type GenreId, type StoreLine } from '../data/videoStore';
import { introSeen, markIntro } from '../services/intros';
import { prizeFor } from '../services/rules';
import type { Charm, GameState } from '../types';

// 📼 The Video Store (v7.96.0, the owner's design; the approved mockup is the "Word Nerd Video Store"
// artifact). Opens after the level-up card on every other level with the run's clock paused. Every
// price comes off the clock; restock, trade in a charm for seconds back, or walk out for points.

const KIND: Record<Tape['kind'], { label: string; ring: string; text: string; bg: string }> = {
  charm: { label: 'NEW RELEASE', ring: 'ring-neon-green', text: 'text-neon-green', bg: 'bg-[#0d2a1e]' },
  powerPlay: { label: 'POWERPLAY', ring: 'ring-neon-purple', text: 'text-neon-purple', bg: 'bg-[#22113a]' },
  poster: { label: 'POSTER', ring: 'ring-neon-yellow', text: 'text-neon-yellow', bg: 'bg-[#2a2208]' },
  tile: { label: "COLLECTOR'S", ring: 'ring-neon-cyan', text: 'text-neon-cyan', bg: 'bg-[#0b2433]' },
};

interface TapeInfo { icon: string; name: string; text: string; fine?: string; flavor?: string; what: string }
export const tapeInfo = (tape: Tape, gs: Pick<GameState, 'genreStars' | 'genrePlays'>): TapeInfo | null => {
  if (tape.kind === 'charm') {
    const c = CHARMS_LIST.find(x => x.id === tape.id);
    return c ? { icon: c.icon, name: c.name, text: c.description, fine: c.finePrint, flavor: c.flavorText, what: c.breaks ? 'A fragile charm: it takes a slot for 5 words.' : 'A charm: it takes one of your 5 charm slots.' } : null;
  }
  if (tape.kind === 'powerPlay') {
    const p = POWER_PLAYS_LIST.find(x => x.id === tape.id);
    return p ? { icon: p.icon, name: p.name, text: p.description, fine: p.finePrint, flavor: p.flavorText, what: 'A PowerPlay: it goes in your pocket. Tap ▶ USE when you want it.' } : null;
  }
  if (tape.kind === 'poster') {
    const g = genreById(tape.id);
    if (!g) return null;
    const now = starsOf(gs, g.id as GenreId);
    const next = Math.min(GENRE_VALUES.maxStars, now + 1);
    return { icon: g.icon, name: `${g.name} ★${now} → ★${next}`, flavor: g.flavor,
      text: `Every word with ${g.rule} earns +${next * perStar(g.id as GenreId)} points for the rest of the run (now +${now * perStar(g.id as GenreId)}).`,
      fine: `Each ★ adds +${perStar(g.id as GenreId)}. Genres also gain a ★ on their own every ${playsPerStar(g.id as GenreId)} words that fit (${gs.genrePlays?.[g.id] ?? 0}/${playsPerStar(g.id as GenreId)} so far). Up to ★${GENRE_VALUES.maxStars}.`,
      what: 'A genre poster: it raises a genre one ★.' };
  }
  const t = collectorInfo(tape.id);
  return t ? { icon: t.icon, name: t.name, text: t.text, flavor: t.flavor, fine: COLLECTOR_RULE, what: `A Collector's Tile (up to ${COLLECTOR.max} a run).` } : null;
};

/** One of the three store buttons: two short lines, so nothing gets cut off on a phone. */
const StoreAction: React.FC<{ testId: string; tone: 'cyan' | 'pink'; solid?: boolean; disabled?: boolean; onClick: () => void; top: React.ReactNode; bottom: React.ReactNode }> = ({ testId, tone, solid, disabled, onClick, top, bottom }) => (
  <button type="button" data-testid={testId} disabled={disabled} onClick={onClick}
    className={`rounded-xl px-1 py-2 flex flex-col items-center justify-center leading-none transition-transform active:scale-95 disabled:opacity-40 disabled:active:scale-100 ${
      solid ? 'bg-gradient-to-b from-[#ff7cc4] to-neon-pink text-white shadow-[0_4px_0_#9b1f63]'
        : tone === 'cyan' ? 'ring-2 ring-neon-cyan text-neon-cyan bg-crt-900' : 'ring-2 ring-neon-pink text-neon-pink bg-crt-900'}`}>
    <span className="font-display text-[15px] whitespace-nowrap">{top}</span>
    <span className={`osd-text text-base mt-1 whitespace-nowrap ${solid ? 'text-white/90' : 'text-slate-300'}`}>{bottom}</span>
  </button>
);

const StoreIntro: React.FC<{ onOk: () => void }> = ({ onOk }) => (
  <div className="absolute inset-0 z-20 bg-crt-950/90 flex items-center justify-center p-4" data-testid="store-intro">
    <div className="w-full max-w-sm rounded-2xl bg-crt-900 ring-2 ring-neon-pink p-4 text-left flex flex-col gap-2">
      <h2 className="font-display text-2xl text-neon-pink text-center leading-tight">📼 WELCOME TO THE VIDEO STORE</h2>
      <p className="text-slate-100 text-[15px] leading-snug">It opens every other level. Your clock is paused while you shop.</p>
      <ul className="text-[14px] text-slate-200 leading-snug space-y-1.5">
        <li><b className="text-neon-yellow">⏱ Your seconds are your money.</b> Every price comes off your clock. You can't spend below {VIDEO_STORE.keepAtLeast} seconds.</li>
        <li><b className="text-neon-green">📼 Tap a tape</b> to read the back of the box, then check it out. It's yours for the rest of the run: a charm, a PowerPlay, a genre poster or a Collector's Tile.</li>
        <li><b className="text-neon-cyan">🔄 Restock</b> for a new shelf, or <b className="text-neon-cyan">💵 trade in</b> a charm for seconds back.</li>
        <li><b className="text-neon-pink">🚪 Walk out</b> with nothing for +{VIDEO_STORE.walkOut} points.</li>
      </ul>
      <ArcadeButton color="pink" className="w-full mt-1" data-testid="store-intro-ok" onClick={onOk}>Got it, let me shop</ArcadeButton>
    </div>
  </div>
);

const VideoStore: React.FC<{
  data: { level: number; shelf: Tape[]; sold?: number[]; lines?: StoreLine[]; deal?: number };
  clock: number;
  gameState: GameState;
  onRent: (index: number) => void;
  onRestock: () => void;
  onTradeIn: (charmId: string) => void;
  onUndoTrade: (line: number) => void;
  onLeave: () => void;
  onGear: () => void;
}> = ({ data, clock, gameState: gs, onRent, onRestock, onTradeIn, onUndoTrade, onLeave, onGear }) => {
  const [pick, setPick] = useState<number | null>(null);
  const [trading, setTrading] = useState(false);
  const [intro, setIntro] = useState(() => !introSeen('store'));
  const shelf = data.shelf ?? [];
  const sold = data.sold ?? [];
  const lines = data.lines ?? [];
  const restock = restockCost(Number(data.deal ?? 0));
  const charms = gs.activeCharms ?? [];
  const full = charms.length >= CHARM_SLOTS;
  const spent = -lines.filter(l => l.d < 0).reduce((a, l) => a + l.d, 0);
  const back = lines.filter(l => l.d > 0).reduce((a, l) => a + l.d, 0);
  const startClock = clock + spent - back;
  const walkPts = prizeFor(VIDEO_STORE.walkOut, data.level);
  const bossNext = data.level % 3 === 0;
  const tape = pick !== null ? shelf[pick] : null;
  const info = tape ? tapeInfo(tape, gs) : null;
  const isSold = pick !== null && sold.includes(pick);
  const blockedBy = !tape || isSold ? null
    : tape.kind === 'charm' && full ? `Your ${CHARM_SLOTS} charm slots are full. Trade one in first.`
    : tape.kind === 'charm' && charms.some(c => c.id === tape.id) ? 'You already have this charm.'
    : !canAfford(clock, tape.price) ? `That would leave you under ${VIDEO_STORE.keepAtLeast} seconds.` : null;
  const pocket = gs.availablePowerPlays?.[0];

  return (
    <div className="absolute inset-0 z-50 bg-crt-950 flex items-start justify-center overflow-y-auto p-3 animate-fade-in" role="dialog" aria-modal="true" aria-label="The Video Store" data-testid="video-store">
      <div className="relative w-full max-w-md flex flex-col gap-2.5 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="osd-text text-base leading-none text-slate-400 tracking-widest">LEVEL {data.level} STARTS WHEN YOU LEAVE{bossNext ? ' · ⚠ BOSS LEVEL' : ''}</p>
            <h2 className="font-display text-2xl leading-tight text-neon-pink mt-1">📼 THE VIDEO STORE</h2>
            <p className="text-[13px] text-slate-300 leading-snug">Prices come off your clock. The clock is paused.</p>
          </div>
          <div className={`shrink-0 rounded-xl ring-2 px-3 py-1.5 text-center ${clock < 20 ? 'ring-neon-red text-neon-red' : 'ring-neon-cyan text-neon-cyan'}`} data-testid="store-clock">
            <p className="osd-text text-xs leading-none tracking-widest text-slate-400">YOUR CLOCK</p>
            <p className="font-display text-3xl leading-none mt-0.5 tabular-nums">{clock}<Sec /></p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2" data-testid="store-shelf">
          {shelf.map((t, i) => {
            const k = KIND[t.kind];
            const ti = tapeInfo(t, gs);
            const gone = sold.includes(i);
            return (
              <button key={`${data.deal}-${i}`} type="button" data-testid="store-tape" onClick={() => { setPick(i); setTrading(false); }}
                className={`relative rounded-xl ring-2 ${k.ring} ${k.bg} px-1.5 pt-2 pb-1.5 flex flex-col items-center text-center min-h-[8.5rem] transition-transform active:scale-95 ${pick === i ? 'shadow-[0_0_18px_rgba(255,255,255,0.35)] -translate-y-0.5' : ''} ${gone ? 'opacity-50' : ''}`}>
                <span className={`osd-text text-[11px] leading-none tracking-wider ${k.text}`}>{k.label}</span>
                <span className="text-3xl leading-none mt-1.5" aria-hidden="true">{ti?.icon}</span>
                <span className="text-[12px] leading-tight text-white mt-1 line-clamp-2">{ti?.name}</span>
                <span className="mt-auto osd-text text-base leading-none rounded bg-neon-yellow text-crt-950 px-1.5 py-0.5">{gone ? '✓ YOURS' : <>−{t.price}<Sec /></>}</span>
              </button>
            );
          })}
        </div>

        <div className="rounded-xl bg-crt-900 ring-1 ring-white/15 p-3 min-h-[6rem]" data-testid="store-detail">
          {!tape || !info ? (
            <p className="text-slate-300 text-[14px] leading-snug">👆 Tap a tape to read the back of the box.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              <p className="font-display text-lg leading-tight text-white">{info.icon} {info.name}</p>
              <p className={`osd-text text-sm leading-none ${KIND[tape.kind].text}`}>{info.what}</p>
              <p className="text-slate-100 text-[14px] leading-snug">{info.text}</p>
              {info.fine && <p className="text-slate-400 text-[12px] leading-snug" data-testid="fine-print">{info.fine}</p>}
              {info.flavor && <p className="text-slate-400 text-[12px] italic leading-snug">“{info.flavor}”</p>}
              {tape.kind === 'powerPlay' && pocket && !isSold && <p className="text-neon-yellow text-[12px] leading-snug">This swaps out {pocket.icon} {pocket.name} from your pocket.</p>}
              {blockedBy && <p className="text-neon-red text-[13px] leading-snug" data-testid="store-blocked">{blockedBy}</p>}
              {isSold ? <p className="osd-text text-lg text-neon-green">✓ CHECKED OUT · IT'S YOURS</p> : (
                <ArcadeButton color="green" className="w-full" data-testid="store-rent" disabled={!!blockedBy} onClick={() => onRent(pick!)}>
                  ▶ Check out · −{tape.price}<Sec />
                </ArcadeButton>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <StoreAction testId="store-restock" tone="cyan" disabled={!canAfford(clock, restock)} onClick={() => { setPick(null); onRestock(); }}
            top="🔄 RESTOCK" bottom={<>−{restock}<Sec /></>} />
          <StoreAction testId="store-trade" tone="cyan" disabled={!charms.some(c => !c.breaks)} onClick={() => setTrading(t => !t)}
            top="💵 TRADE IN" bottom="SELL A CHARM" />
          <StoreAction testId="store-leave" tone="pink" solid onClick={onLeave}
            top={lines.length ? '✓ DONE' : '🚪 WALK OUT'} bottom={lines.length ? 'BACK TO PLAY' : `+${walkPts} PTS`} />
        </div>

        {trading && (
          <div className="rounded-xl bg-crt-900 ring-1 ring-neon-cyan/50 p-3 flex flex-col gap-1.5" data-testid="store-trade-list">
            <p className="text-slate-200 text-[13px] leading-snug">Sell a charm for seconds back: half its price, or all of it if it's upgraded ⭐. Its slot opens up.</p>
            {charms.map((c: Charm) => {
              const up = (gs.charmUpgrades ?? []).includes(c.id);
              return (
                <button key={c.id} type="button" disabled={!!c.breaks} onClick={() => { onTradeIn(c.id); setTrading(false); }}
                  className="flex items-center justify-between gap-2 rounded-lg bg-crt-950/70 ring-1 ring-white/10 px-2.5 py-1.5 text-left disabled:opacity-40">
                  <span className="text-[14px] text-white truncate">{c.icon} {c.name}{up ? ' ⭐' : ''}</span>
                  <span className="shrink-0 osd-text text-base text-neon-green">{c.breaks ? "FRAGILE: CAN'T" : <>+{tradeInValue(c, up)}<Sec /></>}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* v7.96.10 (the owner's ask): one clear way to check what you hold. It opens the normal Gear menu;
            its ◀ STORE brings you back here. */}
        <button type="button" data-testid="store-gear" onClick={onGear}
          className="w-full rounded-xl ring-2 ring-neon-purple bg-[#22113a] px-3 py-2 flex items-center gap-3 text-left active:scale-[0.98] transition-transform">
          <span className="relative text-3xl leading-none" aria-hidden="true">🎒
            <span className="absolute -bottom-1.5 -right-2 rounded-full bg-neon-purple text-white osd-text text-xs leading-[1rem] px-1">{charms.length}/{CHARM_SLOTS}</span>
          </span>
          <span className="flex-1 min-w-0">
            <span className="block font-display text-[15px] text-white leading-tight">CHECK YOUR GEAR</span>
            <span className="block text-[12px] text-slate-300 leading-snug">See your charms, pocket and genres before you buy. You'll come right back here.</span>
          </span>
          <span className="osd-text text-xl text-neon-purple" aria-hidden="true">▶</span>
        </button>

        <div className="rounded-sm bg-[#f4f0e2] text-[#222] px-3 py-2 font-mono text-[12px] leading-snug shadow-inner" data-testid="store-receipt">
          <p className="text-center tracking-widest">RECEIPT · LEVEL {data.level}</p>
          <div className="border-t border-dashed border-[#888] my-1" />
          {lines.length === 0 ? <p>NOTHING CHECKED OUT YET</p> : lines.map((l, i) => {
            // v7.96.10 (the owner's ask): a trade-in can be taken back until Done.
            const block = l.trade ? takeBackBlock(l, clock, charms) : null;
            return (
              <div key={i} className="py-0.5">
                <p className="flex justify-between gap-2"><span className="truncate">{l.t}</span><span className="shrink-0">{l.d > 0 ? '+' : '−'}{Math.abs(l.d)} sec</span></p>
                {l.trade && (
                  <div className="flex items-center justify-between gap-2 mt-0.5 mb-1">
                    <span className="text-[11px] text-[#666] leading-tight">{block ?? `Changed your mind? It goes back in a slot for −${l.d} sec.`}</span>
                    <button type="button" data-testid="store-take-back" disabled={!!block} onClick={() => onUndoTrade(i)}
                      className="shrink-0 rounded border-2 border-[#222] bg-white px-2 py-0.5 font-bold text-[12px] active:scale-95 disabled:opacity-40">↩ TAKE BACK</button>
                  </div>
                )}
              </div>
            );
          })}
          <div className="border-t border-dashed border-[#888] my-1" />
          <p className="flex justify-between"><span>CLOCK</span><span>{startClock} → {clock} sec</span></p>
        </div>
      </div>
      {intro && <StoreIntro onOk={() => { markIntro('store'); setIntro(false); }} />}
    </div>
  );
};

export default VideoStore;
