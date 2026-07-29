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
// klappn") — zaltz stays the ENGINE's name (repo/npm); the instrument lives at
// klappn.com/boiler-room (the name IS the address, 07-28), and /engine + /live
// still 301 there (the Reddit links live on).
export const ZALTZ_PLAYGROUND_URL = "https://klappn.com/boiler-room";
// …but the ENGINE has its own front door again (2026-07-29): zaltz.klappn.com
// no longer redirects, it REWRITES to /zaltz — the open-source shop window,
// the shape zissl.klappn.com wears for the picture engine.
export const ZALTZ_SITE_URL = "https://zaltz.klappn.com";

/** ZISSL — the compute swarm that paints the door + the desk's colony. */
export const ZISSL_GITHUB_URL = "https://github.com/eliyahuleinkram/zissl";
export const ZISSL_PLAYGROUND_URL = "https://zissl.klappn.com";
