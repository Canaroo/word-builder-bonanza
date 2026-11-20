import { describe, it, expect } from 'vitest';
import { summarize, runEndExtras, type StoredStat } from '../stats';

describe('v7.61.1 stats', () => {
  it('summarizes forks, Golden Rounds, gates and tape uses', () => {
    const t = 1;
    const ev = [
      { type: 'fork', choice: 'danger', level: 7, clock: 70, advice: 'danger', timestamp: t },
      { type: 'fork', choice: 'easy', level: 4, clock: 30, advice: 'danger', timestamp: t },
      { type: 'fork', choice: 'bail', level: 8, clock: 20, timestamp: t },
      { type: 'golden', level: 3, score: 300, tile: true, ok: true, timestamp: t },
      { type: 'golden', level: 3, score: 0, tile: false, ok: false, timestamp: t },
      { type: 'gate', gate: 10000, result: 'played', points: 1000, timestamp: t },
      { type: 'gate', gate: 10000, result: 'skip', points: 0, timestamp: t },
      { type: 'pp_use', pp: 'cowabunga', level: 2, tape: true, timestamp: t },
    ] as unknown as StoredStat[];
    const s = summarize(ev);
    expect(s.forks).toEqual({ easy: 1, danger: 1, bail: 1, followed: 1, advised: 2 });
    expect(s.golden).toEqual({ played: 1, missed: 1, tile: 1, points: [300] });
    expect(s.gates[10000]).toEqual({ played: 1, skipped: 1, points: [1000] });
    expect(s.tapeUses).toBe(1);
  });
  it('reads run_end extras from the log', () => {
    const x = runEndExtras({
      log: [
        { type: 'word', status: 'valid', word: 'PATRONS', bonuses: [{ name: '🎯 Skill Shot' }] },
        { type: 'word', status: 'valid', word: 'CAT', bonuses: [] },
        { type: 'event', name: 'Cooled off' },
        { type: 'event', name: 'Last Words', scoreChange: 90 },
      ],
      timeLedger: { goldenRounds: 2 }, route: { choice: 'danger' },
    });
    expect(x).toEqual({ golden: 2, route: 'danger', bails: 1, skill: 1, gems: 1, lastWords: 90 });
  });
});
