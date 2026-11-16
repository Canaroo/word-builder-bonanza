// @vitest-environment jsdom
import { describe, test, expect, beforeEach } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { MUSIC_TRACKS, DEFAULT_TRACK_ID } from '../../data/music';
import { MUSIC_PRICE, SHOP_NEWS } from '../../config/progression';
import { ownedTracks, selectedTrack, selectTrack, buyTrack } from '../music';

describe('music tracks in the shop (v7.53.0)', () => {
    beforeEach(() => localStorage.clear());

    test('five tracks: the free default and four for sale, each with its file', () => {
        expect(MUSIC_TRACKS.map(t => t.id)).toEqual(['mindscape', 'pixelHometown', 'midnightRental', 'coinOpLounge', 'dialUpDreams']);
        expect(MUSIC_TRACKS.filter(t => t.cost === 0).map(t => t.id)).toEqual([DEFAULT_TRACK_ID]);
        for (const t of MUSIC_TRACKS.filter(t => t.cost > 0)) expect(t.cost).toBe(MUSIC_PRICE);
        for (const t of MUSIC_TRACKS) expect(existsSync(resolve(__dirname, '../../public/audio', t.file)), t.file).toBe(true);
        // Loop lengths are the exact musical lengths of the scores (bars x beats x 60 / bpm).
        expect(MUSIC_TRACKS.find(t => t.id === 'midnightRental')!.loopSeconds).toBeCloseTo(91.43, 2);
        expect(MUSIC_TRACKS.find(t => t.id === 'coinOpLounge')!.loopSeconds).toBeCloseTo(68.57, 2);
    });

    test('everyone owns and plays the default to start', () => {
        expect(ownedTracks()).toEqual([DEFAULT_TRACK_ID]);
        expect(selectedTrack()).toBe(DEFAULT_TRACK_ID);
        expect(selectTrack('pixelHometown')).toBe(false); // not owned yet
    });

    test('buying charges the price once, owns the track and plays it', () => {
        expect(buyTrack('pixelHometown', MUSIC_PRICE - 1)).toBe(0);
        expect(buyTrack('pixelHometown', MUSIC_PRICE)).toBe(MUSIC_PRICE);
        expect(ownedTracks()).toEqual(['mindscape', 'pixelHometown']);
        expect(selectedTrack()).toBe('pixelHometown');
        expect(buyTrack('pixelHometown', 999)).toBe(0); // already owned
        expect(buyTrack('mindscape', 999)).toBe(0);      // free, never sold
        expect(selectTrack('mindscape')).toBe(true);
        expect(selectedTrack()).toBe('mindscape');
    });

    test('a junk saved choice falls back to the default', () => {
        localStorage.setItem('wordNerdMusicTrack', 'notATrack');
        expect(selectedTrack()).toBe(DEFAULT_TRACK_ID);
    });

    test('the shop banner opens the music tab', () => {
        expect(SHOP_NEWS.tab).toBe('music');
        expect(SHOP_NEWS.text).toContain('4 music tracks');
    });
});
