import { parse } from "acorn";

/**
 * Deep, engine-backed validation of generated Strudel — the supreme "does it
 * actually build" gate, beyond the static checks in strudel-validate.ts.
 *
 * The Cloudflare Workers runtime forbids eval/new Function, so we can't fully
 * EVALUATE a pattern there — but Strudel's TRANSPILER (acorn parse + the
 * mini-notation parser + escodegen) runs WITHOUT eval, so it catches real JS
 * syntax errors AND mini-notation errors (e.g. "[c e g" — unbalanced) that a
 * plain acorn parse misses. We also derive an authoritative function whitelist
 * from the live engine (Pattern.prototype + the registered scope) to flag
 * undefined/hallucinated functions (which are valid JS, so acorn passes them).
 *
 * The engine's eager @kabelsalat/web import is aliased to a stub so @strudel/core
 * loads headless (see workflows/wrangler.jsonc + vite.config.ts). If the engine
 * fails to load for any reason, we degrade gracefully (ok:null) and rely on the
 * static validator.
 */

type Transpiler = (input: string, options?: Record<string, unknown>) => unknown;

let enginePromise: Promise<{ transpiler: Transpiler; api: Set<string> } | null> | null =
  null;

// Common JS methods/globals that legitimately appear, so we don't flag them.
const JS_ALLOW = new Set(
  "map filter reduce forEach slice splice concat join push pop shift unshift indexOf includes split replace replaceAll match test toFixed toString toLowerCase toUpperCase trim charAt substring substr padStart padEnd repeat startsWith endsWith keys values entries from of isArray floor ceil round abs min max pow sqrt random sin cos log exp sign trunc parseInt parseFloat isNaN isFinite".split(
    " ",
  ),
);

async function engine() {
  if (!enginePromise) {
    enginePromise = (async () => {
      try {
        const core = (await import("@strudel/core")) as unknown as {
          evalScope: (...a: unknown[]) => Promise<unknown>;
          Pattern?: { prototype: object };
        };
        const mini = (await import("@strudel/mini")) as unknown as {
          miniAllStrings?: () => void;
        };
        const tonal = await import("@strudel/tonal");
        // evalScope registers the API (note, s, setcpm, stack, samples, …) onto
        // the GLOBAL scope — so capture exactly what it adds via a before/after
        // diff. That's the authoritative top-level function list (module exports
        // alone miss runtime-registered ones like setcpm).
        const before = new Set(Object.getOwnPropertyNames(globalThis));
        await core.evalScope(core, mini, tonal);
        mini.miniAllStrings?.();
        const { transpiler } = (await import("@strudel/transpiler")) as unknown as {
          transpiler: Transpiler;
        };
        const api = new Set<string>();
        for (const k of Object.getOwnPropertyNames(globalThis)) {
          if (!before.has(k)) api.add(k);
        }
        const proto = core.Pattern?.prototype;
        if (proto) {
          for (const k of Object.getOwnPropertyNames(proto)) api.add(k);
        }
        for (const mod of [core, mini, tonal] as Record<string, unknown>[]) {
          for (const k of Object.keys(mod)) api.add(k);
        }
        return { transpiler, api };
      } catch (e) {
        console.error("[klappn] strudel engine load failed:", (e as Error)?.message);
        return null;
      }
    })();
  }
  return enginePromise;
}

export interface DeepResult {
  ok: boolean | null; // null = engine unavailable, skip
  errors: string[];
  warnings: string[];
}

/**
 * Recursively collect every called METHOD name (`.foo(...)`) from an acorn AST.
 * We deliberately skip top-level function identifiers (`setcpm(...)`, `s(...)`):
 * those are registered onto the global scope by the web layer (which we don't
 * load headless), so the headless API set lacks them and they'd false-positive.
 * Methods live on Pattern.prototype, which IS captured — so `.gain`/`.voicing`
 * validate cleanly while a hallucinated `.totallyFakeMethod` is caught.
 */
function collectMethodCallees(node: unknown, out: Set<string>): void {
  if (!node || typeof node !== "object") return;
  const n = node as Record<string, unknown>;
  if (n.type === "CallExpression") {
    const callee = n.callee as Record<string, unknown> | undefined;
    if (callee?.type === "MemberExpression") {
      const prop = callee.property as Record<string, unknown> | undefined;
      if (prop && callee.computed !== true && typeof prop.name === "string")
        out.add(prop.name);
    }
  }
  for (const key of Object.keys(n)) {
    const v = n[key];
    if (Array.isArray(v)) for (const c of v) collectMethodCallees(c, out);
    else if (v && typeof v === "object") collectMethodCallees(v, out);
  }
}

export async function deepValidate(code: string): Promise<DeepResult> {
  const eng = await engine();
  if (!eng) return { ok: null, errors: [], warnings: [] };
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Transpile — catches JS syntax AND mini-notation errors (no eval needed).
  try {
    eng.transpiler(code, {});
  } catch (e) {
    const msg = String((e as Error)?.message || e).slice(0, 200);
    errors.push(`won't build: ${msg}`);
    // If it doesn't even transpile, the callee scan below is unreliable — stop.
    return { ok: false, errors, warnings };
  }

  // 2. Undefined functions — valid JS, so the transpiler/acorn pass them, but
  //    they crash at play time. Flag any callee not in the engine's API surface.
  try {
    const ast = parse(code, { ecmaVersion: 2022, sourceType: "module" });
    const methods = new Set<string>();
    collectMethodCallees(ast, methods);
    for (const name of methods) {
      if (!eng.api.has(name) && !JS_ALLOW.has(name) && name.length > 1) {
        warnings.push(
          `".${name}(...)" is not a real Strudel method — it will crash or be ignored; remove it or use a valid one`,
        );
      }
    }
  } catch {
    /* syntax already covered by transpile */
  }

  return { ok: errors.length === 0, errors, warnings };
}
