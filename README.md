# Klappn

**Describe a sound. Get a song you can open.**

You type a sentence. A frontier model writes it as [Strudel](https://strudel.cc)
live-coding patterns, layer by layer — kick, bass, the voice that answers the
bass — and hands you the code, not a bounced MP3. Play it, rearrange it, extend
it, sing over it, take the lid off and type into it while it plays, go live and
let a room hear it. Nothing under your music is sealed.

## How the music gets written

Nothing here asks a model for a song and waits. A loop is built the way a person
builds one — **one layer at a time**, each layer written by its own call that can
see everything already playing underneath it.

Your sentence becomes a brief: key, tempo, feel, what this section is for. Then
the loop grows. Kick. The bass that answers the kick. The voice that answers the
bass. After each layer the house asks one cheap question — *is this finished, or
does it want one more?* — and below eight parts it refuses to take yes for an
answer. Sixteen is the ceiling; most loops stop themselves before it.

Every layer comes back as **Strudel source, never audio**. It's parsed and
evaluated server-side before you hear a note; if it would throw, the error goes
back to the model once and the layer is rewritten. Nothing else touches it — no
cleanup pass, no regex patching the model's output into shape. A prompt that
produces bad code is a prompt bug, and it gets fixed in the prompt.

Editing is the same machine pointed backwards. "Make the bass drunker" is one
call that returns the whole revised loop; the lines that come back byte-identical
keep their layer, their mute, their volume. And the arrangement — drag, delete,
insert, extend — never calls a model at all. Moving a loop is not a question
anyone needs answered.

**One file decides who writes what.** [`lib/llm.ts`](lib/llm.ts) holds a table
with one row per AI call in the whole product — invent a layer, re-bar a loop,
repair a crash, name a stem — and each row pins its model, how hard that call
thinks, and its token ceiling. Inventing music gets the strongest hand and the
longest leash. Naming a preset gets a cheap one with thinking switched off. Call
sites choose nothing; if a decision isn't in that table, it doesn't exist. The
one knob you get is per song and reads like what it does — Standard, or Studio
for a stronger hand on the loops at roughly twice the tokens
([`lib/models.ts`](lib/models.ts)). It is not a model picker; naming engines at
people was never the product.

And you can read every word we say to it. The system prompts are strings in this
repo ([`lib/compose-prompts.ts`](lib/compose-prompts.ts) is where the music
ones live), short on purpose and free of nannying. Your own words stop at the
door: a request naming an artist is translated into pure musical terms before
anything downstream sees it, and never echoed forward.

## Three names, one machine

Klappn is the studio. Under it are two engines we wrote ourselves, and they are
siblings on purpose:

| | | |
|---|---|---|
| **Klappn** | the studio | you describe, it composes — hits, loops, sets, events |
| **zaltz** | the sound | one file of C on the audio thread ([`engine/zaltz.c`](engine/zaltz.c)) |
| **zissl** | the light | one file of WGSL on the GPU ([zissl](https://github.com/eliyahuleinkram/zissl)) |

**The names are a Yiddish pair: _zaltz un tsuker_ — salt and sugar.** zaltz is
the salt: the low end, the thing you feel in your chest. zissl is the sweet one:
the picture it throws on the wall. You'll also see them shouted — `ZALTZ`,
`ZISSL-FIRST`, `THE SALT SHAKER` — but that's only ever at the top of a source
file, where every subsystem in this codebase announces itself in caps. In prose
they stay lowercase, because they're words before they're products. Salt is not
a brand.

They were built the same way, twice. Both keep a beloved live-coding language
and replace the machine underneath it: zaltz keeps Strudel's vocabulary and
rebuilds superdough as freestanding C inside an AudioWorklet, where your UI
thread physically cannot reach it — the page can stutter, sleep, or die
mid-animation, the music does not. zissl keeps [Hydra](https://hydra.ojack.xyz)'s
vocabulary and rebuilds it as WGSL on WebGPU, which buys the thing WebGL never
had: compute — a million agents sensing the picture and drawing filaments back
over it. Both were held to a golden gate against the engine they replaced, and
neither shipped until the gate went green and the ear agreed.

And they run on **one clock**. Klappn's visuals take all their motion from
`H(signal)` — the bridge that samples a continuous signal on the *transport*
clock, in cycles, not on the wall clock. The picture doesn't chase the sound;
they're both reading the same bar position. That's why a live set can stream
audio alone: every listener's phone renders the visuals natively from a few
lines of text, in lockstep, at full GPU quality. A picture that's generated,
not transmitted.

Three doors into the same machine:

- **[klappn.com](https://klappn.com)** — the studio. Say what you want to hear.
- **[klappn.com/engine](https://klappn.com/engine)** — the engine room: the
  same machine with the lid off, your hits underneath, live code on top, sound
  the moment it lands.
- **[zaltz.klappn.com](https://zaltz.klappn.com)** · **[zissl.klappn.com](https://zissl.klappn.com)**
  — the engines' own front doors. Press a patch; the waveform is the C talking.
  Type a chain; the room lights up.

Both engines are separately released and separately usable — `npm i zaltz`,
[zaltz](https://github.com/eliyahuleinkram/zaltz) ·
[zissl](https://github.com/eliyahuleinkram/zissl). Take one, leave the studio.
That's the point of the license.

## Open, completely

The whole machine, face up on the table. Three promises, kept here and on the
app's `/open` page:

1. **The code is open.** Every prompt that talks to the model, the audio engine
   byte by byte, this file — all AGPL-3.0, Strudel's license. Read what happens
   under your music. Run it, fork it, steer it.
2. **The price is readable.** The whole price sheet is one screen of
   [`lib/pricing.ts`](lib/pricing.ts) — a price here is a line of open code, so
   any change is a commit with our name on it, never a surprise on a bill. The
   instrument is free; only the machine's composing is prepaid. Self-hosting?
   Your key, your bill, our code.
3. **The data deal is in the open.** Hosted generations and edits will raise
   Klappn's own music model — a model that stays inside this project, so the
   tool stops renting anyone else's brain. Consented in plain language, opt-out
   is one message, past included; self-hosted instances send us nothing. Said
   now, so nobody finds it out later.

We'd rather earn a community than rent customers. Every sentence above is a
promise — if the code ever contradicts one, that's a bug. File it.

**Discord**: _link coming_ — it lives in [`lib/links.ts`](lib/links.ts), and the
UI lights up the moment it's filled in.

## Stack

- **Vinext** — Cloudflare's Vite-based Next.js replacement (App Router),
  deployed to Cloudflare Workers.
- **PlanetScale Postgres** via a **Hyperdrive** binding (porsager `postgres`
  driver).
- **Better Auth** — email OTP sign-in (the 6-digit code prints to the dev
  server console when no email provider is configured).
- **Cloudflare Workflows** for durable background generation + editing.
- **Strudel** (`@strudel/web`) patterns, played 100% in-browser by **zaltz**
  (`engine/zaltz.c`; lineage: SuperDirt → superdough → zaltz, see
  [`NOTICE.md`](NOTICE.md)). superdough stays as a fallback:
  `?engine=superdough`.
- **zissl** for visuals, with `hydra-synth` as the fallback for browsers without
  WebGPU, so nobody loses the picture (`?zissl=0` forces it).
- **Anthropic's Claude**, server-side only, called per-agent from the table in
  [`lib/llm.ts`](lib/llm.ts) — a stronger model where music is invented, a
  cheaper one where a label is named. Bring your own API key when self-hosting:
  your key, your bill, our code.
- **Stripe** for token top-ups and event tickets (optional — the app runs
  without it).

> **Node ≥ 22.15 required** (vinext and wrangler both need it; Node 24 works).

This repo is the engine's **source of truth**: `engine/zaltz.c` and its golden
tests live here, and the standalone `zaltz` package vendors from them. Engine
patches land here first.

## Architecture

```
Browser (vinext client + zaltz/zissl/Strudel) ──POST create/edit──▶ Route handlers (Workers)
        ▲    │ poll GET /api/songs/:id                                     │ auth + ownership
        │    └───────────────────────────────────────────────────────────  │ DB via postgres driver
        │                                                                  │ trigger Workflow (REST API)
        └──── parts render as status flips to "ready" ◀──── Workflows worker (durable)
                                                                └─ model calls + DB writes
```

The Workflow classes live in a **separate Worker** (`./workflows`); the app
triggers them through the Cloudflare Workflows REST API
([`lib/workflows.ts`](lib/workflows.ts)). In local dev (no Cloudflare creds) the
same job core ([`lib/jobs.ts`](lib/jobs.ts)) runs in-process, so the whole flow
works without deploying.

## Local development / self-hosting

The picture engine is a sibling checkout (`"zissl": "file:../zissl"`), so clone
it next to this repo before installing:

```
git clone https://github.com/eliyahuleinkram/zissl.git
git clone https://github.com/eliyahuleinkram/klappn.git
cd klappn
```

1. Install (Node ≥ 22.15): `npm install`
2. Bring up Postgres and create a database (`createdb klappn`).
3. Copy env: `cp .env.example .env` and fill in at least `DATABASE_URL` and
   `BETTER_AUTH_SECRET`; add `ANTHROPIC_API_KEY` to enable generation (your key,
   your cost, your account).
4. Migrate Better Auth's tables, then apply our schema. npm scripts don't read
   `.env`, so load it into the shell first:
   ```
   set -a; . ./.env; set +a
   npm run auth:migrate
   npm run db:schema
   ```
5. Run the dev server: `npm run dev` → http://localhost:3001
   - Sign in with any email; the OTP code prints to the server console.

`npm run verify` runs the lot: lint, types, unit tests, the engine's golden
gates, and the sample-parity audit.

Self-hosted instances talk only to the providers **you** configure — no
telemetry, no data back to us.

## Deploy (Cloudflare)

1. `wrangler login`
2. Create Hyperdrive over your Postgres:
   `wrangler hyperdrive create klappn-pg --connection-string="postgres://..."`
   and paste the id into `wrangler.jsonc` + `workflows/wrangler.jsonc`.
3. Deploy the Workflows worker:
   ```
   cd workflows
   wrangler secret put ANTHROPIC_API_KEY
   wrangler deploy --config wrangler.jsonc
   ```
4. Set the app's secrets, then `npm run deploy` (vinext build + wrangler — never
   bare `wrangler deploy`, it ships stale assets). See `.env.example` for the
   full list; the core set:
   ```
   wrangler secret put BETTER_AUTH_SECRET
   wrangler secret put BETTER_AUTH_URL
   wrangler secret put ANTHROPIC_API_KEY
   wrangler secret put CLOUDFLARE_ACCOUNT_ID
   wrangler secret put CLOUDFLARE_API_TOKEN
   wrangler secret put EMAIL_FROM
   # optional: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET (token top-ups)
   ```

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). Two house rules worth knowing before
your first PR: the **ear is the acceptance test** for anything that touches
sound, and **arrangement operations never call AI**.

## License

AGPL-3.0 — see [`LICENSE`](LICENSE). Third-party credits in
[`NOTICE.md`](NOTICE.md). Same license family as Strudel: if you host a modified
Klappn, your users are entitled to your source, the same way you're entitled to
ours.
