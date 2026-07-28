/**
 * COMMUNITY LINKS — the single place the GitHub repo and Discord invite live.
 * Client-safe (no imports).
 *
 * DISCORD_URL stays a PLACEHOLDER until the Discord exists: every surface
 * that renders it checks for "" and hides the link, so the UI lights up the
 * moment a value lands here.
 */
export const GITHUB_URL = "https://github.com/eliyahuleinkram/klappn"; // public since 2026-07-21
export const DISCORD_URL = ""; // e.g. "https://discord.gg/…"

/** ZALTZ — the audio engine, released standalone 2026-07-21. */
export const ZALTZ_GITHUB_URL = "https://github.com/eliyahuleinkram/zaltz";
export const ZALTZ_NPM_URL = "https://www.npmjs.com/package/zaltz";
// The live room merged INTO klappn 2026-07-28 (user: "it is a feature within
// klappn") — zaltz stays the ENGINE's name (repo/npm); the room lives at
// /engine on klappn.com and zaltz.klappn.com 301s there (the Reddit links).
export const ZALTZ_PLAYGROUND_URL = "https://klappn.com/engine";

/** ZISSL — the compute swarm that paints the door + the desk's colony. */
export const ZISSL_GITHUB_URL = "https://github.com/eliyahuleinkram/zissl";
export const ZISSL_PLAYGROUND_URL = "https://zissl.klappn.com";
