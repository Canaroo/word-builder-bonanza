// A service to manage background music playback using Web Audio API.

const musicService = (() => {
    let audioCtx: AudioContext | null = null;
    let musicBuffer: AudioBuffer | null = null;
    let sourceNode: AudioBufferSourceNode | null = null;
    let gainNode: GainNode | null = null;
    let isPlaying = false;
    let isLoading = false;
    let isInitialized = false;
    const MUSIC_VOLUME = 0.1; // Set to 10% for ambient background music

    const loadMusic = async () => {
        if (!audioCtx || musicBuffer || isLoading) return;
        isLoading = true;
        try {
            const response = await fetch(`${import.meta.env.BASE_URL}audio/mindscape.mp3`);
            const arrayBuffer = await response.arrayBuffer();
            musicBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        } catch (error) {
            console.error("Failed to load or decode music file:", error);
        } finally {
            isLoading = false;
        }
    };

    const playLoop = () => {
        if (!audioCtx || !musicBuffer || !gainNode || isPlaying) return;
        
        if (sourceNode) {
            sourceNode.stop();
            sourceNode.disconnect();
        }

        sourceNode = audioCtx.createBufferSource();
        sourceNode.buffer = musicBuffer;
        sourceNode.loop = true;
        
        sourceNode.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        sourceNode.start(0);
        isPlaying = true;
    };

    return {
        /**
         * Initializes the music service with a shared AudioContext.
         * @param {AudioContext} ctx - The shared AudioContext.
         */
        initialize: (ctx: AudioContext) => {
            if (isInitialized) return;
            audioCtx = ctx;
            gainNode = audioCtx.createGain();
            gainNode.gain.value = MUSIC_VOLUME;
            isInitialized = true;
            loadMusic();
        },

        /**
         * Starts or resumes music playback.
         */
        play: async () => {
            if (!isInitialized || !audioCtx) {
                console.warn("Music service not initialized. Cannot play.");
                return;
            }
            
            if (audioCtx.state === 'suspended') {
                await audioCtx.resume();
            }

            if (isPlaying) return;

            const checkAndPlay = () => {
                if (!isLoading) {
                    if (musicBuffer) playLoop();
                } else {
                    setTimeout(checkAndPlay, 100);
                }
            };
            checkAndPlay();
        },

        /**
         * Pauses music playback. In this implementation, it stops the current sound.
         * The next play() call will start it from the beginning of the loop.
         */
        pause: () => {
            if (!isPlaying || !sourceNode) return;
            sourceNode.stop();
            sourceNode.disconnect();
            sourceNode = null;
            isPlaying = false;
        },

        /**
         * Stops music playback and resets the track to the beginning.
         */
        stop: () => {
            if (!isPlaying || !sourceNode) return;
            sourceNode.stop();
            sourceNode.disconnect();
            sourceNode = null;
            isPlaying = false;
        },

        /**
         * Sets the muted state of the music.
         * @param {boolean} muted - True to mute, false to unmute.
         */
        setMuted: (muted: boolean) => {
            if (gainNode && audioCtx) {
                const newVolume = muted ? 0 : MUSIC_VOLUME;
                gainNode.gain.linearRampToValueAtTime(newVolume, audioCtx.currentTime + 0.1);
            }
        },
    };
})();

export { musicService };