import React, { useState } from 'react';
import type { Charm, PowerPlay } from '../types';
import { INSTANT_POWER_PLAY_IDS } from '../data/powerPlays';
import { CHARM_SLOTS } from '../config/gameplay';
import DurationBadge from '../ui/DurationBadge';
import ArcadeButton from './ArcadeButton';

// The two "pick one" screens: PowerPlays (hold one, keep or swap) and Charms (5 slots).

const Overlay: React.FC<{ tone: 'green' | 'purple'; children: React.ReactNode }> = ({ tone, children }) => (
  <div className="absolute inset-0 bg-crt-950/85 backdrop-blur-sm flex items-center justify-center z-50 p-3 animate-fade-in">
    <div
      className={`bg-crt-900 border-2 rounded-2xl p-4 w-full max-w-md flex flex-col max-h-[92vh] bonus-insert ${
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
}> = ({ item, tag, onClick, selected, dim, note }) => {
  const body = (
    <>
      <div className="flex items-start gap-2">
        <span className="text-2xl leading-none mt-0.5" aria-hidden="true">{item.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-display text-sm text-white leading-tight">{item.name}</span>
            <DurationBadge tag={item.durationTag} />
            {'oncePerRun' in item && item.oncePerRun && (
              <span className="osd-text text-sm leading-none px-1.5 py-0.5 rounded-md ring-1 ring-neon-orange text-neon-orange whitespace-nowrap">1× PER RUN</span>
            )}
          </div>
          <p className="text-sm text-slate-200 leading-snug mt-0.5">{item.description}</p>
          <p className="text-xs text-slate-500 italic mt-0.5">“{item.flavorText}”</p>
          {note && <p className="osd-text text-base leading-tight mt-1">{note}</p>}
        </div>
        {tag && <span className="shrink-0 self-center">{tag}</span>}
      </div>
    </>
  );
  const className = `w-full text-left rounded-xl p-2.5 ring-1 transition ${
    selected ? 'bg-neon-yellow/10 ring-2 ring-neon-yellow' : 'bg-crt-950/70 ring-white/10'
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
  onChoose: (powerPlay: PowerPlay) => void;
  onKeep: () => void;
}> = ({ title, reason, offered, held, onChoose, onKeep }) => (
  <Overlay tone="green">
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
        const instant = INSTANT_POWER_PLAY_IDS.has(pp.id);
        const tag = instant ? <Tag tone="cyan">INSTANT</Tag> : held ? <Tag tone="green">SWAP</Tag> : <Tag tone="green">TAKE</Tag>;
        const note = !held ? null : instant
          ? <span className="text-neon-cyan">⚡ FIRES NOW · REPLACES {held.icon} {held.name.toUpperCase()}</span>
          : <span className="text-neon-green">🔄 REPLACES {held.icon} {held.name.toUpperCase()}</span>;
        return <ItemCard key={pp.id} item={pp} tag={tag} note={note} onClick={() => onChoose(pp)} />;
      })}
    </div>

    {held && (
      <ArcadeButton color="yellow" className="w-full mt-3" onClick={onKeep}>
        ✋ Keep {held.icon} {held.name}
      </ArcadeButton>
    )}
  </Overlay>
);

// --- Charms -----------------------------------------------------------------------

const SlotRow: React.FC<{ charms: Charm[]; highlightId?: string }> = ({ charms, highlightId }) => (
  <div className="flex justify-center gap-1.5" aria-label={`Charm slots: ${charms.length} of ${CHARM_SLOTS} used`}>
    {Array.from({ length: CHARM_SLOTS }, (_, i) => {
      const charm = charms[i];
      const isOut = charm && charm.id === highlightId;
      return (
        <div
          key={i}
          title={charm?.name ?? 'Empty slot'}
          className={`w-10 h-10 rounded-lg grid place-items-center text-xl ring-1 ${
            isOut ? 'ring-2 ring-neon-red bg-neon-red/20 line-through' : charm ? 'bg-crt-800 ring-neon-purple/60' : 'bg-crt-950 ring-white/10 border border-dashed border-white/15'
          }`}
        >
          {charm ? charm.icon : ''}
        </div>
      );
    })}
  </div>
);

export const CharmOffer: React.FC<{
  title: string;
  reason?: React.ReactNode;
  offered: Charm[];
  equipped: Charm[];
  onChoose: (charm: Charm, replaceId?: string) => void;
  onPass: () => void;
}> = ({ title, reason, offered, equipped, onChoose, onPass }) => {
  const [picked, setPicked] = useState<Charm | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);
  const full = equipped.length >= CHARM_SLOTS;

  // Step 2 (slots full): choose which charm to drop for the new one.
  if (full && picked) {
    const dropping = equipped.find(c => c.id === dropId);
    return (
      <Overlay tone="purple">
        <h2 className="font-display text-xl text-neon-purple text-center leading-tight">MAKE ROOM FOR {picked.icon} {picked.name.toUpperCase()}</h2>
        <p className="text-sm text-slate-300 text-center mt-1">Your {CHARM_SLOTS} slots are full. Tap the charm to drop.</p>
        <div className="mt-2"><SlotRow charms={equipped} highlightId={dropId ?? undefined} /></div>
        <div className="mt-3 space-y-2 overflow-y-auto overscroll-contain p-1 -m-1">
          {equipped.map(c => (
            <ItemCard
              key={c.id}
              item={c}
              selected={c.id === dropId}
              tag={c.id === dropId ? <Tag tone="red">DROP</Tag> : undefined}
              onClick={() => setDropId(c.id)}
            />
          ))}
        </div>
        <ArcadeButton color="purple" className="w-full mt-3" disabled={!dropping} onClick={() => dropping && onChoose(picked, dropping.id)}>
          {dropping ? `Swap ${dropping.icon} for ${picked.icon}` : 'Pick one to drop'}
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
      <div className="mt-2"><SlotRow charms={equipped} /></div>
      <p className={`osd-text text-lg text-center leading-tight mt-1 ${full ? 'text-neon-yellow' : 'text-slate-400'}`}>
        {full ? `SLOTS FULL (${CHARM_SLOTS}/${CHARM_SLOTS}): PICK ONE TO SWAP IN, OR PASS` : `SLOTS ${equipped.length}/${CHARM_SLOTS}`}
      </p>
      <div className="mt-2 space-y-2 overflow-y-auto overscroll-contain p-1 -m-1">
        {offered.map(charm => (
          <ItemCard
            key={charm.id}
            item={charm}
            tag={<Tag tone={full ? 'yellow' : 'green'}>{full ? 'SWAP IN' : 'EQUIP'}</Tag>}
            onClick={() => (full ? setPicked(charm) : onChoose(charm))}
          />
        ))}
      </div>
      {full && (
        <ArcadeButton color="slate" className="w-full mt-3" onClick={onPass}>
          Pass: keep my {CHARM_SLOTS}
        </ArcadeButton>
      )}
    </Overlay>
  );
};
