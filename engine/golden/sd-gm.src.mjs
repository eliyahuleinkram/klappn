// Superdough REFERENCE for gm cases: main-repo @strudel + vendored soundfonts
// (register into the SAME soundMap), rendered headlessly via nwaa.
import * as nwaa from "../../render-service/node_modules/node-web-audio-api/index.js";
for (const k of Object.keys(nwaa)) if (!(k in globalThis)) globalThis[k] = nwaa[k];
globalThis.AudioContext = nwaa.AudioContext;
globalThis.OfflineAudioContext = nwaa.OfflineAudioContext;
globalThis.window = globalThis; globalThis.self = globalThis;
globalThis.addEventListener = () => {}; globalThis.removeEventListener = () => {};
try { if (!globalThis.navigator) globalThis.navigator = { userAgent: "node" }; } catch {}
globalThis.document = { createElement: () => ({ style: {} }), addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; }, body: { appendChild() {} } };
globalThis.CustomEvent = globalThis.CustomEvent || class { constructor(t, o) { this.type = t; Object.assign(this, o); } };
globalThis.Event = globalThis.Event || class { constructor(t) { this.type = t; } };
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
// Sample maps carry ORIGIN-RELATIVE proxy paths (/api/snd/u/…) — give node's
// fetch the deployed origin. Every corpus case spawns fresh children that
// re-fetch the same maps/samples, and the proxy connect-flakes under that
// hammering — so proxy fetches are DISK-CACHED (/tmp/klt/httpcache) with
// retries. Same shim in corpus.mjs and gm-zones.src.mjs.
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
const core = await import("@strudel/core");
const mini = await import("@strudel/mini");
const tonal = await import("@strudel/tonal");
const webaudio = await import("@strudel/webaudio");
const soundfonts = await import("../../lib/vendor/soundfonts/index.mjs");
await core.evalScope(core, mini, tonal, webaudio);
await webaudio.registerSynthSounds?.();
soundfonts.setSoundfontUrl("https://klappn.com/api/snd/f");
soundfonts.registerSoundfonts();
// SAMPLE MAPS: without these, s("bd") etc. resolve to NOTHING and the
// reference renders SILENT (read +150dB in the corpus diff). Same library
// registration as render-service/src/engine.mjs loadSampleLibrary().
{
  const SND = "https://klappn.com/api/snd";
  for (const m of ["d0", "d1", "d2", "d3", "d4", "d5"]) await webaudio.samples(`${SND}/m/${m}.json`);
  if (webaudio.aliasBank) await webaudio.aliasBank(`${SND}/m/a0.json`);
  const lib = await (await fetch(`${SND}/m/lib.json`)).json();
  const base = typeof lib._base === "string" ? lib._base : "";
  delete lib._base;
  await webaudio.samples(lib, base);
}
const { transpiler } = await import("@strudel/transpiler");
let pPatterns = {}, cpm = null, anon = 0;
core.Pattern.prototype.p = function (id) { if (String(id).includes("$")) id = `${id}${anon++}`; pPatterns[id] = this; return this; };
globalThis.setcpm = (x) => { cpm = x; };
const code = process.env.CODE;
const cycles = Number(process.env.CYCLES || 1);
const evaled = await core.evaluate(code, transpiler);
const pattern = Object.keys(pPatterns).length ? core.stack(...Object.values(pPatterns)) : (evaled?.pattern ?? evaled);
const cps = (cpm ?? 60) / 60;
const sr = 48000;
const seconds = cycles / cps + 1.6;
const ctx = new nwaa.OfflineAudioContext(2, Math.ceil(seconds * sr), sr);
// WORKLETS: supersaw + shape/crush/coarse are AudioWorklets in superdough —
// without registering them the reference silently DROPS those layers (the
// corpus's loudest voices). render-service pre-bundles them for nwaa.
try {
  await ctx.audioWorklet.addModule(new URL("../../render-service/dist/worklets.js", import.meta.url).href);
} catch (e) { console.error("worklet addModule failed:", String(e).slice(0, 100)); }
webaudio.setAudioContext(ctx);
webaudio.resetGlobalEffects?.();
webaudio.setSuperdoughAudioController?.(null);
// maxPolyphony HUGE: offline, activeSoundSources never gets cleaned during
// the scheduling loop (cleanup timeouts fire only while rendering), so the
// FIFO steal would stop later-in-time voices of earlier layers — an offline
// artifact the browser never hits (real-time cleanup keeps the set small).
await webaudio.initAudio({ maxPolyphony: 1 << 20, disableWorklets: true });
const haps = pattern.queryArc(0, cycles, { _cps: cps }).filter((h) => h.hasOnset());
// trigger CHRONOLOGICALLY like the browser scheduler — queryArc returns haps
// layer-grouped, which corrupts cross-layer cut-group registry order
haps.sort((a, b) => a.whole.begin.valueOf() - b.whole.begin.valueOf());
for (const h of haps) {
  try {
    h.ensureObjectValue();
    const t = h.whole.begin.valueOf() / cps;
    await webaudio.superdough(h.value, t, h.duration.valueOf() / cps, cps, t);
  } catch (e) { console.error("hap err", String(e).slice(0, 80)); }
}
const buf = await ctx.startRendering();
const L = new Float32Array(buf.length);
buf.copyFromChannel(L, 0);
writeFileSync("/tmp/klt/sdgm.bin", Buffer.from(L.buffer));
console.log(JSON.stringify({ n: L.length }));
