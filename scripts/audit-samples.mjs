/**
 * SAMPLE AUDIT — does every sound name resolve the same here as on strudel.cc?
 *
 * Reads strudel.cc's own prebake (codeberg.org/uzu/strudel,
 * website/src/repl/prebake.mjs) and rebuilds the sound dictionary it produces,
 * then rebuilds ours from the same manifests through /api/snd, and diffs.
 *
 * Run: node scripts/audit-samples.mjs   (needs network)
 *
 * Klappn deliberately loads MORE than strudel.cc — the full Dirt-Samples
 * library is the palette the composer writes from — so "only in klappn" is
 * expected and reported separately. The failures that matter are:
 *   · a name strudel.cc has and we don't      → a patch goes silent here
 *   · a name we both have, resolved DIFFERENTLY → same code, different sound
 * The second one is what made `s("hh:<2 4 5 6>")` play kick drums.
 */
const CDN = "https://strudel.b-cdn.net";
const DIRT = "https://cdn.jsdelivr.net/gh/tidalcycles/Dirt-Samples@master";

const j = async (u) => (await fetch(u)).json();
const norm = (k) => k.toLowerCase().replace(/\s+/g, "_");
/** basename only — the two sides serve the same files from different mirrors */
const leaf = (u) => String(u).split("/").slice(-2).join("/").replace(/%20/g, " ");

function flatten(map) {
  const out = {};
  for (const [k, v] of Object.entries(map)) {
    if (k === "_base") continue;
    if (Array.isArray(v)) out[norm(k)] = v.map(leaf);
    else if (v && typeof v === "object")
      out[norm(k)] = Object.values(v).flat().map(leaf);
  }
  return out;
}

// ---- strudel.cc ------------------------------------------------------------
const prebakeSrc = await (
  await fetch("https://codeberg.org/uzu/strudel/raw/branch/main/website/src/repl/prebake.mjs")
).text();
const inline = new Function(
  "return {" +
    prebakeSrc.match(/samples\(\s*\{([\s\S]*?)\},\s*`\$\{baseCDN\}\/Dirt-Samples\//)[1] +
    "}",
)();

const cc = {};
// registration order as written in their prebake; later wins
for (const m of ["piano", "vcsl", "tidal-drum-machines", "uzu-drumkit", "uzu-wavetables", "mridangam"]) {
  Object.assign(cc, flatten(await j(`${CDN}/${m}.json`)));
}
Object.assign(cc, flatten(inline));

// ---- klappn ----------------------------------------------------------------
// MANIFEST_ORDER in lib/zaltz.ts: bulk library first, curated kits last.
const ours = {};
Object.assign(ours, flatten(await j(`${DIRT}/strudel.json`)));
for (const m of ["piano", "vcsl", "mridangam", "tidal-drum-machines", "uzu-wavetables", "uzu-drumkit"]) {
  Object.assign(ours, flatten(await j(`${CDN}/${m}.json`)));
}

// ---- diff ------------------------------------------------------------------
const missing = [];
const differs = [];
for (const [name, ccList] of Object.entries(cc)) {
  const mine = ours[name];
  if (!mine) {
    missing.push(name);
    continue;
  }
  const same = mine.length === ccList.length && mine.every((u, i) => u === ccList[i]);
  if (!same) differs.push({ name, cc: ccList, mine });
}
const extra = Object.keys(ours).filter((k) => !(k in cc));

console.log(`strudel.cc names: ${Object.keys(cc).length}   klappn names: ${Object.keys(ours).length}`);
console.log(`\nMISSING here (a patch would go silent): ${missing.length}`);
for (const n of missing.slice(0, 40)) console.log("   ", n);

console.log(`\nRESOLVED DIFFERENTLY (same code, different sound): ${differs.length}`);
for (const d of differs.slice(0, 40)) {
  console.log(`    ${d.name}  cc=${d.cc.length} ours=${d.mine.length}`);
  console.log(`      cc  : ${d.cc.slice(0, 3).join(" ")}`);
  console.log(`      ours: ${d.mine.slice(0, 3).join(" ")}`);
}

console.log(`\nextra in klappn (the wider palette — expected): ${extra.length}`);
process.exit(missing.length + differs.length === 0 ? 0 : 1);
