const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  p.on('pageerror', e => console.log('ERR', e));
  await p.setContent('<html><body></body></html>');
  await p.addScriptTag({ path: __dirname + '/songs.js' }); await p.addScriptTag({ path: __dirname + '/render.js' });
  for (const id of process.argv.slice(2)) {
    const r = await p.evaluate(id => renderSong(SONGS[id]), id);
    const L = Buffer.from(r.L, 'base64'), R = Buffer.from(r.R, 'base64'), n = r.frames;
    const data = Buffer.alloc(n * 4); for (let i = 0; i < n; i++) { data.writeInt16LE(L.readInt16LE(i * 2), i * 4); data.writeInt16LE(R.readInt16LE(i * 2), i * 4 + 2); }
    const h = Buffer.alloc(44); h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(r.sr, 24); h.writeUInt32LE(r.sr * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(data.length, 40);
    fs.writeFileSync(`${__dirname}/${id}.wav`, Buffer.concat([h, data]));
    console.log(id, r.seconds.toFixed(2) + 's', 'raw peak', r.peak.toFixed(2));
  }
  await b.close();
})();
