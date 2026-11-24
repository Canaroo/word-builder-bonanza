// A service to play procedurally generated sound effects using the Web Audio API.
import { musicService } from './musicService';


let audioCtx: AudioContext | null = null;
let isMuted = false;

// Silence all audio (music included) while the game is in the background, to save battery.
if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
        if (!audioCtx) return;
        if (document.hidden) audioCtx.suspend();
        else audioCtx.resume();
    });
}

/**
 * Initializes the AudioContext. Must be called as a result of a user gesture (e.g., a click).
 * This is necessary to comply with browser autoplay policies.
 */
const initialize = () => {
    if (audioCtx) return;
    try {
        // Create a new AudioContext.
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        // Initialize the music service with the shared context
        musicService.initialize(audioCtx);

        // Sync music mute state on initialization
        musicService.setMuted(isMuted);
    } catch (e) {
        console.error("Web Audio API is not supported in this browser.");
    }
};

/**
 * Toggles the muted state of the sound service.
 * @returns {boolean} The new muted state.
 */
const toggleMute = (): boolean => {
    isMuted = !isMuted;
    musicService.setMuted(isMuted); // Control music mute state
    // Play a sound on unmute to confirm
    if (!isMuted && audioCtx) {
        playNote(audioCtx, 800, audioCtx.currentTime, 0.05, 0.1, 'square');
    }
    return isMuted;
};

/**
 * Gets the current muted state.
 * @returns {boolean} The current muted state.
 */
const getMuteState = (): boolean => {
    return isMuted;
};


/**
 * A wrapper to play sounds. It ensures the AudioContext is initialized and resumes it if suspended.
 * @param generator - A function that creates and plays a sound using the provided AudioContext.
 */
const playSound = (generator: (ctx: AudioContext) => void) => {
    // Silently fail if AudioContext couldn't be initialized or if muted.
    if (!audioCtx || isMuted) return;

    // Browsers may suspend the AudioContext if the user navigates away.
    // This resumes it on the next sound playback attempt.
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    generator(audioCtx);
};

/**
 * Plays a single synthesized note with a specific frequency, duration, and volume.
 */
const playNote = (ctx: AudioContext, frequency: number, startTime: number, duration: number, volume = 0.5, type: OscillatorType = 'sine') => {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startTime);
    
    // Control the volume and create a fade-out effect to avoid "popping".
    gainNode.gain.setValueAtTime(volume, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    oscillator.start(startTime);
    oscillator.stop(startTime + duration);
};

/**
 * Generates and plays a burst of white noise, useful for shuffle or swoosh effects.
 */
const playWhiteNoise = (ctx: AudioContext, startTime: number, duration: number, volume = 0.3) => {
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);

    // Fill the buffer with random values to create noise.
    for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = buffer;

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(volume, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    
    noiseSource.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    noiseSource.start(startTime);
    noiseSource.stop(startTime + duration);
};


/**
 * v7.80.0: the wooden "tock" of a keycap: a short band-passed click for the contact, plus a soft note
 * that bends down a touch, like plastic settling.
 */
const tock = (ctx: AudioContext, t: number, freq: number, volume = 0.16, clickHz = 2200, bend = 0.985) => {
    const n = Math.max(1, Math.floor(ctx.sampleRate * 0.02));
    const buffer = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buffer.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const clickGain = ctx.createGain();
    filter.type = 'bandpass'; filter.frequency.value = clickHz; filter.Q.value = 1.2;
    clickGain.gain.value = volume;
    src.buffer = buffer; src.connect(filter); filter.connect(clickGain); clickGain.connect(ctx.destination); src.start(t);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * bend), t + 0.12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(volume, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    osc.connect(g); g.connect(ctx.destination); osc.start(t); osc.stop(t + 0.14);
};
/** A major pentatonic ladder, so placing tiles climbs and a long word sounds like it's building. */
const LADDER = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
const semi = (n: number, base = 392) => base * Math.pow(2, n / 12);

/** Short vibrations on phones that support them (Android; iPhones ignore web vibration). Off with the sound. */
const haptic = (pattern: number | number[]) => {
    if (isMuted) return;
    try { (navigator as any)?.vibrate?.(pattern); } catch { /* not supported */ }
};

export const soundService = {
    haptic,
    initialize,
    toggleMute,
    getMuteState,
    
    playTileClick: () => playSound(ctx => {
        // v7.80.0: a neutral keycap tock (it was a high beep).
        tock(ctx, ctx.currentTime, semi(7), 0.13);
    }),

    /** A tile goes into the word: the tock climbs a scale with each letter (index 0 = first letter). */
    playTilePlace: (index: number) => playSound(ctx => {
        const step = LADDER[Math.max(0, Math.min(LADDER.length - 1, index))];
        tock(ctx, ctx.currentTime, semi(step), 0.16);
        playNote(ctx, semi(step) * 2, ctx.currentTime, 0.05, 0.035, 'sine');
    }),

    /** A tile goes back to the rack: a lower tock that falls, clearly "undo". */
    playTileReturn: () => playSound(ctx => {
        tock(ctx, ctx.currentTime, 330, 0.12, 1200, 0.7);
    }),

    /** A good word: a chord that grows with its length (3 letters short and bright, 6+ adds a sparkle). */
    playValidWord: (length = 3) => playSound(ctx => {
        const now = ctx.currentTime;
        const notes = [0, 4, 7, 12, 16, 19, 24].slice(0, Math.max(3, Math.min(7, length)));
        notes.forEach((n, k) => playNote(ctx, semi(n, 523), now + k * 0.055, Math.max(0.12, 0.32 - k * 0.02), 0.13, k % 2 ? 'triangle' : 'sine'));
        if (length >= 6) for (let k = 0; k < 5; k++) playNote(ctx, semi(24 + LADDER[k], 523), now + 0.4 + k * 0.04, 0.12, 0.05, 'sine');
    }),

    playInvalidWord: () => playSound(ctx => {
        // v7.80.0: a soft low thud and a wobble: still clearly "no", less punishing than the old buzz.
        const now = ctx.currentTime;
        tock(ctx, now, 140, 0.2, 400, 0.6);
        playNote(ctx, 120, now + 0.12, 0.2, 0.15, 'triangle');
    }),

    /** A meter is about to fill (the word on the stage will fill PowerPlay or Golden). */
    playShimmer: () => playSound(ctx => {
        const now = ctx.currentTime;
        [0, 4, 7, 11, 14].forEach((n, k) => playNote(ctx, semi(n + 12, 659), now + k * 0.04, 0.25, 0.05, 'sine'));
    }),

    playMilestone: () => playSound(ctx => {
        // A celebratory major arpeggio.
        const now = ctx.currentTime;
        playNote(ctx, 523.25, now, 0.15, 0.3); // C5
        playNote(ctx, 659.25, now + 0.15, 0.15, 0.3); // E5
        playNote(ctx, 783.99, now + 0.30, 0.2, 0.3); // G5
    }),

    playShuffle: () => playSound(ctx => {
        // v7.80.0: a rattle as the tiles are swept up, then they clatter back in one by one.
        const now = ctx.currentTime;
        playWhiteNoise(ctx, now, 0.12, 0.05);
        for (let k = 0; k < 8; k++) tock(ctx, now + 0.12 + k * 0.05, semi(LADDER[k % 5] - 5), 0.07, 2000 + k * 120);
    }),

    playClear: () => playSound(ctx => {
        // A descending frequency sweep for a "whoosh" effect.
        const now = ctx.currentTime;
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.2, now);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
        oscillator.frequency.setValueAtTime(1000, now);
        oscillator.frequency.exponentialRampToValueAtTime(100, now + 0.2);
        
        oscillator.start(now);
        oscillator.stop(now + 0.2);
    }),

    playTick: () => playSound(ctx => {
        playNote(ctx, 1500, ctx.currentTime, 0.05, 0.1, 'sine');
    }),

    playPowerUp: () => playSound(ctx => {
        const now = ctx.currentTime;
        playNote(ctx, 440, now, 0.05, 0.2, 'triangle');
        playNote(ctx, 880, now + 0.05, 0.1, 0.2, 'triangle');
    }),

    playUIClick: () => playSound(ctx => {
        playNote(ctx, 900, ctx.currentTime, 0.07, 0.15, 'triangle');
    }),

    playChallenge: () => playSound(ctx => {
        const now = ctx.currentTime;
        playNote(ctx, 200, now, 0.1, 0.3, 'sawtooth');
        playNote(ctx, 180, now + 0.1, 0.2, 0.3, 'sawtooth');
    }),
    
    playModalOpen: () => playSound(ctx => {
        // A soft whoosh sound.
        const now = ctx.currentTime;
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.15, now);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
        oscillator.frequency.setValueAtTime(400, now);
        oscillator.frequency.exponentialRampToValueAtTime(1200, now + 0.15);
        
        oscillator.start(now);
        oscillator.stop(now + 0.15);
    }),

    playPowerSurgeReady: () => playSound(ctx => {
        // A more intense, charging-up arpeggio
        const now = ctx.currentTime;
        playNote(ctx, 300, now, 0.08, 0.3, 'sawtooth');
        playNote(ctx, 450, now + 0.08, 0.08, 0.3, 'sawtooth');
        playNote(ctx, 600, now + 0.16, 0.08, 0.3, 'sawtooth');
        playNote(ctx, 900, now + 0.24, 0.15, 0.4, 'sawtooth');
    }),

    playComboDrop: () => playSound(ctx => {
        // A descending, "womp-womp" sound
        const now = ctx.currentTime;
        playNote(ctx, 250, now, 0.1, 0.2, 'square');
        playNote(ctx, 150, now + 0.1, 0.15, 0.2, 'square');
    }),
    
    playNESFanfare: () => playSound(ctx => {
        const now = ctx.currentTime;
        const t: OscillatorType = 'triangle';
        const v = 0.2;
        playNote(ctx, 523.25, now, 0.1, v, t); // C5
        playNote(ctx, 783.99, now + 0.1, 0.1, v, t); // G5
        playNote(ctx, 1046.50, now + 0.2, 0.2, v, t); // C6
    }),

    playHeroicChord: () => playSound(ctx => {
        const now = ctx.currentTime;
        const t: OscillatorType = 'sawtooth';
        const v = 0.15;
        playNote(ctx, 261.63, now, 0.5, v, t); // C4
        playNote(ctx, 311.13, now, 0.5, v, t); // Eb4
        playNote(ctx, 392.00, now, 0.5, v, t); // G4
        playNote(ctx, 523.25, now + 0.2, 0.3, 0.2, t); // C5
    }),

    playBroadwayRiff: () => playSound(ctx => {
        const now = ctx.currentTime;
        const t: OscillatorType = 'square';
        const v = 0.2;
        playNote(ctx, 783.99, now, 0.1, v, t); // G5
        playNote(ctx, 783.99, now + 0.15, 0.1, v, t); // G5
        playNote(ctx, 880.00, now + 0.3, 0.2, v, t); // A5
    }),

    // --- Bonus reveal stings, one per media type (see data/bonusMedia.ts) ---

    /** VHS: the clunk of a tape going in, then the VCR motor winding up. */
    playVhsSting: () => playSound(ctx => {
        const now = ctx.currentTime;
        playNote(ctx, 90, now, 0.08, 0.3, 'square');
        playNote(ctx, 60, now + 0.09, 0.1, 0.25, 'square');
        const motor = ctx.createOscillator();
        const gain = ctx.createGain();
        motor.type = 'sawtooth';
        motor.frequency.setValueAtTime(110, now + 0.2);
        motor.frequency.exponentialRampToValueAtTime(440, now + 0.75);
        gain.gain.setValueAtTime(0.0001, now + 0.2);
        gain.gain.exponentialRampToValueAtTime(0.08, now + 0.35);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
        motor.connect(gain).connect(ctx.destination);
        motor.start(now + 0.2);
        motor.stop(now + 0.82);
    }),

    /** Cartridge: an 8-bit power-on arpeggio. */
    playCartridgeSting: () => playSound(ctx => {
        const now = ctx.currentTime;
        [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((f, i) => playNote(ctx, f, now + i * 0.07, 0.09, 0.18, 'square'));
    }),

    /** CD: a shimmering major chord as the disc spins up. */
    playCdSting: () => playSound(ctx => {
        const now = ctx.currentTime;
        [392.0, 493.88, 587.33, 783.99].forEach((f, i) => playNote(ctx, f, now + i * 0.04, 0.7, 0.09, 'sine'));
        playNote(ctx, 1567.98, now + 0.25, 0.4, 0.05, 'triangle');
    }),

    /** Arcade marquee: insert-coin blip. */
    playCoinSting: () => playSound(ctx => {
        const now = ctx.currentTime;
        playNote(ctx, 987.77, now, 0.08, 0.2, 'square'); // B5
        playNote(ctx, 1318.51, now + 0.08, 0.3, 0.2, 'square'); // E6
    }),
};