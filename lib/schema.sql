-- Klappn application schema.
-- Apply this AFTER Better Auth has created its own tables (it owns and migrates
-- the "user" table this references). Run: psql "$DATABASE_URL" -f lib/schema.sql
--
-- Ownership is enforced in the app layer (no RLS). PlanetScale Postgres is
-- expected to enforce FKs + ON DELETE CASCADE; if a given cluster does not,
-- drop the `references ...` clauses and enforce referential integrity in app code.

create extension if not exists "pgcrypto";

create table if not exists songs (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null references "user"(id) on delete cascade,
  title         text not null default 'untitled',
  global_prompt text,
  plan          jsonb not null default '{}',
  status        text not null default 'draft'
                check (status in ('draft','overview','generating','ready','error')),
  generation_workflow_id text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists songs_user_id_idx on songs (user_id);

-- Playlist a loop belongs to (one per loop; null = none). Pills on the home
-- screen filter by it. Idempotent for existing databases.
alter table songs add column if not exists playlist text;

-- Which model composed this song: 'anthropic' (Claude Opus 4.8) or 'glm' (GLM-5.2 via
-- Together AI). Chosen at creation (UI toggle); read by the workflow + edit routes so every
-- part and later edit runs on the same model. Defaults to 'anthropic' for existing rows.
alter table songs add column if not exists model text not null default 'anthropic';

-- THE DOOR — when set, this song plays on the signed-out gallery (curated by
-- hand, owner only; the timestamp is the display order, newest first).
alter table songs add column if not exists featured_at timestamptz;
create index if not exists songs_featured_idx on songs (featured_at) where featured_at is not null;

-- THE FREE POOL — the lifetime free taste is claimed from a FIXED global pool
-- of grants (lib/billing.ts FREE_TASTE_GRANTS). A grant is claimed the first
-- time an account tries to compose; once the pool is spent, later accounts pay
-- from the first loop. Keeps the launch bill bounded: grants × taste ≈ dollars.
create table if not exists taste_grants (
  user_id    text primary key references "user"(id) on delete cascade,
  created_at timestamptz not null default now()
);
-- Accounts that already composed keep their taste (grandfathered at migration).
insert into taste_grants (user_id)
  select distinct user_id from token_usage
  on conflict (user_id) do nothing;

create table if not exists parts (
  id          uuid primary key default gen_random_uuid(),
  song_id     uuid not null references songs(id) on delete cascade,
  position    int  not null,
  label       text,
  intent      text,
  strudel     text,
  -- A live, model-narrated "what's happening now" line shown while this part
  -- composes (best-effort; written from a cheap no-thinking Flash call).
  status_message text,
  -- How many bars this section plays in "Play song" (the AI sets this in the
  -- overview plan; injected parts use the default).
  bars        int  not null default 8,
  status      text not null default 'pending'
              check (status in ('pending','generating','ready','error')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- DEFERRABLE so transactional renumbering (inject/remove/reorder) can shift a
  -- whole range of positions with a single set-based UPDATE: uniqueness is
  -- checked once at COMMIT, after all rows have moved, rather than per-row mid
  -- statement (which would reject transient collisions).
  unique (song_id, position) deferrable initially deferred
);
create index if not exists parts_song_id_position_idx on parts (song_id, position);

-- Live narration column for existing databases (the table def above only adds it
-- on a fresh install). Idempotent — safe to re-run schema.sql.
alter table parts add column if not exists status_message text;

-- Snapshot of the part's code BEFORE its first AI edit (set once) — the "Original"
-- pill restores it. Idempotent.
alter table parts add column if not exists original_strudel text;

-- Which edit pill (one-tap variant) the part is currently wearing; null = the
-- original composition. Idempotent.
alter table parts add column if not exists edit_choice text;

-- Every COMPUTED style variant, kept: { "<pill>": "<strudel>" }. Re-tapping a
-- pill restores its cached take instantly — the model is never asked twice for
-- the same change. Manual edits (knobs/swaps) sync into the worn snapshot.
alter table parts add column if not exists variants jsonb not null default '{}'::jsonb;

-- What this part IS: a 'loop' (a place — repeats seamlessly) or a 'bridge'
-- (a journey — a one-way transition auto-composed between two adjacent loops;
-- plays once in the mix, never manually created). Idempotent.
alter table parts add column if not exists kind text not null default 'loop';

-- The engine-agnostic music-theory SCORE this loop was composed from (per-layer
-- event lists + the shared harmony) and the per-layer SOUND assignments (the
-- instrument / drum-kit chosen before translation). Persisted so a loop can be
-- re-translated or edited at the music level, not just as code. Idempotent.
alter table parts add column if not exists score jsonb;
alter table parts add column if not exists sounds jsonb;

-- LAYER-BY-LAYER MODEL (rev 2026-06): the loop as an ordered list of TRACKS, each
-- its own "$:" line plus the tweak panel (label + knobs + pills) generated for it.
-- This is what the per-track UI reads; `strudel` stays the merged playable code.
alter table parts add column if not exists tracks jsonb;

-- MOBILE TWIN (2026-07-07): a LOW-CPU version of `strudel`, AI-generated to sound as
-- close to the original as possible while a weak phone can synthesize it in real time
-- (strips distort/shape/lpenv worklets, supersaw polyphony, reverb, etc.). Like a
-- low-res image next to the full-res one. Mobile plays this; desktop plays `strudel`.
-- NULL = not generated yet (or a twin was rejected as invalid → mobile uses `strudel`).
-- Regenerated when `strudel` changes (the twin is stale otherwise). See lib/mobilize.ts.
alter table parts add column if not exists strudel_mobile text;

-- billing -------------------------------------------------------------------

-- One row per user: their Stripe linkage + current plan ('free'|'creator'|
-- 'studio'). The Stripe webhook keeps `plan` in sync; the quota gate reads
-- only this table (no Stripe call per request).
create table if not exists user_billing (
  user_id                text primary key references "user"(id) on delete cascade,
  stripe_customer_id     text,
  stripe_subscription_id text,
  plan                   text not null default 'free',
  updated_at             timestamptz not null default now()
);

-- STRIPE CONNECT (2026-07-10): the organizer's Express account for event-ticket
-- payouts. `ready` mirrors charges_enabled (refreshed at onboarding-return and
-- on the events page) — checkout reads the flag, never Stripe, per request.
alter table user_billing add column if not exists stripe_account_id text;
alter table user_billing add column if not exists stripe_account_ready boolean not null default false;

-- Metered model-token usage per user per calendar month ("2026-06"), recorded
-- from every Anthropic call (input + output, thinking included).
create table if not exists token_usage (
  user_id text not null,
  period  text not null,
  tokens  bigint not null default 0,
  primary key (user_id, period)
);

-- QUOTA RESERVATIONS — a short-lived HOLD taken at the gate for each in-flight
-- generation, released when it finishes (its real cost then lands in token_usage).
-- The gate counts used(token_usage) + SUM(these holds) so N parallel requests
-- can't all pass the check before any usage records (the free 3-loop lifetime cap
-- and paid month caps were bypassable by simply firing requests in parallel).
-- created_at drives a 15-minute TTL sweep so a crashed release can't strand a hold.
create table if not exists token_reservations (
  id         text primary key default gen_random_uuid()::text,
  user_id    text not null,
  est_tokens integer not null,          -- ~one loop's cost, held until release
  created_at timestamptz not null default now()
);
create index if not exists token_reservations_user_idx
  on token_reservations (user_id, created_at);

-- PREPAID TOKEN CREDITS (2026-07-19, the open-source pivot): a ledger of
-- one-time token purchases at the public rate ($10 per 1M weighted units —
-- see lib/billing.ts USD_CENTS_PER_MILLION);
-- credits never expire and are metered against LIFETIME usage alongside the
-- free taste. stripe_session_id is UNIQUE so webhook retries can't double-credit.
create table if not exists token_credits (
  id                text primary key default gen_random_uuid()::text,
  user_id           text not null,
  tokens            bigint not null,
  usd_cents         integer not null,
  stripe_session_id text not null unique,
  created_at        timestamptz not null default now()
);
create index if not exists token_credits_user_idx on token_credits (user_id);

-- TRAINING CORPUS: every model call's full trajectory, captured for someday training /
-- fine-tuning our own models. Append-only; written in BATCH at per-part checkpoints
-- (never one connection per call — see the Workflows worker's makeMeter/makeCallTrace).
-- The big, repeated system prompt is deduped by hash into model_prompts so rows stay small;
-- full training input = model_calls JOIN model_prompts ON system_hash = hash.
create table if not exists model_prompts (
  hash       text primary key,
  kind       text,
  text       text not null,
  first_seen timestamptz not null default now()
);

-- One row per complete() call, INCLUDING failed/rejected retries (each attempt is its own
-- call; the gate's feedback rides the next attempt's user_text, so the repair chain is whole).
-- No FK on song_id/part_id/system_hash on purpose: this is a best-effort logger and must never
-- fail an insert because a referenced row is missing or arrives out of order.
create table if not exists model_calls (
  id           uuid primary key default gen_random_uuid(),
  song_id      uuid,
  part_id      uuid,
  kind         text not null default 'other',
  attempt      int,
  model        text,
  effort       text,
  thinking     boolean,
  system_hash  text,
  user_text    text,
  output       text,
  total_tokens int,
  latency_ms   int,
  created_at   timestamptz not null default now()
);
create index if not exists model_calls_song_idx on model_calls(song_id);
create index if not exists model_calls_kind_idx on model_calls(kind);
-- RAW provider token counts (2026-07-05) — total_tokens is billing-WEIGHTED units;
-- these keep the true input/output/cache split for training statistics.
alter table model_calls add column if not exists input_tokens int;
alter table model_calls add column if not exists output_tokens int;
alter table model_calls add column if not exists cache_read_tokens int;
alter table model_calls add column if not exists cache_write_tokens int;

-- (Removed: the eager voice-transcription hand-off table — the sung-melody
-- upload feature was retired. Dropped here so older installs are cleaned up.)
drop table if exists transcriptions;

-- updated_at maintenance --------------------------------------------------

create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists songs_set_updated_at on songs;
create trigger songs_set_updated_at
  before update on songs
  for each row execute function set_updated_at();

drop trigger if exists parts_set_updated_at on parts;
create trigger parts_set_updated_at
  before update on parts
  for each row execute function set_updated_at();

drop trigger if exists sets_set_updated_at on sets;
create trigger sets_set_updated_at
  before update on sets
  for each row execute function set_updated_at();

-- Any change to a parts row bumps its parent song's updated_at, so the client's
-- polling of GET /api/songs/:id reliably sees per-part progress.
create or replace function bump_song_updated_at() returns trigger as $$
declare
  target uuid;
begin
  target := coalesce(new.song_id, old.song_id);
  update songs set updated_at = now() where id = target;
  return coalesce(new, old);
end;
$$ language plpgsql;

drop trigger if exists parts_bump_song on parts;
create trigger parts_bump_song
  after insert or update or delete on parts
  for each row execute function bump_song_updated_at();

-- SETS: an ordered arrangement of the user's songs played as ONE continuous
-- performance. `plan` mirrors songs.plan as the JSON home for everything set-level:
--   entries:     [{ id, songId }]                      — the order (id = stable entry id,
--                so one song can appear twice and transitions key cleanly)
--   transitions: { [fromEntryId]: { options: [{label, strudel}], chosen } }
--                — AI-composed song-to-song hand-offs, same shape as song.plan.breaks
create table if not exists sets (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null references "user"(id) on delete cascade,
  title      text not null default 'untitled set',
  plan       jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sets_user_id_idx on sets (user_id);

-- LIVE LISTENER LINKS: an expiring public token that lets anyone follow a set's
-- performance on their own phone. No audio is streamed — the DJ's browser
-- publishes STATE (current section + live dials) into `state`, and each
-- listener's device synthesizes the same music locally from the set's code.
create table if not exists live_links (
  token      text primary key,
  set_id     uuid not null references sets(id) on delete cascade,
  user_id    text not null references "user"(id) on delete cascade,
  state      jsonb not null default '{}',
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists live_links_set_idx on live_links (set_id);

-- VOCAL TAKES: the user's own voice, sung over a finished song. The audio is
-- the PROCESSED render (cleaned, tuned, timed — the browser does the DSP and
-- uploads the result to R2 under vocals/<song>/<take>.wav); `fx` holds the
-- non-destructive playback knobs (echo/space/level) and `lyrics` the timed
-- words the ASR heard ([{w,t0,t1}] seconds) for the standardized word display.
create table if not exists vocal_takes (
  id          uuid primary key default gen_random_uuid(),
  song_id     uuid not null references songs(id) on delete cascade,
  user_id     text not null references "user"(id) on delete cascade,
  r2_key      text not null,
  duration_ms int  not null default 0,
  fx          jsonb not null default '{}',
  lyrics      jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists vocal_takes_song_idx on vocal_takes (song_id);

-- The take's NAME (library display; "Take N" default assigned client-side) —
-- takes are reusable across songs, so they need to be findable by name.
alter table vocal_takes add column if not exists title text;

-- THE RAW TAKE (2026-07-12): the echo-cancelled but otherwise UNPROCESSED mono
-- (WAV, at vocals/<song>/<take>.raw.wav) stored alongside the render — the
-- durable source every re-process runs from, so a song-level key/transpose
-- change can re-tune the voice into the new key. Null on legacy takes (they
-- can only re-process from their render).
alter table vocal_takes add column if not exists raw_r2_key text;

-- VOICE ANCHORED TO ITS LOOP (2026-07-12): the loop the take was recorded over
-- (the first part in the mix at record time) + where that part began on the
-- take's own timeline (seconds; usually 0). Playback derives the voice's
-- song-time origin from where the anchor part sits in the CURRENT arrangement,
-- so prepending a loop shifts the voice later WITH its loop instead of
-- dragging it to the new beginning. Anchor gone/null = origin 0 (legacy).
alter table vocal_takes add column if not exists anchor_part_id uuid references parts(id) on delete set null;
alter table vocal_takes add column if not exists anchor_offset_sec double precision;

drop trigger if exists vocal_takes_set_updated_at on vocal_takes;
create trigger vocal_takes_set_updated_at
  before update on vocal_takes
  for each row execute function set_updated_at();

-- EVENTS: a schedulable moment (a party, a show, a listening session) with a
-- PUBLIC hype page at /e/<token> anyone can open from a shared link — no
-- account. Free events RSVP with an email; priced events sell a ticket through
-- Stripe Checkout (one-time payment). The platform keeps 10% (fee_cents on the
-- ticket row is the ledger); the organizer's cut = amount_cents - fee_cents.
create table if not exists events (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null references "user"(id) on delete cascade,
  token       text not null unique,          -- the public URL: /e/<token>
  title       text not null default 'untitled event',
  tagline     text,                          -- one hot line under the title
  venue       text,                          -- where it happens
  starts_at   timestamptz,
  ends_at     timestamptz,
  poster_key  text,                          -- R2 key (events/poster/<id>) or null
  tz          text,                           -- organizer's IANA zone; times print event-local
  price_cents int  not null default 0,       -- 0 = free
  currency    text not null default 'usd',
  capacity    int,                           -- null = no limit
  status      text not null default 'live' check (status in ('live','cancelled')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists events_user_idx on events (user_id);

-- THE TRAILER (2026-07-10): one loop of the organizer's own music (+ its living
-- visual, which rides inside the strudel code) plays ON the public page — the
-- movie-trailer taste of the night. Set null on song/part deletion: the page
-- degrades to poster-only, never breaks.
alter table events add column if not exists track_song_id uuid references songs(id) on delete set null;
alter table events add column if not exists track_part_id uuid references parts(id) on delete set null;

-- TICKET SALES DEADLINE (2026-07-12): null = sales stay open until door time;
-- set and past = rsvp/checkout answer 410 and the page says so honestly.
alter table events add column if not exists sales_close_at timestamptz;

drop trigger if exists events_set_updated_at on events;
create trigger events_set_updated_at
  before update on events
  for each row execute function set_updated_at();

-- One row per attendee. Free RSVP inserts 'confirmed' directly; a paid ticket
-- inserts 'pending' at checkout-session creation and the Stripe webhook flips
-- it 'confirmed'. One live ticket per email per event.
create table if not exists event_tickets (
  id                uuid primary key default gen_random_uuid(),
  event_id          uuid not null references events(id) on delete cascade,
  email             text not null,
  name              text,
  amount_cents      int  not null default 0, -- what was paid (0 = free RSVP)
  fee_cents         int  not null default 0, -- the platform's 10%
  stripe_session_id text unique,             -- null for free RSVPs
  status            text not null default 'confirmed'
                    check (status in ('pending','confirmed','refunded')),
  created_at        timestamptz not null default now()
);
create index if not exists event_tickets_event_idx on event_tickets (event_id);
create unique index if not exists event_tickets_email_uniq
  on event_tickets (event_id, lower(email)) where status = 'confirmed';

-- Pipeline issue log (lib/issues.ts flagIssue) — every gate failure, browser-reported
-- error, and repair outcome, queryable so failure classes surface. Also created lazily
-- at runtime on first flag, so this DDL is documentation + prod-migration parity.
create table if not exists issues (
  id bigint generated always as identity primary key,
  song_id text,
  part_id text,
  kind text not null,
  detail text not null,
  created_at timestamptz not null default now()
);
create index if not exists issues_kind_idx on issues (kind, created_at desc);
