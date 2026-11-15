// @vitest-environment jsdom
// v7.44 Bones: what gets left behind, what counts as a ghost worth meeting.
import { describe, test, expect, beforeEach } from 'vitest';
import { toBone, pickBone, worthLeaving, markLooted, type Bone } from '../bones';
import { BONES } from '../../config/gameplay';
import { POST_WORD_MODALS } from '../screens/GameScreen';

const NOW = 1_800_000_000_000;
const bone = (over: Partial<Bone> = {}): Bone => ({ id: 'b1', name: 'Nicole', level: 3, hand: ['P', 'L', 'A', 'N', 'T', 'S', 'E', 'R'], charms: ['oneRing', 'chaosTheory'], score: 4200, timestamp: NOW - 3600_000, ...over });

describe('Bones', () => {
    beforeEach(() => localStorage.clear());
    test('rows are checked before they are trusted', () => {
        const row = { name: 'Nicole', level: 3, hand: 'P,L,A,N,T,S,E,QU', charms: 'oneRing,chaosTheory', score: 4200, timestamp: NOW };
        expect(toBone('x', row)).toMatchObject({ id: 'x', name: 'Nicole', hand: ['P', 'L', 'A', 'N', 'T', 'S', 'E', 'QU'], charms: ['oneRing', 'chaosTheory'] });
        expect(toBone('x', { ...row, name: '<script>' })).toBeNull();
        expect(toBone('x', { ...row, level: 1 })).toBeNull();
        expect(toBone('x', { ...row, hand: 'A,B' })).toBeNull();
        expect(toBone('x', { ...row, hand: 'a,b,c,d,e' })).toBeNull();
        expect(toBone('x', { ...row, charms: '' })).toBeNull();
        expect(toBone('x', { ...row, charms: 'a b,c' })).toBeNull();
        expect(toBone('x', null)).toBeNull();
        // Phoenix Down is never loot.
        expect(toBone('x', { ...row, charms: 'phoenixDown,oneRing' })?.charms).toEqual(['oneRing']);
        expect(toBone('x', { ...row, charms: 'phoenixDown' })).toBeNull();
    });
    test('only runs worth finding leave bones', () => {
        const run = { level: 3, hand: ['P', 'L', 'A', 'N', 'T', 'S', 'E', 'R'], charms: ['oneRing'] };
        expect(worthLeaving(run)).toBe(true);
        expect(worthLeaving({ ...run, level: BONES.minLevel - 1 })).toBe(false);
        expect(worthLeaving({ ...run, charms: [] })).toBe(false);
        expect(worthLeaving({ ...run, hand: ['A', 'B', 'C'] })).toBe(false);
    });
    test('you meet the newest ghost on your level, never your own, a looted one, a stale one, or one with nothing new', () => {
        const ctx = { player: 'Bobby', heldCharmIds: [] as string[], now: NOW };
        const older = bone({ id: 'old', timestamp: NOW - 86_400_000 });
        const newer = bone({ id: 'new' });
        expect(pickBone(3, ctx, [older, newer], [])?.id).toBe('new');
        expect(pickBone(4, ctx, [older, newer], [])).toBeNull();
        expect(pickBone(3, { ...ctx, player: 'nicole ' }, [newer], [])).toBeNull();
        expect(pickBone(3, ctx, [older, newer], ['new'])?.id).toBe('old');
        expect(pickBone(3, { ...ctx, met: ['new', 'old'] }, [older, newer], [])).toBeNull();
        expect(pickBone(3, ctx, [bone({ timestamp: NOW - (BONES.maxAgeDays + 1) * 86_400_000 })], [])).toBeNull();
        expect(pickBone(3, { ...ctx, heldCharmIds: ['oneRing', 'chaosTheory'] }, [newer], [])).toBeNull();
        expect(pickBone(3, { ...ctx, heldCharmIds: ['oneRing'] }, [newer], [])?.id).toBe('new');
    });
    test('taking a charm is remembered per player', () => {
        markLooted('new');
        expect(pickBone(3, { player: 'Bobby', heldCharmIds: [], now: NOW }, [bone({ id: 'new' })])).toBeNull();
    });
    test('the card continues the round when it closes, and a ghost needs a long word', () => {
        expect(POST_WORD_MODALS).toContain('bones');
        expect(BONES.minLetters).toBeGreaterThanOrEqual(5);
    });
});
