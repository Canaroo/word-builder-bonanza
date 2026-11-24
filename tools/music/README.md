# Shop music (v7.53.0)

The four shop tracks are original compositions, written as scores in `songs.js` and rendered by a
small Web Audio synth (`render.js`) in headless Chromium:

```bash
node tools/music/make.cjs pixelHometown midnightRental coinOpLounge dialUpDreams   # writes WAVs here
# then level to about -16 LUFS and encode, e.g.:
ffmpeg -i tools/music/pixelHometown.wav -af "volume=6.3dB,alimiter=limit=0.84:level=false" -c:a libmp3lame -b:a 112k public/audio/shop/pixel-hometown.mp3
```

Event music (v7.77.0): `goldenFountain` (the Golden Round, -4.5 dB) and `bossFight` (boss fights,
+1.7 dB) go to `public/audio/events/golden-round.mp3` and `boss-fight.mp3` the same way (112k), listed
in `EVENT_TRACKS` in `data/music.ts`. `goldenRound` (the brighter first Golden draft) is kept for reference.

Each render folds its reverb tail back onto the start, so the loop is seamless. The exact loop
length (bars x beats x 60 / bpm) goes in `loopSeconds` in `data/music.ts`, which skips the MP3's
padding. Don't commit the WAVs.
