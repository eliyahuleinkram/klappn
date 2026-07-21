import { getUserId, unauthorized } from "@/lib/session";
import { createEvent, getEventsByUser, type EventPatch } from "@/lib/events";

export const dynamic = "force-dynamic";

/** The organizer's events, each with its ticket stats (confirmed / gross / fee). */
export async function GET(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();
  const events = await getEventsByUser(userId);
  return Response.json({ events }, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();
  const body = (await req.json().catch(() => ({}))) as EventPatch;
  const event = await createEvent(userId, body);
  return Response.json({ event }, { status: 201 });
}
