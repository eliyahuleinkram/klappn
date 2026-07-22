# Klappn

**Describe a sound. Get editable, playable loops.**

Klappn is an AI music studio: you describe music in natural language and a
frontier model composes it as [Strudel](https://strudel.cc) live-coding
patterns, layer by layer — structured, editable code, not a baked audio
file. Play it, rearrange it, extend it, sing over it, perform it live.

## Our mission: completely open, completely honest

The whole machine, face up on the table. Three promises, kept here and on
the app's `/open` page:

1. **The code is open.** Every prompt that talks to the model, the audio
   engine byte by byte, this file — all AGPL-3.0, Strudel's license. Read
   what happens under your music. Run it, fork it, steer it.
2. **The price is readable.** Prepaid tokens, one public number: the entire
   price sheet is one screen of `lib/pricing.ts`, the card fee passes
   through Stripe to the cent, and tokens never expire. A price here is a
   line of open code — any change to it is a commit with our name on it,
   never a surprise on a bill. Self-hosting? Your key, your bill, our code.
3. **The data deal is in the open.** Hosted generations and edits may raise
   Klappn's own future music model — a model that stays inside this
   project, so the tool stops renting anyone else's brain. Consented in
   plain language, opt-out is one message, past included; self-hosted
   instances send us nothing. Said now, so nobody finds it out later.

We'd rather earn a community than rent customers. Every sentence above is a
promise — if the code ever contradicts one, that's a bug. File it.

- **GitHub**: you're here — and the audio engine also ships standalone at
  [github.com/eliyahuleinkram/zaltz](https://github.com/eliyahuleinkram/zaltz).
- **Discord**: _link coming_ — it lives in `lib/links.ts`, and the UI lights
  up the moment it's filled in.

## Stack

- **Vinext** — Cloudflare's Vite-based Next.js replacement (App Router),
  deployed to Cloudflare Workers.
- **PlanetScale Postgres** via a **Hyperdrive** binding (porsager `postgres`
  driver).
- **Better Auth** — email OTP sign-in (the 6-digit code prints to the dev
  server console when no email provider is configured).
- **Cloudflare Workflows** for durable background generation + editing.
- **Strudel** (`@strudel/web`) patterns, played 100% in-browser by
  **zaltz** — our WebAssembly audio engine (`engine/zaltz.c`; lineage:
  SuperDirt → superdough → zaltz; see `NOTICE.md`). superdough remains as
  a fallback (`?engine=superdough`).
- **Claude** (Fable 5 by default; see `lib/models.ts` for the routing)
  server-side only, for composition. Bring your own API key when
  self-hosting.
- **Stripe** for token top-ups and event tickets (optional — the app runs
  without it; generation is simply gated by the free allowance).

> **Node ≥ 22.15 required** (vinext and wrangler both need it; Node 24
> works).

## Architecture

```
Browser (vinext client + zaltz/Strudel) ──POST create/edit──▶ Route handlers (Workers)
        ▲    │ poll GET /api/songs/:id                                │ auth + ownership
        │    └──────────────────────────────────────────────────────  │ DB via postgres driver
        │                                                             │ trigger Workflow (REST API)
        └──── parts render as status flips to "ready" ◀── Workflows worker (durable)
                                                              └─ model calls + DB writes
```

The Workflow classes live in a **separate Worker** (`./workflows`); the app
triggers them through the Cloudflare Workflows REST API (`lib/workflows.ts`).
In local dev (no Cloudflare creds) the same job core (`lib/jobs.ts`) runs
in-process, so the whole flow works without deploying.

## Local development / self-hosting

1. Install (Node ≥ 22.15): `npm install`
2. Bring up Postgres and create a database (`createdb klappn`).
3. Copy env: `cp .env.example .env` and fill in at least `DATABASE_URL` and
   `BETTER_AUTH_SECRET`; add `ANTHROPIC_API_KEY` to enable generation (your
   key, your cost, your account).
4. Migrate Better Auth's tables, then apply our schema:
   ```
   npm run auth:migrate
   npm run db:schema
   ```
5. Run the dev server: `npm run dev` → http://localhost:3001
   - Sign in with any email; the OTP code prints to the server console.

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
4. Set the app's secrets, then `npm run deploy` (vinext build + wrangler —
   never bare `wrangler deploy`, it ships stale assets). See `.env.example`
   for the full list; the core set:
   ```
   wrangler secret put BETTER_AUTH_SECRET
   wrangler secret put BETTER_AUTH_URL
   wrangler secret put ANTHROPIC_API_KEY
   wrangler secret put CLOUDFLARE_ACCOUNT_ID
   wrangler secret put CLOUDFLARE_API_TOKEN
   wrangler secret put EMAIL_FROM
   # optional: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET (token top-ups),
   # TOGETHER_API_KEY (ASR for the voice studio)
   ```

## Contributing

See `CONTRIBUTING.md`. Two house rules worth knowing before your first PR:
the **ear is the acceptance test** for anything that touches sound, and
**arrangement operations never call AI**.

## License

AGPL-3.0 — see `LICENSE`. Third-party credits in `NOTICE.md`. Same license
family as Strudel: if you host a modified Klappn, your users are entitled to
your source, the same way you're entitled to ours.
