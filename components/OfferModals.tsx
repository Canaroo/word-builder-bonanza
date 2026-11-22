import React, { useEffect, useState } from 'react';
import type { Charm, PowerPlay } from '../types';
import { INSTANT_POWER_PLAY_IDS, PRIZE_POWER_PLAY_IDS } from '../data/powerPlays';
import { CHARM_SLOTS, CHARM_UPGRADE, MYSTERY_TAPE , TRIFORCE } from '../config/gameplay';
import { prizeFor } from '../services/rules';
import { UPGRADABLE_CHARM_IDS } from '../data/charms';
import DurationBadge from '../ui/DurationBadge';
import { charmUpgradePreview, charmUpgradePercentPreview } from '../services/rules';
import { storage, STORAGE_KEYS } from '../services/storage';
import { playerKey } from '../services/players';
import { soundService } from '../services/soundService';
import ArcadeButton, { NamedLabel } from './ArcadeButton';
import CharmTimeNote from './CharmTimeNote';
import { CHARMS_LIST } from '../data/charms';
import { setsWith, setProgress, setBonusFor, setPayFor, payingSets } from '../data/charmSets';
import { WILDCARD_GIF } from './GambleCard';
import TriforceEmblem from './TriforceEmblem';
import type { TriforceId } from '../data/triforce';

/** v7.68.0: items whose offer card shows a picture instead of the emoji (the owner's clips). */
const ITEM_ART: Record<string, string> = { wildcard: WILDCARD_GIF };

// The two "pick one" screens: PowerPlays (hold one, keep or swap) and Charms (5 slots).

const Overlay: React.FC<{ tone: 'green' | 'purple'; children: React.ReactNode }> = ({ tone, children }) => (
  <div className="absolute inset-0 bg-crt-950/85 backdrop-blur-sm flex items-center justify-center z-50 p-3 animate-fade-in">
    <div
      className={`relative bg-crt-900 border-2 rounded-2xl p-4 w-full max-w-md flex flex-col modal-max-h bonus-insert ${
        tone === 'green' ? 'border-neon-green shadow-[0_0_18px_rgba(61,255,140,0.35)]' : 'border-neon-purple shadow-[0_0_18px_rgba(180,92,255,0.4)]'
      }`}
      role="dialog"
      aria-modal="true"
    >
      {children}
    </div>
  </div>
);

const ItemCard: React.FC<{
  item: Charm | PowerPlay;
  tag?: React.ReactNode;
  onClick?: () => void;
  selected?: boolean;
  dim?: boolean;
  /** Extra line under the description (e.g. what happens to the PowerPlay you're holding). */
  note?: React.ReactNode;
  /** Leave out the flavor text, so a full list of charms fits on screen. */
  compact?: boolean;
  /** A gold ring for an upgraded charm. */
  upgraded?: boolean;
}> = ({ item, tag, onClick, selected, dim, note, compact, upgraded }) => {
  const body = (
    <>
      <div className="flex items-start gap-2">
        {ITEM_ART[item.id]
          ? <img src={ITEM_ART[item.id]} alt="" aria-hidden="true" className="w-12 h-12 rounded-md object-cover ring-1 ring-white/20 shrink-0" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
          : <span className="text-2xl leading-none mt-0.5" aria-hidden="true">{item.icon}</span>}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-display text-sm text-white leading-tight">{item.name}</span>
            <DurationBadge tag={item.durationTag} />
            {'oncePerRun' in item && item.oncePerRun && (
              <span className="osd-text text-sm leading-none px-1.5 py-0.5 rounded-md ring-1 ring-neon-orange text-neon-orange whitespace-nowrap">1× PER RUN</span>
            )}
          </div>
          <p className="text-sm text-slate-200 leading-snug mt-0.5">{item.description}</p>
          {!compact && <p className="text-xs text-slate-500 italic mt-0.5">“{item.flavorText}”</p>}
          {note && <p className="osd-text text-base leading-tight mt-1">{note}</p>}
        </div>
        {tag && <span className="shrink-0 self-center">{tag}</span>}
      </div>
    </>
  );
  const className = `w-full text-left rounded-xl ${compact ? 'p-2' : 'p-2.5'} ring-1 transition ${
    selected ? 'bg-neon-yellow/10 ring-2 ring-neon-yellow' : upgraded ? 'bg-neon-yellow/5 ring-2 ring-neon-yellow/60' : 'bg-crt-950/70 ring-white/10'
  } ${dim ? 'opacity-50' : ''}`;
  return onClick ? (
    <button type="button" onClick={onClick} className={`${className} hover:ring-white/40 focus-visible:ring-2 focus-visible:ring-white outline-none`}>
      {body}
    </button>
  ) : (
    <div className={className}>{body}</div>
  );
};

const Tag: React.FC<{ tone: 'green' | 'cyan' | 'yellow' | 'red'; children: React.ReactNode }> = ({ tone, children }) => {
  const colors = { green: 'bg-neon-green text-crt-900', cyan: 'bg-neon-cyan text-crt-900', yellow: 'bg-neon-yellow text-crt-900', red: 'bg-neon-red text-white' }[tone];
  return <span className={`osd-text text-base leading-none px-2 py-1 rounded-md whitespace-nowrap ${colors}`}>{children}</span>;
};

// --- PowerPlays -------------------------------------------------------------------

export const PowerPlayOffer: React.FC<{
  title: string;
  reason?: React.ReactNode;
  offered: PowerPlay[];
  held: PowerPlay | null;
  /** The run level and what point prizes are multiplied by there (PRIZE_GROWTH); shown on prize cards. */
  level?: number;
  prizeScale?: number;
  /** What Multiplicity would copy right now (the last PowerPlay used that it can copy). */
  copyTarget?: PowerPlay | null;
  /** Mystery Tape: the offered PowerPlay shown face down (null: none). */
  mysteryId?: string | null;
  onChoose: (powerPlay: PowerPlay) => void;
  onKeep: () => void;
}> = ({ title, reason, offered, held, level, prizeScale = 1, copyTarget = null, mysteryId = null, onChoose, onKeep }) => {
  // v7.53.2: holding a PowerPlay, a tap on another card asks first, so a stray tap (or a tempting
  // Mystery Tape) never swaps out what you're holding without a clear "Keep mine" right there.
  const [confirming, setConfirming] = React.useState<PowerPlay | null>(null);
  const choose = (pp: PowerPlay) => { if (held && held.id !== pp.id) { soundService.playUIClick(); setConfirming(pp); } else onChoose(pp); };
  return (
  <Overlay tone="green">
    {confirming && held && (
      <div className="absolute inset-0 z-10 rounded-2xl bg-crt-900 flex flex-col items-center justify-center gap-3 p-5 text-center animate-fade-in" role="alertdialog" aria-modal="true" aria-label={`Swap out ${held.name}?`}>
        <p className="osd-text text-lg tracking-[0.2em] text-neon-yellow">SWAP IT OUT?</p>
        <div className="w-full rounded-xl ring-1 ring-neon-yellow/50 bg-neon-yellow/10 p-3">
          <p className="text-sm text-slate-300">You're holding</p>
          <p className="font-display text-lg text-white leading-tight">{held.icon} {held.name}</p>
        </div>
        <p className="text-2xl leading-none" aria-hidden="true">⬇️</p>
        <div className="w-full rounded-xl ring-1 ring-neon-green/60 bg-neon-green/10 p-3">
          <p className="text-sm text-slate-300">It will be replaced by</p>
          {confirming.id === mysteryId
            ? <p className="font-display text-lg text-neon-pink leading-tight">📼 A Mystery Tape <span className="block font-sans text-sm text-slate-200 normal-case">+{prizeFor(MYSTERY_TAPE.points, level ?? 1)} points now, a face-down PowerPlay, and +{prizeFor(MYSTERY_TAPE.usePoints, level ?? 1)} more when you use it</span></p>
            : <p className="font-display text-lg text-white leading-tight">{confirming.icon} {confirming.name}{INSTANT_POWER_PLAY_IDS.has(confirming.id) && <span className="block font-sans text-sm text-neon-cyan normal-case">⚡ Instant: it fires right away</span>}</p>}
        </div>
        <p className="text-sm text-slate-400">{held.name} will be gone for good.</p>
        <div className="w-full grid grid-cols-2 gap-2">
          <ArcadeButton color="yellow" variant="outline" onClick={() => { soundService.playUIClick(); setConfirming(null); }}>✋ Keep mine</ArcadeButton>
          <ArcadeButton color="green" onClick={() => { const pp = confirming; setConfirming(null); onChoose(pp); }}>🔄 Swap</ArcadeButton>
        </div>
      </div>
    )}
    <h2 className="font-display text-2xl text-neon-green text-center leading-none">{title}</h2>
    {reason && <p className="osd-text text-lg text-slate-300 text-center leading-tight mt-1">{reason}</p>}

    {held ? (
      <div className="mt-3">
        <p className="osd-text text-lg leading-none text-neon-yellow mb-1">🎒 IN YOUR POCKET · YOU CAN HOLD ONE</p>
        <ItemCard item={held} tag={<Tag tone="yellow">HOLDING</Tag>} />
        <p className="text-sm text-slate-300 text-center mt-2">
          Tap a card to swap it in, or keep what you've got. <span className="text-neon-cyan">INSTANT</span> cards fire right away.
        </p>
      </div>
    ) : (
      <p className="text-sm text-slate-300 text-center mt-2">Pick one. It waits in your Buffs tray until you tap it.</p>
    )}

    <div className="mt-3 space-y-2 overflow-y-auto overscroll-contain p-1 -m-1">
      {offered.map(pp => {
        if (pp.id === mysteryId) {
          // Face down: nothing about the real PowerPlay shows until it's taken.
          const points = prizeFor(MYSTERY_TAPE.points, level ?? 1);
          const usePoints = prizeFor(MYSTERY_TAPE.usePoints, level ?? 1);
          return (
            <button key="mystery-tape" type="button" onClick={() => choose(pp)} aria-label={`Mystery Tape: a face-down PowerPlay, plus ${points} points now and ${usePoints} more when you use it`}
              className="w-full text-left rounded-xl p-2.5 ring-2 ring-neon-pink bg-[repeating-linear-gradient(135deg,rgba(255,79,163,0.14)_0_10px,rgba(10,8,30,0.6)_10px_20px)] shadow-[0_0_14px_rgba(255,79,163,0.4)] hover:brightness-110 focus-visible:ring-white outline-none">
              <div className="flex items-start gap-2">
                <span className="text-2xl leading-none mt-0.5" aria-hidden="true">📼</span>
                <div className="flex-1 min-w-0">
                  <span className="font-display text-sm text-neon-pink leading-tight">MYSTERY TAPE</span>
                  <p className="text-sm text-slate-200 leading-snug mt-0.5">
                    A face-down PowerPlay. Take it blind for <span className="text-neon-yellow font-semibold">+{points} now</span>, then <span className="text-neon-yellow font-semibold">+{usePoints} more when you use it</span>.
                  </p>
                  <p className="text-xs text-slate-400 italic mt-0.5">“No label. No case. No refunds.”</p>
                  {held && <p className="osd-text text-base leading-tight mt-1 text-neon-green">🔄 REPLACES {held.icon} {held.name.toUpperCase()}</p>}
                </div>
                <span className="shrink-0 self-center"><Tag tone="yellow">+{points}</Tag></span>
              </div>
            </button>
          );
        }
        const instant = INSTANT_POWER_PLAY_IDS.has(pp.id);
        const tag = instant ? <Tag tone="cyan">INSTANT</Tag> : held ? <Tag tone="green">SWAP</Tag> : <Tag tone="green">TAKE</Tag>;
        const swapNote = !held ? null : instant
          ? <span className="text-neon-cyan">⚡ FIRES NOW · REPLACES {held.icon} {held.name.toUpperCase()}</span>
          : <span className="text-neon-green">🔄 REPLACES {held.icon} {held.name.toUpperCase()}</span>;
        const prizeNote = prizeScale > 1 && PRIZE_POWER_PLAY_IDS.has(pp.id)
          ? <span className="text-neon-yellow">⬆ LEVEL {level}: PRIZES x{prizeScale}</span>
          : null;
        const copyNote = pp.id !== 'multiplicity' ? null : copyTarget
          ? <span className="block rounded-lg ring-1 ring-neon-pink/50 bg-neon-pink/10 px-2 py-1.5 mt-0.5">
              <span className="text-neon-pink">👯 WOULD COPY: {copyTarget.icon} {copyTarget.name.toUpperCase()}</span>
              <span className="block font-sans text-sm text-slate-200 leading-snug normal-case tracking-normal mt-0.5">{copyTarget.description}</span>
            </span>
          : <span className="text-slate-400">👯 NOTHING TO COPY YET: USE A POWERPLAY FIRST</span>;
        const lines = [copyNote, prizeNote, swapNote].filter(Boolean);
        const note = lines.length ? <>{lines.map((l, i) => <React.Fragment key={i}>{i > 0 && <br />}{l}</React.Fragment>)}</> : null;
        return <ItemCard key={pp.id} item={pp} tag={tag} note={note} onClick={() => choose(pp)} />;
      })}
    </div>

    {held && (
      <ArcadeButton color="yellow" variant="outline" className="w-full mt-3" onClick={onKeep}>
        <NamedLabel action="✋ Keep" icon={held.icon} name={held.name} />
      </ArcadeButton>
    )}
  </Overlay>
  );
};

// --- Charms -----------------------------------------------------------------------

const SlotRow: React.FC<{ charms: Charm[]; highlightId?: string; upgradedIds?: string[]; upgradableIds?: string[] }> = ({ charms, highlightId, upgradedIds = [], upgradableIds = [] }) => (
  <div className="flex justify-center gap-1.5" aria-label={`Charm slots: ${charms.length} of ${CHARM_SLOTS} used`}>
    {Array.from({ length: CHARM_SLOTS }, (_, i) => {
      const charm = charms[i];
      const isOut = charm && charm.id === highlightId;
      return (
        <div
          key={i}
          title={charm ? `${charm.name}${upgradedIds.includes(charm.id) ? ' (upgraded)' : ''}` : 'Empty slot'}
          className={`relative w-10 h-10 rounded-lg grid place-items-center text-xl ring-1 ${
            isOut ? 'ring-2 ring-neon-red bg-neon-red/20 line-through' : charm ? 'bg-crt-800 ring-neon-purple/60' : 'bg-crt-950 ring-white/10 border border-dashed border-white/15'
          }`}
        >
          {charm ? charm.icon : ''}
          {charm && upgradedIds.includes(charm.id) && <span className="absolute -top-1.5 -right-1.5 text-xs leading-none" aria-hidden="true">⭐</span>}
          {charm && upgradableIds.includes(charm.id) && (
            <span className="absolute -bottom-1.5 -right-1.5 w-4 h-4 rounded-full bg-neon-yellow text-crt-900 text-[10px] font-bold leading-none grid place-items-center" aria-hidden="true">▲</span>
          )}
        </div>
      );
    })}
  </div>
);

/** The first few times the upgrade option shows (per player), it carries a NEW callout. */
const UPGRADE_TIP_SHOWS = 3;
const upgradeTipCount = (): number => storage.getJSON<number>(playerKey(STORAGE_KEYS.charmUpgradeTips), 0) || 0;
const setUpgradeTipCount = (n: number) => storage.setJSON(playerKey(STORAGE_KEYS.charmUpgradeTips), n);

/** "+40 → +60 PTS" for the upgrade picker, from the charm's own description. */
const UpgradePreview: React.FC<{ charm: Charm }> = ({ charm }) => {
  const nums = charmUpgradePreview(charm.description);
  // Percentage charms (Down to Your Boxers, Nicole's Grace...): their percentage grows by half.
  const pcts = nums ? null : charmUpgradePercentPreview(charm.description);
  return (
    <span className="text-neon-yellow">
      ⭐ {nums ? nums.map(n => `+${n.from} → +${n.to}`).join(' · ') + ' PTS'
        : pcts ? pcts.map(n => `+${n.from}% → +${n.to}%`).join(' · ') + ' A WORD'
        : `+${CHARM_UPGRADE.percent}% ON ITS POINTS`}
    </span>
  );
};

const charmLabel = (id: string) => { const c = CHARMS_LIST.find(x => x.id === id); return c ? `${c.icon} ${c.name}` : id; };

/**
 * Charm sets (v7.41): what taking (or dropping) this charm does to a set. `after` is the charm ids
 * the player would hold. Nothing shows for a charm that's in no set.
 */
export const SetNote: React.FC<{ charmId: string; after: readonly string[]; dropping?: boolean }> = ({ charmId, after, dropping }) => {
  const sets = setsWith(charmId);
  if (sets.length === 0) return null;
  // v7.61.2: plain sentences in the body font (the arcade caps line was hard to read), one idea each.
  const box = (key: string, tone: string, text: React.ReactNode) => (
    <span key={key} className={`block mt-1.5 rounded-lg px-2 py-1.5 text-sm leading-snug normal-case tracking-normal ring-1 ${tone}`}
      >{text}</span>
  );
  const names = (ids: string[], joiner: string) => ids.map(charmLabel).join(joiner);
  return (
    <span className="block" style={{ fontFamily: "'Poppins', sans-serif", letterSpacing: 'normal', textShadow: 'none' }}>
      {sets.map(set => {
        const p = setProgress(set, dropping ? [...after, charmId] : after);
        const n = set.members.length;
        const title = <strong className="text-white">🧩 {set.icon} {set.name}</strong>;
        if (dropping) {
          // What the set pays now against what it would pay without this charm.
          const now = setPayFor(set, p.held.length), then = setPayFor(set, p.held.length - 1);
          if (now <= then) return null;
          return box(set.id, 'ring-neon-red/50 bg-neon-red/10 text-red-200', then > 0
            ? <>Dropping this weakens {title}: every word drops from +{now} to +{then}.</>
            : <>Dropping this breaks up {title}: you lose +{now} on every word.</>);
        }
        const pays = setPayFor(set, p.held.length);
        if (p.complete) return box(set.id, 'ring-neon-green/60 bg-neon-green/10 text-green-100', <>This completes {title}! Every word earns <strong className="text-neon-green">+{pays}</strong>.</>);
        if (pays > 0) return box(set.id, 'ring-neon-green/60 bg-neon-green/10 text-green-100',
          <>{title} ({p.held.length} of {n}): every word earns <strong className="text-neon-green">+{pays}</strong> right away. Add {names(p.missing, ' or ')} later for <strong className="text-neon-green">+{setBonusFor(set)}</strong>.</>);
        const next = setPayFor(set, p.held.length + 1);
        return box(set.id, 'ring-neon-cyan/40 bg-crt-950/60 text-slate-200', n - p.held.length > 1
          ? <>Part of the {title} set (this makes {p.held.length} of {n}). Also hold {names(p.missing, ' or ')} and every word earns <strong className="text-neon-cyan">+{next}</strong>; all {n} earn <strong className="text-neon-cyan">+{setBonusFor(set)}</strong>.</>
          : <>Part of the {title} set (this makes {p.held.length} of {n}). Also hold {names(p.missing, ' and ')} and every word earns <strong className="text-neon-cyan">+{next}</strong>.</>);
      })}
    </span>
  );
};

export const CharmOffer: React.FC<{
  title: string;
  reason?: React.ReactNode;
  offered: Charm[];
  equipped: Charm[];
  /** Ids of equipped charms already upgraded this run. */
  upgradedIds?: string[];
  onChoose: (charm: Charm, replaceId?: string) => void;
  /** Slots full: upgrade an equipped charm instead of taking a new one. */
  onUpgrade?: (charmId: string) => void;
  onPass: () => void;
  /** The run level: time charms show what their seconds pay here (v7.40.2). */
  level?: number;
  /** Fragile charms (v7.69.0): Triforce shards collected so far. */
  triforce?: Partial<Record<TriforceId, number>>;
}> = ({ title, reason, offered, equipped, upgradedIds = [], onChoose, onUpgrade, onPass, level = 1, triforce = {} }) => {
  const [picked, setPicked] = useState<Charm | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);
  const [upgrading, setUpgrading] = useState(false);
  const [upId, setUpId] = useState<string | null>(null);
  const full = equipped.length >= CHARM_SLOTS;
  const equippedIds = equipped.map(c => c.id);
  const setsHeld = payingSets(equippedIds);
  const canUpgrade = (c: Charm) => UPGRADABLE_CHARM_IDS.has(c.id) && !upgradedIds.includes(c.id);
  const upgradeOpen = full && !!onUpgrade && equipped.some(canUpgrade);
  const upgradable = equipped.filter(canUpgrade);
  // NEW callout: read once when the offer opens, then count this showing.
  const [showTip] = useState(() => upgradeOpen && upgradeTipCount() < UPGRADE_TIP_SHOWS);
  useEffect(() => { if (upgradeOpen) setUpgradeTipCount(upgradeTipCount() + 1); }, [upgradeOpen]);
  const upgrade = (id: string) => { setUpgradeTipCount(UPGRADE_TIP_SHOWS); onUpgrade!(id); };

  // Upgrade step (slots full): choose which equipped charm gets the star.
  if (upgradeOpen && upgrading) {
    const target = equipped.find(c => c.id === upId);
    return (
      <Overlay tone="purple">
        <h2 className="font-display text-xl text-neon-yellow text-center leading-tight">⭐ UPGRADE A CHARM</h2>
        <p className="text-sm text-slate-300 text-center mt-1">
          Its point bonuses pay <span className="text-neon-yellow">{CHARM_UPGRADE.percent}% more</span> for the rest of the run. One upgrade per charm. Swapping it out later loses the upgrade.
        </p>
        <div className="mt-3 space-y-2 overflow-y-auto overscroll-contain p-1 -m-1">
          {equipped.map(c => {
            const done = upgradedIds.includes(c.id);
            const ok = canUpgrade(c);
            return (
              <ItemCard
                key={c.id}
                item={c}
                selected={c.id === upId}
                dim={!ok}
                tag={c.id === upId ? <Tag tone="yellow">⭐ UPGRADE</Tag> : done ? <Tag tone="cyan">⭐ DONE</Tag> : undefined}
                note={ok ? <UpgradePreview charm={c} /> : <span className="text-slate-400">{done ? '⭐ ALREADY UPGRADED' : "NOT A POINTS CHARM: CAN'T UPGRADE"}</span>}
                onClick={ok ? () => setUpId(c.id) : undefined}
              />
            );
          })}
        </div>
        <ArcadeButton color="yellow" className="w-full mt-3" disabled={!target} onClick={() => target && upgrade(target.id)}>
          {target ? <NamedLabel action="Upgrade" icon={target.icon} name={target.name} /> : 'Pick one to upgrade'}
        </ArcadeButton>
        <button type="button" onClick={() => { setUpgrading(false); setUpId(null); }} className="osd-text text-lg text-slate-400 hover:text-white mt-2">
          ◀ BACK TO THE OFFER
        </button>
      </Overlay>
    );
  }

  // Step 2 (slots full): choose which charm to drop for the new one.
  if (full && picked) {
    const dropping = equipped.find(c => c.id === dropId);
    return (
      <Overlay tone="purple">
        <h2 className="font-display text-xl text-neon-purple text-center leading-tight">MAKE ROOM FOR {picked.icon} {picked.name.toUpperCase()}</h2>
        <p className="text-sm text-slate-300 text-center mt-1">
          Your {CHARM_SLOTS} slots are full. Tap the charm to drop.
          {equipped.some(c => upgradedIds.includes(c.id)) && <> <span className="text-neon-yellow">⭐ Upgraded</span> ones lose their upgrade if dropped.</>}
        </p>
        <div className="mt-2"><SlotRow charms={equipped} highlightId={dropId ?? undefined} upgradedIds={upgradedIds} /></div>
        {/* All your charms, compact so every one fits; upgraded ones are marked (v7.36.5). */}
        <div className="mt-3 space-y-1.5 overflow-y-auto overscroll-contain p-1 -m-1">
          {equipped.map(c => {
            const up = upgradedIds.includes(c.id);
            return (
              <ItemCard
                key={c.id}
                item={c}
                compact
                upgraded={up}
                selected={c.id === dropId}
                tag={c.id === dropId ? <Tag tone="red">DROP</Tag> : up ? <Tag tone="yellow">⭐ UPGRADED</Tag> : undefined}
                note={<>
                  {up ? <span className="text-neon-yellow">⭐ PAYS +{CHARM_UPGRADE.percent}% · DROP IT AND THE UPGRADE IS GONE</span> : <CharmTimeNote charmId={c.id} level={level} />}
                  <SetNote charmId={c.id} after={equippedIds.filter(id => id !== c.id)} dropping />
                </>}
                onClick={() => setDropId(c.id)}
              />
            );
          })}
        </div>
        <ArcadeButton color={dropping && upgradedIds.includes(dropping.id) ? 'red' : 'purple'} className="w-full mt-3" disabled={!dropping} onClick={() => dropping && onChoose(picked, dropping.id)}>
          {!dropping ? 'Pick one to drop' : upgradedIds.includes(dropping.id) ? `Swap ⭐${dropping.icon} for ${picked.icon} anyway` : `Swap ${dropping.icon} for ${picked.icon}`}
        </ArcadeButton>
        <button type="button" onClick={() => { setPicked(null); setDropId(null); }} className="osd-text text-lg text-slate-400 hover:text-white mt-2">
          ◀ BACK TO THE OFFER
        </button>
      </Overlay>
    );
  }

  return (
    <Overlay tone="purple">
      <h2 className="font-display text-2xl text-neon-purple text-center leading-none">{title}</h2>
      {reason && <p className="osd-text text-lg text-slate-300 text-center leading-tight mt-1">{reason}</p>}
      <p className="text-sm text-slate-300 text-center mt-1">Charms stay on for the rest of the run.</p>
      <div className="mt-2"><SlotRow charms={equipped} upgradedIds={upgradedIds} upgradableIds={upgradeOpen ? upgradable.map(c => c.id) : []} /></div>
      {setsHeld.length > 0 && (
        <p className="osd-text text-lg text-center leading-tight mt-1 text-neon-green">
          🧩 {setsHeld.map(s => `${s.set.icon} ${s.set.name.toUpperCase()} +${s.points}`).join(' · ')} A WORD
        </p>
      )}
      <p className={`osd-text text-lg text-center leading-tight mt-1 ${full ? 'text-neon-yellow' : 'text-slate-400'}`}>
        {full
          ? `SLOTS FULL (${CHARM_SLOTS}/${CHARM_SLOTS}): ${upgradeOpen ? 'UPGRADE ONE, SWAP ONE IN, OR PASS' : 'PICK ONE TO SWAP IN, OR PASS'}`
          : `SLOTS ${equipped.length}/${CHARM_SLOTS}`}
      </p>
      <div className="mt-2 space-y-2 overflow-y-auto overscroll-contain p-1 -m-1">
        {upgradeOpen && (
          // Upgrade sits first, as a card like the offers (v7.36): as a button under the cards it read like "no thanks".
          <button type="button" onClick={() => setUpgrading(true)}
            className="w-full text-left rounded-xl p-2.5 ring-2 ring-neon-yellow bg-gradient-to-br from-neon-yellow/20 to-neon-orange/10 shadow-[0_0_14px_rgba(255,226,122,0.35)] hover:brightness-110 focus-visible:ring-white outline-none">
            <div className="flex items-start gap-2">
              <span className="text-2xl leading-none mt-0.5" aria-hidden="true">⭐</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-display text-sm text-neon-yellow leading-tight">UPGRADE ONE OF YOURS</span>
                  {showTip && <span className="osd-text text-sm leading-none px-1.5 py-0.5 rounded-md bg-neon-pink text-white animate-pulse">NEW!</span>}
                </div>
                {showTip && <p className="text-sm text-white leading-snug mt-0.5 font-semibold">Slots full? Power up a charm you already own instead of swapping.</p>}
                <p className="text-sm text-slate-200 leading-snug mt-0.5">
                  Its points pay <span className="text-neon-yellow font-semibold">+{CHARM_UPGRADE.percent}%</span> for the rest of the run. {upgradable.length} of yours {upgradable.length === 1 ? 'qualifies' : 'qualify'} (▲).
                </p>
              </div>
              <span className="shrink-0 self-center"><Tag tone="yellow">⭐ UPGRADE</Tag></span>
            </div>
          </button>
        )}
        {offered.map(charm => charm.fragile ? (
          // Fragile charms (v7.69.0): a shard goes on the Triforce shelf, so it never needs a slot.
          <ItemCard
            key={charm.id}
            item={charm}
            tag={<Tag tone="yellow">🔺 SHARD</Tag>}
            note={<span className="flex items-center gap-2">
              <TriforceEmblem triforce={triforce} next={charm.fragile} size={44} />
              <span className="text-neon-yellow">SHARD {Math.min(TRIFORCE.shards, (triforce[charm.fragile] ?? 0) + 1)} OF {TRIFORCE.shards} · NO SLOT NEEDED · DOES NOTHING UNTIL ALL {TRIFORCE.shards}</span>
            </span>}
            onClick={() => onChoose(charm)}
          />
        ) : (
          <ItemCard
            key={charm.id}
            item={charm}
            tag={<Tag tone={full ? 'cyan' : 'green'}>{full ? 'SWAP IN' : 'EQUIP'}</Tag>}
            note={<><CharmTimeNote charmId={charm.id} level={level} /><SetNote charmId={charm.id} after={[...equippedIds, charm.id]} /></>}
            onClick={() => (full ? setPicked(charm) : onChoose(charm))}
          />
        ))}
      </div>
      {full && (
        <ArcadeButton color="slate" variant="outline" className="w-full mt-3" onClick={onPass}>
          Pass: keep my {CHARM_SLOTS}
        </ArcadeButton>
      )}
    </Overlay>
  );
};
