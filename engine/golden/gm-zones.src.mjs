// Fetch gm zones via the vendored (crossfaded) loader; PCM → file, meta → stdout.
import * as nwaa from "../../render-service/node_modules/node-web-audio-api/index.js";
for (const k of Object.keys(nwaa)) if (!(k in globalThis)) globalThis[k] = nwaa[k];
globalThis.AudioContext = nwaa.AudioContext;
globalThis.OfflineAudioContext = nwaa.OfflineAudioContext;
globalThis.window = globalThis; globalThis.self = globalThis;
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
// disk-cached, retrying proxy fetches — same shim as sd-gm.src.mjs (the
// proxy connect-flakes under the corpus's fetch hammering; a bad zone
// fetch here used to surface as NaN PCM downstream)
{
  const _fetch = globalThis.fetch.bind(globalThis);
  const DIR = "/tmp/klt/httpcache";
  mkdirSync(DIR, { recursive: true });
  const keyOf = (u) => DIR + "/" + Buffer.from(u).toString("base64url").slice(0, 200);
  globalThis.fetch = async (url, ...r) => {
    if (typeof url === "string" && url.startsWith("/")) url = "https://klappn.com" + url;
    if (typeof url !== "string" || !url.startsWith("https://klappn.com")) return _fetch(url, ...r);
    const key = keyOf(url);
    if (existsSync(key)) return new Response(readFileSync(key));
    let lastErr;
    for (let a = 0; a < 3; a++) {
      try {
        const res = await _fetch(url, ...r);
        if (!res.ok) throw new Error(`http ${res.status} ${url}`);
        const buf = Buffer.from(await res.arrayBuffer());
        writeFileSync(key, buf);
        return new Response(buf);
      } catch (e) {
        lastErr = e;
        await new Promise((s) => setTimeout(s, 1000 * (a + 1)));
      }
    }
    throw lastErr;
  };
}
import { getFontPitch, setSoundfontUrl } from "../../lib/vendor/soundfonts/fontloader.mjs";
import gm from "../../lib/vendor/soundfonts/gm.mjs";
setSoundfontUrl("https://klappn.com/api/snd/f");
const name = process.env.GM_NAME;
const midis = process.env.GM_MIDIS.split(",").map(Number);
const ctx = new nwaa.OfflineAudioContext(2, 48000, 48000);
const font = gm[name][0];
const meta = [];
const chunks = [];
let off = 0;
for (const midi of midis) {
  const { buffer, zone } = await getFontPitch(font, midi, ctx);
  const ch = Math.min(2, buffer.numberOfChannels);
  const pcm = new Float32Array(buffer.length * ch);
  for (let c = 0; c < ch; c++) {
    const d = buffer.getChannelData(c);
    for (let i = 0; i < buffer.length; i++) pcm[i * ch + c] = d[i];
  }
  chunks.push(Buffer.from(pcm.buffer));
  const baseDetune = zone.originalPitch - 100 * (zone.coarseTune ?? 0) - (zone.fineTune ?? 0);
  const loop = zone.loopStart > 1 && zone.loopStart < zone.loopEnd;
  meta.push({
    off, frames: buffer.length, channels: ch,
    rate: Math.pow(2, (100 * midi - baseDetune) / 1200),
    loop,
    loopBegin: loop ? zone.loopStart / zone.sampleRate / buffer.duration : 0,
    loopEnd: loop ? zone.loopEnd / zone.sampleRate / buffer.duration : 1,
  });
  off += pcm.length;
}
writeFileSync("/tmp/klt/gmzones.bin", Buffer.concat(chunks));
console.log(JSON.stringify(meta));
