import type { Metadata } from "next";
import { warmPool } from "@/lib/db";
import {
  confirmedCount,
  eventWhen,
  getEventByToken,
  getEventTrail,
  salesCloseWhen,
} from "@/lib/events";
import { sealDeep } from "@/lib/seal";
import EventClient from "@/components/EventClient";

export const dynamic = "force-dynamic";

/** PUBLIC — no account, no session: the link IS the invitation. Share it on
 *  WhatsApp and the poster, the when and the where unfurl right in the chat
 *  (the first dynamic OG surface in the app). */

async function load(token: string) {
  try {
    await warmPool();
    return await getEventByToken(token);
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const event = await load(token);
  if (!event) return { title: "Klappn" };
  const when = eventWhen(event);
  const bits = [when ? `${when.date} · ${when.time}` : null, event.venue]
    .filter(Boolean)
    .join(" — ");
  const description =
    event.tagline && bits
      ? `${event.tagline} · ${bits}`
      : event.tagline || bits || "You're invited.";
  const poster = event.poster_key
    ? `/api/e/${token}/poster?v=${Date.parse(event.updated_at) || 0}`
    : undefined;
  return {
    metadataBase: new URL("https://klappn.com"),
    title: event.title,
    description,
    openGraph: {
      title: event.title,
      description,
      type: "website",
      url: `/e/${token}`,
      ...(poster ? { images: [{ url: poster }] } : {}),
    },
    twitter: {
      card: poster ? "summary_large_image" : "summary",
      title: event.title,
      description,
      ...(poster ? { images: [poster] } : {}),
    },
  };
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const event = await load(token);

  if (!event) {
    return (
      <main className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col items-center justify-center px-6 text-center">
        <h1 className="wordmark text-gradient text-[34px] tracking-tight">
          Nothing here.
        </h1>
        <p className="mt-3 text-[14px] text-muted">
          This link doesn&rsquo;t open anything — check it and try again.
        </p>
      </main>
    );
  }

  const confirmed = await confirmedCount(event.id).catch(() => 0);
  const when = eventWhen(event);
  // The trailer's loop code crosses to the (PUBLIC) page sealed (lib/seal.ts) —
  // EventClient opens it at play time.
  const trail = await getEventTrail(event).catch(() => null);
  return (
    <EventClient
      trail={trail ? (sealDeep(trail) as typeof trail) : null}
      token={token}
      title={event.title}
      tagline={event.tagline}
      venue={event.venue}
      whenDate={when?.date ?? null}
      whenTime={when?.time ?? null}
      startsAt={event.starts_at}
      endsAt={event.ends_at}
      salesCloseAt={event.sales_close_at}
      salesCloseLabel={salesCloseWhen(event)}
      priceCents={event.price_cents}
      capacity={event.capacity}
      confirmed={confirmed}
      cancelled={event.status === "cancelled"}
      posterUrl={
        event.poster_key
          ? `/api/e/${token}/poster?v=${Date.parse(event.updated_at) || 0}`
          : null
      }
    />
  );
}
