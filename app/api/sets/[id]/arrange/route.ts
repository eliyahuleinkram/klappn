import { arrangeSet, type SongPlan } from "@/lib/anthropic";
import { getUserId, unauthorized } from "@/lib/session";
import { entriesOf, getSetHydrated, getSet, setSetEntries } from "@/lib/sets";
import { sealDeep } from "@/lib/seal";
import { addTokenUsage, releaseReservation, reserveQuota } from "@/lib/billing";
import { makeCallSink } from "@/lib/call-trace";

/**
 * AI-ARRANGE the set: one cheap call reads every song's tempo/key/genre/summary
 * and returns the order that flows best as a night. The model never sees code —
 * this is metadata-level judgment. Manual reorder (↑↓) stays the override; a
 * hand-off whose pair changes is pruned by setSetEntries (it was composed for
 * a specific pair of neighbours).
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();
  const { id } = await params;

  const bundle = await getSetHydrated(id, userId);
  if (!bundle) return Response.json({ error: "not found" }, { status: 404 });
  const entries = entriesOf(bundle.set.plan);
  if (entries.length < 2) {
    return Response.json({ error: "add at least two songs first" }, { status: 409 });
  }

  const gate = await reserveQuota(userId);
  if (!gate.ok) return gate.response;
  try {

  const meta = entries.map((e) => {
    const b = bundle.songs.find((s) => s.song.id === e.songId);
    const p = (b?.song.plan ?? {}) as SongPlan;
    return {
      id: e.id, // ENTRY id — a song appearing twice stays two distinct slots
      title: b?.song.title ?? "(missing)",
      bpm: p.bpm,
      key: p.key,
      genre: p.genre,
      summary: p.summary,
    };
  });

  // No song_id to stamp (a set-level call) — captured for the corpus all the same.
  const sink = makeCallSink();
  const order = await arrangeSet(meta, {
    onUsage: (t) => void addTokenUsage(userId, t),
    onCall: sink.onCall,
  });
  await sink.flush();
  const byId = new Map(entries.map((e) => [e.id, e]));
  const arranged = order
    .map((eid) => byId.get(eid))
    .filter((e): e is NonNullable<typeof e> => !!e);

  const ok = await setSetEntries(id, userId, arranged);
  if (!ok) return Response.json({ error: "not found" }, { status: 404 });
  // Return the pruned plan too, so the client's transitions stay in sync.
  const fresh = await getSet(id, userId);
  // plan carries transition code — sealed like every code-bearing response.
  return Response.json(sealDeep({ ok: true, entries: arranged, plan: fresh?.plan ?? {} }));
  } finally {
    await releaseReservation(gate.id);
  }
}
