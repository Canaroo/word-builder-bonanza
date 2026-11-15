import React, { useEffect, useRef, useState } from 'react';
import ArcadeButton from './ArcadeButton';
import { soundService } from '../services/soundService';
import { dictionaryService } from '../services/dictionaryService';
import { CHARMS_LIST } from '../data/charms';
import { TILE_DISTRIBUTION } from '../constants';
import { BONES } from '../config/gameplay';
import { solveHand, type Bone, type SolvedHand } from '../services/bones';
import { assignTilesToWord } from '../services/rackMatch';

// Bones (v7.44): another player's run ended on this level. Their final hand is on the table: spell
// a word of BONES.minLetters or more from it before the clock runs out, and one of the charms they
// were carrying is yours. Miss and nothing is lost. The run's own clock waits.
// The hand is checked first (v7.44.2): if their tiles can't spell a word that long, some are
// swapped for fresh ones until they can, so the search is always winnable. A miss shows a word
// that would have worked, with its tiles lit.
const ago = (ms: number, now = Date.now()): string => {
  const mins = Math.floor((now - ms) / 60000);
  if (mins < 60) return mins < 2 ? 'moments ago' : `${mins} minutes ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours === 1 ? 'an hour ago' : `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
};

const BonesCard: React.FC<{ bone: Bone; heldCharmIds: string[]; onDone: (word: string | null) => void }> = ({ bone, heldCharmIds, onDone }) => {
  const [phase, setPhase] = useState<'intro' | 'play' | 'lost'>('intro');
  const [picked, setPicked] = useState<number[]>([]);
  const [flash, setFlash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState(BONES.seconds * 1000);
  const done = useRef(false);
  // The playable hand and a word it can spell. Until this is ready the search can't start.
  const [solved, setSolved] = useState<SolvedHand | null>(null);
  const [unsolvable, setUnsolvable] = useState(false);
  useEffect(() => {
    let alive = true;
    soundService.playModalOpen();
    solveHand(bone.hand, letters => dictionaryService.findPlayableWord(letters, { minLength: BONES.minLetters }))
      .then(s => { if (alive) setSolved(s); })
      .catch(() => { if (alive) setUnsolvable(true); });
    return () => { alive = false; };
  }, [bone.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const tiles = solved?.hand ?? bone.hand;
  const answerTiles = solved ? assignTilesToWord(solved.answer, solved.hand) ?? [] : [];
  useEffect(() => {
    if (phase !== 'play') return;
    let last = performance.now();
    const timer = setInterval(() => {
      const now = performance.now();
      setLeft(l => {
        const next = Math.max(0, l - (now - last)); last = now;
        if (next <= 0 && !done.current) { done.current = true; soundService.playInvalidWord(); setPhase('lost'); }
        return next;
      });
    }, 100);
    return () => clearInterval(timer);
  }, [phase]);

  const charms = bone.charms.map(id => CHARMS_LIST.find(c => c.id === id)).filter((c): c is NonNullable<typeof c> => !!c && !heldCharmIds.includes(c.id));
  const word = picked.map(i => tiles[i]).join('');
  const submit = async () => {
    if (busy || done.current || word.length < BONES.minLetters) return;
    setBusy(true);
    const ok = await dictionaryService.isValidWord(word.toLowerCase());
    setBusy(false);
    if (done.current) return;
    if (!ok) { setFlash(`${word}? Not a word.`); setPicked([]); return; }
    done.current = true;
    soundService.playMilestone();
    onDone(word);
  };
  const secs = Math.ceil(left / 1000);

  return (
    <div className="absolute inset-0 bg-crt-950/90 backdrop-blur-sm flex items-center justify-center z-50 p-3 animate-fade-in" role="dialog" aria-modal="true" aria-label={`Bones: ${bone.name} fell here`}>
      <div className="bg-crt-900 border-4 border-slate-300 shadow-[0_0_28px_rgba(203,213,225,0.4)] rounded-2xl px-4 py-5 max-w-md w-full flex flex-col items-center text-center gap-3 level-stage-in">
        <p className="osd-text text-lg tracking-[0.3em] text-slate-300">LEVEL {bone.level} · BONES</p>
        <div className="text-5xl leading-none" aria-hidden="true">👻</div>
        <h2 className="font-display text-2xl text-white leading-tight">{bone.name.toUpperCase()} FELL HERE</h2>
        <p className="text-slate-400 text-sm">{ago(bone.timestamp)}, with {bone.score.toLocaleString()} points</p>
        {phase === 'intro' && (
          <>
            <p className="text-slate-200 leading-snug">
              Their last hand is still on the table. Spell a word of <strong className="text-white">{BONES.minLetters} letters or more</strong> from it in{' '}
              <strong className="text-neon-yellow">{BONES.seconds} seconds</strong> and take one of the charms they were carrying:
            </p>
            <p className="text-2xl leading-none" aria-label={`Charms: ${charms.map(c => c.name).join(', ')}`}>{charms.map(c => c.icon).join(' ')}</p>
            <p className="text-sm text-slate-400">Miss and nothing is lost. Your clock is stopped.</p>
            {solved && solved.swapped > 0 && (
              <p className="text-sm text-slate-300 leading-snug">🎲 Their tiles couldn't spell one, so the ghost swapped {solved.swapped === 1 ? 'a tile' : `${solved.swapped} tiles`}. There is a word in there now.</p>
            )}
            {unsolvable
              ? <ArcadeButton color="slate" className="w-full" onClick={() => onDone(null)}>The ghost fades. Continue</ArcadeButton>
              : <ArcadeButton color="cyan" size="lg" className="w-full" disabled={!solved} onClick={() => { soundService.playPowerUp(); setPhase('play'); }}>{solved ? '▶ Search the bones' : 'Sorting the tiles…'}</ArcadeButton>}
            <ArcadeButton variant="text" color="slate" onClick={() => onDone(null)}>Leave them in peace</ArcadeButton>
          </>
        )}
        {phase === 'play' && (
          <>
            <p className={`font-display text-3xl leading-none ${secs <= 8 ? 'text-neon-red animate-pulse' : 'text-neon-yellow'}`} role="timer" aria-label={`${secs} seconds left`}>{secs}</p>
            <div className="w-full min-h-[3rem] rounded-lg bg-crt-950 ring-1 ring-white/15 flex items-center justify-center gap-1 px-2 font-tile font-extrabold text-2xl tracking-widest text-white">
              {word || <span className="text-slate-600 text-base font-sans font-normal">{BONES.minLetters}+ letters from their tiles</span>}
            </div>
            <p className="osd-text text-lg text-neon-yellow min-h-[1.5rem]" aria-live="polite">{busy ? 'Checking…' : flash ?? ''}</p>
            <div className="grid grid-cols-4 gap-1.5 w-full">
              {tiles.map((l, i) => (
                <button key={i} type="button" onPointerDown={e => { e.preventDefault(); setFlash(null); setPicked(p => (p.includes(i) ? p.filter(x => x !== i) : [...p, i])); }}
                  aria-label={`Bones tile ${l}`}
                  className={`relative h-14 rounded-lg grid place-items-center font-tile font-extrabold tile-3d select-none touch-none ${l.length > 1 ? 'text-xl' : 'text-2xl'} ${picked.includes(i) ? 'bg-neon-yellow text-crt-900 -translate-y-1' : 'bg-slate-300 text-crt-900'}`}>
                  {l}<span className="absolute bottom-0.5 right-1 font-osd text-xs">{TILE_DISTRIBUTION[l]?.points ?? ''}</span>
                </button>
              ))}
            </div>
            <div className="w-full grid grid-cols-2 gap-2">
              <ArcadeButton color="slate" variant="outline" onClick={() => { setPicked([]); setFlash(null); }}>Clear</ArcadeButton>
              <ArcadeButton color="green" onClick={submit} disabled={word.length < BONES.minLetters || busy}>Submit</ArcadeButton>
            </div>
            <ArcadeButton variant="text" color="slate" onClick={() => { if (!done.current) { done.current = true; setPhase('lost'); } }}>Give up and see a word</ArcadeButton>
          </>
        )}
        {phase === 'lost' && (
          <>
            <p className="font-display text-2xl text-slate-400">THE GHOST KEEPS IT</p>
            {solved && (
              <>
                <p className="text-slate-200">One word that would have worked:</p>
                <p className="font-tile font-extrabold text-3xl tracking-widest text-neon-yellow" aria-label={`A word that would have worked: ${solved.answer}`}>{solved.answer}</p>
                {/* Their tiles again, with the ones that spell it lit and numbered in order. */}
                <div className="grid grid-cols-4 gap-1.5 w-full" aria-hidden="true">
                  {tiles.map((l, i) => {
                    const order = answerTiles.indexOf(i);
                    return (
                      <div key={i} className={`relative h-12 rounded-lg grid place-items-center font-tile font-extrabold text-xl ${order >= 0 ? 'bg-neon-yellow text-crt-900' : 'bg-slate-600 text-slate-400 opacity-50'}`}>
                        {l}
                        {order >= 0 && <span className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-crt-900 text-neon-yellow font-osd text-sm leading-5 text-center">{order + 1}</span>}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            <p className="text-slate-300 text-sm">{bone.name}'s charms stay where they fell. Nothing lost.</p>
            <ArcadeButton color="slate" className="w-full" onClick={() => onDone(null)}>Continue</ArcadeButton>
          </>
        )}
      </div>
    </div>
  );
};

export default BonesCard;
