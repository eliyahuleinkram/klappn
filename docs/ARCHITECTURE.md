# Klappn — Technical Reference

_A complete pass over the system as it stands at commit `f93fe55` (2026-07-31)._

This document describes what the code actually does: the runtime topology, the
data model, the generation pipeline, the two engines, the playback stack, the
live surfaces, and the operational rules that hold everything together. It is
written for someone who has to change the thing without breaking it.

---

## Table of contents

1. [What Klappn is](#1-what-klappn-is)
2. [Repository layout](#2-repository-layout)
3. [Runtime topology](#3-runtime-topology)
4. [Build & deploy](#4-build--deploy)
5. [Data layer](#5-data-layer)
6. [Identity & auth](#6-identity--auth)
7. [The LLM layer](#7-the-llm-layer)
8. [The generation pipeline](#8-the-generation-pipeline)
9. [Correctness gates](#9-correctness-gates)
10. [Editing paths](#10-editing-paths)
11. [Arrangement & playback](#11-arrangement--playback)
12. [zaltz — the audio engine](#12-zaltz--the-audio-engine)
13. [zissl & visuals](#13-zissl--visuals)
14. [The engine room (live coding)](#14-the-engine-room-live-coding)
15. [Sets, live streaming, takes](#15-sets-live-streaming-takes)
16. [Events & ticketing](#16-events--ticketing)
17. [Billing & metering](#17-billing--metering)
18. [Vocals (dormant)](#18-vocals-dormant)
19. [Security & privacy posture](#19-security--privacy-posture)
20. [Testing & verification](#20-testing--verification)
21. [Operations](#21-operations)
22. [Standing laws](#22-standing-laws)
23. [Module index](#23-module-index)
24. [Known gaps & open items](#24-known-gaps--open-items)

---

## 1. What Klappn is

You type a sentence describing a sound. A frontier model writes it as
[Strudel](https://strudel.cc) live-coding patterns — one playable `$:` layer at a
time — and you get **the code**, not a bounced MP3. From there you can play it,
rearrange it, extend it, edit it in natural language, edit it by hand, take the
lid off and type into it while it plays, and broadcast it to a room.

Three names, one machine:

| Name | Role | Where it lives |
|---|---|---|
| **Klappn** | the studio — describe, compose, arrange, perform | this repo |
| **zaltz** | the sound — one file of freestanding C on the audio thread | `engine/zaltz.c` |
| **zissl** | the light — Hydra's vocabulary rebuilt as WGSL on WebGPU | sibling repo, `file:../zissl` |

The names are a Yiddish pair (_zaltz un tsuker_ — salt and sugar). Both engines
were built the same way: keep a beloved live-coding language, replace the machine
underneath it, hold it to a golden gate against what it replaced, ship only when
the gate is green and the ear agrees. Both are separately released (`npm i
zaltz`, `npm i zissl`) and separately usable.

Three doors into the same machine:

- **klappn.com** — the studio (describe → hits).
- **klappn.com/engine** — the engine room: the lid off, live code on top, your
  hits underneath, sound the moment it lands.
- **zaltz.klappn.com** / **zissl.klappn.com** — the engines' own front doors.

Everything is AGPL-3.0 (Strudel's license family). Pricing is a public constant
in `lib/pricing.ts`. The data deal is stated on `/open`.

---

## 2. Repository layout

```
app/                 vinext App Router — pages + route handlers
  api/               ~55 route handlers (songs, sets, events, billing, rtc, snd, room…)
  song/[id]/         the song page          engine/       the engine room
  set/[id]/          a Set                  boiler-room/  legacy room route (keeps ?s= share tokens)
  e/[token]/         public event page      live/[token]/ public listener page
  zaltz-engine/      zaltz.klappn.com root  zissl/        zissl.klappn.com root
  open/ terms/ privacy/ billing/ claim/ events/ sets/
components/          28 client components (SongClient 7.1k lines, ZaltzIDE 3.8k, SetClient 3.1k)
lib/                 105 modules, ~35k lines — the whole domain
engine/              zaltz.c (2.4k lines C), zaltz.worklet.js, build.sh, golden/ harnesses
workflows/           the SEPARATE Cloudflare Worker hosting the two durable Workflows
worker/index.ts      the app Worker entry (host routing, HTTPS, DB scope)
scripts/             stamp-engine.mjs, audit-samples.mjs, door seeds, dev preview
docs/                wasm-engine.md, this file
public/              zaltz (the wasm, extensionless), zaltz.worklet.js, icons, manifest
```

Key size signals: `lib/strudel-client.ts` (6,276 lines) is the browser playback
engine wrapper; `lib/jobs.ts` (2,999) is the job core; `lib/anthropic.ts` (2,128)
is the prompt/parse layer; `lib/songs.ts` (1,450) is ownership-scoped data
access.

---

## 3. Runtime topology

```
Browser (vinext client + zaltz/zissl/Strudel)
   │  POST create/edit                                    ┌──────────────────────────┐
   ├──────────────────────────────────────────────────────▶│ App Worker (klappn)      │
   │  poll GET /api/songs/:id                              │  · auth + ownership      │
   ◀───────────────────────────────────────────────────────│  · Postgres via postgres │
   │                                                       │  · triggers Workflows    │
   │                                                       │    over the REST API     │
   │                                                       └──────────┬───────────────┘
   │                                                                  │ POST instances
   │   parts render as status flips to "ready"             ┌──────────▼───────────────┐
   ◀───────────────────────────────────────────────────────│ Workflows Worker         │
                                                            │  · durable step.do()     │
                                                            │  · model calls + DB      │
                                                            └──────────────────────────┘
```

**Two Workers, deliberately.** The Workflow classes cannot be exported from the
vinext worker without framework-specific plumbing, so they live in
`workflows/src/index.ts` (worker name `klappn-workflows`) and the app triggers
them through the Cloudflare Workflows REST API (`lib/workflows.ts`, plain
`fetch` + `CLOUDFLARE_ACCOUNT_ID`/`CLOUDFLARE_API_TOKEN`). This keeps every route
handler framework-neutral. In local dev with no Cloudflare creds, the **same job
core** (`lib/jobs.ts`) runs in-process, fire-and-forget — the whole
create → generate → poll loop works without deploying anything.

**Host routing** happens in `worker/index.ts`, before vinext sees the request:

- `http:` → 301 to `https:` (scheme read from Cloudflare's `cf-visitor` header).
- `www.klappn.com` → 301 to the apex (one host keeps auth cookies and canonical
  URLs sane).
- `zaltz.klappn.com/` → **rewritten** (never redirected) to `/zaltz-engine`.
  Not `/zaltz` — that path *is* the wasm binary, served extensionless.
  `/favicon.ico` and the apple-touch icons rewrite to the zaltz-branded assets.
  Deep links that only ever meant "the room" (`/engine`, `/live`, `/boiler-room`
  on that host) 301 to `klappn.com/engine`.
- `zissl.klappn.com/` → rewritten to `/zissl`, same icon treatment.
- `/live` → 301 `/engine`. `/live/<token>` listener pages are untouched.
  `/boiler-room` is **not** redirected at the edge — the app route owns it,
  because only a route can carry a `?s=<share token>` query across.

Then every request is wrapped in `runWithDbScope`, the response body is
**buffered** (`res.arrayBuffer()`) before returning, and the DB scope is closed in
`ctx.waitUntil`. Buffering is load-bearing: RSC renders lazily as the body stream
is pulled, which would be *after* the request's I/O context ends, and a Workers
connection cannot be touched then.

`wrangler.jsonc` highlights:

- `compatibility_flags: ["nodejs_compat", "no_handle_cross_request_promise_resolution"]`.
  The second is **critical**: postgres.js's `reserve()` (used by Better Auth's
  Kysely driver for every query) resolves its connection callback in whatever
  request happens to be active when the socket event fires — often a different
  request. Without the flag the runtime cancels those continuations and sign-in
  hangs forever.
- `assets.run_worker_first` lists the dynamic routes (`/`, `/song/*`, `/api/*`,
  `/engine`, `/boiler-room`, `/zissl`, `/zaltz-engine`, the icon paths) so the
  Worker sees them pristine. `true` would make the Worker intercept static assets
  it can't serve; the array is the correct middle ground for SSR.
- Bindings: `HYPERDRIVE` (PlanetScale Postgres), `RENDER_CACHE` (R2 — event
  posters, vocal takes; the name is historical but load-bearing), `ASSETS`.
- `observability: { enabled: true }` on both workers.

---

## 4. Build & deploy

**Framework:** [vinext](https://www.npmjs.com/package/vinext) `1.0.0-beta.0` —
Cloudflare's Vite-based Next.js replacement (App Router), on Vite 8 / Rolldown.
Next 16.2.10 and React 19.2 are the peer surface. **Node ≥ 22.15 required**
(Node 24 works).

```bash
npm run dev      # vinext dev --port 3001 (plain Node; cloudflare:workers stubbed)
npm run build    # vinext build (adds @cloudflare/vite-plugin)
npm run deploy   # stamp-engine → vinext build → wrangler deploy
npm run verify   # lint + tsc --noEmit + unit tests + engine goldens + sample parity
```

Never run bare `wrangler deploy` — it ships stale assets. The deploy script's
first step, `scripts/stamp-engine.mjs`, content-hashes `public/zaltz` and
`public/zaltz.worklet.js` into `lib/engine-version.ts` (`ENGINE_V`), which is
appended to the engine asset URLs. Those two files are unhashed static assets and
the serving layer's etag proved unreliable across deploys — a stale etag once
304'd returning browsers onto weeks-old engine builds. Content-hashed query
params make each engine release a brand-new URL.

`vite.config.ts` does four non-obvious things:

1. **`STRUDEL_DEDUPE`** forces a single instance of every `@strudel/*` package
   plus `superdough`. Without it the bundler instantiates them twice, giving two
   `soundMap`s — `registerSoundfonts()` writes `gm_*` into one and the REPL plays
   from the other, so every GM instrument is silent.
2. **Soundfont alias** — `@strudel/soundfonts` resolves to
   `lib/vendor/soundfonts/index.mjs`, a patched loader with a loop-seam
   crossfade (the clicking-violin fix).
3. **Chunking** — all Strudel/superdough/soundfont code is forced into one
   output chunk (`advancedChunks`), and `chunkFileNames` is hash-only
   (`_next/static/c.[hash].js`) so module names don't leak into the network tab.
4. **`scrubFingerprints`** (build only) renames two runtime literals consistently
   across the bundle: `strudel.log` → `k1.log` and `hydra-canvas` → `k1-canvas`.
   Both the dispatcher and the listener live in bundled code, so one rename keeps
   them agreed; `globals.css` carries both canvas ids. Brand words are *not*
   blanket-replaced — server chunks hold real upstream URLs.

In dev, `cloudflare:workers` is aliased to `vite-stubs/cloudflare-workers.js`
(empty `env`, so `lib/db.ts` falls back to `DATABASE_URL`). In the build it's
left external and provided by workerd.

---

## 5. Data layer

**Postgres** (PlanetScale in production) reached through a **Hyperdrive** binding
with the `postgres` (porsager) driver. `lib/db.ts` encodes hard-won runtime rules:

- `prepare: false` — required behind poolers.
- `fetch_types: false` — postgres.js's `pg_catalog` introspection query hangs
  over Hyperdrive.
- `max: 1` — one connection per client. Hyperdrive already pools origin
  connections; a per-client pool of 5 multiplied open PlanetScale connections and
  was a major contributor to exhausting `max_connections`.
- `idle_timeout: 5`, `max_lifetime: 60`.

**The hard rule on Workers:** a connection created in one request cannot be used
from another — doing so throws *"Cannot perform I/O on behalf of a different
request"*, or the resolving promise's continuation is cancelled and the query
hangs forever. So clients are never cached at module scope. Instead:

- The Worker entry wraps each request in `runWithDbScope`; every `getSql()` in
  that request shares one client, closed at the end.
- On plain Node (local dev) one client per connection string is cached and
  **shared** — load-bearing, because `kysely-postgres-js` calls `sql.reserve()`
  per query, and a cold `reserve()` hangs in Node too. `warmPool()` only works if
  it warms the same client Kysely then reserves from.
- On workerd with no request scope (a Workflow step) `getSql()` mints a
  **transient** client the caller must `.end()` itself — the idle reaper's timer
  dies with the step's I/O context. `ownsTransientClient()` exposes this.

`warmPool()` (a `select 1`) exists solely because `sql.reserve()` hangs on a cold
pool over Hyperdrive. Every session lookup calls it first.

### Schema (`lib/schema.sql`)

Applied *after* Better Auth migrates its own tables (it owns `"user"`). Ownership
is enforced in the app layer — **no RLS**.

| Table | Purpose |
|---|---|
| `songs` | id, user_id, title, global_prompt, `plan` jsonb, status (`draft`/`overview`/`generating`/`ready`/`error`), generation_workflow_id, playlist, `model` (quality dial), `featured_at` (the door) |
| `parts` | one loop or bridge: position, label, intent, `strudel`, `tracks` jsonb (the layer list), `score`/`sounds` (legacy), `variants` jsonb (cached edit-pill takes), `original_strudel`, `edit_choice`, `kind` (`loop`/`bridge`/`break`), `bars`, `status_message`, `strudel_mobile` (dead column). Unique `(song_id, position)` **deferrable initially deferred** so a transactional renumber can shift a whole range in one set-based UPDATE |
| `sets` | ordered arrangement of songs; `plan.entries` + `plan.transitions` |
| `sketches` | the engine room's saved work: a Strudel pane + a Hydra pane |
| `room_shares` | a public frozen copy of both panes; the token *is* the permission, `user_id` nullable `ON DELETE SET NULL` so a departing account never breaks other people's links |
| `room_snapshots` | the room's authored code captured for training: `eval`/`take`/`pour`/`live` events, throttled client-side |
| `live_links` | expiring public token for a live performance; `kind` = `set` or `zaltz`, `state` jsonb, `visual` (the room's hydra sketch) |
| `vocal_takes` | processed + raw R2 keys, fx, lyrics, anchor part/offset |
| `events` / `event_tickets` | public hype pages, RSVPs, paid tickets, 10% platform fee ledgered per ticket |
| `user_billing` | Stripe customer/subscription + Connect account + `stripe_account_ready` |
| `token_usage` | weighted units per user per period |
| `token_reservations` | short-lived holds taken at the quota gate (15-min TTL sweep) |
| `token_credits` | prepaid purchases; `stripe_session_id` UNIQUE so webhook retries can't double-credit |
| `taste_grants` | the fixed global free-taste pool |
| `model_calls` / `model_prompts` | the training corpus — one row per `complete()` call including failed retries; the big repeated system prompt is deduped by hash |
| `issues` | every gate failure, browser-reported error and repair outcome |
| `rate_limits` | fixed-window counters (Postgres, because Workers isolates make in-memory counters decorative) |

Triggers: `set_updated_at()` on songs/parts/sets/sketches/vocal_takes/events, and
`bump_song_updated_at()` so **any** parts row change bumps the parent song's
`updated_at` — that's what makes the client's `GET /api/songs/:id` poll reliably
see per-part progress.

Every schema change is idempotent (`add column if not exists`) and the file is
re-runnable. **Production must have `schema.sql` applied to PlanetScale too**
(`sslmode=require`), not just local.

---

## 6. Identity & auth

**Better Auth** (`lib/auth.ts`), built **per request** via `getAuth()`. Two
Workers constraints shape this:

1. No DB client or `betterAuth()` call at module top-level — the runtime
   evaluates global scope during a startup probe where the Hyperdrive binding
   isn't safely available (worker startup error 10021).
2. Never cache the instance across requests — its Kysely dialect captures a
   postgres.js client bound to one request's scope. Building `betterAuth()` does
   no I/O, so a fresh instance per call is cheap.

Plugins:

- **`emailOTP`** — the primary sign-in. A 6-digit code, 10-minute expiry. This
  replaced magic links because a link opens in the *default* browser: start in
  Chrome, tap in Gmail, land signed-in in Safari while Chrome waits forever. A
  code has no browser — the session is created exactly where the user is typing.
- **`magicLink`** — kept wired so links already in inboxes keep working.
- **`anonymous`** — try before any account. A visitor who starts making gets a
  real `user` row and session (`emailDomainName: "guest.klappn.com"`), so every
  owned table and the quota gate work unchanged.

**Guest merge** (`lib/guest.ts`) runs in `onLinkAccount` before the plugin deletes
the anonymous row (whose FKs cascade). One transaction moves songs, sets,
sketches, vocal_takes, events, live_links, credits and reservations; sums
`token_usage` by `(user, period)`; moves the taste grant only if the account
doesn't already hold one; moves `user_billing` only when the account has no row.
**A merge failure throws** — the sign-in fails loudly rather than silently losing
work.

Cookies ride `.klappn.com` in production (`crossSubDomainCookies`), so signing in
on klappn.com or zaltz.klappn.com signs you in on both. `trustedOrigins` lists
all three production hosts plus the local dev ports — without an entry, any
origin other than the baseURL's 403s with "Invalid origin", which silently broke
guest minting on zaltz.klappn.com under Safari.

`lib/session.ts` is the single ownership choke point: `getUserId(req)` →
`warmPool()` → `getSession()`. Every route handler calls it and filters all DB
access by the returned id. `getSessionUser()` additionally returns `isAnonymous`
for the routes that treat guests differently (checkout, going live, sharing).

---

## 7. The LLM layer

`lib/llm.ts` is the only place a model id, effort, thinking mode or token budget
is chosen. One wire: the native Anthropic Messages API.

### Three tiers

| Tier | Model | Job |
|---|---|---|
| `fable` | `claude-fable-5` ($10/$50) | **INVENT** music — the calls whose output the ear judges directly with no cheap second chance |
| `opus` | `claude-opus-5` ($5/$25) | **REWORK and REASON** — edits over given material, re-bars, repairs, planners, structured JSON, visuals |
| `sonnet` | `claude-sonnet-5` ($3/$15) | **NAME and decide one bit** — panels, labels, presets, the done-check. Always `thinking: false` |

The line between fable and opus is *invent vs transform*. You move a call across
it by editing its `ROUTE` entry — never at the call site.

### The agent table

`ROUTE` has one entry per AI call in the product. Call sites spread an entry and
add nothing but a trace label:

```
compose  fable  high   14000  cacheTtl 1h   write the loop's next $: layer
breaks   fable  high    8000                the one-bar hand-off between loops
edit     opus   high   14000                rewrite a whole loop
meter    opus   high   14000                re-bar into a new time signature
repair   opus   high    8000                fix a loop that threw at playback
create   opus   high   12000                derive the workspace / adjacent section
shape    opus   high    8000                the song's effect glides (whole song)
turn     sonnet medium  1200                ONE turn's break — two loops of context
hydra    opus   high    8000                the visual
ghost    opus   no-think 640                the room's copilot completion
assist   opus   no-think 1200               ✎ edit, a selected span
rework   opus   no-think 8000               ✎ edit, the whole pane
fix      opus   no-think 4000               ✦ one-tap fix
done     sonnet no-think 200  cacheTtl 1h   DONE / MORE between layers
panel    sonnet no-think 2500               a layer's knobs + presets
copy     sonnet no-think 2000               labels / look names
explain  sonnet no-think 350                ✦ teach the selection
setOrder sonnet medium 3000                 order a Set's songs
```

`maxTokens` is the **completion lever**, not a cost knob: Cloudflare kills a
Workflow step at ~5 minutes and adaptive thinking plans *within* `max_tokens`, so
a snug budget makes a call finish its thought instead of being executed
mid-sentence. Output budgets are also tiered by effort (max/xhigh 64k, high 24k,
medium 16k, low 8k) and the per-call budget can only cap that, never raise it.

### The quality dial

`songs.model` persists one choice per song: `"opus"` (Standard, the default) or
`"studio"`. `resolveTier()` uses it as a **veto on the fable rows only** — Studio
lets the invent calls reach Fable; Standard composes on Opus. Sonnet and Opus
rows never move, because no amount of paying more makes a knob label better. The
dial id is `"studio"` and not `"fable"` on purpose: songs from the bake-off era
carry a literal `"fable"` in the column and must keep resolving to Standard.
`lib/llm.test.ts` tests the veto — it's the one piece of routing whose failure
mode is a bill.

### Request surface (hard rules)

- **Never** `temperature` / `top_p` / `top_k` / `budget_tokens` — all 400 on these
  models.
- Fable 5 **cannot disable thinking at all** (400 at every effort). Opus 5 can,
  but only at effort ≤ high. `noThink` therefore omits `output_config` entirely
  so the server default applies.
- Opus 5 rides the **beta stream** with `server-side-fallback-2026-07-01` and
  `fallbacks: "default"`, so a safety-classifier decline is re-served by the
  API's recommended fallback inside the same call. Fable deliberately stays on
  the plain stream (an unaccepted beta/parameter pair would 400 every layer of
  every song); its refusals are covered by one client-side replay.
- **Prompt caching, two breakpoints.** The system block is always cached at 1h.
  `cacheStable` marks a user-prompt prefix — and the rule is explicit: a cache
  write costs 1.25× (5m) or 2× (1h) input while a read costs 0.1×, so marking a
  prefix sent once is a straight loss. Exactly three calls qualify today
  (`compose` and `done` share a loop's brief at 1h; `ghost` shares the other pane
  at 5m). Count the re-sends before adding a fourth.

### Resilience

- **Stall watchdog:** 90s of silence *before the first stream event* aborts. Once
  the first event arrives the request is alive — adaptive thinking emits zero
  events while reasoning, and the old unconditional 90s rule shot eight healthy
  requests in a row.
- **Hard wall:** 8 minutes overall, under the 10-minute step timeout. This exists
  because a slow-drip stream (one event just under every 90s) once sat "Working"
  for 3+ hours and the Cloudflare step timeout did not kill the wedged await.
- **Transient retry:** up to 4 attempts, but only while nothing has streamed
  (`firstEventMs < 0`), for 408/409/429/5xx/overloaded/dropped-connection. Free,
  because no thinking tokens were burned. Never after tokens begin, never on a
  watchdog abort. Fast mode drops to standard speed on retry (it has no
  auto-fallback).
- **Fable degradation:** a 4xx *rejection* of a fable call degrades that call once
  to Opus 5 and logs loudly — Fable 5 is not served to orgs with under 30-day
  data retention, and every request 400s payload-independent. Narrow on purpose:
  only 4xx, never a 5xx (which has its own retry) and never our watchdog abort.
- **Refusal:** `stop_reason === "refusal"` triggers one client-side replay on the
  next tier down (Opus 5 → Sonnet 5, Fable 5 → Opus 5). The rescue model's own
  refusal throws.

### Metering & capture

Every call reports **cost-weighted** units so a metered "token" tracks real
dollars on every model: `(input + output×5 + cacheRead×0.1 + writeUnits) ×
MODEL_COST_FACTOR × speedFactor`. Write units are read per-TTL when the API
reports the breakdown, falling back to 2× (the conservative read — the 1h system
block dominates writes). `MODEL_COST_FACTOR` is matched by prefix against
`res.model` — *what actually answered* — because the classifier fallback can swap
models mid-call. Unknown models bill at the anchor; never silently under-charge.

`cfg.onCall` receives the full trajectory of every call including failed and
rejected retries (the gate's feedback rides the next attempt's user text, so the
repair chain stays whole). Capture must never break generation — it's wrapped in
its own try/catch.

---

## 8. The generation pipeline

### Creating a workspace

`POST /api/songs` with `{ firstLoop }` — one natural-language request:

1. `reserveQuota(userId)` — an **atomic** hold, not a bare check. Parallel POSTs
   each take a hold and the (N+1)th sees the first N's, which closes the hole
   where firing N requests at once blew past the cap.
2. Optional inspiration loops (`loopIds`, max 8) are gathered, ownership-scoped,
   with `@hydra` stripped.
3. `deriveWorkspaceFromLoop()` — one `ROUTE.create` call infers the whole track's
   identity (title, genre, bpm, key, direction) **and its whole arc**: 3–6
   sections in order, each a distinct statement. The user's raw words stop here:
   they are translated into musical terms and never echoed downstream.
4. The song row and **every** section are inserted before a note is composed, so
   the piece's shape is on screen from the first paint. `triggerGeneration()`
   fires with `finish: true` — this run makes the whole song, so it closes with
   the arrangement and the sweep instead of leaving them to a tap. The instance
   id is stored and the reservation released.

### GenerationWorkflow

`workflows/src/index.ts`. Payload is `{ songId, partId? | partIds?, finish? }` —
one part, an ordered list (a new loop *then* the bridge that needs its code), or
every pending part. `finish` marks the run that makes the **whole** song. Steps:

1. **`load`** — flip the song to `generating`, snapshot plan + parts + owner +
   model.
2. Wire the **meter** and the **call trace**. Both accumulate *in memory* and
   flush at awaited checkpoints (per part, before each return). This is not an
   optimization: `cfg.onUsage` fires unawaited after every model call, and making
   it open a fresh postgres client each time leaked connections — the `.end()`
   raced the step's I/O-context teardown and never completed, piling up open
   PlanetScale connections until `max_connections` was exhausted.
3. **Queue order** — explicit `partIds` in the caller's order; otherwise all
   pending parts with **loops before bridges** (a bridge is composed from both
   neighbours' finished code).
4. Per part: **`mark-<id>`** confirms the song still *exists* (deleted mid-run →
   stop spending), re-asserts `generating` (concurrent scoped runs — extend-before
   and extend-after are two workflows on one song), and **wipes the part's
   tracks/strudel**. That wipe makes retry a *fresh take*: progress writes merge
   with the DB per layer to protect mid-build user tweaks, so without it a failed
   run's partial layers silently replaced the new run's, index by index.
5. **`composePartWith`** runs in `run()`'s context, *not* inside a step — each of
   its per-layer model calls becomes its own `step.do` via the injected
   `StepRunner` (`timeout: 10 minutes`, `retries: { limit: 0 }`). **No retries on
   model steps**: a retried compose re-burns an entire max-thinking call. The
   watchdogs already abort hung streams; on failure the part is flagged `error`
   with the reason and the loop page offers a one-tap retry the user chooses to
   pay for.
6. **`write-<id>`** merges the generator's tracks with any layer the user tweaked
   mid-build (`mergeGenWithUserEdits`, preferring the DB per layer) and carries
   the visual blocks across.
7. **Enrich at birth** — each finished part's tweak panels build in parallel with
   the *next* part's composition, collected before the run ends.
8. **The finish** (`finishSong`, `finish` runs only) — the arrangement first
   (how many bars each section occupies, which *is* its repeat count, plus an
   ending: a piece that can't stop isn't finished), then the sweep, which is
   told each section's decided span. Best-effort: neither may fail a run whose
   music is already made. `plan.stage` names where it is so the page can say so,
   and `plan.autoSwept` stops it offering a sweep that just ran. Every *other*
   run still only offers the pill.
9. **`finalize`** flips the song `ready` only if no part is still `generating`,
   so a sibling run isn't cut off. It runs **after** the finish — the client
   stops polling the moment the song reads ready.

Auto-visuals run **in parallel**: the first composing loop's third streamed layer
is real enough music to sync to (the early layers fix the loop's cycle length),
so the paint starts there and costs ~zero wall-clock. The result lands on
`plan.visual`; a closing sweep dresses any part whose ready-write beat the paint.
Failure is silent by design — a song without visuals plays fine, and music is
never blocked on a picture.

### The layer engine

`composeLoopByLayers` (`lib/jobs.ts`) — the heart. Per iteration:

1. **`loopComplete`** — a cheap no-thinking Sonnet call between layers
   (`STRUDEL_DONE_SYSTEM`): DONE or MORE. Skipped while below the floor.
2. **`composeStagedStrudelLayer`** — one Fable `high` call writes the next `$:`
   line directly and **names its own sound in the line**; `instrumentOf()` reads
   the instrument back (a `.bank(…)` line is drums, else the `.s(…)`). No
   instrument-pick call, no sound menu.
3. **`autoFixRender`** — free deterministic fixes: strip trailing line comments
   (quote-aware — a comment swallowed every method appended later, which is how a
   kick's volume knob once sat dead inside a comment), `0.1*10` → `0.1!10` in
   numeric control patterns, snap off-grid `.delaytime()` to a dotted eighth,
   bump octave-0 pitches to octave 1, clamp every audio param into range.
4. **`layerGateErrors`** — the real headless build plus browser-resolution checks
   (see §9). A failing line gets **one** regeneration; if the retry also fails the
   layer is **dropped and flagged**, never shipped.
5. The track streams out through `onTrack` → persisted immediately, so the UI
   shows and plays layers while the rest of the stack is still composing.

Floors: `MIN_LAYERS = 8` for a loop, 2 for a break/bridge; `MAX_LAYERS = 16`.
The floor exists because **the loop is the arrangement's palette** — headroom
comes from layers entering and leaving across the span, so composing thin starves
the arrangement. Below the floor, a null reply is treated as a model hiccup and
re-rolled up to 3×, not as "done".

Panels are **lazy**: a layer's knobs/pills/instrument swaps are generated the
first time its card is opened, so a layer nobody opens never spends those tokens.
Each streamed layer carries a deterministic quick label plus the canonical Volume
knob.

### The brief

`buildBrief()` assembles plain language, no API docs:

- genre, key, BPM, time signature (only when not 4/4)
- `plan.direction` — the maker's accumulated whole-track steer, a ≤160-char
  README rewritten whole
- **emergent harmony**: no dictated chord grid. One soft cue — the first harmonic
  voice sets the changes, every later voice stays in key and sits with the notes
  already placed (which it can see, since prior layers' Strudel is in context).
- this section's derived intent
- **edge facts**: an opening arrives *under* the section it leads into (fewer,
  quieter voices — drums before a drumless intro was the bug); a last section
  takes the hand-off.
- **neighbours**: direct neighbours hand over their full Strudel; everything else
  rides as label + intent — and on a **solo** compose (extend/regenerate into an
  otherwise-finished song) the far sections are omitted entirely.
- loops never speak hand-off or flow language — one-way material lives in the
  arrangement layer, not in a position-independent loop.

---

## 9. Correctness gates

The model never sees Strudel docs on the compose path, so **this code is the spec
check**. Everything is deterministic; there is no LLM jury.

**`lib/strudel-interp.ts` — the eval-free interpreter.** Cloudflare Workers block
`eval`, and Strudel's official transpiler's last step uses it. So the transpiled
string is walked as an acorn AST and only **whitelisted** Strudel functions are
called. It replicates the two transpiler behaviours that matter: `miniAllStrings`
(every string literal becomes a `mini(...)` pattern) and `$:` labelled statements
as layers (`_$:` = muted, skipped). The engine loads lazily and every entry point
degrades to an empty result if it can't load — analysis is optional and must
never break generation.

On top of that, `strudelServerErrors()` runs the real headless build plus:

| Check | Module | Catches |
|---|---|---|
| argument types | `arg-check.ts` | parses fine, valid mini, wrong *kind* of value → silence |
| mini-notation | `mini-check.ts` | valid JS, invalid in the browser (krill PEG parser) |
| chords/harmony | `chord-check.ts` | parses fine but plays silence or one note |
| audibility | `audibility.ts` | will this layer actually be *heard* |
| loudness | `loudness.ts` | an estimate from resolved events + controls (no audio rendered) |
| usage | `usage-check.ts` | `.fast(0)` family (NaN timing / zero events); chord symbols inside `note()` (`Cm7` is NaN → silent), carefully excluding valid `C7`/`D9` note+octave |
| sounds/banks | `sound-palette.ts` | a name that resolves to nothing |
| scales | `register-scales.ts` | `.scale()` **throws** on unknown names — no chromatic fallback — so the spec's maqamat/ragas are registered at every `@strudel/tonal` doorway |

Two deterministic passes run on merged code:

- **`reverb-orbits.ts`** — superdough shares one reverb and one delay per orbit,
  and every layer defaults to orbit 1. Two layers on one orbit asking for
  *different* reverb settings make the engine rebuild a multi-second impulse
  repeatedly, mid-playback, audibly. So every layer using an effect gets its own
  orbit; identical signatures share. Aliases matter: the model writes `.size(4)`,
  not `.roomsize(4)`, and a signature blind to the alias saw every layer as
  identical (the clicking-violin bug). Also `wireSidechain()` repairs `.duck()`
  targets.
- **`reverb-cap.ts`** — consolidation, since convolution reverb is the single most
  expensive Web Audio effect.

**Browser self-heal:** runtime errors reported from the player land in
`strudelServerErrors`/`hydraServerErrors` paths and can trigger `ROUTE.repair` /
`ROUTE.hydraRepair` — fix only what the error is about, same line count, same
order. Every gate failure, browser error and repair outcome is written to
`issues` (`lib/issues.ts`) so failure *classes* surface rather than individual
incidents.

**Doctrine:** fix the prompt, don't post-process AI output. Runtime guards that
"nanny" model output are removed on sight; the gates above are provable
correctness checks, not taste enforcement.

---

## 10. Editing paths

All of these run in `EditWorkflow`, each in its own durable step with `retries: 0`.

| Path | Trigger | Model call | Notes |
|---|---|---|---|
| **Natural-language loop edit** | `editRequest` | ONE `ROUTE.edit` HIGH call, whole revised loop out | Free shape — may rewrite, add or remove layers. Byte-identical lines keep their tracks (and the user's saved tweaks); the caller reconciles by exact match. Since 07-30 this call is **music only** — the section brief and track direction are two cheap Sonnet calls (`restateSectionBrief`, `restateTrackDirection`) run in parallel afterwards |
| **Edit pill (variant)** | `partId + pill` | one call | Every computed variant is cached in `parts.variants`, so re-tapping a pill restores its take instantly — the model is never asked twice for the same change |
| **Meter change** | `timeSignature` | one call **per loop, in sequence**, each its own step | A whole-song sequence in one step gets killed by the ~5-min wall on any song with 3+ loops. Per-loop failures are absorbed (that loop keeps its old code). The current render is snapshotted into `plan.meterCache` first, so switching back is instant |
| **Hand edit** | CodePane sheet | **zero AI** | Seeded from `tracks[].code`; `applyHandEdit` runs the same reconcile; gate failures **reject** the edit |
| **Song-level edit** | `changeRequest` | one call | Rewrites parts across the song |
| **Arrangement ops** | drag/delete/insert | **zero AI, mandated** | Drag commits sync-in-handler |

`parts.original_strudel` is snapshotted before the first AI edit so the "Original"
pill restores it. Mute is a persistent rewrite (`.gain(0)` appended, last gain
wins) — never a drop, because dropping a line would shift every later track's
index and make its knobs edit the wrong layer.

---

## 11. Arrangement & playback

### One song, one pattern

`lib/arrange.ts` is pure string→string (hence unit-testable headless). It
converts each loop's `$:`-layer program into a single `stack(...)` expression and
composes sections into one `arrange(...)` program.

The old sequencer stepped sections with wall timers: at each boundary it
`hush()`ed and re-evaluated the next loop, so every seam carried the evaluate cost
as an audible gap (worst on phones). Strudel already has the primitive — the
scheduler renders every seam as pure pattern math, sample-exact on every device,
and a backgrounded phone keeps flowing because transitions live *inside* the
pattern.

### The arrangement spec

`plan.arrangement` (a `SongArrangement`) is **data, authored by one
`ROUTE.arrange` call** (`lib/arrange-plan.ts`) and rendered deterministically:

- `SectionMove` — from bar N, only these 1-based layers play (`[]` = silence)
- `SectionSweep` — `.param(signal.range(from,to).slow(bars))` over a bar range,
  linear or sine, with an AI-named feel, AI-named knobs and a `home` for revert
- `SectionOverlay` — one-way material (risers, fills, impacts) straddling seams
- `SongEnding` — how the song stops

Every field is optional: a section the model omits plays whole, an absent ending
keeps the classic wrap-forever loop. This is **capability, not policy** — the
prompt states what is expressible and nothing about how songs are meant to go.

### Playback transforms

`lib/playback.ts` — manual, deterministic, no AI, **appended never inline** so
they're reversible and can't corrupt the source:

- transpose via `all(x => x.add(note(N)))` — numeric, so it moves plain notes
  *and* voiced chords (`.transpose()`'s note-name parser silently skips
  chord-voicing haps)
- tempo via a trailing `setcpm()` (last one wins)
- `MixSound` dials (brightness/punch/space) as a mix-bus performance layer, with
  bit-identical playback at defaults

> **Known latent bug:** a non-default `plan.sound` adds a top-level `all()`, which
> falls off gapless `arrange()`. Measured, unfixed.

### The browser engine wrapper

`lib/strudel-client.ts` (6.3k lines) is loaded **only** via dynamic import inside
a click handler — never at module top-level, never during SSR. It mirrors
strudel.cc's prebake exactly (GM soundfonts + the dough-samples maps), because
`@strudel/web`'s default prebake registers synth sounds only, which would make
every `gm_*` silent and resolve bare `bd/sd/hh` to different samples.

What it owns beyond evaluation:

- **audio clock timers** (`audioSetTimeout`, `bgSafeSetInterval`) — Safari clamps
  background timers to 1Hz, so scheduling rides an audio-clock heartbeat
  (`?bgtimer=0` kills it)
- **sink guard + resume retry** — iOS mute-switch and interrupted-context recovery
- **the limiter chain**, perf FX, the broadcast tap, the take tap
- **live mic**: constraints, pitch shifter, character paths (natural/deep/
  chipmunk/robot/phone), drive/glow rigs, F0 detection and scale-aware pitch
  steering
- **live MIDI** note triggers
- **WAV/video export** (`renderSongToWav`, `renderMixToVideo`) — real-time,
  arrangement-first, exactly the live mix
- **console gate** — production default-deny on console output

`lib/worklet-pin.ts` exists for one WebKit bug: Safari 18.0/18.0.1 holds each
registered `AudioWorkletProcessor` constructor behind a weak handle and
GC-reaps it mid-playback. The pin's *placement* is load-bearing.

### Playback state

`lib/now-playing.ts` is the **single source of truth** for paused/playing.
Selectors are primitive-valued. Nothing publishes before the engine actually
sounds, and nothing stops a session it didn't start. The music belongs to no
page: on unmount a surface flips `surfaceMounted` off instead of stopping the
engine, `NowPlayingDock` (in the root layout) surfaces it wherever you wander,
and returning to the href **adopts** the running session (`rebindSong`) rather
than restarting. `lib/media-session.ts` mirrors it to the OS lock screen.

`lib/home-sections.ts` builds gallery playback for the home grid and the
signed-out door from one small sealed payload — and it **must** agree with
`SongClient.buildSections`, because a song has to sound the same wherever you
pressed play.

---

## 12. zaltz — the audio engine

`engine/zaltz.c` — ~2,450 lines of C99, freestanding, wasm32, no libc, no libm,
no imports, no SharedArrayBuffer, no COOP/COEP. Compiled with `zig cc` (see
`engine/build.sh`) to ~165 KB, running inside an AudioWorklet.
(`docs/wasm-engine.md` quotes ~1,600 lines — that figure is now stale.)

### Why

Superdough synthesizes by building Web Audio node graphs **from the main thread**.
One long React commit, one GC pause, one background-tab timer clamp, and the
audio crackles. Every mitigation — bigger buffers, low-CPU "twin" rewrites of
every song for phones, reverb capping on mobile — was a payment on that
architectural debt. zaltz moves the entire render to the audio thread: phones
play the same full mix as desktops, backgrounded tabs keep playing, and the twin
pipeline was deleted outright.

### Three pieces

1. **`lib/zaltz.ts`** — the main-thread bridge. Transpiles with Strudel's own
   transpiler, queries the pattern for haps in a **lookahead loop**, serializes
   each hap to a flat `key/value/key/value` string, and posts batches. Lookahead
   is 0.35s normally and **2.0s when the tab is hidden** — an occluded renderer's
   main thread wakes on ~1s throttled bursts, so a short lookahead starves, the
   worklet plays past-due events immediately, and the groove smears then bunches.
   The bridge also owns asset resolution: manifests, pitched multisample zones
   (nearest-MIDI + residual repitch, superdough's exact math), GM soundfont zones
   through the vendored crossfading loader, and paced PCM upload. If the engine
   can't boot, the session falls back to superdough automatically.
2. **`engine/zaltz.worklet.js`** — the audio-thread host. Instantiates the wasm,
   writes event strings char-by-char straight into engine memory (there is no
   `TextEncoder` in `AudioWorkletGlobalScope`, and worklet-thread GC pauses are
   audible), drains PCM uploads with a **strict per-quantum budget** (a section's
   zones arrive in bursts and copying megabytes between quanta *is* the tick the
   ear catches), and rebuilds memory views only when the sample store actually
   grows. `hush` calls `sd_hush`, not `sd_init` — init rebuilds the wavetable bank
   (~2.5M sine evaluations) and would starve the render thread mid-playback.
3. **`engine/zaltz.c`** — the engine. Band-limited wavetable oscillators
   (polyBLEP saw/square, triangle at sample-exact 90° phase), noise sources, ADSR
   + filter envelopes, ladder/12dB/24dB filters, a sample store, looping soundfont
   voices, and per-orbit buses: FDN reverb, delay lines, sidechain duck, phaser,
   waveshaping, tremolo, a full phase-vocoder `stretch`. One growable arena
   (`memory.grow`, claimed at the end of linear memory) holds all PCM and delay
   lines.

Voice model: `MAX_VOICES 320` physical slots above a `POLY_CAP 128` musical cap,
because superdough's `maxPolyphony` semantics need headroom — a stolen voice keeps
sounding for `STEAL_FADE 0.25s`. Voice **stealing** (steal the oldest) was added
07-29; before that the engine dropped new notes when full.

### The faithfulness contract

zaltz implements **superdough's semantics** — the engine every Klappn song was
written against — not a new sound. Every formula is ported from superdough's JS
with `file:line` noted inline. dough (codeberg.org/uzu/dough) is the
*architectural* reference (single C file, worklet host, string protocol), not the
DSP oracle.

Parity work closed in late July: distortion ×9 + tremolo + `penv` + full phase
vocoder `stretch` (spectral path in double precision, indutny FFT verbatim
including junk bins, golden ≤1e-7), sample names lowercased/aliased, `rdim` (FDN
damping matched to convolver band-T60, with the measured 0.32 network dilution),
and the FX chain reordered to superdough's exact graph — `postgain` was landing
*before* distortion, and nonlinear order is not cosmetic.

### The coverage contract

Three bugs shipped because the bridge dropped a control **in silence**:
`.stretch()` ignored, `.rdim()` ignored, and `.duck()` never reaching the engine
at all because Strudel writes it to the hap as `duckorbit` while the bridge read
`duck`. Each sounded like "zaltz is just different from strudel.cc" and none
failed a test, because nothing tested *coverage*.

So `lib/zaltz-controls.ts` classifies all 333 controls into buckets (`NUM_KEYS`
forwarded verbatim, `RENAME` forwarded under the engine's name, `DERIVED` handled
by dedicated logic, `UNSUPPORTED` warned once at runtime), and
`lib/zaltz-controls.test.ts` **derives the key list from Strudel itself** — it
calls each control and reads the hap — rather than from a hand-maintained list. A
control we forget, or one a Strudel upgrade adds, fails the test *by name*.

### The laws

- **Buses ramp, never step** — including feedback-network coefficients. A retuned
  reverb glides its damping and size *while the tail rings*; stepping any live
  coefficient is a click by construction.
- **Nothing unbounded on the audio thread.** Event writes are length-guarded,
  uploads budgeted per quantum, memory growth chunked and rare.
- **Quality over faithfulness.** Parity is the floor, not the ceiling: where the
  reference glitches (regenerating a shared convolver mid-ring, per-hap GC churn),
  zaltz deliberately diverges.
- **The ear is the acceptance test.** Metrics gate regressions; a human listening
  decides quality.
- Never `import 'superdough'` directly — go through `lib/strudel-engine.ts`, or
  you get a second module instance.
- `nwaa`'s `getChannelData` returns a GC-mutable view — **always copy**.
- wasm memory views must be re-derived after any `grow`.
- `aliasBank` **after** the sample maps.

superdough remains available as `?engine=superdough`.

---

## 13. zissl & visuals

### Storage

Hydra lives inside the loop's code as an **inert comment block**:

```js
setcpm(120/4)
$: s("bd*4")

/* @hydra
  osc(6, 0.08, 1.4).kaleid(5).out(o0); render(o0);
*/
```

Run the stored code as plain Strudel and the block is ignored — copy-paste stays
audio-only. Our player extracts it (`lib/hydra-embed.ts`) and runs it as real
Hydra alongside the audio. `*/` inside the visual is defused. Two sibling blocks
ride along: `@vcontrols` (the deterministic grade spec) and `@vlooks` (AI-named
one-tap looks).

`plan.visual` is the **canonical** copy. A new section **inherits** the song's one
visual verbatim rather than generating its own — one aesthetic per piece, no
per-section drift, no extra paint.

### One clock

All motion comes from `H(signal)` — the bridge that samples a continuous signal
(`saw`/`sine`/`tri`/`perlin`) on the **transport** clock, in cycles, not on the
wall clock. Hydra's own wall clock is frozen. The picture doesn't chase the
sound; both read the same bar position.

This is what makes streamed visuals free: a live set streams **audio only**, and
every listener's phone renders the visuals **natively at full GPU quality** from a
few lines of text, in lockstep (`lib/hydra-live.ts` reconstructs
`cycle = baseCycle + (now − t0) × cps` from the live state and feeds it to
`setTime()`, with a phase-only latency offset so visuals line up with the *sound*,
not the DJ's screen). A picture that is generated, not transmitted.

`lib/hydra-live.ts` is deliberately independent of the audio engine — it pulls
only `@strudel/hydra`, `hydra-synth` and `@strudel/core`'s signal math, so the
listener bundle never loads superdough or Web Audio. Everything is dynamically
imported inside `initLiveHydra`, because the `/live` route is server-rendered on
the Worker and a static `@strudel/*` import would evaluate at SSR and crash.

### Renderer selection

`lib/zissl-boot.ts` — **zissl-first**: WebGPU present → zissl; otherwise
`hydra-synth`, so nobody loses the picture. Kill switches are support levers, not
features: `?zissl=0` or `localStorage.klappnZissl="0"`. `ensureVisualCanvas()`
creates exactly the canvas `@strudel/draw`'s `getDrawContext` would have made —
same id, same styling — so every show/hide/resize/CSS path is none the wiser.

### The Hydra↔Strudel name collision

Closed 07-26: page-scope sketch eval plus `installSafeH` as a **total** wrapper (a
fragile `H` killed hydra's rAF for the whole session), plus `armVisualClock`.
Visuals can never touch audio.

### The door

`lib/door-visuals.ts` — the signed-out gallery's own self-contained, self-healing
visual engine: one endless hand-composed song ("Voltage" v2), human role squares,
a calm centred grid. Kills must pass `keepOrbits`.

---

## 14. The engine room (live coding)

`/engine` — "Klappn — the instrument you type." (`zaltz` names the *engine* only,
never the surface, and never "IDE" in public copy.) `components/ZaltzIDE.tsx`,
3,837 lines.

**Two panes**, both hand-rolled in `components/CodePane.tsx` (962 lines): a
transparent `<textarea>` (real caret, real selection, native undo) over a
highlighted `<pre>` twin, kept byte-aligned by shared font, padding and soft-wrap.
No editor dependency. The palette is house monochrome plus one pink — pattern
*strings* carry the accent, because they are the music.

**The ghost.** A completion renders as grey text at the caret. Grey means exactly
one thing: *this would be added*. (A TRIM whisper where grey meant "this line
would go" was removed 07-30 — the same affordance must never carry opposite
meanings; subtraction is the ✎ ask's job now.) `⇥` takes it, `Esc` or typing
dismisses it. Ghosts can be multi-line anywhere in the file: the ghost lives only
in the `<pre>`, so a mid-file ghost pushes the picture down exactly like VS Code
while the caret and clicks keep answering to the real buffer. On an empty pane,
`⇥` takes the placeholder hint — grey text is grey text.

`POST /api/complete` (`ROUTE.ghost`, Opus 5, thinking off, 640 tokens) sees the
**other pane** as read-only context — a hydra ghost should know the loop it
lights. Then the Copilot lesson: the model is half the product, **filtering is the
other half.** Every ghost is gated by the same static checks the assist path uses,
**differentially** — only errors the ghost would *add* count, because the coder's
own unfinished pane is allowed to be unfinished. A failing ghost gets one fast
repair pass, then dies silently. Never cache silence.

Other AI surfaces, all one-task:

| Surface | Route | Route entry |
|---|---|---|
| ✎ edit a selected span | `/api/edit-sel` | `assist` |
| ✎ edit the whole pane | `/api/edit-sel` | `rework` |
| ✦ one-tap fix | `/api/fix` | `fix` |
| ✦ explain the selection | `/api/explain` | `explain` |

**Non-AI machinery:** THE LINEUP (a header control — tapping a hit pours its first
loop into the panes), the SALT SHAKER (one circle opening `ZaltzMixer`, the
performance desk: channel kills on orbit buses, momentary pads, master-chain
dials, and video FX as CSS filters on the canvas), MIDI/MIC/VISUAL tabs, MIDI
learn, the hand editor, one live page plus a localStorage draft.

**Persistence:** `sketches` (owned, guests included), `room_shares` (a frozen
public copy of both panes — the token *is* the permission, so GET takes no
session; creating one requires a claimed account so a link always has an author),
and `room_snapshots` (throttled `eval`/`take`/`pour`/`live` captures for the
training corpus, disclosed on `/open`).

**One deck law:** `components/DeckKit.tsx` owns the DJ vocabulary on **every**
surface. The Sets deck and the engine room's desk render `DeckKit`, never their
own restylings — one pink, one chip, one machined group, one mic world. Nobody
should have to relearn the deck between surfaces.

---

## 15. Sets, live streaming, takes

### Sets

Product name is **Sets**, never "DJ sets". An ordered arrangement of your songs
played as one continuous performance, with AI-composed song-to-song transitions
(same shape as `song.plan.breaks`). `plan.entries[].id` is a stable *entry* id,
not the song id, so one song can appear twice and transitions key cleanly by
boundary.

**Channel kills** (`lib/set-live.ts`): a kill must be instant, and pattern-level
muting only affects notes triggered after the next evaluate — a sustained bass
note or reverb wash rings on for seconds. So every layer is routed to an **orbit
decade** by channel (drums 10–19, bass 20–29, melody 30–39) and a kill is a Web
Audio gain ramp on those buses: immediate, tails included, un-killing brings the
music back mid-note, exactly like a real mixer's kill EQ. Within a decade,
different reverb/delay signatures still get different orbits (the same crackle
rule). Gestures are ephemeral; **set players must pass `keepOrbits`**.

The VISUAL pill applies zissl's six light dials as CSS filters on the canvas.

### Live

The DJ's browser publishes **one mixed audio stream** to the Cloudflare Realtime
SFU; the SFU fans it out. The DJ uploads once no matter how big the crowd, and
each phone does zero synthesis — it just plays a stream, the one audio thing iOS
is rock-solid at. Visuals render natively per phone (§13).

- `lib/rtc.ts` — browser WebRTC helper, **non-trickle ICE** (wait for gathering so
  the SDP is complete). Recovery from a dropped connection is the caller's job: it
  watches `pc.connectionState` and re-runs publish/subscribe from scratch, which
  is simpler and more verifiable than an ICE-restart dance.
- `app/api/rtc/[...path]` — the signaling proxy. The Bearer token
  (`REALTIME_APP_TOKEN`) never touches the browser; only three signaling paths
  are allowlisted (`sessions/new`, `sessions/*/tracks/new`,
  `sessions/*/renegotiate`); the caller must be a signed-in user **or** hold an
  unexpired live-link token (sent as `x-live-token`).
- `live_links` — `kind: 'set'` hangs on a set; `kind: 'zaltz'` (the room) hangs on
  the user, one open door each, with the room's hydra sketch in `visual`.
- `GET /api/live/[token]` is polled by every phone in the crowd every ~1.5s while
  state changes at most every 300ms, so it has a **per-isolate micro-cache**
  (600ms TTL) holding plain data only. Expired entries are **served stale** while
  one request refreshes (Workers can't share an in-flight promise across requests,
  so serve-stale is the coalescing that *is* safe), and cold fetches are tracked
  in a `coldFetch` set so siblings wait for the result to land in the cache — a
  measured 50-way cold burst previously opened 50 concurrent connections, some
  failing outright. `now` is always stamped fresh: listener clock sync feeds on
  it, and a cached timestamp would skew every phone's bar grid.

### Takes

`lib/take-record.ts` — press ● and the room is taped **as it plays**: the master
(post-limiter, post-perf-FX — byte-for-byte what the listener hears, via
`lib/take-capture.ts`) plus one **24-bit WAV per orbit** from the engine's own
stem tap (`sd_stems`). No offline render, ever, so a take can't lag or cap out —
length is bounded by disk. Master chunks and stem batches share the same context
frame clock (`currentFrame`), so stems drop into a DAW already aligned. A Worker
streams PCM into OPFS via sync access handles (nothing accumulates in memory);
browsers without OPFS fall back to in-memory chunks. Silent stems are deleted at
finalize. Nothing uploads.

---

## 16. Events & ticketing

`/e/<token>` is a public hype page — share the link and anyone opens it, no
account, no app. Free events RSVP with an email; priced events pay through Stripe
Checkout (one-time, **destination charges** on the organizer's Stripe Connect
Express account). The platform keeps 10%, ledgered as `fee_cents` on each ticket,
so the organizer's cut is always `sum(amount_cents − fee_cents)`.

The **trailer** is one sealed loop of the organizer's own music (with its living
visual riding inside the Strudel) playing on the page — the movie-trailer taste of
the night. Set null on song/part deletion: the page degrades to poster-only, never
breaks.

Details: `sales_close_at` (null = open until door time; past = 410 and the page
says so honestly), `capacity`, `tz` (times print event-local), poster in R2, an
`.ics` route, a unique index on `(event_id, lower(email)) where status =
'confirmed'`. `stripe_account_ready` mirrors `charges_enabled` and is refreshed at
onboarding-return and on the events page, so checkout reads a flag rather than
calling Stripe per request.

---

## 17. Billing & metering

**Prepaid tokens, one public number.** `USD_CENTS_PER_MILLION = 500` — $5 per 1M
weighted units, tracking Opus 5's own input rate (the anchor). The entire price
sheet is one screen of `lib/pricing.ts`. It launched at $10/1M when Fable 5 was
the composer and was **halved** when Opus 5 took over rather than pocketing the
difference. Credits never expire.

- `TOKENS_PER_LOOP = 30_000` — the friendly estimate (measured p50 28k, rounded
  **up** so people land above the estimate, never below).
- `TOKENS_PER_GHOST = 2_500` — the room speaks ghosts, not loops.
- `CREDIT_PACK_USD = [5, 10, 25, 50]`. The $5 floor keeps the fixed part of the
  card fee from dwarfing the purchase.
- **Card fee passes through to the cent.** Stripe's 2.9% + 30¢ is charged on the
  total, so the total grosses up: `T = (cost + fixed) / (1 − pct)`, ceiled. The
  fee line is shown before checkout and itemized inside it. No markup hides in the
  fee.

**The gate** is hard and pre-flight — never mid-composition; a loop that begins
always finishes. `reserveQuota()` takes an atomic hold (`token_reservations`,
15-minute TTL sweep) and the gate counts `used(token_usage) + SUM(holds)`, so N
parallel requests can't all pass before any usage records. `assertQuota()` is the
cheap check used for completions, where the rate limit bounds abuse.

**The gift:** a walk-in gets the instrument free forever; the *machine* runs on
prepaid tokens, and a **claimed** account starts with 240k of them. Anonymous
walk-ins never mint the grant (a blanket grant would be farmable — the dollar
lands when a name lands on the door). Copy speaks **our tokens and only our
tokens**: no dollar equivalence, no loop-math, no model's-cost framing. A price
lives on the billing page.

Legacy monthly subscriptions (`creator`/`studio`/`label`) are no longer
purchasable but remain honored until cancelled, and a live subscription blocks
credit purchase so the two meters never mix.

---

## 18. Vocals (dormant)

`components/VoiceStudio.tsx` was retired 07-12 — nothing mounts it; voice moved to
live sets (the deck's MIC pill and Vox/Echo/Space). The `/api/vocal*` routes and
`lib/vocal-*` modules stay dormant, and saved takes remain on the server.

The pipeline itself (`lib/vocal-pipeline.ts` + `lib/vocal-dsp.ts`, ~1,800 lines of
pure math running in a Worker) is worth preserving: reference echo cancel → trim →
high-pass → MMSE-LSA denoise → YIN pitch track → PSOLA re-tune → beat-grid
alignment → peak normalize → WAV.

The tuner design is the notable part: it is a **retune speed, not a gate.** The old
design spliced verbatim input against corrected resynthesis behind a hysteresis
gate, and every seam between the two states was a potential dip — a vibrato
hovering the threshold made a *train* of them (the "artificial/crackly" verdict).
Now correction is continuous everywhere: a stepwise target curve per note, a
one-pole pull whose time constant the Tune knob sets (0.3 → ~220ms lazy, 1.0 →
~35ms tight), note onsets starting at the sung pitch and gliding in, and a
median-3 + EMA smoothed ratio curve. No gate, no splice, no seams. In-tune
passages ride at ratio ≈ 1 — near-transparent resynthesis.

---

## 19. Security & privacy posture

**Ownership.** Every read/write goes through `lib/songs.ts` / `lib/sets.ts` /
`lib/sketches.ts` / `lib/events.ts`, each scoped by `user_id` (or a join through
song ownership). No route or workflow touches a row directly, so a client-supplied
id can never reach someone else's data. Public-by-token surfaces (`/e/<token>`,
`/live/<token>`, `/api/room/share`) are explicitly public by construction — the
token *is* the read permission — and their writes stay owner-scoped.

**Sealing** (`lib/seal.ts`) — obfuscation, explicitly not cryptography. Generated
loop code is the leakable output; served as plaintext it's bulk-scrapable into a
training set. So code-bearing strings are XOR'd + base64url'd with a marker prefix
at the serialization boundary (`sealDeep`) and decoded right after parse
(`openDeep`). `open()` is marker-gated, so applying it is always safe — sealed,
unsealed, cached and mid-rollout payloads all degrade gracefully. Fingerprint key
names are renamed on the wire too (`strudel` → `z1`), since an opaque value under
a key literally called "strudel" defeats the point. A determined user recovers it
from a debugger; the point is casual inspection and cheap scraping.

> **Rule:** any new code-bearing route must call `sealDeep`.

**Asset proxy** (`app/api/snd/[...path]`) — the engine loads *all* remote assets
(manifests, audio, soundfont data) through our own origin, so the network tab
shows only `/api/snd/*`. Upstream hosts are **allowlisted** (four hosts) — never an
open proxy. Audio and fonts cache 1y, manifests 1d, with edge caching via the
Cache API.

**Rate limiting** (`lib/rate-limit.ts`) — fixed-window, Postgres-backed, one upsert
per check, opportunistic day-old sweep. **Fails open** on DB error: a limiter
outage must never take sign-in down with it. `clientIp()` reads
`cf-connecting-ip`.

**Other:** production console default-deny; `worker/index.ts` forces HTTPS; the
RTC proxy's path allowlist; Stripe webhook signature verification;
`stripe_session_id` UNIQUE against double-credit; sign-in codes and magic links
are **never** logged in production (prod logs are not a mailbox — the request
fails and the user retries).

**Open credential items:** prod DB password ×2, `sk_live`, and the Realtime SFU
token are all pending rotation.

---

## 20. Testing & verification

```bash
npm run verify        # the lot
npm run lint          # eslint
npx tsc --noEmit      # types
npm test              # tsx --test lib/*.test.ts && npm run test:engine
npm run test:engine   # fx, vocoder, soak, rdim, roomsize, duck goldens
npm run test:parity   # scripts/audit-samples.mjs (needs network)
```

**Unit tests** (`lib/*.test.ts`): arrange, arrange-plan, compose-strudel,
dough-bridge, llm (the fable veto), playback-transform, reverb-cap, reverb-orbits,
sample-precedence, set-live, zaltz-bridge, zaltz-controls (the coverage contract).

**The golden gate** (`engine/golden/run.mjs`) renders the same programs through
superdough (offline, via `node-web-audio-api`, in a child process because its
caches bind per context) and through zaltz, comparing envelope correlation, level
and brightness per case — synths, ADSR, filters, samples, GM zones, delay, reverb,
ducking, and real pattern queries. It has caught: a mono-pan stereo law 3.6 dB
off, phase-blind envelope metrics hiding a triangle-phase error, and an oracle
whose `getChannelData` returns a GC-mutable view. Where the oracle is known
unreliable (nwaa's supersaw worklet is phase-coherent and misses `1/√unison`),
the case gates on envelope **shape** only and the ear is the final judge.

Beyond the gate, an 8-song / 70-loop corpus of real Klappn music was A/B'd by ear
before zaltz became the default.

**Sample parity** (`scripts/audit-samples.mjs`) reads strudel.cc's own prebake and
rebuilds the sound dictionary it produces, then rebuilds ours through `/api/snd`
and diffs. Klappn deliberately loads *more* (the full Dirt-Samples library is the
composer's palette), so "only in klappn" is expected and reported separately. The
failures that matter are a name strudel.cc has and we don't (a patch goes silent
here) and a name both have resolved *differently* (same code, different sound —
this is what made `s("hh:<2 4 5 6>")` play kick drums).

**Mock mode:** `KLAPPN_MOCK_LLM=1` mocks all model calls with valid playable
Strudel, no API cost.

**Local UI preview:** sign in as `demo@klappn.test` (OTP prints to the dev-server
log); the local DB has demo songs. Real generation costs real tokens.

---

## 21. Operations

**Deploy** — always `npm run deploy` (stamp → build → wrangler). Deploy **both**
workers whenever generation or shared `lib/` code changes:

```bash
cd workflows && npx wrangler deploy --config wrangler.jsonc
```

The `--config` flag is required there. Standing instruction: deploy without asking
after requested changes, once verified.

**Migrations** — apply `lib/schema.sql` to production PlanetScale too
(`sslmode=require`), not only locally. On a mystery local 500, diff `\d` against
`schema.sql`: the local DB drifts.

**Observability** — Workers Logs are enabled on both workers. Without that,
`console.error` from a failed request vanishes unless a live tail happened to be
open (a vanished eager-transcribe left zero trace; never again). The `issues`
table makes failure classes queryable.

**Recovery paths** —
`reconcileStaleGeneration()` settles songs whose composing run died, so the home
grid can't show "Composing…" forever;
`terminateGeneration()` / `terminateManyGenerations()` (bounded concurrency 6) stop
in-flight model calls when a song is deleted or cancelled;
`createInstance()` retries once with a **caller-chosen instance id**, so a
timed-out create that actually landed can't be duplicated — a blind second POST
would run the same generation twice, two instances interleaving track writes into
one part with only the second findable for terminate.

**Local dev DB gotcha:** `getSql()` caches a module-scope client on plain Node.
That's intentional (see §5) but means a stale client survives a code reload.

---

## 22. Standing laws

These are constraints the code is written against. Violating one is a bug even if
the tests pass.

**Product**

- **No onboarding, ever.** No tours, no hints, no first-run. The product must be
  self-evident.
- **Consequence legible before the tap.** AI-spending buttons wear an orb and a
  word. `✕` means close/clear everywhere. One glyph, one meaning. Material is
  glass. Touch has no hover.
- **Copy seduces, never explains** — concrete imagery, hottest line last, and the
  seduction must be **true**.
- **Names stay untranslated** (zaltz, klappn, zissl). Lineage credits are fine.
- **Public-repo commits, issues and PRs are community messaging** — tactful always.
- Home objects are **hits**, never "loops" (in-song sections stay loops).
- Loop cards never auto-expand; empty never generates; a seam is **one** segmented
  capsule, never a second pill beside a chip.

**Engineering**

- **The ear is the acceptance test** for anything touching sound. Metrics are not
  quality. Flag the listening step.
- **Arrangement operations never call AI.**
- **Fix the prompt, don't post-process AI output.**
- **Each AI call does one task.**
- **Never publish playback state before the engine sounds**; never stop a session
  you didn't start.
- `DeckKit.tsx` owns the DJ vocabulary on every surface.
- `buildHomeSections` mirrors `SongClient.buildSections` — keep them in sync.
- DB code hotfixes must patch **both** `parts.strudel` and `parts.tracks[].code`.
- `html`/`body` `overflow-x: clip` is load-bearing on mobile.
- Prompts stay lean: task + contract + mistake-preventing constraints, **once**. A
  "creative bar" paragraph was proposed and rejected — "why are you putting up
  barriers for no reason?"

---

## 23. Module index

**Composition & AI**
`llm.ts` (routing, streaming, metering) · `anthropic.ts` (prompts + parsing) ·
`compose-strudel.ts` (the direct-Strudel core) · `strudel-track-spec.ts` (compose
prompts) · `compose-prompts.ts` (legacy score prompts) · `strudel-spec.ts` /
`hydra-spec.ts` (API references for the paths that need them) · `arrange-plan.ts`
(the arrangement composer) · `zaltz-assist.ts` (the room's AI) · `models.ts` (the
quality dial) · `mock-llm.ts` · `call-trace.ts` (training corpus persistence)

**Jobs & data**
`jobs.ts` (the job core) · `workflows.ts` (triggering) · `songs.ts` · `sets.ts` ·
`sketches.ts` · `events.ts` · `live.ts` · `billing.ts` · `pricing.ts` · `db.ts` ·
`auth.ts` · `session.ts` · `guest.ts` · `issues.ts` · `rate-limit.ts` · `email.ts`

**Music theory & validation**
`score.ts` (shared shapes) · `strudel-interp.ts` (eval-free interpreter) ·
`strudel-validate.ts` · `arg-check.ts` · `mini-check.ts` · `chord-check.ts` ·
`usage-check.ts` · `audibility.ts` · `loudness.ts` · `harmony-key.ts` ·
`chord-symbols.ts` · `register-scales.ts` · `loop-length.ts` · `gm-ranges.ts` ·
`sound-palette.ts` (generated snapshot) · `sound-catalog.ts` (human labels)

**Playback**
`strudel-client.ts` · `strudel-engine.ts` · `arrange.ts` · `playback.ts` ·
`home-sections.ts` · `now-playing.ts` · `use-now-playing.ts` · `media-session.ts` ·
`reverb-orbits.ts` · `reverb-cap.ts` · `breaks-catalog.ts` · `mixer.ts` ·
`parameterize.ts` · `controls.ts` · `labels.ts` · `worklet-pin.ts`

**Engines**
`zaltz.ts` (bridge) · `zaltz-controls.ts` (coverage contract) · `dough-bridge.ts` ·
`engine-version.ts` (generated) · `zissl-boot.ts` · `hydra-embed.ts` ·
`hydra-eval.ts` · `hydra-live.ts` · `door-visuals.ts`

**Live & capture**
`set-live.ts` · `rtc.ts` · `midi-live.ts` · `take-record.ts` · `take-capture.ts` ·
`live-record.ts`

**Vocals (dormant)**
`vocal.ts` · `vocal-dsp.ts` · `vocal-pipeline.ts` · `vocal-client.ts` ·
`vocal-fx.ts` · `vocal-layer.ts` · `vocal-worker.ts` · `vocal-capture-worklet.ts`

**Misc**
`seal.ts` · `links.ts` · `use-is-mobile.ts` · `use-keyboard-inset.ts` ·
`auth-client.ts` · `usage-check.ts`

---

## 24. Known gaps & open items

**Latent / measured but unfixed**

- A non-default `plan.sound` adds a top-level `all()` that falls off gapless
  `arrange()` (`mix-sound-breaks-arrangement`).
- `docs/wasm-engine.md` states `zaltz.c` is ~1,600 lines; it is ~2,450.
- `parts.strudel_mobile` is a dead column — the mobile-twin pipeline was deleted
  07-20. Nothing reads it; it is nulled on rewrites.
- `components/VoiceStudio.tsx` and the `lib/vocal-*` stack are unmounted but still
  compiled.
- The legacy score pipeline (`score`/`sounds`, `EDIT_SCORE_SYSTEM`,
  `PICK_SOUND_SYSTEM`, `TRANSLATE_SYSTEM`) runs only for pre-direct-Strudel parts
  that still carry a saved `parts.score`.
- `RENDER_CACHE` is named for a stem-render cache that no longer exists; the
  binding name is load-bearing (keys live under it) so it stays.

**Owed verification** — these need a human, not a test:

- Ear tests: zaltz post-parity (the full superdough A/B bundle), Sets deck,
  play-takeover cut, sweep pill, song direction note, live mic on a real device.
- Eye tests: the door gallery, playhead/visual sync.
- Real-Safari test for the worklet GC pin; real-iPhone tests for the mobile
  safe-area and hold/resume work.

**Operational** — credential rotation (prod DB password ×2, `sk_live`, the RTC
token), and an npm republish of the standalone `zaltz` package (currently 0.3.0;
this repo is the engine's source of truth and the package vendors from it).

---

_Klappn is AGPL-3.0. Third-party credits in [`NOTICE.md`](../NOTICE.md); lineage:
SuperDirt → superdough → zaltz, and Hydra → zissl._
