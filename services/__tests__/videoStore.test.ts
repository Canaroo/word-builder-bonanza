import { describe, it, expect } from 'vitest';
import { gameReducer, screenInitialState, storeShelf, landCollectors, type GameScreenState } from '../screens/GameScreen';
import { GENRES, genreEarned, genresFor, genrePay, countGenrePlays, earlierKeys, letterKey, storeOpensAt, restockCost, canAfford, tradeInValue, dealShelf } from '../../data/videoStore';
import { VIDEO_STORE, GENRE_VALUES, COLLECTOR, CHARM_SLOTS } from '../../config/gameplay';
import { CHARMS_LIST } from '../../data/charms';
import { POWER_PLAYS_LIST, INSTANT_POWER_PLAY_IDS, TIME_CARD_IDS } from '../../data/powerPlays';
import { dealScratch } from '../scratch';
import type { Tile } from '../../types';

const tile = (letter: string, i: number): Tile => ({ id: `${letter}-${i}`, letter, points: 1 });
const store = (over: Partial<GameScreenState['gameState']> = {}, time = 40): GameScreenState => {
  const gs = { ...screenInitialState.gameState, runSeed: 1234, ...over };
  return { ...screenInitialState, time, isLoading: false, hand: [...'CATSDOGE'].map(tile), gameState: gs,
    modalContent: { type: 'video-store', title: 'The Video Store', data: { level: 2, deal: 0, shelf: storeShelf(gs, 2, 0), sold: [], lines: [] } }, isPaused: true };
};

describe('genres (v7.96.0)', () => {
  it('match their rules', () => {
    const ids = (w: string, earlier = new Set<string>()) => genresFor(w, earlier).map(g => g.id).sort();
    expect(ids('CAT')).toEqual(['shorts']);
    expect(ids('BALLOON')).toEqual(['epics', 'musicals', 'sequels']);
    expect(ids('JAZZ')).toEqual(['cult', 'sequels']); // v7.96.7: Shorts is exactly 3 letters
    expect(ids('ZAP')).toEqual(['cult', 'shorts']);
    expect(ids('ACT', new Set([letterKey('CAT')]))).toEqual(['remakes', 'shorts']);
  });
  it('pay only with stars, and stars come from plays', () => {
    const gs = { genreStars: { shorts: 2 }, genrePlays: {} };
    expect(genrePay(gs, 'CAT', new Set()).map(p => p.points)).toEqual([2 * GENRE_VALUES.perStar.shorts]);
    expect(genrePay({ genreStars: {} }, 'CAT', new Set())).toEqual([]);
    let s: { genreStars: Record<string, number>; genrePlays: Record<string, number> } = { genreStars: {}, genrePlays: {} };
    for (let i = 0; i < GENRE_VALUES.playsPerStar.epics; i++) s = countGenrePlays(s, 'PLANETS', new Set());
    expect(s.genreStars.epics).toBe(1);
    expect(s.genrePlays.epics).toBe(0);
  });
  it('stop at the max', () => {
    let s: { genreStars: Record<string, number>; genrePlays: Record<string, number> } = { genreStars: { shorts: GENRE_VALUES.maxStars }, genrePlays: {} };
    for (let i = 0; i < 50; i++) s = countGenrePlays(s, 'CAT', new Set());
    expect(s.genreStars.shorts).toBe(GENRE_VALUES.maxStars);
  });
  it('Remakes read the log', () => {
    const log = [{ type: 'word', word: 'tab', status: 'valid' }, { type: 'word', word: 'xyz', status: 'invalid' }] as never;
    expect(earlierKeys(log).has(letterKey('BAT'))).toBe(true);
    expect(earlierKeys(log).has(letterKey('XYZ'))).toBe(false);
  });
  it('Gear adds up what a genre has paid this run (v7.96.2)', () => {
    const log = [
      { type: 'word', word: 'gravity', status: 'valid', bonuses: [{ name: '🎞️ Epics ★2', description: '+50 pts (6 or more letters)' }, { name: '🦇 Cult Classics ★1', description: '+25 pts (x)' }] },
      { type: 'word', word: 'planets', status: 'valid', bonuses: [{ name: '🎞️ Epics ★2', description: '+50 pts (6 or more letters)' }] },
      { type: 'word', word: 'zzzzzz', status: 'invalid', bonuses: [{ name: '🎞️ Epics ★2', description: '+50 pts' }] },
    ] as never;
    expect(genreEarned(log, GENRES.find(g => g.id === 'epics')!)).toEqual({ points: 100, words: 2 });
    expect(genreEarned(log, GENRES.find(g => g.id === 'cult')!)).toEqual({ points: 25, words: 1 });
    expect(genreEarned(log, GENRES.find(g => g.id === 'shorts')!)).toEqual({ points: 0, words: 0 });
  });
  it('every genre has a value and a play count', () => {
    for (const g of GENRES) { expect(GENRE_VALUES.perStar[g.id]).toBeGreaterThan(0); expect(GENRE_VALUES.playsPerStar[g.id]).toBeGreaterThan(0); }
  });
});

describe('the Video Store (v7.96.0)', () => {
  it('opens on every other level from 2', () => {
    expect([1, 2, 3, 4, 5, 6].filter(storeOpensAt)).toEqual([2, 4, 6]);
    expect(restockCost(0)).toBe(VIDEO_STORE.restockBase);
    expect(restockCost(2)).toBe(VIDEO_STORE.restockBase + 2 * VIDEO_STORE.restockStep);
    expect(canAfford(VIDEO_STORE.keepAtLeast + 8, 8)).toBe(true);
    expect(canAfford(VIDEO_STORE.keepAtLeast + 7, 8)).toBe(false);
    expect(tradeInValue({}, false)).toBe(VIDEO_STORE.prices.charm * VIDEO_STORE.tradeBack);
    expect(tradeInValue({}, true)).toBe(VIDEO_STORE.prices.charm);
  });
  it('deals a charm, a PowerPlay or tile, and a poster; the same seed deals the same shelf', () => {
    const gs = { ...screenInitialState.gameState, runSeed: 99 };
    const a = storeShelf(gs, 4, 0), b = storeShelf(gs, 4, 0), c = storeShelf(gs, 4, 1);
    expect(a).toEqual(b);
    expect(a.map(t => t.kind)[0]).toBe('charm');
    expect(['powerPlay', 'tile']).toContain(a[1].kind);
    expect(a[2].kind).toBe('poster');
    expect(JSON.stringify(a) === JSON.stringify(c) && JSON.stringify(storeShelf(gs, 4, 2)) === JSON.stringify(a)).toBe(false);
  });
  it('never stocks instant, time or held items', () => {
    for (let seed = 0; seed < 300; seed++) {
      const gs = { ...screenInitialState.gameState, runSeed: seed, availablePowerPlays: [POWER_PLAYS_LIST[0]] };
      for (const t of storeShelf(gs, 2, 0)) {
        if (t.kind === 'powerPlay') { expect(INSTANT_POWER_PLAY_IDS.has(t.id)).toBe(false); expect(TIME_CARD_IDS.has(t.id)).toBe(false); expect(t.id).not.toBe(POWER_PLAYS_LIST[0].id); }
        if (t.kind === 'charm') expect(t.id).not.toBe('phoenixDown');
      }
    }
  });
  it('a tile shows up about tileChance of the time', () => {
    let tiles = 0;
    for (let seed = 0; seed < 2000; seed++) if (dealShelf({ rank: tag => ((seed * 7919 + tag.length * 104729 + [...tag].reduce((h, ch) => h * 31 + ch.charCodeAt(0), 0)) % 10007) / 10007, charms: CHARMS_LIST, powerPlays: POWER_PLAYS_LIST, genreStars: {}, collectorOwned: 0 })[1].kind === 'tile') tiles++;
    expect(tiles / 2000).toBeGreaterThan(VIDEO_STORE.tileChance - 0.1);
    expect(tiles / 2000).toBeLessThan(VIDEO_STORE.tileChance + 0.1);
  });
  it('renting takes the price off the clock and fills the receipt', () => {
    const s = store();
    const shelf = s.modalContent!.data.shelf;
    const after = gameReducer(s, { type: 'STORE_RENT', payload: { index: 2 } });
    expect(after.time).toBe(40 - shelf[2].price);
    expect(after.gameState.genreStars?.[shelf[2].id]).toBe(1);
    expect(after.modalContent?.data.sold).toEqual([2]);
    expect(after.modalContent?.data.lines).toHaveLength(1);
    // the same tape can't be rented twice
    expect(gameReducer(after, { type: 'STORE_RENT', payload: { index: 2 } })).toBe(after);
  });
  it('renting a charm equips it; full slots or a low clock refuse', () => {
    const s = store();
    const after = gameReducer(s, { type: 'STORE_RENT', payload: { index: 0 } });
    expect(after.gameState.activeCharms.map(c => c.id)).toContain(s.modalContent!.data.shelf[0].id);
    const fullCharms = CHARMS_LIST.filter(c => !c.breaks && c.effectType !== 'selection').slice(0, CHARM_SLOTS);
    const full = store({ activeCharms: fullCharms });
    expect(gameReducer(full, { type: 'STORE_RENT', payload: { index: 0 } })).toBe(full);
    const poor = store({}, VIDEO_STORE.keepAtLeast + 1);
    expect(gameReducer(poor, { type: 'STORE_RENT', payload: { index: 2 } })).toBe(poor);
  });
  it('restock deals a new shelf and costs more each time', () => {
    let s = store();
    s = gameReducer(s, { type: 'STORE_RESTOCK' });
    expect(s.time).toBe(40 - restockCost(0));
    s = gameReducer(s, { type: 'STORE_RESTOCK' });
    expect(s.time).toBe(40 - restockCost(0) - restockCost(1));
    expect(s.modalContent?.data.deal).toBe(2);
  });
  it('trade-in gives seconds back and frees the slot; fragile charms stay', () => {
    const charm = CHARMS_LIST.find(c => !c.breaks && c.id === 'stonks')!;
    const s = gameReducer(store({ activeCharms: [charm], charmUpgrades: [] }), { type: 'STORE_TRADE_IN', payload: { charmId: charm.id } });
    expect(s.gameState.activeCharms).toHaveLength(0);
    expect(s.time).toBe(40 + tradeInValue(charm, false));
    const glass = CHARMS_LIST.find(c => c.breaks)!;
    const g = store({ activeCharms: [glass] });
    expect(gameReducer(g, { type: 'STORE_TRADE_IN', payload: { charmId: glass.id } })).toBe(g);
  });
  it('walking out with nothing pays points; after a rental it pays nothing', () => {
    const s = store();
    const walked = gameReducer(s, { type: 'STORE_LEAVE' });
    expect(walked.gameState.score).toBe(s.gameState.score + VIDEO_STORE.walkOut);
    const rented = gameReducer(gameReducer(s, { type: 'STORE_RENT', payload: { index: 2 } }), { type: 'STORE_LEAVE' });
    expect(rented.gameState.score).toBe(s.gameState.score);
  });
});

describe("Collector's Tiles (v7.96.0)", () => {
  const hand = () => [...'CATSDOGE'].map(tile) as (Tile | null)[];
  const row = Array(8).fill(null);
  it('a fresh tile always lands; chrome becomes a x2 word tile, static a blank', () => {
    const r = landCollectors(hand(), row, { collectorTiles: [{ id: 'a', kind: 'chrome', fresh: true }, { id: 'b', kind: 'static', fresh: true }], goldenTileId: null, holdTile: null }, () => 0.3);
    const chrome = r.hand.find(t => t?.collector === 'chrome')!;
    expect(chrome.multiplier).toBe(COLLECTOR.chromeMultiplier);
    const blank = r.hand.find(t => t?.collector === 'static')!;
    expect(blank.letter).toBe('?');
    expect(r.owned.every(c => !c.fresh)).toBe(true);
  });
  it('one already in play does not land twice; one played comes back returnChance of the time', () => {
    const h = hand(); h[0] = { ...h[0]!, collector: 'holo', collectorId: 'a' };
    const owned = [{ id: 'a', kind: 'holo' as const }];
    expect(landCollectors(h, row, { collectorTiles: owned, goldenTileId: null, holdTile: null }, () => 0).hand.filter(t => t?.collector).length).toBe(1);
    expect(landCollectors(hand(), row, { collectorTiles: owned, goldenTileId: null, holdTile: null }, () => 0.99).hand.some(t => t?.collector)).toBe(false);
    expect(landCollectors(hand(), row, { collectorTiles: owned, goldenTileId: null, holdTile: null }, () => 0.1).hand.some(t => t?.collector === 'holo')).toBe(true);
  });
  it('the Static blank takes the picked letter', () => {
    const s = { ...screenInitialState, hand: [{ id: 'q', letter: '?', points: 0, collector: 'static' as const, collectorId: 'b' }, ...[...'CATSDOG'].map(tile)] };
    const after = gameReducer(s, { type: 'SET_STATIC_LETTER', payload: { tileId: 'q', letter: 'z' } });
    expect(after.hand[0]?.letter).toBe('Z');
    expect(gameReducer(s, { type: 'SET_STATIC_LETTER', payload: { tileId: 'q', letter: '7' } })).toBe(s);
  });
  it('scratch-offs deal at most one tile, only with room', () => {
    for (let i = 0; i < 300; i++) {
      const sq = dealScratch(Math.random, { heldCharmIds: [], slotOpen: true, pocketEmpty: true, tileOk: true });
      expect(sq.filter(x => x.kind === 'tile').length).toBeLessThanOrEqual(1);
      expect(dealScratch(Math.random, { heldCharmIds: [], slotOpen: true, pocketEmpty: true, tileOk: false }).some(x => x.kind === 'tile')).toBe(false);
    }
  });
});
