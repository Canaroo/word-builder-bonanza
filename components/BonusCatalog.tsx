import React, { useEffect, useMemo, useState } from 'react';
import { SECRET_BONUSES } from '../data/secretBonuses';
import { WORD_BONUSES } from '../data/wordBonuses';
import { EASTER_EGGS } from '../data/easterEggs';
import { CHARMS_LIST } from '../data/charms';
import { POWER_PLAYS_LIST } from '../data/powerPlays';
import { getBonusMedia } from '../data/bonusMedia';
import { checkBonuses } from '../services/bonusCheck';
import { exampleScore, ScorePattern } from '../services/scoreBonus';
import { dictionaryService } from '../services/dictionaryService';
import { isBlocked } from '../services/curatedWords';
import { labelize } from '../services/durationTags';
import { powerWordInfo } from '../services/rules';
import { hintFor } from '../services/collection';
import type { Charm, EasterEgg, PowerPlay, SecretBonus } from '../types';
import BonusReveal from './BonusReveal';

/**
 * Bonus Vault: every bonus in the game, with a validity check and a preview of each reveal.
 * Not linked from the menus; open it at /?bonuses. Edit the bonuses in data/secretBonuses.ts
 * (guide: docs/BONUSES.md).
 */

const EDIT_URL = 'https://github.com/Canaroo/word-builder-bonanza/blob/main/data/secretBonuses.ts';
const GUIDE_URL = 'https://github.com/Canaroo/word-builder-bonanza/blob/main/docs/BONUSES.md';

type Tab = 'words' | 'scores' | 'counts' | 'charms' | 'powerPlays';
type WordStatus = 'checking' | 'ok' | 'blocked' | 'unknown';

const MEDIA_LABEL = { vhs: '📼 VHS', cartridge: '🎮 CARTRIDGE', cd: '💿 CD', arcade: '🕹️ ARCADE' } as const;

const describeScore = ({ kind, digits }: ScorePattern) =>
  kind === 'equals' ? `SCORE = ${digits}` : kind === 'endsWith' ? `SCORE ENDS IN ${digits}` : kind === 'over' ? `SCORE OVER ${digits}` : `SCORE HAS ${digits}`;

const rewardText = (b: SecretBonus) =>
  [b.effect ? `⚡ ${powerWordInfo(b.effect).label}` : '', b.points ? `+${b.points} PTS` : '', b.shuffle ? `+${b.shuffle} SHUFFLE` : ''].filter(Boolean).join(' · ');

const Badge: React.FC<{ tone: 'ok' | 'warn' | 'bad' | 'idle'; children: React.ReactNode }> = ({ tone, children }) => {
  const color = { ok: 'text-neon-green', warn: 'text-neon-yellow', bad: 'text-neon-red', idle: 'text-slate-400' }[tone];
  return <span className={`osd-text text-base leading-none ${color}`}>{children}</span>;
};

const Card: React.FC<{ onClick?: () => void; children: React.ReactNode }> = ({ onClick, children }) => {
  const className = 'w-full text-left bg-crt-950/70 ring-1 ring-white/10 rounded-xl p-3 space-y-1';
  return onClick ? (
    <button type="button" onClick={onClick} className={`${className} hover:ring-neon-cyan/60 focus-visible:ring-2 focus-visible:ring-neon-cyan outline-none`}>
      {children}
    </button>
  ) : (
    <div className={className}>{children}</div>
  );
};

const BonusCatalog: React.FC = () => {
  const params = new URLSearchParams(location.search);
  const TAB_IDS: Tab[] = ['words', 'scores', 'counts', 'charms', 'powerPlays'];
  const [tab, setTabState] = useState<Tab>(() => (TAB_IDS as string[]).includes(params.get('tab') ?? '') ? params.get('tab') as Tab : 'words');
  // Each tab has its own URL (?bonuses&tab=charms), so it can be bookmarked.
  const setTab = (t: Tab) => {
    setTabState(t);
    history.replaceState(null, '', `${location.pathname}?bonuses&tab=${t}`);
  };
  const [search, setSearch] = useState('');
  const [preview, setPreview] = useState<EasterEgg | null>(() => EASTER_EGGS.find(e => e.id === params.get('egg')) ?? null);
  const [wordStatus, setWordStatus] = useState<Record<string, WordStatus>>({});

  // Problems the build would reject (duplicates, missing fields...). Words are checked live below.
  const problems = useMemo(() => checkBonuses(SECRET_BONUSES, WORD_BONUSES), []);
  const problemsById = useMemo(() => {
    const map = new Map<string, string[]>();
    problems.forEach(p => map.set(p.id, [...(map.get(p.id) ?? []), p.problem]));
    return map;
  }, [problems]);

  // Check each bonus word against the same dictionary the game uses.
  useEffect(() => {
    let cancelled = false;
    SECRET_BONUSES.forEach(b => {
      if (!b.word) return;
      const word = b.word.toLowerCase();
      if (isBlocked(word)) {
        setWordStatus(s => ({ ...s, [b.id]: 'blocked' }));
        return;
      }
      dictionaryService.isInWordList(word).then(ok => {
        if (!cancelled) setWordStatus(s => ({ ...s, [b.id]: ok === false ? 'unknown' : 'ok' }));
      });
    });
    return () => { cancelled = true; };
  }, []);

  const wordBonuses = SECRET_BONUSES.filter(b => b.word);
  const scoreBonuses = SECRET_BONUSES.filter(b => b.score);
  const badWords = Object.values(wordStatus).filter(s => s === 'blocked' || s === 'unknown').length;
  const checking = wordBonuses.length - Object.keys(wordStatus).length;
  const issueCount = problems.length + badWords;

  const q = search.trim().toLowerCase();
  const matches = (...fields: (string | undefined)[]) => !q || fields.some(f => f?.toLowerCase().includes(q));

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'words', label: 'WORDS', count: wordBonuses.length },
    { id: 'scores', label: 'SCORES', count: scoreBonuses.length },
    { id: 'counts', label: 'WORD COUNT', count: WORD_BONUSES.length },
    { id: 'charms', label: 'CHARMS', count: CHARMS_LIST.length },
    { id: 'powerPlays', label: 'POWERPLAYS', count: POWER_PLAYS_LIST.length },
  ];

  const openPreview = (b: SecretBonus) => setPreview(EASTER_EGGS.find(e => e.id === b.id) ?? null);

  const renderSecret = (b: SecretBonus) => {
    const { media, source } = getBonusMedia(b.id);
    const status = b.word ? wordStatus[b.id] ?? 'checking' : 'ok';
    const own = problemsById.get(b.id) ?? [];
    return (
      <Card key={b.id} onClick={() => openPreview(b)}>
        <div className="flex items-start justify-between gap-2">
          <span className="font-display text-base text-white leading-tight">{b.name}</span>
          {own.length || status === 'blocked' || status === 'unknown' ? (
            <Badge tone="bad">⚠️ FIX</Badge>
          ) : status === 'checking' ? (
            <Badge tone="idle">…</Badge>
          ) : (
            <Badge tone="ok">✅ OK</Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 osd-text text-lg leading-none">
          <span className="text-neon-cyan">{b.word ? `"${b.word.toUpperCase()}"` : describeScore(b.score!)}</span>
          <span className="text-neon-yellow">{rewardText(b)}</span>
          <span className="text-neon-pink">{MEDIA_LABEL[media]}{source ? ` · ${source}` : ''}</span>
        </div>
        {status === 'blocked' && <p className="text-xs text-neon-red">This word is in words/blocked.txt, so it can never be played.</p>}
        {status === 'unknown' && <p className="text-xs text-neon-red">Not in the dictionary. Add it to words/custom.txt.</p>}
        {own.map(p => <p key={p} className="text-xs text-neon-red">{p}</p>)}
        {b.effect && (
          <p className="text-sm text-neon-purple leading-snug">⚡ POWER WORD: {powerWordInfo(b.effect).does} 🔁 Repeats once per level.</p>
        )}
        <p className="text-sm text-slate-300 leading-snug">{b.hint ?? b.message}</p>
        <p className="text-xs text-neon-cyan/80 leading-snug">CLUE: {hintFor(b)}</p>
      </Card>
    );
  };

  const renderList = () => {
    switch (tab) {
      case 'words':
        return wordBonuses.filter(b => matches(b.word, b.name, b.message, b.source)).map(renderSecret);
      case 'scores':
        return scoreBonuses.filter(b => matches(b.name, b.message, b.score?.digits)).map(renderSecret);
      case 'counts':
        return WORD_BONUSES.filter(w => matches(w.title, w.description)).map(w => (
          <Card key={w.id}>
            <div className="flex items-start justify-between gap-2">
              <span className="font-display text-base text-white leading-tight">{w.title}</span>
              <Badge tone={problemsById.has(w.id) ? 'bad' : 'ok'}>{problemsById.has(w.id) ? '⚠️ FIX' : '✅ OK'}</Badge>
            </div>
            <div className="flex gap-3 osd-text text-lg leading-none">
              <span className="text-neon-cyan">{w.wordCount} WORDS</span>
              <span className="text-neon-yellow">+{w.reward.points} PTS</span>
            </div>
            {(problemsById.get(w.id) ?? []).map(p => <p key={p} className="text-xs text-neon-red">{p}</p>)}
            <p className="text-sm text-slate-300 leading-snug whitespace-pre-line">{w.description}</p>
          </Card>
        ));
      case 'charms':
      case 'powerPlays': {
        // A table: easier to scan 100 items than cards. The id is what /?stats and the code use.
        const list = (tab === 'charms' ? CHARMS_LIST : POWER_PLAYS_LIST) as (Charm | PowerPlay)[];
        const rows = list.filter(c => matches(c.name, c.description, c.flavorText, c.id));
        return (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-crt-950">
              <tr className="text-left text-slate-400">
                <th className="py-2 pr-3 font-normal">#</th>
                <th className="py-2 pr-3 font-normal">Name</th>
                <th className="py-2 pr-3 font-normal">Type</th>
                <th className="py-2 pr-3 font-normal">What it does</th>
                <th className="py-2 pr-3 font-normal">Flavor</th>
              </tr>
            </thead>
            <tbody>{rows.map(c => (
              <tr key={c.id} className="border-t border-white/10 align-top hover:bg-white/5">
                <td className="py-2 pr-3 text-slate-500 tabular-nums">{list.indexOf(c) + 1}</td>
                <td className="py-2 pr-3 min-w-[14rem]">
                  <div className="font-display text-base text-white leading-tight">{c.icon} {c.name}</div>
                  <div className="font-mono text-xs text-slate-500">{c.id}</div>
                </td>
                <td className="py-2 pr-3 osd-text text-base leading-tight text-neon-purple whitespace-nowrap">
                  {c.subtheme.toUpperCase()}{labelize(c.durationTag)}{(c as PowerPlay).oncePerRun ? <><br /><span className="text-neon-yellow">ONCE PER RUN</span></> : null}
                </td>
                <td className="py-2 pr-3 text-slate-200 leading-snug max-w-xl">{c.description}</td>
                <td className="py-2 pr-3 text-slate-400 italic leading-snug max-w-sm">{c.flavorText}</td>
              </tr>
            ))}</tbody>
          </table>
        );
      }
    }
  };

  return (
    <div className="relative flex flex-col gap-3">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl neon-text-cyan leading-none">BONUS VAULT</h1>
          <p className="osd-text text-lg text-neon-pink leading-tight">
            {SECRET_BONUSES.length} SECRETS · CLICK ONE TO PREVIEW
          </p>
        </div>
        <div className="flex items-center gap-4 osd-text text-lg leading-none">
          <a href={GUIDE_URL} target="_blank" rel="noreferrer" className="text-neon-cyan underline">HOW TO EDIT</a>
          <a href={EDIT_URL} target="_blank" rel="noreferrer" className="text-neon-cyan underline">EDIT ON GITHUB</a>
          <a href="./?stats" className="text-neon-pink underline">STATS</a>
          <a href="./" className="text-neon-yellow underline">▶ PLAY</a>
        </div>
      </header>
      <div>
        {checking > 0 ? (
          <Badge tone="idle">CHECKING {checking} WORDS…</Badge>
        ) : issueCount ? (
          <Badge tone="bad">⚠️ {issueCount} TO FIX: THE BUILD WILL REFUSE TO PUBLISH</Badge>
        ) : (
          <Badge tone="ok">✅ ALL BONUSES PASS</Badge>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
      <div className="flex gap-1 overflow-x-auto no-scrollbar" role="tablist">
        {tabs.map(t => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`shrink-0 osd-text text-lg leading-none px-2 py-1.5 rounded-md ring-1 ${
              tab === t.id ? 'bg-neon-cyan text-crt-900 ring-neon-cyan' : 'bg-crt-900/80 text-slate-300 ring-white/10'
            }`}
          >
            {t.label} {t.count}
          </button>
        ))}
      </div>

      <input
        type="search"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search words, names, messages, ids…"
        className="flex-1 min-w-[16rem] rounded-lg bg-crt-950/80 ring-1 ring-white/15 px-3 py-2 text-base text-white placeholder:text-slate-500 outline-none focus:ring-neon-cyan"
      />

      </div>

      {tab === 'charms' || tab === 'powerPlays'
        ? <div>{renderList()}</div>
        : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 items-start">{renderList()}</div>}

      {/* The preview covers the window, wherever the page is scrolled. */}
      {preview && (
        <div className="fixed inset-0 z-50">
          <BonusReveal
            egg={{ ...preview, triggerScore: preview.scorePattern ? exampleScore(preview.scorePattern) : undefined }}
            onClose={() => setPreview(null)}
          />
        </div>
      )}
    </div>
  );
};

export default BonusCatalog;
