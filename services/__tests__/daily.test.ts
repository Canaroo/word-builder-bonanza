// @vitest-environment jsdom
// The Daily Run (v7.30): one seeded deal a day, one scored try per player.
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { seededStream, dailySeed, dailyNumber, todaysRun, markScoredRunStarted, recordScoredRun, scoredRunUsed, dailyCredits, dailyShareText, hashString } from '../daily';
import * as gameUtils from '../gameUtils';
import { DAILY_RUN } from '../../config/progression';
import { POWER_PLAYS_LIST } from '../../data/powerPlays';
import { pickBoss } from '../../data/bosses';
import { screenInitialState, withDailyStream } from '../screens/GameScreen';

beforeEach(() => localStorage.clear());
afterEach(() => gameUtils.setTileStream(null));

const deal = (seed: number) => {
    gameUtils.setTileStream(seededStream(seed));
    const { hand, tileBag } = gameUtils.dealNewHand(gameUtils.createTileBag());
    return { hand: hand.map(t => `${t.letter}${t.multiplier ?? 1}`).join(' '), next: tileBag.slice(-12).join('') };
};

describe('seeds', () => {
    test('a stream is repeatable, and resuming from its saved state continues the sequence', () => {
        const a = seededStream(42); const b = seededStream(42);
        const first = [a.next(), a.next(), a.next()];
        expect([b.next(), b.next(), b.next()]).toEqual(first);
        const saved = a.state();
        const rest = [a.next(), a.next()];
        const resumed = seededStream(saved);
        expect([resumed.next(), resumed.next()]).toEqual(rest);
    });
    test('each day has its own seed and number', () => {
        expect(dailySeed('2026-11-09')).toBe(dailySeed('2026-11-09'));
        expect(dailySeed('2026-11-09')).not.toBe(dailySeed('2026-11-10'));
        expect(dailyNumber(DAILY_RUN.launchDay)).toBe(1);
        expect(dailyNumber('2026-11-12')).toBe(6);
        expect(hashString('a')).not.toBe(hashString('b'));
    });
});

describe('the same deal for everyone', () => {
    test('the same day deals the same hand, bag order and multiplier tiles', () => {
        const seed = dailySeed('2026-11-09');
        expect(deal(seed)).toEqual(deal(seed));
        expect(deal(seed)).not.toEqual(deal(dailySeed('2026-11-10')));
    });

    test('offer #N is the same for everyone, whatever their pick history', () => {
        const base = { ...screenInitialState.gameState, runSeed: 1234, daily: { key: '2026-11-09', number: 1, seed: 1234, practice: false }, totalOffersMade: 3 };
        const me = gameUtils.getOffer(POWER_PLAYS_LIST, 3, base).offeredItems.map(p => p.id);
        const you = gameUtils.getOffer(POWER_PLAYS_LIST, 3, { ...base, itemStats: { [me[0]]: { offered: 9, lastOfferedTurn: 5 } }, sessionOfferCounts: { [me[1]]: 4 } }).offeredItems.map(p => p.id);
        expect(you).toEqual(me);
        const next = gameUtils.getOffer(POWER_PLAYS_LIST, 3, { ...base, totalOffersMade: 4 }).offeredItems.map(p => p.id);
        expect(next).not.toEqual(me);
        // Something you already have active drops out; the rest keep their order.
        const held = gameUtils.getOffer(POWER_PLAYS_LIST, 3, { ...base, activeBuffs: [POWER_PLAYS_LIST.find(p => p.id === me[0])!] }).offeredItems.map(p => p.id);
        expect(held.slice(0, 2)).toEqual(me.slice(1));
    });

    test('a seeded boss pick is the same for everyone', () => {
        const seed = dailySeed('2026-11-09');
        expect(pickBoss(1, [], seededStream(seed + 7919).next).id).toBe(pickBoss(1, [], seededStream(seed + 7919).next).id);
    });

    test("a daily save carries the tile stream's position", () => {
        const stream = seededStream(99); stream.next(); stream.next();
        gameUtils.setTileStream(stream);
        const st = { gameState: { ...screenInitialState.gameState, daily: { key: 'k', number: 1, seed: 99, practice: false } as { key: string; number: number; seed: number; practice: boolean; rng?: number } } };
        expect(withDailyStream(st).gameState.daily?.rng).toBe(stream.state());
        expect(withDailyStream({ gameState: screenInitialState.gameState })).toEqual({ gameState: screenInitialState.gameState });
    });
});

describe('one scored try a day', () => {
    test('starting the scored run makes later runs practice', () => {
        const run = todaysRun(new Date('2026-11-09T12:00:00'));
        expect(run.practice).toBe(false);
        markScoredRunStarted(run.key);
        expect(scoredRunUsed(run.key)).toBe(true);
        expect(todaysRun(new Date('2026-11-09T15:00:00')).practice).toBe(true);
        // The next game day (after the 8 AM reset) is a fresh scored run.
        expect(todaysRun(new Date('2026-11-10T09:00:00')).practice).toBe(false);
    });
    test('a finished run is recorded with its rank', () => {
        markScoredRunStarted('2026-11-09');
        expect(recordScoredRun('2026-11-09', { score: 18420, level: 9, bosses: 2, rank: 7 })).toEqual({ key: '2026-11-09', score: 18420, level: 9, bosses: 2, rank: 7 });
    });
});

describe('rewards and sharing', () => {
    test('credits for finishing, more for a top-10 finish', () => {
        expect(dailyCredits(0)).toBe(DAILY_RUN.finishCredits);
        expect(dailyCredits(11)).toBe(DAILY_RUN.finishCredits);
        expect(dailyCredits(10)).toBe(DAILY_RUN.finishCredits + DAILY_RUN.topCredits);
        expect(dailyCredits(1)).toBe(DAILY_RUN.finishCredits + DAILY_RUN.topCredits);
    });
    test('the share card', () => {
        expect(dailyShareText({ key: '2026-11-09', number: 1 }, { score: 18420, level: 9, bosses: 2, rank: 7 }))
            .toBe(`Word Nerd Daily #1 · Nov 9\n18,420 pts · LV 9 · 🏅2 · #7 today\n${DAILY_RUN.shareUrl}`);
        expect(dailyShareText({ key: '2026-11-09', number: 1 }, { score: 900, level: 2 })).toBe(`Word Nerd Daily #1 · Nov 9\n900 pts · LV 2\n${DAILY_RUN.shareUrl}`);
    });
});
