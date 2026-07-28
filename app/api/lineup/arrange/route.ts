import { arrangeSet } from "@/lib/anthropic";
import { getUserId, unauthorized } from "@/lib/session";
import { addTokenUsage, releaseReservation, reserveQuota } from "@/lib/billing";
import { makeCallSink } from "@/lib/call-trace";
import { clientIp, rateLimit, tooMany } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * ✦ ARRANGE THE BOILER ROOM'S LINEUP (2026-07-28) — the Sets arrange call,
 * unhooked from the sets table: the room's lineup lives in the DJ's browser
 * (localStorage, like the bench itself), so the client sends the metadata and
 * takes back the order. Same one cheap metadata-level call ([[arrangeSet]]),
 * same judgment: order the night by tempo arc + key compatibility.
 */
export async function POST(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();
  if (!(await rateLimit(`lineup:ip:${clientIp(req)}`, 10, 60))) return tooMany();

  const body = (await req.json().catch(() => null)) as {
    songs?: { id?: unknown; title?: unknown; bpm?: unknown; key?: unknown; genre?: unknown; summary?: unknown }[];
  } | null;
  const songs = (Array.isArray(body?.songs) ? body.songs : [])
    .filter((s) => typeof s?.id === "string" && typeof s?.title === "string")
    .slice(0, 40)
    .map((s) => ({
      id: (s.id as string).slice(0, 64),
      title: (s.title as string).slice(0, 120),
      bpm: typeof s.bpm === "number" ? s.bpm : undefined,
      key: typeof s.key === "string" ? s.key.slice(0, 24) : undefined,
      genre: typeof s.genre === "string" ? s.genre.slice(0, 48) : undefined,
      summary: typeof s.summary === "string" ? s.summary.slice(0, 200) : undefined,
    }));
  if (songs.length < 2) {
    return Response.json({ error: "add at least two songs first" }, { status: 409 });
  }

  const gate = await reserveQuota(userId);
  if (!gate.ok) return gate.response;
  try {
    const sink = makeCallSink();
    const order = await arrangeSet(songs, {
      onUsage: (t) => void addTokenUsage(userId, t),
      onCall: sink.onCall,
    });
    await sink.flush();
    return Response.json({ order });
  } catch (e) {
    console.error("[klappn] lineup arrange failed:", e);
    return Response.json({ error: "arrange failed" }, { status: 500 });
  } finally {
    await releaseReservation(userId);
  }
}
