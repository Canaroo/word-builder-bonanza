// A tiny chiptune/synth renderer on the Web Audio API (OfflineAudioContext). Original sounds only.
async function renderSong(song) {
  const { N, CH } = SONGS;
  const SR = 44100, spb = 60 / song.bpm, bpb = song.beatsPerBar ?? 4, bars = song.chords.length, loopSec = bars * bpb * spb, tail = 3;
  const ctx = new OfflineAudioContext(2, Math.ceil((loopSec + tail) * SR), SR);
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);
  const t = (bar, beat) => { const frac = beat % 1; const sw = Math.abs(frac - 0.5) < 1e-6 ? song.swing : (Math.abs(frac - 0.25) < 1e-6 || Math.abs(frac - 0.75) < 1e-6) ? (song.swing16 ?? 0) : 0; return (bar * bpb + beat + sw) * spb; };

  // Buses: dry master, a stereo delay, and a soft reverb.
  const master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
  const verb = ctx.createConvolver(); const ir = ctx.createBuffer(2, SR * 2.2, SR);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3.2); }
  verb.buffer = ir; const verbIn = ctx.createGain(); verbIn.gain.value = song.style === 'synthwave' ? 0.5 : song.style === 'nineties' ? 0.3 : song.style === 'cozy' ? 0.42 : 0.28; verbIn.connect(verb); verb.connect(master);
  const delay = ctx.createDelay(2); delay.delayTime.value = spb * (song.style === 'synthwave' ? 0.75 : 0.5);
  const fb = ctx.createGain(); fb.gain.value = 0.32; const delayIn = ctx.createGain(); delayIn.gain.value = song.style === 'synthwave' ? 0.35 : 0.18;
  const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 2600;
  delayIn.connect(delay); delay.connect(dlp); dlp.connect(fb); fb.connect(delay); dlp.connect(master);

  const pulse = duty => { const n = 32, re = new Float32Array(n), im = new Float32Array(n); for (let k = 1; k < n; k++) re[k] = (2 / (k * Math.PI)) * Math.sin(Math.PI * k * duty); return ctx.createPeriodicWave(re, im); };
  const P25 = pulse(0.25), P50 = pulse(0.5), P125 = pulse(0.125);
  const noiseBuf = ctx.createBuffer(1, SR, SR); { const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }

  const out = (node, pan, dry = 1, wetVerb = 0, wetDelay = 0) => {
    const p = ctx.createStereoPanner(); p.pan.value = pan; node.connect(p);
    const g = ctx.createGain(); g.gain.value = dry; p.connect(g); g.connect(master);
    if (wetVerb) { const v = ctx.createGain(); v.gain.value = wetVerb; p.connect(v); v.connect(verbIn); }
    if (wetDelay) { const v = ctx.createGain(); v.gain.value = wetDelay; p.connect(v); v.connect(delayIn); }
  };
  const env = (g, start, dur, { a = 0.005, d = 0.08, s = 0.6, r = 0.08, peak = 1 } = {}) => {
    g.gain.setValueAtTime(0, start); g.gain.linearRampToValueAtTime(peak, start + a);
    g.gain.linearRampToValueAtTime(peak * s, start + a + d); g.gain.setValueAtTime(peak * s, Math.max(start + a + d, start + dur));
    g.gain.linearRampToValueAtTime(0, start + dur + r);
  };
  const tone = (start, dur, freq, { wave = 'square', vol = 0.1, pan = 0, e = {}, vib = 0, verb = 0, dly = 0, lp = 0, detune = 0 } = {}) => {
    const o = ctx.createOscillator();
    if (wave instanceof PeriodicWave) o.setPeriodicWave(wave); else o.type = wave;
    o.frequency.value = freq; o.detune.value = detune;
    if (vib && dur > spb * 0.6) { const l = ctx.createOscillator(); l.frequency.value = 5.5; const lg = ctx.createGain(); lg.gain.setValueAtTime(0, start); lg.gain.linearRampToValueAtTime(0, start + spb * 0.35); lg.gain.linearRampToValueAtTime(freq * vib, start + dur); l.connect(lg); lg.connect(o.frequency); l.start(start); l.stop(start + dur + 0.3); }
    const g = ctx.createGain(); env(g, start, dur, { ...e, peak: vol });
    let node = o; if (lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; f.Q.value = 0.7; o.connect(f); node = f; }
    node.connect(g); out(g, pan, 1, verb, dly);
    o.start(start); o.stop(start + dur + (e.r ?? 0.08) + 0.05);
  };
  const noise = (start, dur, { vol = 0.05, type = 'highpass', f = 7000, q = 0.7, pan = 0, verb = 0 } = {}) => {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, start); g.gain.exponentialRampToValueAtTime(0.0008, start + dur);
    s.connect(fl); fl.connect(g); out(g, pan, 1, verb); s.start(start, Math.random() * 0.5); s.stop(start + dur + 0.02);
  };
  const kick = (start, vol = 0.5) => {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(130, start); o.frequency.exponentialRampToValueAtTime(42, start + 0.16);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, start); g.gain.exponentialRampToValueAtTime(0.001, start + 0.32);
    o.connect(g); out(g, 0); o.start(start); o.stop(start + 0.35);
  };

  // Rhodes-style electric piano: two-operator FM, bright on the attack, mellow as it rings.
  const rhodes = (start, dur, freq, vol, pan) => {
    const c = ctx.createOscillator(); c.type = 'sine'; c.frequency.value = freq;
    const m = ctx.createOscillator(); m.type = 'sine'; m.frequency.value = freq;
    const mg = ctx.createGain(); mg.gain.setValueAtTime(freq * 2.2, start); mg.gain.exponentialRampToValueAtTime(freq * 0.25, start + 0.45);
    m.connect(mg); mg.connect(c.frequency);
    const g = ctx.createGain(); env(g, start, dur, { a: 0.003, d: 1.1, s: 0.35, r: 0.35, peak: vol });
    c.connect(g); out(g, pan, 1, 0.35, 0.1);
    c.start(start); m.start(start); c.stop(start + dur + 0.45); m.stop(start + dur + 0.45);
  };
  // Vinyl crackle: a quiet hiss and scattered clicks across the whole loop.
  if (song.style === 'nineties') {
    const hiss = ctx.createBufferSource(); hiss.buffer = noiseBuf; hiss.loop = true;
    const hf = ctx.createBiquadFilter(); hf.type = 'bandpass'; hf.frequency.value = 5000; hf.Q.value = 0.5;
    const hg = ctx.createGain(); hg.gain.value = 0.006; hiss.connect(hf); hf.connect(hg); out(hg, 0); hiss.start(0); hiss.stop(loopSec + tail);
    for (let k = 0; k < loopSec * 7; k++) noise(Math.random() * loopSec, 0.004 + Math.random() * 0.006, { vol: 0.02 + Math.random() * 0.05, f: 2500 + Math.random() * 4000, pan: Math.random() - 0.5 });
  }

  for (let bar = 0; bar < bars; bar++) {
    const names = song.chords[bar];
    const halves = names.length === 2 ? [[names[0], 0, 2], [names[1], 2, 2]] : [[names[0], 0, 4]];
    // Melody
    for (const [beat, dur, note] of song.melody[bar] ?? []) {
      const st = t(bar, beat), d = dur * spb * 0.92, f = hz(N(note));
      if (song.style === 'nineties') {
        // Vibraphone: a soft sine with a faint high partial and a slow shimmer.
        tone(st, d + spb * 0.5, f, { wave: 'sine', vol: 0.1, pan: 0.15, vib: 0.004, verb: 0.4, dly: 0.25, e: { a: 0.003, d: 0.7, s: 0.3, r: 0.4 } });
        tone(st, spb * 0.5, f * 4, { wave: 'sine', vol: 0.012, pan: 0.15, e: { a: 0.002, d: 0.15, s: 0, r: 0.1 } });
      } else if (song.style === 'cozy') {
        // Soundfont-style piano: a sine and a soft triangle an octave up, quick attack, long decay.
        tone(st, d + spb * 0.6, f, { wave: 'sine', vol: 0.11, pan: -0.05, verb: 0.45, dly: 0.12, e: { a: 0.003, d: 0.5, s: 0.35, r: 0.35 } });
        tone(st, d + spb * 0.4, f * 2, { wave: 'triangle', vol: 0.025, pan: -0.1, e: { a: 0.002, d: 0.25, s: 0.1, r: 0.25 } });
        // The music box doubles the tune an octave up from the middle section on.
        if (bar >= song.musicBoxFrom) tone(st, spb * 0.9, f * 2, { wave: 'sine', vol: 0.045, pan: 0.35, verb: 0.55, dly: 0.3, e: { a: 0.001, d: 0.35, s: 0, r: 0.3 } });
      } else if (song.style === 'golden') {
        // Bright pulse lead, a sine an octave up for sparkle, and a bell on each bar's first note.
        tone(st, d, f, { wave: P25, vol: 0.08, vib: 0.008, verb: 0.35, dly: 0.25, pan: -0.05, e: { a: 0.004, d: 0.1, s: 0.7, r: 0.1 } });
        tone(st, d, f * 2, { wave: 'sine', vol: 0.018, pan: 0.2, e: { a: 0.004, d: 0.1, s: 0.4, r: 0.1 } });
        if (beat === 0) { tone(st, spb * 2, f * 2, { wave: 'sine', vol: 0.04, pan: 0.35, verb: 0.6, dly: 0.3, e: { a: 0.001, d: 0.9, s: 0, r: 0.6 } }); tone(st, spb * 0.4, f * 5.4, { wave: 'sine', vol: 0.01, pan: 0.35, e: { a: 0.001, d: 0.25, s: 0, r: 0.2 } }); }
      } else if (song.style === 'boss') {
        // Staccato square lead with a detuned pulse behind it.
        tone(st, d * 0.8, f, { wave: P50, vol: 0.07, vib: 0.006, verb: 0.25, dly: 0.15, pan: 0.05, e: { a: 0.003, d: 0.08, s: 0.6, r: 0.06 } });
        tone(st, d * 0.8, f, { wave: P25, vol: 0.035, detune: 9, pan: -0.25, e: { a: 0.003, d: 0.08, s: 0.5, r: 0.06 } });
      } else if (song.style === 'town') {
        tone(st, d, f, { wave: P25, vol: 0.085, pan: -0.05, vib: 0.012, verb: 0.35, dly: 0.25, e: { a: 0.006, d: 0.12, s: 0.7, r: 0.1 } });
        tone(st, d, f, { wave: 'triangle', vol: 0.05, detune: 6, pan: 0.15, e: { a: 0.006, d: 0.1, s: 0.6, r: 0.1 } });
      } else if (song.style === 'synthwave') {
        tone(st, d, f, { wave: 'sawtooth', vol: 0.06, lp: 2200, vib: 0.01, verb: 0.6, dly: 0.55, pan: 0.05, e: { a: 0.04, d: 0.2, s: 0.75, r: 0.35 } });
        tone(st, d, f, { wave: P50, vol: 0.03, lp: 1800, detune: -8, pan: -0.2, e: { a: 0.04, d: 0.2, s: 0.7, r: 0.35 } });
      } else {
        tone(st, d * 0.85, f, { wave: P125, vol: 0.075, vib: 0.01, verb: 0.3, dly: 0.2, pan: 0.1, e: { a: 0.004, d: 0.15, s: 0.5, r: 0.12 } });
        tone(st, d * 0.85, f * 2, { wave: 'sine', vol: 0.02, pan: 0.2, e: { a: 0.004, d: 0.1, s: 0.3, r: 0.1 } });
      }
    }
    for (const [name, from, len] of halves) {
      const [root, ...upper] = CH[name].map(N);
      if (song.style === 'nineties') {
        // Rhodes comping: a held chord on the downbeat, a short push on the 'and' of 2.
        [[0, 1.4], [2.5, 0.9]].filter(([b]) => b >= from && b < from + len).forEach(([b, dd]) => upper.forEach((m, i) => rhodes(t(bar, b), dd * spb, hz(m), 0.045, i % 2 ? 0.3 : -0.3)));
        // Round bass: root, a pickup, the fifth, an approach note.
        [[0, 1.2, root], [1.75, 0.25, root], [2.5, 0.75, root + 7], [3.5, 0.4, root + 10]].filter(([b]) => b >= from && b < from + len)
          .forEach(([b, dd, m]) => { tone(t(bar, b), dd * spb, hz(m), { wave: 'sine', vol: 0.24, e: { a: 0.006, d: 0.2, s: 0.7, r: 0.06 } }); tone(t(bar, b), dd * spb, hz(m), { wave: 'triangle', vol: 0.05, lp: 700, e: { a: 0.006, d: 0.2, s: 0.5, r: 0.06 } }); });
      } else if (song.style === 'cozy') {
        // Waltz: low piano root on 1, soft chord on 2 and 3.
        tone(t(bar, 0), spb * 1.6, hz(root), { wave: 'triangle', vol: 0.16, verb: 0.2, e: { a: 0.004, d: 0.6, s: 0.3, r: 0.3 } });
        tone(t(bar, 0), spb * 1.6, hz(root + 12), { wave: 'sine', vol: 0.05, e: { a: 0.004, d: 0.5, s: 0.2, r: 0.3 } });
        [1, 2].forEach(b => upper.forEach((m, i) => tone(t(bar, b), spb * 0.55, hz(m), { wave: 'sine', vol: 0.03, pan: i % 2 ? 0.25 : -0.25, verb: 0.35, e: { a: 0.003, d: 0.3, s: 0.2, r: 0.2 } })));
        if (bar >= song.stringsFrom) upper.forEach((m, i) => tone(t(bar, 0), spb * bpb, hz(m), { wave: 'sawtooth', vol: 0.012, lp: 1100, detune: i % 2 ? 7 : -7, pan: i % 2 ? 0.45 : -0.45, verb: 0.6, e: { a: 0.45, d: 0.2, s: 0.9, r: 0.5 } }));
      } else if (song.style === 'golden') {
        // Bouncy octave bass in 8ths.
        for (let k = 0; k < len * 2; k++) tone(t(bar, from + k / 2), spb * 0.42, hz(root + (k % 2 ? 12 : 0)), { wave: 'triangle', vol: 0.19, e: { a: 0.004, d: 0.1, s: 0.7, r: 0.05 } });
        // Harp sparkle: the chord rising in 16ths, two octaves of it.
        const harp = [...upper, ...upper.map(m => m + 12)];
        for (let k = 0; k < len * 4; k++) tone(t(bar, from + k / 4), spb * 0.5, hz(harp[k % harp.length] + 12), { wave: 'triangle', vol: 0.024, pan: (k % 8) / 8 - 0.45, verb: 0.45, dly: 0.2, e: { a: 0.002, d: 0.2, s: 0, r: 0.2 } });
        // Soft held pad.
        upper.forEach((m, i) => tone(t(bar, from), len * spb, hz(m), { wave: P50, vol: 0.012, lp: 1600, detune: i % 2 ? 6 : -6, pan: i % 2 ? 0.4 : -0.4, verb: 0.5, e: { a: 0.2, d: 0.2, s: 0.8, r: 0.3 } }));
      } else if (song.style === 'boss') {
        // Driving octave bass: 8ths with a climb at the end of the bar.
        const steps = [0, 0, 12, 0, 0, 12, 10, 12];
        for (let k = 0; k < len * 2; k++) { const m = root + steps[k % 8]; tone(t(bar, from + k / 2), spb * 0.4, hz(m), { wave: P50, vol: 0.09, lp: 900, e: { a: 0.003, d: 0.08, s: 0.6, r: 0.04 } }); tone(t(bar, from + k / 2), spb * 0.4, hz(m), { wave: 'triangle', vol: 0.12, e: { a: 0.003, d: 0.08, s: 0.6, r: 0.04 } }); }
        // Brass stabs on 1 and the 'and' of 2.
        [0, 1.5].filter(b => b >= from && b < from + len).forEach(b => upper.forEach((m, i) => tone(t(bar, b), spb * 0.3, hz(m), { wave: 'sawtooth', vol: 0.022, lp: 2000, detune: i % 2 ? 8 : -8, pan: i % 2 ? 0.35 : -0.35, verb: 0.3, e: { a: 0.004, d: 0.12, s: 0.4, r: 0.08 } })));
      } else if (song.style === 'town') {
        // Bouncy bass: root, fifth, octave, fifth.
        [[0, root], [1, root + 7], [2, root + 12], [3, root + 7]].filter(([b]) => b >= from && b < from + len)
          .forEach(([b, m]) => tone(t(bar, b), spb * 0.7, hz(m), { wave: 'triangle', vol: 0.2, e: { a: 0.004, d: 0.1, s: 0.7, r: 0.05 } }));
        // Soft off-beat chord taps.
        [1, 3].filter(b => b >= from && b < from + len).forEach(b => upper.forEach((m, i) => tone(t(bar, b), spb * 0.35, hz(m), { wave: P50, vol: 0.022, lp: 2400, pan: i % 2 ? 0.3 : -0.3, verb: 0.2, e: { a: 0.003, d: 0.08, s: 0.3, r: 0.06 } })));
        // Music box from the second verse: 8th-note chord arpeggio two octaves up.
        if (bar >= song.musicBoxFrom) for (let k = 0; k < len * 2; k++) { const m = upper[k % upper.length] + 24 - (upper[k % upper.length] >= N('E4') ? 12 : 0); tone(t(bar, from + k / 2), spb * 0.4, hz(m), { wave: 'triangle', vol: 0.028, pan: 0.45, verb: 0.5, dly: 0.3, e: { a: 0.002, d: 0.25, s: 0, r: 0.2 } }); }
      } else if (song.style === 'synthwave') {
        const st = t(bar, from), dur = len * spb;
        upper.forEach((m, i) => { tone(st, dur, hz(m), { wave: 'sawtooth', vol: 0.03, lp: 900, detune: i % 2 ? 9 : -9, pan: i % 2 ? 0.4 : -0.4, verb: 0.6, e: { a: 0.6, d: 0.3, s: 0.85, r: 0.8 } }); });
        // Pulsing bass in 8ths.
        for (let k = 0; k < len * 2; k++) tone(t(bar, from + k / 2), spb * 0.42, hz(root + (k % 4 === 3 ? 12 : 0)), { wave: 'sawtooth', vol: 0.09, lp: 420, e: { a: 0.005, d: 0.1, s: 0.6, r: 0.05 } });
        // Arpeggio in 16ths.
        const arp = [upper[0] + 12, upper[1] + 12, upper[2] + 12, upper[1] + 12];
        for (let k = 0; k < len * 4; k++) tone(t(bar, from + k / 4), spb * 0.2, hz(arp[k % 4]), { wave: 'triangle', vol: 0.03, pan: Math.sin(k) * 0.5, verb: 0.4, dly: 0.5, e: { a: 0.002, d: 0.08, s: 0.2, r: 0.06 } });
      } else {
        // Bossa bass: root (dotted quarter), fifth, root, fifth.
        [[0, 1.5, root], [1.5, 0.5, root + 7], [2, 1.5, root], [3.5, 0.5, root + 7]].filter(([b]) => b >= from && b < from + len)
          .forEach(([b, d, m]) => tone(t(bar, b), d * spb * 0.85, hz(m), { wave: 'triangle', vol: 0.21, e: { a: 0.004, d: 0.12, s: 0.6, r: 0.06 } }));
        // Comping on a bossa rhythm.
        const comp = bar % 2 === 0 ? [0, 1.5, 3] : [1, 2.5];
        comp.filter(b => b >= from && b < from + len).forEach(b => upper.forEach((m, i) => tone(t(bar, b), spb * 0.45, hz(m), { wave: P25, vol: 0.02, lp: 1700, pan: i % 2 ? 0.35 : -0.35, verb: 0.25, e: { a: 0.004, d: 0.1, s: 0.35, r: 0.08 } })));
      }
    }
    // Drums and percussion.
    if (song.style === 'nineties') {
      // Boom-bap: kick on 1 and the 'and' of 2 (plus a ghost), snare on 2 and 4, swung 16th hats.
      kick(t(bar, 0), 0.5); kick(t(bar, 1.75), 0.25); kick(t(bar, 2.5), 0.42);
      [1, 3].forEach(b => { noise(t(bar, b), 0.2, { vol: 0.085, type: 'bandpass', f: 1700, q: 0.8, verb: 0.35 }); tone(t(bar, b), 0.06, 185, { wave: 'sine', vol: 0.06, e: { a: 0.001, d: 0.06, s: 0, r: 0.04 } }); });
      for (let k = 0; k < 16; k++) noise(t(bar, k / 4), k % 2 ? 0.025 : 0.04, { vol: k % 4 === 2 ? 0.026 : k % 2 ? 0.01 : 0.018, f: 8500, pan: 0.25 });
    } else if (song.style === 'golden') {
      kick(t(bar, 0), 0.38); kick(t(bar, 2), 0.3);
      [1, 3].forEach(b => noise(t(bar, b), 0.12, { vol: 0.06, type: 'bandpass', f: 2200, q: 0.9, verb: 0.3 }));
      for (let k = 0; k < 16; k++) noise(t(bar, k / 4), 0.025, { vol: k % 2 ? 0.008 : 0.014, f: 9500, pan: 0.3 });
      if (bar % 8 === 0) noise(t(bar, 0), 1.4, { vol: 0.05, f: 6000, verb: 0.5 }); // a cymbal at each section
    } else if (song.style === 'boss') {
      for (let b = 0; b < 4; b++) kick(t(bar, b), 0.42);
      [1, 3].forEach(b => { noise(t(bar, b), 0.14, { vol: 0.085, type: 'bandpass', f: 1900, q: 0.9, verb: 0.25 }); tone(t(bar, b), 0.07, 200, { wave: 'sine', vol: 0.06, e: { a: 0.001, d: 0.06, s: 0, r: 0.04 } }); });
      for (let k = 0; k < 8; k++) noise(t(bar, k / 2), 0.04, { vol: k % 2 ? 0.02 : 0.012, f: 8500, pan: -0.2 });
      // Tom fill into each section.
      if (bar % 8 === 7) [3, 3.25, 3.5, 3.75].forEach((b, i) => { const s0 = t(bar, b), o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(220 - i * 35, s0); o.frequency.exponentialRampToValueAtTime(70, s0 + 0.18); env(g, s0, 0.18, { a: 0.002, d: 0.16, s: 0, r: 0.05, peak: 0.35 }); o.connect(g); out(g, i % 2 ? 0.3 : -0.3, 1, 0.2); o.start(s0); o.stop(s0 + 0.3); });
      if (bar % 8 === 0) noise(t(bar, 0), 1.2, { vol: 0.05, f: 5000, verb: 0.4 });
    } else if (song.style === 'town') {
      kick(t(bar, 0), 0.28); kick(t(bar, 2), 0.2);
      for (let k = 0; k < 8; k++) noise(t(bar, k / 2), 0.035, { vol: k % 2 ? 0.012 : 0.02, f: 8000 });
      noise(t(bar, 1), 0.09, { vol: 0.035, type: 'bandpass', f: 1800, q: 1.2, verb: 0.2 }); noise(t(bar, 3), 0.09, { vol: 0.035, type: 'bandpass', f: 1800, q: 1.2, verb: 0.2 });
    } else if (song.style === 'synthwave') {
      const inBreak = song.breakdown && bar >= song.breakdown[0] && bar < song.breakdown[1];
      if (bar >= song.drumsFrom && !inBreak) {
        kick(t(bar, 0), 0.5); kick(t(bar, 2), 0.42);
        [1, 3].forEach(b => { noise(t(bar, b), 0.32, { vol: 0.07, type: 'bandpass', f: 1500, q: 0.8, verb: 0.9 }); });
        for (let k = 0; k < 8; k++) noise(t(bar, k / 2), 0.05, { vol: k % 2 ? 0.02 : 0.012, f: 9000, pan: 0.2 });
      }
    } else {
      kick(t(bar, 0), 0.22); kick(t(bar, 2.5), 0.14);
      const clave = bar % 2 === 0 ? [0, 1.5, 3] : [1, 2.5];
      clave.forEach(b => noise(t(bar, b), 0.05, { vol: 0.05, type: 'bandpass', f: 2600, q: 4, pan: -0.25, verb: 0.15 }));
      for (let k = 0; k < 8; k++) noise(t(bar, k / 2), 0.06, { vol: k % 2 ? 0.014 : 0.009, f: 7500, pan: 0.3 });
    }
  }
  const buf = await ctx.startRendering();
  // Fold the tail (reverb and delay ringing past the end) back onto the start: a seamless loop.
  const loopN = Math.round(loopSec * SR), res = [];
  let peak = 0;
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c), o = new Float32Array(loopN);
    for (let i = 0; i < loopN; i++) o[i] = d[i];
    for (let i = loopN; i < d.length; i++) o[i - loopN] += d[i];
    if (song.style === 'cozy') {
      // A touch of SNES-era grit: blend in a 7-bit, half-sample-rate copy.
      let held = 0;
      for (let i = 0; i < loopN; i++) { if (i % 2 === 0) held = Math.round(o[i] * 2 * 64) / 64 / 2; o[i] = o[i] * 0.75 + held * 0.25; }
    }
    for (let i = 0; i < loopN; i++) peak = Math.max(peak, Math.abs(o[i]));
    res.push(o);
  }
  const gain = 0.89 / peak;
  const b64 = arr => { const i16 = new Int16Array(arr.length); for (let i = 0; i < arr.length; i++) i16[i] = Math.max(-32767, Math.min(32767, Math.round(arr[i] * gain * 32767))); let s = ''; const u8 = new Uint8Array(i16.buffer); for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  return { sr: SR, frames: loopN, seconds: loopSec, L: b64(res[0]), R: b64(res[1]), peak };
}
