import { getEventByToken } from "@/lib/events";

export const dynamic = "force-dynamic";

/** PUBLIC add-to-calendar — one tap from the event page into any calendar app. */

const icsDate = (iso: string): string =>
  new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
const esc = (s: string): string =>
  s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const event = await getEventByToken(token).catch(() => null);
  if (!event || !event.starts_at) return new Response("not found", { status: 404 });

  const origin = new URL(req.url).origin;
  const url = `${origin}/e/${event.token}`;
  const end =
    event.ends_at ??
    new Date(new Date(event.starts_at).getTime() + 3 * 3600_000).toISOString();
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//klappn//events//EN",
    "BEGIN:VEVENT",
    `UID:${event.token}@klappn.com`,
    `DTSTAMP:${icsDate(new Date(event.updated_at).toISOString())}`,
    `DTSTART:${icsDate(event.starts_at)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${esc(event.title)}`,
    ...(event.venue ? [`LOCATION:${esc(event.venue)}`] : []),
    `DESCRIPTION:${esc(`${event.tagline ? event.tagline + "\n" : ""}${url}`)}`,
    `URL:${url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return new Response(lines.join("\r\n"), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="${event.token}.ics"`,
      "cache-control": "no-store",
    },
  });
}
