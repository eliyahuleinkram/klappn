/**
 * Loop-code payload sealing — OBFUSCATION, not cryptography.
 *
 * Generated loop code is our leakable output: served as plaintext it can be
 * read in view-source / the network tab and bulk-scraped into a training set.
 * Sealing encodes every code string at the serialization boundary (API
 * responses + server-component props) and decodes it in the client right after
 * parse, so nothing readable crosses the wire. A determined user can still
 * recover it from a debugger — the key ships in the bundle by necessity; the
 * point is that casual inspection and cheap scraping see only opaque blobs.
 *
 * Mechanics: XOR over UTF-8 bytes with a static key, base64url, marker prefix.
 * `openDeep` decodes ONLY marker-prefixed strings and passes everything else
 * through untouched, so it is always safe to apply — to sealed and unsealed
 * payloads alike (rollouts, cached responses, missed routes all degrade
 * gracefully). Isomorphic: btoa/atob + TextEncoder exist in the browser, the
 * workers runtime, and Node 18+.
 */

const MARK = "@k1.";
const KEY = new TextEncoder().encode("klappn-seal-v1");

const xor = (bytes: Uint8Array): Uint8Array => {
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) out[i] = bytes[i] ^ KEY[i % KEY.length];
  return out;
};

/** Encode one string → marker-prefixed opaque blob. */
export function seal(text: string): string {
  const bytes = xor(new TextEncoder().encode(text));
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return MARK + btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Decode one sealed string; non-sealed input passes through unchanged. */
export function open(value: string): string {
  if (!value.startsWith(MARK)) return value;
  try {
    const bin = atob(value.slice(MARK.length).replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(xor(bytes));
  } catch {
    return value; // malformed blob — hand it back rather than throw
  }
}

// The keys whose STRING values carry loop code anywhere in our payloads
// (parts.strudel / original_strudel, tracks[].code / outro.code / sections'
// code, break + transition options[].strudel, and the song's canonical visual
// — plan.visual's hydra sketch + its vcontrols/vlooks specs). `variants` is a
// { pill: code } map, so ALL of its string values are code regardless of key
// name. Library-fingerprint key names are also RENAMED on the wire (and
// restored on open) — an opaque value under a key literally called "strudel"
// would defeat the point.
const CODE_KEYS = new Set([
  "strudel",
  "original_strudel",
  "code",
  "repaired",
  "hydra",
  "vcontrols",
  "vlooks",
]);
const CODE_MAP_KEYS = new Set(["variants"]);
const SEAL_KEY_RENAMES: Record<string, string> = {
  strudel: "z1",
  original_strudel: "z0",
};
const OPEN_KEY_RENAMES: Record<string, string> = Object.fromEntries(
  Object.entries(SEAL_KEY_RENAMES).map(([a, b]) => [b, a]),
);

function walk(
  value: unknown,
  fn: (s: string) => string,
  renames: Record<string, string>,
  codeKeys: Set<string>,
  inCodeMap = false,
): unknown {
  if (typeof value === "string") return value; // bare strings only transform via a matched key
  if (Array.isArray(value)) return value.map((v) => walk(v, fn, renames, codeKeys, inCodeMap));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const key = renames[k] ?? k;
      if (typeof v === "string" && (inCodeMap || codeKeys.has(k))) {
        out[key] = fn(v);
      } else {
        out[key] = walk(v, fn, renames, codeKeys, CODE_MAP_KEYS.has(k));
      }
    }
    return out;
  }
  return value;
}

// Sealing matches the ORIGINAL key names; opening accepts BOTH the wire names
// and the originals (open() is marker-gated, so the union is always safe —
// and a response sealed by an older/newer deploy still opens).
const OPEN_CODE_KEYS = new Set([
  ...CODE_KEYS,
  ...[...CODE_KEYS].map((k) => SEAL_KEY_RENAMES[k] ?? k),
]);

/** Deep-copy `value` with every code-bearing string sealed (and fingerprint
 *  key names swapped for wire names). Apply server-side, right before the
 *  object is serialized (Response.json / client-component props). */
export function sealDeep<T>(value: T): T {
  return walk(value, seal, SEAL_KEY_RENAMES, CODE_KEYS) as T;
}

/** Deep-copy `value` with every sealed string decoded and wire key names
 *  restored (pass-through for everything else — always safe). Apply
 *  client-side, right after parse. */
export function openDeep<T>(value: T): T {
  return walk(value, open, OPEN_KEY_RENAMES, OPEN_CODE_KEYS) as T;
}
