import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { warmPool } from "@/lib/db";
import { getEventsByUser } from "@/lib/events";
import EventsClient from "@/components/EventsClient";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  let userId: string | null = null;
  try {
    await warmPool(); // Kysely reserve() hangs cold on Hyperdrive — see lib/db.ts
    const session = await getAuth().api.getSession({ headers: await headers() });
    userId = session?.user?.id ?? null;
  } catch {
    userId = null;
  }
  if (!userId) redirect("/");

  const events = await getEventsByUser(userId);
  return (
    <EventsClient
      initialEvents={events.map((e) => ({
        id: e.id,
        token: e.token,
        title: e.title,
        tagline: e.tagline,
        venue: e.venue,
        startsAt: e.starts_at,
        endsAt: e.ends_at,
        salesCloseAt: e.sales_close_at,
        tz: e.tz,
        priceCents: e.price_cents,
        capacity: e.capacity,
        status: e.status,
        hasPoster: !!e.poster_key,
        trackPartId: e.track_part_id,
        updatedAt: e.updated_at,
        confirmed: e.confirmed,
        grossCents: e.gross_cents,
        feeCents: e.fee_cents,
      }))}
    />
  );
}
