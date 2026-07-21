// Query a strudel line's haps headlessly. Bundled by hap-dump.build.mjs
// (kabelsalat stub alias — @strudel/core's repl import needs it in Node).
import * as core from "@strudel/core";
import * as mini from "@strudel/mini";
import { transpiler } from "@strudel/transpiler";
await core.evalScope(core, mini);
let pPatterns = {}, cpm = null, anon = 0;
core.Pattern.prototype.p = function (id) {
  let key = String(id);
  if (key.includes("$")) key = key + anon++;
  pPatterns[key] = this;
  return this;
};
globalThis.setcpm = (x) => { cpm = x; };
const code = process.env.CODE;
const cycles = Number(process.env.CYCLES || 1);
const evaled = await core.evaluate(code, transpiler);
const pattern = Object.keys(pPatterns).length ? core.stack(...Object.values(pPatterns)) : (evaled?.pattern ?? evaled);
const cps = (cpm ?? 60) / 60;
const haps = pattern.queryArc(0, cycles, { _cps: cps }).filter((h) => h.hasOnset());
const out = haps.map((h) => {
  h.ensureObjectValue();
  return { value: h.value, begin: h.whole.begin.valueOf() / cps, duration: h.duration.valueOf() / cps };
});
console.log(JSON.stringify({ cps, haps: out }));
