// Background music on the Web Audio API (v7.53.0: several tracks). One track plays at a time,
// looped seamlessly (at its exact musical length when known, which skips the MP3's padding).
// Switching tracks crossfades; the shop can preview a track for a few seconds, even when muted
// (the player asked for it), with the game's music ducked underneath.
import { trackById, DEFAULT_TRACK_ID } from '../data/music';
import { selectedTrack } from './music';

const MUSIC_VOLUME = 0.1; // ambient background level
const PREVIEW_VOLUME = 0.16;
const FADE = 0.8; // seconds

const musicService = (() => {
    let audioCtx: AudioContext | null = null;
    let busGain: GainNode | null = null; // mute lives here
    const buffers = new Map<string, AudioBuffer>();
    const loading = new Map<string, Promise<AudioBuffer | null>>();
    let currentId = DEFAULT_TRACK_ID;
    let source: { node: AudioBufferSourceNode; gain: GainNode; id: string } | null = null;
    let wantPlaying = false;
    let muted = false;
    let preview: { node: AudioBufferSourceNode; gain: GainNode; id: string; timer: ReturnType<typeof setTimeout> } | null = null;
    const listeners = new Set<() => void>();
    const notify = () => listeners.forEach(fn => { try { fn(); } catch { /* ignore */ } });

    const load = (id: string): Promise<AudioBuffer | null> => {
        if (!audioCtx) return Promise.resolve(null);
        const have = buffers.get(id);
        if (have) return Promise.resolve(have);
        const pending = loading.get(id);
        if (pending) return pending;
        const track = trackById(id) ?? trackById(DEFAULT_TRACK_ID)!;
        const ctx = audioCtx;
        const p = fetch(`${import.meta.env.BASE_URL}audio/${track.file}`)
            .then(r => r.arrayBuffer())
            .then(b => ctx.decodeAudioData(b))
            .then(buf => { buffers.set(id, buf); return buf; })
            .catch(err => { console.error('Failed to load music', id, err); return null; })
            .finally(() => loading.delete(id));
        loading.set(id, p);
        return p;
    };

    const fadeOutAndStop = (s: { node: AudioBufferSourceNode; gain: GainNode }, seconds = FADE) => {
        if (!audioCtx) return;
        const now = audioCtx.currentTime;
        s.gain.gain.cancelScheduledValues(now);
        s.gain.gain.setValueAtTime(s.gain.gain.value, now);
        s.gain.gain.linearRampToValueAtTime(0, now + seconds);
        try { s.node.stop(now + seconds + 0.05); } catch { /* already stopped */ }
    };

    const startCurrent = async (fadeIn: boolean) => {
        const id = currentId;
        const buf = await load(id);
        if (!audioCtx || !busGain || !buf || !wantPlaying || currentId !== id || (source && source.id === id)) return;
        const node = audioCtx.createBufferSource();
        node.buffer = buf;
        node.loop = true;
        const loopSeconds = trackById(id)?.loopSeconds;
        if (loopSeconds && loopSeconds < buf.duration) { node.loopStart = 0; node.loopEnd = loopSeconds; }
        const gain = audioCtx.createGain();
        const now = audioCtx.currentTime;
        gain.gain.setValueAtTime(fadeIn ? 0 : 1, now);
        if (fadeIn) gain.gain.linearRampToValueAtTime(1, now + FADE);
        node.connect(gain); gain.connect(busGain);
        node.start(0);
        if (source) fadeOutAndStop(source);
        source = { node, gain, id };
    };

    const applyBusVolume = () => {
        if (!audioCtx || !busGain) return;
        const target = muted || preview ? 0 : MUSIC_VOLUME;
        const now = audioCtx.currentTime;
        busGain.gain.cancelScheduledValues(now);
        busGain.gain.setValueAtTime(busGain.gain.value, now);
        busGain.gain.linearRampToValueAtTime(target, now + 0.25);
    };

    const endPreview = () => {
        if (!preview) return;
        clearTimeout(preview.timer);
        fadeOutAndStop(preview, 0.4);
        preview = null;
        applyBusVolume();
        notify();
    };

    return {
        initialize: (ctx: AudioContext) => {
            if (audioCtx) return;
            audioCtx = ctx;
            busGain = audioCtx.createGain();
            busGain.gain.value = muted ? 0 : MUSIC_VOLUME;
            busGain.connect(audioCtx.destination);
            currentId = selectedTrack();
            load(currentId);
        },

        play: async () => {
            if (!audioCtx) { console.warn('Music service not initialized. Cannot play.'); return; }
            if (audioCtx.state === 'suspended') await audioCtx.resume();
            wantPlaying = true;
            if (!source) await startCurrent(false);
        },

        pause: () => {
            wantPlaying = false;
            if (source) { try { source.node.stop(); } catch { /* already stopped */ } source.node.disconnect(); source = null; }
        },

        stop: () => {
            wantPlaying = false;
            if (source) { try { source.node.stop(); } catch { /* already stopped */ } source.node.disconnect(); source = null; }
        },

        setMuted: (m: boolean) => { muted = m; applyBusVolume(); },

        /** Switch tracks: a crossfade if music is playing, otherwise it's what plays next. */
        setTrack: (id: string) => {
            if (!trackById(id) || id === currentId) return;
            currentId = id;
            if (wantPlaying) startCurrent(true); else if (audioCtx) load(id);
        },

        currentTrack: () => currentId,

        /** Play a few seconds of a track (the shop's ▶). The game's music ducks underneath. */
        preview: async (id: string, seconds = 15) => {
            if (!audioCtx || !trackById(id)) return;
            if (audioCtx.state === 'suspended') await audioCtx.resume();
            endPreview();
            const buf = await load(id);
            if (!buf || !audioCtx) return;
            const node = audioCtx.createBufferSource();
            node.buffer = buf;
            const gain = audioCtx.createGain();
            const now = audioCtx.currentTime;
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(PREVIEW_VOLUME, now + 0.3);
            node.connect(gain); gain.connect(audioCtx.destination);
            node.start(0);
            preview = { node, gain, id, timer: setTimeout(endPreview, seconds * 1000) };
            applyBusVolume();
            notify();
        },

        stopPreview: endPreview,
        previewing: () => preview?.id ?? null,
        /** For UI that shows the preview state; returns an unsubscribe. */
        subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
    };
})();

export { musicService };
