// @vitest-environment jsdom
// Every run must start from scratch: nothing from an earlier run (charm offer timing, offer history,
// armed PowerPlays) may leak into the next one.
import { describe, test, expect } from 'vitest';
import { createInitialGameState } from '../GameScreen';

describe('a new run starts fresh', () => {
    test('each run gets its own nested state', () => {
        const run1 = createInitialGameState();
        // What an earlier run used to do to the shared starting object:
        run1.wordMilestoneProgress.count = 9;
        run1.wordMilestoneProgress.nextUnlock = 18;
        run1.offerHistory.push([] as any);
        run1.itemStats.x = { offered: 3, lastOfferedTurn: 5 } as any;
        (run1.activePowerPlays as any).duckHunt = { ready: true };

        const run2 = createInitialGameState();
        expect(run2.wordMilestoneProgress).toEqual({ count: 0, nextUnlock: 10 });
        expect(run2.offerHistory).toEqual([]);
        expect(run2.itemStats).toEqual({});
        expect(run2.activePowerPlays).toEqual({});
    });

    test('the first charm offer comes after 10 words', () => {
        expect(createInitialGameState().wordMilestoneProgress.nextUnlock).toBe(10);
    });
});
