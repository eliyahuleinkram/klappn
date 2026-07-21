/**
 * EVAL-FREE Strudel interpreter — turns a loop's code into real @strudel Patterns
 * WITHOUT eval/new Function, so it runs in the Cloudflare Workers sandbox (which
 * blocks eval). The Strudel engine itself (@strudel/core, /mini, /tonal) is pure
 * JS — only the official transpiler's last step uses eval to run the transpiled
 * string. We replace THAT step with a small AST interpreter (over acorn's parse)
 * that walks the tree and calls the real, normally-imported Strudel functions.
 * It's also SAFER than eval: only whitelisted Strudel functions can run.
 *
 * Replicates the two transpiler behaviours that matter for us:
 *  - "miniAllStrings": every string literal becomes a mini(...) pattern.
 *  - "$:" labeled statements are the layers (a muted "_$:" is skipped).
 *
 * The @strudel engine is loaded LAZILY via dynamic import and wrapped in a
 * try/catch: if it can't load in this runtime, every entry point degrades to an
 * empty result rather than throwing — analysis is optional and must NEVER break
 * generation. All entry points are async for that reason.
 */
import { parse } from "acorn";
import { intrinsicLoudness, filterWeight } from "./loudness";
import { keyPitchClasses, noteToPc, pcName } from "./harmony-key";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

export interface Pattern {
  queryArc: (begin: number, end: number) => Hap[];
}
export interface Hap {
  whole?: { begin: number; end: number } | null;
  part: { begin: number; end: number };
  value: Record<string, unknown> | number | string;
}

interface Engine {
  scope: Record<string, Any>; // whitelisted global identifiers
  mini: (s: string) => Any; // string-literal → mini pattern
  stack: (...p: Any[]) => Any;
  methods: Set<string>; // every REAL Pattern method (controls + transforms + aliases)
}

let enginePromise: Promise<Engine | null> | null = null;
/** Load @strudel/{core,mini,tonal} once, lazily. Returns null (logged) if it
 *  can't run here — callers then degrade gracefully. */
function getEngine(): Promise<Engine | null> {
  if (!enginePromise) {
    enginePromise = (async () => {
      try {
        // @ts-ignore — @strudel/* ship no type declarations
        const core = await import("@strudel/core");
        // @ts-ignore — no type declarations
        const miniMod = await import("@strudel/mini");
        // @ts-ignore — no type declarations
        const tonal = await import("@strudel/tonal");
        const scope: Record<string, Any> = Object.assign(
          Object.create(null),
          core,
          tonal,
        );
        for (const k of [
          "setcpm", "setcps", "setcpb", "hush", "samples", "initHydra",
        ]) {
          scope[k] = () => undefined;
        }
        const mini = (miniMod as Any).mini;
        // Enumerate every real Pattern method (controls + transforms + aliases) by
        // walking the prototype chain of a real Pattern. core + tonal both register
        // onto the SAME Pattern.prototype (deduped), so this is the authoritative
        // "is this a real Strudel function?" set — the source of truth for the gate.
        const methods = new Set<string>();
        try {
          const sample = mini("c");
          for (let o = sample; o && o !== Object.prototype; o = Object.getPrototypeOf(o))
            for (const k of Object.getOwnPropertyNames(o))
              if (typeof sample[k] === "function") methods.add(k);
        } catch {
          /* leave empty → the gate no-ops rather than risk a false positive */
        }
        return {
          scope,
          mini,
          stack: (core as Any).stack,
          methods,
        };
      } catch (e) {
        console.error("[klappn] strudel interpreter engine unavailable", e);
        return null;
      }
    })();
  }
  return enginePromise;
}

interface Ctx {
  scope: Record<string, Any>;
  mini: (s: string) => Any;
}

/** Evaluate an argument / array-element list, expanding any `...spread`. Songs
 *  compiled by the retired Tidal→Strudel path carry spreads in their arp code
 *  (`seq(...h)`, `[...h].reverse()`, …), so the interpreter must understand them
 *  or it throws "unsupported node: SpreadElement" when Strudel queries the arp
 *  callback. */
function evalElems(nodes: Any[], env: Record<string, Any>, ctx: Ctx): Any[] {
  const out: Any[] = [];
  for (const n of nodes) {
    if (n == null) {
      out.push(undefined); // array hole, e.g. [a, , b]
    } else if (n.type === "SpreadElement") {
      const v = evalNode(n.argument, env, ctx);
      if (v && typeof (v as Any)[Symbol.iterator] === "function")
        for (const el of v as Iterable<Any>) out.push(el);
      else if (v != null) out.push(v);
    } else {
      out.push(evalNode(n, env, ctx));
    }
  }
  return out;
}

function evalNode(node: Any, env: Record<string, Any>, ctx: Ctx): Any {
  switch (node.type) {
    case "Literal":
      return typeof node.value === "string" ? ctx.mini(node.value) : node.value;
    case "TemplateLiteral":
      if (node.expressions.length === 0)
        return ctx.mini(node.quasis[0].value.cooked ?? "");
      throw new Error("template literal with interpolation");
    case "Identifier": {
      if (node.name in env) return env[node.name];
      if (node.name in ctx.scope) return ctx.scope[node.name];
      throw new Error(`unknown identifier "${node.name}"`);
    }
    case "ArrayExpression":
      return evalElems(node.elements, env, ctx);
    case "UnaryExpression": {
      const v = evalNode(node.argument, env, ctx);
      if (node.operator === "-") return -v;
      if (node.operator === "+") return +v;
      if (node.operator === "!") return !v;
      throw new Error(`unary ${node.operator}`);
    }
    case "BinaryExpression": {
      const l = evalNode(node.left, env, ctx);
      const r = evalNode(node.right, env, ctx);
      switch (node.operator) {
        case "+": return l + r;
        case "-": return l - r;
        case "*": return l * r;
        case "/": return l / r;
        case "%": return l % r;
        case "**": return l ** r;
        default: throw new Error(`binary ${node.operator}`);
      }
    }
    case "CallExpression": {
      const args = evalElems(node.arguments, env, ctx);
      if (node.callee.type === "MemberExpression") {
        const obj = evalNode(node.callee.object, env, ctx);
        const prop = node.callee.computed
          ? evalNode(node.callee.property, env, ctx)
          : node.callee.property.name;
        const fn = obj?.[prop];
        if (typeof fn !== "function")
          throw new Error(`.${String(prop)} is not a method`);
        return fn.apply(obj, args);
      }
      const fn = evalNode(node.callee, env, ctx);
      if (typeof fn !== "function") throw new Error("call of non-function");
      return fn(...args);
    }
    case "MemberExpression": {
      const obj = evalNode(node.object, env, ctx);
      const prop = node.computed
        ? evalNode(node.property, env, ctx)
        : node.property.name;
      return obj?.[prop];
    }
    case "ArrowFunctionExpression":
    case "FunctionExpression":
      return (...args: Any[]) => {
        const child: Record<string, Any> = Object.create(env);
        node.params.forEach((p: Any, i: number) => {
          if (p.type === "Identifier") child[p.name] = args[i];
        });
        if (node.body.type === "BlockStatement") {
          for (const st of node.body.body) {
            if (st.type === "ReturnStatement")
              return st.argument ? evalNode(st.argument, child, ctx) : undefined;
            evalNode(st, child, ctx);
          }
          return undefined;
        }
        return evalNode(node.body, child, ctx);
      };
    case "ConditionalExpression":
      return evalNode(node.test, env, ctx)
        ? evalNode(node.consequent, env, ctx)
        : evalNode(node.alternate, env, ctx);
    case "ExpressionStatement":
      return evalNode(node.expression, env, ctx);
    case "ParenthesizedExpression":
      return evalNode(node.expression, env, ctx);
    default:
      throw new Error(`unsupported node: ${node.type}`);
  }
}

const isPattern = (v: Any): v is Pattern =>
  !!v && typeof v.queryArc === "function";

export interface InterpResult {
  layers: Pattern[];
  errors: string[];
}

/** Interpret a loop's code into one Pattern per `$:` layer. Top-level `const`
 *  declarations (the @controls sliders) are bound first so layers can reference
 *  them. Comment blocks (@controls/@hydra) are ignored by the parser. */
export async function evalStrudelLayers(code: string): Promise<InterpResult> {
  const layers: Pattern[] = [];
  const errors: string[] = [];
  const eng = await getEngine();
  if (!eng) return { layers, errors: ["engine unavailable"] };
  const ctx: Ctx = { scope: eng.scope, mini: eng.mini };

  let ast: Any;
  try {
    ast = parse(code, { ecmaVersion: 2022, sourceType: "module" });
  } catch (e) {
    return { layers, errors: [`parse: ${(e as Error).message.split("\n")[0]}`] };
  }

  // Bind top-level const/let declarations (the parameterized control values).
  const env: Record<string, Any> = Object.create(null);
  for (const st of ast.body) {
    if (st.type === "VariableDeclaration") {
      for (const d of st.declarations) {
        if (d.id.type === "Identifier") {
          try {
            env[d.id.name] = d.init ? evalNode(d.init, env, ctx) : undefined;
          } catch {
            /* a control we can't eval — leave undefined; layer may still work */
          }
        }
      }
    }
  }

  for (const st of ast.body) {
    try {
      if (st.type === "LabeledStatement") {
        if (st.label.name !== "$") continue; // muted (_$) or other labels
        const v = evalNode(st.body, env, ctx);
        if (isPattern(v)) layers.push(v);
        else
          // The browser compiles `$:` to `<expr>.p('$')` — a non-pattern here (e.g. a bare
          // hallucinated property that read as undefined) crashes the WHOLE loop at play
          // time. Report it exactly as the browser would ("Cannot read properties of…").
          errors.push(
            `a "$:" layer evaluates to ${v === undefined ? "undefined" : typeof v}, not a pattern — at play time this is undefined.p('$'), "Cannot read properties of undefined"; the whole loop crashes`,
          );
      } else if (st.type === "ExpressionStatement") {
        const v = evalNode(st, env, ctx); // setcpm/hush no-op; pattern → a layer
        if (isPattern(v)) layers.push(v);
      }
    } catch (e) {
      errors.push((e as Error).message.split("\n")[0]);
    }
  }
  return { layers, errors };
}

/** The TRUE loop length, in CYCLES: how many cycles play before the whole
 *  pattern repeats identically. Unlike the regex estimate (computeLoopBars), this
 *  WATCHES THE ACTUAL EVENTS — so a loop whose layers vary cycle-to-cycle (a
 *  5-step <...> melody, a .slow(3) pad, a once-per-loop bed) is measured at its
 *  real period: the LCM of every layer's period, not just the first cycle.
 *  Continuous controls (sine/saw LFOs on gain/lpf/pan) are IGNORED — only note
 *  ONSETS and their discrete note/sound identity define the structural loop, so a
 *  slowly-swelling pad doesn't get counted as "always changing". Returns null if
 *  nothing could be measured (caller falls back to the regex estimate). */
export async function loopCycles(
  code: string,
  max = 32,
): Promise<number | null> {
  const { layers } = await evalStrudelLayers(code);
  if (!layers.length) return null;
  const sig = (layer: Pattern, c: number): string =>
    layer
      .queryArc(c, c + 1)
      .filter((h) => h.whole != null && h.whole.begin >= c && h.whole.begin < c + 1)
      .map((h) => {
        const b = (h.whole as { begin: number }).begin - c;
        const v = h.value;
        const id =
          v != null && typeof v === "object"
            ? String(
                (v as Record<string, unknown>).note ??
                  (v as Record<string, unknown>).n ??
                  (v as Record<string, unknown>).s ??
                  "",
              )
            : String(v);
        return `${b.toFixed(4)}:${id}`;
      })
      .sort()
      .join("|");
  const periodOf = (layer: Pattern): number | null => {
    for (let p = 1; p <= max; p++) {
      let ok = true;
      for (let c = 0; c < p * 2 && ok; c++)
        if (sig(layer, c) !== sig(layer, c + p)) ok = false;
      if (ok) return p;
    }
    return null;
  };
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
  const lcm = (a: number, b: number): number => (a * b) / gcd(a, b);
  let total = 1;
  let measured = false;
  for (const layer of layers) {
    const p = periodOf(layer);
    if (p) {
      total = lcm(total, p);
      measured = true;
    }
  }
  // Cap the reported loop at a sane musical length. Raised 16→32 so a genuinely long,
  // developed loop (24/32 bars) plays + shows in full rather than being truncated mid-
  // phrase ("squashed"). A number beyond 32 means layers have mismatched bar counts
  // (e.g. a 10-bar kick against 8-bar everything) and drift — the "loop" technically
  // repeats only after dozens of bars, which is wrong to display (422s) and a sign the
  // generation mis-aligned. Clamp so the UI + playhead never show an absurd duration.
  return measured ? Math.min(total, 32) : null;
}

/** Scan code for every `.name(` method CALL, skipping string/comment content so
 *  we never flag text inside a mini-notation string or a comment. */
function scanMethodCalls(code: string): string[] {
  const out: string[] = [];
  let inStr = false,
    q = "",
    inLine = false,
    inBlock = false;
  for (let i = 0; i < code.length; i++) {
    const c = code[i],
      n = code[i + 1];
    if (inLine) {
      if (c === "\n") inLine = false;
      continue;
    }
    if (inBlock) {
      if (c === "*" && n === "/") {
        inBlock = false;
        i++;
      }
      continue;
    }
    if (inStr) {
      if (c === q && code[i - 1] !== "\\") inStr = false;
      continue;
    }
    if (c === "/" && n === "/") {
      inLine = true;
      i++;
      continue;
    }
    if (c === "/" && n === "*") {
      inBlock = true;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      inStr = true;
      q = c;
      continue;
    }
    if (c === ".") {
      let j = i + 1;
      while (j < code.length && /\s/.test(code[j])) j++;
      if (!/[A-Za-z_$]/.test(code[j] ?? "")) continue; // a decimal point (.5) → skip
      let k = j;
      while (k < code.length && /[\w$]/.test(code[k])) k++;
      const name = code.slice(j, k);
      let p = k;
      while (p < code.length && /\s/.test(code[p])) p++;
      if (code[p] === "(") out.push(name); // only METHOD CALLS, not property reads
    }
  }
  return out;
}

/** Chained methods that AREN'T real Strudel functions — the cause of a runtime
 *  "X is not a function" crash at play time (e.g. a hallucinated `.duckrelease()`).
 *  Validated against the real engine's full method set, so it can't drift and has
 *  no false positives. Returns [] if the engine can't load (gate degrades safely).
 *  This is the Strudel twin of hydra-check's unknownHydraFns. */
/** The time-ordered (cycle-time, note) events a SINGLE-LAYER program actually
 *  plays across `cycles` cycles — the deterministic ground truth for verifying
 *  a rendered LEAD against its lead sheet. Null when the program can't be
 *  evaluated here or isn't exactly one layer. */
export async function leadEvents(
  code: string,
  cycles: number,
): Promise<{ t: number; note: string }[] | null> {
  const { layers } = await evalStrudelLayers(code);
  if (layers.length !== 1) return null;
  const out: { t: number; note: string }[] = [];
  for (let c = 0; c < cycles; c++) {
    for (const h of layers[0].queryArc(c, c + 1)) {
      if (!h.whole || h.whole.begin < c || h.whole.begin >= c + 1) continue;
      const v = h.value;
      const raw =
        v != null && typeof v === "object"
          ? ((v as Record<string, unknown>).note ?? (v as Record<string, unknown>).n)
          : v;
      if (raw == null) continue;
      out.push({ t: h.whole.begin, note: String(raw) });
    }
  }
  out.sort((a, b) => a.t - b.t);
  return out;
}

export async function unknownStrudelMethods(code: string): Promise<string[]> {
  const eng = await getEngine();
  if (!eng || eng.methods.size === 0) return [];
  const bad = new Set<string>();
  for (const name of scanMethodCalls(code))
    if (!eng.methods.has(name)) bad.add(name);
  return [...bad];
}

/** BUILD each layer with the real engine and surface any that THROWS — i.e. would
 *  crash at PLAY TIME, which the static method scan can't see because the method is
 *  real and it's called on a non-pattern. Catches the classics:
 *   • "X.fast is not a function" — arrange([n, 0], …) / a bare number where a
 *     pattern is expected (arrange calls .fast() on each section).
 *   • a malformed mini string like "[bd*4]!>8" (replicate/slowcat transposed).
 *  Returns ONLY unambiguous runtime-crash / parse classes (never a valid layer on
 *  an interpreter quirk), and [] when the engine can't load (local Node degrades
 *  safely; Workers loads it). The play-time twin of unknownStrudelMethods. */
export async function strudelBuildErrors(code: string): Promise<string[]> {
  const { errors } = await evalStrudelLayers(code);
  // `parse error` / `[mini]` are the mini-notation parse class (e.g. a `|` used as a
  // bar separator inside `<…>` → "[mini] parse error at line N: … but '|' found").
  // These are NOT redundant with the JS-crash patterns: validateStrudel's acorn parse
  // treats mini as opaque strings, so a layer that can't parse mini ONLY surfaces here,
  // via the real engine. Dropping them re-opens the gap that shipped an unplayable loop.
  const CRASH =
    /is not a function|is not defined|cannot read|undefined is not|reading ['"]|unexpected token|maximum call stack|parse:|parse error|\[mini\]/i;
  return errors.filter((e) => !!e && !/engine unavailable/i.test(e) && CRASH.test(e));
}

/** THE SERVER-SIDE EVAL EQUIVALENT for Strudel (2026-07-02, the user: "caught before it even
 *  hits the browser"): the real headless BUILD (strudelBuildErrors — everything that throws)
 *  PLUS the browser-resolution checks (validateStrudel — sounds/banks that resolve to nothing,
 *  mini grammar, chords that collapse silent, NaN args). Together they mirror what the browser
 *  would throw or silently fail on. Deduped. */
export async function strudelServerErrors(
  code: string,
  ctx?: { bpm?: number; timeSignature?: string | null },
): Promise<string[]> {
  const { validateStrudel } = await import("./strudel-validate");
  const v = validateStrudel(
    code,
    ctx?.bpm ? { bpm: ctx.bpm, timeSignature: ctx.timeSignature ?? undefined } : undefined,
  );
  const build = await strudelBuildErrors(code);
  return [...new Set([...v.errors, ...build])];
}

/** The whole loop as one stacked Pattern (or null if nothing interpreted). */
export async function evalStrudel(code: string): Promise<Pattern | null> {
  const eng = await getEngine();
  if (!eng) return null;
  const { layers } = await evalStrudelLayers(code);
  if (!layers.length) return null;
  if (layers.length === 1) return layers[0];
  return eng.stack(...layers) as Pattern;
}

export interface LayerTiming {
  sound: string; // the instrument/drum this layer plays
  hitsPerBar: number; // onset density
  gain: number; // resolved average gain (1 = unity)
  notes: string[]; // distinct pitches/chords heard (melodic layers)
  silent: boolean; // produced no events
  loudnessPct: number; // ESTIMATED share of the mix's loudness (0-100)
  peak: number; // estimated peak amplitude (for clip-headroom)
}

const NUM = (v: Any): v is number => typeof v === "number" && Number.isFinite(v);
const numOr = (v: Any, d: number): number => (NUM(v) ? v : d);

/** A symbolic, eval-free "how it actually plays + how it sits in the mix" picture
 *  — resolved from the real events, not guessed from the code. Per layer: what it
 *  plays, how OFTEN, its pitch content, and an ESTIMATED loudness share (intrinsic
 *  sound level × gain × duration × filter). Catches sparse/silent layers, lopsided
 *  balance, and clip risk. Empty (graceful) if the engine is unavailable. */
export async function analyzeTiming(
  code: string,
  opts: { cycles?: number; key?: string } = {},
): Promise<{ layers: LayerTiming[]; summary: string }> {
  const cycles = opts.cycles ?? 8;
  const keyInfo = opts.key ? keyPitchClasses(opts.key) : null;
  const outOfKey = new Set<number>();
  const { layers } = await evalStrudelLayers(code);
  const out: LayerTiming[] = [];
  const energy: number[] = []; // per-layer summed energy (∝ loudness²)
  for (const layer of layers) {
    let haps: Hap[] = [];
    try {
      haps = layer.queryArc(0, cycles);
    } catch {
      continue;
    }
    const onsets = haps.filter(
      (h) => h.whole && Number(h.part.begin) === Number(h.whole.begin),
    );
    const val0 = (onsets[0]?.value ?? {}) as Record<string, unknown>;
    const sound = String(
      val0.s ?? val0.sound ?? (val0.note != null ? "synth" : "?"),
    );
    const base = intrinsicLoudness(sound);
    let gainSum = 0;
    let e = 0;
    let peak = 0;
    for (const h of onsets) {
      const v = h.value as Record<string, unknown>;
      const g = numOr(v?.gain, 1) * numOr(v?.postgain, 1);
      gainSum += g;
      const amp = base * g * numOr(v?.velocity, 1) * filterWeight(v?.cutoff);
      const dur = h.whole
        ? Math.max(0, Number(h.whole.end) - Number(h.whole.begin))
        : 0;
      e += amp * amp * dur;
      if (amp > peak) peak = amp;
      // resolved-harmony: flag any actual pitch outside the stated key
      if (keyInfo && v?.note != null) {
        const pc = noteToPc(v.note as string | number);
        if (pc != null && !keyInfo.pcs.has(pc)) outOfKey.add(pc);
      }
    }
    const notes = [
      ...new Set(
        onsets
          .map((h) => (h.value as Record<string, unknown>)?.note)
          .filter((n) => n != null)
          .map(String),
      ),
    ].slice(0, 10);
    energy.push(e / cycles);
    out.push({
      sound,
      hitsPerBar: Math.round((onsets.length / cycles) * 10) / 10,
      gain: onsets.length
        ? Math.round((gainSum / onsets.length) * 100) / 100
        : 1,
      notes,
      silent: onsets.length === 0,
      loudnessPct: 0,
      peak: Math.round(peak * 100) / 100,
    });
  }
  // Normalise loudness to a share of the whole mix (rms ∝ sqrt(energy)).
  const rms = energy.map((x) => Math.sqrt(x));
  const total = rms.reduce((a, b) => a + b, 0) || 1;
  out.forEach((l, i) => (l.loudnessPct = Math.round((rms[i] / total) * 100)));
  const peakSum = out.reduce((a, l) => a + l.peak, 0);

  const lines = out.map((l, i) => {
    if (l.silent)
      return `- layer ${i + 1} (${l.sound}): SILENT — produces no events`;
    const dens =
      l.hitsPerBar < 0.5 ? " (very sparse)" : l.hitsPerBar >= 8 ? " (busy)" : "";
    const notes = l.notes.length ? ` · notes ${l.notes.join(" ")}` : "";
    const bal =
      l.loudnessPct < 5
        ? " ⚠ may be buried"
        : l.loudnessPct >= 45
          ? " ⚠ dominates the mix"
          : "";
    return `- layer ${i + 1}: ${l.sound} · ${l.hitsPerBar} hits/bar${dens} · gain ${l.gain} · ~${l.loudnessPct}% of mix${bal}${notes}`;
  });
  // The master limiter handles real clipping, so only flag a mix that's so hot
  // it'll audibly squash/pump — not a normal mix that merely sums past 1.0.
  const clip =
    peakSum > 3.2
      ? `\nmix is VERY hot (peak≈${peakSum.toFixed(1)}) — gains are likely too high and the limiter will squash; lower some.`
      : "";
  const harmony =
    keyInfo && outOfKey.size
      ? `\nout-of-key pitches vs ${keyInfo.name}: ${[...outOfKey]
          .sort((a, b) => a - b)
          .map(pcName)
          .join(", ")} — verify intentional (a passing/chromatic note can be fine; a wrong root is not).`
      : "";
  const summary =
    (lines.join("\n") || "(no layers resolved)") + clip + harmony;
  return { layers: out, summary };
}

/** Note/n values that resolve to an OBJECT instead of a number/string — they crash
 *  superdough at play time with `getTrigger error: unexpected "note" type "object"`.
 *  The cause is wrapping an ALREADY-noted pattern in note()/.note() again — e.g.
 *  note(chord(...).voicing()), n(...).scale(...).note(), stack(notePatterns).note().
 *  Detected by RENDERING the real events and inspecting each note value, so it can't
 *  be fooled by how the code is written. Returns the 1-based layer numbers affected
 *  (empty if clean or if the engine can't render). */
export async function unplayableNoteLayers(code: string): Promise<number[]> {
  const { layers } = await evalStrudelLayers(code);
  const bad: number[] = [];
  layers.forEach((layer, i) => {
    try {
      const objNote = layer.queryArc(0, 2).some((h) => {
        const v = h.value as Record<string, unknown> | undefined;
        const nv = v?.note ?? (v as Record<string, unknown>)?.n;
        return nv != null && typeof nv === "object";
      });
      if (objNote) bad.push(i + 1);
    } catch {
      /* a layer that can't render here — other gates handle it */
    }
  });
  return bad;
}
