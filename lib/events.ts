import type { Sql } from "postgres";
import { db } from "./db";

/**
 * EVENTS — a schedulable moment with a PUBLIC hype page at /e/<token>.
 *
 * The token is the invitation: share the link on WhatsApp and anyone can open
 * it, see where/when, and claim their spot — no account, no app, no friction.
 * Free events RSVP with an email; priced events pay through Stripe Checkout
 * (one-time). The platform keeps 10% — ledgered as fee_cents on each ticket,
 * so the organizer's cut is always sum(amount_cents - fee_cents).
 *
 * Writes are owner-scoped; reads by token are public (mirrors lib/live.ts).
 */

export const PLATFORM_FEE_RATE = 0.1;

export interface EventRow {
  id: string;
  user_id: string;
  token: string;
  title: string;
  tagline: string | null;
  venue: string | null;
  starts_at: string | null;
  ends_at: string | null;
  sales_close_at: string | null;
  poster_key: string | null;
  tz: string | null;
  track_song_id: string | null;
  track_part_id: string | null;
  price_cents: number;
  currency: string;
  capacity: number | null;
  status: "live" | "cancelled";
  created_at: string;
  updated_at: string;
}

export interface EventTicketRow {
  id: string;
  event_id: string;
  email: string;
  name: string | null;
  amount_cents: number;
  fee_cents: number;
  stripe_session_id: string | null;
  status: "pending" | "confirmed" | "refunded";
  created_at: string;
}

export interface EventStats {
  confirmed: number;
  gross_cents: number;
  fee_cents: number;
}

/** Short, URL-friendly, unguessable (~62 bits) — same alphabet as live links. */
function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36])
    .join("")
    .slice(0, 12);
}

export function platformFeeCents(amountCents: number): number {
  return Math.round(amountCents * PLATFORM_FEE_RATE);
}

/** "Fri, Aug 7" + "10:00 PM – 4:00 AM" in the EVENT's zone — the one truthful
 *  rendering everywhere the when is printed (page, email, OG description). */
export function eventWhen(e: {
  starts_at: string | null;
  ends_at: string | null;
  tz: string | null;
}): { date: string; time: string } | null {
  if (!e.starts_at) return null;
  const tz = e.tz ?? "UTC";
  try {
    const start = new Date(e.starts_at);
    const date = new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: tz,
    }).format(start);
    const t = (d: Date) =>
      new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: tz,
      }).format(d);
    const time = e.ends_at ? `${t(start)} – ${t(new Date(e.ends_at))}` : t(start);
    return { date, time };
  } catch {
    return null;
  }
}

/** Whether the ticket sales deadline has arrived — set and past means the
 *  rsvp/checkout routes answer 410 and the page shows the closed state. */
export function salesClosed(e: { sales_close_at: string | null }): boolean {
  if (!e.sales_close_at) return false;
  const t = Date.parse(e.sales_close_at);
  return Number.isFinite(t) && t <= Date.now();
}

/** "Fri, Aug 7, 8:00 PM" in the EVENT's zone — the sales deadline printed the
 *  same truthful way the when is (see eventWhen). */
export function salesCloseWhen(e: {
  sales_close_at: string | null;
  tz: string | null;
}): string | null {
  if (!e.sales_close_at) return null;
  try {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: e.tz ?? "UTC",
    }).format(new Date(e.sales_close_at));
  } catch {
    return null;
  }
}

const clampText = (v: unknown, max: number): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s.slice(0, max) : null;
};
const clampDate = (v: unknown): string | null => {
  if (typeof v !== "string" || !v.trim()) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

/** The mutable fields, sanitized once here so every route agrees. */
export interface EventPatch {
  title?: unknown;
  tagline?: unknown;
  venue?: unknown;
  startsAt?: unknown;
  endsAt?: unknown;
  salesCloseAt?: unknown;
  tz?: unknown;
  priceCents?: unknown;
  capacity?: unknown;
  status?: unknown;
}
const validTz = (v: unknown): string | null => {
  if (typeof v !== "string" || !v.trim()) return null;
  try {
    new Intl.DateTimeFormat("en", { timeZone: v });
    return v;
  } catch {
    return null;
  }
};
function sanitize(patch: EventPatch) {
  const price =
    typeof patch.priceCents === "number" && Number.isFinite(patch.priceCents)
      ? Math.max(0, Math.min(500_000, Math.round(patch.priceCents)))
      : undefined;
  const capacity =
    patch.capacity === null
      ? null
      : typeof patch.capacity === "number" && Number.isFinite(patch.capacity)
        ? Math.max(1, Math.min(1_000_000, Math.round(patch.capacity)))
        : undefined;
  return {
    title: clampText(patch.title, 120) ?? undefined,
    tagline: patch.tagline === undefined ? undefined : clampText(patch.tagline, 200),
    venue: patch.venue === undefined ? undefined : clampText(patch.venue, 200),
    starts_at: patch.startsAt === undefined ? undefined : clampDate(patch.startsAt),
    ends_at: patch.endsAt === undefined ? undefined : clampDate(patch.endsAt),
    sales_close_at:
      patch.salesCloseAt === undefined ? undefined : clampDate(patch.salesCloseAt),
    tz: patch.tz === undefined ? undefined : validTz(patch.tz),
    price_cents: price,
    capacity,
    status:
      patch.status === "live" || patch.status === "cancelled"
        ? (patch.status as "live" | "cancelled")
        : undefined,
  };
}

export async function createEvent(
  userId: string,
  patch: EventPatch,
  sql: Sql = db(),
): Promise<EventRow> {
  const s = sanitize(patch);
  const [row] = await sql<EventRow[]>`
    insert into events (user_id, token, title, tagline, venue, starts_at, ends_at,
                        sales_close_at, tz, price_cents, capacity)
    values (${userId}, ${newToken()}, ${s.title ?? "untitled event"},
            ${s.tagline ?? null}, ${s.venue ?? null}, ${s.starts_at ?? null},
            ${s.ends_at ?? null}, ${s.sales_close_at ?? null}, ${s.tz ?? null},
            ${s.price_cents ?? 0}, ${s.capacity ?? null})
    returning *`;
  return row;
}

export async function updateEvent(
  id: string,
  userId: string,
  patch: EventPatch,
  sql: Sql = db(),
): Promise<EventRow | null> {
  const s = sanitize(patch);
  const [row] = await sql<EventRow[]>`
    update events set
      title       = coalesce(${s.title ?? null}, title),
      tagline     = ${s.tagline === undefined ? sql`tagline` : s.tagline},
      venue       = ${s.venue === undefined ? sql`venue` : s.venue},
      starts_at   = ${s.starts_at === undefined ? sql`starts_at` : s.starts_at},
      ends_at     = ${s.ends_at === undefined ? sql`ends_at` : s.ends_at},
      sales_close_at = ${s.sales_close_at === undefined ? sql`sales_close_at` : s.sales_close_at},
      tz          = ${s.tz === undefined ? sql`tz` : s.tz},
      price_cents = coalesce(${s.price_cents ?? null}, price_cents),
      capacity    = ${s.capacity === undefined ? sql`capacity` : s.capacity},
      status      = coalesce(${s.status ?? null}, status)
    where id = ${id} and user_id = ${userId}
    returning *`;
  return row ?? null;
}

export async function deleteEvent(
  id: string,
  userId: string,
  sql: Sql = db(),
): Promise<{ poster_key: string | null } | null> {
  const [row] = await sql<{ poster_key: string | null }[]>`
    delete from events where id = ${id} and user_id = ${userId}
    returning poster_key`;
  return row ?? null;
}

/** Attach ONE loop of the organizer's own music as the page's trailer — the
 *  part must be theirs (verified by the join); null clears. */
export async function setEventTrack(
  eventId: string,
  userId: string,
  partId: string | null,
  sql: Sql = db(),
): Promise<boolean> {
  if (partId === null) {
    const rows = await sql`
      update events set track_song_id = null, track_part_id = null
      where id = ${eventId} and user_id = ${userId} returning id`;
    return rows.length > 0;
  }
  const rows = await sql`
    update events e
    set track_song_id = p.song_id, track_part_id = p.id
    from parts p join songs s on s.id = p.song_id
    where e.id = ${eventId} and e.user_id = ${userId}
      and p.id = ${partId} and s.user_id = ${userId}
      and p.status = 'ready' and p.strudel is not null
    returning e.id`;
  return rows.length > 0;
}

/** The trailer's playable material (PUBLIC read, keyed by the event row —
 *  the organizer's ownership was proven at attach time). Code crosses to the
 *  page SEALED (lib/seal.ts) like every code-bearing surface. */
export async function getEventTrail(
  event: EventRow,
  sql: Sql = db(),
): Promise<{ strudel: string; strudel_mobile: string | null; label: string | null } | null> {
  if (!event.track_part_id) return null;
  const [row] = await sql<{ strudel: string | null; strudel_mobile: string | null; label: string | null }[]>`
    select strudel, strudel_mobile, label from parts
    where id = ${event.track_part_id} and status = 'ready'`;
  return row?.strudel
    ? { strudel: row.strudel, strudel_mobile: row.strudel_mobile, label: row.label }
    : null;
}

export async function setEventPoster(
  id: string,
  userId: string,
  posterKey: string | null,
  sql: Sql = db(),
): Promise<boolean> {
  const rows = await sql`
    update events set poster_key = ${posterKey}
    where id = ${id} and user_id = ${userId} returning id`;
  return rows.length > 0;
}

export async function getEvent(
  id: string,
  userId: string,
  sql: Sql = db(),
): Promise<EventRow | null> {
  const [row] = await sql<EventRow[]>`
    select * from events where id = ${id} and user_id = ${userId}`;
  return row ?? null;
}

/** PUBLIC read — the token is the key (cancelled events still resolve so the
 *  page can say so honestly instead of 404ing on a shared link). */
export async function getEventByToken(
  token: string,
  sql: Sql = db(),
): Promise<EventRow | null> {
  const [row] = await sql<EventRow[]>`select * from events where token = ${token}`;
  return row ?? null;
}

export async function getEventsByUser(
  userId: string,
  sql: Sql = db(),
): Promise<(EventRow & EventStats)[]> {
  return sql<(EventRow & EventStats)[]>`
    select e.*,
           coalesce(t.confirmed, 0)::int   as confirmed,
           coalesce(t.gross_cents, 0)::int as gross_cents,
           coalesce(t.fee_cents, 0)::int   as fee_cents
    from events e
    left join (
      select event_id,
             count(*) filter (where status = 'confirmed')          as confirmed,
             sum(amount_cents) filter (where status = 'confirmed') as gross_cents,
             sum(fee_cents) filter (where status = 'confirmed')    as fee_cents
      from event_tickets group by event_id
    ) t on t.event_id = e.id
    where e.user_id = ${userId}
    order by e.starts_at asc nulls last, e.created_at desc`;
}

export async function confirmedCount(eventId: string, sql: Sql = db()): Promise<number> {
  const [row] = await sql<{ n: number }[]>`
    select count(*)::int as n from event_tickets
    where event_id = ${eventId} and status = 'confirmed'`;
  return Number(row?.n ?? 0);
}

/** Confirmed tickets PLUS checkout sessions opened in the last 30 minutes
 *  that haven't resolved — the capacity gate for PAID checkout creation.
 *  Counting only confirmed let N parallel buyers all pass the gate and
 *  oversell; fresh pendings hold a seat for the length of a Stripe session,
 *  then age out (an abandoned checkout never blocks the room forever). */
export async function capacityHeldCount(
  eventId: string,
  sql: Sql = db(),
): Promise<number> {
  const [row] = await sql<{ n: number }[]>`
    select count(*)::int as n from event_tickets
    where event_id = ${eventId}
      and (status = 'confirmed'
           or (status = 'pending' and created_at > now() - interval '30 minutes'))`;
  return Number(row?.n ?? 0);
}

/** Free RSVP — idempotent per email: re-tapping "I'm in" with the same email
 *  returns the existing ticket instead of erroring. Returns null when full. */
export async function claimFreeTicket(
  eventId: string,
  email: string,
  name: string | null,
  capacity: number | null,
  sql: Sql = db(),
): Promise<{ row: EventTicketRow; fresh: boolean } | "full" | null> {
  const e = email.trim().toLowerCase().slice(0, 320);
  if (!e || !e.includes("@")) return null;
  const [existing] = await sql<EventTicketRow[]>`
    select * from event_tickets
    where event_id = ${eventId} and lower(email) = ${e} and status = 'confirmed'`;
  if (existing) return { row: existing, fresh: false };
  if (capacity !== null && (await confirmedCount(eventId, sql)) >= capacity) return "full";
  try {
    const [row] = await sql<EventTicketRow[]>`
      insert into event_tickets (event_id, email, name, amount_cents, fee_cents)
      values (${eventId}, ${e}, ${name ? name.slice(0, 120) : null}, 0, 0)
      returning *`;
    return { row, fresh: true };
  } catch {
    // unique-index race (double tap) — the first insert won; return it (not fresh,
    // so the confirmation email fires only once per email, never on repeats).
    const [row] = await sql<EventTicketRow[]>`
      select * from event_tickets
      where event_id = ${eventId} and lower(email) = ${e} and status = 'confirmed'`;
    return row ? { row, fresh: false } : null;
  }
}

/** A paid ticket starts 'pending', keyed by the Stripe checkout session — the
 *  webhook confirms it (and fills the buyer email Stripe collected). */
export async function createPendingTicket(
  eventId: string,
  sessionId: string,
  amountCents: number,
  sql: Sql = db(),
): Promise<void> {
  await sql`
    insert into event_tickets (event_id, email, amount_cents, fee_cents,
                               stripe_session_id, status)
    values (${eventId}, '', ${amountCents}, ${platformFeeCents(amountCents)},
            ${sessionId}, 'pending')
    on conflict (stripe_session_id) do nothing`;
}

export async function confirmPaidTicket(
  sessionId: string,
  email: string,
  name: string | null,
  sql: Sql = db(),
): Promise<(EventTicketRow & { event_token: string; event_title: string }) | null> {
  const e = email.trim().toLowerCase().slice(0, 320);
  try {
    const [row] = await sql<(EventTicketRow & { event_token: string; event_title: string })[]>`
      with confirmed as (
        update event_tickets
        set status = 'confirmed', email = ${e}, name = ${name ? name.slice(0, 120) : null}
        where stripe_session_id = ${sessionId} and status = 'pending'
        returning *
      )
      select c.*, ev.token as event_token, ev.title as event_title
      from confirmed c join events ev on ev.id = c.event_id`;
    return row ?? null;
  } catch (err) {
    // Partial unique index (event_id, lower(email)) where status='confirmed':
    // the same email buying a SECOND ticket for the same event collides here.
    // Left to throw, the webhook 500s and Stripe retries for ~3 days, wedging the
    // paid ticket in 'pending' forever and masking other webhook traffic. Swallow
    // ONLY the unique violation (23505) so the webhook can 200; the buyer already
    // holds a confirmed ticket, so this second paid session needs a manual refund
    // — logged loudly for exactly that. Any other error still throws (→ retry).
    if ((err as { code?: string })?.code === "23505") {
      console.error(
        `[klappn] duplicate-email paid ticket — session ${sessionId} paid but the buyer already holds a confirmed ticket for this event; REFUND OWED`,
      );
      return null;
    }
    throw err;
  }
}

/** Whether this checkout session's ticket is confirmed — the success page's
 *  "you're in" check (public; the session id is the credential). */
export async function ticketBySession(
  sessionId: string,
  sql: Sql = db(),
): Promise<EventTicketRow | null> {
  const [row] = await sql<EventTicketRow[]>`
    select * from event_tickets where stripe_session_id = ${sessionId}`;
  return row ?? null;
}
