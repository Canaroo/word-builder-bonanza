// @vitest-environment jsdom
import { describe, test, expect, beforeEach } from 'vitest';
import { logService } from '../logService';
import type { FinalGameState } from '../../types';

const run = (score: number, extra: Partial<FinalGameState> = {}) => ({ score, log: [], ...extra }) as unknown as FinalGameState;

beforeEach(() => localStorage.clear());

describe('saved run logs', () => {
    test(`keep at most ${logService.MAX_LOGS} unpinned runs, dropping the oldest`, () => {
        const old = Array.from({ length: 40 }, (_, i) => run(i, { saveTimestamp: new Date(2020, 0, i + 1).toISOString(), isPinned: false }));
        const pinned = run(999, { saveTimestamp: new Date(2019, 0, 1).toISOString(), isPinned: true });
        localStorage.setItem('wordBuilderBonanzaSavedLogs', JSON.stringify([...old, pinned]));

        logService.autoSaveLog(run(1234));
        const logs = logService.getSavedLogs();

        expect(logs.filter(l => !l.isPinned)).toHaveLength(logService.MAX_LOGS);
        expect(logs.some(l => l.score === 1234)).toBe(true);
        expect(logs.some(l => l.score === 999)).toBe(true); // pinned runs are never dropped
        expect(logs.some(l => l.score === 0)).toBe(false); // oldest dropped
    });
});
