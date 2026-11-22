import React, { useState } from 'react';
import type { Charm, GameState, PowerPlay } from '../types';
import { CHARM_SLOTS, TRIFORCE } from '../config/gameplay';
import { CHARMS_LIST } from '../data/charms';
import { CHARM_SETS, setPayFor } from '../data/charmSets';
import { TRIFORCE_IDS, TRIFORCE_PIECES, shardsOf, triforceDone, anyShards } from '../data/triforce';
import { clockSpeedFor, prizeScaleFor, wordTimeScaleFor } from '../services/rules';
import TriforceEmblem from './TriforceEmblem';
import ArcadeButton from './ArcadeButton';

// "Your Gear" (v7.71.0, the owner's idea): an old-school RPG menu with everything the run is
// carrying in one place: charms (and what each has earned this run), the pocket PowerPlay (usable
// from here), running effects, charm sets, the Triforce and a run summary. Tap anything and the box
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

/** What a charm (or set) has earned this run, summed from its score lines in the word log. */
export const earnedThisRun = (log: GameState['log'], name: string): { points: number; seconds: number } => {
  let points = 0, seconds = 0;
  for (const e of log) {
    if (e.type !== 'word' || e.status !== 'valid') continue;
    for (const b of (e as { bonuses?: { name: string; description: string }[] }).bonuses ?? []) {
      if (!lineIsFrom(b.name, name)) continue;
      const pts = b.description.match(/\+([\d,]+)\s*pts/);
      const secs = b.description.match(/\+(\d+)\s*s\b|\+(\d+)s/);
      if (pts) points += Number(pts[1].replace(/,/g, ''));
      else if (secs) seconds += Number(secs[1] ?? secs[2]);
    }
  }
  return { points, seconds };
};

type Pick = { icon: string; name: string; tag?: string; text: string; flavor?: string };

const Box: React.FC<{ title: string; right?: React.ReactNode; children: React.ReactNode }> = ({ title, right, children }) => (
  <section className="rounded-lg border-2 border-white/80 bg-[#0b1a4a] shadow-[inset_0_0_0_2px_#0b1a4a,inset_0_0_0_3px_rgba(255,255,255,0.25)] px-2.5 py-2">
    <div className="flex items-baseline justify-between mb-1">
      <h3 className="osd-text text-lg leading-none text-neon-yellow tracking-widest">{title}</h3>
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
    {right && <span className="osd-text text-base leading-none text-neon-green whitespace-nowrap">{right}</span>}
  </button>
);

const GearMenu: React.FC<{
  gameState: GameState;
  level: number;
  strikesLeft: number;
  maxStrikes: number;
  /** What each running PowerPlay or charm has left (the tray's own labels). */
  progressFor: (buff: Charm | PowerPlay) => string;
  onUse: (pp: PowerPlay) => void;
  onClose: () => void;
}> = ({ gameState: gs, level, strikesLeft, maxStrikes, progressFor, onUse, onClose }) => {
  const [sel, setSel] = useState<string | null>(null);
  const [pick, setPick] = useState<Pick | null>(null);
  const choose = (key: string, p: Pick) => { setSel(key); setPick(p); };
  const charms = gs.activeCharms ?? [];
  const charmIds = charms.map(c => c.id);
  const running = (gs.activeBuffs ?? []).filter(b => !charmIds.includes(b.id));
  const pocket = gs.availablePowerPlays ?? [];
  const sets = CHARM_SETS.map(set => ({ set, held: set.members.filter(m => charmIds.includes(m)).length })).filter(x => x.held > 0);
  const shields = [
    gs.activePowerPlays?.strikeShield && '🛡️ a shield blocks your next strike',
    gs.activePowerPlays?.plotArmor && '🎬 Plot Armor: your next strike costs 150 points instead',
    gs.activePowerPlays?.chubbsPepTalk && "💪 Chubbs' Pep Talk erases your next strike",
    gs.activePowerPlays?.rewind && '⏪ Turn Back Time erases your next strike',
    triforceDone(gs, 'courage') && gs.courageLevel !== level && '🔺 Triforce of Courage is ready this level',
  ].filter(Boolean) as string[];
  const fragile = charms.filter(c => c.breaks);

  return (
    <div className="absolute inset-0 z-50 bg-crt-950 flex flex-col p-2.5 gap-2 animate-fade-in" role="dialog" aria-modal="true" aria-label="Your gear">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl text-white tracking-wider">🎒 YOUR GEAR</h2>
        <button type="button" onClick={onClose} className="osd-text text-xl text-neon-cyan px-2" aria-label="Close and keep playing">✕ BACK</button>
      </div>
      <p className="osd-text text-sm leading-none text-slate-400 -mt-1">GAME PAUSED · TAP ANYTHING FOR DETAILS</p>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain flex flex-col gap-2 pr-0.5">
        <Box title="RUN STATUS" right={`LEVEL ${level}`}>
          <Row selected={sel === 'strikes'} icon="❌" label={<>Strikes left: <strong>{strikesLeft} of {maxStrikes}</strong>{shields.length ? ` · ${shields.length} protection${shields.length > 1 ? 's' : ''} up` : ''}</>}
            onClick={() => choose('strikes', { icon: '❌', name: 'Strikes', text: `An invalid word is a strike. ${maxStrikes} strikes and the run ends.${shields.length ? `\n\nProtecting you now:\n${shields.join('\n')}` : ' Nothing is protecting you right now.'}${fragile.length ? `\n\n💔 Your fragile charms (${fragile.map(c => c.name).join(', ')}) break on any invalid word or strike, even a blocked one.` : ''}` })} />
          <Row selected={sel === 'clock'} icon="⏱️" label={<>Clock speed <strong>x{clockSpeedFor(level).toFixed(2)}</strong> · word time <strong>{Math.round(wordTimeScaleFor(level) * 100)}%</strong></>}
            onClick={() => choose('clock', { icon: '⏱️', name: 'The clock', text: `At level ${level} the clock runs x${clockSpeedFor(level).toFixed(2)} speed, and each word earns ${Math.round(wordTimeScaleFor(level) * 100)}% of its normal time. Both get tougher as the levels climb.` })} />
          <Row selected={sel === 'prizes'} icon="🏆" label={<>PowerPlay prizes <strong>x{prizeScaleFor(level).toFixed(1)}</strong></>}
            onClick={() => choose('prizes', { icon: '🏆', name: 'Prize boost', text: `PowerPlay point prizes grow with the level. At level ${level} they pay x${prizeScaleFor(level).toFixed(1)}.` })} />
        </Box>

        <Box title="CHARMS" right={`${charms.length}/${CHARM_SLOTS}`}>
          {charms.length === 0 && <p className="text-sm text-slate-400 py-1">No charms yet. Play words to earn a charm offer.</p>}
          {charms.map(c => {
            const e = earnedThisRun(gs.log, c.name);
            const earned = e.points ? `+${e.points.toLocaleString()}` : e.seconds ? `+${e.seconds}s` : '';
            const up = (gs.charmUpgrades ?? []).includes(c.id);
            const set = CHARM_SETS.find(s => s.members.includes(c.id));
            const tags = [up && '⭐ upgraded', c.breaks && '💔 fragile', set && `🧩 ${set.name}`].filter(Boolean).join(' · ');
            const prog = progressFor(c);
            return (
              <Row key={c.id} selected={sel === c.id} icon={c.icon}
                label={<>{c.name}{up ? ' ⭐' : ''}{c.breaks ? ' 💔' : ''}{prog ? <span className="osd-text text-base text-neon-yellow"> {prog}</span> : null}</>}
                right={earned}
                onClick={() => choose(c.id, { icon: c.icon, name: c.name, tag: tags || undefined,
                  text: `${c.description}${earned ? `\n\nThis run: ${earned}${e.points ? ' points' : ''}.` : '\n\nNothing earned from it yet this run.'}`, flavor: c.flavorText })} />
            );
          })}
        </Box>

        <Box title="POCKET">
          {pocket.length === 0 ? <p className="text-sm text-slate-400 py-1">Empty. Fill the PowerPlay meter to pick one.</p> : pocket.map(p => (
            <div key={p.id} className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <Row selected={sel === `pp-${p.id}`} icon={p.icon} label={p.name}
                  onClick={() => choose(`pp-${p.id}`, { icon: p.icon, name: p.name, text: p.description, flavor: p.flavorText })} />
              </div>
              <ArcadeButton color="green" size="sm" onClick={() => onUse(p)}>▶ USE</ArcadeButton>
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
          <Box title="CHARM SETS">
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

        <Box title="TRIFORCE SHARDS">
          {!anyShards(gs) ? (
            <Row selected={sel === 'tri'} icon="🔺" label="No shards yet" dim
              onClick={() => choose('tri', { icon: '🔺', name: 'Triforce shards', text: `Some charm offers, scratch-off tickets and Lucky Charms hold a shard. Collect ${TRIFORCE.shards} to assemble a piece. Shards never use a charm slot. All three pieces in one run: +${TRIFORCE.wishPoints.toLocaleString()}.` })} />
          ) : (
            <div className="flex items-center gap-2">
              <TriforceEmblem triforce={gs.triforce} size={64} />
              <div className="flex-1 min-w-0">
                {TRIFORCE_IDS.map(id => {
                  const done = triforceDone(gs, id);
                  return (
                    <Row key={id} selected={sel === `tri-${id}`} icon="🔺" label={TRIFORCE_PIECES[id].name.replace('Triforce of ', '')} right={done ? '✓' : `${shardsOf(gs, id)}/${TRIFORCE.shards}`} dim={!done && shardsOf(gs, id) === 0}
                      onClick={() => choose(`tri-${id}`, { icon: '🔺', name: TRIFORCE_PIECES[id].name, tag: !done ? `${shardsOf(gs, id)} of ${TRIFORCE.shards} shards` : id === 'wisdom' ? (gs.wisdomLevel === level ? 'Used this level' : 'Ready: tap ASK ZELDA') : 'Active', text: TRIFORCE_PIECES[id].does, flavor: TRIFORCE_PIECES[id].flavor })} />
                  );
                })}
              </div>
            </div>
          )}
        </Box>
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
          <p className="text-sm text-slate-300 leading-snug">▶ Tap a charm, PowerPlay, set or shard to read what it does and what it has earned you this run.</p>
        )}
      </div>
    </div>
  );
};

export default GearMenu;
