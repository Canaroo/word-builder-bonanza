import React, { useEffect, useState } from 'react';
import type { Charm, GameState, PowerPlay } from '../types';
import { CHARM_BONUS, CHARM_SLOTS, GENRE_VALUES, COLLECTOR, CHARM_SET_BONUS } from '../config/gameplay';
import { GENRES, starsOf, perStar, playsPerStar, collectorInfo, COLLECTOR_RULE, COLLECTOR_TILES, genreEarned } from '../data/videoStore';
import TileComponent from './Tile';
import { CHARMS_LIST, CHARM_TIME_SECONDS, UPGRADABLE_CHARM_IDS } from '../data/charms';
import { CHARM_SETS, setPayFor } from '../data/charmSets';
import { clockSpeedFor, hammerClockFor, prizeScaleFor, wordTimeScaleFor } from '../services/rules';
import { hitsBoard } from '../services/greatestHits';
import { GREATEST_HITS } from '../config/gameplay';
import ArcadeButton from './ArcadeButton';

// "Your Gear" (v7.71.0, the owner's idea): an old-school RPG menu with everything the run is
// carrying in one place: charms (and what each has earned this run), the pocket PowerPlay (usable
// from here), running effects, charm sets and a run summary. Tap anything and the box
// at the bottom explains it. The game is paused and the board is covered while it's open.

const plainQuotes = (s: string) => s.replace(/[‘’]/g, "'");
/**
 * Whether a score line belongs to this charm: its name, maybe after a leading emoji, then nothing or
 * a non-letter (v7.72.3). Many lines add detail after the name, like "Last Action Hero (E)",
 * "Golden Ticket!" or "Sands of Time! +5s next round"; matching the exact name missed them, so the
 * Gear menu showed nothing earned for charms that were paying. Scoring matches the same way.
 */
export const lineIsFrom = (lineName: string, name: string): boolean => {
  const want = plainQuotes(name);
  return [lineName, lineName.replace(/^\S+\s/, '')].some(n => {
    const plain = plainQuotes(n);
    return plain.startsWith(want) && !/^[A-Za-z0-9]/.test(plain.slice(want.length));
  });
};

/**
 * What a charm (or set) has earned this run: its score lines on valid words, plus event log entries
 * in its name (v7.72.4: Double Dare, CTU Safe House, the Croc, Wile E. Coyote and Keymaster pay as
 * events, not word lines). Points can be negative (the Croc bites). National Treasure's share is
 * read from the secret bonus lines it multiplied.
 */
export const earnedThisRun = (log: GameState['log'], name: string): { points: number; seconds: number; boosts: number; multiplier: number } => {
  let points = 0, seconds = 0, boosts = 0, multiplier = 0;
  const secsIn = (text: string) => { const m = text.match(/\+(\d+)\s*s\b|\+(\d+)s/); return m ? Number(m[1] ?? m[2]) : 0; };
  const treasure = name === 'National Treasure';
  for (const e of log) {
    if (e.type === 'event') {
      // Bean Counter logs an event beside its word line for the same points: count it once.
      if (!lineIsFrom(e.name, name) || e.id?.startsWith('charm-beanCounter')) continue;
      const change = (e as { scoreChange?: number }).scoreChange ?? 0;
      points += change;
      seconds += secsIn(e.description ?? '');
      continue;
    }
    if (e.type !== 'word' || e.status !== 'valid') continue;
    let boosted = false;
    for (const b of (e as { bonuses?: { name: string; description: string }[] }).bonuses ?? []) {
      const pts = b.description.match(/([+-])([\d,]+)\s*pts/);
      const ptsValue = pts ? (pts[1] === '-' ? -1 : 1) * Number(pts[2].replace(/,/g, '')) : 0;
      if (treasure && pts && b.description.includes('(National Treasure)')) {
        const paid = ptsValue;
        points += paid - Math.round(paid / CHARM_BONUS.nationalTreasureMultiplier);
        continue;
      }
      if (!lineIsFrom(b.name, name)) continue;
      const mult = b.description.match(/(?:^|\s)x(\d+(?:\.\d+)?)/);
      if (pts) points += ptsValue;
      else if (mult) { boosted = true; multiplier = Number(mult[1]); }
      else seconds += secsIn(b.description);
    }
    // Multiplier charms (S Club Party, Freaky Friday, I'm Ready!...) log "x2 Score", not points:
    // their share of a word can't be split from the rest, so Gear counts the words they multiplied.
    if (boosted) boosts++;
  }
  return { points, seconds, boosts, multiplier };
};

/** "+1,240", "+20s", "+20s · -300": what the Gear menu shows next to a charm. */
export const earnedLabel = (e: { points: number; seconds: number; boosts?: number; multiplier?: number }): string =>
  [e.seconds ? `+${e.seconds}s` : '', e.points ? `${e.points > 0 ? '+' : '-'}${Math.abs(e.points).toLocaleString()}` : '',
    e.boosts ? `x${e.multiplier} ON ${e.boosts} WORD${e.boosts === 1 ? '' : 'S'}` : ''].filter(Boolean).join(' · ');

/** Charms that pay points or time outside the usual lists (their payouts are logged as events). */
const EVENT_PAY_IDS = new Set(['doubleDare', 'wileECoyote', 'keymaster', 'nationalTreasure', 'tickTockCroc', 'powerGlove', 'ctuSafeHouse']);
/** Whether Gear can show a running total for this charm, or it changes the rules instead. */
export const paysDirectly = (c: Charm): boolean =>
  UPGRADABLE_CHARM_IDS.has(c.id) || c.id in CHARM_TIME_SECONDS || !!c.breaks || EVENT_PAY_IDS.has(c.id)
  || ['sTierScorer', 'chuckNorrisWhy', 'freakyFriday', 'battleOfWits', 'weWereOnABreak', 'finishHim', 'imReady',
    'doctorStrangesLoop', 'beanCounter', 'backpack', 'goldenGirls', 'hammerTime'].includes(c.id);

type Pick = { icon: string; name: string; tag?: string; text: string; flavor?: string };

/** v7.98.0 (the owner's ask): a title with `info` gets a ⓘ; tapping it explains how the whole section works. */
const Box: React.FC<{ title: string; right?: React.ReactNode; children: React.ReactNode; info?: () => void; infoOn?: boolean }> = ({ title, right, children, info, infoOn }) => (
  <section className="rounded-lg border-2 border-white/80 bg-[#0b1a4a] shadow-[inset_0_0_0_2px_#0b1a4a,inset_0_0_0_3px_rgba(255,255,255,0.25)] px-2.5 py-2">
    <div className="flex items-baseline justify-between mb-1">
      {info ? (
        <button type="button" onClick={info} data-testid={`gear-info-${title.toLowerCase().replace(/[^a-z]+/g, '-')}`} aria-label={`How ${title.toLowerCase()} work`}
          className={`osd-text text-lg leading-none tracking-widest text-left rounded px-1 -mx-1 ${infoOn ? 'bg-white/10 text-white' : 'text-neon-yellow hover:bg-white/5'}`}>
          {title} <span className="inline-block rounded-full ring-1 ring-current px-1.5 text-sm leading-[1.1rem] align-middle tracking-normal">ⓘ HOW IT WORKS</span>
        </button>
      ) : <h3 className="osd-text text-lg leading-none text-neon-yellow tracking-widest">{title}</h3>}
      {right && <span className="osd-text text-base leading-none text-slate-300">{right}</span>}
    </div>
    {children}
  </section>
);

const Row: React.FC<{ selected: boolean; onClick: () => void; icon: string; label: React.ReactNode; right?: React.ReactNode; dim?: boolean }> = ({ selected, onClick, icon, label, right, dim }) => (
  <button type="button" onClick={onClick} className={`w-full flex items-center gap-1.5 text-left py-1 rounded ${selected ? 'bg-white/10' : 'hover:bg-white/5'} ${dim ? 'opacity-60' : ''}`}>
    <span className={`osd-text text-lg leading-none w-3 ${selected ? 'text-white animate-pulse' : 'text-transparent'}`} aria-hidden="true">▶</span>
    <span className="text-lg leading-none" aria-hidden="true">{icon}</span>
    <span className="flex-1 min-w-0 text-sm text-white leading-tight truncate">{label}</span>
    {right && <span className={`osd-text text-base leading-none whitespace-nowrap ${typeof right === 'string' && /(^|· )-/.test(right) && !/\+/.test(right) ? 'text-neon-red' : 'text-neon-green'}`}>{right}</span>}
  </button>
);

const GearMenu: React.FC<{
  gameState: GameState;
  level: number;
  strikesLeft: number;
  maxStrikes: number;
  /** What each running PowerPlay or charm has left (the tray's own labels). */
  progressFor: (buff: Charm | PowerPlay) => string;
  /** Leave out to hide ▶ USE (Gear opened from the Video Store). */
  onUse?: (pp: PowerPlay) => void;
  /** The close button's text (default ✕ BACK) and an optional line under the title. */
  backLabel?: string;
  note?: string;
  onClose: () => void;
  /** v7.84.0: what left the top of the board lives here now. */
  words?: number;
  onSound?: () => void;
  onLog?: () => void;
  onSave?: () => void;
  trophies?: { id: string; icon: string; name: string; unlocked: boolean }[];
  onTrophy?: (id: string) => void;
}> = ({ gameState: gs, level, strikesLeft, maxStrikes, progressFor, onUse, onClose, backLabel, note, words, onSound, onLog, onSave, trophies, onTrophy }) => {
  const [sel, setSel] = useState<string | null>(null);
  const [pick, setPick] = useState<Pick | null>(null);
  const choose = (key: string, p: Pick) => { setSel(key); setPick(p); };
  const charms = gs.activeCharms ?? [];
  const hammer = charms.some(c => c.id === 'hammerTime');
  const charmIds = charms.map(c => c.id);
  const running = (gs.activeBuffs ?? []).filter(b => !charmIds.includes(b.id));
  const pocket = gs.availablePowerPlays ?? [];
  const sets = CHARM_SETS.map(set => ({ set, held: set.members.filter(m => charmIds.includes(m)).length })).filter(x => x.held > 0);
  const shields = [
    gs.activePowerPlays?.strikeShield && '🛡️ a shield blocks your next strike',
    gs.activePowerPlays?.plotArmor && '🎬 Plot Armor: your next strike costs 150 points instead',
    gs.activePowerPlays?.chubbsPepTalk && "💪 Chubbs' Pep Talk erases your next strike",
    gs.activePowerPlays?.rewind && '⏪ Turn Back Time erases your next strike',
  ].filter(Boolean) as string[];
  const fragile = charms.filter(c => c.breaks);
  // v7.96.10: the menu covers the app frame, so its top must be on screen. A tall card opened before it (the
  // Video Store) can leave the frame scrolled, which hid Gear's title and ◀ STORE.
  useEffect(() => { document.getElementById('main-container')?.scrollTo(0, 0); }, []);

  return (
    <div className="absolute inset-0 z-50 bg-crt-950 flex flex-col p-2.5 gap-2 animate-fade-in" role="dialog" aria-modal="true" aria-label="Your gear">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl text-white tracking-wider">🎒 YOUR GEAR</h2>
        <button type="button" onClick={onClose} className="osd-text text-xl text-neon-cyan px-2" aria-label={backLabel ? 'Back to the Video Store' : 'Close and keep playing'} data-testid="gear-close">{backLabel ?? '✕ BACK'}</button>
      </div>
      <p className="osd-text text-sm leading-none text-slate-400 -mt-1">GAME PAUSED · TAP ANYTHING FOR DETAILS</p>
      {note && <p className="text-[13px] leading-snug text-neon-yellow rounded-lg ring-1 ring-neon-yellow/40 bg-[#2a2208] px-2.5 py-1.5" data-testid="gear-note">{note}</p>}
      {(onSound || onLog || onSave) && (
        <div className="grid grid-cols-3 gap-1.5" data-testid="gear-actions">
          {onSound && <button type="button" onClick={onSound} className="rounded-lg ring-1 ring-white/30 bg-[#0b1a4a] py-1.5 flex flex-col items-center gap-0.5 hover:ring-neon-cyan" aria-label="Sound and music"><span className="text-xl leading-none" aria-hidden="true">🔊</span><span className="osd-text text-sm leading-none text-white">SOUND</span></button>}
          {onLog && <button type="button" onClick={onLog} className="rounded-lg ring-1 ring-white/30 bg-[#0b1a4a] py-1.5 flex flex-col items-center gap-0.5 hover:ring-neon-cyan" aria-label="Event log"><span className="text-xl leading-none" aria-hidden="true">📖</span><span className="osd-text text-sm leading-none text-white">EVENT LOG</span></button>}
          {onSave && <button type="button" onClick={onSave} className="rounded-lg ring-1 ring-white/30 bg-[#0b1a4a] py-1.5 flex flex-col items-center gap-0.5 hover:ring-neon-cyan" aria-label="Save and quit"><span className="text-xl leading-none" aria-hidden="true">💾</span><span className="osd-text text-sm leading-none text-white">SAVE & QUIT</span></button>}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain flex flex-col gap-2 pr-0.5">
        <Box title="RUN STATUS" right={`LEVEL ${level}${words !== undefined ? ` · ${words} WORDS` : ''}`}>
          <Row selected={sel === 'strikes'} icon="❌" label={<>Strikes left: <strong>{strikesLeft} of {maxStrikes}</strong>{shields.length ? ` · ${shields.length} protection${shields.length > 1 ? 's' : ''} up` : ''}</>}
            onClick={() => choose('strikes', { icon: '❌', name: 'Strikes', text: `An invalid word is a strike. ${maxStrikes} strikes and the run ends.${shields.length ? `\n\nProtecting you now:\n${shields.join('\n')}` : ' Nothing is protecting you right now.'}${fragile.length ? `\n\n💔 Your fragile charms (${fragile.map(c => c.name).join(', ')}) break on any invalid word or strike, even a blocked one.` : ''}` })} />
          <Row selected={sel === 'clock'} icon="⏱️" label={<>Clock speed <strong>x{(hammer ? hammerClockFor(level) : clockSpeedFor(level)).toFixed(2)}</strong>{hammer ? ' 🛑' : ''} · word time <strong>{Math.round(wordTimeScaleFor(level) * 100)}%</strong></>}
            onClick={() => choose('clock', { icon: '⏱️', name: 'The clock', text: `At level ${level} the clock runs x${clockSpeedFor(level).toFixed(2)} speed, and each word earns ${Math.round(wordTimeScaleFor(level) * 100)}% of its normal time. Both get tougher as the levels climb.${hammer ? `\n\n🛑 Hammer Time takes ${CHARM_BONUS.hammerTimeSlowPercent}% off: your clock runs x${hammerClockFor(level).toFixed(2)} instead of x${clockSpeedFor(level).toFixed(2)}. It keeps working as the clock speeds up.` : ''}` })} />
          <Row selected={sel === 'prizes'} icon="🏆" label={<>PowerPlay prizes <strong>x{prizeScaleFor(level).toFixed(1)}</strong></>}
            onClick={() => choose('prizes', { icon: '🏆', name: 'Prize boost', text: `PowerPlay point prizes grow with the level. At level ${level} they pay x${prizeScaleFor(level).toFixed(1)}.` })} />
        </Box>

        <Box title="CHARMS" right={`${charms.length}/${CHARM_SLOTS}`}>
          {charms.length === 0 && <p className="text-sm text-slate-400 py-1">No charms yet. Play words to earn a charm offer.</p>}
          {charms.map(c => {
            const e = earnedThisRun(gs.log, c.name);
            const earned = earnedLabel(e);
            const earnedText = [e.points ? `${e.points > 0 ? '+' : '-'}${Math.abs(e.points).toLocaleString()} points` : '', e.seconds ? `+${e.seconds} seconds` : '', e.boosts ? `multiplied ${e.boosts} word${e.boosts === 1 ? '' : 's'} x${e.multiplier}` : ''].filter(Boolean).join(', ');
            const up = (gs.charmUpgrades ?? []).includes(c.id);
            const set = CHARM_SETS.find(s => s.members.includes(c.id));
            const tags = [up && '⭐ upgraded', c.breaks && '💔 fragile', set && `🧩 ${set.name}`].filter(Boolean).join(' · ');
            const prog = progressFor(c);
            return (
              <Row key={c.id} selected={sel === c.id} icon={c.icon}
                label={<>{c.name}{up ? ' ⭐' : ''}{c.breaks ? ' 💔' : ''}{prog ? <span className="osd-text text-base text-neon-yellow"> {prog}</span> : null}</>}
                right={earned}
                onClick={() => choose(c.id, { icon: c.icon, name: c.name, tag: tags || undefined,
                  text: `${c.description}${c.finePrint ? `\n\n${c.finePrint}` : ''}${earnedText ? `\n\nThis run: ${earnedText}.` : paysDirectly(c) ? '\n\nNothing earned from it yet this run.' : "\n\nIt changes the rules instead of paying points or time, so there's no total to show."}`, flavor: c.flavorText })} />
            );
          })}
        </Box>

        <Box title="POCKET">
          {pocket.length === 0 ? <p className="text-sm text-slate-400 py-1">Empty. Fill the PowerPlay meter to pick one.</p> : pocket.map(p => (
            <div key={p.id} className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <Row selected={sel === `pp-${p.id}`} icon={p.icon} label={p.name}
                  onClick={() => choose(`pp-${p.id}`, { icon: p.icon, name: p.name, text: p.finePrint ? `${p.description}\n\n${p.finePrint}` : p.description, flavor: p.flavorText })} />
              </div>
              {onUse && <ArcadeButton color="green" size="sm" onClick={() => onUse(p)}>▶ USE</ArcadeButton>}
            </div>
          ))}
        </Box>

        <Box title="RUNNING NOW">
          {running.length === 0 ? <p className="text-sm text-slate-400 py-1">Nothing running.</p> : running.map(b => {
            const prog = progressFor(b);
            return (
              <Row key={b.instanceId || b.id} selected={sel === `run-${b.id}`} icon={b.icon} label={b.name} right={prog}
                onClick={() => choose(`run-${b.id}`, { icon: b.icon, name: b.name, tag: prog ? `Left: ${prog}` : undefined, text: b.description, flavor: b.flavorText })} />
            );
          })}
        </Box>

        {sets.length > 0 && (
          <Box title="CHARM SETS" infoOn={sel === 'info-sets'} info={() => choose('info-sets', { icon: '🧩', name: 'How charm sets work',
            text: `Some charms belong to a themed set of 2 or 3. Hold the whole pair and every word earns +${CHARM_SET_BONUS.pair}. A trio pays +${CHARM_SET_BONUS.trioPartial} a word once you hold 2 of the 3, and +${CHARM_SET_BONUS.trio} with all 3.\n\nWhile you hold part of a set, charm offers sometimes deal you a missing piece. Swapping a piece out stops the set paying.` })}>
            {sets.map(({ set, held }) => {
              const n = set.members.length;
              const now = setPayFor(set, held);
              const next = held < n ? setPayFor(set, held + 1) : 0;
              const missing = set.members.filter(m => !charmIds.includes(m)).map(id => CHARMS_LIST.find(c => c.id === id)).filter(Boolean) as Charm[];
              const e = earnedThisRun(gs.log, `🧩 ${set.name} set`);
              return (
                <Row key={set.id} selected={sel === `set-${set.id}`} icon={set.icon} label={<>{set.name} <span className="osd-text text-base text-neon-yellow">{held}/{n}</span></>}
                  right={now ? `+${now}/WORD` : ''}
                  onClick={() => choose(`set-${set.id}`, { icon: set.icon, name: `${set.name} set`,
                    text: `${now ? `Pays +${now} on every word now.` : 'Not paying yet.'}${held < n ? ` ${missing.map(c => `${c.icon} ${c.name}`).join(' and ')} would ${held + 1 === n ? 'complete it' : 'add to it'}: +${next} a word.` : ' Complete!'}${e.points ? `\n\nThis run: +${e.points.toLocaleString()} points.` : ''}`,
                    flavor: set.flavorText })} />
              );
            })}
          </Box>
        )}

        {/* v7.98.0 (the owner's ask: players saw framed tiles and didn't know why): a legend of all four Collector's
            Tiles, each shown in its real frame, owned or not, so the frames can always be looked up. */}
        {(() => {
          const owned = gs.collectorTiles ?? [];
          const sample: Record<string, string> = { chrome: 'C', holo: 'H', static: '?', rewind: 'R' };
          return (
            <Box title="COLLECTOR'S TILES" right={`${owned.length}/${COLLECTOR.max} OWNED`}
              infoOn={sel === 'info-collector'} info={() => choose('info-collector', { icon: '💿', name: "How Collector's Tiles work",
                text: `Collector's Tiles are special tiles you keep for the rest of the run. Each kind wears its own frame, so you can spot it in your hand:\n${COLLECTOR_TILES.map(c => `${c.icon} ${c.name}: ${c.look}. ${c.text}`).join('\n')}\n\n${COLLECTOR_RULE} Get them in the 📼 Video Store or from a scratch-off ticket, up to ${COLLECTOR.max} a run.` })}>
              <div className="flex flex-col gap-1" data-testid="gear-collectors">
                {COLLECTOR_TILES.map(c => {
                  const have = owned.filter(o => o.kind === c.kind).length;
                  const key = `col-${c.kind}`;
                  return (
                    <button key={c.kind} type="button" data-testid="gear-collector" data-kind={c.kind}
                      onClick={() => choose(key, { icon: c.icon, name: c.name, tag: have ? `YOU HAVE ${have}` : 'NOT IN YOUR RUN YET',
                        text: `${c.text}\n\nHow to spot it: ${c.look}.\n\n${COLLECTOR_RULE}${have ? '' : ` Find one in the 📼 Video Store (${COLLECTOR.prices[c.kind]} sec) or on a scratch-off ticket.`}`, flavor: c.flavor })}
                      className={`w-full flex items-center gap-2.5 text-left rounded-lg px-1.5 py-1.5 ${sel === key ? 'bg-white/10 ring-1 ring-white/30' : 'hover:bg-white/5'}`}>
                      <span className="relative shrink-0 w-9 h-10 pointer-events-none" aria-hidden="true">
                        <TileComponent tile={{ id: `legend-${c.kind}`, letter: sample[c.kind], points: c.kind === 'static' ? 0 : 1, collector: c.kind }} onClick={() => {}} packTileClass="" />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm text-white leading-tight">{c.icon} {c.name}</span>
                        <span className="block text-[12px] text-slate-300 leading-tight">{c.short}</span>
                      </span>
                      <span className={`shrink-0 osd-text text-sm leading-none whitespace-nowrap ${have ? 'text-neon-green' : 'text-slate-500'}`}>{have ? `YOU HAVE ${have}` : 'VIDEO STORE'}</span>
                    </button>
                  );
                })}
              </div>
            </Box>
          );
        })()}

        {/* v7.96.0: Genre Levels and Collector's Tiles. v7.96.2 (the owner's ask): each genre shows what it pays
            a word, what it has earned this run and how close the next ★ is. */}
        {(() => {
          const rows = GENRES.map(g => ({ g, st: starsOf(gs, g.id), plays: gs.genrePlays?.[g.id] ?? 0, need: playsPerStar(g.id), earned: genreEarned(gs.log ?? [], g) }));
          const total = rows.reduce((t, r) => t + r.earned.points, 0);
          return (
            <Box title="GENRES" right={total ? `+${total.toLocaleString()} THIS RUN` : `★${rows.reduce((t, r) => t + r.st, 0)}`}
              infoOn={sel === 'info-genres'} info={() => choose('info-genres', { icon: '🎬', name: 'How genres work',
                text: `Every word you play can fit a genre, like a movie on the shelf:\n${GENRES.map(g => `${g.icon} ${g.name}: words with ${g.rule}.`).join('\n')}\n\nOnce a genre has a ★, every word that fits it earns bonus points, and each ★ adds more (up to ★${GENRE_VALUES.maxStars}). Stars come two ways: buy the genre's poster in the 📼 Video Store, or keep playing words that fit it.\n\nWhile you spell, the stage shows which genres your word fits and what they'll pay.` })}>
              <div className="flex flex-col gap-1" data-testid="gear-genres">
                {rows.map(({ g, st, plays, need, earned }) => {
                  const maxed = st >= GENRE_VALUES.maxStars;
                  const pay = st * perStar(g.id);
                  return (
                    <button key={g.id} type="button" data-testid="gear-genre"
                      onClick={() => choose(`genre-${g.id}`, { icon: g.icon, name: `${g.name} ★${st}`, tag: earned.points ? `+${earned.points.toLocaleString()} THIS RUN` : maxed ? 'MAXED' : undefined,
                        text: `Words with ${g.rule}. ${st ? `Each one earns +${pay} points (★${st} × ${perStar(g.id)}).` : 'No bonus yet: it starts paying at ★1.'}${earned.points ? ` This run it has paid +${earned.points.toLocaleString()} on ${earned.words} word${earned.words === 1 ? '' : 's'}.` : ''}\n\nStars come two ways: buy its poster in the 📼 Video Store, or play ${need} words that fit it${maxed ? '' : ` (${plays}/${need} toward ★${st + 1})`}. Every ★ adds +${perStar(g.id)}, up to ★${GENRE_VALUES.maxStars}.`,
                        flavor: g.flavor })}
                      className={`w-full text-left rounded-lg px-2 py-1.5 ${sel === `genre-${g.id}` ? 'bg-white/10 ring-1 ring-white/30' : 'hover:bg-white/5'} ${st === 0 && !plays ? 'opacity-60' : ''}`}>
                      <div className="flex items-center gap-1.5">
                        <span className="text-lg leading-none" aria-hidden="true">{g.icon}</span>
                        <span className="text-sm text-white leading-tight">{g.name}</span>
                        <span className="osd-text text-base leading-none text-neon-yellow">{'★'.repeat(st)}<span className="text-slate-600">{'★'.repeat(GENRE_VALUES.maxStars - st)}</span></span>
                        <span className={`ml-auto osd-text text-base leading-none whitespace-nowrap ${st ? 'text-neon-green' : 'text-slate-400'}`}>{st ? `+${pay} A WORD` : 'NOT PAYING YET'}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 pl-7">
                        <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden" aria-hidden="true">
                          <div className="h-full bg-neon-yellow" style={{ width: `${maxed ? 100 : Math.round((plays / need) * 100)}%` }} />
                        </div>
                        <span className="osd-text text-sm leading-none text-slate-300 whitespace-nowrap">{maxed ? 'MAX ★' : `${plays}/${need} TO ★${st + 1}`}</span>
                        <span className={`osd-text text-sm leading-none whitespace-nowrap ${earned.points ? 'text-neon-green' : 'text-slate-500'}`} data-testid="gear-genre-earned">EARNED +{earned.points.toLocaleString()}</span>
                      </div>
                    </button>
                  );
                })}
                <p className="text-[12px] text-slate-400 leading-snug pt-0.5">★ come from posters in the 📼 Video Store, or by playing words that fit.</p>
              </div>
            </Box>
          );
        })()}
        {(() => {
          // v7.86.0 (the owner's ask): Greatest Hits, so players can see which word to replay for a record.
          const rows = hitsBoard(gs.log ?? [], gs.hitsClaimed ?? []);
          const live = rows.filter(r => r.done || r.word);
          const first = GREATEST_HITS.tiers[0];
          return (
            <Box title="GREATEST HITS" right={`${rows.filter(r => r.done).length}/${rows.length} RECORDS`}
              infoOn={sel === 'info-hits'} info={() => choose('info-hits', { icon: '📀', name: 'How Greatest Hits work',
                text: `Replay the same word to make it a record. The word's length is how many times you play it:\n${GREATEST_HITS.tiers.slice(0, 3).map(t => `${t.icon} A ${t.letters}-letter word played ${t.letters} times goes ${t.title}: +${t.points.toLocaleString()}.`).join('\n')}\n\nEach record pays once a run, on top of the word. The closest one shows above your tiles.` })}>
              <div data-testid="gear-hits">
                {live.length === 0 && (
                  <Row selected={sel === 'hits-none'} icon={first.icon} label={<>Play the same {first.letters}-letter word {first.letters} times for {first.title}</>} right={`+${first.points.toLocaleString()}`}
                    onClick={() => choose('hits-none', { icon: first.icon, name: 'Greatest Hits', text: `Replay a word to make it a record. A ${first.letters}-letter word played ${first.letters} times goes ${first.title} (+${first.points.toLocaleString()}). ${GREATEST_HITS.tiers.slice(1, 3).map(t => `A ${t.letters}-letter word ${t.letters} times goes ${t.title} (+${t.points.toLocaleString()})`).join('. ')}. Each record pays once a run.` })} />
                )}
                {live.map(r => {
                  const left = r.tier.letters - r.plays;
                  const key = `hit-${r.tier.letters}`;
                  return (
                    <Row key={key} selected={sel === key} icon={r.tier.icon} dim={r.done}
                      label={r.done ? <>{r.tier.title} ✓ <strong>{r.word ?? ''}</strong></> : <><strong>{r.word}</strong> {r.plays}/{r.tier.letters} · {left === 1 ? 'ONE MORE' : `${left} MORE`} FOR {r.tier.title}</>}
                      right={r.done ? 'PAID' : `+${r.tier.points.toLocaleString()}`}
                      onClick={() => choose(key, { icon: r.tier.icon, name: `${r.tier.title} record`, text: r.done
                        ? `${r.word ?? 'A word'} went ${r.tier.title} this run (+${r.tier.points.toLocaleString()}). Each record pays once a run.`
                        : `You've played ${r.word} ${r.plays} ${r.plays === 1 ? 'time' : 'times'}. Play it ${left} more ${left === 1 ? 'time' : 'times'} and it goes ${r.tier.title}: +${r.tier.points.toLocaleString()}, paid on top of the word. Any ${r.tier.letters}-letter word played ${r.tier.letters} times counts, but only the first one to get there pays.` })} />
                  );
                })}
              </div>
            </Box>
          );
        })()}

        {trophies && trophies.length > 0 && (
          <Box title="TROPHIES" right={`${trophies.filter(t => t.unlocked).length}/${trophies.length}`}>
            <div className="flex flex-wrap gap-2 pt-0.5" data-testid="gear-trophies">
              {trophies.map(t => (
                <button key={t.id} type="button" disabled={!t.unlocked} onClick={() => onTrophy?.(t.id)} title={t.name} aria-label={`${t.name}${t.unlocked ? '' : ' (not earned yet)'}`}
                  className="text-2xl leading-none disabled:opacity-30 enabled:hover:scale-110 transition-transform">{t.icon}</button>
              ))}
            </div>
          </Box>
        )}
      </div>

      {/* The description box, RPG style: always in the same place. */}
      <div className="rounded-lg border-2 border-white/80 bg-[#0b1a4a] px-3 py-2 min-h-[6.5rem] max-h-[40%] overflow-y-auto" aria-live="polite" data-testid="gear-description">
        {pick ? (
          <>
            <p className="font-display text-base text-white leading-tight">{pick.icon} {pick.name}</p>
            {pick.tag && <p className="osd-text text-base leading-none text-neon-cyan mt-0.5">{pick.tag.toUpperCase()}</p>}
            <p className="text-sm text-slate-100 leading-snug mt-1 whitespace-pre-line">{pick.text}</p>
            {pick.flavor && <p className="text-xs italic text-slate-400 mt-1">"{pick.flavor}"</p>}
          </>
        ) : (
          <p className="text-sm text-slate-300 leading-snug">▶ Tap a charm, PowerPlay, set, genre or tile to read what it does. Tap ⓘ HOW IT WORKS on a box to learn how that part of the game works.</p>
        )}
      </div>
    </div>
  );
};

export default GearMenu;
