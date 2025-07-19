

// A service to play procedurally generated sound effects using the Web Audio API.

let audioCtx: AudioContext | null = null;
let isMuted = false;

/**
 * Initializes the AudioContext. Must be called as a result of a user gesture (e.g., a click).
 * This is necessary to comply with browser autoplay policies.
 */
const initialize = () => {
    if (audioCtx) return;
    try {
        // Create a new AudioContext.
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
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


export const soundService = {
    initialize,
    toggleMute,
    getMuteState,
    
    playTileClick: () => playSound(ctx => {
        // A short, high-pitched tick.
        playNote(ctx, 1200, ctx.currentTime, 0.05, 0.2, 'triangle');
    }),
    
    playValidWord: () => playSound(ctx => {
        // An ascending two-tone sound for success.
        const now = ctx.currentTime;
        playNote(ctx, 600, now, 0.1, 0.3, 'sine');
        playNote(ctx, 900, now + 0.1, 0.1, 0.3, 'sine');
    }),

    playInvalidWord: () => playSound(ctx => {
        // A low, harsh buzz for an error.
        playNote(ctx, 150, ctx.currentTime, 0.25, 0.2, 'sawtooth');
    }),

    playMilestone: () => playSound(ctx => {
        // A celebratory major arpeggio.
        const now = ctx.currentTime;
        playNote(ctx, 523.25, now, 0.15, 0.3); // C5
        playNote(ctx, 659.25, now + 0.15, 0.15, 0.3); // E5
        playNote(ctx, 783.99, now + 0.30, 0.2, 0.3); // G5
    }),

    playShuffle: () => playSound(ctx => {
        // A short burst of white noise.
        playWhiteNoise(ctx, ctx.currentTime, 0.15, 0.1);
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
};