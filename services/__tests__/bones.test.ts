// @vitest-environment jsdom
// v7.44 Bones: what gets left behind, what counts as a ghost worth meeting.
import { describe, test, expect, beforeEach } from 'vitest';
import { toBone, pickBone, worthLeaving, markLooted, solveHand, LAST_RESORT, type Bone } from '../bones';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { canBeMadeFromLetters } from '../rackMatch';
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
    // A tiny dictionary stands in for the real word finder.
    const WORDS = ['PLANT', 'STONE', 'TRAIN', 'HOUSE', 'BREAD', 'LIGHT', 'RADIO', 'OCEAN', 'SNAIL', 'TIGER', 'ALONE', 'IRATE', 'ARISE', 'LEARN', 'STARE', 'NOTES', 'CAT'];
    const find = async (letters: string[]) => WORDS.filter(w => w.length >= 5).find(w => canBeMadeFromLetters(w, letters)) ?? null;
    const seeded = (n: number) => () => (n = (n * 1664525 + 1013904223) >>> 0) / 4294967296;
    test('a hand that can already spell a word is left alone', async () => {
        const s = await solveHand(['P', 'L', 'A', 'N', 'T', 'S', 'E', 'R'], find);
        expect(s).toEqual({ hand: ['P', 'L', 'A', 'N', 'T', 'S', 'E', 'R'], answer: 'PLANT', swapped: 0 });
    });
    test('a hopeless hand gets tiles swapped until a 5+ letter word is there, every time', async () => {
        for (let i = 1; i <= 40; i++) {
            const s = await solveHand(['Q', 'Z', 'X', 'J', 'K', 'V', 'W', 'Y'], find, seeded(i));
            expect(s.answer.length).toBeGreaterThanOrEqual(BONES.minLetters);
            expect(canBeMadeFromLetters(s.answer, s.hand)).toBe(true);
            expect(s.swapped).toBeGreaterThan(0);
            expect(s.hand).toHaveLength(8);
        }
    });
    test('a short hand is topped up to eight, and no dictionary means no card', async () => {
        const s = await solveHand(['P', 'L', 'A', 'N', 'T'], find, seeded(3));
        expect(s.hand).toHaveLength(8);
        expect(s.hand.slice(0, 5)).toEqual(['P', 'L', 'A', 'N', 'T']);
    });
    test('even with a finder that finds nothing, the hand is dealt around a real word', async () => {
        const list = new Set(readFileSync(resolve(__dirname, '../../public/words/wordlist.txt'), 'utf8').split(/\s+/));
        for (const w of LAST_RESORT) expect(list.has(w.toLowerCase()), w).toBe(true);
        for (let i = 1; i <= 20; i++) {
            const s = await solveHand(['Q', 'Z', 'X', 'J', 'K'], async () => null, seeded(i));
            expect(LAST_RESORT).toContain(s.answer);
            expect(canBeMadeFromLetters(s.answer, s.hand)).toBe(true);
            expect(s.hand).toHaveLength(8);
        }
    });

    test('the card continues the round when it closes, and a ghost needs a long word', () => {
        expect(POST_WORD_MODALS).toContain('bones');
        expect(BONES.minLetters).toBeGreaterThanOrEqual(5);
    });
});
