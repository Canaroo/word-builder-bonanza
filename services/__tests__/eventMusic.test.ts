// @vitest-environment jsdom
// v7.77.0: Golden Round and boss fight music.
import { describe, test, expect } from 'vitest';
import fs from 'node:fs';
import { EVENT_TRACKS, MUSIC_TRACKS, trackById } from '../../data/music';
import { eventMusicOn, setEventMusicOn, ownedTracks } from '../music';

describe('event music', () => {
    test('two tracks, loadable by id, with real files, never sold or owned', () => {
        expect(EVENT_TRACKS.map(t => t.id)).toEqual(['eventGolden', 'eventBoss']);
        for (const t of EVENT_TRACKS) {
            expect(trackById(t.id)).toBe(t);
            expect(fs.existsSync(`public/audio/${t.file}`), t.file).toBe(true);
            expect(MUSIC_TRACKS.some(m => m.id === t.id)).toBe(false);
            expect(ownedTracks()).not.toContain(t.id);
        }
        expect(EVENT_TRACKS[0].loopSeconds).toBeCloseTo(53.33, 1);
        expect(EVENT_TRACKS[1].loopSeconds).toBeCloseTo(25.26, 1);
    });
    test('the Sound panel switch is on by default and remembers off', () => {
        localStorage.clear();
        expect(eventMusicOn()).toBe(true);
        setEventMusicOn(false); expect(eventMusicOn()).toBe(false);
        setEventMusicOn(true); expect(eventMusicOn()).toBe(true);
    });
});
